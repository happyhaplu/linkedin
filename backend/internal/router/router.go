package router

import (
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/reach/backend/internal/automation"
	"github.com/reach/backend/internal/config"
	"github.com/reach/backend/internal/handler"
	mw "github.com/reach/backend/internal/middleware"
	"github.com/reach/backend/internal/repository"
	"github.com/reach/backend/internal/service"
	"github.com/reach/backend/internal/workers"
	"gorm.io/gorm"
)

// Setup configures all routes and middleware on the Fiber app.
func Setup(app *fiber.App, cfg *config.Config, db *gorm.DB, workerMgr *workers.WorkerManager, browserMgr *automation.BrowserManager) {
	// ── Global middleware ────────────────────────────────────────────────────
	app.Use(recover.New())
	app.Use(mw.Logger())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendURL + ", " + cfg.AppURL,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
	}))

	// ── Health ──────────────────────────────────────────────────────────────
	app.Get("/health", handler.HealthHandler())

	// ── Auth routes (no session required) ───────────────────────────────────
	app.Get("/callback", handler.CallbackHandler(cfg, db))
	app.Post("/stripe/webhook", handler.StripeWebhookHandler(cfg, db))
	authGroup := app.Group("/auth")
	authGroup.Post("/signout", handler.SignOutHandler(cfg, db))
	authGroup.Get("/signout", handler.SignOutHandler(cfg, db))

	admin := app.Group("/admin")
	admin.Post("/login", handler.AdminLoginHandler(cfg, db))
	admin.Post("/logout", handler.AdminLogoutHandler(cfg, db))
	admin.Get("/me", mw.RequireAdmin(db), handler.AdminMeHandler(db))
	admin.Get("/users", mw.RequireAdmin(db), handler.AdminListUsersHandler(db))
	admin.Get("/users/:workspace_id", mw.RequireAdmin(db), handler.AdminGetUserHandler(db))
	admin.Put("/users/:workspace_id", mw.RequireAdmin(db), handler.AdminUpdateUserHandler(db))
	admin.Post("/users/:workspace_id/assign-plan", mw.RequireAdmin(db), handler.AdminAssignCustomPlanHandler(db))
	admin.Get("/plans", mw.RequireAdmin(db), handler.AdminListPlansHandler(db))
	admin.Post("/plans", mw.RequireAdmin(db), handler.AdminCreatePlanHandler(db))
	admin.Put("/plans/:id", mw.RequireAdmin(db), handler.AdminUpdatePlanHandler(db))

	// ── API routes (session required) ───────────────────────────────────────
	api := app.Group("/api", mw.RequireSession(cfg, db))
	protected := api.Group("", mw.RequireAuth(cfg, db))

	// Auth introspection
	api.Get("/auth/me", handler.MeHandler())

	// Check route — proxies to Accounts for real-time subscription validation
	// Uses the stricter middleware that calls Accounts /check on every request
	api.Get("/auth/check", mw.RequireAuthWithCheck(cfg, db), handler.CheckHandler(cfg, db))
	api.Post("/billing/checkout", handler.BillingCheckoutHandler(cfg, db))
	api.Post("/billing/portal", handler.BillingPortalHandler(cfg, db))

	// ── Profile ─────────────────────────────────────────────────────────────
	protected.Get("/profile", handler.ProfileHandler(cfg))

	// ── Account Management Module ───────────────────────────────────────────
	setupAccountRoutes(protected, db)

	// ── Campaign Engine Module ──────────────────────────────────────────────
	setupCampaignRoutes(protected, db, browserMgr)

	// ── Lead Management Module ──────────────────────────────────────────────
	setupLeadRoutes(protected, db)

	// ── My Network Module ───────────────────────────────────────────────────
	setupNetworkRoutes(protected, db, browserMgr)

	// ── Unibox (Unified Inbox) Module ───────────────────────────────────────
	setupUniboxRoutes(protected, db, workerMgr)

	// ── Analytics Module ────────────────────────────────────────────────────
	setupAnalyticsRoutes(protected, db)

	// ── Queue Management Routes ─────────────────────────────────────────────
	setupQueueRoutes(protected, workerMgr)

	// ── SPA Static Files (production only) ──────────────────────────────────
	// In production, the Vue frontend is built and placed in /app/public.
	// Fiber serves the static assets and falls back to index.html for SPA routing.
	spaDir := os.Getenv("SPA_DIR")
	if spaDir == "" {
		spaDir = "./public"
	}
	if info, err := os.Stat(spaDir); err == nil && info.IsDir() {
		app.Static("/", spaDir, fiber.Static{
			Compress: true,
			Index:    "index.html",
		})
		// SPA fallback: any non-API, non-auth, non-health route serves index.html
		app.Get("/*", func(c *fiber.Ctx) error {
			return c.SendFile(spaDir + "/index.html")
		})
	}
}

// setupAccountRoutes registers all LinkedIn account and proxy management routes.
func setupAccountRoutes(api fiber.Router, db *gorm.DB) {
	// ── Repositories ────────────────────────────────────────────────────────
	accountRepo := repository.NewLinkedInAccountRepository(db)
	proxyRepo := repository.NewProxyRepository(db)
	healthRepo := repository.NewAccountHealthRepository(db)

	// ── Services ────────────────────────────────────────────────────────────
	accountSvc := service.NewLinkedInAccountService(accountRepo, proxyRepo, healthRepo)
	proxySvc := service.NewProxyService(proxyRepo)

	// ── Handlers ────────────────────────────────────────────────────────────
	accountH := handler.NewLinkedInAccountHandler(accountSvc)
	proxyH := handler.NewProxyHandler(proxySvc)

	// ── LinkedIn Accounts ───────────────────────────────────────────────────
	accounts := api.Group("/linkedin-accounts")
	accounts.Get("/", accountH.ListAccounts())                        // GET    /api/linkedin-accounts
	accounts.Get("/:id", accountH.GetAccount())                       // GET    /api/linkedin-accounts/:id
	accounts.Post("/cookie", accountH.CreateWithCookie())              // POST   /api/linkedin-accounts/cookie
	accounts.Post("/monitor-health", accountH.MonitorHealth())         // POST   /api/linkedin-accounts/monitor-health
	accounts.Post("/:id/reconnect", accountH.Reconnect())             // POST   /api/linkedin-accounts/:id/reconnect
	accounts.Post("/:id/toggle-status", accountH.ToggleStatus())       // POST   /api/linkedin-accounts/:id/toggle-status
	accounts.Post("/:id/verify-otp", accountH.VerifyOTP())             // POST   /api/linkedin-accounts/:id/verify-otp
	accounts.Post("/:id/check-connection", accountH.CheckConnection()) // POST   /api/linkedin-accounts/:id/check-connection
	accounts.Put("/:id/limits", accountH.UpdateLimits())               // PUT    /api/linkedin-accounts/:id/limits
	accounts.Put("/:id/proxy", accountH.UpdateProxy())                 // PUT    /api/linkedin-accounts/:id/proxy
	accounts.Put("/:id/campaigns", accountH.AssignCampaigns())         // PUT    /api/linkedin-accounts/:id/campaigns
	accounts.Put("/:id/profile", accountH.UpdateProfile())             // PUT    /api/linkedin-accounts/:id/profile
	accounts.Get("/:id/health-history", accountH.GetHealthHistory())   // GET    /api/linkedin-accounts/:id/health-history
	accounts.Delete("/:id", accountH.DeleteAccount())                  // DELETE /api/linkedin-accounts/:id

	// ── Proxies ─────────────────────────────────────────────────────────────
	proxies := api.Group("/proxies")
	proxies.Get("/", proxyH.ListProxies())         // GET    /api/proxies
	proxies.Get("/:id", proxyH.GetProxy())         // GET    /api/proxies/:id
	proxies.Post("/", proxyH.CreateProxy())        // POST   /api/proxies
	proxies.Put("/:id", proxyH.UpdateProxy())      // PUT    /api/proxies/:id
	proxies.Post("/:id/test", proxyH.TestProxy())  // POST   /api/proxies/:id/test
	proxies.Delete("/:id", proxyH.DeleteProxy())   // DELETE /api/proxies/:id
}

// setupCampaignRoutes registers all campaign engine routes.
func setupCampaignRoutes(api fiber.Router, db *gorm.DB, browserMgr *automation.BrowserManager) {
	// ── Repositories ────────────────────────────────────────────────────────
	accountRepo := repository.NewLinkedInAccountRepository(db)
	campaignRepo := repository.NewCampaignRepository(db)
	senderRepo := repository.NewCampaignSenderRepository(db)
	sequenceRepo := repository.NewCampaignSequenceRepository(db)
	leadRepo := repository.NewCampaignLeadRepository(db)
	activityRepo := repository.NewCampaignActivityRepository(db)
	counterRepo := repository.NewDailyCounterRepository(db)
	webhookRepo := repository.NewCampaignWebhookRepository(db)
	whLogRepo := repository.NewCampaignWebhookLogRepository(db)
	leadDataRepo := repository.NewLeadRepository(db)

	// ── Services ────────────────────────────────────────────────────────────
	webhookSvc := service.NewWebhookService(webhookRepo, whLogRepo)
	campaignSvc := service.NewCampaignService(
		campaignRepo, senderRepo, sequenceRepo, leadRepo,
		activityRepo, counterRepo, webhookRepo, whLogRepo, accountRepo,
		leadDataRepo,
	)

	// Wire real automation if BrowserManager is available
	var linkedinAutomation service.LinkedInAutomation
	if browserMgr != nil {
		linkedinAutomation = automation.NewCampaignAutomation(browserMgr)
	}

	executorSvc := service.NewCampaignExecutorService(
		campaignRepo, senderRepo, sequenceRepo, leadRepo,
		counterRepo, activityRepo, accountRepo,
		leadDataRepo, linkedinAutomation,
		webhookSvc,
	)
	// WebhookService is also available standalone for ad-hoc triggers
	_ = webhookSvc

	// ── Handler ─────────────────────────────────────────────────────────────
	h := handler.NewCampaignHandler(campaignSvc, executorSvc)

	// ── Campaign CRUD ───────────────────────────────────────────────────────
	campaigns := api.Group("/campaigns")
	campaigns.Get("/stats", h.GetStats())             // GET    /api/campaigns/stats
	campaigns.Get("/templates", h.GetTemplates())      // GET    /api/campaigns/templates
	campaigns.Get("/", h.ListCampaigns())              // GET    /api/campaigns
	campaigns.Get("/:id", h.GetCampaign())             // GET    /api/campaigns/:id
	campaigns.Post("/", h.CreateCampaign())            // POST   /api/campaigns
	campaigns.Put("/:id", h.UpdateCampaign())          // PUT    /api/campaigns/:id
	campaigns.Delete("/:id", h.DeleteCampaign())       // DELETE /api/campaigns/:id

	// ── Campaign Lifecycle ──────────────────────────────────────────────────
	campaigns.Post("/:id/start", h.StartCampaign())    // POST   /api/campaigns/:id/start
	campaigns.Post("/:id/pause", h.PauseCampaign())    // POST   /api/campaigns/:id/pause
	campaigns.Post("/:id/resume", h.ResumeCampaign())  // POST   /api/campaigns/:id/resume
	campaigns.Post("/:id/stop", h.StopCampaign())      // POST   /api/campaigns/:id/stop

	// ── Sequences ───────────────────────────────────────────────────────────
	campaigns.Get("/:id/sequences", h.GetSequences())                         // GET    /api/campaigns/:id/sequences
	campaigns.Put("/:id/sequences/:seqId", h.UpdateSequence())                // PUT    /api/campaigns/:id/sequences/:seqId
	campaigns.Post("/:id/sequences/:seqId/ab-winner", h.DeclareABWinner())    // POST   /api/campaigns/:id/sequences/:seqId/ab-winner

	// ── Leads ───────────────────────────────────────────────────────────────
	campaigns.Get("/:id/leads", h.GetLeads())                  // GET    /api/campaigns/:id/leads
	campaigns.Get("/:id/leads/stats", h.GetLeadStats())        // GET    /api/campaigns/:id/leads/stats
	campaigns.Post("/:id/leads", h.AddLeads())                 // POST   /api/campaigns/:id/leads
	campaigns.Post("/:id/leads/from-list", h.AddLeadsFromList()) // POST /api/campaigns/:id/leads/from-list
	campaigns.Delete("/:id/leads", h.RemoveLeads())            // DELETE /api/campaigns/:id/leads

	// ── Stats & Analytics ───────────────────────────────────────────────────
	campaigns.Get("/:id/stats", h.GetCampaignDetailStats())                  // GET    /api/campaigns/:id/stats
	campaigns.Get("/:id/analytics", h.GetAnalytics())                        // GET    /api/campaigns/:id/analytics
	campaigns.Get("/:id/performance/sequences", h.GetSequencePerformance())  // GET    /api/campaigns/:id/performance/sequences
	campaigns.Get("/:id/performance/senders", h.GetSenderPerformance())      // GET    /api/campaigns/:id/performance/senders

	// ── Activity ────────────────────────────────────────────────────────────
	campaigns.Get("/:id/activity", h.GetActivityLog())    // GET    /api/campaigns/:id/activity
	campaigns.Post("/:id/activity", h.LogActivity())      // POST   /api/campaigns/:id/activity

	// ── Duplicate ───────────────────────────────────────────────────────────
	campaigns.Post("/:id/duplicate", h.DuplicateCampaign()) // POST /api/campaigns/:id/duplicate

	// ── Export ──────────────────────────────────────────────────────────────
	campaigns.Get("/:id/export", h.ExportLeads())         // GET    /api/campaigns/:id/export

	// ── Senders ─────────────────────────────────────────────────────────────
	campaigns.Post("/:id/senders", h.AddSender())                    // POST   /api/campaigns/:id/senders
	campaigns.Delete("/:id/senders/:senderId", h.RemoveSender())     // DELETE /api/campaigns/:id/senders/:senderId

	// ── Webhooks ────────────────────────────────────────────────────────────
	campaigns.Get("/:id/webhooks", h.GetWebhooks())                        // GET    /api/campaigns/:id/webhooks
	campaigns.Post("/:id/webhooks", h.CreateWebhook())                     // POST   /api/campaigns/:id/webhooks
	campaigns.Put("/:id/webhooks/:webhookId", h.UpdateWebhook())           // PUT    /api/campaigns/:id/webhooks/:webhookId
	campaigns.Delete("/:id/webhooks/:webhookId", h.DeleteWebhook())        // DELETE /api/campaigns/:id/webhooks/:webhookId
	campaigns.Get("/:id/webhook-logs", h.GetWebhookLogs())                 // GET    /api/campaigns/:id/webhook-logs
}

// setupLeadRoutes registers all lead management routes (leads, lists, custom fields).
func setupLeadRoutes(api fiber.Router, db *gorm.DB) {
	// ── Repositories ────────────────────────────────────────────────────────
	leadRepo := repository.NewLeadRepository(db)
	listRepo := repository.NewLeadListRepository(db)
	cfRepo := repository.NewCustomFieldRepository(db)

	// ── Service ─────────────────────────────────────────────────────────────
	leadSvc := service.NewLeadService(leadRepo, listRepo, cfRepo)

	// ── Handler ─────────────────────────────────────────────────────────────
	h := handler.NewLeadHandler(leadSvc)

	// ── Lists ───────────────────────────────────────────────────────────────
	lists := api.Group("/lists")
	lists.Get("/", h.ListLists())        // GET    /api/lists
	lists.Get("/:id", h.GetList())       // GET    /api/lists/:id
	lists.Post("/", h.CreateList())      // POST   /api/lists
	lists.Put("/:id", h.UpdateList())    // PUT    /api/lists/:id
	lists.Delete("/:id", h.DeleteList()) // DELETE /api/lists/:id

	// ── Leads ───────────────────────────────────────────────────────────────
	leads := api.Group("/leads")
	leads.Get("/", h.ListLeads())                                // GET    /api/leads
	leads.Get("/:id", h.GetLead())                               // GET    /api/leads/:id
	leads.Post("/import", h.ImportLeads())                       // POST   /api/leads/import
	leads.Post("/add-from-connection", h.AddFromConnection())    // POST   /api/leads/add-from-connection
	leads.Post("/bulk-status", h.BulkUpdateStatus())             // POST   /api/leads/bulk-status
	leads.Post("/bulk-delete", h.BulkDeleteLeads())              // POST   /api/leads/bulk-delete
	leads.Put("/:id", h.UpdateLead())                            // PUT    /api/leads/:id
	leads.Delete("/:id", h.DeleteLead())                         // DELETE /api/leads/:id

	// ── Custom Fields ───────────────────────────────────────────────────────
	cf := api.Group("/custom-fields")
	cf.Get("/", h.ListCustomFields())        // GET    /api/custom-fields
	cf.Post("/", h.CreateCustomField())      // POST   /api/custom-fields
	cf.Put("/:id", h.UpdateCustomField())    // PUT    /api/custom-fields/:id
	cf.Delete("/:id", h.DeleteCustomField()) // DELETE /api/custom-fields/:id
}

// setupNetworkRoutes registers all My Network routes (connections, requests, sync, analytics).
func setupNetworkRoutes(api fiber.Router, db *gorm.DB, browserMgr *automation.BrowserManager) {
	// ── Repositories ────────────────────────────────────────────────────────
	connRepo := repository.NewNetworkConnectionRepository(db)
	reqRepo := repository.NewConnectionRequestRepository(db)
	syncLogRepo := repository.NewNetworkSyncLogRepository(db)
	accountRepo := repository.NewLinkedInAccountRepository(db)

	// ── Wire real syncer if BrowserManager is available ─────────────────────
	var syncer service.NetworkSyncer
	if browserMgr != nil {
		syncer = automation.NewNetworkSyncService(browserMgr, accountRepo, connRepo, db)
	}

	// ── Service ─────────────────────────────────────────────────────────────
	networkSvc := service.NewNetworkService(connRepo, reqRepo, syncLogRepo, accountRepo, syncer)

	// ── Handler ─────────────────────────────────────────────────────────────
	h := handler.NewNetworkHandler(networkSvc)

	// ── Connections ─────────────────────────────────────────────────────────
	conns := api.Group("/network/connections")
	conns.Get("/stats", h.GetConnectionStats())        // GET    /api/network/connections/stats
	conns.Get("/", h.ListConnections())                // GET    /api/network/connections
	conns.Get("/:id", h.GetConnection())               // GET    /api/network/connections/:id
	conns.Post("/", h.CreateConnection())              // POST   /api/network/connections
	conns.Put("/:id", h.UpdateConnection())            // PUT    /api/network/connections/:id
	conns.Delete("/:id", h.DeleteConnection())         // DELETE /api/network/connections/:id
	conns.Post("/:id/favorite", h.ToggleFavorite())    // POST   /api/network/connections/:id/favorite
	conns.Post("/bulk-delete", h.BulkDeleteConnections()) // POST /api/network/connections/bulk-delete
	conns.Post("/bulk-tags", h.BulkUpdateTags())       // POST   /api/network/connections/bulk-tags

	// ── Connection Requests ─────────────────────────────────────────────────
	reqs := api.Group("/network/requests")
	reqs.Get("/", h.ListRequests())                        // GET    /api/network/requests
	reqs.Post("/", h.CreateRequest())                      // POST   /api/network/requests
	reqs.Put("/:id", h.UpdateRequest())                    // PUT    /api/network/requests/:id
	reqs.Post("/:id/accept", h.AcceptRequest())            // POST   /api/network/requests/:id/accept
	reqs.Post("/:id/withdraw", h.WithdrawRequest())        // POST   /api/network/requests/:id/withdraw
	reqs.Delete("/:id", h.DeleteRequest())                 // DELETE /api/network/requests/:id
	reqs.Post("/bulk-withdraw", h.BulkWithdrawRequests())  // POST   /api/network/requests/bulk-withdraw

	// ── Sync ────────────────────────────────────────────────────────────────
	sync := api.Group("/network/sync")
	sync.Post("/", h.StartSync())               // POST   /api/network/sync
	sync.Get("/logs", h.GetSyncLogs())           // GET    /api/network/sync/logs
	sync.Get("/latest", h.GetLatestSyncLog())    // GET    /api/network/sync/latest

	// ── Analytics ───────────────────────────────────────────────────────────
	api.Get("/network/analytics", h.GetAnalytics()) // GET /api/network/analytics
}

// setupUniboxRoutes registers all Unified Inbox routes (conversations, messages, sync).
func setupUniboxRoutes(api fiber.Router, db *gorm.DB, workerMgr *workers.WorkerManager) {
	// ── Repositories ────────────────────────────────────────────────────────
	convRepo := repository.NewConversationRepository(db)
	msgRepo := repository.NewMessageRepository(db)
	accountRepo := repository.NewLinkedInAccountRepository(db)

	// ── Service ─────────────────────────────────────────────────────────────
	// Wire real queue functions for reply sending and sync triggering
	var queueReplyFn service.MessageQueueFunc
	var triggerSyncFn service.SyncTriggerFunc

	if workerMgr != nil && workerMgr.MessageSync != nil {
		queueReplyFn = func(payload service.MessageQueuePayload) error {
			_, err := workerMgr.MessageSync.QueueReply(
				payload.LinkedInAccountID,
				payload.ThreadID,
				payload.MessageText,
				payload.ConversationID,
			)
			return err
		}
		triggerSyncFn = func(userID string) error {
			_, err := workerMgr.MessageSync.QueueSyncAccount("", userID)
			return err
		}
	}

	uniboxSvc := service.NewUniboxService(
		convRepo, msgRepo, accountRepo, db,
		queueReplyFn,
		triggerSyncFn,
	)

	// ── Handler ─────────────────────────────────────────────────────────────
	uh := handler.NewUniboxHandler(uniboxSvc)

	// ── Conversations ───────────────────────────────────────────────────────
	unibox := api.Group("/unibox")
	unibox.Get("/conversations", uh.ListConversations())                       // GET    /api/unibox/conversations
	unibox.Get("/conversations/:id/messages", uh.GetMessages())                // GET    /api/unibox/conversations/:id/messages
	unibox.Post("/conversations/:id/read", uh.MarkAsRead())                    // POST   /api/unibox/conversations/:id/read
	unibox.Post("/conversations/:id/archive", uh.ArchiveConversation())        // POST   /api/unibox/conversations/:id/archive
	unibox.Put("/conversations/:id/label", uh.SetLabel())                      // PUT    /api/unibox/conversations/:id/label

	// ── Messages ────────────────────────────────────────────────────────────
	unibox.Post("/messages", uh.SendMessage()) // POST /api/unibox/messages

	// ── Sync ────────────────────────────────────────────────────────────────
	unibox.Post("/sync", uh.TriggerSync()) // POST /api/unibox/sync

	// ── Accounts (for picker) ───────────────────────────────────────────────
	unibox.Get("/accounts", uh.GetLinkedInAccounts()) // GET /api/unibox/accounts

	// ── Campaign Context ────────────────────────────────────────────────────
	unibox.Get("/campaign-context", uh.GetCampaignContext()) // GET /api/unibox/campaign-context
}

// setupAnalyticsRoutes registers the analytics dashboard endpoint.
func setupAnalyticsRoutes(api fiber.Router, db *gorm.DB) {
	// ── Repository ──────────────────────────────────────────────────────────
	analyticsRepo := repository.NewAnalyticsRepository(db)

	// ── Service ─────────────────────────────────────────────────────────────
	analyticsSvc := service.NewAnalyticsService(analyticsRepo)

	// ── Handler ─────────────────────────────────────────────────────────────
	h := handler.NewAnalyticsHandler(analyticsSvc)

	// ── Route ───────────────────────────────────────────────────────────────
	api.Get("/analytics", h.GetAnalyticsData()) // GET /api/analytics
}

// setupQueueRoutes registers queue management endpoints.
func setupQueueRoutes(api fiber.Router, workerMgr *workers.WorkerManager) {
	queueGroup := api.Group("/queue")
	qm := workerMgr.QueueManager()
	queueGroup.Get("/stats", handler.QueueStatsHandler(qm))       // GET  /api/queue/stats
	queueGroup.Post("/pause", handler.QueuePauseAllHandler(qm))   // POST /api/queue/pause
	queueGroup.Post("/resume", handler.QueueResumeAllHandler(qm)) // POST /api/queue/resume
}

package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/reach/backend/internal/models"
)

// Connect opens a GORM connection pool and auto-migrates all model schemas.
// AutoMigrate only adds missing columns/indexes — it never drops existing data.
func Connect(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("[DB] Failed to connect: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("[DB] Failed to get underlying sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)

	log.Println("[DB] Connected to PostgreSQL")

	// Migrate Session table first — critical for auth to work
	if err := db.AutoMigrate(&models.Session{}); err != nil {
		log.Printf("[DB] Session migrate warning: %v", err)
	}

	// Auto-migrate all remaining models — adds any missing columns/indexes safely
	if err := db.AutoMigrate(
		&models.Lead{},
		&models.LeadList{},
		&models.CustomField{},
		&models.LinkedInAccount{},
		&models.Proxy{},
		&models.Campaign{},
		&models.CampaignSequence{},
		&models.CampaignLead{},
		&models.CampaignSender{},
		&models.CampaignActivityLog{},
		&models.AccountDailyCounter{},
		&models.CampaignWebhook{},
		&models.CampaignWebhookLog{},
		&models.AccountHealthLog{},
		&models.NetworkConnection{},
		&models.ConnectionRequest{},
		&models.NetworkSyncLog{},
		&models.Conversation{},
		&models.Message{},
	); err != nil {
		log.Printf("[DB] AutoMigrate warning: %v", err)
	} else {
		log.Println("[DB] AutoMigrate complete — all tables up to date")
	}

	// Migrate billing + admin tables
	if err := db.AutoMigrate(
		&models.Plan{},
		&models.UserPlan{},
		&models.AdminSession{},
	); err != nil {
		log.Printf("[DB] Billing migrate warning: %v", err)
	} else {
		log.Println("[DB] Billing tables ready")
	}

	return db
}

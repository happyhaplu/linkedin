package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// ConversationRepository provides data-access for the conversations table.
type ConversationRepository struct {
	db *gorm.DB
}

func NewConversationRepository(db *gorm.DB) *ConversationRepository {
	return &ConversationRepository{db: db}
}

// FindAllByAccountIDs returns conversations scoped to a set of LinkedIn account IDs,
// with optional filters, ordered by last_message_at DESC.
func (r *ConversationRepository) FindAllByAccountIDs(accountIDs []uuid.UUID, f models.GetConversationsFilter) ([]models.Conversation, error) {
	var convs []models.Conversation
	q := r.db.Preload("LinkedInAccount", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, email")
	}).Where("linkedin_account_id IN ?", accountIDs)

	// Account filter (narrow to single account)
	if f.AccountID != "" {
		q = q.Where("linkedin_account_id = ?", f.AccountID)
	}

	// Archived filter
	if f.ShowArchived != nil && !*f.ShowArchived {
		q = q.Where("is_archived = ?", false)
	}

	// Unread filter
	if f.OnlyUnread {
		q = q.Where("unread_count > ?", 0)
	}

	// Label filter
	if f.Label != "" {
		q = q.Where("label = ?", f.Label)
	}

	// Search (ILIKE on participant_name and last_message_preview)
	if f.SearchQuery != "" {
		pattern := "%" + f.SearchQuery + "%"
		q = q.Where("(participant_name ILIKE ? OR last_message_preview ILIKE ?)", pattern, pattern)
	}

	err := q.Order("last_message_at DESC").Find(&convs).Error
	return convs, err
}

// FindByID returns a single conversation by ID.
func (r *ConversationRepository) FindByID(id uuid.UUID) (*models.Conversation, error) {
	var conv models.Conversation
	err := r.db.Preload("LinkedInAccount", func(tx *gorm.DB) *gorm.DB {
		return tx.Select("id, email")
	}).Where("id = ?", id).First(&conv).Error
	return &conv, err
}

// FindByThreadID returns a conversation by its LinkedIn thread_id.
func (r *ConversationRepository) FindByThreadID(threadID string) (*models.Conversation, error) {
	var conv models.Conversation
	err := r.db.Where("thread_id = ?", threadID).First(&conv).Error
	return &conv, err
}

// Create inserts a new conversation.
func (r *ConversationRepository) Create(conv *models.Conversation) error {
	return r.db.Create(conv).Error
}

// Update saves changes to a conversation.
func (r *ConversationRepository) Update(conv *models.Conversation) error {
	return r.db.Save(conv).Error
}

// SetArchived sets the is_archived flag.
func (r *ConversationRepository) SetArchived(id uuid.UUID, archived bool) error {
	return r.db.Model(&models.Conversation{}).Where("id = ?", id).Update("is_archived", archived).Error
}

// SetLabel sets (or clears) the label.
func (r *ConversationRepository) SetLabel(id uuid.UUID, label *string) error {
	return r.db.Model(&models.Conversation{}).Where("id = ?", id).Update("label", label).Error
}

// ResetUnreadCount sets unread_count to 0.
func (r *ConversationRepository) ResetUnreadCount(id uuid.UUID) error {
	return r.db.Model(&models.Conversation{}).Where("id = ?", id).Update("unread_count", 0).Error
}

// UpdateLastMessage updates preview fields after a new message is sent.
func (r *ConversationRepository) UpdateLastMessage(id uuid.UUID, preview string) error {
	return r.db.Model(&models.Conversation{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"last_message_at":      gorm.Expr("NOW()"),
			"last_message_preview": preview,
		}).Error
}

// Delete removes a conversation.
func (r *ConversationRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&models.Conversation{}).Error
}

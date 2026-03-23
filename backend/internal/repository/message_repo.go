package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// MessageRepository provides data-access for the messages table.
type MessageRepository struct {
	db *gorm.DB
}

func NewMessageRepository(db *gorm.DB) *MessageRepository {
	return &MessageRepository{db: db}
}

// FindByConversation returns all messages for a conversation, ordered by sent_at ASC.
func (r *MessageRepository) FindByConversation(conversationID uuid.UUID) ([]models.Message, error) {
	var msgs []models.Message
	err := r.db.Where("conversation_id = ?", conversationID).
		Order("sent_at ASC").
		Find(&msgs).Error
	return msgs, err
}

// FindByID returns a single message.
func (r *MessageRepository) FindByID(id uuid.UUID) (*models.Message, error) {
	var msg models.Message
	err := r.db.Where("id = ?", id).First(&msg).Error
	return &msg, err
}

// Create inserts a new message.
func (r *MessageRepository) Create(msg *models.Message) error {
	return r.db.Create(msg).Error
}

// MarkAllAsReadInConversation marks all incoming (non-me) messages as read.
func (r *MessageRepository) MarkAllAsReadInConversation(conversationID uuid.UUID) error {
	return r.db.Model(&models.Message{}).
		Where("conversation_id = ? AND is_from_me = ?", conversationID, false).
		Update("is_read", true).Error
}

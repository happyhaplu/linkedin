package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User mirrors the existing "users" table created by the Next.js app.
// We do NOT add password_hash here — Reach no longer manages passwords.
// The password_hash column still exists in the DB but is ignored by GORM.
type User struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email     string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate ensures the UUID is set if empty.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

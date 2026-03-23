package repository

import (
	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"gorm.io/gorm"
)

// DailyCounterRepository handles account daily counter DB operations.
type DailyCounterRepository struct {
	db *gorm.DB
}

func NewDailyCounterRepository(db *gorm.DB) *DailyCounterRepository {
	return &DailyCounterRepository{db: db}
}

// FindByAccountAndDate returns a daily counter for an account on a specific date.
func (r *DailyCounterRepository) FindByAccountAndDate(accountID uuid.UUID, date string) (*models.AccountDailyCounter, error) {
	var counter models.AccountDailyCounter
	err := r.db.Where("linkedin_account_id = ? AND date = ?", accountID, date).First(&counter).Error
	if err != nil {
		return nil, err
	}
	return &counter, nil
}

// Create inserts a new daily counter.
func (r *DailyCounterRepository) Create(counter *models.AccountDailyCounter) error {
	return r.db.Create(counter).Error
}

// IncrementColumn atomically increments a column on a daily counter.
func (r *DailyCounterRepository) IncrementColumn(accountID uuid.UUID, date, column string) error {
	result := r.db.Model(&models.AccountDailyCounter{}).
		Where("linkedin_account_id = ? AND date = ?", accountID, date).
		UpdateColumns(map[string]interface{}{
			column:         gorm.Expr(column + " + 1"),
			"total_actions": gorm.Expr("total_actions + 1"),
		})

	if result.RowsAffected == 0 {
		// No existing row — create one
		counter := models.AccountDailyCounter{
			LinkedInAccountID: accountID,
			Date:              date,
			TotalActions:      1,
		}
		switch column {
		case "connections_sent":
			counter.ConnectionsSent = 1
		case "messages_sent":
			counter.MessagesSent = 1
		case "inmails_sent":
			counter.InMailsSent = 1
		case "profile_views":
			counter.ProfileViews = 1
		}
		return r.db.Create(&counter).Error
	}
	return result.Error
}

// FindByAccountInDateRange returns counters for an account in a date range.
func (r *DailyCounterRepository) FindByAccountInDateRange(accountID uuid.UUID, startDate, endDate string) ([]models.AccountDailyCounter, error) {
	var counters []models.AccountDailyCounter
	err := r.db.Where("linkedin_account_id = ? AND date >= ? AND date <= ?", accountID, startDate, endDate).
		Find(&counters).Error
	return counters, err
}

// FindByAccountIDsAndDate returns counters for multiple accounts on a date.
func (r *DailyCounterRepository) FindByAccountIDsAndDate(accountIDs []uuid.UUID, date string) ([]models.AccountDailyCounter, error) {
	var counters []models.AccountDailyCounter
	err := r.db.Where("linkedin_account_id IN ? AND date = ?", accountIDs, date).Find(&counters).Error
	return counters, err
}

// SumWeeklyConnections returns total connections sent in the last 7 days.
func (r *DailyCounterRepository) SumWeeklyConnections(accountID uuid.UUID, fromDate string) (int, error) {
	var total struct {
		Sum int
	}
	err := r.db.Model(&models.AccountDailyCounter{}).
		Select("COALESCE(SUM(connections_sent), 0) as sum").
		Where("linkedin_account_id = ? AND date >= ?", accountID, fromDate).
		Scan(&total).Error
	return total.Sum, err
}

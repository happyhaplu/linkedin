package service

import (
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/reach/backend/internal/models"
	"github.com/reach/backend/internal/repository"
	"gorm.io/gorm"
)

// LeadService encapsulates all business logic for Leads, Lists, and Custom Fields.
type LeadService struct {
	leadRepo        *repository.LeadRepository
	listRepo        *repository.LeadListRepository
	customFieldRepo *repository.CustomFieldRepository
}

func NewLeadService(
	leadRepo *repository.LeadRepository,
	listRepo *repository.LeadListRepository,
	customFieldRepo *repository.CustomFieldRepository,
) *LeadService {
	return &LeadService{
		leadRepo:        leadRepo,
		listRepo:        listRepo,
		customFieldRepo: customFieldRepo,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTS
// ═══════════════════════════════════════════════════════════════════════════════

// GetLists returns all lists for the authenticated user.
func (s *LeadService) GetLists(userID uuid.UUID) ([]models.LeadList, error) {
	return s.listRepo.FindAllByUser(userID)
}

// GetListByID returns a single list.
func (s *LeadService) GetListByID(id, userID uuid.UUID) (*models.LeadList, error) {
	return s.listRepo.FindByID(id, userID)
}

// CreateList creates a new lead list.
func (s *LeadService) CreateList(userID uuid.UUID, req models.CreateListRequest) (*models.LeadList, error) {
	list := models.LeadList{
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		LeadCount:   0,
	}
	if err := s.listRepo.Create(&list); err != nil {
		return nil, err
	}
	return &list, nil
}

// UpdateList modifies an existing list.
func (s *LeadService) UpdateList(id, userID uuid.UUID, req models.UpdateListRequest) (*models.LeadList, error) {
	list, err := s.listRepo.FindByID(id, userID)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		list.Name = *req.Name
	}
	if req.Description != nil {
		list.Description = req.Description
	}
	list.UpdatedAt = time.Now()
	if err := s.listRepo.Update(list); err != nil {
		return nil, err
	}
	return list, nil
}

// DeleteList removes a list and all its leads.
func (s *LeadService) DeleteList(id, userID uuid.UUID) error {
	// Delete leads belonging to this list first
	if err := s.leadRepo.DeleteByListID(id, userID); err != nil {
		return err
	}
	return s.listRepo.Delete(id, userID)
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS — Query
// ═══════════════════════════════════════════════════════════════════════════════

// GetLeads returns leads with optional filters.
func (s *LeadService) GetLeads(userID uuid.UUID, filter models.GetLeadsFilter) ([]models.Lead, error) {
	return s.leadRepo.FindAllByUser(userID, filter)
}

// GetLeadByID returns a single lead.
func (s *LeadService) GetLeadByID(id, userID uuid.UUID) (*models.Lead, error) {
	return s.leadRepo.FindByIDAndUser(id, userID)
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS — CSV Import
// ═══════════════════════════════════════════════════════════════════════════════

// ImportLeadsFromCSV bulk-inserts leads into a list and updates the lead count.
func (s *LeadService) ImportLeadsFromCSV(userID uuid.UUID, req models.ImportLeadsRequest) ([]models.Lead, error) {
	listID, err := uuid.Parse(req.ListID)
	if err != nil {
		return nil, errors.New("invalid list_id")
	}

	now := time.Now()
	leads := make([]models.Lead, 0, len(req.Leads))

	for _, row := range req.Leads {
		fullName := row.FullName
		if fullName == nil || *fullName == "" {
			composed := buildFullName(row.FirstName, row.LastName)
			if composed != "" {
				fullName = &composed
			}
		}

		lead := models.Lead{
			UserID:        userID,
			ListID:        &listID,
			LinkedInURL:   row.LinkedInURL,
			FirstName:     row.FirstName,
			LastName:      row.LastName,
			FullName:      fullName,
			Headline:      row.Headline,
			Company:       row.Company,
			CompanyURL:    row.CompanyURL,
			Position:      row.Position,
			Location:      row.Location,
			Email:         row.Email,
			EnrichedEmail: row.EnrichedEmail,
			CustomAddress: row.CustomAddress,
			Phone:         row.Phone,
			Notes:         row.Notes,
			Tags:          row.Tags,
			Status:        models.LeadStatusNew,
			ImportedAt:    &now,
		}
		leads = append(leads, lead)
	}

	if err := s.leadRepo.BulkCreate(leads); err != nil {
		return nil, err
	}

	log.Printf("✅ Imported %d leads into list %s", len(leads), listID)

	// Refresh lead count on the list
	if err := s.listRepo.UpdateLeadCount(listID); err != nil {
		log.Printf("⚠️ Failed to update lead count for list %s: %v", listID, err)
	}

	return leads, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS — Mutation
// ═══════════════════════════════════════════════════════════════════════════════

// UpdateLead modifies fields on a single lead.
func (s *LeadService) UpdateLead(id, userID uuid.UUID, req models.UpdateLeadRequest) (*models.Lead, error) {
	lead, err := s.leadRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return nil, err
	}

	if req.FirstName != nil {
		lead.FirstName = req.FirstName
	}
	if req.LastName != nil {
		lead.LastName = req.LastName
	}
	if req.FullName != nil {
		lead.FullName = req.FullName
	}
	if req.Headline != nil {
		lead.Headline = req.Headline
	}
	if req.Company != nil {
		lead.Company = req.Company
	}
	if req.CompanyURL != nil {
		lead.CompanyURL = req.CompanyURL
	}
	if req.Position != nil {
		lead.Position = req.Position
	}
	if req.Location != nil {
		lead.Location = req.Location
	}
	if req.Email != nil {
		lead.Email = req.Email
	}
	if req.EnrichedEmail != nil {
		lead.EnrichedEmail = req.EnrichedEmail
	}
	if req.CustomAddress != nil {
		lead.CustomAddress = req.CustomAddress
	}
	if req.Phone != nil {
		lead.Phone = req.Phone
	}
	if req.Notes != nil {
		lead.Notes = req.Notes
	}
	if req.Tags != nil {
		lead.Tags = req.Tags
	}
	if req.Status != nil {
		lead.Status = *req.Status
	}
	if req.LinkedInURL != nil {
		lead.LinkedInURL = req.LinkedInURL
	}
	if req.ProfilePicture != nil {
		lead.ProfilePicture = req.ProfilePicture
	}
	if req.CustomFieldValues != nil {
		var cfv map[string]interface{}
		if err := json.Unmarshal(*req.CustomFieldValues, &cfv); err == nil {
			lead.CustomFieldValues = models.JSONB(cfv)
		}
	}

	lead.UpdatedAt = time.Now()

	if err := s.leadRepo.Update(lead); err != nil {
		return nil, err
	}
	return lead, nil
}

// DeleteLead removes a single lead and refreshes the list count.
func (s *LeadService) DeleteLead(id, userID uuid.UUID) error {
	// Capture list ID for count refresh
	lead, err := s.leadRepo.FindByIDAndUser(id, userID)
	if err != nil {
		return err
	}

	if err := s.leadRepo.Delete(id, userID); err != nil {
		return err
	}

	if lead.ListID != nil {
		_ = s.listRepo.UpdateLeadCount(*lead.ListID)
	}
	return nil
}

// BulkUpdateStatus changes the status of multiple leads.
func (s *LeadService) BulkUpdateStatus(userID uuid.UUID, req models.BulkStatusRequest) error {
	ids, err := parseUUIDs(req.LeadIDs)
	if err != nil {
		return err
	}
	return s.leadRepo.BulkUpdateStatus(ids, userID, req.Status)
}

// BulkDeleteLeads removes multiple leads and refreshes affected list counts.
func (s *LeadService) BulkDeleteLeads(userID uuid.UUID, req models.BulkDeleteRequest) error {
	ids, err := parseUUIDs(req.LeadIDs)
	if err != nil {
		return err
	}

	// Capture affected list IDs before deletion for count refresh
	listIDs, _ := s.leadRepo.AffectedListIDs(ids)

	if err := s.leadRepo.BulkDelete(ids, userID); err != nil {
		return err
	}

	// Refresh counts for each affected list
	for _, lid := range listIDs {
		_ = s.listRepo.UpdateLeadCount(lid)
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS — Add from LinkedIn Connection
// ═══════════════════════════════════════════════════════════════════════════════

// AddFromConnection adds a lead from a LinkedIn connection.
// It gets or creates a "My Network" list, checks for duplicates, and inserts.
func (s *LeadService) AddFromConnection(userID uuid.UUID, req models.AddFromConnectionRequest) (*models.Lead, error) {
	if req.FullName == "" {
		return nil, errors.New("name is required")
	}

	// Resolve target list
	var targetListID uuid.UUID
	if req.ListID != nil && *req.ListID != "" {
		parsed, err := uuid.Parse(*req.ListID)
		if err != nil {
			return nil, errors.New("invalid list_id")
		}
		targetListID = parsed
	} else {
		// Get or create the "My Network" list
		list, err := s.listRepo.FindByName(userID, "My Network")
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
			// Create default list
			desc := "Leads from LinkedIn connections"
			newList := models.LeadList{
				UserID:      userID,
				Name:        "My Network",
				Description: &desc,
			}
			if err := s.listRepo.Create(&newList); err != nil {
				return nil, errors.New("failed to create lead list")
			}
			targetListID = newList.ID
		} else {
			targetListID = list.ID
		}
	}

	// Dedup: check LinkedIn URL
	if req.LinkedInURL != nil && *req.LinkedInURL != "" {
		existing, err := s.leadRepo.FindByLinkedInURLInList(userID, targetListID, *req.LinkedInURL)
		if err == nil && existing != nil {
			return nil, &DuplicateLeadError{Name: req.FullName}
		}
	}

	// Dedup: check full name
	existing, err := s.leadRepo.FindByFullNameInList(userID, targetListID, req.FullName)
	if err == nil && existing != nil {
		return nil, &DuplicateLeadError{Name: req.FullName}
	}

	// Parse first/last name
	nameParts := strings.SplitN(strings.TrimSpace(req.FullName), " ", 2)
	firstName := nameParts[0]
	var lastName string
	if len(nameParts) > 1 {
		lastName = nameParts[1]
	}

	lead := models.Lead{
		UserID:         userID,
		ListID:         &targetListID,
		FirstName:      &firstName,
		LastName:       strPtrOrNil(lastName),
		FullName:       &req.FullName,
		Position:       req.Position,
		Company:        req.Company,
		LinkedInURL:    req.LinkedInURL,
		ProfilePicture: req.ProfilePicture,
		Headline:       req.Position, // use position as headline
		Status:         models.LeadStatusNew,
	}

	if err := s.leadRepo.Create(&lead); err != nil {
		return nil, err
	}

	_ = s.listRepo.UpdateLeadCount(targetListID)

	return &lead, nil
}

// DuplicateLeadError is returned when a lead already exists in the list.
type DuplicateLeadError struct {
	Name string
}

func (e *DuplicateLeadError) Error() string {
	return e.Name + " is already in this list"
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM FIELDS
// ═══════════════════════════════════════════════════════════════════════════════

// GetCustomFields returns all custom fields for a user.
func (s *LeadService) GetCustomFields(userID uuid.UUID) ([]models.CustomField, error) {
	return s.customFieldRepo.FindAllByUser(userID)
}

// CreateCustomField creates a new custom field definition.
func (s *LeadService) CreateCustomField(userID uuid.UUID, req models.CreateCustomFieldRequest) (*models.CustomField, error) {
	isRequired := false
	if req.IsRequired != nil {
		isRequired = *req.IsRequired
	}

	field := models.CustomField{
		UserID:     userID,
		Name:       req.Name,
		FieldType:  req.FieldType,
		IsRequired: isRequired,
	}
	if req.Options != nil {
		field.Options = models.JSONB{}
		// Unmarshal raw JSON into the JSONB map
		if len(req.Options) > 0 {
			var opts map[string]interface{}
			// best-effort; if options are invalid JSON we store empty
			if jsonErr := json.Unmarshal(req.Options, &opts); jsonErr == nil {
				field.Options = models.JSONB(opts)
			}
		}
	}

	if err := s.customFieldRepo.Create(&field); err != nil {
		return nil, err
	}
	return &field, nil
}

// UpdateCustomField modifies a custom field definition.
func (s *LeadService) UpdateCustomField(id, userID uuid.UUID, req models.UpdateCustomFieldRequest) (*models.CustomField, error) {
	field, err := s.customFieldRepo.FindByID(id, userID)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		field.Name = *req.Name
	}
	if req.FieldType != nil {
		field.FieldType = *req.FieldType
	}
	if req.IsRequired != nil {
		field.IsRequired = *req.IsRequired
	}
	if req.Options != nil && len(req.Options) > 0 {
		var opts map[string]interface{}
		if jsonErr := json.Unmarshal(req.Options, &opts); jsonErr == nil {
			field.Options = models.JSONB(opts)
		}
	}

	field.UpdatedAt = time.Now()

	if err := s.customFieldRepo.Update(field); err != nil {
		return nil, err
	}
	return field, nil
}

// DeleteCustomField removes a custom field definition.
func (s *LeadService) DeleteCustomField(id, userID uuid.UUID) error {
	return s.customFieldRepo.Delete(id, userID)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

func buildFullName(first, last *string) string {
	var parts []string
	if first != nil && *first != "" {
		parts = append(parts, *first)
	}
	if last != nil && *last != "" {
		parts = append(parts, *last)
	}
	return strings.Join(parts, " ")
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func parseUUIDs(ids []string) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, 0, len(ids))
	for _, s := range ids {
		id, err := uuid.Parse(s)
		if err != nil {
			return nil, errors.New("invalid lead ID: " + s)
		}
		out = append(out, id)
	}
	return out, nil
}

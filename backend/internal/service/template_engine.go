package service

import (
	"fmt"
	"math/rand"
	"regexp"
	"strings"
)

// ── Character Limits (LinkedIn enforced) ────────────────────────────────────

var characterLimits = map[string]int{
	"connection_note": 300,
	"message":         8000,
	"inmail":          1900,
}

// CharacterLimitResult holds the result of a character limit check.
type CharacterLimitResult struct {
	Valid    bool     `json:"valid"`
	Length   int      `json:"length"`
	Limit    int      `json:"limit"`
	Overflow int      `json:"overflow"`
	Warnings []string `json:"warnings,omitempty"`
}

// CheckCharacterLimit validates message length against LinkedIn limits.
func CheckCharacterLimit(message, messageType string) CharacterLimitResult {
	limit, ok := characterLimits[messageType]
	if !ok {
		limit = 8000 // default to message limit
	}

	length := len(message)
	overflow := 0
	var warnings []string
	if length > limit {
		overflow = length - limit
		warnings = append(warnings, fmt.Sprintf("Message exceeds %s limit by %d characters", messageType, overflow))
	} else if float64(length) > float64(limit)*0.9 {
		warnings = append(warnings, fmt.Sprintf("Message is within 10%% of %s character limit (%d/%d)", messageType, length, limit))
	}

	return CharacterLimitResult{
		Valid:    length <= limit,
		Length:   length,
		Limit:    limit,
		Overflow: overflow,
		Warnings: warnings,
	}
}

// ── Template Variable Replacement ───────────────────────────────────────────

// TemplateVariables holds lead data for variable replacement.
type TemplateVariables struct {
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	FullName     string `json:"full_name"`
	Company      string `json:"company"`
	Position     string `json:"position"`
	Location     string `json:"location"`
	Headline     string `json:"headline"`
	Email        string `json:"email"`
	LinkedInURL  string `json:"linkedin_url"`
	AIIcebreaker string `json:"ai_icebreaker"`
}

// variableMap returns the lookup map for template variables.
func (v *TemplateVariables) variableMap() map[string]string {
	return map[string]string{
		"firstName":    v.FirstName,
		"lastName":     v.LastName,
		"fullName":     v.FullName,
		"name":         v.FirstName, // alias
		"company":      v.Company,
		"position":     v.Position,
		"jobTitle":     v.Position, // alias
		"location":     v.Location,
		"headline":     v.Headline,
		"email":        v.Email,
		"linkedinUrl":  v.LinkedInURL,
		"aiIcebreaker": v.AIIcebreaker,
	}
}

var templateVarRegex = regexp.MustCompile(`\{\{(\w+)\}\}`)

// ReplaceVariables substitutes {{variable}} placeholders with lead data.
func ReplaceVariables(template string, vars *TemplateVariables) string {
	if vars == nil {
		return template
	}

	varMap := vars.variableMap()

	return templateVarRegex.ReplaceAllStringFunc(template, func(match string) string {
		// Extract the variable name from {{varName}}
		key := match[2 : len(match)-2]
		if val, ok := varMap[key]; ok && val != "" {
			return val
		}
		return "" // strip unresolved variables (matches TS behavior)
	})
}

// ── Spintax Processing ──────────────────────────────────────────────────────

var spintaxRegex = regexp.MustCompile(`\{([^{}]+)\}`)

// ProcessSpintax resolves {option1|option2|option3} syntax by picking a random option.
func ProcessSpintax(text string) string {
	return spintaxRegex.ReplaceAllStringFunc(text, func(match string) string {
		// Remove outer braces
		inner := match[1 : len(match)-1]
		options := strings.Split(inner, "|")
		if len(options) == 0 {
			return match
		}
		// Trim whitespace from each option
		for i := range options {
			options[i] = strings.TrimSpace(options[i])
		}
		return options[rand.Intn(len(options))]
	})
}

// ── Combined Processing ─────────────────────────────────────────────────────

// ProcessTemplate applies variable replacement and spintax processing.
func ProcessTemplate(template string, vars *TemplateVariables) string {
	result := ReplaceVariables(template, vars)
	result = ProcessSpintax(result)
	return result
}

// PreviewTemplate processes a template for preview (same as ProcessTemplate).
func PreviewTemplate(template string, vars *TemplateVariables) string {
	return ProcessTemplate(template, vars)
}

// ── Validation ──────────────────────────────────────────────────────────────

// TemplateValidationResult holds validation output.
type TemplateValidationResult struct {
	Valid        bool     `json:"valid"`
	Variables    []string `json:"variables"`
	HasSpintax   bool     `json:"has_spintax"`
	Errors       []string `json:"errors"`
	Warnings     []string `json:"warnings"`
	MissingVars  []string `json:"missing_vars,omitempty"`
}

// ValidateTemplate checks a template for syntax issues.
func ValidateTemplate(template string) TemplateValidationResult {
	result := TemplateValidationResult{
		Valid:    true,
		Errors:   []string{},
		Warnings: []string{},
	}

	// Empty template check
	if strings.TrimSpace(template) == "" {
		result.Errors = append(result.Errors, "Template is empty")
		result.Valid = false
		return result
	}

	// Extract variables
	matches := templateVarRegex.FindAllStringSubmatch(template, -1)
	seen := make(map[string]bool)
	for _, m := range matches {
		if !seen[m[1]] {
			result.Variables = append(result.Variables, m[1])
			seen[m[1]] = true
		}
	}

	// Check for spintax
	result.HasSpintax = spintaxRegex.MatchString(template)

	// Validate known variables
	knownVars := map[string]bool{
		"firstName": true, "lastName": true, "fullName": true, "name": true,
		"company": true, "position": true, "jobTitle": true, "location": true,
		"headline": true, "email": true, "linkedinUrl": true, "aiIcebreaker": true,
	}

	for _, v := range result.Variables {
		if !knownVars[v] {
			result.Errors = append(result.Errors, "Unknown variable: {{"+v+"}}")
			result.Valid = false
		}
	}

	// Check for unmatched template braces
	openCount := strings.Count(template, "{{")
	closeCount := strings.Count(template, "}}")
	if openCount != closeCount {
		result.Errors = append(result.Errors, "Unmatched template braces")
		result.Valid = false
	}

	// Check for unclosed spintax braces (single { } not inside {{ }})
	// Strip out {{ }} first, then count remaining { and }
	stripped := templateVarRegex.ReplaceAllString(template, "")
	spintaxOpen := strings.Count(stripped, "{")
	spintaxClose := strings.Count(stripped, "}")
	if spintaxOpen != spintaxClose {
		result.Errors = append(result.Errors, "Unclosed spintax braces")
		result.Valid = false
	}

	// Check for nested braces (e.g. {outer {inner} text})
	depth := 0
	for _, ch := range stripped {
		if ch == '{' {
			depth++
			if depth > 1 {
				result.Errors = append(result.Errors, "Nested braces are not supported")
				result.Valid = false
				break
			}
		} else if ch == '}' {
			depth--
		}
	}

	return result
}

// GetAvailableVariables returns the list of supported template variables.
func GetAvailableVariables() []map[string]string {
	return []map[string]string{
		{"name": "firstName", "description": "Lead's first name"},
		{"name": "lastName", "description": "Lead's last name"},
		{"name": "fullName", "description": "Lead's full name"},
		{"name": "company", "description": "Lead's company"},
		{"name": "position", "description": "Lead's job title"},
		{"name": "location", "description": "Lead's location"},
		{"name": "headline", "description": "Lead's LinkedIn headline"},
		{"name": "email", "description": "Lead's email address"},
		{"name": "linkedinUrl", "description": "Lead's LinkedIn profile URL"},
		{"name": "aiIcebreaker", "description": "AI-generated icebreaker sentence"},
	}
}

// ── Additional Helpers ──────────────────────────────────────────────────────

// ExtractVariables returns the unique variable names used in a template.
func ExtractVariables(template string) []string {
	matches := templateVarRegex.FindAllStringSubmatch(template, -1)
	seen := make(map[string]bool)
	var vars []string
	for _, m := range matches {
		if len(m) >= 2 && !seen[m[1]] {
			vars = append(vars, m[1])
			seen[m[1]] = true
		}
	}
	return vars
}

// MissingDataResult holds the result of checking required template data.
type MissingDataResult struct {
	HasAllData  bool     `json:"has_all_data"`
	MissingVars []string `json:"missing_vars,omitempty"`
}

// HasRequiredData checks if a lead has all variable data needed for a template.
// Returns both a bool and the list of missing variable names.
func HasRequiredData(template string, vars *TemplateVariables) MissingDataResult {
	if vars == nil {
		needed := ExtractVariables(template)
		return MissingDataResult{HasAllData: false, MissingVars: needed}
	}
	needed := ExtractVariables(template)
	varMap := vars.variableMap()
	var missing []string
	for _, v := range needed {
		if val, ok := varMap[v]; !ok || val == "" {
			missing = append(missing, v)
		}
	}
	return MissingDataResult{
		HasAllData:  len(missing) == 0,
		MissingVars: missing,
	}
}

package service

import (
	"strings"
	"testing"
)

// ── CheckCharacterLimit ──────────────────────────────────────────────────────

func TestCheckCharacterLimit_WithinLimit(t *testing.T) {
	r := CheckCharacterLimit("Hello, world!", "message")
	if !r.Valid {
		t.Error("expected Valid=true for short message")
	}
	if r.Overflow != 0 {
		t.Errorf("expected Overflow=0, got %d", r.Overflow)
	}
	if r.Length != 13 {
		t.Errorf("expected Length=13, got %d", r.Length)
	}
}

func TestCheckCharacterLimit_ExceedsLimit(t *testing.T) {
	long := strings.Repeat("X", 310) // 310 > 300 (connection_note limit)
	r := CheckCharacterLimit(long, "connection_note")
	if r.Valid {
		t.Error("expected Valid=false for 310-char connection_note")
	}
	if r.Overflow != 10 {
		t.Errorf("expected Overflow=10, got %d", r.Overflow)
	}
	if len(r.Warnings) == 0 {
		t.Error("expected at least one warning")
	}
}

func TestCheckCharacterLimit_NearLimit90Percent(t *testing.T) {
	// 8000 * 0.9 = 7200; use 7300 chars
	near := strings.Repeat("X", 7300)
	r := CheckCharacterLimit(near, "message")
	if !r.Valid {
		t.Error("expected Valid=true — still under limit")
	}
	if len(r.Warnings) == 0 {
		t.Error("expected a warning when within 10%% of limit")
	}
}

func TestCheckCharacterLimit_UnknownType(t *testing.T) {
	// Unknown type falls back to 8000
	r := CheckCharacterLimit("test", "unknown_type")
	if !r.Valid {
		t.Error("expected Valid=true for short message with unknown type")
	}
	if r.Limit != 8000 {
		t.Errorf("expected default limit 8000, got %d", r.Limit)
	}
}

func TestCheckCharacterLimit_InMail(t *testing.T) {
	r := CheckCharacterLimit(strings.Repeat("X", 2000), "inmail")
	if r.Valid {
		t.Error("expected Valid=false — 2000 > 1900 inmail limit")
	}
	if r.Limit != 1900 {
		t.Errorf("expected limit 1900, got %d", r.Limit)
	}
}

// ── ReplaceVariables ────────────────────────────────────────────────────────

func TestReplaceVariables_AllFields(t *testing.T) {
	tmpl := "Hi {{firstName}} {{lastName}} from {{company}}, your title is {{position}}."
	vars := &TemplateVariables{
		FirstName: "Jane",
		LastName:  "Doe",
		Company:   "Acme",
		Position:  "Engineer",
	}
	result := ReplaceVariables(tmpl, vars)
	expected := "Hi Jane Doe from Acme, your title is Engineer."
	if result != expected {
		t.Errorf("got %q, want %q", result, expected)
	}
}

func TestReplaceVariables_NilVars(t *testing.T) {
	tmpl := "Hello {{firstName}}"
	result := ReplaceVariables(tmpl, nil)
	if result != tmpl {
		t.Errorf("nil vars should return template unchanged, got %q", result)
	}
}

func TestReplaceVariables_UnknownVar_StrippedToEmpty(t *testing.T) {
	tmpl := "Hello {{unknownVar}} world"
	vars := &TemplateVariables{FirstName: "Jane"}
	result := ReplaceVariables(tmpl, vars)
	// Unknown vars are stripped (empty string replacement)
	if strings.Contains(result, "{{unknownVar}}") {
		t.Error("unknown variable should be stripped, not left in template")
	}
}

func TestReplaceVariables_EmptyTemplate(t *testing.T) {
	result := ReplaceVariables("", &TemplateVariables{FirstName: "Jane"})
	if result != "" {
		t.Errorf("empty template should return empty, got %q", result)
	}
}

func TestReplaceVariables_NameAlias(t *testing.T) {
	tmpl := "Hi {{name}}!"
	vars := &TemplateVariables{FirstName: "Alice"}
	result := ReplaceVariables(tmpl, vars)
	if result != "Hi Alice!" {
		t.Errorf("{{name}} alias should map to FirstName, got %q", result)
	}
}

func TestReplaceVariables_JobTitleAlias(t *testing.T) {
	tmpl := "Your role: {{jobTitle}}"
	vars := &TemplateVariables{Position: "CTO"}
	result := ReplaceVariables(tmpl, vars)
	if result != "Your role: CTO" {
		t.Errorf("{{jobTitle}} alias should map to Position, got %q", result)
	}
}

// ── ProcessSpintax ──────────────────────────────────────────────────────────

func TestProcessSpintax_PicksOneOption(t *testing.T) {
	text := "{Hi|Hello|Hey} there"
	for i := 0; i < 20; i++ {
		result := ProcessSpintax(text)
		if result != "Hi there" && result != "Hello there" && result != "Hey there" {
			t.Errorf("unexpected spintax result: %q", result)
		}
	}
}

func TestProcessSpintax_NoSpintax(t *testing.T) {
	text := "Hello world"
	result := ProcessSpintax(text)
	if result != text {
		t.Errorf("text without spintax should be unchanged, got %q", result)
	}
}

func TestProcessSpintax_MultipleGroups(t *testing.T) {
	text := "{Hi|Hello} {there|friend}"
	result := ProcessSpintax(text)
	// Result must be one of 4 combinations
	valid := []string{"Hi there", "Hi friend", "Hello there", "Hello friend"}
	found := false
	for _, v := range valid {
		if result == v {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("unexpected multi-group spintax result: %q", result)
	}
}

func TestProcessSpintax_SingleOption(t *testing.T) {
	result := ProcessSpintax("{only}")
	if result != "only" {
		t.Errorf("single option spintax should return that option, got %q", result)
	}
}

// ── ProcessTemplate (combined) ──────────────────────────────────────────────

func TestProcessTemplate_VarsAndSpintax(t *testing.T) {
	tmpl := "{Hi|Hello} {{firstName}}, I saw you work at {{company}}."
	vars := &TemplateVariables{FirstName: "Bob", Company: "Stripe"}
	result := ProcessTemplate(tmpl, vars)
	if !strings.Contains(result, "Bob") || !strings.Contains(result, "Stripe") {
		t.Errorf("ProcessTemplate should replace variables: got %q", result)
	}
	if strings.Contains(result, "{{") {
		t.Errorf("ProcessTemplate should not leave unresolved vars: got %q", result)
	}
}

// ── ValidateTemplate ────────────────────────────────────────────────────────

func TestValidateTemplate_EmptyTemplate(t *testing.T) {
	r := ValidateTemplate("")
	if r.Valid {
		t.Error("empty template should be invalid")
	}
	if len(r.Errors) == 0 {
		t.Error("expected errors for empty template")
	}
}

func TestValidateTemplate_ValidTemplate(t *testing.T) {
	r := ValidateTemplate("Hi {{firstName}}, I saw you work at {{company}}.")
	if !r.Valid {
		t.Errorf("expected valid template, errors: %v", r.Errors)
	}
	if len(r.Variables) != 2 {
		t.Errorf("expected 2 variables, got %d", len(r.Variables))
	}
}

func TestValidateTemplate_UnknownVariable(t *testing.T) {
	r := ValidateTemplate("Hello {{unknownVar}}")
	if r.Valid {
		t.Error("template with unknown variable should be invalid")
	}
	found := false
	for _, e := range r.Errors {
		if strings.Contains(e, "unknownVar") {
			found = true
		}
	}
	if !found {
		t.Errorf("expected error mentioning unknownVar, got: %v", r.Errors)
	}
}

func TestValidateTemplate_UnmatchedBraces(t *testing.T) {
	r := ValidateTemplate("Hello {{firstName}}")
	if !r.Valid {
		t.Errorf("matched braces should be valid, errors: %v", r.Errors)
	}
	r2 := ValidateTemplate("Hello {{firstName}")
	if r2.Valid {
		t.Error("unmatched braces should be invalid")
	}
}

func TestValidateTemplate_SpintaxDetected(t *testing.T) {
	r := ValidateTemplate("{Hi|Hello} {{firstName}}")
	if !r.Valid {
		t.Errorf("valid template with spintax got errors: %v", r.Errors)
	}
	if !r.HasSpintax {
		t.Error("expected HasSpintax=true")
	}
}

// ── ExtractVariables ────────────────────────────────────────────────────────

func TestExtractVariables_Unique(t *testing.T) {
	vars := ExtractVariables("{{firstName}} {{firstName}} {{company}}")
	if len(vars) != 2 {
		t.Errorf("expected 2 unique vars, got %d: %v", len(vars), vars)
	}
}

func TestExtractVariables_None(t *testing.T) {
	vars := ExtractVariables("No variables here")
	if len(vars) != 0 {
		t.Errorf("expected 0 vars, got %d", len(vars))
	}
}

// ── HasRequiredData ─────────────────────────────────────────────────────────

func TestHasRequiredData_AllPresent(t *testing.T) {
	tmpl := "Hi {{firstName}} from {{company}}"
	vars := &TemplateVariables{FirstName: "Jane", Company: "Acme"}
	r := HasRequiredData(tmpl, vars)
	if !r.HasAllData {
		t.Errorf("expected HasAllData=true, missing: %v", r.MissingVars)
	}
}

func TestHasRequiredData_Missing(t *testing.T) {
	tmpl := "Hi {{firstName}} from {{company}}"
	vars := &TemplateVariables{FirstName: "Jane"} // Company missing
	r := HasRequiredData(tmpl, vars)
	if r.HasAllData {
		t.Error("expected HasAllData=false when company is empty")
	}
	if len(r.MissingVars) != 1 || r.MissingVars[0] != "company" {
		t.Errorf("expected MissingVars=[company], got %v", r.MissingVars)
	}
}

func TestHasRequiredData_NilVars(t *testing.T) {
	tmpl := "Hi {{firstName}}"
	r := HasRequiredData(tmpl, nil)
	if r.HasAllData {
		t.Error("expected HasAllData=false for nil vars")
	}
}

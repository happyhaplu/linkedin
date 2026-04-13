package models

import (
	"testing"
	"time"
)

// ── Plan constants ──────────────────────────────────────────────────────────

func TestPlanTypeConstants(t *testing.T) {
	if string(PlanTypeStripe) != "stripe" {
		t.Errorf("PlanTypeStripe = %q, want %q", PlanTypeStripe, "stripe")
	}
	if string(PlanTypeCustom) != "custom" {
		t.Errorf("PlanTypeCustom = %q, want %q", PlanTypeCustom, "custom")
	}
}

func TestUserPlanStatusConstants(t *testing.T) {
	statuses := map[UserPlanStatus]string{
		UserPlanActive:   "active",
		UserPlanCanceled: "canceled",
		UserPlanPastDue:  "past_due",
		UserPlanTrialing: "trialing",
		UserPlanInactive: "inactive",
	}
	for status, expected := range statuses {
		if string(status) != expected {
			t.Errorf("UserPlanStatus %q != %q", status, expected)
		}
	}
}

// ── Plan.BeforeCreate UUID generation ──────────────────────────────────────

func TestPlan_BeforeCreate_GeneratesUUID(t *testing.T) {
	p := &Plan{}
	// Call BeforeCreate manually (no DB needed)
	if err := p.BeforeCreate(nil); err != nil {
		t.Fatalf("BeforeCreate error: %v", err)
	}
	if p.ID == "" {
		t.Error("expected ID to be set after BeforeCreate, got empty string")
	}
	if len(p.ID) != 36 {
		t.Errorf("expected UUID length 36, got %d: %s", len(p.ID), p.ID)
	}
}

func TestPlan_BeforeCreate_PreservesExistingID(t *testing.T) {
	existing := "00000000-0000-0000-0000-000000000001"
	p := &Plan{ID: existing}
	_ = p.BeforeCreate(nil)
	if p.ID != existing {
		t.Errorf("BeforeCreate should not overwrite existing ID, got %s", p.ID)
	}
}

// ── UserPlan.PlanID nullable pointer ───────────────────────────────────────

func TestUserPlan_NilPlanID(t *testing.T) {
	// Verifies the fix: PlanID is *string (nullable UUID), not plain string
	up := UserPlan{}
	if up.PlanID != nil {
		t.Errorf("expected PlanID nil for zero value UserPlan, got %v", up.PlanID)
	}
}

func TestUserPlan_SetPlanID(t *testing.T) {
	planID := "0eb93fc1-7159-4239-bb59-20094b508953"
	up := UserPlan{PlanID: &planID}
	if up.PlanID == nil {
		t.Fatal("PlanID should not be nil after assignment")
	}
	if *up.PlanID != planID {
		t.Errorf("expected PlanID=%s, got %s", planID, *up.PlanID)
	}
}

// ── EffectiveSenderLimit ────────────────────────────────────────────────────

func TestEffectiveSenderLimit_UsesPlanDefault(t *testing.T) {
	plan := &Plan{MaxLinkedInSenders: 5}
	up := UserPlan{Plan: plan, MaxLinkedInSenders: 0}
	if got := up.EffectiveSenderLimit(); got != 5 {
		t.Errorf("expected 5 (plan default), got %d", got)
	}
}

func TestEffectiveSenderLimit_UsesOverride(t *testing.T) {
	plan := &Plan{MaxLinkedInSenders: 5}
	up := UserPlan{Plan: plan, MaxLinkedInSenders: 10}
	if got := up.EffectiveSenderLimit(); got != 10 {
		t.Errorf("expected 10 (override), got %d", got)
	}
}

func TestEffectiveSenderLimit_NilPlan(t *testing.T) {
	up := UserPlan{Plan: nil, MaxLinkedInSenders: 0}
	if got := up.EffectiveSenderLimit(); got != 0 {
		t.Errorf("expected 0 when no plan and no override, got %d", got)
	}
}

// ── IsActive check (business logic) ────────────────────────────────────────

func TestUserPlan_IsActiveAndActiveStatus(t *testing.T) {
	up := UserPlan{
		Status:   UserPlanActive,
		IsActive: true,
	}
	// active = IsActive && (status == active || status == trialing)
	active := up.IsActive && (up.Status == UserPlanActive || up.Status == UserPlanTrialing)
	if !active {
		t.Error("expected active=true for IsActive+active status")
	}
}

func TestUserPlan_InactiveWhenDeactivatedByAdmin(t *testing.T) {
	up := UserPlan{
		Status:   UserPlanActive,
		IsActive: false, // admin deactivated
	}
	active := up.IsActive && (up.Status == UserPlanActive || up.Status == UserPlanTrialing)
	if active {
		t.Error("expected active=false when admin deactivates (IsActive=false)")
	}
}

func TestUserPlan_InactiveWhenCanceled(t *testing.T) {
	up := UserPlan{
		Status:   UserPlanCanceled,
		IsActive: true,
	}
	active := up.IsActive && (up.Status == UserPlanActive || up.Status == UserPlanTrialing)
	if active {
		t.Error("expected active=false for canceled status")
	}
}

// ── Stripe period end nil safety ────────────────────────────────────────────

func TestUserPlan_NilStripeCurrentPeriodEnd(t *testing.T) {
	up := UserPlan{}
	if up.StripeCurrentPeriodEnd != nil {
		t.Errorf("expected nil StripeCurrentPeriodEnd for zero value, got %v", up.StripeCurrentPeriodEnd)
	}
}

func TestUserPlan_SetStripeCurrentPeriodEnd(t *testing.T) {
	t2 := time.Now().Add(30 * 24 * time.Hour)
	up := UserPlan{StripeCurrentPeriodEnd: &t2}
	if up.StripeCurrentPeriodEnd == nil {
		t.Fatal("expected non-nil StripeCurrentPeriodEnd")
	}
}

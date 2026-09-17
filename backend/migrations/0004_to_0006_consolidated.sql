-- ====================================================================
-- e-Pramaan Database Migration: Consolidated 0004_to_0006_unified.sql
-- Run this in your Supabase SQL Editor
-- ====================================================================

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ====================================================================
-- e-Pramaan Database Migration: 0004_compliance_and_verification.sql
-- Description: Verification runs, requirement evaluations, extracted evidence,
--              discrepancies, and RLS policies
-- ====================================================================

-- 1. Create run_status enum
DO $$ BEGIN
    CREATE TYPE run_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create discrepancy_severity enum
DO $$ BEGIN
    CREATE TYPE discrepancy_severity AS ENUM (
        'INFO',
        'WARNING',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2a. Create compliance_status enum
DO $$ BEGIN
    CREATE TYPE compliance_status AS ENUM (
        'COMPLIANT',
        'NON_COMPLIANT',
        'UNDER_REVIEW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2b. Create verification_status enum (if not already created)
DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM (
        'PENDING_VERIFICATION',
        'IN_PROGRESS',
        'VERIFIED',
        'FAILED',
        'SOURCE_UNAVAILABLE',
        'FLAGGED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create public.verification_runs table
CREATE TABLE IF NOT EXISTS public.verification_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE RESTRICT,
    run_status run_status NOT NULL DEFAULT 'PENDING',
    verification_status verification_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    compliance_score JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
    sources_status JSONB NOT NULL DEFAULT '[]'::jsonb,
    executed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    executed_role TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    is_latest BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_runs_bid_id ON public.verification_runs(bid_id);
CREATE INDEX IF NOT EXISTS idx_verification_runs_tender_id ON public.verification_runs(tender_id);
CREATE INDEX IF NOT EXISTS idx_verification_runs_is_latest ON public.verification_runs(bid_id, is_latest);

-- 4. Create public.extracted_evidence table
CREATE TABLE IF NOT EXISTS public.extracted_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_document_id UUID NOT NULL REFERENCES public.bid_documents(id) ON DELETE CASCADE,
    bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'SYSTEM_EXTRACTOR',
    status verification_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_snippet TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_evidence_bid_doc_id ON public.extracted_evidence(bid_document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_evidence_bid_id ON public.extracted_evidence(bid_id);

-- 5. Create public.requirement_evaluations table
CREATE TABLE IF NOT EXISTS public.requirement_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_run_id UUID NOT NULL REFERENCES public.verification_runs(id) ON DELETE CASCADE,
    tender_requirement_id UUID NOT NULL REFERENCES public.tender_requirements(id) ON DELETE RESTRICT,
    verification_status verification_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    compliance_status compliance_status NOT NULL DEFAULT 'UNDER_REVIEW',
    score_awarded NUMERIC NOT NULL DEFAULT 0,
    max_score NUMERIC NOT NULL DEFAULT 0,
    evidence_found BOOLEAN NOT NULL DEFAULT false,
    document_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_run_requirement UNIQUE (verification_run_id, tender_requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_req_evaluations_run_id ON public.requirement_evaluations(verification_run_id);
CREATE INDEX IF NOT EXISTS idx_req_evaluations_req_id ON public.requirement_evaluations(tender_requirement_id);

-- 6. Create public.discrepancies table
CREATE TABLE IF NOT EXISTS public.discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_run_id UUID NOT NULL REFERENCES public.verification_runs(id) ON DELETE CASCADE,
    bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity discrepancy_severity NOT NULL DEFAULT 'WARNING',
    affected_requirement_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    affected_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    expected_value TEXT,
    actual_value TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discrepancies_run_id ON public.discrepancies(verification_run_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_bid_id ON public.discrepancies(bid_id);

-- ====================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discrepancies ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------
-- verification_runs RLS Policies
-- -------------------------------------------------------------------

-- Read Policy:
-- - Bidders can read verification runs for their own organization's bids
-- - Officers can read verification runs for tenders belonging to their procuring organization
-- - Admins and Auditors can read all runs
DROP POLICY IF EXISTS "verification_runs_read_policy" ON public.verification_runs;
CREATE POLICY "verification_runs_read_policy" ON public.verification_runs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bids b
            JOIN public.organization_members om ON om.organization_id = b.bidder_organization_id
            WHERE b.id = verification_runs.bid_id
            AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = verification_runs.tender_id
            AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('ADMIN', 'AUDITOR')
            AND u.is_active = true
        )
    );

-- Insert/Update Policy:
-- - Only authorized Officers and Admins can create or update verification runs
DROP POLICY IF EXISTS "verification_runs_officer_modify" ON public.verification_runs;
CREATE POLICY "verification_runs_officer_modify" ON public.verification_runs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = verification_runs.tender_id
            AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'ADMIN'
            AND u.is_active = true
        )
    );

-- -------------------------------------------------------------------
-- requirement_evaluations RLS Policies
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "requirement_evaluations_read_policy" ON public.requirement_evaluations;
CREATE POLICY "requirement_evaluations_read_policy" ON public.requirement_evaluations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.verification_runs vr
            WHERE vr.id = requirement_evaluations.verification_run_id
            AND (
                EXISTS (
                    SELECT 1 FROM public.bids b
                    JOIN public.organization_members om ON om.organization_id = b.bidder_organization_id
                    WHERE b.id = vr.bid_id AND om.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.tenders t
                    JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
                    WHERE t.id = vr.tender_id AND om.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'AUDITOR') AND u.is_active = true
                )
            )
        )
    );

-- -------------------------------------------------------------------
-- discrepancies RLS Policies
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "discrepancies_read_policy" ON public.discrepancies;
CREATE POLICY "discrepancies_read_policy" ON public.discrepancies
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bids b
            JOIN public.organization_members om ON om.organization_id = b.bidder_organization_id
            WHERE b.id = discrepancies.bid_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.verification_runs vr
            JOIN public.tenders t ON t.id = vr.tender_id
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE vr.id = discrepancies.verification_run_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'AUDITOR') AND u.is_active = true
        )
    );

-- -------------------------------------------------------------------
-- extracted_evidence RLS Policies
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "extracted_evidence_read_policy" ON public.extracted_evidence;
CREATE POLICY "extracted_evidence_read_policy" ON public.extracted_evidence
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bids b
            JOIN public.organization_members om ON om.organization_id = b.bidder_organization_id
            WHERE b.id = extracted_evidence.bid_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.bids b
            JOIN public.tenders t ON t.id = b.tender_id
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE b.id = extracted_evidence.bid_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'AUDITOR') AND u.is_active = true
        )
    );


-- ====================================================================
-- e-Pramaan Database Migration: 0005_investigations_awards_audit.sql
-- Description: Risk & Investigation, Comparative Awards, Append-only Audit
--              and AI Override Registry with Row Level Security (RLS)
-- ====================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE investigation_status AS ENUM (
        'OPEN',
        'IN_REVIEW',
        'ACTION_REQUIRED',
        'RESOLVED',
        'CLOSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE investigation_priority AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE investigation_type AS ENUM (
        'COMPLIANCE_DISCREPANCY',
        'DOCUMENT_INCONSISTENCY',
        'STATUTORY_VERIFICATION',
        'ENTITY_RISK',
        'BLACKLISTING_DEBARMENT',
        'TENDER_SPECIFIC',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE award_decision_status AS ENUM (
        'DRAFT',
        'UNDER_REVIEW',
        'CLARIFICATION_REQUIRED',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_event_type AS ENUM (
        'VERIFICATION_RUN',
        'DISCREPANCY_DETECTED',
        'INVESTIGATION_CREATED',
        'INVESTIGATION_STATUS_CHANGED',
        'INVESTIGATION_RESOLVED',
        'AWARD_DECISION_CREATED',
        'AWARD_APPROVED',
        'AWARD_REJECTED',
        'AI_RECOMMENDATION_GENERATED',
        'AI_RECOMMENDATION_OVERRIDDEN',
        'GOVERNANCE_OVERRIDE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Investigations Table
CREATE TABLE IF NOT EXISTS public.investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT UNIQUE NOT NULL,
    bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE RESTRICT,
    bidder_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    investigation_type investigation_type NOT NULL,
    priority investigation_priority NOT NULL DEFAULT 'MEDIUM',
    status investigation_status NOT NULL DEFAULT 'OPEN',
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolution_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigations_bid_id ON public.investigations(bid_id);
CREATE INDEX IF NOT EXISTS idx_investigations_tender_id ON public.investigations(tender_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON public.investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_priority ON public.investigations(priority);

-- 3. Investigation Evidence & Timeline Events
CREATE TABLE IF NOT EXISTS public.investigation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    attached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigation_evidence_inv_id ON public.investigation_evidence(investigation_id);

CREATE TABLE IF NOT EXISTS public.investigation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigation_events_inv_id ON public.investigation_events(investigation_id);

-- 4. Award Decisions Table
CREATE TABLE IF NOT EXISTS public.award_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE RESTRICT,
    selected_bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE RESTRICT,
    selected_bidder_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    decision_status award_decision_status NOT NULL DEFAULT 'DRAFT',
    selected_compliance_score NUMERIC NOT NULL DEFAULT 0,
    selected_risk_level risk_level NOT NULL DEFAULT 'LOW',
    decision_reason TEXT NOT NULL,
    clarification_required BOOLEAN NOT NULL DEFAULT false,
    clarification_text TEXT,
    justification_text TEXT,
    evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    decided_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_award_per_tender UNIQUE (tender_id)
);

CREATE INDEX IF NOT EXISTS idx_award_decisions_tender_id ON public.award_decisions(tender_id);
CREATE INDEX IF NOT EXISTS idx_award_decisions_bid_id ON public.award_decisions(selected_bid_id);
CREATE INDEX IF NOT EXISTS idx_award_decisions_status ON public.award_decisions(decision_status);

-- 5. Append-only Audit Events Table
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type audit_event_type NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    tender_id UUID REFERENCES public.tenders(id) ON DELETE SET NULL,
    bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
    actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    actor_role TEXT NOT NULL,
    description TEXT NOT NULL,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tender_id ON public.audit_events(tender_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_bid_id ON public.audit_events(bid_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON public.audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON public.audit_events(timestamp DESC);

-- 6. AI Override Registry Table
CREATE TABLE IF NOT EXISTS public.ai_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE RESTRICT,
    bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE RESTRICT,
    ai_recommendation_text TEXT NOT NULL,
    ai_recommendation_timestamp TIMESTAMPTZ NOT NULL,
    decision_taken TEXT NOT NULL,
    override_reason TEXT NOT NULL,
    supporting_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    officer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_overrides_tender_id ON public.ai_overrides(tender_id);
CREATE INDEX IF NOT EXISTS idx_ai_overrides_bid_id ON public.ai_overrides(bid_id);

-- 7. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_investigations_updated_at ON public.investigations;
CREATE TRIGGER trg_investigations_updated_at
BEFORE UPDATE ON public.investigations
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_award_decisions_updated_at ON public.award_decisions;
CREATE TRIGGER trg_award_decisions_updated_at
BEFORE UPDATE ON public.award_decisions
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ====================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.award_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_overrides ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------
-- investigations RLS: Officer / Auditor / Admin only
-- Sensitive investigation data is NEVER exposed to bidders
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "investigations_officer_read" ON public.investigations;
CREATE POLICY "investigations_officer_read" ON public.investigations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = investigations.tender_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('OFFICER', 'AUDITOR', 'ADMIN') AND u.is_active = true
        )
    );

DROP POLICY IF EXISTS "investigations_officer_modify" ON public.investigations;
CREATE POLICY "investigations_officer_modify" ON public.investigations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = investigations.tender_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('OFFICER', 'ADMIN') AND u.is_active = true
        )
    );

-- -------------------------------------------------------------------
-- investigation_evidence and events RLS: Officer / Auditor / Admin only
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "investigation_evidence_officer_read" ON public.investigation_evidence;
CREATE POLICY "investigation_evidence_officer_read" ON public.investigation_evidence
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.investigations inv
            WHERE inv.id = investigation_evidence.investigation_id
            AND (
                EXISTS (
                    SELECT 1 FROM public.tenders t
                    JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
                    WHERE t.id = inv.tender_id AND om.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.role IN ('OFFICER', 'AUDITOR', 'ADMIN') AND u.is_active = true
                )
            )
        )
    );

DROP POLICY IF EXISTS "investigation_events_officer_read" ON public.investigation_events;
CREATE POLICY "investigation_events_officer_read" ON public.investigation_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.investigations inv
            WHERE inv.id = investigation_events.investigation_id
            AND (
                EXISTS (
                    SELECT 1 FROM public.tenders t
                    JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
                    WHERE t.id = inv.tender_id AND om.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND u.role IN ('OFFICER', 'AUDITOR', 'ADMIN') AND u.is_active = true
                )
            )
        )
    );

-- -------------------------------------------------------------------
-- award_decisions RLS:
-- - Officers, Auditors, and Admins can view award decisions
-- - Bidders can view ONLY if decision_status = 'APPROVED'
-- - Modifying decisions is restricted to authorized Procurement Officers and Admins
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "award_decisions_read" ON public.award_decisions;
CREATE POLICY "award_decisions_read" ON public.award_decisions
    FOR SELECT
    USING (
        decision_status = 'APPROVED'
        OR EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = award_decisions.tender_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('OFFICER', 'AUDITOR', 'ADMIN') AND u.is_active = true
        )
    );

DROP POLICY IF EXISTS "award_decisions_modify" ON public.award_decisions;
CREATE POLICY "award_decisions_modify" ON public.award_decisions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = award_decisions.tender_id AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = true
        )
    );

-- -------------------------------------------------------------------
-- audit_events RLS: Append-only for system actors; visible to Officers / Auditors / Admins
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "audit_events_read" ON public.audit_events;
CREATE POLICY "audit_events_read" ON public.audit_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('OFFICER', 'AUDITOR', 'ADMIN') AND u.is_active = true
        )
    );

-- -------------------------------------------------------------------
-- ai_overrides RLS: Visible to Officers / Auditors / Admins
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "ai_overrides_read" ON public.ai_overrides;
CREATE POLICY "ai_overrides_read" ON public.ai_overrides
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('OFFICER', 'AUDITOR', 'ADMIN') AND u.is_active = true
        )
    );


-- ====================================================================
-- e-Pramaan Database Migration: 0006_notifications_and_ai.sql
-- Description: Persisted Notifications & AI Interactions Auditability with RLS
-- ====================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'BID_SUBMITTED',
        'BID_WITHDRAWN',
        'VERIFICATION_COMPLETED',
        'DISCREPANCY_DETECTED',
        'INVESTIGATION_ASSIGNED',
        'INVESTIGATION_ACTION_REQUIRED',
        'AWARD_DECISION_RECORDED',
        'AWARD_PUBLISHED',
        'SOURCE_UNAVAILABLE',
        'SYSTEM_ALERT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_user_id) WHERE is_read = FALSE;

-- 3. Create AI Interactions Audit Table
CREATE TABLE IF NOT EXISTS public.ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    context_type TEXT NOT NULL, -- 'ASSISTANT', 'TENDER_SUMMARY', 'VERIFICATION_REASONING'
    context_id UUID,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SUCCESS', 'AI_UNAVAILABLE', 'ERROR', 'INSUFFICIENT_EVIDENCE'
    prompt_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user ON public.ai_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_context ON public.ai_interactions(context_type, context_id);

-- 4. Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

-- Notifications RLS: Users can only select/update their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = recipient_user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = recipient_user_id);

-- System / service role can insert notifications
DROP POLICY IF EXISTS "Service insert notifications" ON public.notifications;
CREATE POLICY "Service insert notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- AI Interactions RLS: Users can view their own interactions; Officer/Admin/Auditor can view interactions for compliance audit
DROP POLICY IF EXISTS "Users view own AI interactions" ON public.ai_interactions;
CREATE POLICY "Users view own AI interactions"
    ON public.ai_interactions
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('OFFICER', 'ADMIN', 'AUDITOR')
        )
    );

DROP POLICY IF EXISTS "Insert AI interactions" ON public.ai_interactions;
CREATE POLICY "Insert AI interactions"
    ON public.ai_interactions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

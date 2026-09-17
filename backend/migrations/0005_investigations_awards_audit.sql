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

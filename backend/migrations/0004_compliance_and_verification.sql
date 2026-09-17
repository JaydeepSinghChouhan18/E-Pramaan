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

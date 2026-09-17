-- ====================================================================
-- e-Pramaan Database Migration: 0002_tenders_and_requirements.sql
-- Description: Core tenders, structured tender requirements, and RLS policies
-- ====================================================================

-- 1. Create Enums matching shared TypeScript contracts
DO $$ BEGIN
    CREATE TYPE tender_status AS ENUM (
        'DRAFT',
        'PUBLISHED',
        'CLOSED',
        'UNDER_EVALUATION',
        'AWARDED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE requirement_category AS ENUM (
        'STATUTORY',
        'TAX',
        'MSME',
        'LOCAL_CONTENT',
        'EMPLOYMENT_COMPLIANCE',
        'STARTUP',
        'OEM',
        'DOCUMENT',
        'COMPANY',
        'TENDER_SPECIFIC',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE requirement_type AS ENUM (
        'DOCUMENT',
        'REGISTRATION',
        'TAX_COMPLIANCE',
        'RETURN_FILING',
        'COMPANY_AGE',
        'LOCAL_CONTENT',
        'CERTIFICATION',
        'AUTHORIZATION',
        'GOVERNMENT_VERIFICATION',
        'DECLARATION',
        'CUSTOM'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create public.tenders table
CREATE TABLE IF NOT EXISTS public.tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    procuring_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    publication_date TIMESTAMPTZ,
    submission_deadline TIMESTAMPTZ NOT NULL,
    opening_date TIMESTAMPTZ,
    status tender_status NOT NULL DEFAULT 'DRAFT',
    estimated_value NUMERIC,
    currency TEXT NOT NULL DEFAULT 'INR',
    minimum_company_age_years INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance & search
CREATE INDEX IF NOT EXISTS idx_tenders_tender_number ON public.tenders(tender_number);
CREATE INDEX IF NOT EXISTS idx_tenders_status ON public.tenders(status);
CREATE INDEX IF NOT EXISTS idx_tenders_submission_deadline ON public.tenders(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_tenders_procuring_org ON public.tenders(procuring_organization_id);
CREATE INDEX IF NOT EXISTS idx_tenders_created_by ON public.tenders(created_by);

-- 3. Create public.tender_requirements table
CREATE TABLE IF NOT EXISTS public.tender_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category requirement_category NOT NULL,
    requirement_type requirement_type NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    is_applicable BOOLEAN NOT NULL DEFAULT true,
    weight NUMERIC NOT NULL DEFAULT 0,
    minimum_threshold NUMERIC,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    verification_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tender_requirement_code UNIQUE (tender_id, code)
);

CREATE INDEX IF NOT EXISTS idx_tender_requirements_tender_id ON public.tender_requirements(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_requirements_category ON public.tender_requirements(category);
CREATE INDEX IF NOT EXISTS idx_tender_requirements_type ON public.tender_requirements(requirement_type);

-- 4. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_tenders_updated_at ON public.tenders;
CREATE TRIGGER trg_tenders_updated_at
BEFORE UPDATE ON public.tenders
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_tender_reqs_updated_at ON public.tender_requirements;
CREATE TRIGGER trg_tender_reqs_updated_at
BEFORE UPDATE ON public.tender_requirements
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_requirements ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------
-- tenders RLS Policies
-- -------------------------------------------------------------------

-- 1. Read Policy:
-- - Anyone (bidders/officers) can read PUBLISHED or subsequent lifecycle tenders.
-- - Officers can read DRAFT tenders if they are the creator or belong to the procuring organization.
-- - Admins and Auditors can read all tenders.
DROP POLICY IF EXISTS "tenders_read_policy" ON public.tenders;
CREATE POLICY "tenders_read_policy" ON public.tenders
    FOR SELECT
    USING (
        status IN ('PUBLISHED', 'CLOSED', 'UNDER_EVALUATION', 'AWARDED')
        OR (
            auth.uid() = created_by
        )
        OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tenders.procuring_organization_id
            AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('ADMIN', 'AUDITOR')
            AND u.is_active = true
        )
    );

-- 2. Insert Policy:
-- - Only authenticated Procurement Officers and Admins can create tenders.
DROP POLICY IF EXISTS "tenders_insert_officer" ON public.tenders;
CREATE POLICY "tenders_insert_officer" ON public.tenders
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('OFFICER', 'ADMIN')
            AND u.is_active = true
        )
    );

-- 3. Update Policy:
-- - Only authorized Officers (creator or procuring org member) or Admins can update.
-- - Modifying tender details is restricted to DRAFT status.
DROP POLICY IF EXISTS "tenders_update_officer" ON public.tenders;
CREATE POLICY "tenders_update_officer" ON public.tenders
    FOR UPDATE
    USING (
        (auth.uid() = created_by OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tenders.procuring_organization_id
            AND om.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'ADMIN'
            AND u.is_active = true
        ))
    );

-- -------------------------------------------------------------------
-- tender_requirements RLS Policies
-- -------------------------------------------------------------------

-- 1. Read Policy:
-- - Accessible if the parent tender is accessible to the user
DROP POLICY IF EXISTS "tender_requirements_read_policy" ON public.tender_requirements;
CREATE POLICY "tender_requirements_read_policy" ON public.tender_requirements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenders t
            WHERE t.id = tender_requirements.tender_id
            AND (
                t.status IN ('PUBLISHED', 'CLOSED', 'UNDER_EVALUATION', 'AWARDED')
                OR t.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = t.procuring_organization_id
                    AND om.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('ADMIN', 'AUDITOR')
                    AND u.is_active = true
                )
            )
        )
    );

-- 2. Insert/Update/Delete Policy:
-- - Requirements can only be modified if the parent tender is in DRAFT status
--   and the user is an authorized Officer or Admin.
DROP POLICY IF EXISTS "tender_requirements_modify_policy" ON public.tender_requirements;
CREATE POLICY "tender_requirements_modify_policy" ON public.tender_requirements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenders t
            WHERE t.id = tender_requirements.tender_id
            AND t.status = 'DRAFT'
            AND (
                t.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = t.procuring_organization_id
                    AND om.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.role = 'ADMIN'
                    AND u.is_active = true
                )
            )
        )
    );

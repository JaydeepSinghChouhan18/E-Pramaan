-- ====================================================================
-- e-Pramaan Database Migration: 0003_bids_and_documents.sql
-- Description: Bid submission, document management, and RLS policies
-- ====================================================================

-- 1. Create bid_status and verification_status enums
DO $$ BEGIN
    CREATE TYPE bid_status AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'WITHDRAWN',
        'UNDER_REVIEW',
        'QUALIFIED',
        'DISQUALIFIED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM (
        'NOT_APPLICABLE',
        'PENDING_VERIFICATION',
        'VERIFIED',
        'PARTIALLY_VERIFIED',
        'DISCREPANCY',
        'NON_COMPLIANT',
        'UNABLE_TO_VERIFY',
        'SOURCE_UNAVAILABLE',
        'ACCESS_PENDING',
        'ERROR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create public.bids table
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE RESTRICT,
    bidder_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    submitted_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    bid_number TEXT UNIQUE NOT NULL,
    status bid_status NOT NULL DEFAULT 'DRAFT',
    bid_amount NUMERIC(15, 2),
    submission_notes TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraint: An organization can only have one active (non-withdrawn) bid per tender
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_bid_per_tender_org
ON public.bids (tender_id, bidder_organization_id)
WHERE status != 'WITHDRAWN';

-- Indexes for performance & query speed
CREATE INDEX IF NOT EXISTS idx_bids_tender_id ON public.bids(tender_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder_org_id ON public.bids(bidder_organization_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON public.bids(status);
CREATE INDEX IF NOT EXISTS idx_bids_submitted_by ON public.bids(submitted_by_user_id);

-- 3. Create public.bid_documents table
CREATE TABLE IF NOT EXISTS public.bid_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
    tender_requirement_id UUID NOT NULL REFERENCES public.tender_requirements(id) ON DELETE RESTRICT,
    document_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    sha256_hash TEXT,
    verification_status verification_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_bid_documents_bid_id ON public.bid_documents(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_documents_req_id ON public.bid_documents(tender_requirement_id);
CREATE INDEX IF NOT EXISTS idx_bid_documents_verification ON public.bid_documents(verification_status);

-- 4. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_bids_updated_at ON public.bids;
CREATE TRIGGER trg_bids_updated_at
BEFORE UPDATE ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_documents ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------
-- bids RLS Policies
-- -------------------------------------------------------------------

-- 1. Read Policy:
DROP POLICY IF EXISTS "bids_read_policy" ON public.bids;
CREATE POLICY "bids_read_policy" ON public.bids
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = bids.bidder_organization_id
            AND om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = bids.tender_id
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
DROP POLICY IF EXISTS "bids_insert_bidder" ON public.bids;
CREATE POLICY "bids_insert_bidder" ON public.bids
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            JOIN public.users u ON u.id = om.user_id
            WHERE om.organization_id = bids.bidder_organization_id
            AND om.user_id = auth.uid()
            AND u.role = 'BIDDER'
            AND u.is_active = true
        )
    );

-- 3. Update Policy:
DROP POLICY IF EXISTS "bids_update_policy" ON public.bids;
CREATE POLICY "bids_update_policy" ON public.bids
    FOR UPDATE
    USING (
        (
            status = 'DRAFT'
            AND EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = bids.bidder_organization_id
                AND om.user_id = auth.uid()
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.tenders t
            JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
            WHERE t.id = bids.tender_id
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
-- bid_documents RLS Policies
-- -------------------------------------------------------------------

-- 1. Read Policy:
DROP POLICY IF EXISTS "bid_documents_read_policy" ON public.bid_documents;
CREATE POLICY "bid_documents_read_policy" ON public.bid_documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bids b
            WHERE b.id = bid_documents.bid_id
            AND (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = b.bidder_organization_id
                    AND om.user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.tenders t
                    JOIN public.organization_members om ON om.organization_id = t.procuring_organization_id
                    WHERE t.id = b.tender_id
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

-- 2. Insert/Delete Policy:
DROP POLICY IF EXISTS "bid_documents_modify_policy" ON public.bid_documents;
CREATE POLICY "bid_documents_modify_policy" ON public.bid_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.bids b
            WHERE b.id = bid_documents.bid_id
            AND b.status = 'DRAFT'
            AND EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = b.bidder_organization_id
                AND om.user_id = auth.uid()
            )
        )
    );

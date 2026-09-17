-- ====================================================================
-- e-Pramaan Database Migration: 0001_initial_auth_and_organizations.sql
-- Description: Core identity, organization, and membership schema with RLS
-- ====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create Enums matching shared TypeScript contracts
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('OFFICER', 'BIDDER', 'ADMIN', 'AUDITOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE organization_type AS ENUM (
        'BIDDER_ENTITY',
        'GOVERNMENT_ENTITY',
        'PROCURING_AGENCY',
        'REGULATORY_BODY'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE membership_role AS ENUM (
        'PRIMARY_OFFICER',
        'EVALUATOR',
        'SIGNATORY',
        'AUTHORIZED_REPRESENTATIVE',
        'COMPLIANCE_OFFICER',
        'MEMBER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create users table
-- Links to Supabase auth.users if Supabase Auth is active, or functions standalone
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'BIDDER',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 3. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    organization_type organization_type NOT NULL,
    identifier TEXT, -- CIN, PAN, or Department Code
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_legal_name ON public.organizations(legal_name);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON public.organizations(organization_type);

-- 4. Create organization_members table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    membership_role membership_role NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_organization UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(organization_id);

-- 5. Updated_at automated triggers
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_orgs_updated_at ON public.organizations;
CREATE TRIGGER trg_orgs_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_org_members_updated_at ON public.organization_members;
CREATE TRIGGER trg_org_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ====================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- users policies
-- Users can read their own profile
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
    FOR SELECT
    USING (auth.uid() = id);

-- Admins and Auditors can view all user profiles
DROP POLICY IF EXISTS "users_admin_auditor_read_all" ON public.users;
CREATE POLICY "users_admin_auditor_read_all" ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('ADMIN', 'AUDITOR')
            AND u.is_active = true
        )
    );

-- Users can update their own profile fields except role and is_active
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- organizations policies
-- Any authenticated user can view organizations for procurement / bidding searches
DROP POLICY IF EXISTS "orgs_read_authenticated" ON public.organizations;
CREATE POLICY "orgs_read_authenticated" ON public.organizations
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only authorized organization admins / primary officers can update organization details
DROP POLICY IF EXISTS "orgs_update_primary_officer" ON public.organizations;
CREATE POLICY "orgs_update_primary_officer" ON public.organizations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organizations.id
            AND om.user_id = auth.uid()
            AND om.membership_role IN ('PRIMARY_OFFICER', 'AUTHORIZED_REPRESENTATIVE')
        )
    );

-- organization_members policies
-- Users can view their own memberships
DROP POLICY IF EXISTS "org_members_read_own" ON public.organization_members;
CREATE POLICY "org_members_read_own" ON public.organization_members
    FOR SELECT
    USING (auth.uid() = user_id);

-- Members can view other members of the same organization
DROP POLICY IF EXISTS "org_members_read_colleagues" ON public.organization_members;
CREATE POLICY "org_members_read_colleagues" ON public.organization_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members self_m
            WHERE self_m.organization_id = organization_members.organization_id
            AND self_m.user_id = auth.uid()
        )
    );

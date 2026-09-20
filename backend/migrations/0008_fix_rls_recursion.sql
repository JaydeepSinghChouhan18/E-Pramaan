-- 0008_fix_rls_recursion.sql
-- Fix infinite recursion detected in policy for relation organization_members
-- Root cause: Policy "org_members_read_colleagues" queried public.organization_members
-- within a SELECT policy on public.organization_members.

-- Helper function with SECURITY DEFINER to safely read user's organization IDs
-- without triggering RLS evaluation loops.
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT organization_id FROM public.organization_members WHERE user_id = p_user_id;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_organization_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_ids(UUID) TO service_role;

-- Recreate policy using the non-recursive helper function
DROP POLICY IF EXISTS "org_members_read_colleagues" ON public.organization_members;
CREATE POLICY "org_members_read_colleagues" ON public.organization_members
    FOR SELECT
    USING (
        organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    );

-- Also ensure organizations update policy is non-recursive
DROP POLICY IF EXISTS "orgs_update_primary_officer" ON public.organizations;
CREATE POLICY "orgs_update_primary_officer" ON public.organizations
    FOR UPDATE
    USING (
        id IN (
            SELECT om.organization_id FROM public.organization_members om
            WHERE om.user_id = auth.uid()
            AND om.membership_role IN ('PRIMARY_OFFICER', 'AUTHORIZED_REPRESENTATIVE')
        )
    );

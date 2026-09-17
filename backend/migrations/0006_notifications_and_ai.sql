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

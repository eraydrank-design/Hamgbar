-- ─── HangBar — Notifications Migration ───────────────────────────────────────
-- Run this ENTIRE file in:  Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,   -- receiver
  sender_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,           -- who triggered it
  type       TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'message')),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  message    TEXT NOT NULL DEFAULT '',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;

-- Receivers can read their own notifications
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Authenticated users can insert notifications where they are the sender
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Receivers can mark their own notifications as read
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Receivers can delete their own notifications
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Enable Realtime ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

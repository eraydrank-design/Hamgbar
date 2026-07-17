-- ─── HangBar — Stories Fix Migration (idempotent, safe to re-run) ────────────
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- This script is fully idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Stories table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url    TEXT,
  media_type   TEXT NOT NULL DEFAULT 'image'
               CHECK (media_type IN ('image', 'video', 'text')),
  text_content TEXT,
  text_bg      TEXT DEFAULT '#1a1a1a',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select" ON stories;
DROP POLICY IF EXISTS "stories_insert" ON stories;
DROP POLICY IF EXISTS "stories_delete" ON stories;

CREATE POLICY "stories_select" ON stories
  FOR SELECT TO authenticated USING (expires_at > NOW());

CREATE POLICY "stories_insert" ON stories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_delete" ON stories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 2. Story views table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint only if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'story_views_story_id_viewer_id_key'
      AND conrelid = 'story_views'::regclass
  ) THEN
    ALTER TABLE story_views ADD CONSTRAINT story_views_story_id_viewer_id_key
      UNIQUE (story_id, viewer_id);
  END IF;
END $$;

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_views_select" ON story_views;
DROP POLICY IF EXISTS "story_views_insert" ON story_views;

-- Viewer can read their own views; story owner can read all views on their stories
CREATE POLICY "story_views_select" ON story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR story_id IN (SELECT id FROM stories WHERE user_id = auth.uid())
  );

-- Any authenticated user can record their own view
CREATE POLICY "story_views_insert" ON story_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

-- ── 3. Enable Realtime (safe to run even if already added) ───────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stories;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE story_views;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 4. Verify ─────────────────────────────────────────────────────────────────
-- Run this SELECT to confirm both tables and their policies exist:
SELECT
  t.table_name,
  p.policyname,
  p.cmd
FROM information_schema.tables t
LEFT JOIN pg_policies p ON p.tablename = t.table_name
WHERE t.table_name IN ('stories', 'story_views')
  AND t.table_schema = 'public'
ORDER BY t.table_name, p.policyname;

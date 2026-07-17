-- ─── HangBar — Stories Migration ─────────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Stories ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url    TEXT,
  media_type   TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'text')),
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

-- ── Story views ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, viewer_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_views_select" ON story_views;
DROP POLICY IF EXISTS "story_views_insert" ON story_views;

-- Viewer can read their own views; story owner can read all views of their stories
CREATE POLICY "story_views_select" ON story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR story_id IN (SELECT id FROM stories WHERE user_id = auth.uid())
  );

CREATE POLICY "story_views_insert" ON story_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- ── Enable Realtime ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE story_views;

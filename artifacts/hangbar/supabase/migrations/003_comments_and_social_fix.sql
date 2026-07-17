-- ─── HangBar — Migration 003: Comments + Social System Fix ──────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- This migration is SAFE TO RUN even if you already ran 002_social.sql.
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS guards.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Ensure social profile columns exist (idempotent, safe to re-run) ─────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url      TEXT    DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points         INT     NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pinned_post_id UUID    REFERENCES posts(id) ON DELETE SET NULL;

-- ── Ensure follows table exists ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select" ON follows;
DROP POLICY IF EXISTS "follows_insert" ON follows;
DROP POLICY IF EXISTS "follows_delete" ON follows;
CREATE POLICY "follows_select" ON follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ── Ensure post_likes table exists ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_likes_select" ON post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON post_likes;
CREATE POLICY "post_likes_select" ON post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_likes_insert" ON post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_likes_delete" ON post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Post Comments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name  TEXT DEFAULT '',
  author_photo TEXT DEFAULT '',
  content      TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON post_comments;
DROP POLICY IF EXISTS "comments_insert" ON post_comments;
DROP POLICY IF EXISTS "comments_update" ON post_comments;
DROP POLICY IF EXISTS "comments_delete" ON post_comments;
CREATE POLICY "comments_select" ON post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_update" ON post_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "comments_delete" ON post_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ── Enable Realtime for all social tables ─────────────────────────────────────
-- These are safe to run even if already added (Postgres ignores duplicates in the publication)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE follows; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE post_likes; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE post_comments; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ─── HangBar — Social Upgrade Migration (idempotent) ─────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. text_overlay column on stories ────────────────────────────────────────
ALTER TABLE stories ADD COLUMN IF NOT EXISTS text_overlay JSONB;

-- ── 2. post_images (carousel support) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  order_index INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_images_select" ON post_images;
DROP POLICY IF EXISTS "post_images_insert" ON post_images;
DROP POLICY IF EXISTS "post_images_delete" ON post_images;

CREATE POLICY "post_images_select" ON post_images
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "post_images_insert" ON post_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

CREATE POLICY "post_images_delete" ON post_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

-- ── 3. saved_posts (bookmarks) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint so one user can't save the same post twice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_posts_user_id_post_id_key'
      AND conrelid = 'saved_posts'::regclass
  ) THEN
    ALTER TABLE saved_posts ADD CONSTRAINT saved_posts_user_id_post_id_key UNIQUE (user_id, post_id);
  END IF;
END $$;

ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_posts_select" ON saved_posts;
DROP POLICY IF EXISTS "saved_posts_insert" ON saved_posts;
DROP POLICY IF EXISTS "saved_posts_delete" ON saved_posts;

CREATE POLICY "saved_posts_select" ON saved_posts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "saved_posts_insert" ON saved_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_posts_delete" ON saved_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 4. posts DELETE policy (own posts only) ───────────────────────────────────
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_delete" ON posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ── 5. Realtime ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE post_images; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE saved_posts;  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

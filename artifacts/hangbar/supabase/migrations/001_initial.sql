-- ─── HangBar — Supabase Initial Migration ────────────────────────────────────
-- Run this ENTIRE file in:  Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT,
  display_name   TEXT NOT NULL DEFAULT 'Misafir',
  username       TEXT DEFAULT '',
  photo_url      TEXT DEFAULT '',
  bio            TEXT DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'staff',   -- 'staff' | 'admin'
  cocktail_count INT  NOT NULL DEFAULT 0,
  badges         JSONB NOT NULL DEFAULT '[]',
  favorites      JSONB NOT NULL DEFAULT '[]',     -- array of cocktail UUIDs
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add favorites column if table already existed without it
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorites JSONB NOT NULL DEFAULT '[]';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (true);

-- ── Cocktails ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cocktails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Signature',
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ingredients   TEXT[] NOT NULL DEFAULT '{}',
  preparation   TEXT DEFAULT '',
  garnish       TEXT DEFAULT '',
  glass_type    TEXT DEFAULT '',
  ice_type      TEXT DEFAULT 'Küp Buz',
  alcohol_level TEXT DEFAULT 'Orta',
  notes         TEXT DEFAULT '',
  available     BOOLEAN NOT NULL DEFAULT true,
  image_url     TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cocktails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cocktails_all" ON cocktails;
CREATE POLICY "cocktails_all" ON cocktails FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Announcements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  pinned     BOOLEAN NOT NULL DEFAULT false,
  author     TEXT NOT NULL DEFAULT 'Yönetici',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_all" ON announcements;
CREATE POLICY "announcements_all" ON announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Requests ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT NOT NULL DEFAULT 'Table Service',
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  requested_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name TEXT DEFAULT '',
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "requests_all" ON requests;
CREATE POLICY "requests_all" ON requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority    TEXT NOT NULL DEFAULT 'medium',
  status      TEXT NOT NULL DEFAULT 'pending',
  due_date    TIMESTAMPTZ,
  created_by  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_all" ON tasks;
CREATE POLICY "tasks_all" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Rules ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  "order"    INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rules_all" ON rules;
CREATE POLICY "rules_all" ON rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Posts (Explore feed) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name   TEXT DEFAULT '',
  author_photo  TEXT DEFAULT '',
  image_url     TEXT DEFAULT '',
  caption       TEXT NOT NULL,
  cocktail_name TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_all" ON posts;
CREATE POLICY "posts_all" ON posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text        TEXT NOT NULL,
  sender_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_read"   ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_read"   ON messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update" ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ── Badges ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji      TEXT NOT NULL DEFAULT '⭐',
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_all" ON badges;
CREATE POLICY "badges_all" ON badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Cocktail Submissions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cocktail_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name  TEXT DEFAULT '',
  submitted_by_photo TEXT DEFAULT '',
  image_url          TEXT DEFAULT '',
  cocktail_name      TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cocktail_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "submissions_all" ON cocktail_submissions;
CREATE POLICY "submissions_all" ON cocktail_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Enable Realtime ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE cocktails;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE requests;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE badges;
ALTER PUBLICATION supabase_realtime ADD TABLE cocktail_submissions;

-- ── Storage bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('images', 'images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "images_upload" ON storage.objects;
DROP POLICY IF EXISTS "images_read"   ON storage.objects;
DROP POLICY IF EXISTS "images_update" ON storage.objects;
DROP POLICY IF EXISTS "images_delete" ON storage.objects;

CREATE POLICY "images_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');
CREATE POLICY "images_read"   ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'images');
CREATE POLICY "images_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'images');
CREATE POLICY "images_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images');

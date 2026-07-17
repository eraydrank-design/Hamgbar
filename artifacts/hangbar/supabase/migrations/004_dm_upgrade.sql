-- ─── HangBar — DM Upgrade Migration ─────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times (all changes use IF NOT EXISTS guards)
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow NULL text so image/voice-only messages have no text body
ALTER TABLE messages ALTER COLUMN text DROP NOT NULL;

-- Message delivery status: sent → delivered → seen
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_status_check' AND conrelid = 'messages'::regclass
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_status_check
      CHECK (status IN ('sent', 'delivered', 'seen'));
  END IF;
END $$;

-- Migrate existing read=true rows to seen
UPDATE messages SET status = 'seen' WHERE read = true AND status = 'sent';

-- Media attachments (images, voice)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url     TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type    TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_media_type_check' AND conrelid = 'messages'::regclass
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_media_type_check
      CHECK (media_type IS NULL OR media_type IN ('image', 'voice'));
  END IF;
END $$;

-- Emoji reactions stored as [{emoji, userId}] array
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Allow UPDATE for reactions (both parties need to toggle reactions)
-- Policy already covers sender OR receiver, so no change needed.

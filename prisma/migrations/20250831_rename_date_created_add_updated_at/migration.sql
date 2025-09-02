-- Rename date_created -> created_at and add updated_at on gpt_tg_users
-- Safe rename: create new column, copy data, drop old, then rename

-- 1) Add created_at if missing and copy from date_created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpt_tg_users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.gpt_tg_users
      ADD COLUMN created_at timestamptz(6) NOT NULL DEFAULT now();
    -- copy existing values from date_created when present
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'gpt_tg_users' AND column_name = 'date_created'
    ) THEN
      UPDATE public.gpt_tg_users SET created_at = date_created;
    END IF;
  END IF;
END $$;

-- 2) Add updated_at if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpt_tg_users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.gpt_tg_users
      ADD COLUMN updated_at timestamptz(6) NOT NULL DEFAULT now();
  END IF;
END $$;

-- 3) Drop the old date_created if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpt_tg_users' AND column_name = 'date_created'
  ) THEN
    ALTER TABLE public.gpt_tg_users DROP COLUMN date_created;
  END IF;
END $$;



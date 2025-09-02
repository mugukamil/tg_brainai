-- Add premium_started_at and free_period_start, and created_at/updated_at if not present

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpt_tg_users' AND column_name = 'premium_started_at'
  ) THEN
    ALTER TABLE public.gpt_tg_users ADD COLUMN premium_started_at timestamptz(6);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpt_tg_users' AND column_name = 'free_period_start'
  ) THEN
    ALTER TABLE public.gpt_tg_users ADD COLUMN free_period_start date;
  END IF;
END $$;

-- Ensure created_at, updated_at exist (if previous migration not run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpt_tg_users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.gpt_tg_users ADD COLUMN created_at timestamptz(6) NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gpt_tg_users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.gpt_tg_users ADD COLUMN updated_at timestamptz(6) NOT NULL DEFAULT now();
  END IF;
END $$;




-- Migration: Add image_provider column to gpt_tg_users table
-- Purpose: Support multiple image generation providers (goapi, fal-ai)
-- Date: 2024-01-01
-- Author: fal.ai Integration

-- Add image_provider column with default value for backward compatibility
ALTER TABLE gpt_tg_users
ADD COLUMN image_provider VARCHAR(10) DEFAULT 'goapi';

-- Add check constraint to ensure valid provider values
ALTER TABLE gpt_tg_users
ADD CONSTRAINT check_image_provider
CHECK (image_provider IN ('goapi', 'fal-ai'));

-- Add index for performance if needed (optional)
CREATE INDEX idx_image_provider ON gpt_tg_users(image_provider);

-- Update any existing users to have the default provider
UPDATE gpt_tg_users
SET image_provider = 'goapi'
WHERE image_provider IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN gpt_tg_users.image_provider IS 'Image generation provider: goapi (Midjourney) or fal-ai (Nano Banana)';

-- Rollback instructions (uncomment to rollback):
-- DROP INDEX IF EXISTS idx_image_provider;
-- ALTER TABLE gpt_tg_users DROP CONSTRAINT IF EXISTS check_image_provider;
-- ALTER TABLE gpt_tg_users DROP COLUMN IF EXISTS image_provider;

-- Verify the migration
-- SELECT image_provider, COUNT(*) FROM gpt_tg_users GROUP BY image_provider;

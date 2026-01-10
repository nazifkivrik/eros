-- Migration: Add Cross-Encoder AI settings fields
-- Adds useCrossEncoder, crossEncoderThreshold, and unknownThreshold to AI settings

-- Update existing app_settings to add new AI fields if they don't exist
UPDATE app_settings
SET value = json_set(
  value,
  '$.ai.useCrossEncoder',
  COALESCE(json_extract(value, '$.ai.useCrossEncoder'), json('false')),
  '$.ai.crossEncoderThreshold',
  COALESCE(json_extract(value, '$.ai.crossEncoderThreshold'), 0.7),
  '$.ai.unknownThreshold',
  COALESCE(json_extract(value, '$.ai.unknownThreshold'), 0.4)
)
WHERE key = 'app-settings'
  AND json_extract(value, '$.ai') IS NOT NULL
  AND json_extract(value, '$.ai.useCrossEncoder') IS NULL;

-- ============================================================================
-- Migration: Add Subscriptions Table for Premium Plans
-- Purpose: Track landlord subscription plans (Basic, Pro, Enterprise)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL UNIQUE REFERENCES landlord_profile(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_plan VARCHAR(50) DEFAULT 'basic' CHECK (current_plan IN ('basic', 'pro', 'enterprise')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  renewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_landlord_id ON subscriptions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(current_plan);

-- Ensure all existing landlords have a basic subscription
INSERT INTO subscriptions (landlord_id, user_id, current_plan)
SELECT lp.id, lp.user_id, 'basic'
FROM landlord_profile lp
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.landlord_id = lp.id
)
ON CONFLICT DO NOTHING;

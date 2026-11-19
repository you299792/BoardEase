-- ============================================================================
-- BoardEase Database Schema for Supabase
-- Purpose: Boarding House Rental Management Platform
-- Version: 3.0 - Rebuilt from a full audit of actual app code usage
--          (lib/supabaseClient.js + every app/ screen that talks to Supabase)
--          after the previous Supabase project was terminated for inactivity.
--
-- This file is meant to be run top-to-bottom on a fresh Supabase project.
-- It supersedes database/migrations/add_subscriptions_table.sql (merged in)
-- and supabase/migrations/20240101000000_create_storage_buckets.sql
-- (buckets recreated here, including the previously-missing one).
--
-- Fixes applied vs. the old schema, based on the code audit:
--   1. Added id_verification table (code inserts into it; no CREATE TABLE existed)
--   2. Added the id-verifications storage bucket (code uploads to it; bucket
--      never existed) with a corrected per-user folder policy
--   3. Merged subscriptions table into the main schema
--   4. payments.payment_type CHECK extended with 'security_deposit' (the
--      landlord financials UI sends this value; it would have violated the
--      old CHECK constraint)
--   5. conversations.conversation_topic CHECK made case-insensitive (app has
--      a retry path that sends 'General' with a capital G)
--   6. bookings.status CHECK extended with 'occupied' (defensively checked
--      against in 4 screens; cheap to allow even if rarely written)
--   7. bookings gained cancelled_at / cancellation_reason columns (the UI
--      reads these; nothing wrote them before because they didn't exist)
--   8. Added real Row Level Security policies. users.id is always set to
--      Supabase Auth's auth.uid() at signup (confirmed in supabaseClient.js),
--      so every policy below anchors on auth.uid().
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE - Main user accounts (Tenants & Landlords)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tenant', 'landlord')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_image_url TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

-- ============================================================================
-- 2. TENANT_PROFILE TABLE - Extended tenant information
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  occupation VARCHAR(100),
  company_name VARCHAR(100),
  id_type VARCHAR(50) DEFAULT 'national_id' CHECK (id_type IN ('national_id', 'passport', 'drivers_license')),
  id_number VARCHAR(100) UNIQUE,
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
  move_in_date DATE,
  budget_min DECIMAL(10, 2),
  budget_max DECIMAL(10, 2),
  preferences TEXT,
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  rating DECIMAL(3, 2) DEFAULT 0.00 CHECK (rating BETWEEN 0 AND 5),
  total_reviews INT DEFAULT 0,
  total_bookings INT DEFAULT 0,
  average_response_rating DECIMAL(3, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_user_id ON tenant_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_budget ON tenant_profile(budget_min, budget_max);
CREATE INDEX IF NOT EXISTS idx_tenant_rating ON tenant_profile(rating);

-- ============================================================================
-- 3. LANDLORD_PROFILE TABLE - Extended landlord information
-- ============================================================================
CREATE TABLE IF NOT EXISTS landlord_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  years_experience INT DEFAULT 0 CHECK (years_experience >= 0),
  total_properties INT DEFAULT 0,
  response_rate DECIMAL(5, 2) DEFAULT 0.00 CHECK (response_rate BETWEEN 0 AND 100),
  response_time_avg_hours INT,
  rating DECIMAL(3, 2) DEFAULT 0.00 CHECK (rating BETWEEN 0 AND 5),
  total_reviews INT DEFAULT 0,
  total_active_bookings INT DEFAULT 0,
  verification_document_url TEXT,
  tax_id VARCHAR(100) UNIQUE,
  bank_account_verified BOOLEAN DEFAULT FALSE,
  business_permit_url TEXT,
  join_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_landlord_user_id ON landlord_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_landlord_rating ON landlord_profile(rating);
CREATE INDEX IF NOT EXISTS idx_landlord_verified ON landlord_profile(bank_account_verified);

-- ============================================================================
-- 4. LISTINGS TABLE - Boarding house/room listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlord_profile(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  property_type VARCHAR(50) DEFAULT 'boarding_house' CHECK (property_type IN ('boarding_house', 'apartment', 'room', 'dormitory')),
  room_type VARCHAR(50) DEFAULT 'single_room' CHECK (room_type IN ('single_room', 'shared_room', 'studio', 'suite', 'bed_space')),
  address VARCHAR(500) NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  max_guests INT DEFAULT 1 CHECK (max_guests > 0),
  price_per_month DECIMAL(10, 2) NOT NULL CHECK (price_per_month > 0),
  bedrooms INT,
  bathrooms INT,
  property_size INT,
  amenities JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  floor_plans JSONB DEFAULT '[]'::jsonb,
  virtual_tour_url TEXT,
  rules_regulations JSONB DEFAULT '[]'::jsonb,
  available BOOLEAN DEFAULT TRUE,
  total_rooms INT,
  available_rooms INT,
  rating DECIMAL(3, 2) DEFAULT 0.00 CHECK (rating BETWEEN 0 AND 5),
  total_reviews INT DEFAULT 0,
  total_views INT DEFAULT 0,
  favorite_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  featured_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listings_landlord_id ON listings(landlord_id);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price_per_month);
CREATE INDEX IF NOT EXISTS idx_listings_available ON listings(available);
CREATE INDEX IF NOT EXISTS idx_listings_rating ON listings(rating);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at);
CREATE INDEX IF NOT EXISTS idx_listings_room_type ON listings(room_type);

-- ============================================================================
-- 5. BOOKINGS TABLE - Tenant bookings/reservations
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_profile(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES landlord_profile(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  move_in_date DATE NOT NULL,
  move_out_date DATE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed', 'active', 'occupied')),
  duration_months INT,
  number_of_guests INT DEFAULT 1 CHECK (number_of_guests > 0),
  special_requests TEXT,
  landlord_notes TEXT,
  tenant_notes TEXT,
  booking_reason VARCHAR(50) DEFAULT 'other' CHECK (booking_reason IN ('urgent', 'student', 'work', 'family', 'other')),
  total_amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  is_review_pending BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_landlord_id ON bookings(landlord_id);
CREATE INDEX IF NOT EXISTS idx_bookings_listing_id ON bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(move_in_date, move_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

-- ============================================================================
-- 6. PAYMENT_METHODS TABLE - Stored payment methods for users
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method_type VARCHAR(50) NOT NULL CHECK (payment_method_type IN ('credit_card', 'debit_card', 'bank_account', 'gcash', 'paymaya', 'paypal', 'cash')),
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  card_holder_name VARCHAR(255),
  card_last_four VARCHAR(4),
  card_expiry VARCHAR(5),
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  mobile_number VARCHAR(20),
  email_address VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_primary ON payment_methods(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);

-- ============================================================================
-- 7. PAYMENTS TABLE - Payment records
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  landlord_id UUID NOT NULL REFERENCES landlord_profile(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_profile(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_type VARCHAR(50) DEFAULT 'rent' CHECK (payment_type IN ('rent', 'deposit', 'security_deposit', 'utility', 'maintenance', 'other', 'advance')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partially_paid')),
  payment_method VARCHAR(50) DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'credit_card', 'debit_card', 'mobile_wallet', 'cash', 'check')),
  transaction_id VARCHAR(255) UNIQUE,
  reference_number VARCHAR(100),
  due_date DATE,
  paid_date DATE,
  recorded_by_landlord BOOLEAN DEFAULT FALSE,
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_landlord_id ON payments(landlord_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_listing_id ON payments(listing_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_paid_date ON payments(paid_date);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

-- Realtime subscribes to '*' events filtered by landlord_id/tenant_id (non-PK
-- columns), so full old-row data is needed for UPDATE/DELETE filtering.
ALTER TABLE payments REPLICA IDENTITY FULL;

-- ============================================================================
-- 8. CONVERSATIONS TABLE - Chat conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlord_profile(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_profile(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  conversation_topic VARCHAR(50) DEFAULT 'general' CHECK (LOWER(conversation_topic) IN ('inquiry', 'booking', 'maintenance', 'payment', 'general')),
  last_message TEXT,
  last_message_sender_id UUID,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count_tenant INT DEFAULT 0,
  unread_count_landlord INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_landlord_id ON conversations(landlord_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing_id ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_is_active ON conversations(is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
-- createConversation() dedupes by exactly this triple before inserting
CREATE INDEX IF NOT EXISTS idx_conversations_dedupe ON conversations(tenant_id, landlord_id, listing_id);

-- Realtime subscribes to '*' events filtered by landlord_id (non-PK column)
ALTER TABLE conversations REPLICA IDENTITY FULL;

-- ============================================================================
-- 9. MESSAGES TABLE - Direct messages between users
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('tenant', 'landlord')),
  message_text TEXT,
  message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'inquiry', 'booking', 'payment_reminder')),
  media_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
-- TabBarBadge.js / unread counts filter on exactly this pair
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read);

-- ============================================================================
-- 10. INQUIRIES TABLE - General inquiries and support tickets
-- ============================================================================
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenant_profile(id) ON DELETE CASCADE,
  landlord_id UUID REFERENCES landlord_profile(id) ON DELETE CASCADE,
  inquiry_type VARCHAR(50) DEFAULT 'availability' CHECK (inquiry_type IN ('availability', 'pricing', 'amenities', 'booking', 'support', 'complaint')),
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  response_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_inquiries_tenant_id ON inquiries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_landlord_id ON inquiries(landlord_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_listing_id ON inquiries(listing_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON inquiries(priority);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);

-- ============================================================================
-- 11. REVIEWS TABLE - Reviews for listings, landlords, and tenants
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewed_item_type VARCHAR(50) NOT NULL CHECK (reviewed_item_type IN ('listing', 'landlord', 'tenant')),
  reviewed_item_id UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(255),
  review_text TEXT,
  cleanliness INT CHECK (cleanliness BETWEEN 1 AND 5),
  communication INT CHECK (communication BETWEEN 1 AND 5),
  amenities INT CHECK (amenities BETWEEN 1 AND 5),
  location INT CHECK (location BETWEEN 1 AND 5),
  value_for_money INT CHECK (value_for_money BETWEEN 1 AND 5),
  helpful_count INT DEFAULT 0,
  images JSONB DEFAULT '[]'::jsonb,
  reviewer_name VARCHAR(100),
  is_verified_booking BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- reviewed_item_id is polymorphic (listing/landlord/tenant) so it cannot carry
-- a DB-level FOREIGN KEY; integrity across that pointer is enforced in RLS below.
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_item ON reviews(reviewed_item_type, reviewed_item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at);

-- ============================================================================
-- 12. FAVORITES TABLE - Tenant favorite listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_profile(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_tenant_id ON favorites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON favorites(listing_id);

-- ============================================================================
-- 13. NOTIFICATIONS TABLE - System notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) DEFAULT 'system' CHECK (notification_type IN ('booking_request', 'booking_approved', 'booking_cancelled', 'booking_rejected', 'payment_due', 'message', 'review', 'system', 'listing_inquiry', 'payment_completed')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- ============================================================================
-- 14. SEARCH_HISTORY TABLE - Track user searches
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  search_query VARCHAR(255),
  filters JSONB,
  results_count INT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp);

-- ============================================================================
-- 15. TRANSACTIONS_LOG TABLE - Financial transaction audit log
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type VARCHAR(50) DEFAULT 'payment_in' CHECK (transaction_type IN ('payment_in', 'payment_out', 'refund', 'deposit', 'withdrawal', 'fee')),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'PHP',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  reference_id VARCHAR(100),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_log_user_id ON transactions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_log_status ON transactions_log(status);
CREATE INDEX IF NOT EXISTS idx_transactions_log_timestamp ON transactions_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_log_payment_id ON transactions_log(payment_id);

-- ============================================================================
-- 16. DOCUMENTS TABLE - User documents for verification
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) DEFAULT 'national_id' CHECK (document_type IN ('national_id', 'passport', 'drivers_license', 'business_permit', 'proof_of_address')),
  document_url TEXT NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verification_notes TEXT,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_verification_status ON documents(verification_status);

-- ============================================================================
-- 17. FEEDBACK TABLE - User feedback and complaints
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_type VARCHAR(50) DEFAULT 'other' CHECK (feedback_type IN ('bug_report', 'feature_request', 'complaint', 'suggestion', 'other')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  attachment_url TEXT,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'in_progress', 'completed', 'closed')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

-- ============================================================================
-- 18. ID_VERIFICATION TABLE - Landlord ID verification images
-- (Previously only a section header existed here with no CREATE TABLE, even
-- though lib/supabaseClient.js uploadIDVerificationImage() inserts into it.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS id_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlord_profile(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_id_verification_landlord_id ON id_verification(landlord_id);
CREATE INDEX IF NOT EXISTS idx_id_verification_user_id ON id_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_id_verification_verified ON id_verification(verified);

-- ============================================================================
-- 19. SUBSCRIPTIONS TABLE - Landlord subscription plans
-- (Previously lived only in database/migrations/add_subscriptions_table.sql;
-- merged here so a fresh project only needs this one file.)
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

-- Ensure every existing landlord has a subscription row (no-op on a fresh DB)
INSERT INTO subscriptions (landlord_id, user_id, current_plan)
SELECT lp.id, lp.user_id, 'basic'
FROM landlord_profile lp
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.landlord_id = lp.id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STORAGE BUCKETS
-- (Previously only profile-images, listing-images and documents existed;
-- id-verifications was used by the app but never created.)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profile-images', 'profile-images', true),
  ('listing-images', 'listing-images', true),
  ('documents', 'documents', false),
  ('id-verifications', 'id-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- profile-images: public read, owner-only write. Also used for chat message
-- images (uploadMessageImage reuses this bucket under <user_id>/messages/...).
DROP POLICY IF EXISTS "profile-images public read" ON storage.objects;
CREATE POLICY "profile-images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-images');
DROP POLICY IF EXISTS "profile-images owner write" ON storage.objects;
CREATE POLICY "profile-images owner write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "profile-images owner update" ON storage.objects;
CREATE POLICY "profile-images owner update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "profile-images owner delete" ON storage.objects;
CREATE POLICY "profile-images owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- listing-images: public read (browsing), owner-only write
DROP POLICY IF EXISTS "listing-images public read" ON storage.objects;
CREATE POLICY "listing-images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'listing-images');
DROP POLICY IF EXISTS "listing-images owner write" ON storage.objects;
CREATE POLICY "listing-images owner write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "listing-images owner update" ON storage.objects;
CREATE POLICY "listing-images owner update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "listing-images owner delete" ON storage.objects;
CREATE POLICY "listing-images owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- documents: private, owner-only read/write
DROP POLICY IF EXISTS "documents owner read" ON storage.objects;
CREATE POLICY "documents owner read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "documents owner write" ON storage.objects;
CREATE POLICY "documents owner write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- id-verifications: private, owner-only read/write.
-- NOTE: the app currently uploads to the path
--   id-verifications/<user_id>/<timestamp>-id.jpg
-- i.e. inside the bucket of the same name, the FIRST folder segment is
-- already <user_id> (the duplicate "id-verifications/" segment some code
-- paths add is the bucket prefix returned by getPublicUrl, not a real path
-- segment stored in `name`). So foldername(name)[1] = user_id, matching the
-- pattern used by the other buckets. If the upload path is ever changed to
-- nest an extra literal "id-verifications" folder inside the bucket, update
-- this policy to foldername(name)[2] accordingly.
DROP POLICY IF EXISTS "id-verifications owner read" ON storage.objects;
CREATE POLICY "id-verifications owner read" ON storage.objects
  FOR SELECT USING (bucket_id = 'id-verifications' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "id-verifications owner write" ON storage.objects;
CREATE POLICY "id-verifications owner write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'id-verifications' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- ROW LEVEL SECURITY
-- users.id is always set to Supabase Auth's auth.uid() at signup (see
-- lib/supabaseClient.js signUp flows), so every policy below can anchor
-- directly on auth.uid() through the users/tenant_profile/landlord_profile
-- chain. Without this, any client could pass an arbitrary tenant_id/
-- landlord_id and read or write someone else's bookings, payments, messages,
-- conversations, notifications, favorites and reviews.
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- USERS: anyone signed in can read any user's public profile fields (needed
-- to show the other party's name/photo in chats, bookings, listings); a user
-- can only update their own row.
DROP POLICY IF EXISTS "users read all" ON users;
CREATE POLICY "users read all" ON users FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "users insert self" ON users;
CREATE POLICY "users insert self" ON users FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "users update self" ON users;
CREATE POLICY "users update self" ON users FOR UPDATE USING (id = auth.uid());

-- TENANT_PROFILE: owner-only read/write
DROP POLICY IF EXISTS "tenant_profile owner all" ON tenant_profile;
CREATE POLICY "tenant_profile owner all" ON tenant_profile FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- LANDLORD_PROFILE: readable by anyone authenticated (tenants need to see
-- landlord rating/stats on listings), owner-only write
DROP POLICY IF EXISTS "landlord_profile read all" ON landlord_profile;
CREATE POLICY "landlord_profile read all" ON landlord_profile FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "landlord_profile owner write" ON landlord_profile;
CREATE POLICY "landlord_profile owner write" ON landlord_profile FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "landlord_profile owner update" ON landlord_profile;
CREATE POLICY "landlord_profile owner update" ON landlord_profile FOR UPDATE USING (user_id = auth.uid());

-- LISTINGS: public read (tenants browse all listings), owner-only write
DROP POLICY IF EXISTS "listings public read" ON listings;
CREATE POLICY "listings public read" ON listings FOR SELECT USING (true);
DROP POLICY IF EXISTS "listings owner write" ON listings;
CREATE POLICY "listings owner write" ON listings FOR INSERT WITH CHECK (
  landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "listings owner update" ON listings;
CREATE POLICY "listings owner update" ON listings FOR UPDATE USING (
  landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "listings owner delete" ON listings;
CREATE POLICY "listings owner delete" ON listings FOR DELETE USING (
  landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);

-- BOOKINGS: visible/writable only by the tenant or landlord involved
DROP POLICY IF EXISTS "bookings involved read" ON bookings;
CREATE POLICY "bookings involved read" ON bookings FOR SELECT USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "bookings tenant insert" ON bookings;
CREATE POLICY "bookings tenant insert" ON bookings FOR INSERT WITH CHECK (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "bookings involved update" ON bookings;
CREATE POLICY "bookings involved update" ON bookings FOR UPDATE USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);

-- PAYMENT_METHODS: owner-only
DROP POLICY IF EXISTS "payment_methods owner all" ON payment_methods;
CREATE POLICY "payment_methods owner all" ON payment_methods FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PAYMENTS: visible/writable only by the tenant or landlord involved
DROP POLICY IF EXISTS "payments involved read" ON payments;
CREATE POLICY "payments involved read" ON payments FOR SELECT USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "payments involved write" ON payments;
CREATE POLICY "payments involved write" ON payments FOR INSERT WITH CHECK (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "payments involved update" ON payments;
CREATE POLICY "payments involved update" ON payments FOR UPDATE USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);

-- CONVERSATIONS: visible/writable only by the tenant or landlord in it
DROP POLICY IF EXISTS "conversations involved all" ON conversations;
CREATE POLICY "conversations involved all" ON conversations FOR ALL USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
) WITH CHECK (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);

-- MESSAGES: visible only to sender/receiver; only the sender can insert as themself
DROP POLICY IF EXISTS "messages involved read" ON messages;
CREATE POLICY "messages involved read" ON messages FOR SELECT USING (
  sender_id = auth.uid() OR receiver_id = auth.uid()
);
DROP POLICY IF EXISTS "messages sender insert" ON messages;
CREATE POLICY "messages sender insert" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
);
DROP POLICY IF EXISTS "messages receiver update" ON messages;
CREATE POLICY "messages receiver update" ON messages FOR UPDATE USING (
  receiver_id = auth.uid()
);

-- INQUIRIES: visible/writable only by the tenant or landlord involved
DROP POLICY IF EXISTS "inquiries involved read" ON inquiries;
CREATE POLICY "inquiries involved read" ON inquiries FOR SELECT USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "inquiries tenant insert" ON inquiries;
CREATE POLICY "inquiries tenant insert" ON inquiries FOR INSERT WITH CHECK (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "inquiries involved update" ON inquiries;
CREATE POLICY "inquiries involved update" ON inquiries FOR UPDATE USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
  OR landlord_id IN (SELECT id FROM landlord_profile WHERE user_id = auth.uid())
);

-- REVIEWS: public read, write only your own review
DROP POLICY IF EXISTS "reviews public read" ON reviews;
CREATE POLICY "reviews public read" ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "reviews own insert" ON reviews;
CREATE POLICY "reviews own insert" ON reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());
DROP POLICY IF EXISTS "reviews own update" ON reviews;
CREATE POLICY "reviews own update" ON reviews FOR UPDATE USING (reviewer_id = auth.uid());

-- FAVORITES: owner-only
DROP POLICY IF EXISTS "favorites owner all" ON favorites;
CREATE POLICY "favorites owner all" ON favorites FOR ALL USING (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
) WITH CHECK (
  tenant_id IN (SELECT id FROM tenant_profile WHERE user_id = auth.uid())
);

-- NOTIFICATIONS: owner-only read/update; inserted by the app on behalf of
-- the recipient, so allow any authenticated user to insert for anyone
-- (notifications are always triggered by the other party's action).
DROP POLICY IF EXISTS "notifications owner read" ON notifications;
CREATE POLICY "notifications owner read" ON notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications authenticated insert" ON notifications;
CREATE POLICY "notifications authenticated insert" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "notifications owner update" ON notifications;
CREATE POLICY "notifications owner update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- SEARCH_HISTORY: owner-only
DROP POLICY IF EXISTS "search_history owner all" ON search_history;
CREATE POLICY "search_history owner all" ON search_history FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TRANSACTIONS_LOG: owner-only read; inserted by the app on the user's own behalf
DROP POLICY IF EXISTS "transactions_log owner read" ON transactions_log;
CREATE POLICY "transactions_log owner read" ON transactions_log FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "transactions_log owner insert" ON transactions_log;
CREATE POLICY "transactions_log owner insert" ON transactions_log FOR INSERT WITH CHECK (user_id = auth.uid());

-- DOCUMENTS: owner-only
DROP POLICY IF EXISTS "documents owner all" ON documents;
CREATE POLICY "documents owner all" ON documents FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- FEEDBACK: owner-only
DROP POLICY IF EXISTS "feedback owner all" ON feedback;
CREATE POLICY "feedback owner all" ON feedback FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ID_VERIFICATION: owner (landlord) can read/insert their own; nothing in the
-- app ever sets verified = true client-side, so no client UPDATE policy is
-- granted — that should only ever be done via the service role (admin review).
DROP POLICY IF EXISTS "id_verification owner read" ON id_verification;
CREATE POLICY "id_verification owner read" ON id_verification FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "id_verification owner insert" ON id_verification;
CREATE POLICY "id_verification owner insert" ON id_verification FOR INSERT WITH CHECK (user_id = auth.uid());

-- SUBSCRIPTIONS: owner-only read; writes are performed by the app on the
-- landlord's own behalf (plan selection/upgrade)
DROP POLICY IF EXISTS "subscriptions owner read" ON subscriptions;
CREATE POLICY "subscriptions owner read" ON subscriptions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions owner write" ON subscriptions;
CREATE POLICY "subscriptions owner write" ON subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions owner update" ON subscriptions;
CREATE POLICY "subscriptions owner update" ON subscriptions FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- ENTITY RELATIONSHIP DIAGRAM & DOCUMENTATION
-- ============================================================================
/*
MULTI-USER DATA MODEL FOR SUPABASE:

CORE ENTITIES:
├── USERS (id, email, user_type='tenant'|'landlord'; id == auth.uid())
│   ├── 1-to-1 ──> TENANT_PROFILE (via user_id) - for tenants
│   ├── 1-to-1 ──> LANDLORD_PROFILE (via user_id) - for landlords
│   ├── 1-to-many ──> DOCUMENTS (via user_id)
│   ├── 1-to-many ──> NOTIFICATIONS (via user_id)
│   ├── 1-to-many ──> MESSAGES (sender_id / receiver_id)
│   ├── 1-to-many ──> FEEDBACK (via user_id)
│   ├── 1-to-many ──> SEARCH_HISTORY (via user_id)
│   ├── 1-to-many ──> PAYMENT_METHODS (via user_id)
│   ├── 1-to-many ──> ID_VERIFICATION (via user_id)
│   └── 1-to-many ──> REVIEWS (via reviewer_id)
│
├── TENANT_PROFILE
│   ├── 1-to-many ──> BOOKINGS (via tenant_id)
│   ├── 1-to-many ──> FAVORITES (via tenant_id)
│   ├── 1-to-many ──> PAYMENTS (via tenant_id)
│   ├── 1-to-many ──> INQUIRIES (via tenant_id)
│   └── 1-to-many ──> CONVERSATIONS (via tenant_id)
│
├── LANDLORD_PROFILE
│   ├── 1-to-many ──> LISTINGS (via landlord_id)
│   ├── 1-to-many ──> BOOKINGS (via landlord_id)
│   ├── 1-to-many ──> PAYMENTS (via landlord_id)
│   ├── 1-to-many ──> INQUIRIES (via landlord_id)
│   ├── 1-to-many ──> CONVERSATIONS (via landlord_id)
│   ├── 1-to-1 ──> SUBSCRIPTIONS (via landlord_id)
│   └── 1-to-many ──> ID_VERIFICATION (via landlord_id)
│
├── LISTINGS (owned by LANDLORD_PROFILE)
│   ├── 1-to-many ──> BOOKINGS (via listing_id)
│   ├── 1-to-many ──> FAVORITES (via listing_id)
│   ├── 1-to-many ──> PAYMENTS (via listing_id)
│   ├── 1-to-many ──> REVIEWS (via reviewed_item_id when type='listing')
│   ├── 1-to-many ──> CONVERSATIONS (via listing_id)
│   └── 1-to-many ──> INQUIRIES (via listing_id)
│
├── BOOKINGS (connects TENANT_PROFILE → LISTING → LANDLORD_PROFILE)
│   ├── 1-to-many ──> PAYMENTS (via booking_id)
│   ├── 1-to-many ──> REVIEWS (via booking_id for verification)
│   └── 1-to-many ──> CONVERSATIONS (via booking_id)
│
├── CONVERSATIONS (between TENANT_PROFILE & LANDLORD_PROFILE)
│   ├── Many-to-1 ──> MESSAGES (via conversation_id)
│   └── Links: landlord_id, tenant_id, listing_id, booking_id
│
├── MESSAGES (within CONVERSATION)
│   ├── Connects: sender_id ──> receiver_id
│   └── References: conversation_id
│
├── PAYMENTS (multi-way relationship)
│   ├── Many-to-1 ──> PAYMENT_METHODS (via payment_method_id)
│   ├── Many-to-1 ──> BOOKINGS (via booking_id)
│   └── 1-to-many ──> TRANSACTIONS_LOG (via payment_id)
│
├── PAYMENT_METHODS (per user - tenant or landlord)
│   └── Stores: multiple payment options per user_id
│
├── REVIEWS (polymorphic - can review listing, landlord, or tenant)
│   ├── reviewed_item_type in ('listing', 'landlord', 'tenant')
│   ├── reviewed_item_id = UUID of reviewed entity
│   └── Links back to: bookings for verification
│
└── SUPPORTING TABLES
    ├── NOTIFICATIONS - Event-driven alerts
    ├── INQUIRIES - Support tickets
    ├── DOCUMENTS - KYC/verification
    ├── FEEDBACK - User feedback
    ├── SEARCH_HISTORY - Analytics
    ├── TRANSACTIONS_LOG - Audit trail
    ├── ID_VERIFICATION - Landlord ID review images
    └── SUBSCRIPTIONS - Landlord plan tier

KEY DATA FLOWS:
1. BOOKING CREATION:
   USER (tenant) → TENANT_PROFILE → BOOKINGS
   └─> References: listing_id → LISTINGS → landlord_id → LANDLORD_PROFILE

2. PAYMENT FLOW:
   BOOKINGS → PAYMENTS ← PAYMENT_METHODS ← USERS
   └─> TRANSACTIONS_LOG (audit trail)

3. COMMUNICATION FLOW:
   USERS ←→ CONVERSATIONS ←→ MESSAGES
   └─> Filtered by: tenant_id, landlord_id, listing_id

4. REVIEW FLOW:
   BOOKINGS (completed) → REVIEWS
   └─> Covers: listing, landlord, or tenant

5. NOTIFICATIONS:
   Events → NOTIFICATIONS ← USERS
   └─> Linked to: booking, payment, message, review, etc.

6. LANDLORD ID VERIFICATION:
   LANDLORD_PROFILE → upload to id-verifications storage bucket → ID_VERIFICATION row
   └─> verified stays false until an admin (service role) approves it

MULTI-TENANCY ISOLATION (now enforced by Row Level Security above, not just
by the app trusting client-supplied ids):
- Tenants can only see: their own profile, listings, bookings, payments, conversations
- Landlords can only see: their own profile, bookings/payments for their properties, inquiries
- Shared resources (listings, reviews, landlord profiles) are visible to all but editable only by owner
- Messages/Conversations are isolated by (tenant_id, landlord_id) pairs
- Payments show to both parties (landlord receives, tenant pays)

KNOWN APP-CODE ISSUES NOT FIXABLE AT THE SCHEMA LEVEL (fix in lib/supabaseClient.js):
- createBooking() has a `.maybeno()` typo where `.maybeSingle()` was intended
- getLandlordRevenue() filters payments by `landlord_id = <users.id>` but
  payments.landlord_id actually references landlord_profile(id), not users(id)
- notifications' client-side `supportedTypes` whitelist omits
  'booking_cancelled' and 'booking_rejected', silently downgrading them to
  'system' even though both are valid per this schema's CHECK constraint
*/

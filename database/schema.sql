-- ============================================================================
-- COMPLETE BoardEase Database Schema for Supabase
-- Purpose: Boarding House Rental Management Platform
-- Features: Multi-tenant support, Payment tracking, Messaging, Reviews
-- Version: 2.0 - Supabase Optimized
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
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed', 'active')),
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
  payment_type VARCHAR(50) DEFAULT 'rent' CHECK (payment_type IN ('rent', 'deposit', 'utility', 'maintenance', 'other', 'advance')),
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

-- ============================================================================
-- 8. CONVERSATIONS TABLE - Chat conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlord_profile(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_profile(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  conversation_topic VARCHAR(50) DEFAULT 'general' CHECK (conversation_topic IN ('inquiry', 'booking', 'maintenance', 'payment', 'general')),
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
-- ENTITY RELATIONSHIP DIAGRAM & DOCUMENTATION
-- ============================================================================
/*
MULTI-USER DATA MODEL FOR SUPABASE:

CORE ENTITIES:
├── USERS (id, email, user_type='tenant'|'landlord')
│   ├── 1-to-1 ──> TENANT_PROFILE (via user_id) - for tenants
│   ├── 1-to-1 ──> LANDLORD_PROFILE (via user_id) - for landlords
│   ├── 1-to-many ──> DOCUMENTS (via user_id)
│   ├── 1-to-many ──> NOTIFICATIONS (via user_id)
│   ├── 1-to-many ──> MESSAGES (sender_id / receiver_id)
│   ├── 1-to-many ──> FEEDBACK (via user_id)
│   ├── 1-to-many ──> SEARCH_HISTORY (via user_id)
│   ├── 1-to-many ──> PAYMENT_METHODS (via user_id)
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
│   └── 1-to-many ──> CONVERSATIONS (via landlord_id)
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
    └── TRANSACTIONS_LOG - Audit trail

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

MULTI-TENANCY ISOLATION:
- Every database operation filters by user context
- Tenants can only see: their own profile, listings, bookings, payments, conversations
- Landlords can only see: their own profile, listings, bookings (for their properties), inquiries
- Shared resources (listings) are visible to all but editable only by owner
- Messages/Conversations are isolated by (tenant_id, landlord_id) pairs
- Payments show to both parties (landlord receives, tenant pays)

SUPABASE ROW-LEVEL SECURITY (RLS) STRATEGY:
- Users can read/write only their own records
- Tenant_profiles: users can read/write only their own
- Landlord_profiles: users can read/write only their own
- Listings: all can read, only landlord can write
- Bookings: tenant/landlord involved can read, appropriate user can write
- Payments: both parties can read, system/appropriate user writes
- Messages/Conversations: involved parties can read/write
- Reviews: user can read all, write only their own
*/



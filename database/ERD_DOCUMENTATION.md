# BoardEase Database Schema - Entity Relationship Diagram & Documentation

## 📊 System Overview

**BoardEase** is a multi-tenant boarding house rental platform designed for Supabase with complete support for:
- Multiple independent users (Tenants & Landlords)
- Property listings and management
- Booking and reservation system
- Payment processing and tracking
- Real-time messaging
- Review and rating system
- Notification management

---

## 🏗️ Core Tables & Relationships

### 1. **USERS** (Authentication Layer)
The central identity table for all system users.

```
USERS (UUID)
├── email (UNIQUE)
├── phone (UNIQUE)
├── user_type (tenant | landlord)
├── first_name, last_name
├── profile_image_url
├── verified (BOOLEAN)
├── is_active (BOOLEAN)
└── Timestamps
```

**One User can be:**
- One TENANT_PROFILE (if user_type = 'tenant')
- One LANDLORD_PROFILE (if user_type = 'landlord')

---

### 2. **TENANT_PROFILE** (1-to-1 with USERS)
Tenant-specific extended information.

```
TENANT_PROFILE (UUID)
├── user_id (FK → USERS, UNIQUE)
├── occupation, company_name
├── id_type, id_number (for verification)
├── date_of_birth, gender
├── budget_min, budget_max
├── preferences (TEXT)
├── emergency_contact_*
├── rating, total_reviews, total_bookings
└── Timestamps
```

**Relationships (1-to-many):**
- BOOKINGS (tenant makes bookings)
- FAVORITES (tenant saves favorite listings)
- PAYMENTS (tenant receives payment invoices)
- CONVERSATIONS (tenant communicates with landlords)
- INQUIRIES (tenant makes inquiries)

---

### 3. **LANDLORD_PROFILE** (1-to-1 with USERS)
Landlord-specific extended information.

```
LANDLORD_PROFILE (UUID)
├── user_id (FK → USERS, UNIQUE)
├── company_name
├── years_experience
├── total_properties, total_active_bookings
├── response_rate, response_time_avg_hours
├── rating, total_reviews
├── verification_document_url
├── tax_id (UNIQUE)
├── bank_account_verified
├── business_permit_url
└── Timestamps
```

**Relationships (1-to-many):**
- LISTINGS (landlord owns properties)
- BOOKINGS (landlord receives bookings)
- PAYMENTS (landlord receives payments)
- CONVERSATIONS (landlord communicates with tenants)
- INQUIRIES (landlord receives inquiries)

---

### 4. **LISTINGS** (Property Catalog)
Core business entity representing boarding houses/rooms.

```
LISTINGS (UUID)
├── landlord_id (FK → LANDLORD_PROFILE)
├── title, description
├── property_type (boarding_house | apartment | room | dormitory)
├── room_type (single_room | shared_room | studio | suite | bed_space)
├── address, city, postal_code
├── latitude, longitude (for mapping)
├── max_guests, price_per_month
├── amenities (JSONB array)
├── images (JSONB array)
├── floor_plans (JSONB array)
├── virtual_tour_url
├── rules_regulations (JSONB array)
├── available, total_rooms, available_rooms
├── rating, total_reviews, total_views, favorite_count
├── is_featured, featured_until
└── Timestamps
```

**Relationships:**
- One LANDLORD owns many LISTINGS (1-to-many)
- One LISTING has many BOOKINGS (1-to-many)
- One LISTING has many FAVORITES (1-to-many)
- One LISTING has many REVIEWS (1-to-many, where reviewed_item_type='listing')
- One LISTING has many PAYMENTS (1-to-many)

---

### 5. **BOOKINGS** (Reservations)
Central transaction table connecting Tenants → Listings → Landlords.

```
BOOKINGS (UUID)
├── listing_id (FK → LISTINGS)
├── tenant_id (FK → TENANT_PROFILE)
├── landlord_id (FK → LANDLORD_PROFILE)
├── booking_date, move_in_date, move_out_date
├── status (pending | approved | rejected | cancelled | completed | active)
├── duration_months, number_of_guests
├── special_requests, landlord_notes, tenant_notes
├── booking_reason (urgent | student | work | family | other)
├── total_amount, deposit_amount, discount_amount
├── is_review_pending
└── Timestamps
```

**Key Relationships:**
- BOOKING connects TENANT_PROFILE → LISTINGS → LANDLORD_PROFILE
- One BOOKING can generate many PAYMENTS (rent, utilities, maintenance)
- One BOOKING can have one or more REVIEWS (after completion)
- One BOOKING can link to a CONVERSATION

---

### 6. **PAYMENT_METHODS** (User Payment Options)
Stores saved payment methods per user.

```
PAYMENT_METHODS (UUID)
├── user_id (FK → USERS)
├── payment_method_type (credit_card | debit_card | bank_account | gcash | paymaya | paypal | cash)
├── is_primary (BOOLEAN)
├── is_active (BOOLEAN)
├── card_holder_name, card_last_four, card_expiry
├── bank_name, account_number
├── mobile_number, email_address
└── Timestamps
```

**Usage:** Referenced by PAYMENTS table when processing transactions.

---

### 7. **PAYMENTS** (Transaction Records)
Complete payment tracking for rent, deposits, utilities, etc.

```
PAYMENTS (UUID)
├── booking_id (FK → BOOKINGS, nullable)
├── landlord_id (FK → LANDLORD_PROFILE)
├── tenant_id (FK → TENANT_PROFILE)
├── listing_id (FK → LISTINGS)
├── payment_method_id (FK → PAYMENT_METHODS, nullable)
├── amount, payment_type (rent | deposit | utility | maintenance | other | advance)
├── status (pending | completed | failed | refunded | partially_paid)
├── payment_method (bank_transfer | credit_card | debit_card | mobile_wallet | cash | check)
├── transaction_id (UNIQUE)
├── reference_number
├── due_date, paid_date
├── recorded_by_landlord (BOOLEAN)
├── notes, attachment_url
└── Timestamps
```

**Relationships:**
- One PAYMENT may belong to a BOOKING
- One PAYMENT creates many TRANSACTIONS_LOG entries (audit trail)

---

### 8. **CONVERSATIONS** (Communication Channels)
Thread for tenant-landlord communication around specific listings/bookings.

```
CONVERSATIONS (UUID)
├── landlord_id (FK → LANDLORD_PROFILE)
├── tenant_id (FK → TENANT_PROFILE)
├── listing_id (FK → LISTINGS, nullable)
├── booking_id (FK → BOOKINGS, nullable)
├── conversation_topic (inquiry | booking | maintenance | payment | general)
├── last_message (TEXT)
├── last_message_sender_id (UUID)
├── last_message_time
├── unread_count_tenant, unread_count_landlord
├── is_active
└── Timestamps
```

**Key Point:** Each conversation is unique per (landlord_id, tenant_id, listing_id) combination.

---

### 9. **MESSAGES** (Chat Messages)
Individual messages within a conversation.

```
MESSAGES (UUID)
├── conversation_id (FK → CONVERSATIONS)
├── sender_id (FK → USERS)
├── receiver_id (FK → USERS)
├── sender_type (tenant | landlord)
├── message_text (TEXT)
├── message_type (text | image | document | inquiry | booking | payment_reminder)
├── media_url (for images/documents)
├── is_read (BOOLEAN)
├── read_at
└── created_at
```

**Flow:** USERS sends MESSAGES within CONVERSATIONS

---

### 10. **REVIEWS** (Ratings & Feedback)
Polymorphic review system for listings, landlords, and tenants.

```
REVIEWS (UUID)
├── reviewed_item_type (listing | landlord | tenant)
├── reviewed_item_id (UUID of reviewed entity)
├── reviewer_id (FK → USERS)
├── booking_id (FK → BOOKINGS, for verification)
├── rating (1-5, INT)
├── title, review_text
├── cleanliness, communication, amenities, location, value_for_money (1-5 each)
├── helpful_count
├── images (JSONB array)
├── reviewer_name
├── is_verified_booking (BOOLEAN - from booking verification)
└── Timestamps
```

**Use Cases:**
- Tenant reviews LISTING (reviewed_item_type='listing')
- Tenant reviews LANDLORD (reviewed_item_type='landlord')
- Landlord reviews TENANT (reviewed_item_type='tenant')

---

### 11. **FAVORITES** (Saved Listings)
Many-to-many relationship between tenants and listings.

```
FAVORITES (UUID)
├── tenant_id (FK → TENANT_PROFILE)
├── listing_id (FK → LISTINGS)
└── created_at
```

**Constraint:** UNIQUE(tenant_id, listing_id) - A tenant can favorite each listing only once.

---

### 12. **INQUIRIES** (Support Tickets)
Structured inquiry/support system.

```
INQUIRIES (UUID)
├── listing_id (FK → LISTINGS, nullable)
├── tenant_id (FK → TENANT_PROFILE, nullable)
├── landlord_id (FK → LANDLORD_PROFILE, nullable)
├── inquiry_type (availability | pricing | amenities | booking | support | complaint)
├── subject, message
├── status (open | in_progress | resolved | closed)
├── priority (low | medium | high | urgent)
├── response_count
├── resolved_at
└── Timestamps
```

---

### 13. **NOTIFICATIONS** (Event-Driven Alerts)
System notifications for users.

```
NOTIFICATIONS (UUID)
├── user_id (FK → USERS)
├── notification_type (booking_request | booking_approved | payment_due | message | review | system | listing_inquiry | payment_completed)
├── title, message
├── related_entity_type (optional entity context)
├── related_entity_id (optional entity ID)
├── is_read (BOOLEAN)
├── read_at
├── action_url (deeplink)
└── created_at
```

---

### 14. **SEARCH_HISTORY** (Analytics)
Track user search behavior.

```
SEARCH_HISTORY (UUID)
├── user_id (FK → USERS)
├── search_query
├── filters (JSONB)
├── results_count
└── timestamp
```

---

### 15. **TRANSACTIONS_LOG** (Audit Trail)
Complete financial transaction history for compliance.

```
TRANSACTIONS_LOG (UUID)
├── transaction_type (payment_in | payment_out | refund | deposit | withdrawal | fee)
├── user_id (FK → USERS)
├── amount, currency
├── status (pending | completed | failed | cancelled)
├── reference_id
├── payment_id (FK → PAYMENTS, nullable)
├── description
└── timestamp
```

---

### 16. **DOCUMENTS** (KYC Verification)
User document verification.

```
DOCUMENTS (UUID)
├── user_id (FK → USERS)
├── document_type (national_id | passport | drivers_license | business_permit | proof_of_address)
├── document_url
├── verification_status (pending | verified | rejected)
├── verified_by (FK → USERS, nullable - admin who verified)
├── verification_notes
├── expiration_date
└── Timestamps
```

---

### 17. **FEEDBACK** (Feature Requests & Bugs)
User feedback system.

```
FEEDBACK (UUID)
├── user_id (FK → USERS)
├── feedback_type (bug_report | feature_request | complaint | suggestion | other)
├── title, description
├── related_entity_type (optional context)
├── related_entity_id (optional entity)
├── attachment_url
├── status (open | in_review | in_progress | completed | closed)
├── priority (low | medium | high)
└── Timestamps
```

---

## 📈 Complete Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌──────────────┐                    ┌──────────────────┐           │
│  │    USERS     │                    │ PAYMENT_METHODS  │           │
│  ├──────────────┤                    ├──────────────────┤           │
│  │ id (PK)      │                    │ id (PK)          │           │
│  │ email        │────────────────┬───│ user_id (FK)     │           │
│  │ phone        │                │   │ method_type      │           │
│  │ user_type    │                │   │ is_primary       │           │
│  │ first_name   │                │   └──────────────────┘           │
│  │ last_name    │                │                                  │
│  │ verified     │                │   ┌──────────────────┐           │
│  └──────────────┘                │   │  NOTIFICATIONS   │           │
│       │ 1                         └───│ user_id (FK)     │           │
│       │                               │ notification_... │           │
│       │ 1-to-1                        │ is_read          │           │
│       ├─────────────────┐             └──────────────────┘           │
│       │                 │                                            │
│       ▼                 ▼                                            │
│  ┌──────────────┐  ┌──────────────┐     ┌──────────────────┐       │
│  │ TENANT_      │  │ LANDLORD_    │     │ SEARCH_HISTORY   │       │
│  │ PROFILE      │  │ PROFILE      │     ├──────────────────┤       │
│  ├──────────────┤  ├──────────────┤     │ user_id (FK)     │       │
│  │ id (PK)      │  │ id (PK)      │     │ search_query     │       │
│  │ user_id (FK) │  │ user_id (FK) │     │ filters (JSONB)  │       │
│  │ budget_*     │  │ company_...  │     │ results_count    │       │
│  │ rating       │  │ rating       │     └──────────────────┘       │
│  └──────────────┘  └──────────────┘                                │
│       │                 │                                           │
│       │ 1                │ 1                                         │
│       │                  │                                          │
│       │ many             │ many        ┌──────────────────────┐    │
│       │                  │             │    LISTINGS          │    │
│       │                  │    ┌────────│ landlord_id (FK)     │    │
│       │                  │    │        │ title, address       │    │
│       │                  │    │        │ price_per_month      │    │
│       │                  │    │        │ amenities (JSONB)    │    │
│  ┌────▼────────────────┬─┴────▼─┐     │ images (JSONB)       │    │
│  │   BOOKINGS          │         │     │ rating               │    │
│  ├─────────────────────┤         │     └──────────────────────┘    │
│  │ id (PK)             │         │              │                 │
│  │ listing_id (FK)─────┼─────────┼──────────────┘                 │
│  │ tenant_id (FK)      │         │                                │
│  │ landlord_id (FK)    │         │              many              │
│  │ booking_date        │         │                │               │
│  │ move_in_date        │         │                │               │
│  │ status              │         │    ┌───────────┴──────────┐    │
│  │ total_amount        │         │    │                      │    │
│  └────────────┬────────┘         │    │                      │    │
│               │                  │    ▼                      ▼    │
│               │ many             │  ┌─────────────┐  ┌──────────┐│
│               │                  │  │  REVIEWS    │  │FAVORITES ││
│               │                  │  ├─────────────┤  ├──────────┤│
│               │                  │  │ reviewed... │  │ tenant_id││
│               │                  │  │ reviewed... │  │ listing_ ││
│               │                  │  │ reviewer_id │  │ id (FK)  ││
│               │                  │  │ rating      │  └──────────┘│
│               │                  │  └─────────────┘               │
│               │                  │                                │
│               ├──┐               │  ┌──────────────────┐         │
│               │  │               └──│   INQUIRIES      │         │
│               │  │                  ├──────────────────┤         │
│               │  │                  │ listing_id (FK)  │         │
│               │  │                  │ tenant_id (FK)   │         │
│               │  │                  │ landlord_id (FK) │         │
│               │  │                  │ inquiry_type     │         │
│               │  │                  │ status           │         │
│               │  │                  └──────────────────┘         │
│               │  │                                               │
│      ┌────────┴──┴──────────────────────────────────────────┐   │
│      │                                                       │   │
│      ▼                                                       ▼   │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  PAYMENTS    │  │ CONVERSATIONS    │  │  DOCUMENTS        │  │
│  ├──────────────┤  ├──────────────────┤  ├───────────────────┤  │
│  │ booking_id   │  │ landlord_id (FK) │  │ user_id (FK)      │  │
│  │ landlord_id  │  │ tenant_id (FK)   │  │ document_type     │  │
│  │ tenant_id    │  │ listing_id (FK)  │  │ document_url      │  │
│  │ listing_id   │  │ booking_id (FK)  │  │ verification_     │  │
│  │ amount       │  │ last_message     │  │ status            │  │
│  │ status       │  └────────┬─────────┘  └───────────────────┘  │
│  └────────┬─────┘           │                                    │
│           │ many            │ many                               │
│           │                 │                                    │
│  ┌────────▼─────────┐  ┌────▼───────────────┐                   │
│  │ TRANSACTIONS_LOG │  │    MESSAGES        │                   │
│  ├──────────────────┤  ├────────────────────┤                   │
│  │ payment_id (FK)  │  │ conversation_id    │                   │
│  │ user_id (FK)     │  │ sender_id (FK)     │                   │
│  │ transaction_type │  │ receiver_id (FK)   │                   │
│  │ amount           │  │ message_text       │                   │
│  │ status           │  │ is_read            │                   │
│  └──────────────────┘  └────────────────────┘                   │
│                                                                   │
│                      ┌────────────────┐                          │
│                      │    FEEDBACK    │                          │
│                      ├────────────────┤                          │
│                      │ user_id (FK)   │                          │
│                      │ feedback_type  │                          │
│                      │ status         │                          │
│                      │ priority       │                          │
│                      └────────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Key Data Flow Patterns

### 1. **Booking Creation Flow**
```
Tenant (USERS) 
  → TENANT_PROFILE 
    → BOOKINGS (creates)
      ← LISTINGS (references)
        ← LANDLORD_PROFILE
          ← USERS (Landlord)
```

### 2. **Payment Processing Flow**
```
Booking (BOOKINGS)
  → PAYMENTS (creates one or more)
    → PAYMENT_METHODS (uses)
      → TRANSACTIONS_LOG (logs)
```

### 3. **Communication Flow**
```
Tenant (USERS) ←→ CONVERSATIONS ←→ MESSAGES ←→ Landlord (USERS)
                     ↓
                  LISTINGS + BOOKINGS (context)
```

### 4. **Review & Rating Flow**
```
Booking (BOOKINGS) [completed status]
  → REVIEWS (can create)
    ├─ reviewed_item_type = 'listing' → Tenant reviews Listing
    ├─ reviewed_item_type = 'landlord' → Tenant reviews Landlord
    └─ reviewed_item_type = 'tenant' → Landlord reviews Tenant
```

### 5. **Search & Discovery Flow**
```
Tenant (USERS)
  → SEARCH_HISTORY (logs)
  → LISTINGS (displays results)
    → FAVORITES (can save)
    → INQUIRIES (can create)
```

---

## 🔐 Multi-Tenancy & Data Isolation Strategy

### Row-Level Security (RLS) Implementation

**For USERS:**
```sql
-- Users can only read/write their own profile
user_id = auth.uid()
```

**For TENANT_PROFILE:**
```sql
-- Tenant can only access their own profile
user_id = auth.uid()
```

**For LANDLORD_PROFILE:**
```sql
-- Landlord can only access their own profile
user_id = auth.uid()
```

**For LISTINGS:**
```sql
-- All users can read
-- Only landlord can write (where landlord_id = auth.user_id())
```

**For BOOKINGS:**
```sql
-- Tenant can read bookings where tenant_id = auth.tenant_id()
-- Landlord can read bookings where landlord_id = auth.landlord_id()
-- Tenant can create, landlord can approve/reject
```

**For PAYMENTS:**
```sql
-- Tenant can read where tenant_id = auth.tenant_id()
-- Landlord can read where landlord_id = auth.landlord_id()
```

**For CONVERSATIONS & MESSAGES:**
```sql
-- Both parties can read/write where:
-- (sender_id = auth.uid() OR receiver_id = auth.uid())
```

---

## 📊 Indexing Strategy

### Primary Indexes (Performance Critical)
- `users(email)` - Login queries
- `users(phone)` - Phone verification
- `tenant_profile(user_id)` - Profile lookups
- `landlord_profile(user_id)` - Profile lookups
- `listings(landlord_id, available)` - Listing queries
- `listings(city, price_per_month)` - Search queries
- `bookings(tenant_id, status)` - Tenant bookings
- `bookings(landlord_id, status)` - Landlord bookings
- `payments(tenant_id, status, due_date)` - Payment tracking
- `conversations(tenant_id, landlord_id)` - Chat lookups
- `messages(conversation_id, is_read)` - Message queries
- `notifications(user_id, is_read)` - Notification queries

### Secondary Indexes (Search & Analytics)
- `listings(city)` - City search
- `listings(price_per_month)` - Price filtering
- `listings(rating, created_at)` - Popular listings
- `reviews(reviewed_item_type, reviewed_item_id)` - Review aggregation
- `transactions_log(user_id, timestamp)` - Audit trails

---

## 💾 Data Retention & Cleanup

| Table | Retention Policy |
|-------|-------------------|
| USERS | Indefinite (archived on deletion) |
| BOOKINGS | Indefinite (for history) |
| PAYMENTS | Indefinite (audit trail) |
| MESSAGES | Indefinite (or 2-3 years policy) |
| NOTIFICATIONS | 90 days (auto-delete read) |
| SEARCH_HISTORY | 1 year (analytics) |
| TRANSACTIONS_LOG | 7 years (compliance) |
| FEEDBACK | Until resolved |

---

## 🛡️ Constraints & Validation

### Unique Constraints
- `users(email)` - No duplicate emails
- `users(phone)` - No duplicate phones
- `tenant_profile(user_id)` - One profile per tenant
- `tenant_profile(id_number)` - No duplicate IDs
- `landlord_profile(user_id)` - One profile per landlord
- `landlord_profile(tax_id)` - No duplicate tax IDs
- `favorites(tenant_id, listing_id)` - No duplicate favorites
- `payment_methods(user_id, card_last_four)` - Optional duplicate prevention

### Check Constraints
- `users(user_type)` - IN ('tenant', 'landlord')
- `listings(price_per_month)` > 0
- `bookings(number_of_guests)` > 0
- `reviews(rating)` BETWEEN 1 AND 5
- `payments(amount)` > 0

---

## 📝 Sample Queries

### Get All Bookings for a Tenant
```sql
SELECT b.*, l.title, l.price_per_month
FROM bookings b
JOIN listings l ON b.listing_id = l.id
WHERE b.tenant_id = $1
ORDER BY b.created_at DESC;
```

### Get Landlord's Monthly Revenue
```sql
SELECT 
  DATE_TRUNC('month', p.paid_date) AS month,
  SUM(p.amount) AS revenue,
  COUNT(DISTINCT p.tenant_id) AS unique_tenants
FROM payments p
WHERE p.landlord_id = $1 AND p.status = 'completed'
GROUP BY DATE_TRUNC('month', p.paid_date)
ORDER BY month DESC;
```

### Get Active Conversations
```sql
SELECT c.*, 
  u.first_name, u.last_name,
  l.title,
  COUNT(m.id) FILTER (WHERE NOT m.is_read) AS unread_messages
FROM conversations c
JOIN landlord_profile lp ON c.landlord_id = lp.id
JOIN users u ON lp.user_id = u.id
JOIN listings l ON c.listing_id = l.id
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.tenant_id = $1 AND c.is_active = TRUE
GROUP BY c.id, u.id, l.id
ORDER BY c.updated_at DESC;
```

### Get Top Rated Listings
```sql
SELECT l.*, 
  COUNT(r.id) AS review_count,
  AVG(r.rating) AS avg_rating
FROM listings l
LEFT JOIN reviews r ON l.id = r.reviewed_item_id 
  AND r.reviewed_item_type = 'listing'
WHERE l.available = TRUE
GROUP BY l.id
HAVING AVG(r.rating) >= 4.0
ORDER BY avg_rating DESC, review_count DESC;
```

---

## 🚀 Implementation Notes for Supabase

### Enable RLS on All Tables
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_profile ENABLE ROW LEVEL SECURITY;
-- ... for all other tables
```

### Create Storage Buckets
- `profile-images` - User profile photos
- `listing-images` - Property photos
- `floor-plans` - Property floor plans
- `documents` - Verification documents
- `attachments` - Message/Feedback attachments

### Set Up Triggers
- Auto-update `updated_at` timestamps
- Aggregate ratings to profiles after review creation
- Update listing view counts
- Update unread message counts in conversations

### Real-time Subscriptions
```javascript
// Example: Listen for new messages
supabase
  .from('messages')
  .on('INSERT', payload => {
    // Handle new message
  })
  .subscribe();
```

---

## 📋 Version History

- **v1.0** - Initial schema with basic entities
- **v2.0** - Supabase optimization, UUID PKs, JSONB for flexible data, improved relationships
- **Current** - Complete multi-tenant support, comprehensive documentation

---

## 📧 Support & Questions

For schema-related questions or optimization suggestions, please refer to the main database documentation or contact the development team.

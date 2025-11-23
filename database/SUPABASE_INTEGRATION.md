# BoardEase Supabase Integration Guide

## 🚀 Quick Start Implementation

### 1. Create Supabase Project
```bash
# Install Supabase CLI
npm install -g supabase

# Create new project
supabase projects create boardease

# Link project
supabase link --project-id <project-id>
```

### 2. Deploy Schema
```bash
# Copy schema.sql to migrations folder
cp database/schema.sql supabase/migrations/001_initial_schema.sql

# Deploy to Supabase
supabase db push
```

### 3. Initialize React Native App
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseKey = 'your-anon-key'
export const supabase = createClient(supabaseUrl, supabaseKey)
```

---

## 📱 Integration Examples

### User Registration (Tenant)

```javascript
// 1. Create user in auth
const { data, error } = await supabase.auth.signUp({
  email: 'tenant@example.com',
  password: 'securePassword123',
})

// 2. Create tenant profile
if (!error) {
  const { error: profileError } = await supabase
    .from('users')
    .insert([
      {
        id: data.user.id,
        email: data.user.email,
        phone: '+1234567890',
        user_type: 'tenant',
        first_name: 'John',
        last_name: 'Doe',
      },
    ])

  // 3. Create tenant extended profile
  const { error: tenantError } = await supabase
    .from('tenant_profile')
    .insert([
      {
        user_id: data.user.id,
        budget_min: 2000,
        budget_max: 5000,
        preferences: 'Quiet area with WiFi',
      },
    ])
}
```

### User Registration (Landlord)

```javascript
// 1. Create user in auth
const { data, error } = await supabase.auth.signUp({
  email: 'landlord@example.com',
  password: 'securePassword123',
})

// 2. Create landlord profile
if (!error) {
  const { error: profileError } = await supabase
    .from('users')
    .insert([
      {
        id: data.user.id,
        email: data.user.email,
        phone: '+0987654321',
        user_type: 'landlord',
        first_name: 'Jane',
        last_name: 'Smith',
      },
    ])

  // 3. Create landlord extended profile
  const { error: landlordError } = await supabase
    .from('landlord_profile')
    .insert([
      {
        user_id: data.user.id,
        company_name: 'Smith Properties',
        years_experience: 5,
        tax_id: 'TAX-123456',
      },
    ])
}
```

### Create Listing

```javascript
const { data, error } = await supabase
  .from('listings')
  .insert([
    {
      landlord_id: landlordProfileId,
      title: 'Cozy Studio in Downtown',
      description: 'Modern studio with WiFi and utilities included',
      property_type: 'apartment',
      room_type: 'studio',
      address: '123 Main Street',
      city: 'San Francisco',
      postal_code: '94102',
      latitude: 37.7749,
      longitude: -122.4194,
      price_per_month: 1500,
      amenities: ['WiFi', 'Furnished', 'Air Conditioning', 'Laundry'],
      images: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ],
      available: true,
      total_rooms: 1,
      available_rooms: 1,
    },
  ])
  .select()

return data[0]
```

### Create Booking

```javascript
const { data, error } = await supabase
  .from('bookings')
  .insert([
    {
      listing_id: listingId,
      tenant_id: tenantProfileId,
      landlord_id: landlordProfileId,
      move_in_date: new Date('2025-02-01'),
      status: 'pending',
      duration_months: 6,
      number_of_guests: 1,
      special_requests: 'Early check-in if possible',
      total_amount: 9000, // 6 months × 1500
      deposit_amount: 1500,
    },
  ])
  .select()

return data[0]
```

### Record Payment

```javascript
const { data, error } = await supabase
  .from('payments')
  .insert([
    {
      booking_id: bookingId,
      landlord_id: landlordProfileId,
      tenant_id: tenantProfileId,
      listing_id: listingId,
      amount: 1500,
      payment_type: 'rent',
      status: 'completed',
      payment_method: 'bank_transfer',
      transaction_id: 'TXN-' + Date.now(),
      due_date: new Date('2025-03-01'),
      paid_date: new Date(),
    },
  ])
  .select()

// Log transaction
await supabase
  .from('transactions_log')
  .insert([
    {
      transaction_type: 'payment_in',
      user_id: tenantProfileId,
      amount: 1500,
      status: 'completed',
      payment_id: data[0].id,
      description: 'February rent payment',
    },
  ])
```

### Start Conversation

```javascript
// Get or create conversation
const { data: existingConv } = await supabase
  .from('conversations')
  .select()
  .eq('tenant_id', tenantProfileId)
  .eq('landlord_id', landlordProfileId)
  .eq('listing_id', listingId)
  .single()

let conversationId = existingConv?.id

if (!existingConv) {
  const { data: newConv } = await supabase
    .from('conversations')
    .insert([
      {
        tenant_id: tenantProfileId,
        landlord_id: landlordProfileId,
        listing_id: listingId,
        conversation_topic: 'booking',
      },
    ])
    .select()
    .single()

  conversationId = newConv.id
}

// Send message
const { data, error } = await supabase
  .from('messages')
  .insert([
    {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      sender_type: 'tenant',
      message_text: 'Hi! I am interested in this property.',
      message_type: 'text',
    },
  ])
  .select()
```

### Add to Favorites

```javascript
const { data, error } = await supabase
  .from('favorites')
  .insert([
    {
      tenant_id: tenantProfileId,
      listing_id: listingId,
    },
  ])
  .select()
```

### Create Review

```javascript
const { data, error } = await supabase
  .from('reviews')
  .insert([
    {
      reviewed_item_type: 'listing',
      reviewed_item_id: listingId,
      reviewer_id: userId,
      booking_id: bookingId,
      rating: 5,
      title: 'Excellent property!',
      review_text: 'Clean, modern, and very responsive landlord.',
      cleanliness: 5,
      communication: 5,
      amenities: 4,
      location: 5,
      value_for_money: 4,
      is_verified_booking: true,
    },
  ])
  .select()
```

### Set Up Notifications

```javascript
// When payment is due
const { error } = await supabase
  .from('notifications')
  .insert([
    {
      user_id: tenantId,
      notification_type: 'payment_due',
      title: 'Payment Due Tomorrow',
      message: 'Your rent for March is due tomorrow: ₱1,500',
      related_entity_type: 'payment',
      related_entity_id: paymentId,
      action_url: '/payments/details/' + paymentId,
    },
  ])

// When booking is approved
const { error: approvalError } = await supabase
  .from('notifications')
  .insert([
    {
      user_id: tenantId,
      notification_type: 'booking_approved',
      title: 'Booking Approved!',
      message: 'Your booking has been approved. Move-in date: Feb 1, 2025',
      related_entity_type: 'booking',
      related_entity_id: bookingId,
      action_url: '/bookings/' + bookingId,
    },
  ])
```

---

## 🔐 Row-Level Security (RLS) Policies

### Enable RLS on All Tables
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
```

### Users Can Read Their Own Profile
```sql
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

### Tenants Can Access Their Profile
```sql
CREATE POLICY "Tenants can read own profile"
  ON tenant_profile FOR SELECT
  USING (auth.uid() = (
    SELECT user_id FROM users WHERE id = auth.uid()
  ));
```

### Listings Are Public (Readable)
```sql
CREATE POLICY "Listings are public"
  ON listings FOR SELECT
  USING (true);

CREATE POLICY "Landlords can create listings"
  ON listings FOR INSERT
  WITH CHECK (
    landlord_id = (
      SELECT id FROM landlord_profile 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can update own listings"
  ON listings FOR UPDATE
  USING (
    landlord_id = (
      SELECT id FROM landlord_profile 
      WHERE user_id = auth.uid()
    )
  );
```

### Bookings - Both Parties Can Read
```sql
CREATE POLICY "Tenants can read own bookings"
  ON bookings FOR SELECT
  USING (
    tenant_id = (
      SELECT id FROM tenant_profile 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can read own bookings"
  ON bookings FOR SELECT
  USING (
    landlord_id = (
      SELECT id FROM landlord_profile 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    tenant_id = (
      SELECT id FROM tenant_profile 
      WHERE user_id = auth.uid()
    )
  );
```

### Payments - Both Parties Can Read
```sql
CREATE POLICY "Tenants can read own payments"
  ON payments FOR SELECT
  USING (
    tenant_id = (
      SELECT id FROM tenant_profile 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can read own payments"
  ON payments FOR SELECT
  USING (
    landlord_id = (
      SELECT id FROM landlord_profile 
      WHERE user_id = auth.uid()
    )
  );
```

### Messages - Both Parties Can Read/Write
```sql
CREATE POLICY "Users can read messages in their conversations"
  ON messages FOR SELECT
  USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
```

---

## 🎣 Real-time Subscriptions

### Listen for New Messages
```javascript
const subscription = supabase
  .from('messages')
  .on('INSERT', payload => {
    console.log('New message:', payload.new)
    // Update UI with new message
  })
  .subscribe()

// Cleanup
return () => {
  supabase.removeSubscription(subscription)
}
```

### Listen for Booking Updates
```javascript
const subscription = supabase
  .from('bookings')
  .on('UPDATE', payload => {
    console.log('Booking updated:', payload.new)
    if (payload.new.status === 'approved') {
      // Show notification to tenant
    }
  })
  .subscribe()
```

### Listen for New Notifications
```javascript
const subscription = supabase
  .from('notifications')
  .on('INSERT', payload => {
    if (payload.new.user_id === currentUserId) {
      // Show toast notification
      showNotification(payload.new.title, payload.new.message)
    }
  })
  .subscribe()
```

---

## 🗂️ Storage Buckets Setup

### Create Buckets
```javascript
// Create public bucket for profile images
const { data, error } = await supabase
  .storage
  .createBucket('profile-images', {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    fileSizeLimit: 5242880, // 5MB
  })

// Create private bucket for documents
const { data, error } = await supabase
  .storage
  .createBucket('documents', {
    public: false,
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    fileSizeLimit: 10485760, // 10MB
  })
```

### Upload Profile Image
```javascript
const { data, error } = await supabase
  .storage
  .from('profile-images')
  .upload(`${userId}/profile.jpg`, file)

const { data: publicUrl } = supabase
  .storage
  .from('profile-images')
  .getPublicUrl(`${userId}/profile.jpg`)

// Save URL to user profile
await supabase
  .from('users')
  .update({ profile_image_url: publicUrl.publicUrl })
  .eq('id', userId)
```

### Upload Listing Images
```javascript
const uploadedImages = []

for (let i = 0; i < imageFiles.length; i++) {
  const { data, error } = await supabase
    .storage
    .from('listing-images')
    .upload(`${listingId}/image-${i}.jpg`, imageFiles[i])

  const { data: publicUrl } = supabase
    .storage
    .from('listing-images')
    .getPublicUrl(`${listingId}/image-${i}.jpg`)

  uploadedImages.push(publicUrl.publicUrl)
}

// Save to listing
await supabase
  .from('listings')
  .update({ images: uploadedImages })
  .eq('id', listingId)
```

---

## 📊 Useful Queries

### Get Tenant Dashboard
```javascript
const getTenantDashboard = async (userId) => {
  // Get tenant profile
  const { data: tenantProfile } = await supabase
    .from('tenant_profile')
    .select(
      `
      *,
      bookings (
        id,
        listing_id,
        status,
        move_in_date,
        move_out_date,
        total_amount,
        listings (
          id,
          title,
          images
        )
      )
    `,
    )
    .eq('user_id', userId)
    .single()

  // Get upcoming payments
  const { data: upcomingPayments } = await supabase
    .from('payments')
    .select(
      `
      id,
      amount,
      payment_type,
      due_date,
      status,
      listings (title)
    `,
    )
    .eq('tenant_id', tenantProfile.id)
    .lt('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    .gt('due_date', new Date())

  // Get favorite listings count
  const { count: favoritesCount } = await supabase
    .from('favorites')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantProfile.id)

  return {
    tenantProfile,
    upcomingPayments,
    favoritesCount,
  }
}
```

### Get Landlord Dashboard
```javascript
const getLandlordDashboard = async (userId) => {
  // Get landlord profile
  const { data: landlordProfile } = await supabase
    .from('landlord_profile')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Get active bookings
  const { data: activeBookings, count } = await supabase
    .from('bookings')
    .select(
      `
      *,
      listings (title, price_per_month),
      tenant_profile (
        id,
        user_id,
        users (first_name, last_name, email)
      )
    `,
      { count: 'exact' },
    )
    .eq('landlord_id', landlordProfile.id)
    .in('status', ['approved', 'active'])

  // Get pending payments
  const { data: pendingPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('landlord_id', landlordProfile.id)
    .eq('status', 'pending')

  const totalPending = pendingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

  return {
    landlordProfile,
    activeBookings,
    activeBookingsCount: count,
    totalPending,
  }
}
```

### Search Listings
```javascript
const searchListings = async (filters) => {
  let query = supabase.from('listings').select('*').eq('available', true)

  if (filters.city) {
    query = query.eq('city', filters.city)
  }

  if (filters.minPrice && filters.maxPrice) {
    query = query
      .gte('price_per_month', filters.minPrice)
      .lte('price_per_month', filters.maxPrice)
  }

  if (filters.roomType) {
    query = query.eq('room_type', filters.roomType)
  }

  if (filters.amenities && filters.amenities.length > 0) {
    query = query.contains('amenities', filters.amenities)
  }

  const { data, error } = await query.order('rating', { ascending: false })

  return data
}
```

---

## 🚨 Error Handling

```javascript
const handleSupabaseError = (error) => {
  if (!error) return

  // Authentication errors
  if (error.status === 401) {
    // Handle unauthorized
    redirectToLogin()
  }

  // Permission errors
  if (error.status === 403) {
    // Handle forbidden
    showError('You do not have permission to access this resource')
  }

  // Not found errors
  if (error.status === 404) {
    showError('Resource not found')
  }

  // Duplicate key errors
  if (error.code === '23505') {
    showError('This record already exists')
  }

  // Foreign key errors
  if (error.code === '23503') {
    showError('Cannot delete this record as it is referenced elsewhere')
  }

  // Validation errors
  if (error.status === 422) {
    showError('Validation failed: ' + error.message)
  }

  console.error('Supabase error:', error)
}
```

---

## 📚 Best Practices

### 1. Always Use Transactions
```javascript
const { error } = await supabase.rpc('create_booking_with_payment', {
  listing_id: listingId,
  tenant_id: tenantId,
  landlord_id: landlordId,
  amount: totalAmount,
})
```

### 2. Implement Caching
```javascript
const [bookings, setBookings] = useState(null)
const [loading, setLoading] = useState(false)

useEffect(() => {
  if (bookings) return // Use cache

  fetchBookings()
}, [])

const fetchBookings = async () => {
  setLoading(true)
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId)

  setBookings(data)
  setLoading(false)
}
```

### 3. Use Indexes Effectively
- Always filter by indexed columns first
- Combine multiple filters efficiently
- Use order by on indexed columns

### 4. Handle Real-time Updates Gracefully
- Debounce subscription callbacks
- Avoid full page re-renders
- Update only affected components

### 5. Security
- Never expose sensitive data in client-side queries
- Use RLS policies for all tables
- Validate all user inputs
- Store secrets in environment variables

---

## 🔧 Maintenance

### Regular Tasks
1. Monitor database performance
2. Check RLS policies are properly configured
3. Backup data regularly
4. Review user access logs
5. Clean up old notifications/search history
6. Update aggregated columns (ratings, counts)

### Database Cleanup Query
```sql
-- Archive old notifications (keep for 90 days)
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '90 days' 
AND is_read = TRUE;

-- Archive old search history (keep for 1 year)
DELETE FROM search_history 
WHERE timestamp < NOW() - INTERVAL '1 year';
```

---

## 📞 Support

For issues or questions related to Supabase integration:
1. Check Supabase documentation: https://supabase.com/docs
2. Review error codes: https://supabase.com/docs/guides/api
3. Contact Supabase support: support@supabase.io

/**
 * Supabase Client Configuration and Utilities
 * Purpose: Centralized database connection and helper functions
 * Tables Used: users, tenant_profile, landlord_profile, listings, bookings, payments, 
 *              conversations, messages, notifications, favorites, reviews, inquiries, documents
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Add to .env.local:')
  console.error('EXPO_PUBLIC_SUPABASE_URL=your-url')
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// ============================================================================
// AUTH OPERATIONS
// ============================================================================

/**
 * Tenant Sign Up
 * Creates user in auth + users table + tenant_profile table
 */
export const tenantSignUp = async (signupData) => {
  try {
    const { email, password, firstName, lastName, phone } = signupData;

    // 1. Sign up in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) throw authError

    const userId = authData.user.id

    // 2. Create users table record
    const { error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          email,
          phone,
          user_type: 'tenant',
          first_name: firstName,
          last_name: lastName,
        },
      ])

    if (userError) throw userError

    // 3. Create tenant_profile record
    const { error: profileError } = await supabase
      .from('tenant_profile')
      .insert([{ user_id: userId }])

    if (profileError) throw profileError

    return { success: true, user: authData.user, error: null }
  } catch (error) {
    console.error('Tenant signup error:', error)
    return { success: false, user: null, error: error.message }
  }
}

/**
 * Landlord Sign Up
 * Creates user in auth + users table + landlord_profile table
 */
export const landlordSignUp = async (signupData) => {
  try {
    const { email, password, firstName, lastName, phone, companyName, yearsExperience } = signupData

    // 1. Sign up in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) throw authError

    const userId = authData.user.id

    // 2. Create users table record
    const { error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          email,
          phone,
          user_type: 'landlord',
          first_name: firstName,
          last_name: lastName,
        },
      ])

    if (userError) throw userError

    // 3. Create landlord_profile record
    const { error: profileError } = await supabase
      .from('landlord_profile')
      .insert([
        {
          user_id: userId,
          company_name: companyName,
          years_experience: yearsExperience || 0,
        },
      ])

    if (profileError) throw profileError

    return { success: true, user: authData.user, error: null }
  } catch (error) {
    console.error('Landlord signup error:', error)
    return { success: false, user: null, error: error.message }
  }
}

/**
 * Sign In
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // Fetch user_type from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', data.user.id)
      .single()

    if (userError) throw userError

    // Combine auth user with user_type from database
    const userWithType = {
      ...data.user,
      user_type: userData.user_type
    }

    return { success: true, user: userWithType, data: { user: userWithType }, error: null }
  } catch (error) {
    console.error('Sign in error:', error)
    return { success: false, user: null, error: error.message }
  }
}

/**
 * Get Current User
 */
export const getCurrentUser = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) throw error
    
    if (!session || !session.user) {
      return null
    }
    
    return session.user
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}

/**
 * Get Full User Profile with Image
 * Fetches user data including profile image from users table
 */
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_image_url, email')
      .eq('id', userId)
      .single()

    if (error) throw error
    return { success: true, user: data, error: null }
  } catch (error) {
    console.error('Get user profile error:', error)
    return { success: false, user: null, error: error.message }
  }
}

/**
 * Sign Out
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error('Sign out error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// TENANT PROFILE OPERATIONS
// ============================================================================

/**
 * Get Tenant Profile
 * Fetches: users table + tenant_profile table
 */
export const getTenantProfile = async (userId) => {
  try {
    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    // Get tenant profile
    const { data: profile, error: profileError } = await supabase
      .from('tenant_profile')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (profileError && profileError.code !== 'PGRST116') throw profileError

    return {
      success: true,
      user,
      profile: profile || {},
      error: null,
    }
  } catch (error) {
    console.error('Get tenant profile error:', error)
    return { success: false, user: null, profile: null, error: error.message }
  }
}

/**
 * Update Tenant Profile
 * Updates: users table + tenant_profile table
 */
export const updateTenantProfile = async (userId, updates) => {
  try {
    const { userUpdates, profileUpdates } = updates

    // Update users table
    if (userUpdates && Object.keys(userUpdates).length > 0) {
      const { error: userError } = await supabase
        .from('users')
        .update({
          ...userUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (userError) throw userError
    }

    // Update tenant_profile table
    if (profileUpdates && Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from('tenant_profile')
        .update({
          ...profileUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (profileError) throw profileError
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Update tenant profile error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// LISTINGS OPERATIONS
// ============================================================================

/**
 * Get All Listings
 * Fetches from: listings table + landlord_profile table + users table
 * Filters: available = true, ordered by rating
 */
export const getListings = async (filters = {}) => {
  try {
    let query = supabase
      .from('listings')
      .select(`
        *,
        landlord_profile (
          id,
          company_name,
          rating,
          total_reviews,
          user_id,
          users (
            id,
            first_name,
            last_name,
            profile_image_url
          )
        )
      `)
      .eq('available', true)
      .order('rating', { ascending: false })

    // Apply filters
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

    if (filters.minRating) {
      query = query.gte('rating', filters.minRating)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, listings: data || [], error: null }
  } catch (error) {
    console.error('Get listings error:', error)
    return { success: false, listings: [], error: error.message }
  }
}

/**
 * Get Single Listing
 * Fetches from: listings table + landlord_profile table + reviews table
 */
export const getListing = async (listingId) => {
  try {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        *,
        landlord_profile (
          id,
          company_name,
          years_experience,
          rating,
          total_reviews,
          response_rate,
          bank_account_verified,
          user_id,
          users (
            id,
            first_name,
            last_name,
            profile_image_url,
            bio
          )
        )
      `)
      .eq('id', listingId)
      .single()

    if (listingError) throw listingError

    // Get reviews for this listing
    const { data: reviews, error: reviewError } = await supabase
      .from('reviews')
      .select(`
        *,
        users (first_name, last_name, profile_image_url)
      `)
      .eq('reviewed_item_type', 'listing')
      .eq('reviewed_item_id', listingId)
      .order('created_at', { ascending: false })

    if (reviewError && reviewError.code !== 'PGRST116') throw reviewError

    return {
      success: true,
      listing,
      reviews: reviews || [],
      error: null,
    }
  } catch (error) {
    console.error('Get listing error:', error)
    return { success: false, listing: null, reviews: [], error: error.message }
  }
}

/**
 * Increment Listing Views
 * Increments the total_views counter for a listing
 */
export const incrementListingViews = async (listingId) => {
  try {
    // Get current view count
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('total_views')
      .eq('id', listingId)
      .single()

    if (fetchError) throw fetchError

    const currentViews = listing?.total_views || 0
    const newViews = currentViews + 1

    // Update view count
    const { error: updateError } = await supabase
      .from('listings')
      .update({ total_views: newViews })
      .eq('id', listingId)

    if (updateError) throw updateError

    return { success: true, views: newViews, error: null }
  } catch (error) {
    console.error('Increment listing views error:', error)
    return { success: false, views: 0, error: error.message }
  }
}

// ============================================================================
// BOOKINGS OPERATIONS
// ============================================================================

/**
 * Get Tenant Bookings
 * Fetches from: bookings table + listings table + landlord_profile table
 */
export const getTenantBookings = async (tenantProfileId) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        listings (
          id,
          title,
          images,
          price_per_month,
          city,
          landlord_id,
          landlord_profile (
            id,
            company_name,
            user_id,
            users (
              id,
              first_name,
              last_name,
              profile_image_url
            )
          )
        )
      `)
      .eq('tenant_id', tenantProfileId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, bookings: data || [], error: null }
  } catch (error) {
    console.error('Get bookings error:', error)
    return { success: false, bookings: [], error: error.message }
  }
}

/**
 * Create Booking
 * Inserts into: bookings table
 * Creates: notification in notifications table
 */
export const createBooking = async (bookingData) => {
  try {
    // Accept both camelCase and snake_case keys from callers
    const {
      listingId,
      tenantId,
      landlordId,
      moveInDate,
      moveOutDate,
      numberOfGuests,
      specialRequests,
    } = bookingData || {}

    const _listingId = listingId || bookingData?.listing_id || null
    const _tenantId = tenantId || bookingData?.tenant_id || null
    // landlordId here is expected to be the landlord_profile id in the DB; allow landlord_profile_id or landlord_id
    const _landlordId = landlordId || bookingData?.landlord_profile_id || bookingData?.landlord_id || null
    const _moveInDate = moveInDate || bookingData?.move_in_date || null
    const _moveOutDate = moveOutDate || bookingData?.move_out_date || null
    const _numberOfGuests = numberOfGuests || bookingData?.number_of_guests || 1
    const _specialRequests = specialRequests || bookingData?.special_requests || ''
    const _status = bookingData?.status || bookingData?.booking_status || 'pending'
    const _totalAmount = bookingData?.totalAmount || bookingData?.total_amount || null

    // Validate and format move-in date
    let validMoveInDate = null;
    if (moveInDate) {
      // Check if it's a valid date string (ISO format: YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(moveInDate)) {
        // Verify it's a valid date
        const date = new Date(moveInDate);
        if (!isNaN(date.getTime())) {
          validMoveInDate = moveInDate;
        }
      }
    }

    // If no valid date provided, use today's date
    if (!validMoveInDate) {
      validMoveInDate = new Date().toISOString().split('T')[0];
    }

    // Get listing price and title
    const { data: listing } = await supabase
      .from('listings')
      .select('price_per_month, title')
      .eq('id', _listingId)
      .single()

    // Get tenant and landlord info
    const { data: tenantProfile } = await supabase
      .from('tenant_profile')
      .select('user_id')
      .eq('id', _tenantId)
      .single()

    const { data: tenantUser } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', tenantProfile?.user_id)
      .single()

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          listing_id: _listingId,
          tenant_id: _tenantId,
          landlord_id: _landlordId,
          move_in_date: validMoveInDate,
          move_out_date: _moveOutDate,
          status: _status,
          number_of_guests: _numberOfGuests,
          special_requests: _specialRequests,
          total_amount: _totalAmount !== null ? _totalAmount : (listing?.price_per_month || 0),
          booking_date: new Date().toISOString().split('T')[0],
        },
      ])
      .select()
      .single()

    if (bookingError) throw bookingError

    // Create notification for landlord
    const { data: landlordProfile } = await supabase
      .from('landlord_profile')
      .select('user_id')
      .eq('id', landlordId)
      .single()

    if (landlordProfile) {
      const tenantName = tenantUser ? `${tenantUser.first_name} ${tenantUser.last_name}` : 'A tenant'
      const listingTitle = listing?.title || 'your property'

      await createNotification({
        userId: landlordProfile.user_id,
        notificationType: 'booking_request',
        title: 'New Booking Request',
        message: `${tenantName} requested to book ${listingTitle} starting ${moveInDate}`,
        relatedEntityType: 'booking',
        relatedEntityId: booking.id,
        actionUrl: 'landlord',
      })
    }

    return { success: true, booking, error: null }
  } catch (error) {
    console.error('Create booking error:', error)
    return { success: false, booking: null, error: error.message }
  }
}

/**
 * Update Booking Status
 * Updates: bookings table
 */
export const updateBookingStatus = async (bookingId, status, cancelReason = null) => {
  try {
    // Fetch booking details to get landlord info
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        landlord_id,
        listing_id,
        tenant_id,
        tenant:tenant_id(user_id),
        listing:listing_id(title),
        landlord:landlord_id(user_id)
      `)
      .eq('id', bookingId)
      .single()

    if (fetchError) throw fetchError

    const { error } = await supabase
      .from('bookings')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (error) throw error

    // Create notification for landlord if booking is cancelled by tenant
    if (status === 'cancelled' && booking?.landlord?.user_id) {
      const listingTitle = booking.listing?.title || 'a listing';
      const message = cancelReason 
        ? `A tenant has cancelled their booking for ${listingTitle}. Reason: ${cancelReason}`
        : `A tenant has cancelled their booking for ${listingTitle}`;

      await createNotification({
        userId: booking.landlord.user_id,
        notificationType: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: message,
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
        actionUrl: '/landlord/inquiries',
      });
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Update booking status error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// PAYMENTS OPERATIONS
// ============================================================================

/**
 * Get Tenant Payments
 * Fetches from: payments table + bookings table + listings table
 */
export const getTenantPayments = async (tenantProfileId) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        bookings (
          id,
          listing_id,
          listings (
            id,
            title,
            price_per_month
          )
        )
      `)
      .eq('tenant_id', tenantProfileId)
      .order('due_date', { ascending: true })

    if (error) throw error

    return { success: true, payments: data || [], error: null }
  } catch (error) {
    console.error('Get payments error:', error)
    return { success: false, payments: [], error: error.message }
  }
}

/**
 * Record Payment
 * Updates: payments table
 * Inserts into: transactions_log table
 */
export const recordPayment = async (paymentId, amount, method, transactionRef) => {
  try {
    // Update payment
    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_date: new Date().toISOString(),
        payment_method: method,
        transaction_id: transactionRef,
      })
      .eq('id', paymentId)

    if (paymentError) throw paymentError

    // Log transaction
    const { data: payment } = await supabase
      .from('payments')
      .select('tenant_id, landlord_id')
      .eq('id', paymentId)
      .single()

    if (payment && payment.tenant_id) {
      // Ensure tenant_id is a string (it might be an object if a relationship is defined)
      const tenantId = typeof payment.tenant_id === 'string' ? payment.tenant_id : payment.tenant_id?.id;
      
      if (tenantId) {
        await supabase.from('transactions_log').insert([
          {
            transaction_type: 'payment_out',
            user_id: tenantId,
            amount,
            status: 'completed',
            payment_id: paymentId,
            description: `Payment via ${method}`,
          },
        ])
      }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Record payment error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// MESSAGING OPERATIONS
// ============================================================================

/**
 * Get Conversations
 * Fetches from: conversations table + landlord_profile table + messages table
 */
export const getConversations = async (tenantProfileId) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        landlord_profile (
          id,
          company_name,
          user_id,
          users (
            id,
            first_name,
            last_name,
            profile_image_url
          )
        ),
        listing:listing_id(id, title)
      `)
      .eq('tenant_id', tenantProfileId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return { success: true, conversations: data || [], error: null }
  } catch (error) {
    console.error('Get conversations error:', error)
    return { success: false, conversations: [], error: error.message }
  }
}

/**
 * Get Messages in Conversation
 * Fetches from: messages table + users table
 */
export const getMessages = async (conversationId) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, first_name, last_name, profile_image_url, email),
        receiver:receiver_id(id, first_name, last_name, profile_image_url, email),
        conversation:conversation_id(listing:listing_id(id, title))
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return { success: true, messages: data || [], error: null }
  } catch (error) {
    console.error('Get messages error:', error)
    return { success: false, messages: [], error: error.message }
  }
}

/**
 * Send Message
 * Inserts into: messages table
 * Updates: conversations table
 */
export const sendMessage = async (conversationId, senderId, messageText, imageUrl = null) => {
  try {
    // Validate inputs
    if (!conversationId || !senderId || !messageText) {
      return { success: false, error: 'Missing required parameters' }
    }

    // First, fetch the conversation to determine receiver
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        landlord_id,
        tenant_id,
        landlord:landlord_id(id, user_id),
        tenant:tenant_id(id, user_id)
      `)
      .eq('id', conversationId)
      .single()

    if (convError) {
      console.error('Conversation fetch error:', convError)
      return { success: false, error: 'Conversation not found' }
    }
    
    if (!conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    // Determine receiver based on sender
    const senderUserId = senderId;
    let receiverId = null;
    let senderType = null;

    // Get sender's user type
    const { data: senderUser, error: senderError } = await supabase
      .from('users')
      .select('id, user_type')
      .eq('id', senderId)
      .single()

    if (senderError || !senderUser) throw new Error('Sender user not found')

    senderType = senderUser.user_type;

    // Determine receiver based on sender type
    if (senderType === 'tenant') {
      // Sender is tenant, receiver is landlord
      receiverId = conversation.landlord?.user_id;
    } else if (senderType === 'landlord') {
      // Sender is landlord, receiver is tenant
      receiverId = conversation.tenant?.user_id;
    }

    if (!receiverId) throw new Error('Could not determine receiver for message')

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: receiverId,
          sender_type: senderType,
          message_text: messageText,
          media_url: imageUrl,
          message_type: imageUrl ? 'image' : 'text',
        },
      ])
      .select()
      .single()

    if (messageError) throw messageError

    // Update conversation with new message info
    let updateData = {
      last_message: messageText,
      last_message_sender_id: senderId,
      last_message_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If tenant sent message, increment landlord's unread count
    if (senderType === 'tenant') {
      updateData.unread_count_landlord = conversation.unread_count_landlord ? conversation.unread_count_landlord + 1 : 1;
    }
    // If landlord sent message, increment tenant's unread count
    else if (senderType === 'landlord') {
      updateData.unread_count_tenant = conversation.unread_count_tenant ? conversation.unread_count_tenant + 1 : 1;
    }

    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)

    // Create notification for receiver
    const { data: senderInfo } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', senderId)
      .single()

    const senderName = senderInfo ? `${senderInfo.first_name} ${senderInfo.last_name}` : 'Someone'

    // Determine notification type
    let notificationType = 'message'
    let notificationTitle = 'New Message'
    let notificationMessage = `${senderName} sent you a message`

    // Check if this is a booking request message
    if (senderType === 'tenant' && messageText.toLowerCase().includes('book') && messageText.toLowerCase().includes('like')) {
      notificationType = 'booking_request'
      notificationTitle = 'New Booking Request'
      notificationMessage = `${senderName} wants to book your property`
    }

    await createNotification({
      userId: receiverId,
      notificationType,
      title: notificationTitle,
      message: notificationMessage,
      relatedEntityType: 'conversation',
      relatedEntityId: conversationId,
      actionUrl: `landlord/chat?conversationId=${conversationId}`,
    })

    return { success: true, message, error: null }
  } catch (error) {
    console.error('Send message error:', error)
    return { success: false, message: null, error: error.message }
  }
}

// ============================================================================
// FAVORITES OPERATIONS
// ============================================================================

/**
 * Get Favorites
 * Fetches from: favorites table + listings table
 */
export const getFavorites = async (tenantProfileId) => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        *,
        listings (*)
      `)
      .eq('tenant_id', tenantProfileId)

    if (error) throw error

    return { success: true, favorites: data || [], error: null }
  } catch (error) {
    console.error('Get favorites error:', error)
    return { success: false, favorites: [], error: error.message }
  }
}

/**
 * Toggle Favorite
 * Inserts/Deletes from: favorites table
 */
export const toggleFavorite = async (tenantProfileId, listingId, isFavorited) => {
  try {
    if (isFavorited) {
      // Remove from favorites
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('tenant_id', tenantProfileId)
        .eq('listing_id', listingId)

      if (error) throw error
    } else {
      // Add to favorites
      const { error } = await supabase
        .from('favorites')
        .insert([
          {
            tenant_id: tenantProfileId,
            listing_id: listingId,
          },
        ])

      if (error) throw error
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Toggle favorite error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// NOTIFICATIONS OPERATIONS
// ============================================================================

/**
 * Get Notifications
 * Fetches from: notifications table
 */
export const getNotifications = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, notifications: data || [], error: null }
  } catch (error) {
    console.error('Get notifications error:', error)
    return { success: false, notifications: [], error: error.message }
  }
}

/**
 * Mark Notification as Read
 * Updates: notifications table
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)

    if (error) throw error

    return { success: true, error: null }
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Create Notification
 * Inserts into: notifications table
 * Used to create notifications for booking requests, reviews, messages, etc.
 */
export const createNotification = async (notificationData) => {
  try {
    const {
      userId,
      notificationType,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      actionUrl,
    } = notificationData

    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          notification_type: notificationType,
          title,
          message,
          related_entity_type: relatedEntityType,
          related_entity_id: relatedEntityId,
          action_url: actionUrl,
          is_read: false,
        },
      ])
      .select()

    if (error) throw error

    return { success: true, notification: data?.[0], error: null }
  } catch (error) {
    console.error('Create notification error:', error)
    return { success: false, notification: null, error: error.message }
  }
}

// ============================================================================
// REVIEWS OPERATIONS
// ============================================================================

/**
 * Create Review
 * Inserts into: reviews table
 * Creates notification for landlord
 */
export const createReview = async (reviewData) => {
  try {
    const {
      reviewedItemType,
      reviewedItemId,
      reviewerId,
      bookingId,
      rating,
      title,
      reviewText,
      cleanliness,
      communication,
      amenities,
      location,
      valueMoney,
      reviewerName,
    } = reviewData

    // Get reviewer info
    const { data: reviewer } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', reviewerId)
      .single()

    const reviewerFullName = reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : 'A tenant'

    // Create the review
    const { data: reviewData_result, error } = await supabase.from('reviews').insert([
      {
        reviewed_item_type: reviewedItemType,
        reviewed_item_id: reviewedItemId,
        reviewer_id: reviewerId,
        booking_id: bookingId,
        rating,
        title,
        review_text: reviewText,
        cleanliness,
        communication,
        amenities,
        location,
        value_for_money: valueMoney,
        is_verified_booking: true,
      },
    ]).select()

    if (error) throw error

    // If this is a review of a listing, notify the landlord
    if (reviewedItemType === 'listing') {
      // Get listing details to find landlord
      const { data: listing } = await supabase
        .from('listings')
        .select('landlord_id')
        .eq('id', reviewedItemId)
        .single()

      if (listing) {
        // Get landlord user_id
        const { data: landlord } = await supabase
          .from('landlord_profile')
          .select('user_id')
          .eq('id', listing.landlord_id)
          .single()

        if (landlord) {
          // Create notification for landlord
          await createNotification({
            userId: landlord.user_id,
            notificationType: 'review',
            title: 'New Review Posted',
            message: `${reviewerFullName} gave your listing a ${rating}-star review: "${title}"`,
            relatedEntityType: 'listing',
            relatedEntityId: reviewedItemId,
            actionUrl: 'landlord',
          })
        }
      }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Create review error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get Reviews for Listing
 * Fetches reviews for a specific listing
 */
export const getListingReviews = async (listingId) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        review_text,
        created_at,
        reviewer_id,
        is_verified_booking,
        reviewed_item_id,
        users:reviewer_id (
          id,
          first_name,
          last_name,
          profile_image_url
        )
      `)
      .eq('reviewed_item_type', 'listing')
      .eq('reviewed_item_id', listingId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, reviews: data || [], error: null }
  } catch (error) {
    console.error('Get listing reviews error:', error)
    return { success: false, reviews: [], error: error.message }
  }
}

/**
 * Get Reviews for Landlord
 * Fetches all reviews posted about a landlord's listings
 */
export const getLandlordReviews = async (landlordProfileId) => {
  try {
    // First get all listings for this landlord
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id')
      .eq('landlord_id', landlordProfileId)

    if (listingsError) throw listingsError

    const listingIds = listings.map(l => l.id)

    if (listingIds.length === 0) {
      return { success: true, reviews: [], error: null }
    }

    // Then get all reviews for these listings (without joining listings table)
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        review_text,
        created_at,
        reviewer_id,
        is_verified_booking,
        reviewed_item_id,
        users:reviewer_id (
          id,
          first_name,
          last_name,
          profile_image_url
        )
      `)
      .eq('reviewed_item_type', 'listing')
      .in('reviewed_item_id', listingIds)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Enrich reviews with listing titles
    const enrichedReviews = data.map(review => {
      const listing = listings.find(l => l.id === review.reviewed_item_id)
      return {
        ...review,
        listing_title: listing?.title || 'Unknown Listing'
      }
    })

    return { success: true, reviews: enrichedReviews || [], error: null }
  } catch (error) {
    console.error('Get landlord reviews error:', error)
    return { success: false, reviews: [], error: error.message }
  }
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Upload Profile Image
 * Uploads to: storage/profile-images bucket
 */
/**
 * Upload Message Image
 * Uploads image to profile-images bucket and returns public URL
 */
export const uploadMessageImage = async (imageUri, userId) => {
  try {
    const filePath = `${userId}/messages/${Date.now()}-message.jpg`

    // Read file from URI
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(filePath, uint8Array, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg',
      })

    if (error) throw error

    const { data: publicUrl } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath)

    return { success: true, publicUrl: publicUrl.publicUrl, error: null }
  } catch (error) {
    console.error('Upload message image error:', error)
    return { success: false, publicUrl: null, error: error.message }
  }
}

export const uploadProfileImage = async (userId, imageUri, fileName) => {
  try {
    const filePath = `${userId}/${Date.now()}-profile.jpg`

    // Read file from URI
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(filePath, uint8Array, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      })

    if (error) throw error

    const { data: publicUrl } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath)

    return { success: true, publicUrl: publicUrl.publicUrl, error: null }
  } catch (error) {
    console.error('Upload profile image error:', error)
    return { success: false, publicUrl: null, error: error.message }
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to New Messages
 */
export const subscribeToMessages = (conversationId, callback) => {
  const subscription = supabase
    .channel(`messages:conversation_id=eq.${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return subscription
}

/**
 * Subscribe to Notifications
 */
export const subscribeToNotifications = (userId, callback) => {
  const subscription = supabase
    .channel(`notifications:user_id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return subscription
}

/**
 * Subscribe to Booking Updates
 */
export const subscribeToBookingUpdates = (bookingId, callback) => {
  const subscription = supabase
    .channel(`bookings:id=eq.${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return subscription
}

// ============================================================================
// LANDLORD OPERATIONS
// ============================================================================

/**
 * Get Landlord Profile
 */
export const getLandlordProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('landlord_profile')
      .select(`
        id,
        user_id,
        company_name,
        years_experience,
        rating,
        total_reviews,
        response_rate,
        bank_account_verified,
        users:user_id(id, email, phone, first_name, last_name, profile_image_url, bio, created_at),
        listings(id, title, city, price_per_month, room_type, images, rating, total_reviews, amenities, available)
      `)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return { success: true, profile: data, error: null }
  } catch (error) {
    console.error('Get landlord profile error:', error)
    return { success: false, profile: null, error: error.message }
  }
}

/**
 * Update Landlord Profile
 */
export const updateLandlordProfile = async (userId, updates) => {
  try {
    // Update users table
    if (updates.email || updates.phone || updates.first_name || updates.last_name || updates.profile_image_url || updates.bio) {
      const userUpdates = {}
      if (updates.email) userUpdates.email = updates.email
      if (updates.phone) userUpdates.phone = updates.phone
      if (updates.first_name) userUpdates.first_name = updates.first_name
      if (updates.last_name) userUpdates.last_name = updates.last_name
      if (updates.profile_image_url) userUpdates.profile_image_url = updates.profile_image_url
      if (updates.bio) userUpdates.bio = updates.bio

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', userId)

      if (userError) throw userError
    }

    // Update landlord_profile table
    const landlordUpdates = {}
    if (updates.company_name) landlordUpdates.company_name = updates.company_name
    if (updates.years_experience !== undefined) landlordUpdates.years_experience = updates.years_experience
    if (updates.bank_account_verified !== undefined) landlordUpdates.bank_account_verified = updates.bank_account_verified

    if (Object.keys(landlordUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from('landlord_profile')
        .update(landlordUpdates)
        .eq('user_id', userId)

      if (profileError) throw profileError
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Update landlord profile error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Ensure Landlord Profile Exists
 * Creates a landlord profile if it doesn't exist (for migrations/edge cases)
 */
const ensureLandlordProfileExists = async (userId) => {
  try {
    console.log(`[ensureLandlordProfileExists] Ensuring profile for user: ${userId}`)
    
    // Use upsert: try to insert, if it already exists do nothing
    const { error } = await supabase
      .from('landlord_profile')
      .upsert(
        { user_id: userId },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error(`[ensureLandlordProfileExists] Error:`, error)
      throw error
    }
    
    console.log(`[ensureLandlordProfileExists] Profile ensured for user ${userId}`)
    return { success: true, error: null }
  } catch (error) {
    console.error(`[ensureLandlordProfileExists] Failed:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Create Listing
 */
export const createListing = async (listingData, userId) => {
  try {
    console.log(`[createListing] Starting listing creation for user ${userId}`)
    
    // First, ensure landlord profile exists
    const profileCheck = await ensureLandlordProfileExists(userId)
    if (!profileCheck.success) {
      console.error(`[createListing] Failed to ensure profile: ${profileCheck.error}`)
      throw new Error(`Failed to ensure landlord profile exists: ${profileCheck.error}`)
    }

    // CRITICAL: Fetch the landlord_profile.id (NOT user_id)
    // The listings table references landlord_profile(id), not users(id)
    const { data: landlordProfile, error: profileError } = await supabase
      .from('landlord_profile')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error(`[createListing] Error fetching landlord profile ID:`, profileError)
      throw new Error(`Failed to fetch landlord profile: ${profileError.message}`)
    }

    if (!landlordProfile) {
      throw new Error(`Landlord profile not found for user ${userId}`)
    }

    const landlordProfileId = landlordProfile.id
    console.log(`[createListing] Found landlord_profile.id: ${landlordProfileId}`)

    // Wait a bit to ensure profile is committed
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log(`[createListing] Inserting listing for landlord_profile_id: ${landlordProfileId}`)

    const listingPayload = {
      landlord_id: landlordProfileId,  // Use landlord_profile.id, NOT users.id
      title: listingData.title,
      description: listingData.description,
      address: listingData.address,
      city: listingData.city,
      postal_code: listingData.postalCode,
      price_per_month: listingData.price || listingData.pricePerMonth,
      property_type: listingData.propertyType || 'boarding_house',
      room_type: listingData.roomType || 'single_room',
      max_guests: listingData.maxGuests || 1,
      amenities: listingData.amenities || [],
      rules_regulations: listingData.rules || listingData.rulesRegulations || [],
      images: listingData.images || [],
      latitude: listingData.latitude,
      longitude: listingData.longitude,
      available: true,
    }

    // Add optional fields only if they exist in the schema
    if (listingData.bedrooms !== undefined && listingData.bedrooms !== null) {
      listingPayload.bedrooms = listingData.bedrooms
    }
    if (listingData.bathrooms !== undefined && listingData.bathrooms !== null) {
      listingPayload.bathrooms = listingData.bathrooms
    }
    if (listingData.size !== undefined && listingData.size !== null) {
      listingPayload.property_size = listingData.size
    }
    if (listingData.totalRooms !== undefined && listingData.totalRooms !== null) {
      listingPayload.total_rooms = listingData.totalRooms
    }
    if (listingData.availableRooms !== undefined && listingData.availableRooms !== null) {
      listingPayload.available_rooms = listingData.availableRooms
    }

    console.log(`[createListing] Listing payload:`, { landlord_id: listingPayload.landlord_id, title: listingPayload.title })

    const { data, error } = await supabase
      .from('listings')
      .insert([listingPayload])
      .select()

    if (error) {
      console.error(`[createListing] Insert error:`, error)
      throw error
    }
    
    console.log(`[createListing] Listing created successfully with ID: ${data[0]?.id}`)
    return { success: true, listing: data[0], error: null }
  } catch (error) {
    console.error('[createListing] Create listing error:', error)
    return { success: false, listing: null, error: error.message }
  }
}

/**
 * Update Listing
 */
export const updateListing = async (listingId, listingData) => {
  try {
    const updatePayload = {
      title: listingData.title,
      description: listingData.description,
      address: listingData.address,
      city: listingData.city,
      postal_code: listingData.postalCode,
      price_per_month: listingData.price,
      property_type: listingData.propertyType || 'boarding_house',
      room_type: listingData.roomType || 'single_room',
      max_guests: listingData.maxGuests || 1,
      amenities: listingData.amenities || [],
      rules_regulations: listingData.rules || listingData.rulesRegulations || [],
      images: listingData.images || [],
      latitude: listingData.latitude,
      longitude: listingData.longitude,
    }

    // Add optional fields only if they exist in the schema
    if (listingData.bedrooms !== undefined && listingData.bedrooms !== null) {
      updatePayload.bedrooms = listingData.bedrooms
    }
    if (listingData.bathrooms !== undefined && listingData.bathrooms !== null) {
      updatePayload.bathrooms = listingData.bathrooms
    }
    if (listingData.size !== undefined && listingData.size !== null) {
      updatePayload.property_size = listingData.size
    }
    if (listingData.totalRooms !== undefined && listingData.totalRooms !== null) {
      updatePayload.total_rooms = listingData.totalRooms
    }
    if (listingData.availableRooms !== undefined && listingData.availableRooms !== null) {
      updatePayload.available_rooms = listingData.availableRooms
    }

    const { data, error } = await supabase
      .from('listings')
      .update(updatePayload)
      .eq('id', listingId)
      .select()

    if (error) throw error
    return { success: true, listing: data[0], error: null }
  } catch (error) {
    console.error('Update listing error:', error)
    return { success: false, listing: null, error: error.message }
  }
}

/**
 * Delete Listing
 */
export const deleteListing = async (listingId) => {
  try {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error('Delete listing error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get Landlord Listings
 */
export const getLandlordListings = async (userId) => {
  try {
    console.log(`[getLandlordListings] Fetching listings for user ${userId}`)
    
    // First, get the landlord_profile.id for this user
    const { data: landlordProfile, error: profileError } = await supabase
      .from('landlord_profile')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error(`[getLandlordListings] Error fetching landlord profile:`, profileError)
      throw profileError
    }

    if (!landlordProfile) {
      console.log(`[getLandlordListings] No landlord profile found for user ${userId}`)
      return { success: true, listings: [], error: null }
    }

    const landlordProfileId = landlordProfile.id
    console.log(`[getLandlordListings] Found landlord_profile.id: ${landlordProfileId}`)

    // Now query listings using landlord_profile.id
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        price:price_per_month
      `)
      .eq('landlord_id', landlordProfileId)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    console.log(`[getLandlordListings] Found ${data?.length || 0} listings`)
    return { success: true, listings: data, error: null }
  } catch (error) {
    console.error('Get landlord listings error:', error)
    return { success: false, listings: [], error: error.message }
  }
}

/**
 * Get Landlord Bookings
/**
 * Get Landlord Bookings
 */
export const getLandlordBookings = async (userId) => {
  try {
    console.log(`[getLandlordBookings] Fetching bookings for user ${userId}`)
    
    // --- PART 1: RESTORED ---
    // We must fetch the landlordProfile first to define the variable
    const { data: landlordProfile, error: profileError } = await supabase
      .from('landlord_profile')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error(`[getLandlordBookings] Error fetching landlord profile:`, profileError)
      throw profileError
    }

    if (!landlordProfile) {
      console.log(`[getLandlordBookings] No landlord profile found for user ${userId}`)
      return { success: true, bookings: [], error: null }
    }
    // ------------------------

    const landlordProfileId = landlordProfile.id
    console.log(`[getLandlordBookings] Found landlord_profile.id: ${landlordProfileId}`)

    // --- PART 2: FIXED SQL ---
    // Changed 'price' to 'price:price_per_month' (Aliasing)
    // This fetches 'price_per_month' from DB but sends it to your app as 'price'
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        listing:listing_id(id, title, price:price_per_month),
        tenant_profile:tenant_id(id, user_id, users:user_id(id, first_name, last_name, profile_image_url, phone, email)),
        payments:payments(id, due_date, status)
      `)
      .eq('landlord_id', landlordProfileId)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    // Flatten tenant data (use tenant_profile.users if available)
    const bookings = (data || []).map(booking => {
      // Find next unpaid due date from payments (status !== 'completed')
      let nextDue = null
      if (Array.isArray(booking.payments) && booking.payments.length > 0) {
        const pending = booking.payments
          .filter(p => !p.status || p.status.toLowerCase() !== 'completed')
          .map(p => ({ ...p, due_date: p.due_date ? new Date(p.due_date) : null }))
          .filter(p => p.due_date)
          .sort((a, b) => a.due_date - b.due_date)

        if (pending.length > 0) nextDue = pending[0].due_date.toISOString().split('T')[0]
      }

      return {
        ...booking,
        tenant: booking.tenant_profile?.users || null,
        next_due_date: nextDue,
      }
    })
    
    console.log(`[getLandlordBookings] Found ${bookings.length} bookings`)
    return { success: true, bookings, error: null }
  } catch (error) {
    console.error('Get landlord bookings error:', error)
    return { success: false, bookings: [], error: error.message }
  }
}

/**
 * Get Landlord Inquiries
 */
export const getLandlordInquiries = async (userId) => {
  try {
    console.log(`[getLandlordInquiries] Fetching inquiries for user ${userId}`)
    
    // First, get the landlord_profile.id for this user
    const { data: landlordProfile, error: profileError } = await supabase
      .from('landlord_profile')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error(`[getLandlordInquiries] Error fetching landlord profile:`, profileError)
      throw profileError
    }

    if (!landlordProfile) {
      console.log(`[getLandlordInquiries] No landlord profile found for user ${userId}`)
      return { success: true, inquiries: [], error: null }
    }

    const landlordProfileId = landlordProfile.id
    console.log(`[getLandlordInquiries] Found landlord_profile.id: ${landlordProfileId}`)

    // Fetch conversations instead of inquiries to avoid duplicates
    // Each unique tenant + property combo = one conversation
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        tenant_id,
        listing_id,
        last_message,
        last_message_time,
        conversation_topic,
        unread_count_landlord,
        listing:listing_id(id, title),
        tenant_profile:tenant_id(id, user_id),
        tenant_users:tenant_id(user:user_id(id, first_name, last_name, email, phone, profile_image_url))
      `)
      .eq('landlord_id', landlordProfileId)
      .eq('is_active', true)
      .order('last_message_time', { ascending: false })

    if (error) throw error
    
    // Flatten the tenant data
    const inquiries = (data || []).map((conv) => {
      return {
        id: conv.id,
        conversation_id: conv.id,
        tenant_id: conv.tenant_id,
        listing_id: conv.listing_id,
        tenant: conv.tenant_users?.user ? {
          id: conv.tenant_profile?.id,
          first_name: conv.tenant_users.user.first_name,
          last_name: conv.tenant_users.user.last_name,
          email: conv.tenant_users.user.email,
          phone: conv.tenant_users.user.phone,
          profile_image_url: conv.tenant_users.user.profile_image_url,
        } : null,
        listing: conv.listing,
        message: conv.last_message || 'No messages yet',
        subject: conv.conversation_topic || 'General',
        created_at: conv.last_message_time,
        read: conv.unread_count_landlord === 0,
        unread_count: conv.unread_count_landlord || 0,
      }
    })
    
    console.log(`[getLandlordInquiries] Found ${inquiries.length} conversations`)
    return { success: true, inquiries, error: null }
  } catch (error) {
    console.error('Get landlord inquiries error:', error)
    return { success: false, inquiries: [], error: error.message }
  }
}

/**
 * Get Landlord Revenue
 */
export const getLandlordRevenue = async (userId, period = 'monthly') => {
  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        *,
        booking:booking_id(id, listing_id, amount),
        listing:listing_id(id, title)
      `)
      .eq('landlord_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate revenue by period
    const revenue = {}
    payments.forEach(payment => {
      const date = new Date(payment.created_at)
      let key
      if (period === 'monthly') {
        key = date.toISOString().substring(0, 7) // YYYY-MM
      } else if (period === 'yearly') {
        key = date.getFullYear().toString()
      } else {
        key = date.toISOString().substring(0, 10) // YYYY-MM-DD
      }
      revenue[key] = (revenue[key] || 0) + (payment.amount || 0)
    })

    return { success: true, payments, revenue, error: null }
  } catch (error) {
    console.error('Get landlord revenue error:', error)
    return { success: false, payments: [], revenue: {}, error: error.message }
  }
}

/**
 * Get Landlord Conversations (for chat)
 */
export const getLandlordConversations = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        tenant:tenant_id(id, first_name, last_name, email, phone, profile_image_url),
        listing:listing_id(id, title)
      `)
      .eq('landlord_id', userId)
      .order('last_message_time', { ascending: false })

    if (error) throw error
    return { success: true, conversations: data, error: null }
  } catch (error) {
    console.error('Get landlord conversations error:', error)
    return { success: false, conversations: [], error: error.message }
  }
}

/**
 * Record Payment
 */
export const recordPaymentAsLandlord = async (paymentData) => {
  try {
    // Ensure IDs are strings (not objects)
    const bookingId = typeof paymentData.bookingId === 'string' ? paymentData.bookingId : paymentData.bookingId?.id;
    const landlordId = typeof paymentData.landlordId === 'string' ? paymentData.landlordId : paymentData.landlordId?.id;
    const tenantId = typeof paymentData.tenantId === 'string' ? paymentData.tenantId : paymentData.tenantId?.id;
    const listingId = typeof paymentData.listingId === 'string' ? paymentData.listingId : paymentData.listingId?.id;
    const tenantUserId = typeof paymentData.tenantUserId === 'string' ? paymentData.tenantUserId : paymentData.tenantUserId?.id;

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        booking_id: bookingId,
        landlord_id: landlordId,
        tenant_id: tenantId,
        listing_id: listingId,
        amount: paymentData.amount,
        payment_method: paymentData.method,
        payment_type: paymentData.type || 'rent',
        status: 'completed',
        transaction_id: paymentData.reference,
        notes: paymentData.description,
      }])
      .select()

    if (error) throw error

    // Record in transactions_log
    await supabase.from('transactions_log').insert([{
      transaction_type: 'payment_in',
      user_id: landlordId,
      amount: paymentData.amount,
      description: `Payment received: ${paymentData.description}`,
      payment_id: data[0]?.id,
    }])

    // Create notification for tenant
    if (tenantUserId) {
      await createNotification({
        userId: tenantUserId,
        notificationType: 'payment_completed',
        title: 'Payment Recorded',
        message: `Landlord has recorded your payment of ₱${paymentData.amount.toLocaleString()}`,
        relatedEntityType: 'payment',
        relatedEntityId: data[0]?.id,
        actionUrl: '/(tenant)/payments',
      })
    }

    return { success: true, payment: data[0], error: null }
  } catch (error) {
    console.error('Record payment error:', error)
    return { success: false, payment: null, error: error.message }
  }
}

/**
 * Update Booking Status (Landlord)
 */
export const updateBookingStatusAsLandlord = async (bookingId, status) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select(`
        id,
        tenant_id,
        tenant:tenant_id(user_id),
        listing_id,
        listing:listing_id(title)
      `)

    if (error) throw error

    // Create notification for tenant
    const booking = data[0]
    if (booking && booking.tenant && booking.tenant.user_id) {
      const statusLabel = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : status
      const listingTitle = booking.listing?.title || 'your booking'

      await createNotification({
        userId: booking.tenant.user_id,
        notificationType: status === 'approved' ? 'booking_approved' : 'booking_cancelled',
        title: `Booking ${statusLabel}`,
        message: `Your booking for ${listingTitle} has been ${statusLabel}`,
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
        actionUrl: '/(tenant)/bookings',
      })
    }

    return { success: true, booking: data[0], error: null }
  } catch (error) {
    console.error('Update booking status error:', error)
    return { success: false, booking: null, error: error.message }
  }
}

/**
 * Create Conversation between Tenant and Landlord
 */
export const createConversation = async (tenantProfileId, landlordProfileId, listingId) => {
  try {
    // Validate inputs
    if (!tenantProfileId || !landlordProfileId || !listingId) {
      return { success: false, conversation: null, error: 'Missing required parameters' }
    }

    // Check if conversation already exists
    const { data: existing, error: checkError } = await supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantProfileId)
      .eq('landlord_id', landlordProfileId)
      .eq('listing_id', listingId)
      .single()

    // If conversation exists, return it
    if (existing && !checkError) {
      return { success: true, conversation: existing, error: null }
    }

    // Create new conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert([{
        tenant_id: tenantProfileId,
        landlord_id: landlordProfileId,
        listing_id: listingId,
      }])
      .select()

    if (error) throw error
    
    if (!data || data.length === 0) {
      return { success: false, conversation: null, error: 'Failed to create conversation' }
    }
    
    return { success: true, conversation: data[0], error: null }
  } catch (error) {
    console.error('Create conversation error:', error)
    return { success: false, conversation: null, error: error.message }
  }
}

/**
 * Create Inquiry
 */
export const createInquiry = async (listingId, tenantProfileId, landlordProfileId, messageText) => {
  try {
    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        listing_id: listingId,
        tenant_id: tenantProfileId,
        landlord_id: landlordProfileId,
        inquiry_type: 'booking',
        subject: 'Interest in property',
        message: messageText || 'Interested in this property',
        status: 'open',
        priority: 'medium',
      }])
      .select()

    if (error) throw error

    return { success: true, inquiry: data[0], error: null }
  } catch (error) {
    console.error('Create inquiry error:', error)
    return { success: false, inquiry: null, error: error.message }
  }
}

/**
 * Send Interest Message (Tenant to Landlord)
 */
export const sendInterestMessage = async (tenantProfileId, landlordProfileId, listingId, messageText) => {
  try {
    // Create or get conversation
    const { success: convSuccess, conversation, error: convError } = await createConversation(
      tenantProfileId,
      landlordProfileId,
      listingId
    )

    if (!convSuccess || !conversation) {
      throw new Error(convError || 'Failed to create conversation')
    }

    // Create inquiry
    const { success: inquirySuccess, inquiry, error: inquiryError } = await createInquiry(
      listingId,
      tenantProfileId,
      landlordProfileId,
      messageText
    )

    if (!inquirySuccess || !inquiry) {
      throw new Error(inquiryError || 'Failed to create inquiry')
    }

    // Get the current user to use as sender_id in messages
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Send initial message in the conversation
    const { success: msgSuccess, error: msgError } = await sendMessage(
      conversation.id,
      currentUser.id,
      messageText
    );

    if (!msgSuccess) {
      console.warn('Message sending failed:', msgError);
      // Don't throw - conversation and inquiry were created successfully
    }

    return { 
      success: true, 
      conversation: conversation,
      inquiry: inquiry,
      conversationId: conversation.id,
      error: null 
    }
  } catch (error) {
    console.error('Send interest message error:', error)
    return { success: false, conversationId: null, error: error.message }
  }
}



// ============================================================================
// ERROR HANDLING
// ============================================================================

export const handleError = (error) => {
  if (!error) return null

  const errorMap = {
    '401': 'Unauthorized - Please login again',
    '403': 'Forbidden - You do not have permission',
    '404': 'Not found',
    '23505': 'This record already exists',
    '23503': 'Cannot delete - Referenced by other records',
    'PGRST116': 'No records found',
  }

  return errorMap[error.code] || errorMap[error.status] || error.message || 'An error occurred'
}


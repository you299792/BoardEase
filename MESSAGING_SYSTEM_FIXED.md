# BoardEase Messaging System - Complete Fix & Documentation

## Overview
The messaging system has been completely refactored to enable a fully functional, two-way chat system between tenants and landlords. All components now properly sync data and display messages in real-time.

## System Architecture

```
Tenant Side                          Landlord Side
───────────────────────────────────────────────────────────────
messages.js         <──────────────→  inquiries.js
   ↓                                      ↓
chat.js             <──────────────→  chat.js
   ↓                                      ↓
sendMessage()       <──────────────→  sendMessage()
   ↓                                      ↓
Supabase DB (PostgreSQL)
   ├── conversations table
   ├── messages table
   ├── inquiries table
   └── users table (with profiles)
```

## Key Components Fixed

### 1. **Tenant Messages Screen** (`app/(tenant)/messages.js`)

**What Changed:**
- Fixed data fetching to use `tenant_profile.id` instead of `user.id`
- Added proper conversation ID passing to chat screen
- Removed AsyncStorage dependencies
- Properly transform conversation data for display

**How It Works:**
```javascript
// Before (BROKEN):
const { success, conversations, error } = await getConversations(user.id); // Wrong ID!

// After (FIXED):
const { success: profileSuccess, profile } = await getTenantProfile(user.id);
const { success, conversations, error } = await getConversations(profile.id); // Correct!
```

**Data Flow:**
1. Get auth user (user.id)
2. Fetch tenant profile to get tenant_profile.id
3. Use tenant_profile.id to fetch conversations
4. Transform conversations to message list format
5. Pass conversationId to chat screen

---

### 2. **Tenant Chat Screen** (`app/(tenant)/chat.js`)

**What Changed:**
- Fixed `getMessages()` call to use only `conversationId` parameter
- Added sender profile data preservation (not just sender_id)
- Implemented avatar display for each message
- Fixed message sender identification (use `sender_id`, not `sender`)
- Added proper timestamp formatting
- Enhanced layout with flexbox for avatar + message bubble

**Message Flow:**
```javascript
// Message object structure (from Supabase):
{
  id: "msg-123",
  sender_id: "user-456",
  sender: {
    id: "user-456",
    first_name: "John",
    last_name: "Doe",
    profile_image_url: "https://...",
    email: "john@example.com"
  },
  receiver_id: "user-789",
  receiver: { ... },
  message_text: "Interested in this property",
  conversation_id: "conv-321",
  created_at: "2025-11-24T10:30:00Z",
  message_type: "text"
}
```

**Rendering:**
```
Other's Message (Left-aligned):
┌─────────────────────────┐
│ [Avatar] │ Message Text  │
│          │ 10:30 AM      │
└─────────────────────────┘

My Message (Right-aligned):
┌─────────────────────────┐
│ Message Text │ [Avatar]  │
│ 10:35 AM     │           │
└─────────────────────────┘
```

---

### 3. **Landlord Chat Screen** (`app/landlord/chat.js`)

**What Changed:**
- Fixed `getMessages()` call to use only conversationId
- Added sender profile data preservation
- Implemented avatar display with fallback for missing images
- Fixed message sender identification
- Added proper message timestamp formatting
- Enhanced layout for avatar + message + booking action button

**Key Features:**
- Displays tenant messages with their profile pictures
- Shows booking action button for incoming booking messages
- Allows approve/reject/modify booking actions
- Real-time message synchronization

---

### 4. **Landlord Inquiries Screen** (`app/landlord/inquiries.js`)

**What Changed:**
- Fixed inquiry data mapping to properly extract tenant information
- Added conversation ID lookup (fetches from conversations table)
- Included profile image URL in tenant data
- Improved error handling with fallback values
- Removed AsyncStorage dependencies

**Data Mapping:**
```javascript
// Transforms inquiry data:
{
  id: inq.id,
  conversationId: conversation.id,      // Fetched from conversations table
  tenantId: inq.tenant_id,
  tenant: {
    id: tenant_profile.id,
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    image: "https://..." // Profile picture
  },
  houseName: inq.listing.title,
  status: inq.status,
  lastMessage: inq.message,
  time: inq.created_at
}
```

---

## Backend Functions (`lib/supabaseClient.js`)

### `getConversations(tenantProfileId)`
**Purpose:** Fetch all conversations for a tenant
**Returns:**
```javascript
{
  success: true,
  conversations: [
    {
      id: "conv-id",
      tenant_id: "tenant-profile-id",
      landlord_id: "landlord-profile-id",
      listing_id: "listing-id",
      last_message: "Last message text",
      last_message_time: "2025-11-24T10:30:00Z",
      landlord: {
        users: {
          first_name: "Jane",
          last_name: "Smith",
          profile_image_url: "https://..."
        }
      },
      listing: {
        title: "Cozy Apartment"
      }
    }
  ]
}
```

### `getMessages(conversationId)`
**Purpose:** Fetch all messages in a conversation with sender/receiver profiles
**Returns:**
```javascript
{
  success: true,
  messages: [
    {
      id: "msg-id",
      sender_id: "user-id",
      sender: {
        id: "user-id",
        first_name: "John",
        last_name: "Doe",
        profile_image_url: "https://...",
        email: "john@example.com"
      },
      receiver_id: "user-id-2",
      receiver: { ... },
      message_text: "Hi, I'm interested",
      conversation_id: "conv-id",
      created_at: "2025-11-24T10:30:00Z",
      message_type: "text"
    }
  ]
}
```

### `sendMessage(conversationId, senderId, messageText)`
**Purpose:** Send a message in a conversation
**Flow:**
1. Fetch conversation to get tenant/landlord profile IDs
2. Determine sender type (tenant/landlord) from users table
3. Calculate receiver ID based on sender type
4. Insert message with all required fields
5. Update conversation's last_message metadata

**Returns:**
```javascript
{
  success: true,
  message: { /* message object */ }
}
```

### `getLandlordInquiries(userId)`
**Purpose:** Fetch all inquiries for a landlord with tenant info
**Process:**
1. Get landlord_profile.id from user.id
2. Fetch all inquiries for that landlord
3. For each inquiry, fetch corresponding conversation
4. Flatten and format data for UI

**Returns:**
```javascript
{
  success: true,
  inquiries: [
    {
      id: "inq-id",
      conversation_id: "conv-id",
      tenant: {
        id: "tenant-profile-id",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        profile_image_url: "https://..."
      },
      listing: {
        id: "listing-id",
        title: "Cozy Apartment"
      },
      message: "Inquiry message text",
      status: "open",
      created_at: "2025-11-24T10:30:00Z"
    }
  ]
}
```

---

## Data Flow: End-to-End

### Scenario: Tenant sends interest in a property

```
1. TENANT SIDE (boarding-house-details.js)
   ├─ User taps "Send Interest"
   ├─ Calls sendInterestMessage(tenantProfileId, landlordProfileId, listingId, messageText)
   │
2. BACKEND (supabaseClient.js - sendInterestMessage)
   ├─ Creates/fetches conversation (tenant ↔ landlord + listing)
   ├─ Creates inquiry record
   ├─ Sends initial message via sendMessage()
   │  ├─ Fetches conversation
   │  ├─ Determines sender type (tenant)
   │  ├─ Calculates receiver (landlord)
   │  ├─ Inserts message with sender_id, receiver_id, sender_type
   │  └─ Updates conversation's last_message
   │
3. REAL-TIME SYNC
   ├─ subscribeToMessages triggers on landlord side
   └─ New message appears instantly
   │
4. LANDLORD SIDE (inquiries.js)
   ├─ Calls getLandlordInquiries()
   ├─ Shows inquiry in list with tenant info + last message
   │
5. LANDLORD TAPS MESSAGE
   ├─ Routes to chat.js with conversationId
   ├─ Calls getMessages(conversationId)
   ├─ Displays all messages with tenant's profile picture
   │
6. LANDLORD SENDS RESPONSE
   ├─ Calls sendMessage(conversationId, landlordUserId, responseText)
   │  ├─ Determines sender type (landlord)
   │  ├─ Calculates receiver (tenant)
   │  ├─ Inserts message
   │
7. TENANT SIDE (messages.js)
   ├─ Calls getConversations(tenantProfileId)
   ├─ Shows conversation with last message
   │
8. TENANT TAPS CONVERSATION
   ├─ Routes to chat.js with conversationId
   ├─ Calls getMessages(conversationId)
   ├─ Displays all messages including landlord's response
   │
9. REAL-TIME UPDATES
   ├─ Both sides subscribed to messages channel
   └─ New messages appear instantly on both sides
```

---

## Key Fixes Summary

### ID Confusion (FIXED ✓)
**Problem:** Code was mixing `user.id` (auth ID) with profile IDs
**Solution:** 
- Always fetch profile first to get profile.id
- Pass profile.id to database queries
- Keep user.id only for authentication

### Message Parameters (FIXED ✓)
**Problem:** `getMessages(user.id, landlordId, houseId)` had too many parameters
**Solution:** 
- `getMessages(conversationId)` - single parameter
- Includes full sender/receiver objects with profiles

### Profile Pictures (FIXED ✓)
**Problem:** Message objects didn't preserve sender profile data
**Solution:**
- Database query includes nested sender/receiver objects
- Message transformation preserves full sender object
- Rendering extracts profile_image_url from sender.profile_image_url

### Message Sender Identification (FIXED ✓)
**Problem:** Compared `item.sender` (undefined) instead of `item.sender_id`
**Solution:**
- Use `item.sender_id === currentUser.id` for comparison
- Access profile via `item.sender.profile_image_url`

### Layout for Avatars (FIXED ✓)
**Problem:** No room for avatars next to message bubbles
**Solution:**
- New `messageContainer` with flexDirection: 'row'
- Avatars positioned left (others) or right (mine)
- `messageBubble` maxWidth reduced to 70% for avatar space

### Conversation Lookup (FIXED ✓)
**Problem:** Inquiries didn't have direct conversation ID reference
**Solution:**
- `getLandlordInquiries` now fetches conversation ID by querying conversations table
- Uses tenant_id + landlord_id + listing_id to find matching conversation

---

## Testing Checklist

- [x] Tenant messages.js loads all conversations
- [x] Tenant chat.js displays messages with avatars
- [x] Landlord inquiries.js shows all incoming inquiries
- [x] Landlord chat.js displays messages with avatars
- [x] Messages sent by tenant appear on landlord side
- [x] Messages sent by landlord appear on tenant side
- [x] Real-time updates work (no page refresh needed)
- [x] Profile pictures load correctly
- [x] No compilation errors
- [x] All imports are correct

---

## Files Modified

1. `app/(tenant)/messages.js` - Fixed data fetching, added conversationId
2. `app/(tenant)/chat.js` - Fixed getMessages call, added avatars
3. `app/landlord/chat.js` - Fixed getMessages call, added avatars
4. `app/landlord/inquiries.js` - Fixed data mapping, added conversation lookup
5. `lib/supabaseClient.js` - Enhanced getLandlordInquiries with conversation lookup

---

## Common Issues & Solutions

### Issue: "Messages don't appear in chat"
**Solution:** Ensure conversationId is being passed from previous screen
```javascript
// In messages.js or inquiries.js:
router.push({
  pathname: '/(tenant)/chat',
  params: {
    conversationId: item.conversationId,  // REQUIRED
    landlordId: item.landlord.id,
    // ... other params
  },
});
```

### Issue: "Profile pictures not showing"
**Solution:** Verify profile_image_url exists in database
```javascript
// In chat.js renderMessage:
const senderAvatar = item.sender?.profile_image_url;
if (!senderAvatar) {
  // Show default avatar icon
}
```

### Issue: "Conversation ID is missing"
**Solution:** Ensure getLandlordInquiries properly fetches conversation_id
```javascript
// In supabaseClient.js:
const { data: conversation } = await supabase
  .from('conversations')
  .select('id')
  .eq('tenant_id', inquiry.tenant_id)
  .eq('landlord_id', landlordProfileId)
  .eq('listing_id', inquiry.listing_id)
  .single();
```

---

## Performance Notes

- Messages are fetched with `.order('created_at', { ascending: true })` for chronological display
- Real-time subscriptions use PostgreSQL changes channel (efficient)
- Conversation lookup uses indexed foreign keys (fast)
- Profile images are cached by React Native automatically

---

## Future Enhancements

1. Add read receipts (track when messages are read)
2. Add typing indicators
3. Implement message search
4. Add image upload in chat
5. Add voice/video call support
6. Implement message reactions/emojis
7. Add group chat support


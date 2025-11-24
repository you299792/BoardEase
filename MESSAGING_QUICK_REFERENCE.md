# Messaging System - Quick Reference Guide

## What Was Fixed

### 1. **Tenant Messages Screen** ✅
**File:** `app/(tenant)/messages.js`

**Changes:**
- ✅ Now correctly fetches conversations using `tenant_profile.id` instead of `user.id`
- ✅ Passes `conversationId` to chat screen
- ✅ Displays list of all message threads with tenant's landlords
- ✅ Shows last message preview and timestamp

**Usage:**
```javascript
// User taps on a conversation
→ Router navigates to /(tenant)/chat with conversationId
```

---

### 2. **Tenant Chat Screen** ✅
**File:** `app/(tenant)/chat.js`

**Changes:**
- ✅ Fixed `getMessages(conversationId)` - now uses correct parameter
- ✅ Displays all messages in conversation
- ✅ Shows sender's profile picture next to each message
- ✅ Messages from tenant appear on right, from landlord on left
- ✅ Real-time message updates via subscriptions

**Message Display:**
```
Landlord's message:
[Avatar] | Message text
         | 10:30 AM

Your message:
                    Message text | [Avatar]
                    10:35 AM     |
```

---

### 3. **Landlord Chat Screen** ✅
**File:** `app/landlord/chat.js`

**Changes:**
- ✅ Fixed `getMessages(conversationId)` - now uses correct parameter
- ✅ Displays all messages from tenant
- ✅ Shows tenant's profile picture next to each message
- ✅ Real-time message updates
- ✅ Can approve/decline/modify booking requests

**Message Display:**
```
Tenant's message:
[Avatar] | Message text
         | 10:30 AM

Your message:
                    Message text | [Avatar]
                    10:35 AM     |
```

---

### 4. **Landlord Inquiries Screen** ✅
**File:** `app/landlord/inquiries.js`

**Changes:**
- ✅ Displays list of all incoming inquiries from tenants
- ✅ Shows tenant name, profile picture, property, and last message
- ✅ Correctly extracts conversation ID
- ✅ Each inquiry links to chat.js with proper data

**Data Shown:**
- Tenant name and avatar
- Property name
- Last message preview
- Inquiry status
- Timestamp

---

### 5. **Backend Functions** ✅
**File:** `lib/supabaseClient.js`

**Functions Fixed:**
- ✅ `getConversations(tenantProfileId)` - Returns all conversations for a tenant
- ✅ `getMessages(conversationId)` - Returns all messages with sender profiles
- ✅ `sendMessage(conversationId, senderId, messageText)` - Sends message and updates conversation
- ✅ `getLandlordInquiries(userId)` - Returns all inquiries with conversation IDs and tenant info

---

## How It Works - Complete Flow

### Scenario: Tenant Sends Interest → Landlord Responds

```
STEP 1: Tenant Finds Property
  └─ User taps "Send Interest" on property details
  
STEP 2: Conversation Created
  └─ Backend creates:
     ├─ Conversation (links tenant + landlord + property)
     ├─ Inquiry (records interest)
     └─ Initial Message (from tenant)

STEP 3: Message Synced to Landlord
  └─ Real-time subscription triggers
  └─ Landlord's inquiries.js receives update
  
STEP 4: Landlord Sees Inquiry
  └─ Landlord opens inquiries.js
  └─ Sees tenant name, property, and last message
  
STEP 5: Landlord Opens Chat
  └─ Taps inquiry
  └─ Router navigates to landlord/chat with conversationId
  └─ Chat loads all messages from conversation
  
STEP 6: Landlord Sends Response
  └─ Types message and sends
  └─ Backend inserts message with landlord as sender
  
STEP 7: Tenant Sees Response
  └─ Real-time subscription on tenant's side
  └─ Message appears immediately in tenant's chat
  
STEP 8: Ongoing Conversation
  └─ Both can continue messaging
  └─ Messages sync in real-time
  └─ Conversation updates on both sides
```

---

## Key Database Relationships

```
users table (from Supabase Auth)
  ├─ id (auth user ID)
  ├─ email
  ├─ user_type ('tenant' or 'landlord')
  └─ profile_image_url

tenant_profile table
  ├─ id (PRIMARY)
  ├─ user_id (FOREIGN KEY → users.id)
  └─ other tenant fields

landlord_profile table
  ├─ id (PRIMARY)
  ├─ user_id (FOREIGN KEY → users.id)
  └─ other landlord fields

conversations table
  ├─ id
  ├─ tenant_id (FOREIGN KEY → tenant_profile.id)
  ├─ landlord_id (FOREIGN KEY → landlord_profile.id)
  ├─ listing_id
  └─ last_message, last_message_time

messages table
  ├─ id
  ├─ conversation_id (FOREIGN KEY → conversations.id)
  ├─ sender_id (FOREIGN KEY → users.id)
  ├─ receiver_id (FOREIGN KEY → users.id)
  ├─ sender_type ('tenant' or 'landlord')
  ├─ message_text
  └─ created_at

inquiries table
  ├─ id
  ├─ tenant_id (FOREIGN KEY → tenant_profile.id)
  ├─ landlord_id (FOREIGN KEY → landlord_profile.id)
  ├─ listing_id
  ├─ subject
  ├─ message
  ├─ status
  └─ created_at
```

---

## Important ID Types

**⚠️ CRITICAL: Don't Mix These Up!**

| ID Type | Where It Comes From | Use Case |
|---------|-------------------|----------|
| `user.id` | Supabase Auth | Logging in, authentication, sender_id/receiver_id in messages |
| `tenantProfile.id` | `tenant_profile` table | Querying conversations, inquiries |
| `landlordProfile.id` | `landlord_profile` table | Querying conversations, listings |
| `conversationId` | `conversations` table | Fetching messages, sending messages |

---

## Testing the System

### Test 1: Tenant Sends Interest
```javascript
1. Open app as tenant
2. Find a property
3. Tap "Send Interest" button
4. Type message and send
```

**Expected Results:**
- ✅ Conversation created in Supabase
- ✅ Message appears in chat immediately
- ✅ Conversation shows in tenant's messages.js
- ✅ Landlord sees inquiry in inquiries.js
- ✅ Landlord can open chat and see tenant's message with avatar

### Test 2: Landlord Responds
```javascript
1. Open app as landlord
2. Open inquiries.js
3. Tap on a tenant inquiry
4. See tenant's message with avatar
5. Type response and send
```

**Expected Results:**
- ✅ Landlord's message appears immediately
- ✅ Message shows with landlord's avatar
- ✅ Real-time sync sends to tenant side
- ✅ Tenant sees response in chat without refresh

### Test 3: Verify Profile Pictures
```javascript
1. In any chat screen
2. Look at messages from other user
3. Check that profile picture appears
```

**Expected Results:**
- ✅ Profile picture loads next to message
- ✅ Fallback icon shows if no picture
- ✅ Pictures are cached for performance

---

## Common Commands for Testing

### Clear Messages Cache (if needed)
```javascript
// In supabaseClient.js
const clearMessagesCache = async () => {
  // Messages are fetched fresh from DB, no local cache
  // Just reload the conversation
  await loadConversation();
};
```

### Check Database Messages
```sql
-- In Supabase SQL Editor
SELECT * FROM messages 
WHERE conversation_id = 'your-conv-id'
ORDER BY created_at DESC;
```

### Monitor Real-Time Subscriptions
```javascript
// In browser console when testing
const subscription = subscribeToMessages('conv-id', (newMsg) => {
  console.log('New message:', newMsg);
});
```

---

## Troubleshooting

### Problem: Messages don't appear
**Check:**
1. Is conversationId being passed correctly? ✓
2. Are messages in database? (Check Supabase)
3. Is sender_id valid? (Should be user.id, not profile.id)
4. Is receiver_id correct? (Should be other user's user.id)

### Problem: Profile pictures missing
**Check:**
1. Does user have profile_image_url in users table?
2. Is image URL valid and accessible?
3. Is query including sender/receiver objects?

### Problem: Conversation ID missing
**Check:**
1. Is conversation created before sending message?
2. Does conversation have correct tenant_id, landlord_id, listing_id?
3. Are you querying with correct profile IDs?

---

## Code Examples

### Load Tenant Messages
```javascript
const loadMessages = async () => {
  const user = await getCurrentUser();
  const { profile } = await getTenantProfile(user.id);
  const { conversations } = await getConversations(profile.id);
  // Transform and display
};
```

### Send Message (Both Sides)
```javascript
const sendMsg = async (messageText) => {
  const user = await getCurrentUser();
  const { success } = await sendMessage(
    conversationId,
    user.id,  // Sender's user.id (from auth)
    messageText
  );
};
```

### Load Landlord Inquiries
```javascript
const loadInquiries = async () => {
  const user = await getCurrentUser();
  const { inquiries } = await getLandlordInquiries(user.id);
  // Each inquiry has conversation_id and tenant info
};
```

---

## Deployment Checklist

- [x] All files compile without errors
- [x] Message fetching uses conversationId only
- [x] Profile pictures load with avatars
- [x] Real-time subscriptions configured
- [x] Conversation creation before messaging
- [x] Proper ID handling (user.id vs profile.id)
- [x] AsyncStorage removed from messaging
- [x] Error handling in place
- [x] Proper data transformation
- [x] Fallback values for missing data

---

## Support & Next Steps

### If You Need to:

**Add new message features:**
- Edit `renderMessage()` in chat.js files
- Update message schema in database

**Add read receipts:**
- Add `is_read` and `read_at` to messages table
- Update `markMessageAsRead()` function

**Add typing indicators:**
- Create `typing_status` table
- Subscribe to typing changes
- Display typing indicator

**Scale for performance:**
- Paginate messages (load 50 at a time)
- Add message search with full-text search
- Cache recent conversations


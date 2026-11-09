# Messaging System - Before & After Code Comparison

## 1. Tenant Messages.js - Data Fetching

### BEFORE (BROKEN ❌)
```javascript
const loadMessages = async () => {
  try {
    setIsLoading(true);

    // ❌ WRONG: user.id is auth ID, not tenant_profile.id
    const user = await getCurrentUser();
    const { success, conversations, error } = await getConversations(user.id);

    if (success && conversations) {
      const messages = conversations.map(conv => ({
        id: conv.id,
        landlord: {
          id: conv.landlord_id,
          name: `${conv.landlord?.users?.first_name} ${conv.landlord?.users?.last_name}`,
          // ... other fields
        },
        // Missing conversationId!
      }));
      setAllMessages(messages);
    }
  } catch (e) {
    console.error('Failed to load messages', e);
  } finally {
    setIsLoading(false);
  }
};
```

**Problems:**
- ❌ Calling `getConversations(user.id)` - user.id is auth ID!
- ❌ Missing `conversationId` in transformed data
- ❌ Won't find any conversations (wrong ID type)

### AFTER (FIXED ✅)
```javascript
const loadMessages = async () => {
  try {
    setIsLoading(true);

    // ✅ Get auth user
    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Error', 'Not logged in');
      setIsLoading(false);
      return;
    }

    // ✅ Get tenant profile to get tenant_profile.id
    const { success: profileSuccess, profile } = await getTenantProfile(user.id);
    if (!profileSuccess || !profile) {
      Alert.alert('Error', 'Could not load tenant profile');
      setIsLoading(false);
      return;
    }

    // ✅ Now use correct tenant_profile.id
    const { success, conversations, error } = await getConversations(profile.id);

    if (success && conversations) {
      const messages = conversations.map(conv => ({
        id: conv.id,
        conversationId: conv.id,  // ✅ Added!
        landlord: {
          id: conv.landlord_id,
          name: `${conv.landlord?.users?.first_name} ${conv.landlord?.users?.last_name}`,
          // ... other fields
        },
      }));
      setAllMessages(messages);
    }
  } catch (e) {
    console.error('Failed to load messages', e);
  } finally {
    setIsLoading(false);
  }
};
```

**Fixed:**
- ✅ Fetches tenant profile first
- ✅ Uses correct `tenant_profile.id`
- ✅ Includes `conversationId` in data
- ✅ Can now pass to chat screen

---

## 2. Tenant Chat.js - Message Fetching

### BEFORE (BROKEN ❌)
```javascript
const loadConversation = async () => {
  try {
    setIsLoading(true);
    const user = await getCurrentUser();
    setCurrentUser(user);

    let convId = routeConversationId;

    // ❌ WRONG: getMessages() doesn't accept these parameters!
    if (!convId) {
      const { success, messages: messagesData, conversationId: fetchedConvId, error } = await getMessages(
        user.id,           // ❌ getMessages(conversationId) only!
        landlordId,
        houseId
      );
      // ...
    } else {
      // ❌ Still wrong parameters
      const { success, messages: messagesData, error } = await getMessages(
        user.id,
        landlordId,
        houseId
      );
    }
  } finally {
    setIsLoading(false);
  }
};
```

**Problems:**
- ❌ Calling `getMessages(user.id, landlordId, houseId)`
- ❌ getMessages only accepts `conversationId`
- ❌ Extra parameters cause errors
- ❌ Messages not fetched correctly

### AFTER (FIXED ✅)
```javascript
const loadConversation = async () => {
  try {
    setIsLoading(true);

    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Error', 'Not logged in');
      setIsLoading(false);
      return;
    }

    setCurrentUser(user);

    // ✅ Use conversationId from route params
    const convId = routeConversationId;

    if (!convId) {
      Alert.alert('Error', 'Conversation ID is missing');
      setIsLoading(false);
      return;
    }

    // ✅ CORRECT: Only conversationId parameter
    const { success, messages: messagesData, error } = await getMessages(convId);

    if (!success || !messagesData) {
      Alert.alert('Error', error || 'Failed to load messages');
      setIsLoading(false);
      return;
    }

    // ✅ Transform messages to preserve sender profile data
    const transformedMessages = messagesData.map(msg => ({
      id: msg.id,
      sender_id: msg.sender_id,
      sender: msg.sender,  // ✅ Preserve full sender object!
      receiver: msg.receiver,
      text: msg.message_text,
      image: msg.image_url,
      timestamp: msg.created_at,
      type: msg.message_type,
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    setMessages(transformedMessages);
    setConversationId(convId);

    // ✅ Subscribe to real-time updates
    const subscription = subscribeToMessages(convId, (newMsg) => {
      const transformedMsg = {
        id: newMsg.id,
        sender_id: newMsg.sender_id,
        sender: newMsg.sender,
        receiver: newMsg.receiver,
        text: newMsg.message_text,
        image: newMsg.image_url,
        timestamp: newMsg.created_at,
        type: newMsg.message_type,
      };
      setMessages(prev => [transformedMsg, ...prev]);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  } finally {
    setIsLoading(false);
  }
};
```

**Fixed:**
- ✅ Uses correct `getMessages(conversationId)` signature
- ✅ Preserves full sender object with profile data
- ✅ Proper message transformation
- ✅ Real-time subscriptions configured

---

## 3. Tenant Chat.js - Render Message

### BEFORE (BROKEN ❌)
```javascript
const renderMessage = ({ item }) => (
  <View
    style={[
      styles.messageBubble,
      // ❌ WRONG: item.sender is undefined, should use sender_id
      item.sender === currentUser?.id
        ? styles.myMessage
        : styles.otherMessage,
    ]}
  >
    {item.image ? (
      <TouchableOpacity>
        <Image source={{ uri: item.image }} style={styles.messageImage} />
      </TouchableOpacity>
    ) : (
      <Text
        style={
          // ❌ Same problem: item.sender is undefined
          item.sender === currentUser?.id
            ? styles.myMessageText
            : styles.otherMessageText
        }
      >
        {item.text}
      </Text>
    )}
    {/* ❌ No avatar display */}
    <Text style={styles.messageTime}>{item.timestamp}</Text>
  </View>
);
```

**Problems:**
- ❌ Uses `item.sender` which is undefined
- ❌ Should use `item.sender_id`
- ❌ No avatar/profile picture display
- ❌ No layout for avatar + message

### AFTER (FIXED ✅)
```javascript
const renderMessage = ({ item }) => {
  // ✅ Use sender_id for comparison
  const isMyMessage = currentUser && item.sender_id === currentUser.id;
  // ✅ Get full sender object with profile data
  const senderProfile = item.sender;
  const senderAvatar = senderProfile?.profile_image_url;

  return (
    <View
      style={[
        styles.messageContainer,  // ✅ New container for flex layout
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
      ]}
    >
      {/* ✅ Show avatar for other's messages (left) */}
      {!isMyMessage && senderAvatar && (
        <Image source={{ uri: senderAvatar }} style={styles.senderAvatar} />
      )}
      {!isMyMessage && !senderAvatar && (
        <View style={[styles.senderAvatar, styles.defaultAvatar]}>
          <Ionicons name="person-circle" size={32} color="#ccc" />
        </View>
      )}

      <View style={styles.messageBubble}>
        {item.image ? (
          <TouchableOpacity>
            <Image source={{ uri: item.image }} style={styles.messageImage} />
          </TouchableOpacity>
        ) : (
          <Text
            style={
              isMyMessage ? styles.myMessageText : styles.otherMessageText
            }
          >
            {item.text}
          </Text>
        )}
        <Text style={styles.messageTime}>
          {new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>

      {/* ✅ Show avatar for my messages (right) */}
      {isMyMessage && senderAvatar && (
        <Image source={{ uri: senderAvatar }} style={styles.senderAvatar} />
      )}
      {isMyMessage && !senderAvatar && (
        <View style={[styles.senderAvatar, styles.defaultAvatar]}>
          <Ionicons name="person-circle" size={32} color="#ccc" />
        </View>
      )}
    </View>
  );
};
```

**Fixed:**
- ✅ Uses correct `item.sender_id` comparison
- ✅ Accesses `item.sender.profile_image_url` for avatar
- ✅ Shows avatar for both my and other's messages
- ✅ New flex layout for avatar + message
- ✅ Proper timestamp formatting

---

## 4. Styles - Message Container

### BEFORE (BROKEN ❌)
```javascript
const styles = StyleSheet.create({
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: '80%',  // ❌ Too much space for avatar
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
  },
  // ❌ No avatar styles
});
```

**Problems:**
- ❌ No space allocated for avatar
- ❌ No flexbox layout for avatar + bubble
- ❌ Missing avatar styles

### AFTER (FIXED ✅)
```javascript
const styles = StyleSheet.create({
  // ✅ New container for avatar + message layout
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    gap: 6,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  
  // ✅ Avatar styles
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '70%',  // ✅ Reduced for avatar space
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
  },
  // ... other styles
});
```

**Fixed:**
- ✅ `messageContainer` with flexDirection: 'row'
- ✅ Avatar styled (32x32, borderRadius 16)
- ✅ Proper spacing with gap
- ✅ Message bubble reduced to 70% width

---

## 5. Landlord Inquiries.js - Data Mapping

### BEFORE (BROKEN ❌)
```javascript
const loadInquiries = async () => {
  try {
    setIsLoading(true);
    const user = await getCurrentUser();

    if (user) {
      const { success, inquiries, error } = await getLandlordInquiries(user.id);

      if (success) {
        const formattedMessages = inquiries.map(inq => ({
          id: inq.id,
          conversationId: inq.conversation_id,  // ❌ May not exist!
          tenantId: inq.tenant_id,
          tenant: {
            // ❌ Accessing wrong properties
            name: `${inq.tenant?.first_name} ${inq.tenant?.last_name}`,
            email: inq.tenant?.email,
            phone: inq.tenant?.phone,
            image: inq.tenant?.profile_image_url,  // ❌ Not in returned data
          },
          houseName: inq.listing?.title,
          // ... other fields
        }));
        setMessages(formattedMessages);
      }
    }
  } finally {
    setIsLoading(false);
  }
};
```

**Problems:**
- ❌ Tries to use `inq.conversation_id` which doesn't exist
- ❌ Doesn't fetch conversation ID from database
- ❌ profile_image_url not included in query
- ❌ No error handling for missing tenant data

### AFTER (FIXED ✅)
```javascript
const loadInquiries = async () => {
  try {
    setIsLoading(true);
    const user = await getCurrentUser();

    if (user) {
      const { success, inquiries, error } = await getLandlordInquiries(user.id);

      if (success) {
        const formattedMessages = inquiries.map(inq => ({
          id: inq.id,
          // ✅ Use conversation_id returned from getLandlordInquiries
          conversationId: inq.conversation_id || inq.id,
          tenantId: inq.tenant_id,
          tenant: {
            id: inq.tenant?.id,
            // ✅ Use .trim() for safety
            name: `${inq.tenant?.first_name || ''} ${inq.tenant?.last_name || ''}`.trim(),
            email: inq.tenant?.email,
            phone: inq.tenant?.phone,
            // ✅ Now included in query result
            image: inq.tenant?.profile_image_url,
          },
          houseName: inq.listing?.title || 'Property',
          property: inq.listing?.title || 'Property',  // ✅ Fallback
          listing_id: inq.listing_id,
          type: inq.inquiry_type || 'booking',  // ✅ Fallback
          status: inq.status || 'open',  // ✅ Fallback
          lastMessage: inq.message || inq.subject || 'No message',  // ✅ Fallback
          time: inq.created_at,
          unread: !inq.read,
        }));
        setMessages(formattedMessages);
      } else {
        Alert.alert('Error', error || 'Failed to load inquiries');
        setMessages([]);
      }
    }
  } catch (e) {
    console.error('Failed to load inquiries', e);
    setMessages([]);
  } finally {
    setIsLoading(false);
  }
};
```

**Fixed:**
- ✅ Uses conversation_id from backend function
- ✅ Includes fallback values for missing data
- ✅ profile_image_url included
- ✅ Better error handling
- ✅ Safe string concatenation with .trim()

---

## 6. Backend - getLandlordInquiries Function

### BEFORE (INCOMPLETE ❌)
```javascript
export const getLandlordInquiries = async (userId) => {
  try {
    const { data: landlordProfile } = await supabase
      .from('landlord_profile')
      .select('id')
      .eq('user_id', userId)
      .single()

    const { data, error } = await supabase
      .from('inquiries')
      .select(`
        *,
        listing:listing_id(id, title),
        tenant_profile:tenant_id(id, user_id),
        // ❌ Missing profile_image_url!
        tenant_users:tenant_id(user:user_id(id, first_name, last_name, email, phone))
      `)
      .eq('landlord_id', landlordProfile.id)
      .order('created_at', { ascending: false })

    // ❌ Doesn't fetch conversation_id
    const inquiries = data?.map(inquiry => ({
      ...inquiry,
      tenant: inquiry.tenant_users?.user ? {
        id: inquiry.tenant_profile?.id,
        first_name: inquiry.tenant_users.user.first_name,
        last_name: inquiry.tenant_users.user.last_name,
        email: inquiry.tenant_users.user.email,
        phone: inquiry.tenant_users.user.phone,
        // ❌ profile_image_url missing
      } : null
    })) || []

    return { success: true, inquiries, error: null }
  } catch (error) {
    return { success: false, inquiries: [], error: error.message }
  }
}
```

**Problems:**
- ❌ Doesn't include profile_image_url in query
- ❌ Doesn't fetch corresponding conversation_id
- ❌ Frontend can't link to chat

### AFTER (FIXED ✅)
```javascript
export const getLandlordInquiries = async (userId) => {
  try {
    const { data: landlordProfile, error: profileError } = await supabase
      .from('landlord_profile')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (profileError || !landlordProfile) {
      throw profileError
    }

    const landlordProfileId = landlordProfile.id

    const { data, error } = await supabase
      .from('inquiries')
      .select(`
        *,
        listing:listing_id(id, title),
        tenant_profile:tenant_id(id, user_id),
        // ✅ Include profile_image_url!
        tenant_users:tenant_id(user:user_id(id, first_name, last_name, email, phone, profile_image_url))
      `)
      .eq('landlord_id', landlordProfileId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // ✅ Fetch conversation for each inquiry
    const inquiries = await Promise.all((data || []).map(async (inquiry) => {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', inquiry.tenant_id)
        .eq('landlord_id', landlordProfileId)
        .eq('listing_id', inquiry.listing_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .catch(() => ({ data: null }))

      return {
        ...inquiry,
        // ✅ Set conversation_id from lookup
        conversation_id: conversation?.id,
        tenant: inquiry.tenant_users?.user ? {
          id: inquiry.tenant_profile?.id,
          first_name: inquiry.tenant_users.user.first_name,
          last_name: inquiry.tenant_users.user.last_name,
          email: inquiry.tenant_users.user.email,
          phone: inquiry.tenant_users.user.phone,
          // ✅ Include profile_image_url!
          profile_image_url: inquiry.tenant_users.user.profile_image_url,
        } : null,
      }
    }))

    return { success: true, inquiries, error: null }
  } catch (error) {
    return { success: false, inquiries: [], error: error.message }
  }
}
```

**Fixed:**
- ✅ Includes profile_image_url in query
- ✅ Fetches conversation_id for each inquiry
- ✅ Proper error handling
- ✅ Returns all data needed for UI

---

## Summary of Key Changes

| Issue | Before | After |
|-------|--------|-------|
| **Tenant profile ID** | `user.id` ❌ | `profile.id` ✅ |
| **Message fetching** | `getMessages(user.id, landlordId, houseId)` ❌ | `getMessages(conversationId)` ✅ |
| **Message comparison** | `item.sender === currentUser?.id` ❌ | `item.sender_id === currentUser?.id` ✅ |
| **Avatar access** | Not available ❌ | `item.sender.profile_image_url` ✅ |
| **Message layout** | Single view ❌ | Flex layout with avatar ✅ |
| **Conversation ID** | Lookup fails ❌ | Fetched from DB ✅ |
| **Profile images** | Not queried ❌ | Included in query ✅ |
| **Error handling** | Minimal ❌ | Comprehensive ✅ |


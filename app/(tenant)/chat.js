import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  supabase,
  getCurrentUser,
  getConversations,
  getMessages,
  sendMessage,
  uploadProfileImage,
  uploadMessageImage,
  subscribeToMessages,
  getUserProfile,
  deleteConversation,
} from '../../lib/supabaseClient';
import { saveTenantMessages, addMessageToCache } from '../../lib/messageCache';
import FullScreenImageModal from '../../components/FullScreenImageModal';

export default function ChatScreen() {
  const { conversationId: routeConversationId } = useLocalSearchParams();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [conversationId, setConversationId] = useState(routeConversationId || null);
  const [conversationStatus, setConversationStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [landlordInfo, setLandlordInfo] = useState(null);
  const [houseName, setHouseName] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null); // Tenant's own profile
  const [expandedImageUri, setExpandedImageUri] = useState(null);

  useEffect(() => {
    loadConversation();
    
    return () => {
      // Cleanup subscription on unmount
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [routeConversationId]);

  const loadConversation = async () => {
    try {
      setIsLoading(true);
      setMessages([]);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);

      // Fetch tenant's own profile for displaying their avatar
      try {
        const { data: tenantUserData } = await supabase
          .from('users')
          .select('id, first_name, last_name, profile_image_url')
          .eq('id', user.id)
          .single();
        
        if (tenantUserData) {
          setTenantInfo({
            name: `${tenantUserData.first_name} ${tenantUserData.last_name}`,
            image: tenantUserData.profile_image_url,
          });
        }
      } catch (err) {
        console.log('Could not fetch tenant profile:', err);
      }

      // Use conversationId from route params - this is CRITICAL for conversation isolation
      const convId = routeConversationId;

      if (!convId) {
        Alert.alert('Error', 'Conversation ID is missing');
        setIsLoading(false);
        return;
      }

      // Fetch messages for this specific conversation
      const { success, messages: messagesData, error } = await getMessages(convId);

      if (!success || !messagesData) {
        Alert.alert('Error', error || 'Failed to load messages');
        setIsLoading(false);
        return;
      }

      // Get landlord and property info from first message or last conversation update
      let landlordInfoSet = false;
      if (messagesData.length > 0) {
        // Get info from first message
        const firstMessage = messagesData[0];
        if (firstMessage.receiver && firstMessage.sender_id === user.id) {
          // Current user is sender, receiver is landlord
          setLandlordInfo({
            name: `${firstMessage.receiver.first_name} ${firstMessage.receiver.last_name}`,
            image: firstMessage.receiver.profile_image_url,
          });
          landlordInfoSet = true;
        } else if (firstMessage.sender && firstMessage.receiver_id === user.id) {
          // Current user is receiver, sender is landlord
          setLandlordInfo({
            name: `${firstMessage.sender.first_name} ${firstMessage.sender.last_name}`,
            image: firstMessage.sender.profile_image_url,
          });
          landlordInfoSet = true;
        }

        // Extract property name from conversation data
        if (firstMessage.conversation?.listing?.title) {
          setHouseName(firstMessage.conversation.listing.title);
        }
      }
      
      // If we couldn't get landlord info from messages, fetch it from conversation directly
      if (!landlordInfoSet) {
        const { data: conversationData } = await supabase
          .from('conversations')
          .select(`
            tenant_id,
            landlord:landlord_id(
              user_id,
              users:user_id(id, first_name, last_name, profile_image_url)
            ),
            listing:listing_id(id, title)
          `)
          .eq('id', convId)
          .single();
        
        if (conversationData?.landlord?.users) {
          const landlordUser = conversationData.landlord.users;
          setLandlordInfo({
            name: `${landlordUser.first_name} ${landlordUser.last_name}`,
            image: landlordUser.profile_image_url,
          });
        }
        
        if (conversationData?.listing?.title) {
          setHouseName(conversationData.listing.title);
        }
      }

      // Transform messages to include sender profile data
      const transformedMessages = messagesData.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        sender: msg.sender,
        receiver: msg.receiver,
        text: msg.message_text,
        image: msg.media_url,
        timestamp: msg.created_at,
        type: msg.message_type,
        conversation_id: convId,
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setMessages(transformedMessages);
      
      // 💾 PERMANENTLY SAVE MESSAGES with conversation_id
      await saveTenantMessages(convId, transformedMessages);
      setConversationId(convId);

      // Unsubscribe from previous subscription if exists
      if (subscription) {
        subscription.unsubscribe();
      }

      // Subscribe to real-time messages for THIS specific conversation only
      const newSubscription = subscribeToMessages(convId, async (newMsg) => {
        console.log(`[Chat] New message in conversation ${convId}:`, newMsg);
        
        // Fetch sender and receiver profiles for the new message
        let senderProfile = null;
        let receiverProfile = null;
        
        try {
          if (newMsg.sender_id) {
            const { data: sender, error: senderError } = await supabase
              .from('users')
              .select('id, first_name, last_name, profile_image_url, email')
              .eq('id', newMsg.sender_id)
              .single();
            
            if (senderError) {
              console.warn('[Chat] Error fetching sender profile:', senderError);
            } else {
              senderProfile = sender;
            }
          }
          
          if (newMsg.receiver_id) {
            const { data: receiver, error: receiverError } = await supabase
              .from('users')
              .select('id, first_name, last_name, profile_image_url, email')
              .eq('id', newMsg.receiver_id)
              .single();
            
            if (receiverError) {
              console.warn('[Chat] Error fetching receiver profile:', receiverError);
            } else {
              receiverProfile = receiver;
            }
          }
        } catch (error) {
          console.error('[Chat] Error fetching message profiles:', error);
        }
        
        const transformedMsg = {
          id: newMsg.id,
          sender_id: newMsg.sender_id,
          sender: senderProfile,
          receiver: receiverProfile,
          text: newMsg.message_text,
          image: newMsg.media_url,
          timestamp: newMsg.created_at,
          type: newMsg.message_type,
          conversation_id: convId,
        };
        
        console.log('[Chat] Transformed message:', transformedMsg);
        
        setMessages(prev => {
          // Remove optimistic message if it matches (same sender, text, and within 3 seconds)
          const filtered = prev.filter(m => {
            if (!m.id.toString().startsWith('temp-')) return true;
            const timeDiff = Math.abs(new Date(m.timestamp) - new Date(transformedMsg.timestamp));
            const isSameContent = m.sender_id === transformedMsg.sender_id && 
                                  m.text === transformedMsg.text && 
                                  m.image === transformedMsg.image;
            return !(isSameContent && timeDiff < 3000);
          });
          // Deduplicate by ID (prevent double-add if subscription fires twice)
          if (filtered.some(m => m.id === transformedMsg.id)) return filtered;
          return [transformedMsg, ...filtered];
        });
        
        // 💾 SAVE NEW MESSAGE to cache
        addMessageToCache('tenant', convId, transformedMsg);
        
        // 🔄 UPDATE LANDLORD INFO if message is from landlord (refreshes profile picture)
        if (transformedMsg.sender_id !== user.id && transformedMsg.sender) {
          console.log('[Chat] Updating landlord info with new profile:', transformedMsg.sender);
          setLandlordInfo({
            name: `${transformedMsg.sender.first_name} ${transformedMsg.sender.last_name}`,
            image: transformedMsg.sender.profile_image_url,
          });
        }
      });

      setSubscription(newSubscription);
    } catch (error) {
      console.error('Failed to load conversation', error);
      Alert.alert('Error', 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Sorry, we need camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await sendMessageToLandlord('', result.assets[0].uri);
      }
    } catch (err) {
      console.error('Image pick error', err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const sendMessageToLandlord = async (text = '', imageUri = '') => {
    if (!text.trim() && !imageUri) return;

    try {
      if (!conversationId || !currentUser) {
        Alert.alert('Error', 'Conversation not loaded. Please try again.');
        return;
      }

      // Fetch user's full profile to get image
      const { success: profileSuccess, user: userProfile } = await getUserProfile(currentUser.id);
      
      // Upload message image if provided
      let imageUrl = null;
      if (imageUri) {
        const uploadResult = await uploadMessageImage(imageUri, currentUser.id);
        console.log('[Chat] uploadResult:', uploadResult);
        if (uploadResult.success) {
          imageUrl = uploadResult.publicUrl;
        } else {
          Alert.alert('Error', 'Failed to upload image');
          return;
        }
      }

      // Clear input first (so user sees it's been sent)
      setNewMessage('');

      // Create optimistic message object for immediate display
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        sender_id: currentUser.id,
        sender: {
          id: currentUser.id,
          first_name: userProfile?.first_name || currentUser.user_metadata?.first_name || 'You',
          last_name: userProfile?.last_name || currentUser.user_metadata?.last_name || '',
          profile_image_url: userProfile?.profile_image_url || currentUser.user_metadata?.profile_image_url,
        },
        receiver: landlordInfo,
        text: text.trim() || null,
        image: imageUrl || null,
        timestamp: new Date().toISOString(),
        type: imageUrl ? 'image' : 'text',
      };

      // Show message immediately (optimistic update)
      setMessages(prev => [optimisticMessage, ...prev]);

      // Send message to Supabase with conversation ID
      const sendRes = await sendMessage(
        conversationId,
        currentUser.id,
        text.trim() || null,
        imageUrl
      );
      console.log('[Chat] sendRes:', sendRes);
      if (!sendRes.success) {
        // Remove optimistic message if send failed
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        Alert.alert('Error', sendRes.error || 'Failed to send message');
      }
      // On success, real-time subscription will replace the optimistic message with the actual one
    } catch (error) {
      console.error('Failed to send message', error);
      // Remove optimistic message on error
      setMessages(messages => messages.filter(msg => msg.id !== optimisticMessage.id));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleSend = useCallback(() => {
    sendMessageToLandlord(newMessage);
  }, [newMessage, conversationId, currentUser]);

  const handleDeleteConversation = () => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Attempt server-side deletion of conversation and messages
              const user = await getCurrentUser();
              if (user && user.id) {
                const res = await deleteConversation(conversationId, user.id, true);
                if (!res.success) {
                  throw new Error(res.error || 'Failed to delete conversation on server');
                }
              }

              setMessages([]);
              router.back();
              Alert.alert('Deleted', 'Conversation has been deleted.');
            } catch (e) {
              console.error('Failed to delete conversation', e);
              Alert.alert('Error', 'Failed to delete conversation.');
            }
          }
        }
      ]
    );
  };

  const openImagePreview = (uri) => {
    if (!uri) return;
    setExpandedImageUri(uri);
  };

  const closeImagePreview = () => setExpandedImageUri(null);

  // Format timestamp to readable format
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return `Yesterday ${timeStr}`;
    } else {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = currentUser && item.sender_id === currentUser.id;
    const senderProfile = item.sender;
    const senderAvatar = senderProfile?.profile_image_url;
    // 🔄 Use tenantInfo for tenant's own messages (my messages)
    const myAvatar = tenantInfo?.image || senderAvatar;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {/* Other person's avatar (landlord) - left side */}
        {!isMyMessage && senderAvatar && (
          <Image source={{ uri: senderAvatar }} style={styles.senderAvatar} />
        )}
        {!isMyMessage && !senderAvatar && (
          <View style={[styles.senderAvatar, styles.defaultAvatar]}>
            <Ionicons name="person-circle" size={32} color="#ccc" />
          </View>
        )}

        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          {item.image ? (
            <TouchableOpacity onPress={() => openImagePreview(item.image)}>
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </TouchableOpacity>
          ) : (
            <Text
              style={
                isMyMessage
                  ? styles.myMessageText
                  : styles.otherMessageText
              }
            >
              {item.text || ''}
            </Text>
          )}
          <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>

        {/* My avatar (tenant) - right side */}
        {isMyMessage && myAvatar && (
          <Image source={{ uri: myAvatar }} style={styles.senderAvatar} />
        )}
        {isMyMessage && !myAvatar && (
          <View style={[styles.senderAvatar, styles.defaultAvatar]}>
            <Ionicons name="person-circle" size={32} color="#ccc" />
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tenant)/messages')}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        {landlordInfo?.image && <Image source={{ uri: landlordInfo.image }} style={styles.avatar} />}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{landlordInfo?.name || 'Loading...'}</Text>
          {houseName && <Text style={styles.headerSubtitle}>Regarding: {houseName}</Text>}
          {conversationStatus ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {conversationStatus === 'ready_to_book' ? 'Booking Request' : (conversationStatus === 'interested' ? 'Interested' : conversationStatus)}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={{ padding: 8 }} onPress={handleDeleteConversation}>
          <Ionicons name="trash" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        inverted
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color="#667eea" />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type your message..."
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FullScreenImageModal
        visible={!!expandedImageUri}
        imageUri={expandedImageUri}
        onClose={closeImagePreview}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 10,
  },
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
    maxWidth: '70%',
  },
  myMessageBubble: {
    backgroundColor: '#667eea',
  },
  otherMessageBubble: {
    backgroundColor: '#e5e7eb',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
  },
  myMessageText: {
    color: 'white',
    fontSize: 16,
  },
  otherMessageText: {
    color: '#333',
    fontSize: 16,
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.5)',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: 'rgba(0,0,0,0.5)',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusBadge: {
    marginTop: 6,
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    backgroundColor: 'white',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#667eea',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
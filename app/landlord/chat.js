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
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  supabase,
  getCurrentUser,
  sendMessage,
  getMessages,
  subscribeToMessages,
  getUserProfile,
  uploadMessageImage,
  getListing,
  createBooking,
  markMessagesAsRead,
} from '../../lib/supabaseClient';
import { saveLandlordMessages, addMessageToCache } from '../../lib/messageCache';
import { getCachedLandlordProfile } from '../../lib/profileCache';
import FullScreenImageModal from '../../components/FullScreenImageModal';

export default function LandlordChat() {
  const { id, conversationId: routeConversationId, tenantId: paramTenantId, tenantName, tenantImage, property: routeProperty } = useLocalSearchParams();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  // Tenant Info State
  const [tenantInfo, setTenantInfo] = useState(null);
  
  // Landlord's Own Profile Info
  const [landlordInfo, setLandlordInfo] = useState(null);
  
  // Property Details State
  const [propertyPrice, setPropertyPrice] = useState(0);
  const [currentProperty, setCurrentProperty] = useState(routeProperty || ''); 
  const [listingId, setListingId] = useState(null);
  
  const [tenantProfileId, setTenantProfileId] = useState(null);
  const [landlordProfileId, setLandlordProfileId] = useState(null);
  const [conversationId, setConversationId] = useState(routeConversationId || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [expandedImageUri, setExpandedImageUri] = useState(null);

  useEffect(() => {
    loadConversation();
  }, [id, paramTenantId, routeProperty, routeConversationId]);

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

      // 1. Get Landlord Profile with user info
      let { data: landlordProfile, error: profileError } = await supabase
        .from('landlord_profile')
        .select(`
          id,
          user_id,
          users:user_id(id, first_name, last_name, profile_image_url)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      // If no profile exists, create one
      if (!landlordProfile && !profileError) {
        console.log('[Chat] No landlord profile found, creating one...');
        
        // First, ensure user exists in users table
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        
        if (!existingUser) {
          console.log('[Chat] User not in users table, checking by email...');
          
          // Check if user exists with same email (different ID)
          const { data: emailUser } = await supabase
            .from('users')
            .select('id, user_type')
            .eq('email', user.email || '')
            .maybeSingle();
          
          if (emailUser) {
            console.log('[Chat] User found by email, checking for landlord profile...');
            
            // Check if landlord profile exists for this user
            const { data: existingProfile } = await supabase
              .from('landlord_profile')
              .select(`
                id,
                user_id,
                users:user_id(id, first_name, last_name, profile_image_url)
              `)
              .eq('user_id', emailUser.id)
              .maybeSingle();
            
            if (existingProfile) {
              landlordProfile = existingProfile;
            } else {
              // Create landlord profile for existing user
              console.log('[Chat] Creating landlord profile for existing user...');
              const { error: createProfileError } = await supabase
                .from('landlord_profile')
                .insert({ user_id: emailUser.id });
              
              if (!createProfileError) {
                const { data: newProfile } = await supabase
                  .from('landlord_profile')
                  .select(`
                    id,
                    user_id,
                    users:user_id(id, first_name, last_name, profile_image_url)
                  `)
                  .eq('user_id', emailUser.id)
                  .single();
                landlordProfile = newProfile;
              }
            }
          } else {
            // Create new user
            const { error: userCreateError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email || '',
                phone: user.user_metadata?.phone || '',
                user_type: 'landlord',
                first_name: user.user_metadata?.first_name || '',
                last_name: user.user_metadata?.last_name || '',
              });
            
            if (userCreateError) {
              console.error('[Chat] Failed to create user:', userCreateError);
            }
          }
        }
        
        const { error: createError } = await supabase
          .from('landlord_profile')
          .insert({ user_id: user.id });
        
        if (!createError) {
          // Fetch the newly created profile
          const { data: newProfile } = await supabase
            .from('landlord_profile')
            .select(`
              id,
              user_id,
              users:user_id(id, first_name, last_name, profile_image_url)
            `)
            .eq('user_id', user.id)
            .single();
          landlordProfile = newProfile;
        }
      }

      if (profileError || !landlordProfile) {
        console.error('Error fetching landlord profile:', profileError);
        setIsLoading(false);
        return;
      }
      setLandlordProfileId(landlordProfile.id);
      
      // Set landlord's own profile info for displaying in messages
      // Try multiple sources: database join, direct user fetch, then cache
      let landlordImageUrl = landlordProfile.users?.profile_image_url;
      let landlordFirstName = landlordProfile.users?.first_name;
      let landlordLastName = landlordProfile.users?.last_name;
      
      console.log('[Chat] Landlord profile from join:', landlordProfile.users);
      
      // If no image from join, try direct users table query
      if (!landlordImageUrl) {
        console.log('[Chat] No image from join, trying direct users query...');
        const { data: directUserData } = await supabase
          .from('users')
          .select('id, first_name, last_name, profile_image_url')
          .eq('id', user.id)
          .single();
        
        if (directUserData?.profile_image_url) {
          landlordImageUrl = directUserData.profile_image_url;
          landlordFirstName = directUserData.first_name;
          landlordLastName = directUserData.last_name;
          console.log('[Chat] Got landlord image from direct query:', landlordImageUrl);
        }
      }
      
      // If still no image, try to get from cache
      if (!landlordImageUrl) {
        console.log('[Chat] No image from database, trying cache...');
        try {
          const cachedProfile = await getCachedLandlordProfile();
          if (cachedProfile?.userData?.profile_image_url) {
            landlordImageUrl = cachedProfile.userData.profile_image_url;
            console.log('[Chat] Using cached landlord profile image:', landlordImageUrl);
          }
        } catch (cacheErr) {
          console.log('[Chat] No cached landlord profile found');
        }
      }
      
      console.log('[Chat] Final landlord image URL:', landlordImageUrl);
      
      setLandlordInfo({
        id: user.id,
        first_name: landlordFirstName || '',
        last_name: landlordLastName || '',
        profile_image_url: landlordImageUrl,
      });

      // 2. Resolve Conversation ID
      let targetConversationId = routeConversationId;

      if (!targetConversationId) {
        const targetTenantId = id || paramTenantId;
        if (targetTenantId) {
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id, listing_id, tenant_id')
            .eq('landlord_id', landlordProfile.id)
            .eq('tenant_id', targetTenantId)
            .maybeSingle();

          if (existingConv) {
            targetConversationId = existingConv.id;
          }
        }
      }

      if (!targetConversationId) {
        Alert.alert('Notice', 'Conversation not found.');
        setIsLoading(false);
        return;
      }

      setConversationId(targetConversationId);

      // 3. Fetch Conversation Details & Property Info
      const { data: conversationData } = await supabase
        .from('conversations')
        .select('listing_id, tenant_id')
        .eq('id', targetConversationId)
        .single();

      if (conversationData?.listing_id) {
        setListingId(conversationData.listing_id);
        
        // Fetch listing details (Price AND Title)
        const { success: listingSuccess, listing } = await getListing(conversationData.listing_id);
        if (listingSuccess && listing) {
          setPropertyPrice(listing.price_per_month || listing.price || 0);
          if (!currentProperty) {
            setCurrentProperty(listing.title || listing.name || 'Property');
          }
        }
      }

      if (conversationData?.tenant_id) {
        setTenantProfileId(conversationData.tenant_id);
        
        // 🔄 FETCH TENANT INFO to display in header
        const { data: tenantProfileData } = await supabase
          .from('tenant_profile')
          .select(`
            id,
            user_id,
            users:user_id(id, first_name, last_name, profile_image_url)
          `)
          .eq('id', conversationData.tenant_id)
          .single();
        
        if (tenantProfileData?.users) {
          const tenantUser = tenantProfileData.users;
          setTenantInfo({
            name: `${tenantUser.first_name} ${tenantUser.last_name}`,
            image: tenantUser.profile_image_url,
          });
        }
      }

      // 4. Fetch Messages
      const { success, messages: messagesData, error } = await getMessages(targetConversationId);

      if (!success || !messagesData) {
        Alert.alert('Error', error || 'Failed to load messages');
        setIsLoading(false);
        return;
      }

      const transformedMessages = messagesData.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        sender: msg.sender,
        receiver: msg.receiver,
        text: msg.message_text,
        image: msg.media_url,
        timestamp: msg.created_at,
        type: msg.message_type,
        conversation_id: targetConversationId,
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setMessages(transformedMessages);
      
      // 💾 PERMANENTLY SAVE MESSAGES with conversation_id
      await saveLandlordMessages(targetConversationId, transformedMessages);

      // Mark all messages as read for landlord
      await markMessagesAsRead(targetConversationId, user.id, 'landlord');

      const subscription = subscribeToMessages(targetConversationId, async (newMsg) => {
        try {
          if (!newMsg) {
            console.warn('[Landlord Chat] Received empty realtime payload');
            return;
          }
          if (!newMsg.id) {
            console.warn('[Landlord Chat] Payload missing id, skipping:', newMsg);
            return;
          }

          console.log(`[Landlord Chat] New message in conversation ${targetConversationId}:`, newMsg);
          
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
                console.warn('[Landlord Chat] Error fetching sender profile:', senderError);
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
                console.warn('[Landlord Chat] Error fetching receiver profile:', receiverError);
              } else {
                receiverProfile = receiver;
              }
            }
          } catch (profileError) {
            console.error('[Landlord Chat] Error fetching message profiles:', profileError);
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
            conversation_id: targetConversationId,
          };
          
          console.log('[Landlord Chat] Transformed message:', transformedMsg);
          
          setMessages(prev => {
            try {
              const basePrev = Array.isArray(prev) ? prev : [];
              const sanitizedPrev = basePrev.filter(entry => {
                const isValid = entry && typeof entry === 'object';
                if (!isValid) {
                  console.warn('[Landlord Chat] Dropping invalid message entry:', entry);
                }
                return isValid;
              });

              const filtered = sanitizedPrev.filter(existingMsg => {
                const existingId = existingMsg?.id;
                if (!existingId) return true;
                if (!existingId.toString().startsWith('temp-')) return true;

                const sameSender = existingMsg?.sender_id === transformedMsg.sender_id;
                const sameText = (existingMsg?.text || '') === (transformedMsg.text || '');
                const sameImage = (existingMsg?.image || '') === (transformedMsg.image || '');
                return !(sameSender && sameText && sameImage);
              });

              const alreadyExists = filtered.some(existing => existing?.id === transformedMsg.id);
              if (alreadyExists) return filtered;
              return [transformedMsg, ...filtered];
            } catch (stateError) {
              console.error('[Landlord Chat] Message state reducer failed:', stateError);
              return Array.isArray(prev) ? prev : [];
            }
          });
          // 💾 SAVE NEW MESSAGE to cache
          addMessageToCache('landlord', targetConversationId, transformedMsg);
          
          // 🔄 UPDATE TENANT INFO if message is from tenant (refreshes profile picture)
          const landlordUserId = currentUser?.id ?? user?.id ?? null;
          if (landlordUserId && transformedMsg.sender_id !== landlordUserId && transformedMsg.sender) {
            console.log('[Landlord Chat] Updating tenant info with new profile:', transformedMsg.sender);
            setTenantInfo({
              name: `${transformedMsg.sender.first_name} ${transformedMsg.sender.last_name}`,
              image: transformedMsg.sender.profile_image_url,
            });
          }
        } catch (error) {
          console.error('[Landlord Chat] Realtime handler error:', error);
        }
      });

      return () => {
        if (subscription) subscription.unsubscribe();
      };
    } catch (e) {
      console.error('Failed to load landlord conversation', e);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = () => {
    Alert.alert('Delete', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => router.back() }
    ]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
        await sendLandlordMessage('', result.assets[0].uri);
    }
  };

  const openImagePreview = (uri) => {
    if (!uri) return;
    setExpandedImageUri(uri);
  };

  const closeImagePreview = () => setExpandedImageUri(null);

  const sendLandlordMessage = async (text = '', imageUri = '') => {
    if (!text.trim() && !imageUri) return;
    if (!conversationId || !currentUser) return;

    let optimisticMessage = null;

    try {
      const { success: profileSuccess, user: userProfile } = await getUserProfile(currentUser.id);
      
      let imageUrl = null;
      if (imageUri) {
        const uploadResult = await uploadMessageImage(imageUri, currentUser.id);
        console.log('[LandlordChat] uploadResult:', uploadResult);
        if (uploadResult.success) imageUrl = uploadResult.publicUrl;
      }

      setNewMessage('');

      optimisticMessage = {
        id: `temp-${Date.now()}`,
        sender_id: currentUser.id,
        sender: {
          id: currentUser.id,
          first_name: userProfile?.first_name || 'You',
          last_name: userProfile?.last_name || '',
          profile_image_url: userProfile?.profile_image_url,
        },
        text: text.trim() || null,
        image: imageUrl || null,
        timestamp: new Date().toISOString(),
        type: imageUrl ? 'image' : 'text',
      };

      setMessages(prev => [optimisticMessage, ...((prev || []).filter(Boolean))]);

      const sendRes = await sendMessage(conversationId, currentUser.id, text.trim() || null, imageUrl);
      console.log('[LandlordChat] sendRes:', sendRes);
      if (!sendRes.success) {
        setMessages(prev => (prev || []).filter(msg => msg && msg.id !== optimisticMessage.id));
        Alert.alert('Error', sendRes.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message', error);
      if (optimisticMessage) {
        setMessages(prev => (prev || []).filter(msg => msg && msg.id !== optimisticMessage.id));
      }
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleSend = useCallback(() => {
    sendLandlordMessage(newMessage);
  }, [newMessage, conversationId, currentUser]);

  // --- APPROVE BOOKING LOGIC ---
  const handleApproveBooking = async (bookingMessage) => {
    try {
      // 1. CHECK: Is this chat linked to a property?
      if (!listingId) {
        Alert.alert(
          "Missing Property Info", 
          "This chat isn't linked to a specific property in the database, so we can't create a booking record. Please ask the tenant to inquire from a specific listing page."
        );
        return;
      }

      const finalAmount = bookingMessage.amount > 0 ? bookingMessage.amount : propertyPrice;

      if (tenantProfileId && landlordProfileId) {
        let bookingDateStr = null;
        if (bookingMessage.bookingDate && bookingMessage.bookingDate !== 'Not specified') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (dateRegex.test(bookingMessage.bookingDate)) {
            bookingDateStr = bookingMessage.bookingDate;
          }
        }

        // 2. PREPARE DATA
        const bookingData = {
          listingId: listingId,
          tenantId: tenantProfileId,
          landlordId: landlordProfileId,
          moveInDate: bookingDateStr || new Date().toISOString(), // Fallback to today if missing
          moveOutDate: null,
          numberOfGuests: parseInt(bookingMessage.bookingGuests) || 1,
          specialRequests: bookingMessage.text || '',
          totalAmount: finalAmount,
          status: 'approved' // <--- CRITICAL: Must be 'approved' to show in Tenant List
        };

        console.log("Attempting to create booking:", bookingData);

        // 3. SAVE TO DATABASE
        const bookingResult = await createBooking(bookingData);
        
        if (!bookingResult.success) {
          console.error('Create Booking Failed:', bookingResult.error);
          Alert.alert('Database Error', 'Could not save the booking. Please try again.');
          return; 
        }
        console.log("Booking created successfully!");
      } else {
        Alert.alert("Error", "Missing Tenant or Landlord profile ID.");
        return;
      }

      // 4. SEND CONFIRMATION MESSAGE
      const displayDate = bookingMessage.bookingDate && bookingMessage.bookingDate !== 'Not specified' 
        ? bookingMessage.bookingDate 
        : 'To be confirmed';
      
      const approvalMessage = `✅ Booking Approved! \n\nYour booking for ${currentProperty} has been approved. \n\n📅 Move-in date: ${displayDate} \n👥 Guests: ${bookingMessage.bookingGuests || '1'} \n💰 Monthly Rent: ₱${finalAmount.toLocaleString()}`;
      
      await sendLandlordMessage(approvalMessage);

      setShowBookingModal(false);
      setSelectedBooking(null);
      
      Alert.alert(
        'Success', 
        'Booking approved! This tenant will now appear in your "My Tenants" list.'
      );
    } catch (error) {
      console.error('Failed to approve booking', error);
      Alert.alert('Error', 'Failed to approve booking.');
    }
  };

  const handleRejectBooking = async (bookingMessage) => {
    const rejectionMessage = `❌ Booking Declined \n\nUnfortunately, your booking request for ${currentProperty} cannot be accommodated at this time.`;
    await sendLandlordMessage(rejectionMessage);
    setShowBookingModal(false);
    setSelectedBooking(null);
  };

  const handleModifyBooking = async (bookingDetails) => {
    const modificationMessage = `📝 Booking Modification Requested \n\nI'd like to discuss some changes to your booking request for ${currentProperty}.`;
    sendLandlordMessage(modificationMessage);
    setShowBookingModal(false);
    setSelectedBooking(null);
  };

  const extractBookingDetails = (message) => {
    if (message.text && message.text.toLowerCase().includes('book')) {
      const amountMatch = message.text.match(/₱(\d+)/);
      const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
      
      const dateMatch = message.text.match(/\d{4}-\d{2}-\d{2}/);
      const date = dateMatch ? dateMatch[0] : 'Not specified';

      const guestMatch = message.text.match(/for (\d+) guest/);
      const guests = guestMatch ? guestMatch[1] : '1';

      const finalAmount = amount > 0 ? amount : propertyPrice;
      
      return {
        isBooking: true,
        text: message.text,
        bookingDate: date,
        bookingGuests: guests,
        amount: finalAmount,
        originalAmount: amount,
        usesPropertyPrice: amount === 0,
      };
    }
    return null;
  };

  const renderMessage = ({ item }) => {
    const bookingDetails = extractBookingDetails(item);
    const isMyMessage = currentUser && item.sender_id === currentUser.id;
    
    // For my messages (landlord), use landlordInfo; for other messages (tenant), use item.sender
    const senderProfile = isMyMessage ? landlordInfo : item.sender;
    const senderAvatar = senderProfile?.profile_image_url;
    
    // Debug logging
    if (isMyMessage) {
      console.log('[renderMessage] My message - landlordInfo:', JSON.stringify(landlordInfo));
      console.log('[renderMessage] senderAvatar:', senderAvatar);
    }

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMyMessage && senderAvatar && (
          <Image source={{ uri: senderAvatar }} style={styles.senderAvatar} />
        )}
        {!isMyMessage && !senderAvatar && (
          <View style={[styles.senderAvatar, styles.defaultAvatar]}>
            <Ionicons name="person-circle" size={32} color="#ccc" />
          </View>
        )}
        
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble]}>
          {/* Show image if present */}
          {item.image && (
            <TouchableOpacity onPress={() => openImagePreview(item.image)}>
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </TouchableOpacity>
          )}
          
          {/* Show text if present */}
          {item.text && (
            <Text style={isMyMessage ? styles.myMessageText : styles.otherMessageText}>{item.text}</Text>
          )}

          {bookingDetails?.isBooking && !isMyMessage && (
            <TouchableOpacity 
              style={styles.bookingActionButton}
              onPress={() => {
                setSelectedBooking(bookingDetails);
                setShowBookingModal(true);
              }}
            >
              <Text style={styles.bookingActionText}>Manage Booking</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.messageTime}>{formatMessageTime(item.timestamp)}</Text>
        </View>

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

  if (isLoading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#667eea"/></View>;
  }

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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/landlord/inquiries')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        {tenantInfo?.image && <Image source={{ uri: tenantInfo.image }} style={styles.avatar} />}
        <View>
            <Text style={styles.headerTitle}>{tenantInfo?.name || tenantName || 'Tenant'}</Text>
            <Text style={styles.headerSubtitle}>{currentProperty || 'Property Inquiry'}</Text>
        </View>
        <TouchableOpacity style={{ padding: 8, marginLeft: 'auto' }} onPress={handleDeleteConversation}>
          <Ionicons name="trash" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id.toString()}
        inverted
        renderItem={renderMessage}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={pickImage}><Ionicons name="image" size={24} color="#667eea" /></TouchableOpacity>
        <TextInput style={styles.textInput} value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." multiline />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}><Ionicons name="send" size={20} color="white" /></TouchableOpacity>
      </View>

      <FullScreenImageModal
        visible={!!expandedImageUri}
        imageUri={expandedImageUri}
        onClose={closeImagePreview}
      />

      <Modal visible={showBookingModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Booking Request</Text>
            <Text style={styles.modalSubtitle}>
              {tenantName} wants to book <Text style={{fontWeight: 'bold', color: '#333'}}>{currentProperty}</Text>
            </Text>
            
            {selectedBooking && (
              <View style={styles.bookingDetails}>
                <Text>Date: {selectedBooking.bookingDate}</Text>
                <Text>Rent: ₱{selectedBooking.amount}</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.rejectButton]} onPress={() => handleRejectBooking(selectedBooking)}>
                <Text style={styles.rejectButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.approveButton]} onPress={() => handleApproveBooking(selectedBooking)}>
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowBookingModal(false)} style={{marginTop:15, alignItems:'center'}}>
                <Text style={{color:'#666'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 50, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  headerSubtitle: { fontSize: 12, color: '#666', marginLeft: 10 },
  messageContainer: { flexDirection: 'row', marginVertical: 5, paddingHorizontal: 10 },
  myMessageContainer: { justifyContent: 'flex-end' },
  otherMessageContainer: { justifyContent: 'flex-start' },
  messageBubble: { padding: 10, borderRadius: 15, maxWidth: '75%' },
  myMessageBubble: { backgroundColor: '#667eea' },
  otherMessageBubble: { backgroundColor: '#e5e7eb' },
  myMessageText: { color: 'white' },
  otherMessageText: { color: 'black' },
  messageTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 5, opacity: 0.7 },
  messageImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 8 },
  senderAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 5 },
  defaultAvatar: { backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: 'white', alignItems: 'center' },
  textInput: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginHorizontal: 10 },
  sendButton: { backgroundColor: '#667eea', padding: 10, borderRadius: 20 },
  bookingActionButton: { backgroundColor: '#f59e0b', padding: 8, borderRadius: 5, marginTop: 5 },
  bookingActionText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  
  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitle: { marginBottom: 15, color: '#666' },
  bookingDetails: { backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
  approveButton: { backgroundColor: '#10b981' },
  rejectButton: { backgroundColor: '#ef4444' },
  approveButtonText: { color: 'white', fontWeight: 'bold' },
  rejectButtonText: { color: 'white', fontWeight: 'bold' },
});
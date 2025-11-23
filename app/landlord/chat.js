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
import { supabase } from '../../lib/supabaseClient';
import {
  getCurrentUser,
  sendMessage,
  getMessages,
  subscribeToMessages,
  uploadProfileImage,
  getUserProfile,
  uploadMessageImage,
  getListing,
  createBooking,
} from '../../lib/supabaseClient';

export default function LandlordChat() {
  const { conversationId: routeConversationId, tenantId, tenantName, tenantImage, property } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [propertyPrice, setPropertyPrice] = useState(0);
  const [listingId, setListingId] = useState(null);
  const [tenantProfileId, setTenantProfileId] = useState(null);
  const [landlordProfileId, setLandlordProfileId] = useState(null);
  const [conversationId, setConversationId] = useState(routeConversationId || null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadConversation();
  }, [tenantId, property, routeConversationId]);

  const loadConversation = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);

      // Fetch landlord profile to get landlord_profile.id
      const { data: landlordProfile } = await supabase
        .from('landlord_profile')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (landlordProfile?.id) {
        setLandlordProfileId(landlordProfile.id);
      }

      // Use conversationId from route params
      const convId = routeConversationId;

      if (!convId) {
        Alert.alert('Error', 'Conversation ID is missing');
        setIsLoading(false);
        return;
      }

      setConversationId(convId);

      // Fetch conversation details to get listing_id and tenant_id
      const { data: conversationData, error: convDataError } = await supabase
        .from('conversations')
        .select('listing_id, tenant_id')
        .eq('id', convId)
        .single();

      if (conversationData?.listing_id) {
        setListingId(conversationData.listing_id);
        // Fetch listing to get price
        const { success: listingSuccess, listing } = await getListing(conversationData.listing_id);
        if (listingSuccess && listing) {
          setPropertyPrice(listing.price_per_month || 0);
        }
      }

      if (conversationData?.tenant_id) {
        setTenantProfileId(conversationData.tenant_id);
      }

      // Fetch messages for this conversation
      const { success, messages: messagesData, error } = await getMessages(convId);

      if (!success || !messagesData) {
        Alert.alert('Error', error || 'Failed to load messages');
        setIsLoading(false);
        return;
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
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setMessages(transformedMessages);

      // Subscribe to real-time messages
      const subscription = subscribeToMessages(convId, (newMsg) => {
        const transformedMsg = {
          id: newMsg.id,
          sender_id: newMsg.sender_id,
          sender: newMsg.sender,
          receiver: newMsg.receiver,
          text: newMsg.message_text,
          image: newMsg.media_url,
          timestamp: newMsg.created_at,
          type: newMsg.message_type,
        };
        setMessages(prev => [transformedMsg, ...prev]);
      });

      return () => {
        if (subscription) subscription.unsubscribe();
      };
    } catch (e) {
      console.error('Failed to load landlord conversation', e);
      Alert.alert('Error', 'Failed to load conversation');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = () => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? This will remove it only from your inbox.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setMessages([]);
            router.back();
            Alert.alert('Deleted', 'Conversation has been deleted.');
          } catch (e) {
            console.error('Failed to delete landlord conversation', e);
            Alert.alert('Error', 'Failed to delete conversation.');
          }
        }}
      ]
    );
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
        await sendLandlordMessage('', result.assets[0].uri);
      }
    } catch (err) {
      console.error('Image pick error', err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const sendLandlordMessage = async (text = '', imageUri = '') => {
    if (!text.trim() && !imageUri) return;

    if (!conversationId || !currentUser) {
      Alert.alert('Error', 'Conversation not loaded. Please try again.');
      return;
    }

    try {
      // Fetch user's full profile to get image
      const { success: profileSuccess, user: userProfile } = await getUserProfile(currentUser.id);
      
      // Upload message image if provided
      let imageUrl = null;
      if (imageUri) {
        const uploadResult = await uploadMessageImage(imageUri, currentUser.id);
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
        receiver: null,
        text: text.trim() || null,
        image: imageUrl || null,
        timestamp: new Date().toISOString(),
        type: imageUrl ? 'image' : 'text',
      };

      // Show message immediately (optimistic update)
      setMessages([optimisticMessage, ...messages]);

      // Send message to Supabase with conversation ID
      const { success, error } = await sendMessage(
        conversationId,
        currentUser.id,
        text.trim() || null,
        imageUrl
      );

      if (!success) {
        // Remove optimistic message if send failed
        setMessages(messages => messages.filter(msg => msg.id !== optimisticMessage.id));
        Alert.alert('Error', error || 'Failed to send message');
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
    sendLandlordMessage(newMessage);
  }, [newMessage, conversationId, currentUser]);

  const handleApproveBooking = async (bookingMessage) => {
    try {
      // Calculate final amount (use property price if no specific amount mentioned)
      const finalAmount = bookingMessage.amount > 0 ? bookingMessage.amount : propertyPrice;

      // Create booking record in database
      if (listingId && tenantProfileId && landlordProfileId) {
        const bookingData = {
          listingId: listingId,
          tenantId: tenantProfileId,
          landlordId: landlordProfileId,
          moveInDate: bookingMessage.bookingDate || new Date().toISOString().split('T')[0],
          moveOutDate: null,
          numberOfGuests: parseInt(bookingMessage.bookingGuests) || 1,
          specialRequests: bookingMessage.text || '',
        };

        // Create the booking
        const bookingResult = await createBooking(bookingData);
        if (!bookingResult.success) {
          console.warn('Failed to create booking record:', bookingResult.error);
        } else {
          console.log('Booking created successfully:', bookingResult.booking);
        }
      }

      // Send approval message with amount details
      const approvalMessage = `✅ Booking Approved! \n\nYour booking for ${property} has been approved. \n\n📅 Move-in date: ${bookingMessage.bookingDate || 'Not specified'} \n👥 Guests: ${bookingMessage.bookingGuests || '1'} \n💰 Monthly Rent: ₱${finalAmount.toLocaleString()} \n\nWe'll contact you soon for the next steps and payment details.`;
      await sendLandlordMessage(approvalMessage);

      setShowBookingModal(false);
      setSelectedBooking(null);
      
      Alert.alert('Booking Approved', `The booking has been approved with monthly rent of ₱${finalAmount.toLocaleString()}.`);
    } catch (error) {
      console.error('Failed to approve booking', error);
      Alert.alert('Error', 'Failed to approve booking.');
    }
  };

  const handleRejectBooking = async (bookingMessage) => {
    const rejectionMessage = `❌ Booking Declined \n\nUnfortunately, your booking request for ${property} cannot be accommodated at this time. \n\nReason: ${bookingMessage.reason || 'Not available for the requested dates.'}`;
    await sendLandlordMessage(rejectionMessage);
    setShowBookingModal(false);
    setSelectedBooking(null);
  };

  const handleModifyBooking = async (bookingDetails) => {
    Alert.alert(
      'Modify Booking',
      'This would open a modification screen where you can adjust dates, pricing, or other details.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => {
          const modificationMessage = `📝 Booking Modification Requested \n\nI'd like to discuss some changes to your booking request. Let me know what works for you.`;
          sendLandlordMessage(modificationMessage);
          setShowBookingModal(false);
          setSelectedBooking(null);
        }}
      ]
    );
  };

  const extractBookingDetails = (message) => {
    // Simple parsing for booking messages
    if (message.text && message.text.toLowerCase().includes('book')) {
      const extractedAmount = extractAmount(message.text);
      const finalAmount = extractedAmount > 0 ? extractedAmount : propertyPrice;
      
      return {
        isBooking: true,
        text: message.text,
        bookingDate: extractDate(message.text),
        bookingGuests: extractGuests(message.text),
        amount: finalAmount,
        originalAmount: extractedAmount,
        usesPropertyPrice: extractedAmount === 0,
      };
    }
    return null;
  };

  const extractDate = (text) => {
    const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : 'Not specified';
  };

  const extractGuests = (text) => {
    const guestMatch = text.match(/for (\d+) guest/);
    return guestMatch ? guestMatch[1] : '1';
  };

  const extractAmount = (text) => {
    const amountMatch = text.match(/₱(\d+)/);
    return amountMatch ? parseInt(amountMatch[1]) : 0;
  };

  const renderMessage = ({ item }) => {
    const bookingDetails = extractBookingDetails(item);
    const isMyMessage = currentUser && item.sender_id === currentUser.id;
    const senderProfile = item.sender;
    const senderAvatar = senderProfile?.profile_image_url;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
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
            <TouchableOpacity onPress={() => Alert.alert('Image', 'View image full screen')}>
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </TouchableOpacity>
          ) : (
            <Text style={isMyMessage ? styles.myMessageText : styles.otherMessageText}>
              {item.text}
            </Text>
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

          <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
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
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        {tenantImage && <Image source={{ uri: tenantImage }} style={styles.avatar} />}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{tenantName}</Text>
          {property && <Text style={styles.headerSubtitle}>{property}</Text>}
        </View>
        <TouchableOpacity style={{ padding: 8 }} onPress={handleDeleteConversation}>
          <Ionicons name="trash" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        inverted
        contentContainerStyle={{ padding: 12 }}
        renderItem={renderMessage}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color="#667eea" />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a reply..."
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Booking Management Modal */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Booking Request</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowBookingModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {tenantName} wants to book {property}
            </Text>
            
            {selectedBooking && (
              <View style={styles.bookingDetails}>
                <Text style={styles.bookingDetail}>📅 Move-in Date: {selectedBooking.bookingDate}</Text>
                <Text style={styles.bookingDetail}>👥 Guests: {selectedBooking.bookingGuests}</Text>
                <Text style={styles.bookingDetail}>
                  💰 Monthly Rent: ₱{selectedBooking.amount.toLocaleString()}
                  {selectedBooking.usesPropertyPrice && (
                    <Text style={styles.priceNote}> (based on property listing)</Text>
                  )}
                  {!selectedBooking.usesPropertyPrice && selectedBooking.originalAmount > 0 && (
                    <Text style={styles.priceNote}> (as mentioned by tenant)</Text>
                  )}
                </Text>
                <View style={styles.bookingMessageContainer}>
                  <Text style={styles.bookingMessageLabel}>Tenant's Message:</Text>
                  <Text style={styles.bookingMessage}>{selectedBooking.text}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.rejectButton]}
                onPress={() => handleRejectBooking(selectedBooking)}
              >
                <Text style={styles.rejectButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modifyButton]}
                onPress={() => handleModifyBooking(selectedBooking)}
              >
                <Text style={styles.modifyButtonText}>Modify</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.approveButton]}
                onPress={() => handleApproveBooking(selectedBooking)}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
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
  backButton: { padding: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 10 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, color: '#666' },
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
    minWidth: 120,
  },
  myMessageBubble: {
    backgroundColor: '#667eea',
  },
  otherMessageBubble: {
    backgroundColor: '#e5e7eb',
  },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#667eea' },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  myMessageText: { color: 'white', fontSize: 16 },
  otherMessageText: { color: '#333', fontSize: 16 },
  messageImage: { 
    width: 200, 
    height: 150, 
    borderRadius: 12,
    marginBottom: 8,
  },
  messageTime: { 
    fontSize: 10, 
    color: 'rgba(0,0,0,0.5)', 
    alignSelf: 'flex-end', 
    marginTop: 6 
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: 'rgba(0,0,0,0.5)',
  },
  bookingActionButton: {
    backgroundColor: '#f59e0b',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  bookingActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e5e5', 
    backgroundColor: 'white' 
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
    maxHeight: 100 
  },
  sendButton: { 
    backgroundColor: '#667eea', 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalCloseButton: {
    padding: 8,
    marginRight: -8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  bookingDetails: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  bookingDetail: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  priceNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  bookingMessageContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  bookingMessageLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  bookingMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  modifyButton: {
    backgroundColor: '#f59e0b',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  modifyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  approveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
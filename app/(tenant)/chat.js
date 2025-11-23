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
  getCurrentUser,
  getConversations,
  getMessages,
  sendMessage,
  uploadProfileImage,
  subscribeToMessages,
} from '../../lib/supabaseClient';

export default function ChatScreen() {
  const { conversationId: routeConversationId, landlordId, landlordName, houseName, houseId } = useLocalSearchParams();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [landlordInfo, setLandlordInfo] = useState(null);
  const [landlordImage, setLandlordImage] = useState(null);
  const [conversationId, setConversationId] = useState(routeConversationId || null);
  const [conversationStatus, setConversationStatus] = useState(null);

  useEffect(() => {
    loadConversation();
  }, [landlordId, routeConversationId]);

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

      // If we have a conversationId from route, use it directly
      let convId = routeConversationId;

      // If no conversationId from route, fetch from Supabase
      if (!convId) {
        const { success, messages: messagesData, conversationId: fetchedConvId, error } = await getMessages(
          user.id,
          landlordId,
          houseId
        );

        if (!success) {
          Alert.alert('Error', error || 'Failed to load messages');
          setIsLoading(false);
          return;
        }

        convId = fetchedConvId;

        // Transform and sort messages (newest first for display)
        const transformedMessages = messagesData.map(msg => ({
          id: msg.id,
          sender: msg.sender_id,
          text: msg.message_text,
          image: msg.image_url,
          timestamp: msg.created_at,
          type: msg.message_type,
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setMessages(transformedMessages);
      } else {
        // If we have conversationId, fetch messages for it
        const { success, messages: messagesData, error } = await getMessages(
          user.id,
          landlordId,
          houseId
        );

        if (success && messagesData) {
          const transformedMessages = messagesData.map(msg => ({
            id: msg.id,
            sender: msg.sender_id,
            text: msg.message_text,
            image: msg.image_url,
            timestamp: msg.created_at,
            type: msg.message_type,
          })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          setMessages(transformedMessages);
        }
      }

      if (convId) {
        setConversationId(convId);

        // Subscribe to real-time messages
        const subscription = subscribeToMessages(convId, (newMsg) => {
          const transformedMsg = {
            id: newMsg.id,
            sender: newMsg.sender_id,
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
      }
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      let imageUrl = null;

      // Upload image if provided
      if (imageUri) {
        const uploadResult = await uploadProfileImage(imageUri);
        if (uploadResult.success) {
          imageUrl = uploadResult.publicUrl;
        }
      }

      // Send message to Supabase with conversation ID
      const { success, error } = await sendMessage(
        conversationId,
        currentUser.id,
        text.trim() || null
      );

      if (success) {
        setNewMessage('');
        // Message will appear through real-time subscription
      } else {
        Alert.alert('Error', error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message', error);
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

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === currentUser?.id
          ? styles.myMessage
          : styles.otherMessage,
      ]}
    >
      {item.image ? (
        <TouchableOpacity onPress={() => Alert.alert('Image', 'View image full screen')}>
          <Image source={{ uri: item.image }} style={styles.messageImage} />
        </TouchableOpacity>
      ) : (
        <Text
          style={
            item.sender === currentUser?.id
              ? styles.myMessageText
              : styles.otherMessageText
          }
        >
          {item.text}
        </Text>
      )}
      <Text style={styles.messageTime}>{item.timestamp}</Text>
    </View>
  );

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        {landlordImage && <Image source={{ uri: landlordImage }} style={styles.avatar} />}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{landlordName}</Text>
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
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: '80%',
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
    marginTop: 5,
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
/**
 * Conversation Message Cache Utility
 * Purpose: Permanently store messages with their conversation IDs for offline access
 * Ensures messages are never lost and can be referenced by conversation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LANDLORD_MESSAGES_KEY = '@landlord_messages';
const TENANT_MESSAGES_KEY = '@tenant_messages';
const MESSAGE_METADATA_KEY = '@message_metadata';

/**
 * Save landlord messages to permanent storage
 * @param {string} conversationId - Conversation ID
 * @param {array} messages - Array of message objects
 */
export const saveLandlordMessages = async (conversationId, messages) => {
  try {
    if (!conversationId || !Array.isArray(messages)) {
      console.warn('Invalid conversationId or messages array');
      return false;
    }

    // Get existing messages
    const existingJson = await AsyncStorage.getItem(LANDLORD_MESSAGES_KEY);
    let allMessages = existingJson ? JSON.parse(existingJson) : [];

    // Add conversation_id to each message if not present
    const messagesWithConvId = messages.map(msg => ({
      ...msg,
      conversation_id: msg.conversation_id || conversationId,
    }));

    // Remove old messages from this conversation and add new ones
    allMessages = allMessages.filter(m => String(m.conversation_id) !== String(conversationId));
    allMessages = [...allMessages, ...messagesWithConvId];

    // Sort by timestamp
    allMessages = allMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || 0);
      const timeB = new Date(b.timestamp || b.created_at || 0);
      return timeB - timeA; // newest first
    });

    // Save to AsyncStorage
    await AsyncStorage.setItem(LANDLORD_MESSAGES_KEY, JSON.stringify(allMessages));
    
    // Update metadata
    const metadata = {
      lastUpdated: new Date().toISOString(),
      conversationId,
      messageCount: allMessages.length,
    };
    await AsyncStorage.setItem(MESSAGE_METADATA_KEY, JSON.stringify(metadata));

    console.log(`✅ Saved ${messagesWithConvId.length} landlord messages for conversation ${conversationId}`);
    return true;
  } catch (error) {
    console.error('Failed to save landlord messages:', error);
    return false;
  }
};

/**
 * Save tenant messages to permanent storage
 * @param {string} conversationId - Conversation ID
 * @param {array} messages - Array of message objects
 */
export const saveTenantMessages = async (conversationId, messages) => {
  try {
    if (!conversationId || !Array.isArray(messages)) {
      console.warn('Invalid conversationId or messages array');
      return false;
    }

    // Get existing messages
    const existingJson = await AsyncStorage.getItem(TENANT_MESSAGES_KEY);
    let allMessages = existingJson ? JSON.parse(existingJson) : [];

    // Add conversation_id to each message if not present
    const messagesWithConvId = messages.map(msg => ({
      ...msg,
      conversation_id: msg.conversation_id || conversationId,
    }));

    // Remove old messages from this conversation and add new ones
    allMessages = allMessages.filter(m => String(m.conversation_id) !== String(conversationId));
    allMessages = [...allMessages, ...messagesWithConvId];

    // Sort by timestamp
    allMessages = allMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || 0);
      const timeB = new Date(b.timestamp || b.created_at || 0);
      return timeB - timeA; // newest first
    });

    // Save to AsyncStorage
    await AsyncStorage.setItem(TENANT_MESSAGES_KEY, JSON.stringify(allMessages));
    
    // Update metadata
    const metadata = {
      lastUpdated: new Date().toISOString(),
      conversationId,
      messageCount: allMessages.length,
    };
    await AsyncStorage.setItem(MESSAGE_METADATA_KEY, JSON.stringify(metadata));

    console.log(`✅ Saved ${messagesWithConvId.length} tenant messages for conversation ${conversationId}`);
    return true;
  } catch (error) {
    console.error('Failed to save tenant messages:', error);
    return false;
  }
};

/**
 * Add a single message to saved messages
 * @param {string} userType - 'landlord' or 'tenant'
 * @param {string} conversationId - Conversation ID
 * @param {object} message - Message object with conversation_id
 */
export const addMessageToCache = async (userType, conversationId, message) => {
  try {
    const key = userType === 'landlord' ? LANDLORD_MESSAGES_KEY : TENANT_MESSAGES_KEY;
    
    const existingJson = await AsyncStorage.getItem(key);
    let messages = existingJson ? JSON.parse(existingJson) : [];

    // Ensure message has conversation_id
    const messageWithConvId = {
      ...message,
      conversation_id: message.conversation_id || conversationId,
    };

    // Add message
    messages = [messageWithConvId, ...messages];

    // Save
    await AsyncStorage.setItem(key, JSON.stringify(messages));
    console.log(`✅ Added message to ${userType} cache`);
    return true;
  } catch (error) {
    console.error('Failed to add message to cache:', error);
    return false;
  }
};

/**
 * Get all saved messages for a user type
 * @param {string} userType - 'landlord' or 'tenant'
 * @returns {array} Array of messages with conversation_id
 */
export const getSavedMessages = async (userType) => {
  try {
    const key = userType === 'landlord' ? LANDLORD_MESSAGES_KEY : TENANT_MESSAGES_KEY;
    const json = await AsyncStorage.getItem(key);
    const messages = json ? JSON.parse(json) : [];
    
    console.log(`📦 Retrieved ${messages.length} saved ${userType} messages`);
    return messages;
  } catch (error) {
    console.error('Failed to get saved messages:', error);
    return [];
  }
};

/**
 * Get messages for a specific conversation
 * @param {string} userType - 'landlord' or 'tenant'
 * @param {string} conversationId - Conversation ID
 * @returns {array} Messages for that conversation
 */
export const getConversationMessages = async (userType, conversationId) => {
  try {
    const allMessages = await getSavedMessages(userType);
    const filtered = allMessages.filter(
      m => String(m.conversation_id) === String(conversationId)
    );
    console.log(`📦 Found ${filtered.length} messages for conversation ${conversationId}`);
    return filtered;
  } catch (error) {
    console.error('Failed to get conversation messages:', error);
    return [];
  }
};

/**
 * Clear all saved messages (logout)
 * @param {string} userType - 'landlord' or 'tenant' or 'both'
 */
export const clearSavedMessages = async (userType = 'both') => {
  try {
    if (userType === 'landlord' || userType === 'both') {
      await AsyncStorage.removeItem(LANDLORD_MESSAGES_KEY);
    }
    if (userType === 'tenant' || userType === 'both') {
      await AsyncStorage.removeItem(TENANT_MESSAGES_KEY);
    }
    await AsyncStorage.removeItem(MESSAGE_METADATA_KEY);
    console.log(`🗑️ Cleared ${userType} messages cache`);
    return true;
  } catch (error) {
    console.error('Failed to clear messages:', error);
    return false;
  }
};

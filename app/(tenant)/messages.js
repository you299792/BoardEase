import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import SearchBar from '../../components/SearchBar';
import {
  getCurrentUser,
  getConversations,
} from '../../lib/supabaseClient'; 

export default function Messages() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allMessages, setAllMessages] = useState([]); 
  const [isLoading, setIsLoading] = useState(true); 

  
  
  const loadMessages = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        setIsLoading(false);
        return;
      }

      // Fetch conversations from Supabase
      const { success, conversations, error } = await getConversations(user.id);

      if (success && conversations) {
        // Transform conversations to message format
        const messages = conversations.map(conv => ({
          id: conv.id,
          landlord: {
            id: conv.landlord_id,
            name: `${conv.landlord?.users?.first_name} ${conv.landlord?.users?.last_name}`,
            email: conv.landlord?.users?.email,
            phone: conv.landlord?.users?.phone,
            image: conv.landlord?.users?.profile_image_url,
          },
          houseName: conv.listing?.title || 'General Inquiry',
          houseId: conv.listing_id,
          lastMessage: conv.last_message,
          time: conv.last_message_time,
        }));

        setAllMessages(messages);
      } else {
        setAllMessages([]);
      }
    } catch (e) {
      console.error('Failed to load messages', e);
      setAllMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  
  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [])
  );
  
  const filteredMessages = allMessages.filter(message =>
    message.landlord.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePressMessage = (item) => {
    const contactKey = (c) => (c?.id || c?.email || c?.phone || c?.name || '').toString();
    router.push({
      pathname: '/(tenant)/chat',
      params: {
        landlordId: contactKey(item.landlord),
        landlordName: item.landlord.name,
        landlordImage: item.landlord.image,
        houseName: item.houseName,
        houseId: item.houseId,
      },
    });
  };

  
  const handleDeleteMessage = (itemToDelete) => {
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete your conversation with ${itemToDelete.landlord.name}? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
             
              const newMessagesList = allMessages.filter(
                (item) => item.id !== itemToDelete.id
              );
              
              
              setAllMessages(newMessagesList);
              
              
              await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(newMessagesList));
            } catch (e) {
              console.error("Failed to delete message", e);
              Alert.alert("Error", "Could not delete conversation.");
              
              loadMessages();
            }
          }
        }
      ]
    );
  };

  const renderMessageItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.messageItem} 
      onPress={() => handlePressMessage(item)}
     
      onLongPress={() => handleDeleteMessage(item)}
      delayLongPress={500} 
    >
      <Image source={{ uri: item.landlord.image }} style={styles.avatar} />
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={styles.landlordName}>{item.landlord.name}</Text>
          <Text style={styles.messageTime}>{item.time}</Text>
        </View>
        <Text 
          style={[
            styles.lastMessage,
            item.unread && styles.unreadMessage
          ]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {item.unread && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>1</Text>
        </View>
      )}
    </TouchableOpacity>
  );
  
  if (isLoading) {
    return (
       <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
          <View style={styles.header}>
            <Text style={styles.title}>Messages</Text>
          </View>
          <ActivityIndicator size="large" color="#667eea" />
       </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search messages..."
        />
      </View>
      
      {filteredMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Start a conversation with a landlord.</Text>
          <TouchableOpacity 
            style={styles.startConversationButton}
            onPress={() => router.push('/(tenant)/home')}
          >
            <Ionicons name="home" size={20} color="white" />
            <Text style={styles.startConversationButtonText}>Book a boarding house</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredMessages} 
          renderItem={renderMessageItem}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  landlordName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadMessage: {
    color: '#333',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#667eea',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  startConversationButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startConversationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
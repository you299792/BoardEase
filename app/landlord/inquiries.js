import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getCurrentUser,
  getLandlordInquiries,
  supabase,
} from '../../lib/supabaseClient'; 
export default function InquiriesScreen() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInquiries = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();

      if (user) {
        const { success, inquiries, error } = await getLandlordInquiries(user.id);

        if (success) {
          const formattedMessages = inquiries.map(inq => ({
            id: inq.id,
            conversationId: inq.conversation_id,
            tenantId: inq.tenant_id,
            tenant: {
              id: inq.tenant?.id,
              name: `${inq.tenant?.first_name || ''} ${inq.tenant?.last_name || ''}`.trim(),
              email: inq.tenant?.email,
              phone: inq.tenant?.phone,
              image: inq.tenant?.profile_image_url,
            },
            houseName: inq.listing?.title || 'Property',
            property: inq.listing?.title || 'Property', // duplicate for compatibility
            listing_id: inq.listing_id,
            type: inq.subject || 'inquiry',
            status: inq.subject || 'inquiry',
            lastMessage: inq.message,
            time: inq.created_at ? new Date(inq.created_at).toLocaleDateString() : 'N/A',
            unread: inq.unread_count > 0,
            unreadCount: inq.unread_count || 0,
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

  useFocusEffect(
    useCallback(() => {
      loadInquiries();
    }, [])
  );

  // Real-time subscription to conversations for unread updates
  useEffect(() => {
    let subscription;

    const setupSubscription = async () => {
      const user = await getCurrentUser();
      if (!user) return;

      // Get landlord profile to listen to conversations
      const { data: landlordProfile } = await supabase
        .from('landlord_profile')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!landlordProfile) return;

      // Subscribe to conversations table for unread count changes
      subscription = supabase
        .channel(`conversations:${landlordProfile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `landlord_id=eq.${landlordProfile.id}`,
          },
          (payload) => {
            console.log('[Inquiries] Conversation update:', payload);
            // Reload inquiries when any conversation changes
            loadInquiries();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':
        return '#3b82f6';
      case 'interested':
        return '#8b5cf6';
      case 'ready_to_book':
        return '#10b981';
      case 'inquiry':
        return '#f59e0b';
      case 'corporate':
        return '#6366f1';
      default:
        return '#667eea';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'new':
        return 'New';
      case 'interested':
        return 'Interested';
      case 'ready_to_book':
        return 'Ready to Book';
      case 'inquiry':
        return 'General Inquiry';
      case 'corporate':
        return 'Corporate';
      default:
        return 'Inquiry';
    }
  };

  const handleMessagePress = (message) => {
    // Simply navigate to chat - no need to mark as read in AsyncStorage
    // The database already tracks read status
    router.push({
      pathname: '/landlord/chat',
      params: {
        conversationId: message.conversationId,
        tenantId: message.tenantId,
        tenantName: message.tenant.name,
        tenantImage: message.tenant.image,
        property: message.houseName,
      }
    });
  };

  
  const markAllAsRead = async () => {
    // Mark all as read in UI
    const readMessages = messages.map(msg => ({ ...msg, unread: false }));
    setMessages(readMessages);
    // Database already tracks read status through the inquiries table
  };

  const unreadCount = messages.filter(msg => msg.unread).length;

  
  if (isLoading) {
     return (
       <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Property Inquiries</Text>
            </View>
          </View>
          <ActivityIndicator size="large" color="#667eea" />
       </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Messages',
          headerShown: false,
        }}
      />
      
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Property Inquiries</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0 ? `${unreadCount} unread messages` : 'All messages read'}
            </Text>
          </View>
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
        
        
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No inquiries yet</Text>
            <Text style={styles.emptySubtext}>New inquiries from tenants will appear here.</Text>
          </View>
        ) : (
          <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
            {messages.map((message) => {
              const statusColor = getStatusColor(message.status);
              
              return (
                <TouchableOpacity
                  key={message.id}
                  style={[
                    styles.messageCard,
                    message.unread && styles.unreadMessage
                  ]}
                  onPress={() => handleMessagePress(message)}
                >
                  <View style={styles.messageHeader}>
                    <Image source={{ uri: message.tenant.image }} style={styles.tenantImage} />
                    <View style={styles.messageContent}>
                      <View style={styles.messageTopRow}>
                        <Text style={styles.tenantName} numberOfLines={1}>
                          {message.tenant.name}
                        </Text>
                        <Text style={styles.messageTime}>
                          {message.time}
                        </Text>
                      </View>
                      <View style={styles.messageMiddleRow}>
                        <Text style={styles.propertyName} numberOfLines={1}>
                          {message.property}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {getStatusText(message.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.lastMessage} numberOfLines={2}>
                        {message.lastMessage}
                      </Text>
                    </View>
                  </View>
                  {message.unread && (
                    <View style={styles.unreadIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
            
            
            <View style={styles.endOfList}>
              <Ionicons name="chatbubble-ellipses" size={32} color="#ccc" />
              <Text style={styles.endOfListText}>No more messages</Text>
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 14,
  },
  messagesList: {
    flex: 1,
    padding: 20,
  },
  messageCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    backgroundColor: '#f8faff',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tenantImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  messageMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  propertyName: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  endOfList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  endOfListText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
    marginBottom: 4,
  },
  endOfListSubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  // ADDED: Empty state styles
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
});
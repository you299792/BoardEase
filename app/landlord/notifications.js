import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  getCurrentUser,
  getNotifications,
  markNotificationAsRead,
  subscribeToNotifications,
  supabase,
} from '../../lib/supabaseClient';

export default function NotificationsScreen() {
  const [notificationList, setNotificationList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    loadNotifications();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      setCurrentUser(user);

      if (user) {
        const { success, notifications } = await getNotifications(user.id);
        if (success) {
          setNotificationList(notifications || []);
        } else {
          setNotificationList([]);
        }

        // Subscribe to new notifications for real-time updates
        if (subscription) {
          subscription.unsubscribe();
        }
        const newSubscription = subscribeToNotifications(user.id, (newNotification) => {
          setNotificationList(prev => [newNotification, ...prev]);
        });
        setSubscription(newSubscription);
      }
    } catch (error) {
      console.error('Failed to load notifications', error);
      setNotificationList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifTime.toLocaleDateString();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAllAsRead = async () => {
    try {
      // Mark all unread notifications as read in Supabase
      const unreadNotifications = notificationList.filter(item => !item.is_read);
      
      if (unreadNotifications.length === 0) {
        Alert.alert('Info', 'All notifications are already read');
        return;
      }

      // Mark each unread notification as read
      for (const notification of unreadNotifications) {
        await markNotificationAsRead(notification.id);
      }

      // Update local state
      setNotificationList(prev => 
        prev.map(item => ({ ...item, is_read: true }))
      );

      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const getNotificationIcon = (notificationType) => {
    switch (notificationType) {
      case 'booking_request':
        return 'calendar';
      case 'booking_approved':
        return 'checkmark-circle';
      case 'booking_cancelled':
        return 'close-circle';
      case 'booking_rejected':
        return 'close-circle';
      case 'payment_due':
        return 'wallet';
      case 'payment_completed':
        return 'checkmark-done';
      case 'message':
        return 'chatbubble';
      case 'review':
        return 'star';
      case 'listing_inquiry':
        return 'help-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (notificationType) => {
    switch (notificationType) {
      case 'booking_request':
        return '#667eea';
      case 'booking_approved':
        return '#48bb78';
      case 'booking_cancelled':
        return '#f56565';
      case 'booking_rejected':
        return '#f56565';
      case 'payment_due':
        return '#f6ad55';
      case 'payment_completed':
        return '#48bb78';
      case 'message':
        return '#4299e1';
      case 'review':
        return '#ed8936';
      default:
        return '#667eea';
    }
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
      // Update local state
      setNotificationList(prev => 
        prev.map(item => 
          item.id === notification.id ? { ...item, is_read: true } : item
        )
      );
    }

    // Handle message notifications - fetch conversation and navigate to chat
    if (notification.notification_type === 'message') {
      try {
        let conversationId = null;
        
        // Try to parse conversation ID from action_url first
        if (notification.action_url) {
          // Check if it's a direct chat route with conversationId
          if (notification.action_url.includes('conversationId')) {
            const match = notification.action_url.match(/conversationId[=?:]([\w-]+)/);
            if (match) {
              conversationId = match[1];
            }
          }
        }

        // If no conversation ID found, query the messages table to find the conversation
        if (!conversationId && currentUser?.id) {
          // Find the most recent conversation involving this landlord
          const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('conversation_id')
            .eq('receiver_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!msgError && messages && messages.length > 0) {
            conversationId = messages[0].conversation_id;
          }

          // If still no conversation, try querying conversations directly
          if (!conversationId) {
            const { data: conversations, error: convError } = await supabase
              .from('conversations')
              .select('id')
              .eq('landlord_id', currentUser.id)
              .order('updated_at', { ascending: false })
              .limit(1);

            if (!convError && conversations && conversations.length > 0) {
              conversationId = conversations[0].id;
            }
          }
        }

        if (conversationId) {
          router.push({
            pathname: '/landlord/chat',
            params: { conversationId }
          });
        } else {
          Alert.alert('Error', 'Could not load conversation');
        }
      } catch (error) {
        console.error('Error handling message notification:', error);
        Alert.alert('Error', 'Failed to open chat');
      }
    } else if (notification.action_url) {
      // For other notification types, use the action_url
      router.push(notification.action_url);
    }
  };

  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.notificationCard,
        !item.is_read && styles.unreadCard
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.notification_type) + '20' }]}>
          <Ionicons
            name={getNotificationIcon(item.notification_type)}
            size={20}
            color={getNotificationColor(item.notification_type)}
          />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notifications</Text>
            {notificationList.length > 0 && (
              <Text style={styles.subtitle}>
                {notificationList.filter(item => !item.is_read).length} unread
              </Text>
            )}
          </View>
          {notificationList.filter(item => !item.is_read).length > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={styles.markAllButtonText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={notificationList}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Notifications</Text>
            <Text style={styles.emptyStateText}>You're all caught up!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  markAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#667eea',
    borderRadius: 6,
  },
  markAllButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCard: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 2,
  },
  unreadCard: {
    backgroundColor: '#f0f4ff',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
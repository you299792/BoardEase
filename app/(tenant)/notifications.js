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

export default function Notifications() {
  const [notificationList, setNotificationList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Load notifications and set up real-time subscription
  useEffect(() => {
    loadNotifications();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
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

      // Fetch notifications from Supabase
      const { success, notifications, error } = await getNotifications(user.id);

      if (success) {
        // Transform Supabase data to match component expectations
        const transformedNotifications = notifications.map(notif => ({
          id: notif.id,
          type: notif.notification_type,
          title: notif.title,
          message: notif.message,
          timestamp: notif.created_at,
          read: notif.is_read,
          listingId: notif.listing_id,
          bookingId: notif.booking_id,
          paymentId: notif.payment_id,
          actionType: notif.action_type,
          actionData: notif.action_data,
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setNotificationList(transformedNotifications);

        // Subscribe to real-time notifications
        if (user.id) {
          const subscription = subscribeToNotifications(user.id, (newNotif) => {
            setNotificationList(prev => [newNotif, ...prev]);
          });

          return () => {
            if (subscription) subscription.unsubscribe();
          };
        }
      } else {
        Alert.alert('Error', error || 'Failed to load notifications');
      }
    } catch (error) {
      console.error('Failed to load notifications', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification) => {
    try {
      // Mark as read in Supabase
      if (!notification.read) {
        await markNotificationAsRead(notification.id);

        // Update local state
        const updatedNotifications = notificationList.map(notif =>
          notif.id === notification.id ? { ...notif, read: true } : notif
        );
        setNotificationList(updatedNotifications);
      }
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }

    // Handle message notifications - fetch conversation and navigate to chat
    if (notification.type === 'message') {
      try {
        let conversationId = null;
        
        // Try to parse conversation ID from actionData first
        if (notification.actionData && notification.actionData.conversationId) {
          conversationId = notification.actionData.conversationId;
        }
        
        // If no conversation ID, query the messages table to find the conversation
        if (!conversationId && currentUser?.id) {
          // Find the most recent conversation involving this tenant
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
              .eq('tenant_id', currentUser.id)
              .order('updated_at', { ascending: false })
              .limit(1);

            if (!convError && conversations && conversations.length > 0) {
              conversationId = conversations[0].id;
            }
          }
        }

        if (conversationId) {
          router.push({
            pathname: '/(tenant)/chat',
            params: { conversationId }
          });
        } else {
          Alert.alert('Error', 'Could not load conversation');
        }
      } catch (error) {
        console.error('Error handling message notification:', error);
        Alert.alert('Error', 'Failed to open chat');
      }
    } else {
      // For other notification types, navigate based on type
      switch (notification.type) {
        case 'booking_approved':
        case 'booking_rejected':
        case 'booking_request':
          router.push('/(tenant)/bookings');
          break;
        case 'payment_due':
        case 'payment_completed':
          router.push('/(tenant)/payments');
          break;
        case 'review':
          router.push('/(tenant)/bookings');
          break;
        default:
          break;
      }
    }
  };

  const clearAllNotifications = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setNotificationList([]);
            Alert.alert('Cleared', 'All notifications have been cleared.');
          }
        }
      ]
    );
  };

  const markAllAsRead = async () => {
    try {
      // Mark all as read in local state
      const updatedNotifications = notificationList.map(notif => ({ ...notif, read: true }));
      setNotificationList(updatedNotifications);

      // Mark all as read in Supabase (bulk operation would be better, but marking individually for now)
      for (const notif of notificationList.filter(n => !n.read)) {
        await markNotificationAsRead(notif.id);
      }
    } catch (error) {
      console.error('Failed to mark all as read', error);
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking_request':
        return { name: 'calendar', color: '#667eea' };
      case 'booking_approved':
        return { name: 'checkmark-circle', color: '#10b981' };
      case 'booking_rejected':
        return { name: 'close-circle', color: '#ef4444' };
      case 'booking_cancelled':
        return { name: 'close-circle', color: '#ef4444' };
      case 'payment_due':
        return { name: 'wallet', color: '#f6ad55' };
      case 'payment_completed':
        return { name: 'checkmark-done', color: '#48bb78' };
      case 'message':
        return { name: 'chatbubble', color: '#4299e1' };
      case 'review':
        return { name: 'star', color: '#ed8936' };
      case 'listing_inquiry':
        return { name: 'help-circle', color: '#667eea' };
      default:
        return { name: 'notifications', color: '#667eea' };
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

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading notifications...</Text>
      </View>
    );
  }

  const unreadCount = notificationList.filter(notif => !notif.read).length;

  const renderNotificationItem = ({ item }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.unreadCard
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
            <Ionicons
              name={icon.name}
              size={20}
              color={icon.color}
            />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={styles.timestamp}>{getTimeAgo(item.timestamp)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notificationList.length > 0 && (
          <Text style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        )}
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

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

    // Handle action based on type
    switch (notification.actionType) {
      case 'view_listing':
        router.push({
          pathname: '/(tenant)/boarding-house-details',
          params: { id: notification.listingId }
        });
        break;

      case 'view_booking':
        router.push('/(tenant)/bookings');
        break;

      case 'view_payment':
        router.push('/(tenant)/payments');
        break;

      case 'view_message':
        router.push({
          pathname: '/(tenant)/chat',
          params: notification.actionData
        });
        break;

      default:
        break;
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
      case 'new_listing':
        return { name: 'home', color: '#3b82f6' };
      case 'booking_approved':
        return { name: 'checkmark-circle', color: '#10b981' };
      case 'booking_cancelled':
        return { name: 'close-circle', color: '#ef4444' };
      case 'payment_confirmed':
        return { name: 'card', color: '#10b981' };
      case 'payment_reminder':
        return { name: 'time', color: '#f59e0b' };
      case 'new_message':
        return { name: 'chatbubble', color: '#8b5cf6' };
      case 'price_drop':
        return { name: 'trending-down', color: '#10b981' };
      case 'favorite_available':
        return { name: 'heart', color: '#ef4444' };
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
        style={[styles.notificationCard, !item.read && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
            <Ionicons name={icon.name} size={24} color={icon.color} />
          </View>

          <View style={styles.notificationText}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={styles.notificationTime}>{getTimeAgo(item.timestamp)}</Text>
          </View>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <Text style={[styles.headerButtonText, unreadCount === 0 && styles.disabledText]}>
              Mark all read
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={clearAllNotifications}
            disabled={notificationList.length === 0}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={notificationList.length === 0 ? '#ccc' : '#ef4444'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {notificationList.length > 0 ? (
          <FlatList
            data={notificationList}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#667eea']}
              />
            }
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Notifications</Text>
            <Text style={styles.emptyStateText}>
              You're all caught up! New notifications will appear here.
            </Text>
          </View>
        )}
      </View>
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
  subtitle: {
    fontSize: 14,
    color: '#667eea',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledText: {
    color: '#ccc',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    position: 'relative',
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    backgroundColor: '#f8faff',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});

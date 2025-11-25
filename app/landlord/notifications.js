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

  const getNotificationIcon = (notificationType) => {
    switch (notificationType) {
      case 'booking_request':
        return 'calendar';
      case 'booking_approved':
        return 'checkmark-circle';
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

    // Navigate based on notification type
    if (notification.action_url) {
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
        <Text style={styles.title}>Notifications</Text>
        {notificationList.length > 0 && (
          <Text style={styles.subtitle}>
            {notificationList.filter(item => !item.is_read).length} unread
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
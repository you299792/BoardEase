import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'new_listing':
      return { name: 'home', color: '#10b981' };
    case 'booking':
      return { name: 'calendar', color: '#3b82f6' };
    case 'payment':
      return { name: 'card', color: '#f59e0b' };
    case 'message':
      return { name: 'chatbubble', color: '#8b5cf6' };
    case 'promotion':
      return { name: 'megaphone', color: '#ec4899' };
    case 'system':
      return { name: 'settings', color: '#6b7280' };
    default:
      return { name: 'notifications', color: '#667eea' };
  }
};

const getNotificationAction = (type) => {
  switch (type) {
    case 'new_listing':
      return 'View Listing';
    case 'booking':
      return 'View Booking';
    case 'payment':
      return 'Pay Now';
    case 'message':
      return 'Reply';
    case 'promotion':
      return 'Learn More';
    default:
      return 'View';
  }
};

const NotificationItem = ({ notification, onPress }) => {
  const icon = getNotificationIcon(notification.type);
  const actionText = getNotificationAction(notification.type);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.read && styles.unreadContainer
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <View style={[styles.iconBackground, { backgroundColor: `${icon.color}15` }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.time}>{notification.time}</Text>
        </View>
        
        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>

        {notification.actionable && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionText}>{actionText}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!notification.read && (
        <View style={styles.unreadIndicator} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  unreadContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    backgroundColor: '#f8faff',
  },
  iconContainer: {
    marginRight: 12,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
    marginLeft: 8,
    marginTop: 4,
  },
});

export default memo(NotificationItem);
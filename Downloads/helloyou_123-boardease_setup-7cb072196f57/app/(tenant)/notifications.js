
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notifications } from '../../data/mockData';
import NotificationItem from '../../components/NotificationItem';

export default function Notifications() {
  const [notificationList, setNotificationList] = useState(notifications);

  const handleNotificationPress = (notificationId) => {
    setNotificationList(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const clearAllNotifications = () => {
    setNotificationList(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const unreadCount = notificationList.filter(notif => !notif.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={clearAllNotifications}
          disabled={unreadCount === 0}
        >
          <Text style={[styles.clearButtonText, unreadCount === 0 && styles.clearButtonDisabled]}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {notificationList.length > 0 ? (
          <FlatList
            data={notificationList}
            renderItem={({ item: notification }) => (
              <NotificationItem
                notification={notification}
                onPress={() => handleNotificationPress(notification.id)}
              />
            )}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
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
    paddingTop: 20,
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
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#667eea',
    fontWeight: '600',
  },
  clearButtonDisabled: {
    color: '#ccc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  },
});

/*
<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {notificationList.length > 0 ? (
          notificationList.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onPress={() => handleNotificationPress(notification.id)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Notifications</Text>
            <Text style={styles.emptyStateText}>
              You're all caught up! New notifications will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
*/
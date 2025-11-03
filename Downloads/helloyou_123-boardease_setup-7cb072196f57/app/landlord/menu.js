import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
// Import Colors to maintain Landlord theme consistency
import { Colors } from '../../constants/Colors';
import { useAuth } from './AuthContext';
import ShareProfileModal from '../../components/ShareProfileModal';

export default function LandlordMenuScreen() {
  const { user, logout } = useAuth();
  const [isShareModalVisible, setShareModalVisible] = useState(false);

  // Use Landlord-specific menu items
  const menuItems = [
    {
      icon: 'person',
      title: 'Profile',
      description: 'Manage your account information',
      screen: 'profile', // You would create this screen later
    },
    {
      icon: 'chatbubbles',
      title: 'Tenant Inquiries',
      description: 'View messages and inquiries',
      screen: 'inquiries', // Links to the Landlord Inquiries tab
    },
    {
      icon: 'wallet',
      title: 'Financials & Payments',
      description: 'View rent collections and statements',
      screen: 'financials',
    },
    {
      icon: 'settings',
      title: 'App Settings',
      description: 'Preferences and notification options',
      screen: 'settings',
    },
    {
      icon: 'help-circle',
      title: 'Help & Support',
      description: 'Get help and contact support',
      screen: 'support',
    },
  ];

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => {
            logout();
            // Navigate back to the initial landing page/login screen
            router.replace('/');
          }
        }
      ]
    );
  };

  const handleMenuPress = (item) => {
    // Navigate to the specified screen. For tabs (like inquiries), we use the name.
    if (item.screen === 'inquiries') {
      router.push('/landlord/inquiries');
    } else {
      // For non-tab screens like profile or settings, you'd push to the full path.
      // e.g., router.push(`/landlord/${item.screen}`);
      console.log(`Navigating to ${item.screen}`);
    }
  };

  return (
    <>
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Title matches the Tenant Menu */}
        <Text style={styles.title}>Account Menu</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Section (Replicates Tenant style) */}
        <View style={styles.profileSection}>
          <Image
            source={{ 
              uri: user?.photoURL || 'https://via.placeholder.com/150/667eea/FFFFFF?text=User' 
            }}
            style={styles.profileImage}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Landlord'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
            <Text style={styles.profileType}>Landlord</Text>
          </View>
          <TouchableOpacity 
            style={styles.shareProfileButton}
            onPress={() => setShareModalVisible(true)}
          >
            <Ionicons name="qr-code" size={24} color={Colors.primary || '#667eea'} />
          </TouchableOpacity>
        </View>

        {/* Menu Items Section (Replicates Tenant style) */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && { borderBottomWidth: 0 } // Remove border on last item
              ]}
              onPress={() => handleMenuPress(item)}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIconContainer}>
                  <Ionicons name={item.icon} size={20} color={Colors.primary || '#667eea'} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemDescription}>{item.description}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button (Replicates Tenant style) */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
    <ShareProfileModal
        visible={isShareModalVisible}
        onClose={() => setShareModalVisible(false)}
        user={user}
      />
    </>
  );
}

// Styles are largely copied from the Tenant menu.js to ensure visual consistency
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb', // Landlord background color from index.js
  },
  header: {
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
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profileType: {
    fontSize: 12,
    color: Colors.primary || '#667eea', // Uses Landlord primary color
    fontWeight: '500',
    backgroundColor: '#f0f4ff', // Light background for primary color
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },  
  shareProfileButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: '#f0f4ff',
    marginLeft: 'auto',
    padding: 8,
  },
  menuSection: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
});
// app/landlord/menu.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import ShareProfileModal from '../../components/ShareProfileModal';
import { getCurrentUser, signOut, getLandlordProfile } from '../../lib/supabaseClient';

export default function LandlordMenuScreen() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isShareModalVisible, setShareModalVisible] = useState(false);

  // Reload user data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        // Fetch landlord profile for complete user data
        const { success, profile } = await getLandlordProfile(currentUser.id);
        if (success && profile) {
          // Set userData to the nested users object so we can access first_name, last_name, profile_image_url
          setUserData(profile.users);
        } else {
          // Fallback to auth user if profile fetch fails
          setUserData(currentUser);
        }
      } else {
        // No user logged in, redirect to auth
        router.replace('/(auth)');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

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
          onPress: async () => {
            try {
              const result = await signOut();
              if (result.success) {
                router.replace('/');
              } else {
                Alert.alert('Error', 'Failed to log out');
              }
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'An error occurred during logout');
            }
          }
        }
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person',
      title: 'Profile',
      description: 'Manage your account information',
      screen: 'profile',
    },
    {
      icon: 'chatbubbles',
      title: 'Tenant Inquiries',
      description: 'View messages and inquiries',
      screen: 'inquiries',
    },
    {
      icon: 'wallet',
      title: 'Financials & Payments',
      description: 'View rent collections and statements',
      screen: 'financials',
    },
    {
      icon: 'card',
      title: 'Payment Methods',
      description: 'Manage your bank accounts and cards',
      screen: 'payment-methods',
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

  const handleMenuPress = (item) => {
    if (item.screen === 'profile') {
      router.push('/landlord/edit-profile');
    } else if (item.screen === 'inquiries') {
      router.push('/landlord/inquiries');
    } else if (item.screen === 'financials') {
      router.push('/landlord/financials');
    } else if (item.screen === 'settings') {
      router.push('/landlord/settings');
    } else if (item.screen === 'payment-methods') {
      router.push('/landlord/payment-method');
    } else if (item.screen === 'support') {
      router.push('/landlord/support');
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Account Menu</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary || '#667eea'} />
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            
            <View style={styles.profileSection}>
              {userData?.profile_image_url ? (
                <Image
                  source={{ uri: userData.profile_image_url }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={[styles.profileImage, styles.placeholderImage]}>
                  <Ionicons name="person-circle" size={50} color="#667eea" />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.last_name}`
                    : 'Landlord'}
                </Text>
                <Text style={styles.profileEmail}>{userData?.email || 'No email'}</Text>
                <Text style={styles.profileType}>Landlord</Text>
              </View>
              <TouchableOpacity 
                style={styles.shareProfileButton}
                onPress={() => setShareModalVisible(true)}
              >
                <Ionicons name="qr-code" size={24} color={Colors.primary || '#667eea'} />
              </TouchableOpacity>
            </View>

            
            <View style={styles.menuSection}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    index === menuItems.length - 1 && { borderBottomWidth: 0 }
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

            
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out" size={20} color="#dc2626" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
      <ShareProfileModal
        visible={isShareModalVisible}
        onClose={() => setShareModalVisible(false)}
        user={userData}
      />
    </>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  placeholderImage: {
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
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
    color: Colors.primary || '#667eea',
    fontWeight: '500',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },  
  shareProfileButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
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
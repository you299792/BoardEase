import React, { useState, useEffect, useCallback } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import TermsAndPrivacyScreen from '../../components/TermsAndPrivacy';
import { getCurrentUser, getTenantProfile, signOut } from '../../lib/supabaseClient';

export default function Menu() {
  const [showTerms, setShowTerms] = useState(false);
  const [userData, setUserData] = useState(null);

  // Reload user data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        // Fetch complete profile data from database
        const { success, user: profileUser } = await getTenantProfile(user.id);
        if (success && profileUser) {
          setUserData(profileUser);
        } else {
          // Fallback to auth user if profile fetch fails
          setUserData(user);
        }
      }
    } catch (error) {
      console.error('Failed to load user data', error);
    }
  };

  const menuItems = [
    {
      icon: 'person',
      title: 'Profile',
      description: 'Manage your account information',
      screen: 'profile',
    },
    // --- ENTRY POINT FOR RENTED PROPERTIES ---
    {
      icon: 'home',
      title: 'Rented Properties',
      description: 'View properties you are currently renting',
      screen: 'rented', 
    },
    // -----------------------------------------
    {
      icon: 'heart',
      title: 'Favorites',
      description: 'View your saved boarding houses',
      screen: 'favorites',
    },
    {
      icon: 'calendar',
      title: 'Bookings',
      description: 'Check your current and past bookings',
      screen: 'bookings',
    },
    {
      icon: 'card',
      title: 'Payments',
      description: 'View payment history and methods',
      screen: 'payments',
    },
    {
      icon: 'settings',
      title: 'Settings',
      description: 'App preferences and notifications',
      screen: 'settings',
    },
    {
      icon: 'help-circle',
      title: 'Help & Support',
      description: 'Get help and contact support',
      screen: 'help-support',
    },
    {
      icon: 'document-text',
      title: 'Terms & Privacy',
      description: 'Legal information and policies',
      action: 'showTerms',
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
          onPress: async () => {
            await signOut();
            router.replace('/');
          }
        }
      ]
    );
  };

  const handleMenuPress = (item) => {
    if (item.action === 'showTerms') {
      setShowTerms(true);
    } else if (item.screen) {
      // This will navigate to /(tenant)/rented when that item is clicked
      router.push(`/(tenant)/${item.screen}`);
    }
  };

  if (showTerms) {
    return <TermsAndPrivacyScreen onBack={() => setShowTerms(false)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          {userData?.profile_image_url ? (
            <Image
              source={{ uri: userData.profile_image_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage]}>
              <Ionicons name="person-circle" size={60} color="#667eea" />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {userData?.first_name ? `${userData.first_name} ${userData.last_name}` : 'Tenant'}
            </Text>
            <Text style={styles.profileEmail}>{userData?.email}</Text>
            <Text style={styles.profileType}>Tenant</Text>
          </View>
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={() => router.push('/(tenant)/profile')}
          >
            <Ionicons name="create" size={20} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
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
                  <Ionicons name={item.icon} size={20} color="#667eea" />
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

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    color: '#667eea',
    fontWeight: '500',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  editProfileButton: {
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


import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  getTenantProfile,
  getCurrentUser,
} from '../../lib/supabaseClient';

export default function TenantProfile() {
  const { tenantId, conversationId } = useLocalSearchParams();
  const [tenant, setTenant] = useState(null);
  const [tenantProfileId, setTenantProfileId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const handleCall = () => {
    if (tenant?.phone) {
      Linking.openURL(`tel:${tenant.phone}`);
    }
  };

  const handleNavigateBack = () => {
    if (conversationId) {
      // Navigate back to chat with the conversation ID
      router.push({
        pathname: '/landlord/chat',
        params: { conversationId },
      });
    } else {
      // Fallback to regular back navigation
      router.back();
    }
  };

  const handleMessage = () => {
    if (!tenant || !tenantProfileId) return;
    
    router.push({
      pathname: '/landlord/chat',
      params: {
        id: tenantProfileId,
        tenantName: `${tenant.first_name} ${tenant.last_name}`.trim(),
        tenantImage: tenant.profile_image_url || '',
      },
    });
  };

  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        setIsLoading(true);
        
        // Verify current user is a landlord
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          Alert.alert('Error', 'Please log in to view tenant profiles');
          router.back();
          return;
        }

        if (!tenantId) {
          throw new Error("Tenant ID is missing.");
        }

        // Fetch tenant profile data
        const { success, user: userData, profile: profileData, error } = await getTenantProfile(tenantId);

        if (success && userData) {
          const tenantData = {
            id: userData.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            email: userData.email,
            phone: userData.phone,
            bio: userData.bio,
            profile_image_url: userData.profile_image_url,
            occupation: profileData?.occupation,
            budget_min: profileData?.budget_min,
            budget_max: profileData?.budget_max,
            preferences: profileData?.preferences,
            emergency_contact_name: profileData?.emergency_contact_name,
            emergency_contact_phone: profileData?.emergency_contact_phone,
            created_at: userData.created_at,
          };
          setTenant(tenantData);
          setTenantProfileId(profileData?.id);
        } else {
          throw new Error(error || 'Failed to load tenant data');
        }
      } catch (e) {
        console.error('Failed to load tenant data', e);
        Alert.alert('Error', e.message || 'An unexpected error occurred.');
        setTenant(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenantData();
  }, [tenantId]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading tenant profile...</Text>
      </View>
    );
  }

  if (!tenant) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleNavigateBack}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Tenant Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={{ marginTop: 20, fontSize: 16, color: '#666' }}>Could not find tenant profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleNavigateBack}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Tenant Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: tenant.profile_image_url || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.userName}>{tenant.first_name} {tenant.last_name}</Text>

          <View style={styles.userTypeContainer}>
            <Ionicons 
              name="person" 
              size={16} 
              color="#667eea" 
            />
            <Text style={[styles.userType, {color: "#667eea"}]}> 
              Tenant
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.messageButton]} onPress={handleMessage}>
            <Ionicons name="chatbubble" size={18} color="#fff" />
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tenant.budget_min ? '₱' + tenant.budget_min.toLocaleString() : 'N/A'}</Text>
            <Text style={styles.statLabel}>Min Budget</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tenant.budget_max ? '₱' + tenant.budget_max.toLocaleString() : 'N/A'}</Text>
            <Text style={styles.statLabel}>Max Budget</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tenant.occupation ? '✓' : '?'}</Text>
            <Text style={styles.statLabel}>Employed</Text>
          </View>
        </View>

        {/* Join Date */}
        {tenant.created_at && (
          <View style={styles.joinDateRow}>
            <Text style={styles.joinDateText}>
              Member since {new Date(tenant.created_at).getFullYear()}
            </Text>
          </View>
        )}

        {/* About Section */}
        {tenant.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.infoText}>{tenant.bio}</Text>
          </View>
        )}

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <Text style={styles.infoText}>{tenant.first_name} {tenant.last_name}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <Text style={styles.infoText}>{tenant.email || 'Not available'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <Text style={styles.infoText}>{tenant.phone || 'Not available'}</Text>
          </View>
        </View>

        {/* Occupation & Budget */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Occupation & Budget</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Occupation</Text>
            <Text style={styles.infoText}>{tenant.occupation || 'Not specified'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Budget Range</Text>
            <Text style={styles.infoText}>
              {tenant.budget_min && tenant.budget_max 
                ? `₱${tenant.budget_min.toLocaleString()} - ₱${tenant.budget_max.toLocaleString()}`
                : 'Not specified'
              }
            </Text>
          </View>

          {tenant.preferences && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferences</Text>
              <Text style={styles.infoText}>{tenant.preferences}</Text>
            </View>
          )}
        </View>

        {/* Emergency Contact */}
        {(tenant.emergency_contact_name || tenant.emergency_contact_phone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>

            {tenant.emergency_contact_name && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Name</Text>
                <Text style={styles.infoText}>{tenant.emergency_contact_name}</Text>
              </View>
            )}

            {tenant.emergency_contact_phone && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Phone</Text>
                <Text style={styles.infoText}>{tenant.emergency_contact_phone}</Text>
              </View>
            )}
          </View>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 30,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#667eea',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  userTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  userType: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  messageButton: {
    backgroundColor: '#10b981',
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  joinDateRow: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  joinDateText: {
    fontSize: 12,
    color: '#666',
  },
});
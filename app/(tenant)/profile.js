// app/(tenant)/profile.js
/**
 * Tenant Profile Screen
 * Database Tables Used:
 * - users: Store user info (first_name, last_name, email, phone, bio, profile_image_url)
 * - tenant_profile: Store tenant details (occupation, budget_min, budget_max, preferences, emergency_contact_*)
 * - storage/profile-images: Upload profile pictures
 */

import React, { useCallback, useEffect } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import {
  getCurrentUser,
  getTenantProfile,
  updateTenantProfile,
  uploadProfileImage,
  handleError,
} from '../../lib/supabaseClient';

export default function Profile() {
  const [userData, setUserData] = React.useState(null);
  const [tenantData, setTenantData] = React.useState(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();

      if (!user) {
        // User not logged in, redirect to login
        router.replace('/(auth)/index');
        return;
      }

      const { success, user: userData, profile: profileData } = await getTenantProfile(user.id);

      if (success) {
        setUserData(userData);
        setTenantData(profileData);
      } else {
        Alert.alert('Error', 'Failed to load profile');
      }
    } catch (error) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    loadProfile(); // Reload to discard changes
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();

      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Prepare updates with proper structure
      const userUpdates = {
        first_name: userData?.first_name,
        last_name: userData?.last_name,
        email: userData?.email,
        phone: userData?.phone,
        bio: userData?.bio,
        profile_image_url: userData?.profile_image_url,
      };

      const profileUpdates = {
        occupation: tenantData?.occupation,
        budget_min: tenantData?.budget_min,
        budget_max: tenantData?.budget_max,
        preferences: tenantData?.preferences,
        emergency_contact_name: tenantData?.emergency_contact_name,
        emergency_contact_phone: tenantData?.emergency_contact_phone,
      };

      // Update profile in database
      const { success: userSuccess, error: userError } = await updateTenantProfile(
        user.id,
        { userUpdates, profileUpdates }
      );

      if (userSuccess) {
        Alert.alert('Success', 'Profile saved successfully');
        setIsEditing(false);
        loadProfile(); // Reload to confirm changes
      } else {
        Alert.alert('Error', userError || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      setUploading(true);
      const user = await getCurrentUser();

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need camera roll permissions to change your profile photo.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Upload to Supabase Storage
        const { success, publicUrl, error } = await uploadProfileImage(
          user.id,
          result.assets[0].uri,
          'profile'
        );

        if (success) {
          setUserData({ ...userData, profile_image_url: publicUrl });
          Alert.alert('Success', 'Profile image uploaded');
        } else {
          Alert.alert('Error', error || 'Failed to upload image');
        }
      }
    } catch (err) {
      console.warn('Image pick error', err);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setUploading(false);
    }
  };

    // Handle System Back Action
  useFocusEffect(
    useCallback(() => {
      
      const handleBackPress = () => {
        // This function is executed when the system "Back" action occurs.
        router.replace('/(tenant)/menu');
        
        return true; 
      };
      let backHandlerSubscription; // variable to hold the listener object

      if (Platform.OS === 'android') {
        // listener and capture the returned subscription object
        backHandlerSubscription = BackHandler.addEventListener(
          'hardwareBackPress', 
          handleBackPress
        );
      }
      //Removes the listener when the screen is no longer focused.
      return () => {
        if (Platform.OS === 'android' && backHandlerSubscription) {
          backHandlerSubscription.remove();
        }
      };
    }, []) 
  );
  const takePhoto = async () => {
    try {
      setUploading(true);
      const user = await getCurrentUser();

      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need camera permissions to take a photo.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Upload to Supabase Storage
        const { success, publicUrl, error } = await uploadProfileImage(
          user.id,
          result.assets[0].uri,
          'profile'
        );

        if (success) {
          setUserData({ ...userData, profile_image_url: publicUrl });
          Alert.alert('Success', 'Photo uploaded');
        } else {
          Alert.alert('Error', error || 'Failed to upload photo');
        }
      }
    } catch (err) {
      console.warn('Camera error', err);
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setUploading(false);
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: pickImage,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const stats = [
    { label: 'Saved', value: '12', icon: 'heart' },
    { label: 'Viewed', value: '24', icon: 'eye' },
    { label: 'Applied', value: '5', icon: 'document-text' },
  ];

  const contactInfo = [
    { label: 'Email', value: userData?.email || '', icon: 'mail' },
    { label: 'Phone', value: userData?.phone || '', icon: 'call' },
    { label: 'Status', value: 'Active', icon: 'checkmark-circle' },
  ];

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading profile...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#666' }}>No profile data found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tenant)/menu')}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={isEditing ? handleCancelEdit : () => setIsEditing(true)}
        >
          <Ionicons 
            name={isEditing ? "close" : "create-outline"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.photoContainer}
            onPress={isEditing ? showImagePickerOptions : null}
            disabled={!isEditing}
          >
            <Image
              source={{ uri: userData?.image || 'https://via.placeholder.com/150' }}
              style={styles.profileImage}
            />
            {isEditing && (
              <View style={styles.editPhotoOverlay}>
                <Ionicons name="camera" size={24} color="white" />
              </View>
            )}
          </TouchableOpacity>
          
          {isEditing ? (
            <>
              <TextInput
                style={styles.editNameInput}
                value={userData?.first_name || ''}
                onChangeText={(text) => setUserData({...userData, first_name: text})}
                placeholder="First name"
              />
              <TextInput
                style={styles.editNameInput}
                value={userData?.last_name || ''}
                onChangeText={(text) => setUserData({...userData, last_name: text})}
                placeholder="Last name"
              />
            </>
          ) : (
            <>
              <Text style={styles.name}>{userData?.first_name} {userData?.last_name}</Text>
              <Text style={styles.userType}>Tenant</Text>
            </>
          )}
          
          <View style={styles.verificationSection}>
            <Text style={styles.joinDate}>Member since 2023</Text>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <View style={styles.statIcon}>
                <Ionicons name={stat.icon} size={20} color="#667eea" />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* About Me Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Me</Text>
          {isEditing ? (
            <TextInput
              style={styles.editBioInput}
              value={userData?.bio || ''}
              onChangeText={(text) => setUserData({...userData, bio: text})}
              placeholder="Tell us about yourself and what you're looking for..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.bioText}>{userData?.bio || 'No bio added'}</Text>
          )}
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget & Preferences</Text>
          {isEditing ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Occupation"
                value={tenantData?.occupation || ''}
                onChangeText={(text) => setTenantData({...tenantData, occupation: text})}
              />
              <TextInput
                style={styles.input}
                placeholder="Min Budget"
                value={String(tenantData?.budget_min || '')}
                keyboardType="decimal-pad"
                onChangeText={(text) => setTenantData({...tenantData, budget_min: parseFloat(text) || 0})}
              />
              <TextInput
                style={styles.input}
                placeholder="Max Budget"
                value={String(tenantData?.budget_max || '')}
                keyboardType="decimal-pad"
                onChangeText={(text) => setTenantData({...tenantData, budget_max: parseFloat(text) || 0})}
              />
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Preferences"
                value={tenantData?.preferences || ''}
                multiline
                numberOfLines={4}
                onChangeText={(text) => setTenantData({...tenantData, preferences: text})}
                textAlignVertical="top"
              />
            </>
          ) : (
            <>
              <Text style={styles.bioText}><Text style={{fontWeight: '600'}}>Occupation:</Text> {tenantData?.occupation || 'Not specified'}</Text>
              <Text style={styles.bioText}><Text style={{fontWeight: '600'}}>Budget:</Text> ₱{tenantData?.budget_min?.toLocaleString() || '0'} - ₱{tenantData?.budget_max?.toLocaleString() || '0'}</Text>
              <Text style={styles.bioText}><Text style={{fontWeight: '600'}}>Preferences:</Text> {tenantData?.preferences || 'Not specified'}</Text>
            </>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactList}>
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Ionicons name="mail" size={18} color="#667eea" />
              </View>
              <View style={styles.contactDetails}>
                <Text style={styles.contactLabel}>Email</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.editContactInput}
                    value={userData?.email || ''}
                    editable={false}
                    placeholder="Email address"
                    keyboardType="email-address"
                  />
                ) : (
                  <Text style={styles.contactValue}>{userData?.email}</Text>
                )}
              </View>
            </View>

            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Ionicons name="call" size={18} color="#667eea" />
              </View>
              <View style={styles.contactDetails}>
                <Text style={styles.contactLabel}>Phone</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.editContactInput}
                    value={userData?.phone || ''}
                    onChangeText={(text) => setUserData({...userData, phone: text})}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.contactValue}>{userData?.phone}</Text>
                )}
              </View>
            </View>

            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Ionicons name="checkmark-circle" size={18} color="#667eea" />
              </View>
              <View style={styles.contactDetails}>
                <Text style={styles.contactLabel}>Status</Text>
                <Text style={styles.contactValue}>Active</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          {isEditing ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Contact Name"
                value={tenantData?.emergency_contact_name || ''}
                onChangeText={(text) => setTenantData({...tenantData, emergency_contact_name: text})}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact Phone"
                value={tenantData?.emergency_contact_phone || ''}
                keyboardType="phone-pad"
                onChangeText={(text) => setTenantData({...tenantData, emergency_contact_phone: text})}
              />
            </>
          ) : (
            <>
              <Text style={styles.bioText}><Text style={{fontWeight: '600'}}>Name:</Text> {tenantData?.emergency_contact_name || 'Not specified'}</Text>
              <Text style={styles.bioText}><Text style={{fontWeight: '600'}}>Phone:</Text> {tenantData?.emergency_contact_phone || 'Not specified'}</Text>
            </>
          )}
        </View>

        {/* Action Buttons */}
        {isEditing ? (
          <View style={styles.editActions}>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveProfile}
              disabled={loading}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelEdit}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.editButtonBottom}
            onPress={() => setIsEditing(true)}
            disabled={loading}
          >
            <Ionicons name="create" size={20} color="#667eea" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#667eea',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    padding: 8,
  },
  page: {
    backgroundColor: '#f6f7fb',
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#667eea',
  },
  editPhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  editNameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#667eea',
    width: '100%',
    padding: 4,
  },
  userType: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  verificationSection: {
    alignItems: 'center',
  },
  joinDate: {
    fontSize: 12,
    color: '#666',
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  editBioInput: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  contactList: {
    gap: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactDetails: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  editContactInput: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: '#667eea',
    padding: 4,
  },
  editActions: {
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
    backgroundColor: 'white',
  },
  cancelButtonText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 16,
  },
  editButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#667eea',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 40,
  },
  editButtonText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 16,
  },
});
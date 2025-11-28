import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import {
  getCurrentUser,
  getLandlordProfile,
  updateLandlordProfile,
  getLandlordListings,
  uploadProfileImage,
} from '../../lib/supabaseClient';
import { saveLandlordProfile } from '../../lib/profileCache';

export default function LandlordProfile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [company, setCompany] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [propertyCount, setPropertyCount] = useState(0);
  const [createdAt, setCreatedAt] = useState(null);
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      setCurrentUser(user);

      if (user) {
        // Load complete landlord profile from database
        const { success, profile, fromCache } = await getLandlordProfile(user.id);
        if (success && profile) {
          setIsUsingCachedData(fromCache || false);
          
          // Get user data from nested users object
          const userData = profile.users;
          if (userData) {
            setName(`${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email);
            setEmail(userData.email || '');
            setPhone(userData.phone || '');
            setCreatedAt(userData.created_at || null);
            // Set photoURL to null unless one exists
            setPhotoURL(userData.profile_image_url || null);
          }
          // Load landlord-specific data
          setBio(profile.bio || '');
          setCompany(profile.company_name || '');
          setYearsExperience(String(profile.years_experience || 0));
        }
        
        // Fetch the number of listings this landlord has posted (skip if using cached data)
        if (!fromCache) {
          const { success: listingsSuccess, listings } = await getLandlordListings(user.id);
          if (listingsSuccess && listings) {
            setPropertyCount(listings.length);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { label: 'Properties', value: String(propertyCount), icon: 'business' },
    { label: 'Years Experience', value: yearsExperience, icon: 'trophy' },
    { label: 'Response Rate', value: '95%', icon: 'speedometer' },
  ];

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setPhotoURL(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Image pick error', err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  // Handle System Back Action
  useFocusEffect(
    useCallback(() => {
      
      const handleBackPress = () => {
        // This function is executed when the system "Back" action occurs.
        router.replace('/landlord/menu');
        
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

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Validation', 'Name and Email are required.');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Not logged in');
      return;
    }

    setIsSaving(true);
    try {
      const [firstName, lastName] = name.trim().split(' ');
      
      // 📸 UPLOAD PROFILE IMAGE if it's a local file (not already a URL)
      let finalPhotoURL = photoURL;
      if (photoURL && (photoURL.startsWith('file://') || photoURL.startsWith('content://'))) {
        console.log('[Profile] Uploading new profile image...');
        const uploadResult = await uploadProfileImage(currentUser.id, photoURL, 'profile.jpg');
        if (uploadResult.success && uploadResult.publicUrl) {
          finalPhotoURL = uploadResult.publicUrl;
          console.log('[Profile] Image uploaded successfully:', finalPhotoURL);
        } else {
          console.warn('[Profile] Image upload failed:', uploadResult.error);
          Alert.alert('Warning', 'Failed to upload profile image, but will save other changes.');
        }
      }
      
      const { success, error } = await updateLandlordProfile(currentUser.id, {
        first_name: firstName || '',
        last_name: lastName || '',
        email: email.trim(),
        phone: phone.trim(),
        profile_image_url: finalPhotoURL,
        bio: bio.trim(),
        company_name: company.trim(),
        years_experience: parseInt(yearsExperience) || 0,
      });

      if (success) {
        // 💾 SAVE LANDLORD PROFILE PERMANENTLY to AsyncStorage
        const userData = {
          id: currentUser.id,
          first_name: firstName || '',
          last_name: lastName || '',
          email: email.trim(),
          phone: phone.trim(),
          profile_image_url: finalPhotoURL,
          bio: bio.trim(),
        };
        const profileData = {
          company_name: company.trim(),
          years_experience: parseInt(yearsExperience) || 0,
        };
        await saveLandlordProfile(currentUser.id, userData, profileData);
        
        // Update local state with the uploaded URL
        setPhotoURL(finalPhotoURL);
        
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    loadProfileData();
    setIsEditing(false);
  };

  const contactInfo = [
    { label: 'Email', value: email, icon: 'mail' },
    { label: 'Phone', value: phone, icon: 'call' },
    { label: 'Years Experience', value: yearsExperience, icon: 'briefcase' },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Profile',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => setIsEditing(!isEditing)} 
              style={{ paddingRight: 16 }}
            >
              <Ionicons 
                name={isEditing ? "close" : "create-outline"} 
                size={24} 
                color="#fff" 
              />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 0} 
      >
        <ScrollView style={styles.page} contentContainerStyle={styles.container}>
          
          {/* Offline/Cached Data Banner */}
          {isUsingCachedData && (
            <View style={styles.cachedDataBanner}>
              <Ionicons name="cloud-offline" size={18} color="#ff9800" />
              <Text style={styles.cachedDataText}>
                Viewing offline profile data
              </Text>
            </View>
          )}
          
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.photoContainer} 
              onPress={isEditing ? pickImage : null}
              disabled={!isEditing}
            >
              {photoURL ? (
                <Image
                  source={{ uri: photoURL }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={[styles.profileImage, styles.placeholderImage]}>
                  <Ionicons name="person-circle" size={93} color="#667eea" />
                </View>
              )}
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
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                />
                <TextInput
                  style={styles.editCompanyInput}
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Company name"
                />
                <TextInput
                  style={styles.editCompanyInput}
                  value={yearsExperience}
                  onChangeText={setYearsExperience}
                  placeholder="Years of experience"
                  keyboardType="numeric"
                />
              </>
            ) : (
              <>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.company}>{company}</Text>
              </>
            )}
            
            <View style={styles.verificationSection}>
              <View style={styles.verificationBadge}>
                <Ionicons 
                  name="shield-checkmark" 
                  size={16} 
                  color="#10b981"
                />
                <Text style={[
                  styles.verificationText,
                  { color: "#10b981" }
                ]}>
                  Verified Landlord
                </Text>
              </View>
              <Text style={styles.joinDate}>
                Member since {createdAt ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
              </Text>
            </View>
          </View>

          
          <View style={styles.statsSection}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Ionicons name={stat.icon} size={20} color={Colors.primary} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

        
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            {isEditing ? (
              <TextInput
                style={styles.editBioInput}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell tenants about yourself and your experience..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.bioText}>{bio}</Text>
            )}
            <View style={styles.experienceBadge}>
              <Ionicons name="trophy" size={16} color="#f59e0b" />
              <Text style={styles.experienceText}>
                {yearsExperience}+ years experience
              </Text>
            </View>
          </View>

          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactList}>
              {contactInfo.map((contact, index) => (
                <View key={index} style={styles.contactItem}>
                  <View style={styles.contactIcon}>
                    <Ionicons name={contact.icon} size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactLabel}>{contact.label}</Text>
                    {isEditing && contact.label === 'Email' ? (
                      <TextInput
                        style={styles.editContactInput}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email address"
                        keyboardType="email-address"
                      />
                    ) : isEditing && contact.label === 'Phone' ? (
                      <TextInput
                        style={styles.editContactInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Phone number"
                        keyboardType="phone-pad"
                      />
                    ) : (
                      <Text style={styles.contactValue}>{contact.value}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

        
          {isEditing && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notification Settings</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Email Notifications</Text>
                  <Text style={styles.settingDescription}>Receive booking requests and messages via email</Text>
                </View>
                <Switch
                  value={emailNotifications}
                  onValueChange={setEmailNotifications}
                  trackColor={{ false: '#f1f5f9', true: '#c7d2fe' }}
                  thumbColor={emailNotifications ? Colors.primary : '#f8fafc'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>SMS Notifications</Text>
                  <Text style={styles.settingDescription}>Get important updates via text message</Text>
                </View>
                <Switch
                  value={smsNotifications}
                  onValueChange={setSmsNotifications}
                  trackColor={{ false: '#f1f5f9', true: '#c7d2fe' }}
                  thumbColor={smsNotifications ? Colors.primary : '#f8fafc'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Show Contact Info</Text>
                  <Text style={styles.settingDescription}>Display your contact information to tenants</Text>
                </View>
                <Switch
                  value={showContactInfo}
                  onValueChange={setShowContactInfo}
                  trackColor={{ false: '#f1f5f9', true: '#c7d2fe' }}
                  thumbColor={showContactInfo ? Colors.primary : '#f8fafc'}
                />
              </View>
            </View>
          )}

          {/* Action Buttons */}
          {isEditing ? (
            <View style={styles.editActions}>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="create" size={20} color={Colors.primary} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f6f7fb',
    flex: 1,
  },
  container: {
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
    borderColor: Colors.primary,
  },
  placeholderImage: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
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
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    borderBottomColor: Colors.primary,
    width: '100%',
    padding: 4,
  },
  company: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  editCompanyInput: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    width: '100%',
    padding: 4,
  },
  verificationSection: {
    alignItems: 'center',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  editBioInput: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  experienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  experienceText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '500',
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
    borderBottomColor: Colors.primary,
    padding: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  editActions: {
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: Colors.primary,
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 40,
  },
  cachedDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  cachedDataText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  editButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { useAuth } from './AuthContext';

// NOTE: In a real app, you would fetch and update the user's details 
// from your backend API here. We'll use mock state updates for now.

export default function EditLandlordProfile() {
  const { user, login } = useAuth(); // We use login to update the global user state
  
  // State for the form fields, initialized with current user data
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || ''); // Assuming phone will be part of user object
  const [bio, setBio] = useState(user?.bio || ''); // Assuming bio will be part of user object
  const [photoURL, setPhotoURL] = useState(user?.photoURL || 'https://via.placeholder.com/150/667eea/FFFFFF?text=L');
  const [isSaving, setIsSaving] = useState(false);

  // Function to handle image picking
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

  const handleSaveProfile = () => {
    if (!name.trim() || !email.trim()) {
      return Alert.alert('Validation', 'Name and Email are required.');
    }
    
    setIsSaving(true);

    // 1. (REAL APP LOGIC): Send updated data to your backend API here (e.g., PUT /api/landlord/profile)
    // 2. Wait for API response...

    // Mock API response delay
    setTimeout(() => {
      setIsSaving(false);
      
      // Update the global user context with the new data
      const updatedUserPayload = {
        ...user,
        name: name,
        email: email,
        phone: phone,
        bio: bio,
        photoURL: photoURL,
      };
      
      // NOTE: We are using the 'login' function from AuthContext to simulate 
      // updating the user data in the global state.
      login(updatedUserPayload); 
      
      Alert.alert('Success', 'Profile saved successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }, 1500);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Edit Your Public Profile</Text>
        <Text style={styles.subtext}>This information will be visible to tenants viewing your listings.</Text>
        
        {/* Profile Picture Section */}
        <View style={styles.photoContainer}>
          <Image
            source={{ uri: photoURL }}
            style={styles.profileImage}
          />
          <TouchableOpacity style={styles.editPhotoButton} onPress={pickImage}>
            <Ionicons name="camera" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Form Inputs */}
        <Text style={styles.label}>Full Name</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Your full legal name" 
          value={name} 
          onChangeText={setName} 
        />

        <Text style={styles.label}>Bio / Description</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder="A short introduction about yourself and your commitment as a landlord (e.g., 'Dedicated to providing safe and clean homes')"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={300}
        />

        <Text style={styles.label}>Public Contact Email</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Email for inquiries" 
          value={email} 
          onChangeText={setEmail} 
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Public Contact Number (Optional)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Phone number for calls/SMS" 
          value={phone} 
          onChangeText={setPhone} 
          keyboardType="phone-pad"
        />

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
          onPress={handleSaveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <Text style={styles.saveButtonText}>Saving...</Text>
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f6f7fb',
  },
  container: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  subtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.primary,
    marginBottom: -30, // Pull the edit button up
  },
  editPhotoButton: {
    marginTop: -30,
    marginLeft: 90,
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  label: {
    marginTop: 15,
    marginBottom: 8,
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#eef0f3',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fbfcfe',
    fontSize: 16,
  },
  saveButton: {
    marginTop: 30,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
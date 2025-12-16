
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { landlordSignUp, uploadProfileImage, supabase } from '../../lib/supabaseClient';

const SignUpForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    profileImage: null,
    idPhoto: null,
    businessPermit: null,
    companyName: '',
    yearsExperience: '0',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

 
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
  };


  const pickImage = async (field) => {
    if (isLoading) return;
    
    try {
      // Request permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Immediately update state to show the image
        const uri = result.assets[0].uri;
        setFormData(prev => ({ ...prev, [field]: uri }));
        // Clear error for this field if it exists
        setErrors(prev => ({ ...prev, [field]: undefined }));
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };


  const validateStep = () => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.firstName) newErrors.firstName = 'First name is required';
      if (!formData.lastName) newErrors.lastName = 'Last name is required';
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email format';
      if (!formData.password) newErrors.password = 'Password is required';
      else if (!validatePassword(formData.password)) 
        newErrors.password = 'Password must be at least 6 characters long';
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';
      else if (!validatePhoneNumber(formData.phoneNumber)) 
        newErrors.phoneNumber = 'Invalid phone number format';
    }

    if (step === 2) {
      if (!formData.profileImage) newErrors.profileImage = 'Profile image is required';
      if (!formData.idPhoto) newErrors.idPhoto = 'ID photo is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const handleNextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  
  const handleSubmit = async () => {
    if (!validateStep()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Sign up landlord with Supabase
      const signUpResult = await landlordSignUp({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phoneNumber,
        companyName: formData.companyName,
        yearsExperience: parseInt(formData.yearsExperience) || 0,
      });

      if (signUpResult.success && signUpResult.user) {
        const userId = signUpResult.user.id;
        
        // Verify user ID before proceeding
        if (!userId) {
          Alert.alert('Error', 'Account created but user ID missing. Please contact support.');
          return;
        }
        
        // Upload profile image if available
        if (formData.profileImage) {
          try {
            const uploadResult = await uploadProfileImage(userId, formData.profileImage);
            if (uploadResult.success) {
              // Update user's profile_image_url in the database
              const { error: updateError } = await supabase
                .from('users')
                .update({ profile_image_url: uploadResult.publicUrl })
                .eq('id', userId);
              if (updateError) {
                console.warn('Failed to update profile image URL:', updateError);
              }
            } else {
              console.warn('Profile image upload failed:', uploadResult.error);
            }
          } catch (uploadError) {
            console.warn('Profile image upload error:', uploadError);
            // Continue without image - it's not critical
          }
        }
        
        Alert.alert(
          'Success',
          'Registration completed! Welcome to BoardEase.',
          [
            {
              text: 'OK',
              onPress: () => {
                try {
                  router.replace('/landlord');
                } catch (navError) {
                  console.error('Navigation error:', navError);
                  Alert.alert('Error', 'Failed to load landlord portal. Please try logging in manually.');
                }
              }
            }
          ]
        );
      } else {
        const errorMessage = signUpResult.error || 'An error occurred';
        
        if (errorMessage.includes('already registered')) {
          Alert.alert(
            'Email Already Registered',
            'This email is already registered. Please sign in or use a different email.'
          );
        } else if (errorMessage.includes('Invalid password')) {
          Alert.alert(
            'Weak Password',
            'Password must be at least 6 characters long.'
          );
        } else if (errorMessage.includes('only request this after')) {
          Alert.alert(
            'Too Many Attempts',
            'For security purposes, please wait a minute before trying again with the same email.'
          );
        } else {
          Alert.alert('Registration Failed', errorMessage);
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'An unexpected error occurred during registration';
      
      if (error.message && error.message.includes('Invalid API key')) {
        errorMessage = 'Connection error. Please check your internet connection.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, errors.firstName && styles.inputError]}
          placeholder="First Name"
          placeholderTextColor="#999"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
          autoCapitalize="words"
          editable={!isLoading}
        />
      </View>
      {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}

      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, errors.lastName && styles.inputError]}
          placeholder="Last Name"
          placeholderTextColor="#999"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
          autoCapitalize="words"
          editable={!isLoading}
        />
      </View>
      {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}

      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Email Address"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          editable={!isLoading}
        />
      </View>
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Password (min. 6 characters)"
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          editable={!isLoading}
        />
        <TouchableOpacity 
          style={styles.passwordToggle}
          onPress={() => setShowPassword(!showPassword)}
          disabled={isLoading}
        >
          <Ionicons 
            name={showPassword ? "eye-off-outline" : "eye-outline"} 
            size={20} 
            color="#999" 
          />
        </TouchableOpacity>
      </View>
      {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, errors.confirmPassword && styles.inputError]}
          placeholder="Confirm Password"
          placeholderTextColor="#999"
          secureTextEntry={!showConfirmPassword}
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
          editable={!isLoading}
        />
        <TouchableOpacity 
          style={styles.passwordToggle}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          disabled={isLoading}
        >
          <Ionicons 
            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
            size={20} 
            color="#999" 
          />
        </TouchableOpacity>
      </View>
      {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

      <View style={styles.inputContainer}>
        <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, errors.phoneNumber && styles.inputError]}
          placeholder="Phone Number"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          value={formData.phoneNumber}
          onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
          editable={!isLoading}
        />
      </View>
      {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Document Verification</Text>

      <View style={styles.uploadSection}>
        <Text style={styles.uploadLabel}>Profile Picture *</Text>
        <TouchableOpacity
          style={[styles.uploadButton, errors.profileImage && styles.uploadButtonError]}
          onPress={() => pickImage('profileImage')}
          disabled={isLoading}
        >
          {formData.profileImage ? (
            <Image source={{ uri: formData.profileImage }} style={styles.previewImage} />
          ) : (
            <>
              <MaterialIcons name="add-photo-alternate" size={32} color="#667eea" />
              <Text style={styles.uploadButtonText}>Tap to Upload Profile Picture</Text>
            </>
          )}
        </TouchableOpacity>
        {errors.profileImage && <Text style={styles.errorText}>{errors.profileImage}</Text>}
      </View>

      <View style={styles.uploadSection}>
        <Text style={styles.uploadLabel}>Valid ID *</Text>
        <TouchableOpacity
          style={[styles.uploadButton, errors.idPhoto && styles.uploadButtonError]}
          onPress={() => pickImage('idPhoto')}
          disabled={isLoading}
        >
          {formData.idPhoto ? (
            <Image source={{ uri: formData.idPhoto }} style={styles.previewImage} />
          ) : (
            <>
              <MaterialIcons name="badge" size={32} color="#667eea" />
              <Text style={styles.uploadButtonText}>Tap to Upload Valid ID</Text>
            </>
          )}
        </TouchableOpacity>
        {errors.idPhoto && <Text style={styles.errorText}>{errors.idPhoto}</Text>}
      </View>

      <View style={styles.uploadSection}>
        <Text style={styles.uploadLabel}>Business Permit (Optional)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickImage('businessPermit')}
          disabled={isLoading}
        >
          {formData.businessPermit ? (
            <Image source={{ uri: formData.businessPermit }} style={styles.previewImage} />
          ) : (
            <>
              <FontAwesome5 name="file-certificate" size={28} color="#667eea" />
              <Text style={styles.uploadButtonText}>Tap to Upload Business Permit</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.termsContainer}>
        <Text style={styles.termsText}>
          By registering as a landlord, you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Become a Landlord</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>

          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: 'https://img.freepik.com/premium-vector/house-logo-design-concept_761413-5937.jpg' }} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Register as Landlord</Text>
            <Text style={styles.subtitle}>List and manage your boarding houses</Text>
          </View>

          
          <View style={styles.card}>
            
            <View style={styles.progressContainer}>
              {[1, 2].map((item) => (
                <View
                  key={item}
                  style={[
                    styles.progressStep,
                    item < step && styles.progressStepCompleted,
                    item === step && styles.progressStepActive,
                  ]}
                >
                  <Text style={[
                    styles.progressText,
                    (item <= step) && styles.progressTextActive
                  ]}>
                    {item}
                  </Text>
                </View>
              ))}
              <View style={styles.progressLine} />
            </View>

            {step === 1 && renderStep1()}            
            {step === 2 && renderStep2()}

           
            <View style={styles.buttonContainer}>
              {step === 1 ? (
                <TouchableOpacity 
                  style={[
                    styles.button, 
                    styles.buttonPrimary,
                    styles.buttonFullWidth,
                    (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.confirmPassword || !formData.phoneNumber) && styles.buttonDisabled,
                    isLoading && styles.buttonLoading
                  ]}
                  onPress={handleNextStep}
                  disabled={!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.confirmPassword || !formData.phoneNumber || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonTextPrimary}>Continue to Documents</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary, { flex: 0.35 }]}
                    onPress={() => setStep(step - 1)}
                    disabled={isLoading}
                  >
                    <Ionicons name="arrow-back" size={20} color="#667eea" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.button, 
                      styles.buttonPrimary,
                      { flex: 0.65 },
                      (!formData.profileImage || !formData.idPhoto) && styles.buttonDisabled,
                      isLoading && styles.buttonLoading
                    ]}
                    onPress={handleSubmit}
                    disabled={!formData.profileImage || !formData.idPhoto || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.buttonTextPrimary}>Complete Registration</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  logo: {
    width: 70,
    height: 70,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  progressStepActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  progressStepCompleted: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  progressTextActive: {
    color: 'white',
  },
  progressLine: {
    position: 'absolute',
    top: 15,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#e5e5e5',
    zIndex: 1,
  },
  stepContainer: {
    marginBottom: 10,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  inputIcon: {
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  passwordToggle: {
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 12,
    paddingLeft: 4,
  },
  uploadButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#667eea',
    borderRadius: 12,
    padding: 20,
    height: 180,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
  },
  uploadButtonError: {
    borderColor: '#ef4444',
  },
  uploadButtonText: {
    marginTop: 10,
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  uploadSection: {
    marginBottom: 20,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  uploadedImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 16,
  },
  termsContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: '#667eea',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  buttonPrimary: {
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  buttonLoading: {
    opacity: 0.8,
  },
  buttonTextPrimary: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSecondary: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonFullWidth: {
    flex: 1,
  },
});

export default SignUpForm;
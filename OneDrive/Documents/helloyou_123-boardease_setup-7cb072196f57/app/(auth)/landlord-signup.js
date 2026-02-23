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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const SignUpForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
        
    // Document Information
    profileImage: null,
    idPhoto: null,
    businessPermit: null,
    
    // Terms and Verification
    isTermsAccepted: false,
    isEmailVerified: false,
  });

  const [errors, setErrors] = useState({});

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=])[A-Za-z\d!@#$%^&*()_+\-=]{8,}$/;
    return passwordRegex.test(password);
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
  };

  // Image picker function
  const pickImage = async (field) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setFormData({ ...formData, [field]: result.assets[0].uri });
    }
  };

  // Validate current step
  const validateStep = () => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.firstName) newErrors.firstName = 'First name is required';
      if (!formData.lastName) newErrors.lastName = 'Last name is required';
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email format';
      if (!formData.password) newErrors.password = 'Password is required';
      else if (!validatePassword(formData.password)) 
        newErrors.password = 'Password must contain at least 8 characters, including uppercase, lowercase, number and special character';
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (!validatePhoneNumber(formData.phoneNumber)) 
        newErrors.phoneNumber = 'Invalid phone number format';
    }

    if (step === 2) {
      if (!formData.profileImage) newErrors.profileImage = 'Profile image is required';
      if (!formData.idPhoto) newErrors.idPhoto = 'ID photo is required';
      // Business permit can be optional
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (validateStep()) {
      try {
        // Here you would typically make an API call to register the landlord
        console.log('Form submitted:', formData);
        Alert.alert(
          'Success',
          'Your registration has been submitted for review. We will notify you once your account is verified.',
          [{ text: 'OK', onPress: () => router.replace('/index') }]
        );
      } catch (error) {
        Alert.alert('Error', 'Something went wrong. Please try again later.');
      }
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      
      <TextInput
        style={[styles.input, errors.firstName && styles.inputError]}
        placeholder="First Name"
        value={formData.firstName}
        onChangeText={(text) => setFormData({ ...formData, firstName: text })}
      />
      {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}

      <TextInput
        style={[styles.input, errors.lastName && styles.inputError]}
        placeholder="Last Name"
        value={formData.lastName}
        onChangeText={(text) => setFormData({ ...formData, lastName: text })}
      />
      {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}

      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
      />
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      <TextInput
        style={[styles.input, errors.password && styles.inputError]}
        placeholder="Password"
        secureTextEntry
        value={formData.password}
        onChangeText={(text) => setFormData({ ...formData, password: text })}
      />
      {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

      <TextInput
        style={[styles.input, errors.confirmPassword && styles.inputError]}
        placeholder="Confirm Password"
        secureTextEntry
        value={formData.confirmPassword}
        onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
      />
      {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

      <TextInput
        style={[styles.input, errors.phoneNumber && styles.inputError]}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={formData.phoneNumber}
        onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
      />
      {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Document Upload</Text>

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => pickImage('profileImage')}
      >
        <MaterialIcons name="add-photo-alternate" size={24} color="#667eea" />
        <Text style={styles.uploadButtonText}>Upload Profile Picture</Text>
      </TouchableOpacity>
      {formData.profileImage && (
        <Image source={{ uri: formData.profileImage }} style={styles.uploadedImage} />
      )}
      {errors.profileImage && <Text style={styles.errorText}>{errors.profileImage}</Text>}

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => pickImage('idPhoto')}
      >
        <MaterialIcons name="badge" size={24} color="#667eea" />
        <Text style={styles.uploadButtonText}>Upload Valid ID</Text>
      </TouchableOpacity>
      {formData.idPhoto && (
        <Image source={{ uri: formData.idPhoto }} style={styles.uploadedImage} />
      )}
      {errors.idPhoto && <Text style={styles.errorText}>{errors.idPhoto}</Text>}

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => pickImage('businessPermit')}
      >
        <FontAwesome5 name="file-certificate" size={24} color="#667eea" />
        <Text style={styles.uploadButtonText}>Upload Business Permit (Optional)</Text>
      </TouchableOpacity>
      {formData.businessPermit && (
        <Image source={{ uri: formData.businessPermit }} style={styles.uploadedImage} />
      )}
      {errors.businessPermit && <Text style={styles.errorText}>{errors.businessPermit}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Landlord Registration</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.progressContainer}>
              {[1, 2].map((item) => (
                <View
              key={item}
              style={[
                styles.progressDot,
                item <= step ? styles.progressDotActive : null,
              ]}
            />
          ))}
            </View>

            {step === 1 && renderStep1()}            
            {step === 2 && renderStep2()}

            <View style={styles.buttonContainer}>
              {step > 1 && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => setStep(step - 1)}
                >
                  <Text style={styles.buttonTextSecondary}>Previous</Text>
                </TouchableOpacity>
              )}

              {step < 2 ? (
                <TouchableOpacity style={styles.button} onPress={handleNextStep}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradientButton}>
                    <Text style={styles.buttonTextPrimary}>Next</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradientButton}>
                    <Text style={styles.buttonTextPrimary}>Submit</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  gradient: { 
    flex: 1 
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  backButton: {},
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e9ecef',
    marginHorizontal: 8,
  },
  progressDotActive: {
    backgroundColor: '#667eea',
  },
  stepContainer: {
    marginBottom: 10,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 13,
    marginTop: -10,
    marginBottom: 10,
    paddingLeft: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#667eea',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    justifyContent: 'center',
  },
  uploadButtonText: {
    marginLeft: 10,
    color: '#667eea',
    fontSize: 16,
    fontWeight: '500',
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 5,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonTextPrimary: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonTextSecondary: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default SignUpForm;
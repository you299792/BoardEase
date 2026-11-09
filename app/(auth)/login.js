import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { signIn } from '../../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('tenant'); 
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('[Login] Starting login with email:', email);
      const result = await signIn(email, password);
      console.log('[Login] Sign in result:', result);
      
      if (result.success && (result.data?.user || result.user)) {
        const user = result.data?.user || result.user;
        console.log('[Login] User object:', user);
        
        // Verify user_type exists before routing
        if (!user || !user.user_type) {
          console.error('[Login] No user_type in user object');
          Alert.alert('Error', 'User profile is incomplete. Please contact support.');
          setIsLoading(false);
          return;
        }
        
        console.log('[Login] User type confirmed:', user.user_type);
        
        // Route based on user_type from database
        try {
          if (user.user_type === 'tenant') {
            console.log('[Login] Routing to tenant home');
            await router.replace('/(tenant)/home');
          } else if (user.user_type === 'landlord') {
            console.log('[Login] Routing to landlord home');
            await router.replace('/landlord');
          } else {
            Alert.alert('Error', `Unknown user type: ${user.user_type}`);
          }
        } catch (navigationError) {
          console.error('[Login] Navigation error:', navigationError);
          Alert.alert('Error', 'Failed to navigate after login. Please try again.');
        }
      } else {
        // Handle specific errors
        const errorMessage = result.error || 'Invalid email or password';
        console.error('[Login] Login failed:', errorMessage);
        
        if (errorMessage.includes('Invalid login credentials')) {
          Alert.alert(
            'Invalid Credentials',
            'The email or password you entered is incorrect. Please try again or sign up if you don\'t have an account.',
            [
              { text: 'Try Again', style: 'default' },
              { text: 'Sign Up', onPress: () => handleSignUpPress(), style: 'cancel' }
            ]
          );
        } else if (errorMessage.includes('Email not confirmed')) {
          Alert.alert(
            'Email Not Confirmed',
            'Please check your email and confirm your account before signing in.'
          );
        } else {
          Alert.alert('Login Failed', errorMessage);
        }
      }
    } catch (error) {
      console.error('[Login] Unexpected error:', error);
      console.error('[Login] Error message:', error?.message);
      console.error('[Login] Error stack:', error?.stack);
      Alert.alert('Error', 'An unexpected error occurred during login: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpPress = () => {
    if (userType === 'landlord') {
      router.push('/(auth)/landlord-signup');
    } else {
      router.push('/(auth)/tenant-signup');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <View style={styles.placeholder} />
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/BoardEase_intro.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>BoardEase</Text>
            <Text style={styles.subtitle}>Find your perfect boarding house in CDO</Text>
          </View>

          
          <View style={styles.card}>
            
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  userType === 'tenant' && styles.userTypeButtonActive
                ]}
                onPress={() => setUserType('tenant')}
                disabled={isLoading}
              >
                <Ionicons 
                  name="person-outline" 
                  size={20} 
                  color={userType === 'tenant' ? '#667eea' : '#666'} 
                />
                <Text style={[
                  styles.userTypeText,
                  userType === 'tenant' && styles.userTypeTextActive
                ]}>
                  Tenant
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  userType === 'landlord' && styles.userTypeButtonActive
                ]}
                onPress={() => setUserType('landlord')}
                disabled={isLoading}
              >
                <Ionicons 
                  name="business-outline" 
                  size={20} 
                  color={userType === 'landlord' ? '#667eea' : '#666'} 
                />
                <Text style={[
                  styles.userTypeText,
                  userType === 'landlord' && styles.userTypeTextActive
                ]}>
                  Landlord
                </Text>
              </TouchableOpacity>
            </View>

            
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Feather name="mail" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Feather name="lock" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
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

              <TouchableOpacity 
                style={styles.forgotPassword}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.loginButton,
                  (!email || !password) && styles.loginButtonDisabled,
                  isLoading && styles.loginButtonLoading
                ]}
                onPress={handleLogin}
                disabled={!email || !password || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity 
                  onPress={handleSignUpPress}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.signupLink,
                    isLoading && styles.signupLinkDisabled
                  ]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing in, you agree to our{' '}
              <Text style={styles.footerLink}>Terms of Service</Text> and{' '}
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    marginBottom: 40,
    marginTop: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
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
  userTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  userTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  userTypeButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
    elevation: 2,
  },
  userTypeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  userTypeTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  form: {
    marginTop: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
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
  passwordToggle: {
    paddingHorizontal: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotPasswordText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    minHeight: 54,
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  loginButtonLoading: {
    opacity: 0.8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    color: '#666',
    fontSize: 14,
  },
  signupLink: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: 'bold',
  },
  signupLinkDisabled: {
    color: '#ccc',
  },
  footer: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  footerLink: {
    color: '#667eea',
    fontWeight: '500',
  },
});

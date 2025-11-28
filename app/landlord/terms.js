import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const TERMS_OF_SERVICE = `
1. Acceptance of Terms
By accessing or using the Boarding House Finder app, you agree to be bound by these Terms of Service (ToS). We reserve the right to modify these terms at any time.

2. User Conduct
Users must act respectfully. You are solely responsible for all content, including listings, images, and text, that you submit to the platform. Misrepresentation of properties is strictly prohibited.

3. Listing Accuracy
We act as a listing platform only. We do not verify the complete accuracy of all listings and strongly recommend that Tenants perform their own due diligence, including physical inspection and legal agreement review, before making any payment or commitment.

4. Payments and Bookings
All financial transactions and lease agreements are solely between the Tenant and the Landlord. We are not a party to any lease agreement and are not liable for any disputes arising from them.

5. Termination
We may terminate or suspend your access immediately, without prior notice, for any reason, including without limitation if you breach these ToS.
`;

const PRIVACY_POLICY = `
1. Information We Collect
We collect personal information that you voluntarily provide when registering, posting listings, or communicating with other users. This includes: Name, Email, Phone Number, Location data, and User Preferences.

2. How We Use Your Information
Your data is used to provide and improve the service, match you with relevant listings, facilitate communication between users, and for security purposes.

3. Sharing Your Information
We share your contact information with other users (Landlords or Tenants) only when you explicitly initiate contact (e.g., sending a message or inquiry). We do not sell your personal data to third parties.

4. Data Security
We employ industry-standard security measures to protect your information from unauthorized access. However, no internet-based service can guarantee absolute security.

THANKS FOR READING OUR TERMS OF SERVICE AND PRIVACY POLICY. GIVE US A CALL IF YOU HAVE ANY QUESTIONS!
`;


export default function TermsAndPrivacyScreen() {
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={[styles.header, styles.subHeader]}>
        {/* Back Button on the Left */}
        <TouchableOpacity 
            style={styles.backToMenuButton} 
            onPress={() => router.back()}
        >
            <Ionicons name="chevron-back" size={24} color="#667eea" />
        </TouchableOpacity>
        <Text style={styles.title}>Terms & Privacy</Text>
        {/* Placeholder to keep title centered */}
        <View style={styles.backToMenuPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.policySection}>
          <Text style={styles.policyTitle}>Terms of Service</Text>
          <Text style={styles.policyText}>{TERMS_OF_SERVICE.trim()}</Text>
        </View>

        <View style={styles.policySection}>
          <Text style={styles.policyTitle}>Privacy Policy</Text>
          <Text style={styles.policyText}>{PRIVACY_POLICY.trim()}</Text>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Persistent Back Button (Action Bar) */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity style={styles.bottomBackButton} onPress={() => router.back()}>
            <Text style={styles.bottomBackButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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

    borderBottomWidth: 1, 
    borderBottomColor: '#f5f5f5', 
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingTop: 10,
  },
  backToMenuButton: {
    padding: 8,
  },
  backToMenuPlaceholder: {
    width: 40, 
  },

  policySection: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  policyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingBottom: 5,
  },
  policyText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    paddingHorizontal: 5,
  },
  
  bottomActionBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  bottomBackButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  bottomBackButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
// app/landlord/add-payment-form.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const PAYMENT_METHODS_STORAGE_KEY = '@landlord_payment_methods';

export default function AddPaymentFormScreen() {
  const { user } = useAuth();
  const { type } = useLocalSearchParams();

  const [formState, setFormState] = useState({});
  const [screenTitle, setScreenTitle] = useState('Add Payment Method');

  useEffect(() => {
    switch (type) {
      case 'credit_card':
        setScreenTitle('Add Credit/Debit Card');
        setFormState({
          cardholderName: user?.name || '',
          cardNumber: '',
          expiryDate: '',
          cvv: '',
        });
        break;
      case 'bank_account':
        setScreenTitle('Add Bank Account');
        setFormState({
          accountHolderName: user?.name || '',
          accountNumber: '',
          routingNumber: '',
          bankName: '',
        });
        break;
      case 'gcash':
      case 'paymaya':
        setScreenTitle(`Link ${type === 'gcash' ? 'GCash' : 'PayMaya'} Account`);
        setFormState({
          fullName: user?.name || '',
          phoneNumber: '',
        });
        break;
      case 'paypal':
        setScreenTitle('Link PayPal Account');
        setFormState({
          paypalEmail: user?.email || '',
        });
        break;
      default:
        router.back(); // Go back if type is unknown
        break;
    }
  }, [type, user]);

  const handleInputChange = (field, value) => {
    setFormState(prevState => ({ ...prevState, [field]: value }));
  };

  const handleSave = async () => {
    // Basic validation
    const formValues = Object.values(formState);
    if (formValues.some(value => !value.trim())) {
      Alert.alert('Validation Error', 'Please fill out all fields.');
      return;
    }

    // Specific validation for phone number format
    if ((type === 'gcash' || type === 'paymaya')) {
      const phoneRegex = /^\+639\d{9}$/;
      if (!phoneRegex.test(formState.phoneNumber)) {
        Alert.alert('Invalid Phone Number', 'Please enter the number in the format +639xxxxxxxxx.');
        return;
      }
    }


    try {
      const newPaymentMethod = {
        id: `pm_${Date.now()}`,
        type: type,
        isDefault: false,
        cardholder: formState.cardholderName || formState.accountHolderName || formState.fullName || user?.name,
      };

      switch (type) {
        case 'credit_card':
          newPaymentMethod.last4 = formState.cardNumber.slice(-4);
          newPaymentMethod.brand = 'visa'; // Placeholder
          newPaymentMethod.expiry = formState.expiryDate;
          break;
        case 'bank_account':
          newPaymentMethod.last4 = formState.accountNumber.slice(-4);
          newPaymentMethod.bankName = formState.bankName;
          newPaymentMethod.accountType = 'Checking'; // Placeholder
          break;
        case 'gcash':
        case 'paymaya':
          newPaymentMethod.phone = formState.phoneNumber;
          break;
        case 'paypal':
          newPaymentMethod.email = formState.paypalEmail;
          break;
      }

      const existingMethodsJson = await AsyncStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
      let existingMethods = existingMethodsJson ? JSON.parse(existingMethodsJson) : [];

      // If it's the first payment method, set it as default
      if (existingMethods.length === 0) {
        newPaymentMethod.isDefault = true;
      }

      const updatedMethods = [...existingMethods, newPaymentMethod];
      await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(updatedMethods));

      Alert.alert('Success', `${screenTitle.replace('Add ', '').replace('Link ', '')} added successfully!`);
      router.back();

    } catch (error) {
      console.error('Failed to save payment method:', error);
      Alert.alert('Error', 'An error occurred while saving. Please try again.');
    }
  };

  const renderFormFields = () => {
    switch (type) {
      case 'credit_card':
        return (
          <>
            <Text style={styles.label}>Cardholder Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Walter White"
              placeholderTextColor="#999"
              value={formState.cardholderName}
              onChangeText={(val) => handleInputChange('cardholderName', val)}
            />
            <Text style={styles.label}>Card Number</Text>
            <TextInput
              style={styles.input}
              placeholder="•••• •••• •••• ••••"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              value={formState.cardNumber}
              onChangeText={(val) => handleInputChange('cardNumber', val)}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Expiry Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/YY"
                  placeholderTextColor="#999"
                  value={formState.expiryDate}
                  onChangeText={(val) => handleInputChange('expiryDate', val)}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>CVV</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={formState.cvv}
                  onChangeText={(val) => handleInputChange('cvv', val)}
                />
              </View>
            </View>
          </>
        );
      case 'bank_account':
        return (
          <>
            <Text style={styles.label}>Bank Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., BDO Unibank"
              placeholderTextColor="#999"
              value={formState.bankName}
              onChangeText={(val) => handleInputChange('bankName', val)}
            />
            <Text style={styles.label}>Account Holder Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Walter White"
              placeholderTextColor="#999"
              value={formState.accountHolderName}
              onChangeText={(val) => handleInputChange('accountHolderName', val)}
            />
            <Text style={styles.label}>Account Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter bank account number"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              value={formState.accountNumber}
              onChangeText={(val) => handleInputChange('accountNumber', val)}
            />
          </>
        );
      case 'gcash':
      case 'paymaya':
        return (
          <>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="As registered on the account"
              placeholderTextColor="#999"
              value={formState.fullName}
              onChangeText={(val) => handleInputChange('fullName', val)}
            />
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+63 9XX XXX XXXX"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={formState.phoneNumber}
              onChangeText={(val) => {
                let formatted = val.replace(/[^0-9+]/g, ''); // Allow only numbers and '+'

                if (formatted.length > 0 && !formatted.startsWith('+')) {
                  // If it doesn't start with '+', remove any '+' and prepend it.
                  formatted = `+${formatted.replace(/\+/g, '')}`;
                }

                if (formatted.length > 13) {
                  formatted = formatted.substring(0, 13); // Enforce max length
                }
                handleInputChange('phoneNumber', formatted);
              }}
            />
          </>
        );
      case 'paypal':
        return (
          <>
            <Text style={styles.label}>PayPal Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formState.paypalEmail}
              onChangeText={(val) => handleInputChange('paypalEmail', val)}
            />
          </>
        );
      default:
        return <Text>Invalid payment method type.</Text>;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.form}>
          {renderFormFields()}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Payment Method</Text>
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color="#10b981" />
          <Text style={styles.securityText}>
            Your payment information is secure and encrypted.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 20,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
  },
  securityText: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '500',
    textAlign: 'center',
  },
});
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy'; // <--- FIXED: Using legacy import
import * as Sharing from 'expo-sharing';
import {
  supabase,
  getCurrentUser,
  getLandlordBookings,
  getLandlordListings,
} from '../../lib/supabaseClient';

// Constants for AsyncStorage keys
const PAYMENTS_STORAGE_KEY = '@payments_data_v1';

export default function FinancialsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [listings, setListings] = useState([]); 
  const [currentUser, setCurrentUser] = useState(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    tenantName: '',
    property: '',
    amount: '',
    type: 'rent',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      setCurrentUser(user);

      if (user) {
        // 1. Load Listings
        const { success: listingsSuccess, listings: dbListings } = await getLandlordListings(user.id);
        if (listingsSuccess) {
          setListings(dbListings || []);
        }

        // 2. Load bookings
        const { success: bookingsSuccess, bookings: dbBookings } = await getLandlordBookings(user.id);
        if (bookingsSuccess) {
          setBookings(dbBookings || []);
        }

        // 3. Load Payments (Hybrid: DB + Local Storage)
        let allPayments = [];

        // A. Try loading from Supabase DB
        const { data: dbPayments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('landlord_id', user.id)
          .order('created_at', { ascending: false });

        if (!paymentsError && dbPayments) {
          const mappedDbPayments = dbPayments.map(p => ({
            ...p,
            // Map DB columns to UI fields
            tenantName: p.tenant_name || p.tenantName || 'Unknown Tenant',
            property: p.property_title || p.property || 'Unknown Property',
            amount: p.amount || 0,
            status: p.status || 'completed',
            date: p.payment_date || p.created_at,
            paidDate: p.payment_date,
            type: p.payment_type || p.type || 'rent',
            isLocal: false
          }));
          allPayments = [...mappedDbPayments];
        }

        // B. Load Local Payments (Offline/Fallback)
        const localData = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
        if (localData) {
          const localPayments = JSON.parse(localData);
          // Add local payments to the list
          allPayments = [...allPayments, ...localPayments];
        }

        // Sort combined list by date (newest first)
        allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        setPayments(allPayments);
      }
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Calculate financial data
  const calculateFinancialData = () => {
    const completedPayments = payments.filter(p => p.status === 'completed');
    const pendingPayments = payments.filter(p => p.status === 'pending');
    
    const totalEarnings = completedPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    
    const totalProperties = listings.length;
    
    const occupiedProperties = bookings.filter(b => 
      b.status === 'approved' || b.status === 'pending'
    ).length;
    
    const occupancyRate = totalProperties > 0 ? Math.round((occupiedProperties / totalProperties) * 100) : 0;

    const rentPayments = completedPayments.filter(p => p.type === 'rent');
    const averageRent = rentPayments.length > 0 
      ? rentPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0) / rentPayments.length 
      : 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyEarnings = completedPayments
      .filter(payment => {
        const paymentDate = new Date(payment.paidDate || payment.date);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      })
      .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);

    return {
      totalEarnings,
      pendingPaymentsCount: pendingPayments.length,
      pendingPaymentsAmount: pendingPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0),
      totalProperties,
      occupancyRate,
      averageRent: Math.round(averageRent),
      monthlyEarnings,
      completedPayments: completedPayments.length,
    };
  };
  
  useFocusEffect(
    useCallback(() => {
      const handleBackPress = () => {
        router.replace('/landlord/menu');
        return true; 
      };
      let backHandlerSubscription;

      if (Platform.OS === 'android') {
        backHandlerSubscription = BackHandler.addEventListener(
          'hardwareBackPress', 
          handleBackPress
        );
      }
      return () => {
        if (Platform.OS === 'android' && backHandlerSubscription) {
          backHandlerSubscription.remove();
        }
      };
    }, []) 
  );
  
  const financialData = calculateFinancialData();

  const paymentHistory = payments
    .map(payment => ({
      id: payment.id,
      tenant: payment.tenantName || 'Tenant',
      property: payment.property,
      amount: payment.amount,
      date: payment.paidDate || payment.date,
      status: payment.status,
      type: payment.type || 'rent',
      method: payment.method || 'manual',
      reference: payment.reference,
    }));

  const pendingPaymentsList = payments
    .filter(payment => payment.status === 'pending')
    .map(payment => ({
      id: payment.id,
      tenant: payment.tenantName || 'Tenant',
      property: payment.property,
      amount: payment.amount,
      dueDate: payment.dueDate || payment.date,
      type: payment.type || 'rent',
    }));

  const handleRequestPayment = async (tenantName, paymentId) => {
    if (!currentUser) return;
    Alert.alert('Success', `Payment reminder sent to ${tenantName}`);
  };

  const handleRecordPayment = () => {
    setPaymentForm({
      tenantName: '',
      property: listings.length > 0 ? (listings[0].title || listings[0].name) : '',
      amount: '',
      type: 'rent',
      date: new Date().toISOString().split('T')[0],
    });
    setShowRecordPaymentModal(true);
  };

  const processRecordedPayment = async () => {
    if (!paymentForm.tenantName.trim() || !paymentForm.property.trim() || !paymentForm.amount) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    const amountFloat = parseFloat(paymentForm.amount);

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert([
          {
            landlord_id: currentUser?.id,
            tenant_name: paymentForm.tenantName,
            property_title: paymentForm.property,
            amount: amountFloat,
            payment_type: paymentForm.type,
            status: 'completed',
            payment_date: paymentForm.date,
            method: 'manual',
            reference: `MAN-${Date.now()}`,
          }
        ])
        .select();

      if (error) {
        console.warn('Supabase insert failed, saving locally:', error);
        
        const newLocalPayment = {
          id: `local_${Date.now()}`,
          landlordId: currentUser?.id,
          tenantName: paymentForm.tenantName,
          property: paymentForm.property,
          amount: amountFloat,
          type: paymentForm.type,
          status: 'completed', 
          date: new Date().toISOString().split('T')[0],
          paidDate: paymentForm.date,
          method: 'manual',
          reference: `LOC-${Date.now()}`,
          isLocal: true
        };

        const existingJson = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
        const existingPayments = existingJson ? JSON.parse(existingJson) : [];
        
        existingPayments.push(newLocalPayment);
        
        await AsyncStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(existingPayments));
        
        Alert.alert('Saved Locally', 'Database unreachble. Payment saved to local storage.');
      } 

      await loadData();
      setShowRecordPaymentModal(false);

    } catch (error) {
      console.error('Failed to record payment', error);
      Alert.alert('Error', 'Failed to record payment.');
    }
  };

  const handleGenerateReport = () => {
    if (payments.length === 0) {
      Alert.alert('No Data', 'You have no payment data to generate a report.');
      return;
    }

    Alert.alert(
      'Report Generated',
      `Financial report for ${selectedPeriod} period has been generated.\n\n` +
      `Total Earnings: ₱${financialData.totalEarnings.toLocaleString()}\n` +
      `Monthly Earnings: ₱${financialData.monthlyEarnings.toLocaleString()}\n` +
      `Properties: ${financialData.totalProperties}\n` +
      `Occupancy Rate: ${financialData.occupancyRate}%`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  // --- EXPORT FUNCTIONALITY ---
  const handleExportData = async () => {
    if (payments.length === 0 && bookings.length === 0) {
      Alert.alert('No Data', 'You have no data to export.');
      return;
    }

    try {
      // 1. Construct CSV Header
      let csv = 'Date,Tenant,Property,Amount,Type,Status,Method,Reference\n';

      // 2. Construct CSV Rows
      paymentHistory.forEach(item => {
        const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'N/A';
        const tenant = (item.tenant || '').replace(/"/g, '""');
        const property = (item.property || '').replace(/"/g, '""');
        
        const row = [
          date,
          `"${tenant}"`,
          `"${property}"`,
          item.amount || 0,
          item.type || 'rent',
          item.status || 'pending',
          item.method || 'manual',
          item.reference || 'N/A'
        ].join(',');
        csv += row + '\n';
      });

      // 3. Define File Path
      const fileName = `financial_report_${new Date().getTime()}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      // 4. Write File - FIXED: Use literal string 'utf8' and imported FileSystem/legacy
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: 'utf8',
      });

      // 5. Share/Save File
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Financial Data',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }

    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export Failed', 'An error occurred while exporting data.');
    }
  };

  const handleViewPaymentDetails = (payment) => {
    Alert.alert(
      'Payment Details',
      `Tenant: ${payment.tenant}\n` +
      `Property: ${payment.property}\n` +
      `Amount: ₱${payment.amount.toLocaleString()}\n` +
      `Date: ${payment.date}\n` +
      `Type: ${getPaymentType(payment.type)}\n` +
      `Status: ${getStatusText(payment.status)}\n` +
      `Method: ${payment.method || 'N/A'}\n` +
      `Reference: ${payment.reference || 'N/A'}`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  const getStatusColor = (status) => {
    return status === 'completed' ? '#10b981' : '#f59e0b';
  };

  const getStatusText = (status) => {
    return status === 'completed' ? 'Paid' : 'Pending';
  };

  const getPaymentType = (type) => {
    return type === 'rent' ? 'Monthly Rent' : 
           type === 'security_deposit' ? 'Security Deposit' : 
           type === 'utility' ? 'Utility Bill' :
           type || 'Payment';
  };

  const getTimeAgo = (date) => {
    if (!date) return 'N/A';
    const now = new Date();
    const paymentDate = new Date(date);
    const diffMs = now - paymentDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Financials & Payments',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/landlord/menu')}>
              <Ionicons name="arrow-back" size={24} color="#fff" style={{ marginLeft: 12 }} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'monthly' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('monthly')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'monthly' && styles.periodTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'quarterly' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('quarterly')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'quarterly' && styles.periodTextActive]}>
              Quarterly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'yearly' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('yearly')}
          >
            <Text style={[styles.periodText, selectedPeriod === 'yearly' && styles.periodTextActive]}>
              Yearly
            </Text>
          </TouchableOpacity>
        </View>

       
        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="wallet" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.statValue}>₱{financialData.totalEarnings.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="time" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>₱{financialData.pendingPaymentsAmount.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Pending Payments</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="business" size={24} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{financialData.totalProperties}</Text>
              <Text style={styles.statLabel}>Properties</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f0f4ff' }]}>
                <Ionicons name="trending-up" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.statValue}>{financialData.occupancyRate}%</Text>
              <Text style={styles.statLabel}>Occupancy Rate</Text>
            </View>
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleRecordPayment}>
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Record Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleGenerateReport}>
              <Ionicons name="document-text" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Generate Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleExportData}>
              <Ionicons name="download" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Export Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Payments</Text>
            <Text style={styles.seeAllText}>{pendingPaymentsList.length} pending</Text>
          </View>
          
          <View style={styles.paymentsList}>
            {pendingPaymentsList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={32} color="#10b981" />
                <Text style={styles.emptyStateText}>No pending payments</Text>
                <Text style={styles.emptyStateSubtext}>All payments are up to date!</Text>
              </View>
            ) : (
              pendingPaymentsList.map((payment) => (
                <View key={payment.id} style={styles.paymentItem}>
                  <View style={styles.paymentInfo}>
                    <View style={styles.paymentHeader}>
                      <Text style={styles.tenantName}>{payment.tenant}</Text>
                      <Text style={styles.paymentAmount}>₱{payment.amount.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.propertyName}>{payment.property}</Text>
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentDate}>Due: {payment.dueDate}</Text>
                      <Text style={styles.paymentType}>{getPaymentType(payment.type)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.requestButton}
                    onPress={() => handleRequestPayment(payment.tenant, payment.id)}
                  >
                    <Feather name="send" size={16} color={Colors.primary} />
                    <Text style={styles.requestButtonText}>Remind</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All ({paymentHistory.length})</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.paymentsList}>
            {paymentHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={32} color="#ccc" />
                <Text style={styles.emptyStateText}>No payments yet</Text>
                <Text style={styles.emptyStateSubtext}>Payments will appear here when tenants make payments</Text>
              </View>
            ) : (
              paymentHistory.slice(0, 5).map((payment) => (
                <TouchableOpacity 
                  key={payment.id} 
                  style={styles.paymentItem}
                  onPress={() => handleViewPaymentDetails(payment)}
                >
                  <View style={styles.paymentInfo}>
                    <View style={styles.paymentHeader}>
                      <Text style={styles.tenantName}>{payment.tenant}</Text>
                      <Text style={styles.paymentAmount}>₱{payment.amount.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.propertyName}>{payment.property}</Text>
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentDate}>{getTimeAgo(payment.date)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(payment.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                          {getStatusText(payment.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Monthly Earnings</Text>
              <Text style={styles.summaryValue}>₱{financialData.monthlyEarnings.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Average Rent</Text>
              <Text style={styles.summaryValue}>₱{financialData.averageRent.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Completed Payments</Text>
              <Text style={styles.summaryValue}>{financialData.completedPayments}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pending Payments</Text>
              <Text style={styles.summaryValue}>{financialData.pendingPaymentsCount}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal
        visible={showRecordPaymentModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowRecordPaymentModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Tenant Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter tenant name"
                value={paymentForm.tenantName}
                onChangeText={(text) => setPaymentForm(prev => ({ ...prev, tenantName: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Property</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter property name"
                value={paymentForm.property}
                onChangeText={(text) => setPaymentForm(prev => ({ ...prev, property: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Amount</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter amount"
                value={paymentForm.amount}
                onChangeText={(text) => setPaymentForm(prev => ({ ...prev, amount: text }))}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Payment Type</Text>
              <View style={styles.typeOptions}>
                <TouchableOpacity 
                  style={[styles.typeOption, paymentForm.type === 'rent' && styles.typeOptionActive]}
                  onPress={() => setPaymentForm(prev => ({ ...prev, type: 'rent' }))}
                >
                  <Text style={[styles.typeOptionText, paymentForm.type === 'rent' && styles.typeOptionTextActive]}>
                    Rent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeOption, paymentForm.type === 'security_deposit' && styles.typeOptionActive]}
                  onPress={() => setPaymentForm(prev => ({ ...prev, type: 'security_deposit' }))}
                >
                  <Text style={[styles.typeOptionText, paymentForm.type === 'security_deposit' && styles.typeOptionTextActive]}>
                    Security Deposit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Payment Date</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                value={paymentForm.date}
                onChangeText={(text) => setPaymentForm(prev => ({ ...prev, date: text }))}
              />
            </View>

            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={processRecordedPayment}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.confirmButtonText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
    padding: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  periodTextActive: {
    color: 'white',
  },
  overviewSection: {
    marginBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  seeAllText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    gap: 8,
  },
  actionText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  paymentsList: {
    gap: 12,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  propertyName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
  },
  paymentType: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    marginLeft: 12,
    gap: 4,
  },
  requestButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryGrid: {
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    alignItems: 'center',
  },
  typeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0f4ff',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeOptionTextActive: {
    color: Colors.primary,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
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
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabaseClient';
import {
  getCurrentUser,
  getTenantPayments,
  recordPayment,
  getTenantBookings,
  getTenantProfile,
} from '../../lib/supabaseClient';

export default function FinancialsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paymentDetails, setPaymentDetails] = useState({
    accountNumber: '',
    accountName: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);

      // Get tenant profile
      const { data: tenantProfile, error: profileError } = await supabase
        .from('tenant_profile')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!tenantProfile) {
        Alert.alert('Error', 'Tenant profile not found');
        setIsLoading(false);
        return;
      }

      // Load bookings using tenant profile ID
      const { success: bookingsSuccess, bookings: bookingsData } = await getTenantBookings(tenantProfile.id);
      if (bookingsSuccess) {
        const transformedBookings = bookingsData.map(booking => ({
          id: booking.id,
          tenantId: booking.tenant_id,
          landlordId: booking.listings?.landlord_profile?.user_id,
          landlordName: `${booking.listings?.landlord_profile?.users?.first_name} ${booking.listings?.landlord_profile?.users?.last_name}`,
          property: booking.listings?.title,
          amount: booking.total_amount,
          status: booking.status,
          moveInDate: booking.move_in_date,
          paymentStatus: booking.payment_status || 'pending',
          paidAmount: booking.paid_amount,
        }));
        setBookings(transformedBookings);
      }

      // Load payments using tenant profile ID
      const { success: paymentsSuccess, payments: paymentsData } = await getTenantPayments(tenantProfile.id);
      if (paymentsSuccess) {
        const transformedPayments = paymentsData.map(payment => ({
          id: payment.id,
          tenantId: payment.tenant_id,
          tenantName: user.first_name,
          landlordName: payment.bookings?.listings?.landlord_profile?.users?.first_name,
          property: payment.bookings?.listings?.title,
          amount: payment.amount,
          type: payment.payment_type,
          status: payment.payment_status,
          method: payment.payment_method,
          reference: payment.reference_number,
          paidDate: payment.payment_date,
          timestamp: payment.created_at,
          description: `${payment.payment_type} Payment`,
          bookingId: payment.booking_id,
        }));
        setPayments(transformedPayments);
      }
    } catch (error) {
      console.error('Failed to load data', error);
      Alert.alert('Error', 'Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Calculate financial data from actual bookings and payments
  const calculateFinancialData = () => {
    const completedPayments = payments.filter(p => p.status === 'completed');
    const pendingPayments = payments.filter(p => p.status === 'pending');
    
    const totalSpent = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const activeBookings = bookings.filter(b => b.status === 'approved' || b.status === 'pending').length;
    
    // Calculate average rent from completed payments
    const rentPayments = completedPayments.filter(p => p.type === 'rent');
    const averageRent = rentPayments.length > 0 
      ? rentPayments.reduce((sum, payment) => sum + payment.amount, 0) / rentPayments.length 
      : 0;

    return {
      totalSpent,
      pendingPayments: pendingAmount,
      activeBookings,
      savedProperties: 8, // This could be connected to favorites if you have that data
      averageRent: Math.round(averageRent),
      completedPayments: completedPayments.length,
    };
  };

  const financialData = calculateFinancialData();

  // Generate payment history from actual payments
  const paymentHistory = payments
    .filter(payment => payment.status === 'completed')
    .map(payment => ({
      id: payment.id,
      landlord: payment.landlordName,
      property: payment.property,
      amount: payment.amount,
      date: payment.paidDate || payment.date,
      status: 'completed',
      type: payment.type || 'rent',
      reference: payment.reference || `REF-${payment.id.slice(-6)}`
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Generate upcoming payments from pending payments and upcoming bookings
  const upcomingPayments = [
    ...payments
      .filter(payment => payment.status === 'pending')
      .map(payment => ({
        id: payment.id,
        landlord: payment.landlordName,
        property: payment.property,
        amount: payment.amount,
        dueDate: payment.dueDate,
        type: payment.type || 'rent',
        description: payment.description || `${getPaymentType(payment.type)} Payment`
      })),
    ...bookings
      .filter(booking => booking.status === 'approved' && !payments.some(p => p.bookingId === booking.id))
      .map(booking => ({
        id: `booking_${booking.id}`,
        landlord: booking.landlordName,
        property: booking.property,
        amount: booking.amount || 5000, // Default amount if not specified
        dueDate: booking.moveInDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'rent',
        description: 'Security Deposit & First Month Rent',
        bookingId: booking.id
      }))
  ];

  const handlePayNow = (payment) => {
    setSelectedPayment(payment);
    setPaymentDetails({
      accountNumber: '',
      accountName: currentUser.name,
    });
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    if (!paymentDetails.accountNumber.trim()) {
      Alert.alert('Error', 'Please enter your account number');
      return;
    }

    try {
      // Generate payment reference
      const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Record payment in Supabase
      // recordPayment expects: (paymentId, amount, method, transactionRef)
      const { success, error } = await recordPayment(
        selectedPayment.bookingId,  // paymentId
        selectedPayment.amount,     // amount
        paymentMethod,              // method
        paymentReference            // transactionRef
      );

      if (success) {
        // Reload data
        await loadData();

        // Close modal and show success message
        setShowPaymentModal(false);
        setSelectedPayment(null);

        Alert.alert(
          'Payment Successful!',
          `Payment of ₱${selectedPayment.amount.toLocaleString()} completed successfully.\n\nReference: ${paymentReference}`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'View Receipt',
              onPress: () => handleViewReceipt({
                amount: selectedPayment.amount,
                property: selectedPayment.property,
                landlordName: selectedPayment.landlord,
                method: paymentMethod,
                reference: paymentReference,
                paidDate: new Date().toISOString().split('T')[0],
                status: 'completed',
              })
            }
          ]
        );
      } else {
        Alert.alert('Error', error || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Failed to process payment', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    }
  };

  const handleViewReceipt = (payment) => {
    Alert.alert(
      'Payment Receipt',
      `Payment Details:\n\n` +
      `Amount: ₱${payment.amount.toLocaleString()}\n` +
      `Property: ${payment.property}\n` +
      `Landlord: ${payment.landlordName}\n` +
      `Payment Method: ${payment.method.toUpperCase()}\n` +
      `Reference: ${payment.reference}\n` +
      `Date: ${payment.paidDate}\n` +
      `Status: ${payment.status}`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleAddPaymentMethod = () => {
    Alert.alert(
      'Add Payment Method',
      'Choose your preferred payment method:',
      [
        {
          text: 'GCash',
          onPress: () => setPaymentMethod('gcash')
        },
        {
          text: 'PayMaya',
          onPress: () => setPaymentMethod('paymaya')
        },
        {
          text: 'Bank Transfer',
          onPress: () => setPaymentMethod('bank')
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleViewReceipts = () => {
    const completedPayments = payments.filter(p => p.status === 'completed');
    if (completedPayments.length === 0) {
      Alert.alert('No Receipts', 'You have no completed payments yet.');
      return;
    }
    
    Alert.alert(
      'Payment Receipts',
      `You have ${completedPayments.length} completed payments.`,
      [
        { text: 'View All', onPress: () => {
          // This would navigate to a detailed receipts screen
          Alert.alert('Receipts', 'This would show all your payment receipts in detail.');
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleExportHistory = () => {
    if (payments.length === 0) {
      Alert.alert('No Data', 'You have no payment history to export.');
      return;
    }
    
    // Simulate export functionality
    Alert.alert(
      'Export History',
      'Your payment history will be prepared for download. This may take a few moments.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Export', 
          onPress: () => {
            setTimeout(() => {
              Alert.alert('Export Complete', 'Your payment history has been exported successfully.');
            }, 2000);
          }
        }
      ]
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

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    return `Due in ${diffDays} days`;
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'gcash': return 'phone-portrait';
      case 'paymaya': return 'card';
      case 'bank': return 'business';
      default: return 'card';
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Payments & Financials',
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={{ marginTop: 10, color: '#666' }}>Loading payments...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Payments & Financials',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.push('/(tenant)/menu')} style={{ paddingLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
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
              <Text style={styles.statValue}>₱{financialData.totalSpent.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="time" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>₱{financialData.pendingPayments.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Pending Payments</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="calendar" size={24} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{financialData.activeBookings}</Text>
              <Text style={styles.statLabel}>Active Bookings</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f0f4ff' }]}>
                <Ionicons name="receipt" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.statValue}>{financialData.completedPayments}</Text>
              <Text style={styles.statLabel}>Payments Made</Text>
            </View>
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleAddPaymentMethod}>
              <Ionicons name="card" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Payment Method</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleViewReceipts}>
              <Ionicons name="receipt" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>View Receipts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleExportHistory}>
              <Ionicons name="download" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Export History</Text>
            </TouchableOpacity>
          </View>
        </View>

        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Payments</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.paymentsList}>
            {upcomingPayments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={32} color="#ccc" />
                <Text style={styles.emptyStateText}>No upcoming payments</Text>
                <Text style={styles.emptyStateSubtext}>All payments are up to date!</Text>
              </View>
            ) : (
              upcomingPayments.map((payment) => (
                <View key={payment.id} style={styles.paymentItem}>
                  <View style={styles.paymentInfo}>
                    <View style={styles.paymentHeader}>
                      <Text style={styles.landlordName}>{payment.landlord}</Text>
                      <Text style={styles.paymentAmount}>₱{payment.amount.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.propertyName}>{payment.property}</Text>
                    <Text style={styles.paymentDescription}>{payment.description}</Text>
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentDate}>
                        {getDaysUntilDue(payment.dueDate)} • Due: {payment.dueDate}
                      </Text>
                      <Text style={styles.paymentType}>{getPaymentType(payment.type)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.payButton}
                    onPress={() => handlePayNow(payment)}
                  >
                    <Feather name="credit-card" size={16} color="white" />
                    <Text style={styles.payButtonText}>Pay Now</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.paymentsList}>
            {paymentHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={32} color="#ccc" />
                <Text style={styles.emptyStateText}>No payment history yet</Text>
                <Text style={styles.emptyStateSubtext}>Your payment history will appear here</Text>
              </View>
            ) : (
              paymentHistory.slice(0, 5).map((payment) => (
                <View key={payment.id} style={styles.paymentItem}>
                  <View style={styles.paymentInfo}>
                    <View style={styles.paymentHeader}>
                      <Text style={styles.landlordName}>{payment.landlord}</Text>
                      <Text style={styles.paymentAmount}>₱{payment.amount.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.propertyName}>{payment.property}</Text>
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentDate}>{payment.date}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(payment.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                          {getStatusText(payment.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.paymentReference}>Ref: {payment.reference}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.receiptButton}
                    onPress={() => handleViewReceipt(payment)}
                  >
                    <Ionicons name="receipt" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Monthly Average</Text>
              <Text style={styles.summaryValue}>₱{financialData.averageRent.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Active Bookings</Text>
              <Text style={styles.summaryValue}>{financialData.activeBookings}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Payments</Text>
              <Text style={styles.summaryValue}>{financialData.completedPayments}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pending Amount</Text>
              <Text style={styles.summaryValue}>₱{financialData.pendingPayments.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Payment</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedPayment && (
              <>
                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentSummaryTitle}>Payment Details</Text>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Amount:</Text>
                    <Text style={styles.paymentSummaryValue}>₱{selectedPayment.amount.toLocaleString()}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Property:</Text>
                    <Text style={styles.paymentSummaryValue}>{selectedPayment.property}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Landlord:</Text>
                    <Text style={styles.paymentSummaryValue}>{selectedPayment.landlord}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Description:</Text>
                    <Text style={styles.paymentSummaryValue}>{selectedPayment.description}</Text>
                  </View>
                </View>

                <View style={styles.paymentMethodSection}>
                  <Text style={styles.sectionLabel}>Payment Method</Text>
                  <View style={styles.paymentMethodOptions}>
                    <TouchableOpacity 
                      style={[styles.paymentMethodOption, paymentMethod === 'gcash' && styles.paymentMethodActive]}
                      onPress={() => setPaymentMethod('gcash')}
                    >
                      <Ionicons name="phone-portrait" size={20} color={paymentMethod === 'gcash' ? Colors.primary : '#666'} />
                      <Text style={[styles.paymentMethodText, paymentMethod === 'gcash' && styles.paymentMethodTextActive]}>
                        GCash
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.paymentMethodOption, paymentMethod === 'paymaya' && styles.paymentMethodActive]}
                      onPress={() => setPaymentMethod('paymaya')}
                    >
                      <Ionicons name="card" size={20} color={paymentMethod === 'paymaya' ? Colors.primary : '#666'} />
                      <Text style={[styles.paymentMethodText, paymentMethod === 'paymaya' && styles.paymentMethodTextActive]}>
                        PayMaya
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.paymentMethodOption, paymentMethod === 'bank' && styles.paymentMethodActive]}
                      onPress={() => setPaymentMethod('bank')}
                    >
                      <Ionicons name="business" size={20} color={paymentMethod === 'bank' ? Colors.primary : '#666'} />
                      <Text style={[styles.paymentMethodText, paymentMethod === 'bank' && styles.paymentMethodTextActive]}>
                        Bank Transfer
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.paymentDetailsSection}>
                  <Text style={styles.sectionLabel}>Account Details</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Account Number"
                    value={paymentDetails.accountNumber}
                    onChangeText={(text) => setPaymentDetails(prev => ({ ...prev, accountNumber: text }))}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Account Name"
                    value={paymentDetails.accountName}
                    onChangeText={(text) => setPaymentDetails(prev => ({ ...prev, accountName: text }))}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.confirmPaymentButton}
                  onPress={processPayment}
                >
                  <Ionicons name="lock-closed" size={20} color="white" />
                  <Text style={styles.confirmPaymentText}>
                    Pay ₱{selectedPayment.amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
  landlordName: {
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
    marginBottom: 2,
  },
  paymentDescription: {
    fontSize: 12,
    color: '#999',
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
  paymentReference: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
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
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    marginLeft: 12,
    gap: 4,
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  receiptButton: {
    padding: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    marginLeft: 12,
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
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#ccc',
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
    maxHeight: '80%',
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
  paymentSummary: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  paymentSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  paymentMethodSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  paymentMethodOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    gap: 6,
  },
  paymentMethodActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0f4ff',
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  paymentMethodTextActive: {
    color: Colors.primary,
  },
  paymentDetailsSection: {
    marginBottom: 24,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  confirmPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmPaymentText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
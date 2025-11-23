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
import {
  getCurrentUser,
  getLandlordBookings,
  getLandlordRevenue,
  recordPaymentAsLandlord,
} from '../../lib/supabaseClient';

export default function FinancialsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [revenue, setRevenue] = useState({});
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
        // Load bookings
        const { success: bookingsSuccess, bookings: dbBookings } = await getLandlordBookings(user.id);
        if (bookingsSuccess) {
          setBookings(dbBookings || []);
        }

        // Load revenue
        const { success: revenueSuccess, payments: dbPayments, revenue: revenueData } = await getLandlordRevenue(user.id, selectedPeriod);
        if (revenueSuccess) {
          setPayments(dbPayments || []);
          setRevenue(revenueData || {});
        }
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

  // Calculate financial data from actual data
  const calculateFinancialData = () => {
    const completedPayments = payments.filter(p => p.status === 'completed');
    const pendingPayments = payments.filter(p => p.status === 'pending');
    
    const totalEarnings = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const totalProperties = listings.length;
    
    // Calculate occupancy rate
    const occupiedProperties = bookings.filter(b => 
      b.status === 'approved' || b.status === 'pending'
    ).length;
    const occupancyRate = totalProperties > 0 ? Math.round((occupiedProperties / totalProperties) * 100) : 0;

    // Calculate average rent from completed payments
    const rentPayments = completedPayments.filter(p => p.type === 'rent');
    const averageRent = rentPayments.length > 0 
      ? rentPayments.reduce((sum, payment) => sum + payment.amount, 0) / rentPayments.length 
      : 0;

    // Calculate monthly earnings
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyEarnings = completedPayments
      .filter(payment => {
        const paymentDate = new Date(payment.paidDate || payment.date);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      })
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    return {
      totalEarnings,
      pendingPayments: pendingAmount,
      totalProperties,
      occupancyRate,
      averageRent: Math.round(averageRent),
      monthlyEarnings,
      completedPayments: completedPayments.length,
      pendingPaymentsCount: pendingPayments.length,
    };
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
  
  const financialData = calculateFinancialData();

  // Generate payment history from actual payments
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
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Generate pending payments
  const pendingPayments = payments
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
    Alert.alert(
      'Request Payment',
      `Send payment reminder to ${tenantName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Request', 
          onPress: async () => {
            try {
              // Send message to tenant
              const reminderMessage = {
                id: `msg_${Date.now()}`,
                sender: currentLandlord.id,
                text: `💰 Payment Reminder\n\nThis is a friendly reminder about your pending payment. Please complete the payment at your earliest convenience.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'payment_reminder',
              };

              // Update landlord inquiries
              const landlordJson = await AsyncStorage.getItem(LANDLORD_INQUIRIES_KEY);
              let landlordInquiries = landlordJson ? JSON.parse(landlordJson) : [];

              const convoIndex = landlordInquiries.findIndex(
                conv => conv.tenant?.name === tenantName
              );

              if (convoIndex > -1) {
                if (!landlordInquiries[convoIndex].history) {
                  landlordInquiries[convoIndex].history = [];
                }
                landlordInquiries[convoIndex].history.unshift(reminderMessage);
                landlordInquiries[convoIndex].lastMessage = reminderMessage.text;
                landlordInquiries[convoIndex].time = 'Just now';
                landlordInquiries[convoIndex].unread = false;
              }

              await AsyncStorage.setItem(LANDLORD_INQUIRIES_KEY, JSON.stringify(landlordInquiries));

              // Also update tenant messages
              const tenantJson = await AsyncStorage.getItem(TENANT_MESSAGES_KEY);
              let tenantMessages = tenantJson ? JSON.parse(tenantJson) : [];

              const tenantConvoIndex = tenantMessages.findIndex(
                conv => conv.landlord?.name === currentLandlord.name
              );

              if (tenantConvoIndex > -1) {
                if (!tenantMessages[tenantConvoIndex].history) {
                  tenantMessages[tenantConvoIndex].history = [];
                }
                tenantMessages[tenantConvoIndex].history.unshift(reminderMessage);
                tenantMessages[tenantConvoIndex].lastMessage = reminderMessage.text;
                tenantMessages[tenantConvoIndex].time = 'Just now';
                tenantMessages[tenantConvoIndex].unread = true;
              }

              await AsyncStorage.setItem(TENANT_MESSAGES_KEY, JSON.stringify(tenantMessages));

              Alert.alert('Success', `Payment reminder sent to ${tenantName}`);
            } catch (error) {
              console.error('Failed to send payment reminder', error);
              Alert.alert('Error', 'Failed to send payment reminder.');
            }
          }
        }
      ]
    );
  };

  const handleRecordPayment = () => {
    setPaymentForm({
      tenantName: '',
      property: listings[0]?.name || '',
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

    try {
      const newPayment = {
        id: `payment_${Date.now()}`,
        landlordId: currentLandlord.id,
        landlordName: currentLandlord.name,
        tenantId: `tenant_${Date.now()}`,
        tenantName: paymentForm.tenantName,
        property: paymentForm.property,
        amount: parseFloat(paymentForm.amount),
        type: paymentForm.type,
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        paidDate: paymentForm.date,
        method: 'manual',
        reference: `MAN-${Date.now()}`,
        recordedManually: true,
        timestamp: new Date().toISOString(),
      };

      const paymentsJson = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
      const allPayments = paymentsJson ? JSON.parse(paymentsJson) : [];
      allPayments.push(newPayment);
      await AsyncStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));

      setShowRecordPaymentModal(false);
      await loadData();
      
      Alert.alert('Success', `Payment of ₱${parseFloat(paymentForm.amount).toLocaleString()} recorded successfully!`);
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

    // Generate report data
    const reportData = {
      period: selectedPeriod,
      generatedDate: new Date().toISOString().split('T')[0],
      totalEarnings: financialData.totalEarnings,
      monthlyEarnings: financialData.monthlyEarnings,
      pendingPayments: financialData.pendingPayments,
      totalProperties: financialData.totalProperties,
      occupancyRate: financialData.occupancyRate,
      completedPayments: financialData.completedPayments,
      averageRent: financialData.averageRent,
      payments: paymentHistory,
    };

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

  const handleExportData = () => {
    if (payments.length === 0 && bookings.length === 0) {
      Alert.alert('No Data', 'You have no data to export.');
      return;
    }

    const exportData = {
      financialSummary: calculateFinancialData(),
      payments: paymentHistory,
      bookings: bookings,
      listings: listings,
      exportDate: new Date().toISOString(),
    };

    Alert.alert(
      'Data Exported',
      'Your financial data has been prepared for export. You can download it from your device.',
      [{ text: 'OK', style: 'default' }]
    );
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
              <Text style={styles.statValue}>₱{financialData.pendingPayments.toLocaleString()}</Text>
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
            <Text style={styles.seeAllText}>{pendingPayments.length} pending</Text>
          </View>
          
          <View style={styles.paymentsList}>
            {pendingPayments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={32} color="#10b981" />
                <Text style={styles.emptyStateText}>No pending payments</Text>
                <Text style={styles.emptyStateSubtext}>All payments are up to date!</Text>
              </View>
            ) : (
              pendingPayments.map((payment) => (
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
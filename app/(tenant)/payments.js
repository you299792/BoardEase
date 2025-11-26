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
  Platform,
  BackHandler
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  supabase, 
  getCurrentUser, 
  getTenantBookings,
  recordPayment 
} from '../../lib/supabaseClient';

const PAYMENTS_STORAGE_KEY = '@tenant_payments_data';

export default function FinancialsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Payment Flow State
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [paymentMethod, setPaymentMethod] = useState('cash'); 
  const [paymentDetails, setPaymentDetails] = useState({
    accountNumber: '',
    accountName: '',
    amount: '',
    reference: ''
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantProfile, setTenantProfile] = useState(null);

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
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        setIsLoading(false);
        return;
      }
      setCurrentUser(user);

      const { data: profile, error: profileError } = await supabase
        .from('tenant_profile')
        .select('id, user_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        console.warn("Tenant profile not found or error:", profileError);
        setIsLoading(false);
        return;
      }
      setTenantProfile(profile);

      // --- 3. Load Bookings (Fixed Property Name Logic) ---
      const { success: bookingsSuccess, bookings: bookingsData } = await getTenantBookings(profile.id);
      if (bookingsSuccess) {
        const mappedBookings = bookingsData.map(b => {
            // Handle variable naming from different Supabase query structures
            const listingData = b.listing || b.listings || {}; 
            const landlordProfile = listingData.landlord_profile || {};
            const landlordUser = landlordProfile.users || {};
            
            // Check title OR name
            const propertyTitle = listingData.title || listingData.name || 'Unknown Property';

            return {
              id: b.id,
              landlordId: listingData.landlord_id, 
              landlordName: landlordUser.first_name ? `${landlordUser.first_name}` : 'Landlord',
              property: propertyTitle, // <--- Uses the robust check
              amount: b.total_amount || listingData.price || listingData.rent || 0,
              status: b.status,
              moveInDate: b.move_in_date
            };
        });
        setBookings(mappedBookings);
      }

      // 4. Load Payments
      const { data: dbPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .or(`tenant_id.eq.${profile.id},tenant_name.eq.${user.user_metadata?.first_name}`) 
        .order('payment_date', { ascending: false });

      let allPayments = [];

      if (!paymentsError && dbPayments) {
        const mappedPayments = dbPayments.map(p => ({
          ...p,
          id: p.id,
          landlordName: 'Landlord',
          property: p.property_title || 'Unknown Property',
          amount: parseFloat(p.amount) || 0,
          status: p.status || 'completed',
          date: p.payment_date || p.created_at,
          type: p.payment_type || 'rent',
          method: p.method || 'Manual',
          reference: p.reference || 'N/A',
        }));
        allPayments = mappedPayments;
      }

      // Offline Fallback
      const localData = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
      if (localData) {
        const localPayments = JSON.parse(localData);
        const uniqueLocal = localPayments.filter(lp => !allPayments.some(dp => dp.reference === lp.reference));
        allPayments = [...uniqueLocal, ...allPayments];
      }

      allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(allPayments);

    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // --- HELPER: Calculate Next Due Date ---
  const calculateNextDueDate = (moveInDateStr) => {
    if (!moveInDateStr) return 'N/A';
    const moveIn = new Date(moveInDateStr);
    const today = new Date();

    if (moveIn > today) {
      return moveIn.toISOString().split('T')[0];
    }
    
    let nextDue = new Date(moveIn);
    while (nextDue <= today) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }
    return nextDue.toISOString().split('T')[0];
  };

  const calculateFinancialData = () => {
    const completedPayments = payments.filter(p => p.status === 'completed');
    const pendingPayments = payments.filter(p => p.status === 'pending');
    
    const totalSpent = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const activeBookingsCount = bookings.filter(b => b.status === 'approved').length;

    const rentPayments = completedPayments.filter(p => p.type === 'rent');
    const averageRent = rentPayments.length > 0 
      ? rentPayments.reduce((sum, p) => sum + p.amount, 0) / rentPayments.length 
      : 0;

    return {
      totalSpent,
      pendingAmount,
      activeBookingsCount,
      averageRent: Math.round(averageRent),
      completedCount: completedPayments.length,
    };
  };

  const financialData = calculateFinancialData();

  const paymentHistory = payments.map(p => ({
    ...p,
    type: p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : 'Payment',
    status: p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Unknown'
  }));

  // --- DYNAMIC UPCOMING DUE LOGIC ---
  const upcomingDue = bookings
    .filter(b => b.status === 'approved' || b.status === 'occupied')
    .map(b => ({
      id: `due_${b.id}`,
      property: b.property || 'Property Name', // Fallback if still undefined
      amount: b.amount,
      dueDate: calculateNextDueDate(b.moveInDate), 
      type: 'Rent',
      bookingId: b.id,
      landlordId: b.landlordId
    }));

  // --- PAYMENT ACTIONS ---

  const handlePayNow = (item) => {
    setSelectedBooking(item);
    setPaymentMethod('cash'); 
    setPaymentDetails({
      accountNumber: '',
      accountName: currentUser?.user_metadata?.first_name || '',
      amount: item.amount.toString(),
      reference: ''
    });
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    if (!paymentDetails.amount) {
      Alert.alert('Error', 'Please enter amount');
      return;
    }
    if (paymentMethod !== 'cash' && !paymentDetails.accountNumber) {
       Alert.alert('Error', 'Please enter account number');
       return;
    }

    const amountFloat = parseFloat(paymentDetails.amount);
    const generatedRef = `TRX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newPayment = {
      tenant_id: tenantProfile?.id,
      landlord_id: selectedBooking?.landlordId, 
      tenant_name: currentUser?.user_metadata?.first_name + ' ' + currentUser?.user_metadata?.last_name,
      property_title: selectedBooking?.property,
      amount: amountFloat,
      payment_type: 'rent',
      status: 'completed', 
      payment_date: new Date().toISOString().split('T')[0],
      method: paymentMethod, 
      reference: generatedRef
    };

    const optimisticPayment = { 
        ...newPayment, 
        id: `temp_${Date.now()}`, 
        date: newPayment.payment_date, 
        paidDate: newPayment.payment_date,
        property: newPayment.property_title,
        type: 'Rent',
        status: 'Completed'
    };
    
    setPayments(prev => [optimisticPayment, ...prev]);
    setShowPaymentModal(false);

    try {
        const { error } = await supabase.from('payments').insert([newPayment]);
        
        if (error) {
            console.warn("DB Save failed, saving locally", error);
            const existingJson = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
            const existing = existingJson ? JSON.parse(existingJson) : [];
            existing.push(optimisticPayment);
            await AsyncStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(existing));
        } else {
            await loadData();
        }

        Alert.alert('Success', `Payment Sent! Ref: ${generatedRef}`);

    } catch (err) {
        Alert.alert('Error', 'Payment failed');
    }
  };

  const handleViewReceipt = (payment) => {
    Alert.alert(
      'Payment Receipt',
      `Property: ${payment.property}\n` +
      `Amount: ₱${payment.amount.toLocaleString()}\n` +
      `Date: ${payment.date}\n` +
      `Method: ${payment.method}\n` +
      `Ref: ${payment.reference}\n` +
      `Status: ${payment.status}`,
      [{ text: 'OK' }]
    );
  };

  useFocusEffect(
    useCallback(() => {
      const handleBackPress = () => {
        router.replace('/(tenant)/menu');
        return true; 
      };
      let backHandlerSubscription;
      if (Platform.OS === 'android') {
        backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      }
      return () => {
        if (backHandlerSubscription) backHandlerSubscription.remove();
      };
    }, []) 
  );

  const getStatusColor = (status) => {
    const s = status ? status.toLowerCase() : '';
    if (s === 'completed' || s === 'paid') return '#10b981';
    if (s === 'pending') return '#f59e0b';
    return '#666';
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Payments',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {['monthly', 'quarterly', 'yearly'].map(p => (
             <TouchableOpacity 
               key={p} 
               style={[styles.periodButton, selectedPeriod === p && styles.periodButtonActive]}
               onPress={() => setSelectedPeriod(p)}
             >
               <Text style={[styles.periodText, selectedPeriod === p && styles.periodTextActive]}>
                 {p.charAt(0).toUpperCase() + p.slice(1)}
               </Text>
             </TouchableOpacity>
          ))}
        </View>

        {/* Overview Cards */}
        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="wallet" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.statValue}>₱{financialData.totalSpent.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Paid</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="time" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>₱{financialData.pendingAmount.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Upcoming / Due Payments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Due</Text>
          </View>
          {upcomingDue.length === 0 ? (
             <View style={styles.emptyState}>
               <Text style={styles.emptyStateText}>No upcoming bills.</Text>
             </View>
          ) : (
             upcomingDue.map((item) => (
                <View key={item.id} style={styles.paymentItem}>
                   <View style={{flex:1}}>
                      {/* --- PROPERTY NAME IS RENDERED HERE --- */}
                      <Text style={styles.propertyName}>{item.property}</Text> 
                      
                      <Text style={styles.paymentDate}>Due: {item.dueDate}</Text>
                      <Text style={styles.paymentType}>{item.type}</Text>
                   </View>
                   <View style={{alignItems:'flex-end', justifyContent:'space-between'}}>
                      <Text style={styles.paymentAmount}>₱{parseFloat(item.amount).toLocaleString()}</Text>
                      <TouchableOpacity style={styles.payButton} onPress={() => handlePayNow(item)}>
                         <Text style={styles.payButtonText}>Pay</Text>
                      </TouchableOpacity>
                   </View>
                </View>
             ))
          )}
        </View>

        {/* Payment History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment History</Text>
          </View>
          {paymentHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color="#ccc" />
              <Text style={styles.emptyStateText}>No payment history</Text>
            </View>
          ) : (
            paymentHistory.map((p, i) => (
              <TouchableOpacity key={p.id || i} style={styles.paymentItem} onPress={() => handleViewReceipt(p)}>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                     <Text style={styles.propertyName}>{p.property}</Text>
                     <Text style={styles.paymentAmount}>₱{p.amount.toLocaleString()}</Text>
                  </View>
                  <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:4}}>
                     <Text style={styles.paymentDate}>{p.date}</Text>
                     <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                        <View style={{width:6, height:6, borderRadius:3, backgroundColor: getStatusColor(p.status)}} />
                        <Text style={[styles.statusText, {color: getStatusColor(p.status)}]}>{p.status}</Text>
                     </View>
                  </View>
                  <Text style={styles.paymentReference}>Ref: {p.reference}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" style={{marginLeft: 8, alignSelf:'center'}} />
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>

      {/* Pay Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay Rent</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.summaryLabel}>Property: <Text style={styles.summaryValue}>{selectedBooking?.property}</Text></Text>
            <Text style={styles.summaryLabel}>Amount: <Text style={[styles.summaryValue, {color:Colors.primary}]}>₱{parseFloat(paymentDetails.amount || 0).toLocaleString()}</Text></Text>

            <View style={styles.formSection}>
               <Text style={styles.formLabel}>Select Method</Text>
               <View style={{flexDirection:'row', gap:10, flexWrap:'wrap'}}>
                  {['cash', 'gcash', 'paymaya', 'bank'].map(m => (
                    <TouchableOpacity 
                      key={m} 
                      style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text style={[styles.methodText, paymentMethod === m && styles.methodTextActive]}>{m.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
               </View>
            </View>

            {paymentMethod !== 'cash' && (
                <View style={styles.formSection}>
                   <Text style={styles.formLabel}>Account Number</Text>
                   <TextInput 
                     style={styles.textInput} 
                     placeholder="09xxxxxxxxx or Acc #" 
                     keyboardType="numeric"
                     value={paymentDetails.accountNumber}
                     onChangeText={t => setPaymentDetails(p => ({...p, accountNumber: t}))}
                   />
                </View>
            )}
            
            {paymentMethod === 'cash' && (
                <Text style={{fontStyle:'italic', color:'#666', marginVertical:10}}>
                   Please hand cash directly to your landlord. This record will serve as your proof of payment intent.
                </Text>
            )}

            <TouchableOpacity style={styles.confirmButton} onPress={processPayment}>
               <Text style={styles.confirmButtonText}>
                 {paymentMethod === 'cash' ? 'Record Cash Payment' : 'Confirm Payment'}
               </Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', padding: 16 },
  periodSelector: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 12, padding: 4, marginBottom: 20 },
  periodButton: { flex: 1, padding: 8, alignItems: 'center', borderRadius: 8 },
  periodButtonActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: 14, color: '#666' },
  periodTextActive: { color: 'white', fontWeight: 'bold' },
  
  overviewSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { width: '48%', backgroundColor: 'white', padding: 16, borderRadius: 12, elevation: 2 },
  statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#666' },

  section: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  seeAllText: { color: Colors.primary, fontWeight: '600' },
  
  paymentItem: { backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  propertyName: { fontSize: 16, fontWeight: '600', color: '#333' },
  paymentAmount: { fontSize: 16, fontWeight: 'bold', color: Colors.primary },
  paymentDate: { fontSize: 12, color: '#999' },
  paymentType: { fontSize: 12, color: '#666', fontWeight: '500' },
  statusText: { fontSize: 12, fontWeight: '600' },
  paymentReference: { fontSize: 10, color: '#ccc', marginTop: 4 },

  payButton: { backgroundColor: Colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 8 },
  payButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },

  emptyState: { alignItems: 'center', padding: 20 },
  emptyStateText: { color: '#999', marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', margin: 20, padding: 24, borderRadius: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { fontSize: 14, color: '#666', marginBottom: 4 },
  summaryValue: { fontWeight: 'bold', color: '#333' },
  formSection: { marginTop: 16 },
  formLabel: { fontWeight: '600', marginBottom: 8 },
  textInput: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, padding: 12 },
  methodBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', minWidth: '45%', marginBottom: 8 },
  methodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodText: { fontSize: 12, color: '#666', fontWeight: '600' },
  methodTextActive: { color: 'white' },
  confirmButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  confirmButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
});
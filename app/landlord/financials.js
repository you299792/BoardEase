import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import {
  supabase,
  getCurrentUser,
  getLandlordBookings,
  getLandlordListings,
} from '../../lib/supabaseClient';

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
  
  const [receiptData, setReceiptData] = useState(null);

  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tenantName: '',
    property: '',
    amount: '',
    type: 'rent',
    status: 'completed',
    method: 'Cash',
  });

  const singleReceiptRef = useRef();   

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (receiptData) {
      const timer = setTimeout(() => {
        captureSingleReceipt();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [receiptData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Real-time subscription for payment updates - set up AFTER user is fetched
  useEffect(() => {
    let subscription;

    const setupSubscription = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          console.log('No user, cannot set up subscription');
          return;
        }

        const { data: landlordProfile } = await supabase
          .from('landlord_profile')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!landlordProfile?.id) {
          console.log('No landlord profile found');
          return;
        }

        console.log('Setting up real-time subscription for landlord:', landlordProfile.id);

        subscription = supabase
          .channel(`payments:landlord_${landlordProfile.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payments',
              filter: `landlord_id=eq.${landlordProfile.id}`
            },
            (payload) => {
              console.log('🔔 Payment update received:', payload);
              // Reload data when payment is updated
              loadData();
            }
          )
          .subscribe((status) => {
            console.log('Subscription status:', status);
          });
      } catch (error) {
        console.error('Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        console.log('Cleaning up subscription');
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  // Polling mechanism as fallback - checks for payment updates when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused - starting payment polling');
      
      // Poll every 10 seconds while screen is focused (only fetch payments, not all data)
      const pollInterval = setInterval(async () => {
        try {
          const user = await getCurrentUser();
          if (user) {
            const { data: landlordProfile } = await supabase
              .from('landlord_profile')
              .select('id')
              .eq('user_id', user.id)
              .single();

            if (landlordProfile?.id) {
              // Only fetch payments, not all data
              const { data: dbPayments } = await supabase
                .from('payments')
                .select(`
                  id,
                  booking_id,
                  tenant_id,
                  amount,
                  status,
                  paid_date,
                  created_at,
                  payment_type,
                  payment_method,
                  reference_number,
                  listing_id,
                  booking:booking_id(id),
                  listing:listing_id(title)
                `)
                .eq('landlord_id', landlordProfile.id)
                .order('paid_date', { ascending: false });

              if (dbPayments) {
                console.log('[Polling] Fetched payments:', dbPayments.length);
                const mappedPayments = dbPayments.map(p => {
                  const booking = bookings?.find(b => b.id === p.booking?.id);
                  const tenantName = booking?.tenant_profile?.users?.first_name 
                    ? `${booking.tenant_profile.users.first_name} ${booking.tenant_profile.users.last_name || ''}`.trim()
                    : 'Unknown Tenant';
                  const propertyName = p.listing?.title || 'Unknown Property';

                  return {
                    ...p,
                    id: p.id,
                    booking_id: p.booking_id,
                    booking: p.booking,
                    tenantName,
                    tenant: tenantName,
                    property: propertyName,
                    amount: parseFloat(p.amount) || 0,
                    status: p.status || 'pending',
                    date: p.paid_date || p.created_at,
                    paidDate: p.paid_date,
                    type: p.payment_type || 'rent',
                    method: p.payment_method || 'Bank Transfer',
                    reference: p.reference_number || 'N/A',
                  };
                });
                
                setPayments(mappedPayments);
              }
            }
          }
        } catch (error) {
          console.error('[Polling] Error:', error);
        }
      }, 10000); // Poll every 10 seconds instead of 5

      return () => {
        if (pollInterval) clearInterval(pollInterval);
        console.log('Screen unfocused - stopping payment polling');
      };
    }, [bookings])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      setCurrentUser(user);

      if (user) {
        // Get landlord profile ID
        const { data: landlordProfile } = await supabase
          .from('landlord_profile')
          .select('id')
          .eq('user_id', user.id)
          .single();

        const landlordProfileId = landlordProfile?.id;

        const { success: listingsSuccess, listings: dbListings } = await getLandlordListings(user.id);
        if (listingsSuccess) setListings(dbListings || []);

        const { success: bookingsSuccess, bookings: dbBookings } = await getLandlordBookings(user.id);
        if (bookingsSuccess) setBookings(dbBookings || []);

        // Fetch payments made by tenants for this landlord
        const { data: dbPayments, error: paymentsError } = await supabase
          .from('payments')
          .select(`
            id,
            tenant_id,
            amount,
            status,
            paid_date,
            created_at,
            payment_type,
            payment_method,
            reference_number,
            listing_id,
            tenant:tenant_id(id, user_id),
            booking:booking_id(id),
            listing:listing_id(title)
          `)
          .eq('landlord_id', landlordProfileId)
          .order('paid_date', { ascending: false });

        let allPayments = [];

        if (!paymentsError && dbPayments) {
          const mappedPayments = dbPayments.map(p => {
            // Get tenant name from bookings
            const booking = dbBookings?.find(b => b.id === p.booking?.id);
            const tenantName = booking?.tenant_profile?.users?.first_name 
              ? `${booking.tenant_profile.users.first_name} ${booking.tenant_profile.users.last_name || ''}`.trim()
              : 'Unknown Tenant';
            const propertyName = p.listing?.title || 'Unknown Property';

            return {
              ...p,
              id: p.id,
              tenantName,
              tenant: tenantName,
              property: propertyName,
              amount: parseFloat(p.amount) || 0,
              status: p.status || 'pending',
              date: p.paid_date || p.created_at,
              paidDate: p.paid_date,
              type: p.payment_type || 'rent',
              method: p.payment_method || 'Bank Transfer',
              reference: p.reference_number || 'N/A',
            };
          });
          allPayments = mappedPayments;
        }

        const localData = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
        if (localData) {
          const localPayments = JSON.parse(localData);
          const uniqueLocal = localPayments.filter(lp => !allPayments.some(dp => dp.reference === lp.reference));
          allPayments = [...uniqueLocal, ...allPayments];
        }

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
    await loadData();
    setRefreshing(false);
  };

  const calculateFinancialData = () => {
    const completedPayments = payments.filter(p => p.status === 'completed');
    const pendingPayments = payments.filter(p => p.status === 'pending');
    
    const totalEarnings = completedPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    const totalProperties = listings.length;
    
    const occupiedProperties = bookings.filter(b => b.status === 'approved' || b.status === 'pending').length;
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
      pendingPaymentsAmount: pendingAmount,
      totalProperties,
      occupancyRate,
      averageRent: Math.round(averageRent),
      monthlyEarnings,
      completedPayments: completedPayments.length,
    };
  };
  
  const financialData = calculateFinancialData();

  const paymentHistory = payments.map(payment => ({
    id: payment.id,
    tenant: payment.tenantName || 'Tenant',
    property: payment.property,
    amount: payment.amount,
    date: payment.paidDate || payment.date,
    status: payment.status,
    type: payment.type || 'rent',
    method: payment.method || 'Cash',
    reference: payment.reference || 'N/A',
  }));

  // Calculate upcoming due payments from bookings
  // For each booking/property, return at most ONE upcoming due (the next month occurrence)
  const upcomingDue = bookings
    .map(b => {
      if (!(b.status === 'approved' || b.status === 'occupied')) return null;
      const today = new Date();
      const moveIn = new Date(b.move_in_date);
      let nextDue = new Date(moveIn);

      // Find the first future due date (today or later) and mark if paid or pending (up to 12 months)
      for (let i = 0; i < 12; i++) {
        if (nextDue < today) {
          nextDue.setMonth(nextDue.getMonth() + 1);
          continue;
        }

        const dueDateStr = nextDue.toISOString().split('T')[0];

        const paymentForThisDate = payments.find(p => {
          const paymentDate = (p.date || p.paidDate || '').toString().split('T')[0];
          return (
            p.bookingId === b.id || p.booking?.id === b.id || p.booking_id === b.id
          ) && paymentDate === dueDateStr;
        });

        const isPaid = paymentForThisDate && (paymentForThisDate.status === 'completed' || paymentForThisDate.status === 'paid');

        return {
          id: `due_${b.id}_${dueDateStr}`,
          property: b.title || b.name || 'Property Name',
          tenant: b.tenant_profile?.users?.first_name 
            ? `${b.tenant_profile.users.first_name} ${b.tenant_profile.users.last_name || ''}`.trim()
            : 'Tenant',
          amount: b.total_amount || b.price || 0,
          dueDate: dueDateStr,
          type: 'Rent',
          bookingId: b.id,
          status: isPaid ? 'paid' : 'pending'
        };
      }

      return null;
    })
    .filter(Boolean);

  const pendingPaymentsList = payments.filter(payment => payment.status === 'pending');

  const captureSingleReceipt = async () => {
    try {
      const uri = await captureRef(singleReceiptRef, {
        format: 'png',
        quality: 1.0, 
        result: 'tmpfile'
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Download Receipt',
          UTI: 'public.png'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Single Receipt Export failed:', error);
      Alert.alert('Error', 'Could not generate receipt image.');
    } finally {
      setReceiptData(null);
    }
  };

  const handleExportData = async () => {
    if (payments.length === 0) {
      Alert.alert('No Data', 'You have no data to export.');
      return;
    }

    try {
      const landlordName = getLandlordName();
      const logoUrl = "YOUR_IMAGE_URL_HERE"; 

      const recordsHtml = paymentHistory.map(item => `
        <div class="receipt-card">
          <div class="header">
            <div class="logo-row">
               <span style="font-size:50px; color:#CD212A; margin-right:10px;">🏠</span>
               <span class="logo-text">BoardEase</span>
            </div>
            <div class="tagline">Finding your perfect boarding house in CDO</div>
          </div>
          <div class="thick-divider"></div>
          <div class="records-title">Records:</div>
          <div class="record-row"><span class="label">Date:</span><span class="value">${formatDate(item.date)}</span></div>
          <div class="record-row"><span class="label">Tenant:</span><span class="value">${item.tenant}</span></div>
          <div class="record-row"><span class="label">Property:</span><span class="value">${item.property}</span></div>
          <div class="record-row"><span class="label">Amount:</span><span class="value">₱${item.amount.toLocaleString()}</span></div>
          <div class="record-row"><span class="label">Type:</span><span class="value">${formatType(item.type)}</span></div>
          <div class="record-row"><span class="label">Status:</span><span class="value">${item.status}</span></div>
          <div class="record-row"><span class="label">Method:</span><span class="value">${item.method}</span></div>
          <div class="record-row"><span class="label">Reference:</span><span class="value">${item.reference}</span></div>
          <div class="thick-divider" style="margin-top:30px;"></div>
          <div class="footer">Approved by: ${landlordName}</div>
        </div>
        <div style="page-break-after: always;"></div>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              @page { margin: 0; }
              body { font-family: 'Helvetica', sans-serif; background-color: #f5f5f5; padding: 20px; }
              .receipt-card { background-color: white; width: 100%; max-width: 600px; margin: 0 auto 20px auto; padding: 40px; box-sizing: border-box; border: 1px solid #ddd; }
              .header { text-align: center; margin-bottom: 20px; }
              .logo-row { display: flex; align-items: center; justify-content: center; }
              .logo-text { font-size: 40px; font-weight: bold; color: #000; }
              .tagline { font-size: 16px; color: #555; margin-top: 8px; font-style: italic; text-align: center; }
              .thick-divider { height: 3px; background-color: #000; margin: 20px 0; }
              .records-title { font-size: 32px; font-weight: bold; color: #000; margin-bottom: 20px; }
              .record-row { display: flex; margin-bottom: 8px; font-size: 18px; }
              .label { width: 150px; font-weight: 600; color: #000; }
              .value { flex: 1; color: #333; }
              .footer { text-align: right; font-size: 18px; font-weight: 500; color: #000; }
            </style>
          </head>
          <body>${recordsHtml}</body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Export Financial Records' });
    } catch (error) {
      console.error('Export PDF failed:', error);
      Alert.alert('Export Failed', 'Could not generate PDF.');
    }
  };

  const handleRecordPayment = () => {
    const firstProp = listings.length > 0 ? listings[0] : null;
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      tenantName: '',
      property: firstProp ? (firstProp.title || firstProp.name) : '',
      amount: firstProp ? (firstProp.price || firstProp.rent || '').toString() : '',
      type: 'rent',
      status: 'completed',
      method: 'Cash',
    });
    setShowRecordPaymentModal(true);
  };

  const processRecordedPayment = async () => {
    if (!paymentForm.tenantName.trim() || !paymentForm.amount) {
      Alert.alert('Error', 'Tenant Name and Amount are required.');
      return;
    }
    
    const amountFloat = parseFloat(paymentForm.amount);
    const generatedRef = `TRX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newUiPayment = {
      id: `temp_${Date.now()}`, 
      tenantName: paymentForm.tenantName,
      property: paymentForm.property,
      amount: amountFloat,
      type: paymentForm.type,
      status: paymentForm.status,
      date: paymentForm.date,
      paidDate: paymentForm.date,
      method: paymentForm.method,
      reference: generatedRef,
      isLocal: true 
    };

    setPayments(prev => [newUiPayment, ...prev]);
    setShowRecordPaymentModal(false);

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert([{
            landlord_id: currentUser?.id,
            payment_date: paymentForm.date,
            tenant_name: paymentForm.tenantName,
            property_title: paymentForm.property,
            amount: amountFloat,
            payment_type: paymentForm.type,
            status: paymentForm.status,
            method: paymentForm.method,
            reference: generatedRef,
        }]).select();

      if (error) {
        console.warn('Supabase insert failed, persisting to local storage');
        const existingJson = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
        const existingPayments = existingJson ? JSON.parse(existingJson) : [];
        existingPayments.push(newUiPayment);
        await AsyncStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(existingPayments));
      } else {
        await loadData();
      }
      
      Alert.alert('Success', `Payment Saved! Ref: ${generatedRef}`);
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert('Error', 'Failed to save record remotely.');
    }
  };

  const handleRecordClick = (payment) => {
    Alert.alert(
      'Payment Options',
      `Ref: ${payment.reference}\nAmount: ₱${payment.amount.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Download Receipt', 
          onPress: () => setReceiptData(payment) 
        }
      ]
    );
  };

  const handleRequestPayment = async (tenantName, id) => {
     Alert.alert('Success', `Payment reminder sent to ${tenantName}`);
  };

  const getStatusColor = (status) => {
    const s = status ? status.toLowerCase() : '';
    if (s === 'completed' || s === 'paid') return '#10b981';
    if (s === 'pending') return '#f59e0b';
    return '#666';
  };
  const getStatusText = (status) => {
    const s = status ? status.toLowerCase() : '';
    if (s === 'completed' || s === 'paid') return 'Paid';
    return 'Pending';
  };
  const formatDate = (dateStr) => {
    if(!dateStr) return 'N/A';
    return new Date(dateStr).toISOString().split('T')[0];
  };
  const formatType = (t) => {
    if(t === 'security_deposit') return 'Deposit';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const getLandlordName = () => {
    if (!currentUser) return 'Property Owner';
    const meta = currentUser.user_metadata;
    if (meta && (meta.first_name || meta.last_name)) {
      return `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
    }
    return currentUser.email || 'Property Owner';
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Financials & Payments',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Overview & Stats */}
        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>₱{financialData.totalEarnings.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>₱{financialData.pendingPaymentsAmount.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleExportData}>
              <Ionicons name="download" size={24} color={Colors.primary} />
              <Text style={styles.actionText}>Export All (PDF)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Due Payments */}
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
                  <Text style={styles.tenantName}>{item.tenant}</Text>
                  <Text style={styles.propertyName}>{item.property}</Text>
                  <Text style={styles.paymentDate}>Due: {item.dueDate}</Text>
                </View>
                <View style={{alignItems:'flex-end', justifyContent:'space-between'}}>
                  <Text style={styles.paymentAmount}>₱{parseFloat(item.amount).toLocaleString()}</Text>
                  <Text style={[styles.statusText, {color: getStatusColor(item.status)}]}>
                    {getStatusText(item.status)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* --- HIDDEN VIEW: SINGLE RECEIPT EXPORT (PNG) --- */}
      {receiptData && (
        <View style={{ position: 'absolute', left: -10000, top: 0, opacity: 1, backgroundColor: 'white' }} pointerEvents="none">
          <ViewShot ref={singleReceiptRef} options={{ format: "png", quality: 1.0 }} style={{ backgroundColor: 'white' }}>
            <View style={styles.exportContainer}>
              
              <View style={styles.exportHeader}>
                <View style={styles.logoRow}>
                  <Ionicons name="home" size={60} color="#CD212A" />
                  <Text style={[styles.logoText, {fontSize: 48}]}>BoardEase</Text>
                </View>
                <Text style={styles.tagline}>Finding your perfect boarding house in CDO</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.recordsTitle}>Payment Receipt</Text>
              
              <View style={styles.recordsList}>
                <View style={styles.recordBlock}>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Date:</Text><Text style={styles.recordValue}>{formatDate(receiptData.date)}</Text></View>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Tenant:</Text><Text style={styles.recordValue}>{receiptData.tenant}</Text></View>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Property:</Text><Text style={styles.recordValue}>{receiptData.property}</Text></View>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Amount:</Text><Text style={styles.recordValue}>₱{receiptData.amount.toLocaleString()}</Text></View>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Type:</Text><Text style={styles.recordValue}>{formatType(receiptData.type)}</Text></View>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Status:</Text><Text style={styles.recordValue}>{receiptData.status}</Text></View>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Method:</Text><Text style={styles.recordValue}>{receiptData.method}</Text></View>
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Reference:</Text><Text style={styles.recordValue}>{receiptData.reference}</Text></View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.exportFooter}>
                <Text style={styles.approvedText}>Approved by: {getLandlordName()}</Text>
              </View>

            </View>
          </ViewShot>
        </View>
      )}

      {/* --- RECORD PAYMENT MODAL --- */}
      <Modal visible={showRecordPaymentModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
               <Text style={styles.modalTitle}>Record Payment</Text>

               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Date</Text>
                 <TextInput style={styles.textInput} value={paymentForm.date} placeholder="YYYY-MM-DD" onChangeText={t => setPaymentForm(p => ({...p, date: t}))} />
               </View>

               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Tenant</Text>
                 <TextInput style={styles.textInput} value={paymentForm.tenantName} placeholder="Name" onChangeText={t => setPaymentForm(p => ({...p, tenantName: t}))} />
               </View>

               {/* Property Selector (Auto-fills Amount) */}
               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Property</Text>
                 {listings.length > 0 ? (
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}} keyboardShouldPersistTaps="handled">
                     {listings.map((item, idx) => {
                        const propName = item.title || item.name || `Prop ${idx}`;
                        const isActive = paymentForm.property === propName;
                        return (
                          <TouchableOpacity 
                            key={item.id || idx} 
                            style={[styles.propertyChip, isActive && styles.propertyChipActive]} 
                            onPress={() => {
                                const price = item.price || item.rent || '';
                                setPaymentForm(p => ({
                                    ...p, 
                                    property: propName,
                                    amount: price.toString()
                                }));
                            }}
                          >
                            <Text style={[styles.propertyChipText, isActive && styles.propertyChipTextActive]}>{propName}</Text>
                          </TouchableOpacity>
                        );
                     })}
                   </ScrollView>
                 ) : (
                   <TextInput style={styles.textInput} value={paymentForm.property} placeholder="Room/Unit" onChangeText={t => setPaymentForm(p => ({...p, property: t}))} />
                 )}
               </View>

               {/* READ-ONLY AMOUNT FIELD */}
               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Amount (₱)</Text>
                 <TextInput 
                    style={[styles.textInput, {backgroundColor: '#f0f0f0', color: '#555'}]} 
                    value={String(paymentForm.amount)} 
                    editable={false}
                    selectTextOnFocus={false}
                    placeholder="0.00" 
                 />
               </View>

               {/* Payment Type */}
               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Payment Type</Text>
                 <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
                    {['rent', 'utility', 'security_deposit'].map(t => (
                      <TouchableOpacity 
                        key={t} 
                        style={[styles.optionBtn, paymentForm.type === t && styles.optionBtnActive]} 
                        onPress={() => setPaymentForm(p => ({...p, type: t}))}
                      >
                        <Text style={[styles.optionText, paymentForm.type === t && styles.optionTextActive]}>{formatType(t)}</Text>
                      </TouchableOpacity>
                    ))}
                 </View>
               </View>

               {/* Status */}
               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Status</Text>
                 <View style={{flexDirection: 'row', gap: 8}}>
                    {['completed', 'pending'].map(s => (
                      <TouchableOpacity 
                        key={s} 
                        style={[styles.optionBtn, paymentForm.status === s && styles.optionBtnActive]} 
                        onPress={() => setPaymentForm(p => ({...p, status: s}))}
                      >
                        <Text style={[styles.optionText, paymentForm.status === s && styles.optionTextActive]}>
                          {s === 'completed' ? 'Paid' : 'Pending'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                 </View>
               </View>

               {/* Method */}
               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Payment Method</Text>
                 <View style={{flexDirection: 'row', gap: 8}}>
                    {['Cash', 'Gcash', 'Bank'].map(m => (
                      <TouchableOpacity 
                        key={m} 
                        style={[styles.optionBtn, paymentForm.method === m && styles.optionBtnActive]} 
                        onPress={() => setPaymentForm(p => ({...p, method: m}))}
                      >
                        <Text style={[styles.optionText, paymentForm.method === m && styles.optionTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                 </View>
               </View>

               {/* Buttons */}
               <View style={{flexDirection:'row', gap: 10, marginTop: 20, marginBottom: 20}}>
                  <TouchableOpacity style={[styles.confirmButton, {backgroundColor:'#ccc', flex:1}]} onPress={() => setShowRecordPaymentModal(false)}>
                    <Text style={styles.confirmButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmButton, {flex:1}]} onPress={processRecordedPayment}>
                    <Text style={styles.confirmButtonText}>Save</Text>
                  </TouchableOpacity>
               </View>
             </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: '#333' },
  
  // Export Styles
  exportContainer: {
    width: 500,
    backgroundColor: 'white',
    padding: 40,
    paddingTop: 60,
  },
  exportHeader: { alignItems: 'center', marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoText: { fontSize: 40, fontWeight: 'bold', color: '#000' },
  tagline: { fontSize: 16, color: '#555', marginTop: 8, fontStyle: 'italic' },
  divider: { height: 3, backgroundColor: '#000', marginVertical: 20 },
  recordsTitle: { fontSize: 32, fontWeight: 'bold', color: '#000', marginBottom: 20 },
  recordsList: { gap: 20 },
  recordBlock: { gap: 5 },
  recordRow: { flexDirection: 'row', marginBottom: 4 },
  recordLabel: { width: 140, fontSize: 18, fontWeight: '500', color: '#000' },
  recordValue: { fontSize: 18, color: '#333', flex: 1 },
  exportFooter: { alignItems: 'flex-end', marginTop: 20 },
  approvedText: { fontSize: 18, color: '#000', fontWeight: '500' },

  // Standard Styles
  overviewSection: { marginBottom: 20 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#666' },
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionButton: { flex: 1, backgroundColor: 'white', padding: 16, alignItems: 'center', borderRadius: 12 },
  actionText: { fontSize: 12, marginTop: 4, color: Colors.primary, fontWeight: '500' },
  paymentItem: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  tenantName: { fontWeight: '600', fontSize: 16 },
  propertyName: { fontSize: 14, color: '#666', marginTop: 4 },
  paymentDate: { fontSize: 12, color: '#999', marginTop: 4 },
  paymentAmount: { color: Colors.primary, fontWeight: 'bold' },
  statusText: { fontSize: 12, textTransform: 'capitalize' },
  emptyStateText: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 20 },
  
  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', margin: 20, padding: 24, borderRadius: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  formSection: { marginBottom: 16 },
  formLabel: { fontWeight: '600', marginBottom: 8, fontSize: 14, color: '#333' },
  textInput: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, padding: 12, fontSize: 16 },
  
  // Chips
  propertyChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, backgroundColor: '#f0f0f0', marginRight: 8, borderWidth: 1, borderColor: '#eee' },
  propertyChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  propertyChipText: { fontSize: 14, color: '#555', fontWeight: '500' },
  propertyChipTextActive: { color: 'white' },

  optionBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: 'white' },
  optionBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionText: { color: '#666', fontWeight: '600' },
  optionTextActive: { color: 'white' },

  confirmButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: 'white', fontWeight: '600' },
  periodSelector: { flexDirection: 'row', marginBottom: 20 }, 
});
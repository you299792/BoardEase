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
  ActivityIndicator,
  Platform,
  BackHandler,
  Image
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { 
  supabase, 
  getCurrentUser, 
  getTenantBookings,
  getTenantProfile,
  createConversation,
  sendMessage,
  uploadMessageImage
} from '../../lib/supabaseClient';

const PAYMENTS_STORAGE_KEY = '@tenant_payments_data';

export default function FinancialsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [paymentMethod, setPaymentMethod] = useState('cash'); 
  const [paymentDetails, setPaymentDetails] = useState({
    accountNumber: '',
    accountName: '',
    amount: '',
    reference: ''
  });
  
  // Receipt State
  const [receiptData, setReceiptData] = useState(null);
  const [receiptAction, setReceiptAction] = useState(null); // 'share' or 'chat'
  const singleReceiptRef = useRef();

  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantProfile, setTenantProfile] = useState(null);
  const [tenantName, setTenantName] = useState(''); 

  useEffect(() => {
    loadData();
  }, []);

  // Trigger capture when data is ready
  useEffect(() => {
    if (receiptData && receiptAction) {
      const timer = setTimeout(() => {
        captureSingleReceipt();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [receiptData, receiptAction]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      
      // Poll every 10 seconds while screen is focused to check for updated payment statuses
      const pollInterval = setInterval(() => {
        console.log('📊 Polling for payment updates (tenant)...');
        loadData();
      }, 10000);

      return () => {
        if (pollInterval) clearInterval(pollInterval);
      };
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

      let fetchedTenantName = 'Tenant';
      let profileId = null;

      const { success: profileSuccess, user: userObj, profile } = await getTenantProfile(user.id);
      
      if (profileSuccess && userObj) {
        fetchedTenantName = `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Tenant';
        profileId = profile?.id; // Get ID from profile object, not user object
        
        if (!profileId) {
             const { data: rawProfile } = await supabase
            .from('tenant_profile')
            .select('id')
            .eq('user_id', user.id)
            .single();
            profileId = rawProfile?.id;
        }
      }

      setTenantName(fetchedTenantName);
      setTenantProfile({ id: profileId });

      if (!profileId) {
        setIsLoading(false);
        return;
      }

      // Load Bookings
      let currentBookings = [];
      const { success: bookingsSuccess, bookings: bookingsData } = await getTenantBookings(profileId);
      
      if (bookingsSuccess) {
        currentBookings = bookingsData.map(b => {
          const listing = b.listing || b.listings || {};
          const landlord = listing.landlord_profile?.users || {};
          
          return {
            id: b.id,
            landlordId: listing.landlord_id, 
            landlordName: landlord.first_name ? `${landlord.first_name} ${landlord.last_name}` : 'Landlord',
            property: listing.title || listing.name || 'Unknown Property',
            amount: b.total_amount || listing.price || 0,
            status: b.status,
            moveInDate: b.move_in_date
          };
        });
        setBookings(currentBookings);
      }

      // Load Payments
      const { data: dbPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', profileId)
        .order('paid_date', { ascending: false });

      console.log('[loadData] Payments fetched:', dbPayments?.length || 0, 'Error:', paymentsError?.message);

      let allPayments = [];

      if (!paymentsError && dbPayments) {
        const mappedPayments = dbPayments.map(p => {
          const matchedBooking = currentBookings.find(b => b.landlordId === p.landlord_id);
          const resolvedLandlordName = matchedBooking ? matchedBooking.landlordName : 'Landlord';

          const mapped = {
            ...p,
            id: p.id,
            landlordId: p.landlord_id,
            landlordName: resolvedLandlordName, 
            tenantName: fetchedTenantName,
            property: matchedBooking?.property || 'Unknown Property',
            amount: parseFloat(p.amount) || 0, 
            status: p.status ? p.status.toLowerCase() : 'pending', 
            date: p.paid_date || p.created_at,
            type: p.payment_type || 'rent',
            method: p.payment_method || 'Manual',
            reference: p.reference_number || 'N/A',
          };
          
          if (p.status === 'completed') {
            console.log('[loadData] Completed payment found:', p.reference_number, 'Date:', p.paid_date);
          }
          
          return mapped;
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
      console.log('[loadData] Final payments count:', allPayments.length);
      console.log('[loadData] Completed payments:', allPayments.filter(p => p.status === 'completed').length);
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

  // --- RECEIPT HANDLER ---
  const captureSingleReceipt = async () => {
    try {
      // Generate the image
      const uri = await captureRef(singleReceiptRef, {
        format: 'png',
        quality: 1.0, 
        result: 'tmpfile'
      });

      if (receiptAction === 'share') {
        // Option A: Share/Download
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Download Receipt',
            UTI: 'public.png'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } else if (receiptAction === 'chat') {
        // Option B: Send to Landlord
        let landlordId = receiptData?.landlordId || receiptData?.landlord_id || (receiptData?.landlord && (receiptData.landlord.id || receiptData.landlord.user_id)) || null;
        let landlordName = receiptData?.landlordName || receiptData?.landlord_name || (receiptData?.landlord && (receiptData.landlord.first_name ? `${receiptData.landlord.first_name} ${receiptData.landlord.last_name}` : null)) || 'Landlord';

        // Fallbacks: try to resolve landlordId from bookings or other payments if missing
        if (!landlordId) {
          // Try booking match by bookingId
          const bookingId = receiptData?.bookingId || receiptData?.booking_id || receiptData?.booking;
          if (bookingId) {
            const found = bookings.find(b => String(b.id) === String(bookingId));
            if (found) landlordId = found.landlordId || found.landlord_id || null;
          }
        }

        if (!landlordId && receiptData?.property) {
          const foundByProp = bookings.find(b => (b.property || '').toLowerCase() === (receiptData.property || '').toLowerCase());
          if (foundByProp) landlordId = foundByProp.landlordId || foundByProp.landlord_id || null;
        }

        if (!landlordId && receiptData?.landlordName) {
          const foundByName = bookings.find(b => (b.landlordName || '').toLowerCase() === (receiptData.landlordName || '').toLowerCase());
          if (foundByName) landlordId = foundByName.landlordId || foundByName.landlord_id || null;
        }

        if (!landlordId && payments && payments.length) {
          const foundInPayments = payments.find(p => (p.landlordName || '').toLowerCase() === (receiptData.landlordName || '').toLowerCase() && (p.landlordId || p.landlord_id));
          if (foundInPayments) landlordId = foundInPayments.landlordId || foundInPayments.landlord_id || null;
        }

        if (landlordId) {
          try {
            // Ensure we have tenantProfile id and current user
            const tenantProfileId = tenantProfile?.id;
            const current = await getCurrentUser();
            const senderUserId = current?.id;

            // Find existing conversation between tenant and landlord
            let conversation = null;
            const { data: existingConv, error: existingConvErr } = await supabase
              .from('conversations')
              .select('*')
              .eq('tenant_id', tenantProfileId)
              .eq('landlord_id', landlordId)
              .maybeSingle();

            if (existingConvErr) console.warn('Existing conversation lookup error:', existingConvErr);

            // Debug: dump all relevant context
            console.log('DEBUG Conversation creation:', {
              tenantProfileId,
              landlordId,
              landlordName,
              listingIdForConv: receiptData?.listingId || receiptData?.listing_id || selectedBooking?.listingId || selectedBooking?.listing_id || null,
              receiptData,
              selectedBooking,
              bookings,
              payments
            });

            if (existingConv) {
              conversation = existingConv;
            } else {
              // Create a new conversation (use createConversation helper if possible)
              const listingIdForConv = receiptData?.listingId || receiptData?.listing_id || selectedBooking?.listingId || selectedBooking?.listing_id || null;
              try {
                const { success: convSuccess, conversation: createdConv } = await createConversation(tenantProfileId, landlordId, listingIdForConv);
                if (convSuccess && createdConv) {
                  conversation = createdConv;
                }
              } catch (e) {
                console.warn('createConversation helper failed:', e);
              }

              if (!conversation) {
                // Fallback: try direct insert. If listingId is missing, insert without it.
                const insertPayload = listingIdForConv ? { tenant_id: tenantProfileId, landlord_id: landlordId, listing_id: listingIdForConv } : { tenant_id: tenantProfileId, landlord_id: landlordId };
                const { data: newConv, error: insertErr } = await supabase
                  .from('conversations')
                  .insert([insertPayload])
                  .select()
                  .single();

                if (insertErr) {
                  console.error('Conversation insert error:', insertErr);
                  Alert.alert('Error', `Conversation creation failed: ${insertErr.message || JSON.stringify(insertErr)}`);
                  conversation = null;
                } else {
                  conversation = newConv;
                }
              }
            }

            if (!conversation) throw new Error('Could not create/find conversation');

            // Upload the image to storage and send as message
            const uploadRes = await uploadMessageImage(uri, senderUserId || tenantProfileId);
            const imageUrl = uploadRes?.success ? uploadRes.publicUrl : null;

            const messageText = `Payment Receipt${receiptData?.reference ? ' - Ref: ' + receiptData.reference : ''}`;

            // sendMessage will create the message row and the notification for the landlord
            const sendRes = await sendMessage(conversation.id, senderUserId || tenantProfileId, messageText, imageUrl);
            if (!sendRes.success) {
              console.warn('Failed to send message:', sendRes.error);
              Alert.alert('Warning', 'Receipt saved but message delivery failed.');
            }

            // Navigate to conversation in chat screen
            router.push({ pathname: '/(tenant)/chat', params: { conversationId: conversation.id } });

          } catch (err) {
            console.error('Failed to send receipt to landlord:', err);
            Alert.alert('Error', 'Failed to send receipt to landlord.');
          }
        } else {
            Alert.alert("Error", "Landlord information missing for this payment.");
        }
      }

    } catch (error) {
      console.error('Receipt generation failed:', error);
      Alert.alert('Error', 'Could not generate receipt image.');
    } finally {
      setReceiptData(null);
      setReceiptAction(null);
    }
  };

  const handleViewReceipt = (payment) => {
    Alert.alert(
      'Payment Options',
      `Ref: ${payment.reference}\nAmount: ₱${payment.amount.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Download', 
          onPress: () => {
            setReceiptAction('share');
            setReceiptData(payment);
          } 
        },
        { 
          text: 'Send to Landlord', 
          onPress: () => {
            setReceiptAction('chat');
            setReceiptData(payment);
          } 
        }
      ]
    );
  };

  // Helpers
  const calculateNextDueDate = (moveInDateStr) => {
    if (!moveInDateStr) return 'N/A';
    const moveIn = new Date(moveInDateStr);
    const today = new Date();
    if (moveIn > today) return moveIn.toISOString().split('T')[0];
    let nextDue = new Date(moveIn);
    while (nextDue <= today) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }
    return nextDue.toISOString().split('T')[0];
  };

  const calculateFinancialData = () => {
    const completedPayments = payments.filter(p => p.status === 'completed' || p.status === 'paid');
    
    // Calculate total spent from completed payments
    const totalSpent = completedPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    
    // Calculate pending from upcomingDue (upcoming rent that hasn't been paid yet)
    const pendingAmount = upcomingDue.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    const rentPayments = completedPayments.filter(p => p.type === 'rent');
    const averageRent = rentPayments.length > 0 
      ? rentPayments.reduce((sum, p) => sum + p.amount, 0) / rentPayments.length 
      : 0;

    return {
      totalSpent,
      pendingAmount,
      averageRent: Math.round(averageRent),
    };
  };

  const paymentHistory = payments.map(p => ({
    ...p,
    type: p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1) : 'Payment',
    status: p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Unknown'
  }));

  // For each booking/property, return at most ONE upcoming due (the next unpaid month)
  const upcomingDue = bookings
    .map(b => {
      if (!(b.status === 'approved' || b.status === 'occupied')) return null;
      const today = new Date();
      const moveIn = new Date(b.moveInDate);
      let nextDue = new Date(moveIn);

      // Find the first due date that is today or in the future and not already paid (up to 12 months)
      for (let i = 0; i < 12; i++) {
        if (nextDue < today) {
          nextDue.setMonth(nextDue.getMonth() + 1);
          continue;
        }

        const dueDateStr = nextDue.toISOString().split('T')[0];

        const alreadyPaid = payments.some(p => {
          const paymentDate = (p.date || p.paidDate || '').toString().split('T')[0];
          return (
            p.booking_id === b.id &&
            paymentDate === dueDateStr &&
            (p.status === 'completed' || p.status === 'paid')
          );
        });

        if (!alreadyPaid) {
          return {
            id: `due_${b.id}_${dueDateStr}`,
            property: b.property || 'Property Name',
            amount: b.amount,
            dueDate: dueDateStr,
            type: 'Rent',
            bookingId: b.id,
            landlordId: b.landlordId,
            landlordName: b.landlordName
          };
        }

        // if paid, try next month
        nextDue.setMonth(nextDue.getMonth() + 1);
      }

      // No upcoming unpaid due found within the next 12 months
      return null;
    })
    .filter(Boolean);

  const financialData = calculateFinancialData();

  const handlePayNow = (item) => {
    setSelectedBooking(item);
    setPaymentMethod('cash'); 
    setPaymentDetails({
      accountNumber: '',
      accountName: tenantName, // Pre-fill with fetched name
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
    
    const nameToUse = tenantName || 'Tenant';

    const newPayment = {
      booking_id: selectedBooking?.bookingId,
      listing_id: selectedBooking?.id || selectedBooking?.listingId,
      tenant_id: tenantProfile?.id,
      landlord_id: selectedBooking?.landlordId, 
      amount: amountFloat,
      payment_type: 'rent',
      status: 'completed', 
      paid_date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod, 
      reference_number: generatedRef,
      notes: `Payment made by ${nameToUse}`
    };

    const optimisticPayment = { 
        ...newPayment, 
        id: `temp_${Date.now()}`, 
        date: newPayment.paid_date, 
        paidDate: newPayment.paid_date,
        property: selectedBooking?.property,
        tenant_name: nameToUse,
        property_title: selectedBooking?.property,
        tenantName: nameToUse,
      landlordName: selectedBooking?.landlordName || 'Landlord',
      landlordId: newPayment.landlord_id || selectedBooking?.landlordId || selectedBooking?.landlord_id || null,
      type: 'Rent',
      status: 'completed',
      method: paymentMethod,
      reference: generatedRef
    };
    
    setPayments(prev => [optimisticPayment, ...prev]);
    setShowPaymentModal(false);

    try {
        console.log('[processPayment] Inserting payment:', newPayment);
        const { error, data } = await supabase.from('payments').insert([newPayment]);
        
        console.log('[processPayment] Insert result - Error:', error?.message, 'Data:', data);
        
        if (error) {
            console.warn("DB Save failed, saving locally", error);
            const existingJson = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
            const existing = existingJson ? JSON.parse(existingJson) : [];
            existing.push(optimisticPayment);
            await AsyncStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(existing));
        } else {
            console.log('[processPayment] Payment inserted successfully, reloading data...');
            await loadData();
        }

        Alert.alert('Success', `Payment Sent! Ref: ${generatedRef}`);

    } catch (err) {
        Alert.alert('Error', 'Payment failed');
    }
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
  
  const formatDate = (dateStr) => {
    if(!dateStr) return 'N/A';
    return new Date(dateStr).toISOString().split('T')[0];
  };

  const formatType = (type) => {
      return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Payment';
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
                     <Text style={styles.paymentDate}>{formatDate(p.date)}</Text>
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

      {/* --- HIDDEN VIEW: RECEIPT EXPORT (PNG) --- */}
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
                  
                  {/* Tenant Name */}
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Tenant:</Text><Text style={styles.recordValue}>{receiptData.tenantName}</Text></View>
                  
                  {/* Property Name */}
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
                {/* Updated Footer */}
                <Text style={styles.approvedText}>Approved by: {receiptData.landlordName}</Text>
              </View>
            </View>
          </ViewShot>
        </View>
      )}

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

  // Export Styles (BoardEase Format)
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
});
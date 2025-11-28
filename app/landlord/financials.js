import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  sendMessage,
  uploadMessageImage,
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
  const [landlordProfileId, setLandlordProfileId] = useState(null);
  
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showSendReceiptModal, setShowSendReceiptModal] = useState(false);
  const [lastRecordedPayment, setLastRecordedPayment] = useState(null);
  
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

  // Memoized lookup maps to quickly determine if a booking/listing/property has been paid for a period
  const paidPeriodsByBooking = useMemo(() => {
    const map = new Map();
    payments.forEach(payment => {
      const status = (payment.status || '').toLowerCase();
      if (status !== 'completed' && status !== 'paid') return;

      const periodDateRaw = payment.billingPeriodDate || payment.dueDate || payment.due_date || payment.date;
      if (!periodDateRaw) return;
      const paidDate = new Date(periodDateRaw);
      if (isNaN(paidDate.getTime())) return;
      const periodKey = `${paidDate.getFullYear()}-${paidDate.getMonth()}`;

      const bookingKey = payment.bookingId || payment.booking_id || payment.booking?.id;
      if (!bookingKey) return;

      if (!map.has(bookingKey)) map.set(bookingKey, new Set());
      map.get(bookingKey).add(periodKey);
    });
    return map;
  }, [payments]);

  const paidPeriodsByListing = useMemo(() => {
    const map = new Map();
    payments.forEach(payment => {
      const status = (payment.status || '').toLowerCase();
      if (status !== 'completed' && status !== 'paid') return;

      const periodDateRaw = payment.billingPeriodDate || payment.dueDate || payment.due_date || payment.date;
      if (!periodDateRaw) return;
      const paidDate = new Date(periodDateRaw);
      if (isNaN(paidDate.getTime())) return;
      const periodKey = `${paidDate.getFullYear()}-${paidDate.getMonth()}`;

      const listingKey = payment.listing_id || payment.listingId;
      if (!listingKey) return;

      if (!map.has(listingKey)) map.set(listingKey, new Set());
      map.get(listingKey).add(periodKey);
    });
    return map;
  }, [payments]);

  const paidPeriodsByProperty = useMemo(() => {
    const map = new Map();
    payments.forEach(payment => {
      const status = (payment.status || '').toLowerCase();
      if (status !== 'completed' && status !== 'paid') return;

      const periodDateRaw = payment.billingPeriodDate || payment.dueDate || payment.due_date || payment.date;
      if (!periodDateRaw) return;
      const paidDate = new Date(periodDateRaw);
      if (isNaN(paidDate.getTime())) return;
      const periodKey = `${paidDate.getFullYear()}-${paidDate.getMonth()}`;

      const propertyKey = (payment.property || payment.property_title || '').toLowerCase();
      if (!propertyKey) return;

      if (!map.has(propertyKey)) map.set(propertyKey, new Set());
      map.get(propertyKey).add(periodKey);
    });
    return map;
  }, [payments]);

  // --- UNIFIED DATA LOADING FUNCTION ---
  // This handles fetching from DB, fetching from Local Storage, and merging them correctly.
  const loadData = async (isSilent = false) => {
    try {
      // Only show spinner if it's a full reload, not a background poll
      if (!isSilent) setIsLoading(true);
      
      const user = await getCurrentUser();
      if (!user) {
        if (!isSilent) setIsLoading(false);
        return;
      }
      setCurrentUser(user);

      // 1. Get Landlord Profile ID
      const { data: landlordProfile } = await supabase
        .from('landlord_profile')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const currentProfileId = landlordProfile?.id;
      setLandlordProfileId(currentProfileId);

      if (!currentProfileId) {
         if (!isSilent) setIsLoading(false);
         return;
      }

      // 2. Fetch Listings & Bookings (Needed for mapping names)
      const { success: listingsSuccess, listings: dbListings } = await getLandlordListings(user.id);
      if (listingsSuccess) setListings(dbListings || []);

      const { success: bookingsSuccess, bookings: dbBookings } = await getLandlordBookings(user.id);
      if (bookingsSuccess) setBookings(dbBookings || []);

      // 3. Fetch Payments from DB (Source of Truth)
      console.log('[loadData] Fetching payments for landlord_id:', currentProfileId);
      const { data: dbPayments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id, tenant_id, amount, status, paid_date, created_at, due_date,
            payment_type, payment_method, reference_number, listing_id, booking_id,
            tenant:tenant_id(id, user_id),
            booking:booking_id(id),
            listing:listing_id(title)
        `)
        .eq('landlord_id', currentProfileId)
        .order('paid_date', { ascending: false });

      console.log('[loadData] Payments fetched:', dbPayments?.length, 'Error:', paymentsError);

      // 4. Map DB Payments to UI Format
      let mappedDbPayments = [];
      if (!paymentsError && dbPayments) {
        mappedDbPayments = dbPayments.map(p => {
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
            billingPeriodDate: p.due_date,
            dueDate: p.due_date,
            type: p.payment_type || 'rent',
            method: p.payment_method || 'Bank Transfer',
            reference: p.reference_number || 'N/A',
            source: 'db',
            bookingId: p.booking_id,  // Add bookingId for isDuePaid matching
            booking_id: p.booking_id, // Also include underscore version
          };
        });
      }

      // 5. Fetch Local Payments (Pending Sync)
      const localData = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
      let localPayments = localData ? JSON.parse(localData) : [];

      // 6. MERGE LOGIC:
      // Create a Set of all Reference Numbers currently in the DB
      const dbReferences = new Set(mappedDbPayments.map(p => p.reference));
      
      // Filter Local payments: Only keep those that are NOT yet in the DB
      // (If a reference exists in DB, it means it synced successfully, so we use the DB version)
      const unsyncedLocalPayments = localPayments.filter(p => !dbReferences.has(p.reference));

      // Combine DB payments + Unsynced Local payments
      const finalPayments = [...unsyncedLocalPayments, ...mappedDbPayments];
      
      // Sort by Date (Newest first)
      finalPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

      setPayments(finalPayments);

    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
    loadData();
  }, []);

  // --- RECEIPT CAPTURE EFFECT ---
  useEffect(() => {
    if (receiptData) {
      const timer = setTimeout(() => {
        captureSingleReceipt();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [receiptData]);

  // --- POLLING MECHANISM (FIXED) ---
  useFocusEffect(
    useCallback(() => {
      // 1. Immediate refresh when screen comes into focus
      console.log('Screen focused - refreshing data');
      loadData(true); 

      // 2. Start Polling Interval
      console.log('Starting payment polling');
      const pollInterval = setInterval(() => {
        // Run silently (true) so we don't flash the spinner
        console.log('Polling for updates...');
        loadData(true); 
      }, 10000); // Poll every 10 seconds

      // 3. Cleanup on blur
      return () => {
        if (pollInterval) clearInterval(pollInterval);
        console.log('Screen unfocused - stopping payment polling');
      };
    }, [])
  );

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    let subscription;

    const setupSubscription = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        const { data: landlordProfile } = await supabase
          .from('landlord_profile')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!landlordProfile?.id) return;

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
              console.log('🔔 Payment update received via Websocket');
              loadData(true); // Silent reload on real-time event
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false); // Full load with spinner logic handled by RefreshControl
    setRefreshing(false);
  };

  // --- CALCULATION LOGIC ---

  // Helper function to check if a due has been paid
  const isDuePaid = (booking, dueDate, propertyName) => {
    const dueMonth = dueDate.getMonth();
    const dueYear = dueDate.getFullYear();
    const periodKey = `${dueYear}-${dueMonth}`;

    if (booking?.id) {
      const bookingPeriods = paidPeriodsByBooking.get(booking.id);
      if (bookingPeriods?.has(periodKey)) return true;
    }

    if (booking?.listing_id) {
      const listingPeriods = paidPeriodsByListing.get(booking.listing_id);
      if (listingPeriods?.has(periodKey)) return true;
    }

    const propertyKey = (propertyName || '').toLowerCase();
    if (propertyKey) {
      const propertyPeriods = paidPeriodsByProperty.get(propertyKey);
      if (propertyPeriods?.has(periodKey)) return true;
    }

    // Fallback to direct scan for legacy/local records without mapped identifiers
    return payments.some(payment => {
      const status = (payment.status || '').toLowerCase();
      if (status !== 'completed' && status !== 'paid') return false;

      const paymentDate = new Date(payment.billingPeriodDate || payment.dueDate || payment.due_date || payment.date);
      if (isNaN(paymentDate.getTime())) return false;

      const dateMatch = paymentDate.getMonth() === dueMonth && paymentDate.getFullYear() === dueYear;
      if (!dateMatch) return false;

      const bookingMatch = (payment.bookingId === booking.id || payment.booking?.id === booking.id || payment.booking_id === booking.id);
      if (bookingMatch) return true;

      const listingMatch = payment.listing_id && booking.listing_id && payment.listing_id === booking.listing_id;
      if (listingMatch) return true;

      const propertyMatch = (payment.property || payment.property_title || '').toLowerCase() === propertyKey;
      return propertyMatch;
    });
  };

  // Calculate upcoming due payments
  const upcomingDue = bookings
    .map(b => {
      if (!(b.status === 'approved' || b.status === 'occupied')) return null;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
      
      const moveIn = new Date(b.move_in_date);
      if (isNaN(moveIn.getTime())) return null;

      // Resolve property display name and amount first (needed for matching)
      let propertyName = 'Property Name';
      let propertyAmount = b.total_amount || b.price || 0;

      if (b.listing && (b.listing.title || b.listing.name)) {
        propertyName = b.listing.title || b.listing.name;
        propertyAmount = propertyAmount || (b.listing.price || b.listing.rent || 0);
      } else if (b.property_title) {
        propertyName = b.property_title;
      } else {
        const listMatch = listings.find(l => l.id === b.listing_id || l.id === b.listingId);
        if (listMatch) {
          propertyName = listMatch.title || listMatch.name || propertyName;
          propertyAmount = propertyAmount || (listMatch.price || listMatch.rent || 0);
        } else if (b.title || b.name) {
          propertyName = b.title || b.name;
        }
      }

      // Find the first due date (today or later) that is NOT paid
      // Start from move-in date and iterate through months
      for (let i = 0; i < 24; i++) {
        // Calculate the due date for this iteration
        const nextDue = new Date(moveIn.getFullYear(), moveIn.getMonth() + i, moveIn.getDate());
        
        // Skip if due date is in the past
        if (nextDue < today) {
          continue;
        }

        const dueDateStr = nextDue.toISOString().split('T')[0];
        
        // Check if this due has been paid
        const isPaid = isDuePaid(b, nextDue, propertyName);

        if (!isPaid) {
          return {
            id: `due_${b.id}_${dueDateStr}`,
            property: propertyName,
            tenant: b.tenant_profile?.users?.first_name 
              ? `${b.tenant_profile.users.first_name} ${b.tenant_profile.users.last_name || ''}`.trim()
              : 'Tenant',
            amount: propertyAmount || 0,
            dueDate: dueDateStr,
            type: 'Rent',
            bookingId: b.id,
            status: 'pending'
          };
        }
      }
      return null;
    })
    .filter(Boolean);

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
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  const calculateFinancialDataWithUpcoming = () => {
    const completedPayments = payments.filter(p => {
      const s = (p.status || '').toString().toLowerCase();
      return s === 'completed' || s === 'paid';
    });
    const pendingPayments = payments.filter(p => {
      const s = (p.status || '').toString().toLowerCase();
      return s === 'pending';
    });

    const totalEarnings = completedPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);

    const upcomingPendingAmount = upcomingDue
      .filter(d => d.status !== 'paid')
      .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const upcomingPendingCount = upcomingDue.filter(d => d.status !== 'paid').length;

    const totalProperties = listings.length;
    const occupiedProperties = bookings.filter(b => {
      const s = (b.status || '').toString().toLowerCase();
      return s === 'approved' || s === 'pending' || s === 'occupied';
    }).length;
    const occupancyRate = totalProperties > 0 ? Math.round((occupiedProperties / totalProperties) * 100) : 0;

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
      pendingPaymentsCount: pendingPayments.length + upcomingPendingCount,
      pendingPaymentsAmount: pendingAmount + upcomingPendingAmount,
      totalProperties,
      occupancyRate,
      monthlyEarnings,
      completedPayments: completedPayments.length,
    };
  };

  const financialData = calculateFinancialDataWithUpcoming();

  const upcomingPendingAmount = upcomingDue
    .filter(d => d.status !== 'paid')
    .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const upcomingPendingCount = upcomingDue.filter(d => d.status !== 'paid').length;

  const paidPayments = useMemo(() => (
    payments.filter(p => {
      const s = (p.status || '').toString().toLowerCase();
      return s === 'completed' || s === 'paid';
    })
  ), [payments]);

  const handleReminders = () => {
    if (upcomingPendingCount === 0) {
      Alert.alert('Up to date', 'No upcoming unpaid dues to remind.');
      return;
    }
    const payload = upcomingDue
      .filter(d => d.status !== 'paid')
      .map(d => `${d.property} (${formatDate(d.dueDate)})`)
      .join('\n');

    Alert.alert(
      'Send Reminders',
      `Prepare reminders for ${upcomingPendingCount} upcoming bills:\n${payload}`
    );
  };

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
    const todayIso = new Date().toISOString().split('T')[0];
    const billingPeriodDate = paymentForm.date;

    // Try to associate with booking - check multiple property name fields
    const matchedBooking = bookings.find(b => {
      const propName = b.listing?.title || b.listing?.name || b.title || b.name || '';
      const formProp = (paymentForm.property || '').toLowerCase();
      return propName.toLowerCase() === formProp;
    });
    
    // Get listing ID - also check paymentForm.listingId which is set when property chip is selected
    const matchedListing = listings.find(l => (l.title || l.name) === paymentForm.property);
    const listingId = paymentForm.listingId || matchedListing?.id || matchedBooking?.listing_id;

    const newUiPayment = {
      id: `temp_${Date.now()}`,
      tenantName: paymentForm.tenantName,
      property: paymentForm.property,
      amount: amountFloat,
      type: paymentForm.type,
      status: paymentForm.status,
      date: todayIso,
      paidDate: todayIso,
      billingPeriodDate,
      dueDate: billingPeriodDate,
      method: 'Cash',
      reference: generatedRef,
      isLocal: true,
      bookingId: matchedBooking?.id,
      booking: matchedBooking ? { id: matchedBooking.id } : undefined,
      matchedBooking: matchedBooking,
      listing_id: listingId,
    };

    // Optimistic Update
    setPayments(prev => [newUiPayment, ...prev]);
    setShowRecordPaymentModal(false);

    // Validate required fields for DB insert
    // tenant_id can come from: tenant_profile.id (nested), tenant_id (direct), or tenant_profile_id (mapped)
    const tenantProfileId = matchedBooking?.tenant_profile?.id || matchedBooking?.tenant_id || matchedBooking?.tenant_profile_id;
    
    console.log('[processRecordedPayment] matchedBooking:', matchedBooking?.id, 'tenant_id:', tenantProfileId, 'listing_id:', listingId);
    
    if (!tenantProfileId || !listingId) {
      console.warn('Missing tenant_id or listing_id, saving locally only');
      Alert.alert('Offline Mode', 'Payment saved locally. Missing tenant or listing info for database sync.');
      const existingJson = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
      const existingPayments = existingJson ? JSON.parse(existingJson) : [];
      existingPayments.push(newUiPayment);
      await AsyncStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(existingPayments));
      setLastRecordedPayment(newUiPayment);
      setShowSendReceiptModal(true);
      return;
    }

    try {
      const insertRow = {
        landlord_id: landlordProfileId,
        tenant_id: tenantProfileId,
        listing_id: listingId,
        paid_date: todayIso,
        due_date: billingPeriodDate,
        amount: amountFloat,
        payment_type: paymentForm.type,
        status: paymentForm.status,
        payment_method: 'cash',
        reference_number: generatedRef,
      };

      if (matchedBooking?.id) insertRow.booking_id = matchedBooking.id;

      console.log('[processRecordedPayment] Inserting payment:', JSON.stringify(insertRow, null, 2));

      const { data: insertedData, error } = await supabase
        .from('payments')
        .insert([insertRow])
        .select();

      console.log('[processRecordedPayment] Insert result:', insertedData, 'Error:', error);

      if (error) {
        console.warn('Supabase insert failed, persisting to local storage:', error);
        Alert.alert('Offline Mode', `Payment saved locally: ${error.message || 'Connection issue'}`);
        
        // Save to Local Storage
        const existingJson = await AsyncStorage.getItem(PAYMENTS_STORAGE_KEY);
        const existingPayments = existingJson ? JSON.parse(existingJson) : [];
        existingPayments.push(newUiPayment);
        await AsyncStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(existingPayments));
      } else {
        // Successful insert - reload to get proper DB ID and clean up local
        await loadData(true);
      }

      setLastRecordedPayment(newUiPayment);
      setShowSendReceiptModal(true);
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert('Error', `Failed to process payment: ${error.message}`);
    }
  };

  const handleSendReceipt = async () => {
    if (!lastRecordedPayment) return;

    try {
      setReceiptData(lastRecordedPayment);
      await new Promise(resolve => setTimeout(resolve, 100));

      const uri = await captureRef(singleReceiptRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile'
      });

      const { success: uploadSuccess, publicUrl, error: uploadError } = await uploadMessageImage(uri, currentUser.id);
      if (!uploadSuccess) throw new Error(uploadError || 'Upload failed');

      let conversationId = null;
      const matchedBooking = lastRecordedPayment.matchedBooking;
      if (!matchedBooking || !matchedBooking.tenant_profile?.id) {
        throw new Error('No tenant found for this payment');
      }

      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', matchedBooking.tenant_profile.id)
        .eq('landlord_id', landlordProfileId)
        .maybeSingle();

      if (existingConversation) {
        conversationId = existingConversation.id;
      } else {
        const baseConv = {
          tenant_id: matchedBooking.tenant_profile.id,
          landlord_id: landlordProfileId,
          listing_id: matchedBooking.listing_id,
          is_active: true,
        };

        const firstTry = await supabase.from('conversations').insert([baseConv]).select('id').single();
        if (firstTry.error) {
          const retryTry = await supabase.from('conversations').insert([{ ...baseConv, conversation_topic: 'General' }]).select('id').single();
          if (retryTry.error) throw new Error(`Failed to create conversation: ${retryTry.error.message}`);
          conversationId = retryTry.data.id;
        } else {
          conversationId = firstTry.data.id;
        }
      }

      const { success: sendSuccess, error: sendError } = await sendMessage(
        conversationId,
        currentUser.id,
        `Payment Receipt - Ref: ${lastRecordedPayment.reference}`,
        publicUrl
      );

      if (!sendSuccess) throw new Error(sendError || 'Failed to send message');

      setShowSendReceiptModal(false);
      setLastRecordedPayment(null);
      setReceiptData(null);
      router.push(`/landlord/chat?conversationId=${conversationId}`);

    } catch (error) {
      console.error('Send receipt error:', error);
      Alert.alert('Error', `Failed to send receipt: ${error.message}`);
    }
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
          <View style={styles.quickActionsSummary}>
            <Text style={styles.quickSummaryText}>Upcoming due: {upcomingPendingCount} {upcomingPendingCount === 1 ? 'property' : 'properties'}</Text>
            <Text style={styles.quickSummaryText}>Amount: ₱{upcomingPendingAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.quickActions}>
              <TouchableOpacity style={styles.actionButton} onPress={handleExportData}>
                <Ionicons name="download" size={24} color={Colors.primary} />
                <Text style={styles.actionText}>Export All (PDF)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleRecordPayment}>
                <Ionicons name="add" size={24} color={Colors.primary} />
                <Text style={styles.actionText}>Record Payment</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleReminders}>
                <Ionicons name="notifications" size={24} color={Colors.primary} />
                <Text style={styles.actionText}>Send Reminders</Text>
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

        {/* Payment History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment History</Text>
          </View>
          {paidPayments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No payment history.</Text>
            </View>
          ) : (
            paidPayments
              .slice()
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 10) // Show last 10
              .map((item) => (
                <View key={item.id} style={styles.paymentItem}>
                  <View style={{flex:1}}>
                    <Text style={styles.tenantName}>{item.tenantName}</Text>
                    <Text style={styles.propertyName}>{item.property}</Text>
                    <Text style={styles.paymentDate}>Paid: {formatDate(item.paidDate || item.date)}</Text>
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
                  <View style={styles.recordRow}><Text style={styles.recordLabel}>Tenant:</Text><Text style={styles.recordValue}>{receiptData.tenantName}</Text></View>
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
                                const booking = bookings.find(b => b.listing_id === item.id);
                                let dueDate = new Date().toISOString().split('T')[0]; 
                                let tenantName = '';
                                
                                if (booking && (booking.status === 'approved' || booking.status === 'occupied')) {
                                  // Get tenant name
                                  if (booking.tenant_profile?.users) {
                                    const u = booking.tenant_profile.users;
                                    tenantName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                                  }
                                  
                                  // Calculate next unpaid due date
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const moveIn = new Date(booking.move_in_date);
                                  
                                  for (let i = 0; i < 24; i++) {
                                    const nextDue = new Date(moveIn.getFullYear(), moveIn.getMonth() + i, moveIn.getDate());
                                    if (nextDue >= today) {
                                      // Check if this due is already paid
                                      if (!isDuePaid(booking, nextDue, propName)) {
                                        dueDate = nextDue.toISOString().split('T')[0];
                                        break;
                                      }
                                    }
                                  }
                                }
                                setPaymentForm(p => ({
                                    ...p, 
                                    property: propName,
                                    amount: price.toString(),
                                    date: dueDate,
                                    tenantName: tenantName || p.tenantName,
                                    listingId: item.id,
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

               <View style={styles.formSection}>
                 <Text style={styles.formLabel}>Payment Method</Text>
                 <Text style={[styles.textInput, {backgroundColor: '#f0f0f0'}]}>Cash</Text>
               </View>

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

      {/* --- SEND RECEIPT MODAL --- */}
      <Modal visible={showSendReceiptModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Receipt</Text>
            <Text style={{fontSize: 16, marginBottom: 20, textAlign: 'center'}}>
              Payment recorded successfully!{'\n'}Ref: {lastRecordedPayment?.reference}
            </Text>
            <Text style={{fontSize: 14, marginBottom: 20, color: '#666'}}>
              Send the receipt as an image message to the tenant?
            </Text>
            <View style={{flexDirection:'row', gap: 10}}>
              <TouchableOpacity 
                style={[styles.confirmButton, {backgroundColor:'#ccc', flex:1}]} 
                onPress={() => {
                  setShowSendReceiptModal(false);
                  setLastRecordedPayment(null);
                }}
              >
                <Text style={styles.confirmButtonText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmButton, {flex:1}]} 
                onPress={handleSendReceipt}
              >
                <Text style={styles.confirmButtonText}>Send Receipt</Text>
              </TouchableOpacity>
            </View>
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
  quickActionsSummary: { backgroundColor: '#eef3ff', borderRadius: 12, padding: 12, marginBottom: 12 },
  quickSummaryText: { fontSize: 14, color: '#334155', fontWeight: '600' },
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
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  BackHandler,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  getCurrentUser,
  getTenantBookings,
  updateBookingStatus,
  getTenantProfile,
  sendMessage,
} from '../../lib/supabaseClient';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
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

      // Fetch bookings from Supabase
      const { success, bookings: data, error } = await getTenantBookings(user.id);

      if (success) {
        // Transform Supabase data to match component expectations
        const transformedBookings = data.map(booking => ({
          id: booking.id,
          propertyId: booking.listing_id,
          property: booking.listings?.title,
          landlordId: booking.listings?.landlord_profile?.user_id,
          landlordName: `${booking.listings?.landlord_profile?.users?.first_name} ${booking.listings?.landlord_profile?.users?.last_name}`,
          landlordEmail: booking.listings?.landlord_profile?.users?.email,
          landlordPhone: booking.listings?.landlord_profile?.users?.phone,
          landlordImage: booking.listings?.landlord_profile?.users?.profile_image_url,
          moveInDate: booking.check_in_date ? new Date(booking.check_in_date).toLocaleDateString() : 'TBD',
          moveOutDate: booking.check_out_date ? new Date(booking.check_out_date).toLocaleDateString() : 'TBD',
          guests: booking.number_of_occupants || 1,
          amount: booking.total_amount,
          status: booking.booking_status,
          bookedAt: booking.created_at,
          cancelledAt: booking.cancelled_at,
          cancelReason: booking.cancellation_reason,
          notes: booking.special_requests,
          tenantId: booking.tenant_profile_id,
        }));

        setBookings(transformedBookings);
      } else {
        Alert.alert('Error', error || 'Failed to load bookings');
      }
    } catch (error) {
      console.error('Failed to load bookings', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const filteredBookings = bookings.filter(booking => {
    switch (filter) {
      case 'upcoming':
        return booking.status === 'approved' || booking.status === 'pending';
      case 'completed':
        return booking.status === 'completed';
      case 'cancelled':
        return booking.status === 'cancelled';
      default:
        return true;
    }
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      case 'completed': return '#667eea';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  // Handle System Back Action
  useFocusEffect(
    useCallback(() => {
      
      const handleBackPress = () => {
        // This function is executed when the system "Back" action occurs.
        router.replace('/(tenant)/menu');
        
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

  const handleCancelBooking = (booking) => {
    setSelectedBooking(booking);
    setShowCancelModal(true);
  };

  const confirmCancellation = async () => {
    if (!cancelReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation.');
      return;
    }

    try {
      // Update booking status in Supabase
      const { success, error } = await updateBookingStatus(
        selectedBooking.id,
        'cancelled',
        cancelReason
      );

      if (success) {
        // Send notification message to landlord via messages table
        const messageResult = await sendMessage(
          selectedBooking.landlordId,
          `❌ Booking Cancelled\n\nI need to cancel my booking for ${selectedBooking.property}.\nReason: ${cancelReason}`,
          'cancellation'
        );

        // Update local state
        setBookings(prev => prev.map(booking =>
          booking.id === selectedBooking.id
            ? { ...booking, status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason }
            : booking
        ));

        setShowCancelModal(false);
        setCancelReason('');
        setSelectedBooking(null);

        Alert.alert('Booking Cancelled', 'Your booking has been cancelled and the landlord has been notified.');
      } else {
        Alert.alert('Error', error || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Failed to cancel booking', error);
      Alert.alert('Error', 'Failed to cancel booking. Please try again.');
    }
  };

  const handleContactLandlord = (booking) => {
    router.push({
      pathname: '/(tenant)/chat',
      params: {
        landlordId: booking.landlordId,
        landlordEmail: booking.landlordEmail || '',
        landlordPhone: booking.landlordPhone || '',
        landlordName: booking.landlordName,
        landlordImage: booking.landlordImage,
        houseName: booking.property,
      }
    });
  };

  const handleViewProperty = (booking) => {
    
    router.push(`/(tenant)/boarding-house-details?id=${booking.propertyId}`);
  };

  const renderBookingCard = (booking) => (
    <View key={booking.id} style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyName}>{booking.property}</Text>
          <Text style={styles.landlordName}>by {booking.landlordName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
            {getStatusText(booking.status)}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>Move-in: {booking.moveInDate}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="people" size={16} color="#666" />
          <Text style={styles.detailText}>Guests: {booking.guests}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cash" size={16} color="#666" />
          <Text style={styles.detailText}>Amount: ₱{booking.amount?.toLocaleString() || '0'}</Text>
        </View>
        {booking.bookedAt && (
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.detailText}>Booked: {new Date(booking.bookedAt).toLocaleDateString()}</Text>
          </View>
        )}
        {booking.cancelledAt && (
          <View style={styles.detailRow}>
            <Ionicons name="close-circle" size={16} color="#666" />
            <Text style={styles.detailText}>Cancelled: {new Date(booking.cancelledAt).toLocaleDateString()}</Text>
            {booking.cancelReason && (
              <Text style={styles.cancelReason}>Reason: {booking.cancelReason}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.bookingActions}>
        {(booking.status === 'approved' || booking.status === 'pending') && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => handleCancelBooking(booking)}
          >
            <Ionicons name="close-circle" size={16} color="#ef4444" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.contactButton}
          onPress={() => handleContactLandlord(booking)}
        >
          <Ionicons name="chatbubble" size={16} color={Colors.primary} />
          <Text style={styles.contactButtonText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.viewButton}
          onPress={() => handleViewProperty(booking)}
        >
          <Ionicons name="eye" size={16} color="#666" />
          <Text style={styles.viewButtonText}>View Property</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'My Bookings',
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
          <Text style={{ marginTop: 10, color: '#666' }}>Loading bookings...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Bookings',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tenant)/menu')}
              style={{ paddingLeft: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Compact Filter Tabs */}
        <View style={styles.filterContainer}>
          <View style={styles.filterTabs}>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'upcoming' && styles.filterTabActive]}
              onPress={() => setFilter('upcoming')}
            >
              <Text style={[styles.filterText, filter === 'upcoming' && styles.filterTextActive]}>
                Upcoming
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'completed' && styles.filterTabActive]}
              onPress={() => setFilter('completed')}
            >
              <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
                Completed
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'cancelled' && styles.filterTabActive]}
              onPress={() => setFilter('cancelled')}
            >
              <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]}>
                Cancelled
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bookings List */}
        <ScrollView
          style={styles.bookingsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateTitle}>No bookings found</Text>
              <Text style={styles.emptyStateText}>
                {filter === 'all' 
                  ? "You haven't made any bookings yet."
                  : `No ${filter} bookings found.`
                }
              </Text>
              {filter !== 'all' && (
                <TouchableOpacity 
                  style={styles.browseButton}
                  onPress={() => setFilter('all')}
                >
                  <Text style={styles.browseButtonText}>View All Bookings</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredBookings.map(renderBookingCard)
          )}
        </ScrollView>

        {/* Cancellation Modal */}
        <Modal
          visible={showCancelModal}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cancel Booking</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to cancel your booking for {selectedBooking?.property}?
              </Text>
              
              <Text style={styles.inputLabel}>Reason for cancellation:</Text>
              <TextInput
                style={styles.reasonInput}
                multiline
                numberOfLines={3}
                placeholder="Please provide a reason for cancellation..."
                value={cancelReason}
                onChangeText={setCancelReason}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                    setSelectedBooking(null);
                  }}
                >
                  <Text style={styles.cancelModalButtonText}>Keep Booking</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmCancelButton]}
                  onPress={confirmCancellation}
                >
                  <Text style={styles.confirmCancelButtonText}>Confirm Cancellation</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  filterTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  bookingsList: {
    flex: 1,
    padding: 16,
  },
  bookingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  landlordName: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  cancelReason: {
    fontSize: 12,
    color: '#ef4444',
    fontStyle: 'italic',
    marginLeft: 24,
    marginTop: 4,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    gap: 6,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    gap: 6,
  },
  contactButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  confirmCancelButton: {
    backgroundColor: '#ef4444',
  },
  cancelModalButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmCancelButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
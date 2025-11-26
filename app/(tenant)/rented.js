import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
  RefreshControl
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  getCurrentUser,
  getTenantBookings, // We reuse this function
  getTenantProfile
} from '../../lib/supabaseClient';
import { supabase } from '../../lib/supabaseClient';

export default function RentedPropertiesScreen() {
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRentedProperties();
    }, [])
  );

  const loadRentedProperties = async () => {
    try {
      if (!refreshing) setIsLoading(true);
      
      const user = await getCurrentUser();
      if (!user) return;

      // 1. Get Tenant Profile ID first
      const { data: profile } = await supabase
        .from('tenant_profile')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        console.error("No tenant profile found");
        setIsLoading(false);
        return;
      }

      // 2. Fetch Tenant Bookings
      const { success, bookings, error } = await getTenantBookings(profile.id);

      if (success && bookings) {
        // 3. Filter for Active Rentals only ('approved' or 'occupied')
        const activeRentals = bookings.filter(b => {
          const status = b.status ? b.status.toLowerCase() : '';
          return status === 'approved' || status === 'occupied';
        });

        setProperties(activeRentals);
      } else {
        console.error("Error fetching rentals:", error);
      }
    } catch (error) {
      console.error('Failed to load rented properties', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRentedProperties();
  };

  const handleMessageLandlord = (landlordId, landlordName, propertyName) => {
    router.push({
      pathname: '/(tenant)/chat',
      params: { 
        landlordId: landlordId,
        landlordName: landlordName,
        houseName: propertyName
      }
    });
  };

  const handleCallLandlord = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert("No Phone", "Landlord does not have a phone number listed.");
    }
  };

  const renderPropertyCard = ({ item }) => {
    const listing = item.listings || item.listing || {};
    const landlord = listing?.landlord_profile?.users;
    
    const propertyName = listing?.title || listing?.name || 'Unknown Property';
    const propertyImage = Array.isArray(listing?.images) ? listing.images[0] : (listing?.images && listing.images[0]) || null;
    // Use price_per_month from DB schema (fallback to price if present)
    const rentAmount = listing?.price_per_month || listing?.price || 0;
    // Use full address when available, otherwise city
    const address = listing?.address || listing?.full_address || listing?.city || 'No address';
    const moveInDate = item.move_in_date || item.created_at;
    const landlordName = landlord ? `${landlord.first_name} ${landlord.last_name}` : 'Landlord';
    const landlordPhone = landlord?.phone;

    return (
      <View style={styles.card}>
        {/* Property Image Header */}
        <View style={styles.imageContainer}>
          {propertyImage ? (
            <Image source={{ uri: propertyImage }} style={styles.propertyImage} />
          ) : (
            <View style={[styles.propertyImage, styles.placeholderImage]}>
              <Ionicons name="home" size={40} color="#ccc" />
            </View>
          )}
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Active</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.headerRow}>
            <Text style={styles.propertyName}>{propertyName}</Text>
            <Text style={styles.rentAmount}>₱{rentAmount.toLocaleString()}</Text>
          </View>
          
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.locationText} numberOfLines={1}>{address}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Move-in Date</Text>
              <Text style={styles.detailValue}>{new Date(moveInDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Landlord</Text>
              <Text style={styles.detailValue}>{landlordName}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryBtn]}
              onPress={() => router.push('/(tenant)/payments')}
            >
              <Ionicons name="card-outline" size={18} color="white" />
              <Text style={styles.primaryBtnText}>Pay Rent</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryBtn]}
              onPress={() => handleMessageLandlord(listing.landlord_id, landlordName, propertyName)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryBtn]}
              onPress={() => handleCallLandlord(landlordPhone)}
            >
              <Feather name="phone" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Rented Properties',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/(tenant)/menu')} style={{ marginLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {isLoading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={properties}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPropertyCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="home-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No Active Rentals</Text>
                <Text style={styles.emptySubText}>
                  Properties will appear here once your booking request is approved by the landlord.
                </Text>
                <TouchableOpacity 
                  style={styles.browseButton}
                  onPress={() => router.replace('/(tenant)/home')}
                >
                   <Text style={styles.browseButtonText}>Browse Properties</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 150,
    width: '100%',
    position: 'relative',
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cardBody: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  rentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    flex: 2,
    gap: 8,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: '#f0f4ff',
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  browseButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
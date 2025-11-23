import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { GlobalListingContext } from './_layout';
import {
  getCurrentUser,
  deleteListing as deleteListingFromDB,
} from '../../lib/supabaseClient';

const { width: screenWidth } = Dimensions.get('window');

export default function ListingDetails() {
  const { id } = useLocalSearchParams();
  const { listings, deleteListing, updateListing } = useContext(GlobalListingContext);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [listing, setListing] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const foundListing = listings.find(l => l.id === id);
    if (foundListing) {
      setListing(foundListing);
    }
  }, [id, listings]);

  if (!listing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const handleDeleteListing = () => {
    Alert.alert(
      "Delete Property",
      "Are you sure you want to delete this property? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { success, error } = await deleteListingFromDB(id);
              if (success) {
                deleteListing(id);
                router.back();
              } else {
                Alert.alert('Error', error || 'Failed to delete property');
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete property');
            } finally {
              setIsDeleting(false);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleEditListing = () => {
    router.push(`/landlord/create-listing?id=${id}`);
  };

  const handleToggleStatus = () => {
    const newStatus = listing.status === 'available' ? 'occupied' : 'available';
    const updatedListing = {
      ...listing,
      status: newStatus,
    };
    updateListing(id, updatedListing);
    Alert.alert('Success', `Property marked as ${newStatus}`);
  };

  const handleImageScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setActiveImageIndex(index);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#10b981';
      case 'occupied': return '#ef4444';
      case 'maintenance': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'Available';
      case 'occupied': return 'Occupied';
      case 'maintenance': return 'Under Maintenance';
      default: return 'Unknown';
    }
  };

  
  const analyticsData = [
    { label: 'Total Views', value: listing.views || 0, icon: 'eye', color: '#3b82f6' },
    { label: 'Inquiries', value: listing.inquiries || 0, icon: 'message-square', color: '#8b5cf6' },
    { label: 'Bookings', value: listing.bookings || 0, icon: 'calendar', color: '#10b981' },
    { label: 'Conversion Rate', value: `${((listing.bookings || 0) / (listing.views || 1) * 100).toFixed(1)}%`, icon: 'trending-up', color: '#f59e0b' },
  ];

  const performanceData = [
    { label: 'Response Rate', value: '95%', trend: 'up' },
    { label: 'Inquiry Response Time', value: '2.3h', trend: 'down' },
    { label: 'Booking Rate', value: '12%', trend: 'up' },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Property Details',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleEditListing} style={{ paddingRight: 16 }}>
              <Feather name="edit" size={20} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.imageSection}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleImageScroll}
            scrollEventThrottle={16}
          >
            {listing.images.map((image, index) => (
              <Image
                key={index}
                source={{ uri: image }}
                style={styles.listingImage}
              />
            ))}
          </ScrollView>
          
          
          {listing.images.length > 1 && (
            <View style={styles.imageIndicators}>
              {listing.images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.imageIndicator,
                    index === activeImageIndex && styles.imageIndicatorActive
                  ]}
                />
              ))}
            </View>
          )}

          
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(listing.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(listing.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(listing.status) }]}>
              {getStatusText(listing.status)}
            </Text>
          </View>
        </View>

        
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text style={styles.listingName}>{listing.name}</Text>
            <Text style={styles.listingPrice}>₱{listing.price.toLocaleString()}/month</Text>
          </View>
          
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.listingLocation}>{listing.location}</Text>
          </View>

          <View style={styles.ratingRow}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <Text style={styles.ratingText}>{listing.rating || 'New'}</Text>
              <Text style={styles.reviewsText}>({listing.reviews || 0} reviews)</Text>
            </View>
            <Text style={styles.listingType}>{listing.type || 'Boarding House'}</Text>
          </View>
        </View>

        
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleStatus}>
            <Ionicons 
              name={listing.status === 'available' ? 'eye-off' : 'eye'} 
              size={20} 
              color={Colors.primary} 
            />
            <Text style={styles.actionText}>
              {listing.status === 'available' ? 'Mark Occupied' : 'Mark Available'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleEditListing}>
            <Feather name="edit" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Edit Details</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={() => {/* Share functionality */}}>
            <Feather name="share" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Analytics</Text>
          <View style={styles.analyticsGrid}>
            {analyticsData.map((item, index) => (
              <View key={index} style={styles.analyticsCard}>
                <View style={[styles.analyticsIcon, { backgroundColor: item.color + '20' }]}>
                  <Feather name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.analyticsValue}>{item.value}</Text>
                <Text style={styles.analyticsLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Details</Text>
          <Text style={styles.description}>{listing.description || 'No description provided.'}</Text>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="bed-outline" size={18} color="#666" />
              <Text style={styles.detailText}>{listing.bedrooms || 'N/A'} bedrooms</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="water-outline" size={18} color="#666" />
              <Text style={styles.detailText}>{listing.bathrooms || 'N/A'} bathrooms</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="expand-outline" size={18} color="#666" />
              <Text style={styles.detailText}>{listing.area || 'N/A'} sqm</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={18} color="#666" />
              <Text style={styles.detailText}>Max {listing.maxOccupants || 'N/A'} people</Text>
            </View>
          </View>
        </View>

        
        {listing.amenities && listing.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {listing.amenities.map((amenity, index) => (
                <View key={index} style={styles.amenityItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Metrics</Text>
          <View style={styles.performanceList}>
            {performanceData.map((item, index) => (
              <View key={index} style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>{item.label}</Text>
                <View style={styles.performanceValueContainer}>
                  <Text style={styles.performanceValue}>{item.value}</Text>
                  <Ionicons 
                    name={item.trend === 'up' ? 'trending-up' : 'trending-down'} 
                    size={16} 
                    color={item.trend === 'up' ? '#10b981' : '#ef4444'} 
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <Ionicons name="eye" size={16} color="#3b82f6" />
              <Text style={styles.activityText}>Viewed by potential tenant • 2 hours ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="message-square" size={16} color="#8b5cf6" />
              <Text style={styles.activityText}>New inquiry received • 5 hours ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="calendar" size={16} color="#10b981" />
              <Text style={styles.activityText}>Booking scheduled • 1 day ago</Text>
            </View>
          </View>
        </View>

       
        <View style={[styles.section, styles.dangerZone]}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.dangerText}>
            Once you delete a property, there is no going back. Please be certain.
          </Text>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteListing}>
            <Feather name="trash-2" size={20} color="#ef4444" />
            <Text style={styles.deleteButtonText}>Delete Property</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  imageSection: {
    position: 'relative',
    height: 300,
  },
  listingImage: {
    width: screenWidth,
    height: 300,
  },
  imageIndicators: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    gap: 6,
  },
  imageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  imageIndicatorActive: {
    backgroundColor: 'white',
    width: 20,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listingName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 16,
  },
  listingPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  listingLocation: {
    fontSize: 16,
    color: '#666',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewsText: {
    fontSize: 14,
    color: '#666',
  },
  listingType: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickActions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    gap: 8,
  },
  analyticsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
    marginBottom: 8,
  },
  amenityText: {
    fontSize: 14,
    color: '#333',
  },
  performanceList: {
    gap: 12,
  },
  performanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  performanceLabel: {
    fontSize: 14,
    color: '#666',
  },
  performanceValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  activityText: {
    fontSize: 14,
    color: '#666',
  },
  dangerZone: {
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  dangerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 16,
  },
});
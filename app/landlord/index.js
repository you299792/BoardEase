import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { GlobalListingContext } from './_layout';
import MapView, { Marker } from 'react-native-maps';
import {
  getCurrentUser,
  getLandlordListings,
  getLandlordInquiries,
  deleteListing as deleteListingFromDB,
  supabase,
} from '../../lib/supabaseClient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/800x600?text=No+Image';

export default function LandlordPortal() {
  const { listings: contextListings, deleteListing } = useContext(GlobalListingContext);
  const [listings, setListings] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showListingOverlay, setShowListingOverlay] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [showAllReviewsModal, setShowAllReviewsModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showInquiriesModal, setShowInquiriesModal] = useState(false);

  // imagesToShow mirrors the selectedListing.images but lets us replace broken urls with a placeholder
  const [imagesToShow, setImagesToShow] = useState([]);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);

  const dims = useWindowDimensions();

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);

      if (user) {
        setIsLoadingListings(true);
        const { success, listings: dbListings, error } = await getLandlordListings(user.id);
        
        if (success) {
          setListings(dbListings || []);
        } else {
          Alert.alert('Error', error || 'Failed to load listings');
          setListings([]);
        }
      }
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setIsLoadingListings(false);
    }
  };

  const handleDeleteListing = (id) => {
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
            const { success, error } = await deleteListingFromDB(id);
            if (success) {
              setListings(listings.filter(l => l.id !== id));
              Alert.alert('Success', 'Property deleted successfully');
            } else {
              Alert.alert('Error', error || 'Failed to delete property');
            }
          },
          style: "destructive" 
        }
      ]
    );
  };

  const handleEditListing = (id) => {
    // Navigate to the create-listing screen with the listing ID to edit it
    router.push(`/landlord/create-listing?id=${id}`);
  };

  const handleShowListingOverlay = async (listing) => {
    console.log('Opening listing, images:', listing?.images);
    setSelectedListing(listing);
    setActiveImageIndex(0);
    setShowListingOverlay(true);
    // initialize imagesToShow with listing images or placeholder
    setImagesToShow((listing?.images && listing.images.length > 0) ? listing.images : [PLACEHOLDER_IMAGE]);
    await loadListingDetails(listing.id);
  };

  useEffect(() => {
    // When selectedListing changes, sync imagesToShow (keeps modal and overlay in sync)
    if (selectedListing) {
      setImagesToShow((selectedListing?.images && selectedListing.images.length > 0) ? selectedListing.images : [PLACEHOLDER_IMAGE]);
    } else {
      setImagesToShow([]);
    }
  }, [selectedListing]);

  const handleCloseListingOverlay = () => {
    setShowListingOverlay(false);
    setSelectedListing(null);
    setReviews([]);
    setInquiries([]);
    setImagesToShow([]);
  };

  const loadListingDetails = async (listingId) => {
    try {
      if (currentUser) {
        const { success, inquiries: dbInquiries, error } = await getLandlordInquiries(currentUser.id);
        
        if (success) {
          const listingInquiries = dbInquiries.filter(inq => inq.listing_id === listingId);
          setInquiries(listingInquiries);
          
          // Load reviews from selected listing
          if (selectedListing?.reviews) {
            setReviews(selectedListing.reviews);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load listing details', error);
    }
  };

  // Toggle availability: flips available <-> occupied for a listing
  const toggleAvailability = (listing) => {
    const isAvailable = listing.available !== undefined ? listing.available : (listing.status === 'available');
    const newAvailable = !isAvailable;

    const confirmMessage = newAvailable
      ? 'Mark this property as Available?'
      : 'Mark this property as Occupied?';

    Alert.alert(
      newAvailable ? 'Mark Available' : 'Mark Occupied',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newAvailable ? 'Mark Available' : 'Mark Occupied',
          onPress: async () => {
            try {
              setIsTogglingAvailability(true);
              const { data, error } = await supabase
                .from('listings')
                .update({
                  available: newAvailable,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', listing.id)
                .select()
                .single();

              if (error) {
                console.error('Toggle availability error:', error);
                Alert.alert('Error', error.message || 'Failed to update availability');
                return;
              }

              // Update local UI state
              setListings(prev => prev.map(l => l.id === listing.id ? { ...l, available: newAvailable } : l));
              if (selectedListing && selectedListing.id === listing.id) {
                setSelectedListing(prev => prev ? { ...prev, available: newAvailable } : prev);
              }

              Alert.alert('Success', `Property marked as ${newAvailable ? 'Available' : 'Occupied'}`);
            } catch (err) {
              console.error('Toggle availability exception:', err);
              Alert.alert('Error', err.message || 'Failed to update availability');
            } finally {
              setIsTogglingAvailability(false);
            }
          },
        },
      ]
    );
  };

  // Function to handle image scroll
  const handleImageScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / dims.width);
    setActiveImageIndex(index);
  };

  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  };

  const renderStars = (rating, size = 16) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  // Function to render individual review
  const renderReview = ({ item }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Image source={{ uri: item.userImage }} style={styles.reviewerImage} />
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{item.user}</Text>
          {renderStars(item.rating)}
        </View>
        <Text style={styles.reviewDate}>{item.date}</Text>
      </View>
      <Text style={styles.reviewComment}>{item.comment}</Text>
    </View>
  );

  // Function to render inquiry
  const renderInquiry = ({ item }) => (
    <View style={styles.inquiryCard}>
      <View style={styles.inquiryHeader}>
        <Image source={{ uri: item.tenant?.image }} style={styles.inquirerImage} />
        <View style={styles.inquirerInfo}>
          <Text style={styles.inquirerName}>{item.tenant?.name}</Text>
          <Text style={styles.inquiryType}>{item.type === 'booking' ? 'Booking Request' : 'General Inquiry'}</Text>
        </View>
        <Text style={styles.inquiryTime}>{item.time}</Text>
      </View>
      <Text style={styles.inquiryMessage}>{item.lastMessage}</Text>
      <View style={styles.inquiryActions}>
        <TouchableOpacity style={styles.replyButton}>
          <Ionicons name="chatbubble-ellipses" size={16} color="white" />
          <Text style={styles.replyButtonText}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.viewChatButton}>
          <Ionicons name="eye" size={16} color="#667eea" />
          <Text style={styles.viewChatButtonText}>View Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Function to render amenities
  const renderAmenities = (amenities) => {
    if (!amenities || amenities.length === 0) {
      return (
        <Text style={styles.noAmenitiesText}>No amenities listed</Text>
      );
    }

    return (
      <View style={styles.amenitiesGrid}>
        {amenities.map((amenity, index) => (
          <View key={index} style={styles.amenityItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.amenityText}>{amenity}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Function to render property statistics
  const renderPropertyStats = (listing) => {
    const stats = [
      { label: 'Views', value: '1.2K', icon: 'eye', color: '#667eea' },
      { label: 'Inquiries', value: inquiries.length, icon: 'chatbubble', color: '#10b981' },
      { label: 'Bookings', value: '8', icon: 'calendar', color: '#f59e0b' },
      { label: 'Occupancy', value: '89%', icon: 'home', color: '#8b5cf6' },
    ];

    return (
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
              <Ionicons name={stat.icon} size={20} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Function to render all reviews modal
  const renderAllReviewsModal = () => (
    <Modal
      visible={showAllReviewsModal}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.allReviewsModalOverlay}>
        <View style={styles.allReviewsModalContent}>
          <View style={styles.allReviewsHeader}>
            <Text style={styles.allReviewsTitle}>All Reviews</Text>
            <TouchableOpacity 
              style={styles.allReviewsCloseButton}
              onPress={() => setShowAllReviewsModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Reviews Summary */}
          <View style={styles.reviewsSummary}>
            <View style={styles.ratingOverview}>
              <Text style={styles.averageRating}>{calculateAverageRating()}</Text>
              {renderStars(parseFloat(calculateAverageRating()), 20)}
              <Text style={styles.totalReviews}>{reviews.length} reviews</Text>
            </View>
            
            {/* Rating Breakdown */}
            <View style={styles.ratingBreakdown}>
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = reviews.filter(r => r.rating === rating).length;
                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                
                return (
                  <View key={rating} style={styles.ratingRow}>
                    <Text style={styles.ratingLabel}>{rating} star</Text>
                    <View style={styles.ratingBarContainer}>
                      <View 
                        style={[
                          styles.ratingBar, 
                          { width: `${percentage}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.ratingCount}>({count})</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Reviews List */}
          <FlatList
            data={reviews}
            renderItem={renderReview}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.allReviewsList}
          />
        </View>
      </View>
    </Modal>
  );

  // Function to render inquiries modal
  const renderInquiriesModal = () => (
    <Modal
      visible={showInquiriesModal}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.inquiriesModalOverlay}>
        <View style={styles.inquiriesModalContent}>
          <View style={styles.inquiriesHeader}>
            <Text style={styles.inquiriesTitle}>Inquiries & Bookings</Text>
            <TouchableOpacity 
              style={styles.inquiriesCloseButton}
              onPress={() => setShowInquiriesModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.inquiriesSubtitle}>
            {inquiries.length} inquiries for {selectedListing?.name || selectedListing?.title}
          </Text>

          {/* Inquiries List */}
          <FlatList
            data={inquiries}
            renderItem={renderInquiry}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.inquiriesList}
            ListEmptyComponent={
              <View style={styles.noInquiries}>
                <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                <Text style={styles.noInquiriesText}>No inquiries yet</Text>
                <Text style={styles.noInquiriesSubtext}>You haven't received any inquiries for this property.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );

  // Function to render listing overlay
  const renderListingOverlay = () => {
    if (!selectedListing) return null;

    const isAvailable = selectedListing.available !== undefined ? selectedListing.available : (selectedListing.status === 'available');

    return (
      <Modal
        visible={showListingOverlay}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
      >
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            {/* Header */}
            <View style={styles.overlayHeader}>
              <Text style={styles.overlayTitle}>Property Management</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={handleCloseListingOverlay}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.overlayScrollView} showsVerticalScrollIndicator={false}>
              {/* Image Carousel */}
              {imagesToShow && imagesToShow.length > 0 && (
                <View style={styles.imageSection}>
                  <ScrollView
                    key={selectedListing?.id ?? 'images'}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleImageScroll}
                    scrollEventThrottle={16}
                  >
                    {imagesToShow.map((image, index) => (
                      <TouchableOpacity 
                        key={index}
                        onPress={() => {
                          setShowListingOverlay(false);
                          setTimeout(() => setShowImageModal(true), 300);
                        }}
                      >
                        <Image
                          source={{ uri: image || PLACEHOLDER_IMAGE }}
                          style={[styles.houseImage, { width: dims.width }]}
                          resizeMode="cover"
                          onError={() => {
                            // replace broken image with placeholder
                            const newImgs = [...imagesToShow];
                            newImgs[index] = PLACEHOLDER_IMAGE;
                            setImagesToShow(newImgs);
                          }}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  
                  {/* Image Indicators */}
                  {imagesToShow.length > 1 && (
                    <View style={styles.imageIndicators}>
                      {imagesToShow.map((_, index) => (
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
                </View>
              )}

              {/* Basic Info Section */}
              <View style={styles.section}>
                <View style={styles.titleSection}>
                  <Text style={styles.houseName}>{selectedListing.title}</Text>
                  <Text style={styles.housePrice}>₱{selectedListing.price?.toLocaleString()}/month</Text>
                </View>

                <View style={styles.locationSection}>
                  <Ionicons name="location" size={16} color="#666" />
                  <Text style={styles.locationText}>{selectedListing.city}</Text>
                </View>

                <View style={styles.ratingSection}>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={20} color="#FFD700" />
                    <Text style={styles.rating}>{calculateAverageRating()}</Text>
                    <Text style={styles.reviewsCount}>({reviews.length} reviews)</Text>
                  </View>
                  <Text style={styles.houseType}>{selectedListing.house_type}</Text>
                </View>
              </View>

              {/* Property Statistics */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Property Performance</Text>
                {renderPropertyStats(selectedListing)}
              </View>

              {/* Quick Actions - Landlord Focused */}
              <View style={styles.quickActions}>
                <TouchableOpacity 
                  style={styles.quickActionButton}
                  onPress={() => setShowInquiriesModal(true)}
                >
                  <Ionicons name="chatbubble-ellipses" size={20} color="#667eea" />
                  <Text style={styles.quickActionText}>Inquiries ({inquiries.length})</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickActionButton}
                  onPress={() => setShowAllReviewsModal(true)}
                >
                  <Ionicons name="star" size={20} color="#667eea" />
                  <Text style={styles.quickActionText}>Reviews ({reviews.length})</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickActionButton}
                  onPress={() => setShowMapModal(true)}
                >
                  <Ionicons name="map" size={20} color="#667eea" />
                  <Text style={styles.quickActionText}>Location</Text>
                </TouchableOpacity>
              </View>

              {/* Property Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Property Details</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Ionicons name="bed" size={20} color="#667eea" />
                    <Text style={styles.detailValue}>{selectedListing.bedrooms || 'N/A'}</Text>
                    <Text style={styles.detailLabel}>Bedrooms</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="water" size={20} color="#667eea" />
                    <Text style={styles.detailValue}>{selectedListing.bathrooms || 'N/A'}</Text>
                    <Text style={styles.detailLabel}>Bathrooms</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="people" size={20} color="#667eea" />
                    <Text style={styles.detailValue}>{selectedListing.capacity || 'N/A'}</Text>
                    <Text style={styles.detailLabel}>Capacity</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="expand" size={20} color="#667eea" />
                    <Text style={styles.detailValue}>{selectedListing.size || 'N/A'}</Text>
                    <Text style={styles.detailLabel}>Sq Ft</Text>
                  </View>
                </View>
              </View>

              {/* Availability Status */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Availability Status</Text>
                <View style={[
                  styles.availabilityBadge,
                  { backgroundColor: isAvailable ? '#10b98120' : '#ef444420' }
                ]}>
                  <Ionicons 
                    name={isAvailable ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={isAvailable ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={[
                    styles.availabilityText,
                    { color: isAvailable ? "#10b981" : "#ef4444" }
                  ]}>
                    {isAvailable ? 'Available for Rent' : 'Currently Occupied'}
                  </Text>
                </View>
                {selectedListing.availableFrom && (
                  <Text style={styles.availableFromText}>
                    Available from: {selectedListing.availableFrom}
                  </Text>
                )}
              </View>

              {/* Description */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{selectedListing.description}</Text>
              </View>

              {/* Amenities */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Amenities</Text>
                {renderAmenities(selectedListing.amenities)}
              </View>

              {/* Available From */}
              {selectedListing.available_from && (
                <View style={styles.section}>
                  <Text style={styles.availableFromText}>
                    Available from: {selectedListing.available_from}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Bottom Action Bar - minimal change:
                Stats and Edit are compact on the left; availability toggle is smaller and positioned to the right */}
            <View style={styles.bottomActionBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity 
                  style={[styles.smallButton, styles.statsButton]}
                  onPress={() => {
                    // View detailed statistics
                    Alert.alert('Statistics', 'Detailed analytics coming soon!');
                  }}
                >
                  <Ionicons name="analytics" size={14} color="white" />
                  <Text style={styles.smallButtonText}>Stats</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.smallButton, styles.editButtonSmall]}
                  onPress={() => {
                    handleCloseListingOverlay();
                    handleEditListing(selectedListing.id);
                  }}
                >
                  <Ionicons name="create" size={14} color="white" />
                  <Text style={styles.smallButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[
                  styles.toggleSmall, 
                  isAvailable ? styles.occupiedButton : styles.availableButton
                ]}
                onPress={() => toggleAvailability(selectedListing)}
                disabled={isTogglingAvailability}
              >
                {isTogglingAvailability ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name={isAvailable ? "close-circle" : "checkmark-circle"} size={16} color="white" />
                    <Text style={[styles.smallToggleText, { marginLeft: 8 }]}>{isAvailable ? 'Occupied' : 'Available'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Map Modal
  const renderMapModal = () => (
    <Modal
      visible={showMapModal}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.mapModalOverlay}>
        <View style={styles.mapModalContent}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>Property Location</Text>
            <TouchableOpacity 
              style={styles.mapModalCloseButton}
              onPress={() => setShowMapModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {selectedListing?.locationData && (
            <MapView
              style={styles.fullMap}
              region={{
                latitude: selectedListing.locationData.latitude,
                longitude: selectedListing.locationData.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              <Marker
                coordinate={{
                  latitude: selectedListing.locationData.latitude,
                  longitude: selectedListing.locationData.longitude,
                }}
                title={selectedListing.name || selectedListing.title}
                description={selectedListing.location}
                pinColor="#667eea"
              />
            </MapView>
          )}
        </View>
      </View>
    </Modal>
  );

  // Image Modal
  const renderImageModal = () => (
    <Modal
      visible={showImageModal}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.imageModalOverlay}>
        <TouchableOpacity 
          style={styles.imageModalCloseButton}
          onPress={() => {
            setShowImageModal(false);
            setTimeout(() => setShowListingOverlay(true), 300);
          }}
        >
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleImageScroll}
          scrollEventThrottle={16}
          style={styles.imageModalScrollView}
        >
          {(imagesToShow || []).map((image, index) => (
            <View key={index} style={styles.fullScreenImageContainer}>
              <Image
                source={{ uri: image || PLACEHOLDER_IMAGE }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={() => {
                  const newImgs = [...imagesToShow];
                  newImgs[index] = PLACEHOLDER_IMAGE;
                  setImagesToShow(newImgs);
                }}
              />
            </View>
          ))}
        </ScrollView>
        
        {/* Image counter */}
        <View style={styles.imageCounter}>
          <Text style={styles.imageCounterText}>
            {activeImageIndex + 1} / {imagesToShow?.length || 0}
          </Text>
        </View>
      </View>
    </Modal>
  );

  const previewListings = isLoadingListings ? [] : listings;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Landlord Dashboard</Text>
          <Text style={styles.subtitle}>Manage your properties and track performance</Text>
        </View>

        {isLoadingListings && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {!isLoadingListings && listings.length > 0 && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Feather name="home" size={22} color={Colors.primary} />
                <Text style={styles.statValue}>{listings.length}</Text>
                <Text style={styles.statLabel}>Properties</Text>
              </View>
              <View style={styles.statCard}>
                <Feather name="message-square" size={22} color={Colors.primary} />
                <Text style={styles.statValue}>{inquiries.length}</Text>
                <Text style={styles.statLabel}>Inquiries</Text>
              </View>
              <View style={styles.statCard}>
                <Feather name="dollar-sign" size={22} color={Colors.primary} />
                <Text style={styles.statValue}>--</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Properties</Text>
            </View>

            <View style={styles.listingsRow}>
              {previewListings.map((listing) => {
                const isAvailable = listing.available !== undefined ? listing.available : (listing.status === 'available');

                return (
                  <View key={listing.id} style={styles.card}>
                    <TouchableOpacity 
                      style={styles.cardClickable}
                      onPress={() => handleShowListingOverlay(listing)}
                    >
                      <Image source={{ uri: listing.images?.[0] || PLACEHOLDER_IMAGE }} style={styles.cardImage} />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
                        <Text style={styles.cardSub} numberOfLines={1}>{listing.city}</Text>
                        <Text style={styles.cardPrice}>₱{listing.price?.toLocaleString()}/month</Text>
                        <View style={styles.statusContainer}>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: isAvailable ? '#10b98120' : '#ef444420' }
                          ]}>
                            <Text style={[
                              styles.statusText,
                              { color: isAvailable ? '#10b981' : '#ef4444' }
                            ]}>
                              {isAvailable ? 'Available' : 'Occupied'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.editButton} onPress={() => handleEditListing(listing.id)}>
                        <Feather name="edit" size={20} color={Colors.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.deleteButton, { marginBottom: 8 }]} onPress={() => handleDeleteListing(listing.id)}>
                        <Feather name="trash-2" size={20} color="#ef4444" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.toggleButton}
                        onPress={() => toggleAvailability(listing)}
                      >
                        <Ionicons name={isAvailable ? "close-circle" : "checkmark-circle"} size={20} color={isAvailable ? "#ef4444" : "#10b981"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              
              {listings.length === 0 && (
                <View style={styles.emptyState}>
                  <Feather name="home" size={48} color="#ccc" />
                  <Text style={styles.emptyStateTitle}>No Properties Listed</Text>
                  <Text style={styles.emptyStateText}>
                    Start by creating your first property listing to begin renting.
                  </Text>
                </View>
              )}
            </View>

            <View style={{ height: 40 }} />
          </>
        )}

        {!isLoadingListings && listings.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="home" size={48} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Properties Listed</Text>
            <Text style={styles.emptyStateText}>
              Start by creating your first property listing to begin renting.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Listing Overlay */}
      {renderListingOverlay()}

      {/* All Reviews Modal */}
      {renderAllReviewsModal()}

      {/* Inquiries Modal */}
      {renderInquiriesModal()}

      {/* Map Modal */}
      {renderMapModal()}

      {/* Image Modal */}
      {renderImageModal()}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/landlord/create-listing')}
      >
        <Feather name="plus" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f6f7fb' },
  container: { padding: 16 },
  header: { 
    marginBottom: 24, 
    paddingTop: 30
  },
  title: { 
    fontSize: 26, 
    fontWeight: 'bold', 
    color: '#1a202c' 
  },
  subtitle: { color: '#666', marginTop: 4, fontSize: 16 },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 24,
    gap: 12,
  },
  statCard: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 16, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 2,
    alignItems: 'center',
    gap: 8,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: Colors.primary },
  statLabel: { color: '#666', fontSize: 12, fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a202c' },
  seeAllText: { 
    color: Colors.primary, 
    fontWeight: '600',
    fontSize: 14,
  },
  listingsRow: { },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginBottom: 16,
    flexDirection: 'row',
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 2,
  },
  cardClickable: {
    flexDirection: 'row',
    flex: 1,
  },
  cardImage: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#f0f0f0' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a202c' },
  cardSub: { color: '#777', marginTop: 4, fontSize: 12 },
  cardPrice: { marginTop: 4, color: Colors.primary, fontWeight: 'bold', fontSize: 16 },
  statusContainer: {
    marginTop: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    justifyContent: 'space-around', 
    paddingHorizontal: 12,
    borderLeftWidth: 1, 
    borderColor: '#f0f0f0',
  },
  editButton: {
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteButton: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
  },
  toggleButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  // Overlay Styles - Landlord Focused
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  overlayContent: {
    flex: 1,
    backgroundColor: 'white',
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  overlayScrollView: {
    flex: 1,
  },
  // Image Section
  imageSection: {
    position: 'relative',
  },
  houseImage: {
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
  // Section Styles
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  houseName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 16,
  },
  housePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  ratingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewsCount: {
    fontSize: 14,
    color: '#666',
  },
  houseType: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '500',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  // Property Statistics
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  // Quick Actions - Landlord Focused
  quickActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  quickActionText: {
    marginTop: 4,
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Property Details Grid
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  detailItem: {
    alignItems: 'center',
    width: '22%',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Availability Badge
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  availabilityText: {
    fontSize: 16,
    fontWeight: '600',
  },
  availableFromText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginLeft: 28,
  },
  // Description
  descriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  // Amenities
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
    marginBottom: 12,
  },
  amenityText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  noAmenitiesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  // Reviews
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllReviews: {
    color: '#667eea',
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Bottom Action Bar - Landlord Focused
  bottomActionBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // small compact button used for Stats and Edit
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    minWidth: 64,
  },
  smallButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsButton: {
    backgroundColor: '#8b5cf6',
  },
  editButtonSmall: {
    backgroundColor: '#667eea',
    marginLeft: 8,
  },
  // compact toggle placed on the right
  toggleSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    minWidth: 110,
  },
  smallToggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inquiriesButton: {
    backgroundColor: '#10b981',
  },
  // Buttons for availability toggles
  availableButton: {
    backgroundColor: '#10b981',
  },
  occupiedButton: {
    backgroundColor: '#ef4444',
  },
  // Star Container
  starContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  // All Reviews Modal Styles
  allReviewsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  allReviewsModalContent: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  allReviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  allReviewsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  allReviewsCloseButton: {
    padding: 4,
  },
  reviewsSummary: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  ratingOverview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  averageRating: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  totalReviews: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  ratingBreakdown: {
    width: '100%',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingLabel: {
    width: 60,
    fontSize: 14,
    color: '#666',
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  ratingBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  ratingCount: {
    width: 40,
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  allReviewsList: {
    flex: 1,
    padding: 20,
  },
  // Inquiries Modal Styles
  inquiriesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  inquiriesModalContent: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  inquiriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  inquiriesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inquiriesCloseButton: {
    padding: 4,
  },
  inquiriesSubtitle: {
    fontSize: 16,
    color: '#666',
    padding: 20,
    paddingBottom: 0,
  },
  inquiriesList: {
    flex: 1,
    padding: 20,
  },
  inquiryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  inquiryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inquirerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  inquirerInfo: {
    flex: 1,
  },
  inquirerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  inquiryType: {
    fontSize: 12,
    color: '#666',
  },
  inquiryTime: {
    fontSize: 12,
    color: '#999',
  },
  inquiryMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  inquiryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  replyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  viewChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewChatButtonText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
  },
  noInquiries: {
    alignItems: 'center',
    padding: 40,
  },
  noInquiriesText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noInquiriesSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Map Modal Styles
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  mapModalContent: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  mapModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mapModalCloseButton: {
    padding: 4,
  },
  fullMap: {
    flex: 1,
    width: '100%',
  },
  // Image Modal Styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalScrollView: {
    flex: 1,
    width: screenWidth,
  },
  fullScreenImageContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  imageCounter: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
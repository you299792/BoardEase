import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Linking,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabaseClient';
import {
  getCurrentUser,
  getListing,
  createReview,
  getTenantProfile,
  toggleFavorite,
  createBooking,
  sendInterestMessage,
  sendMessage,
  createConversation,
  getListingReviews,
} from '../../lib/supabaseClient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// AsyncStorage Keys for local messages (temporary local storage until synced with database)
const TENANT_MESSAGES_KEY = '@tenant_messages';
const LANDLORD_INQUIRIES_KEY = '@landlord_inquiries';

export default function BoardingHouseDetails() {
  const { id } = useLocalSearchParams();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAllReviewsModal, setShowAllReviewsModal] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingGuests, setBookingGuests] = useState('1');
  const [reviews, setReviews] = useState([]);
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [house, setHouse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantProfileId, setTenantProfileId] = useState(null);
  const scrollViewRef = useRef(null);
  const imageScrollViewRef = useRef(null);

  // Safe house data access with fallbacks
  const getHouseImages = () => house?.images || [];
  const getHouseLocation = () => house?.city || 'Location not available';
  const getHousePrice = () => house?.price_per_month || '0';
  const getHouseName = () => house?.title || 'Unknown Property';
  const getHouseType = () => house?.room_type || 'Boarding House';
  const getHouseDescription = () => house?.description || 'No description available.';
  const getHouseAmenities = () => house?.amenities || [];
  const getHouseRules = () => house?.rules_regulations || [];
  const getHouseDistance = () => house?.distance || '';
  const getHouseRating = () => house?.rating || 0;
  const getHouseReviewsCount = () => house?.total_reviews || 0;
  const getHouseAvailable = () => house?.available !== undefined ? house.available : true;
  const getHouseAvailableFrom = () => house?.available_from || '';
  const getHouseLocationData = () => ({
    latitude: house?.latitude,
    longitude: house?.longitude,
  });

  const getLandlord = () => house?.landlord_profile?.users || {
    id: 'unknown',
    first_name: 'Unknown',
    last_name: 'Landlord',
    phone: 'Not available',
    email: 'Not available',
    profile_image_url: '',
  };

  useEffect(() => {
    loadHouseDetails();
  }, [id]);

  // Load reviews when house loads
  useEffect(() => {
    if (house) {
      checkIfFavorite();
      loadReviews();
    }
  }, [house]);

  // Recheck favorites when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (house) {
        checkIfFavorite();
        loadReviews();
      }
    }, [house])
  );

  const loadHouseDetails = async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
        const { profile } = await getTenantProfile(user.id);
        if (profile?.id) {
          setTenantProfileId(profile.id);
        }
      }

      // Fetch listing details from Supabase
      const { success, listing, error } = await getListing(id);

      if (success && listing) {
        // Transform Supabase data to match component expectations
        const transformedListing = {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          images: listing.images || [],
          city: listing.city,
          price_per_month: listing.price_per_month,
          room_type: listing.room_type,
          rating: listing.rating,
          total_reviews: listing.total_reviews,
          amenities: listing.amenities || [],
          rules_regulations: listing.rules_regulations || [],
          available: listing.available,
          latitude: listing.latitude,
          longitude: listing.longitude,
          address: listing.address,
          max_guests: listing.max_guests,
          landlord_profile: listing.landlord_profile,
        };
        setHouse(transformedListing);
      } else {
        Alert.alert('Error', error || 'Failed to load listing details');
      }
    } catch (error) {
      console.error('Failed to load house details', error);
      Alert.alert('Error', 'Failed to load listing details');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to load reviews
  const loadReviews = async () => {
    try {
      if (!house) return;

      // Fetch reviews for this listing
      const { success, reviews: reviewsData } = await getListingReviews(house.id);

      if (success && reviewsData) {
        setReviews(reviewsData);
      }
    } catch (error) {
      console.error('Failed to load reviews', error);
    }
  };

  // Function to check favorite status
  const checkIfFavorite = async () => {
    try {
      if (!tenantProfileId || !house) return;

      // Check if listing is in tenant's favorites by trying to fetch favorites
      // This is a simple check - in real implementation would query database
      setIsFavorite(false); // Default to not favorite
    } catch (error) {
      console.error('Failed to check favorite status', error);
    }
  };

  // Toggle favorite function
  const toggleFavoriteHandler = async () => {
    try {
      if (!tenantProfileId || !house) return;

      const result = await toggleFavorite(tenantProfileId, house.id, isFavorite);

      if (result.success) {
        setIsFavorite(!isFavorite);
        if (!isFavorite) {
          Alert.alert('Added to Favorites', `${getHouseName()} has been added to your favorites!`);
        } else {
          Alert.alert('Removed from Favorites', `${getHouseName()} has been removed from your favorites.`);
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to update favorites');
      }
    } catch (error) {
      console.error('Failed to toggle favorite', error);
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
    }
  };

  // Function to submit review
  const submitReview = async () => {
    if (userRating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting your review.');
      return;
    }

    if (userReview.trim().length < 10) {
      Alert.alert('Review Too Short', 'Please write a more detailed review (at least 10 characters).');
      return;
    }

    try {
      if (!currentUser) {
        Alert.alert('Error', 'User not logged in');
        return;
      }

      const reviewData = {
        reviewedItemType: 'listing',
        reviewedItemId: house.id,
        reviewerId: currentUser.id,
        bookingId: null,
        rating: userRating,
        title: `Review of ${getHouseName()}`,
        reviewText: userReview,
      };

      const { success, error } = await createReview(reviewData);

      if (success) {
        // Update local state
        setUserRating(0);
        setUserReview('');
        setShowAddReviewModal(false);

        Alert.alert('Review Submitted', 'Thank you for your review!');
        // Reload reviews
        loadReviews();
      } else {
        Alert.alert('Error', error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Failed to submit review', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    }
  };

  // Function to open image modal
  const openImageModal = (index = 0) => {
    setActiveImageIndex(index);
    setShowImageModal(true);
  };

  // Function to handle image scroll in modal
  const handleModalImageScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setActiveImageIndex(index);
  };

  // Function to navigate to specific image in modal
  const navigateToImage = (index) => {
    setActiveImageIndex(index);
    if (imageScrollViewRef.current) {
      imageScrollViewRef.current.scrollTo({ x: index * screenWidth, animated: true });
    }
  };

  // Function to open map modal
  const openMapModal = () => {
    setShowMapModal(true);
  };

  // Function to open in Google Maps
  const openInGoogleMaps = () => {
    const locationData = getHouseLocationData();
    if (locationData) {
      const { latitude, longitude } = locationData;
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(url).catch(err => 
        Alert.alert('Error', 'Could not open Google Maps')
      );
    } else {
      // Fallback: Use the address for Google Maps search
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getHouseLocation())}`;
      Linking.openURL(url).catch(err => 
        Alert.alert('Error', 'Could not open Google Maps')
      );
    }
  };

  // Function to get directions
  const getDirections = () => {
    const locationData = getHouseLocationData();
    if (locationData) {
      const { latitude, longitude } = locationData;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      Linking.openURL(url).catch(err => 
        Alert.alert('Error', 'Could not open Google Maps for directions')
      );
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getHouseLocation())}`;
      Linking.openURL(url).catch(err => 
        Alert.alert('Error', 'Could not open Google Maps for directions')
      );
    }
  };

  // Function to calculate average rating
  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  };

  // Function to render star rating
  const renderStars = (rating, size = 16, onPress = null) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onPress && onPress(star)}
            disabled={!onPress}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={size}
              color="#FFD700"
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Function to render individual review
  const renderReview = ({ item }) => {
    const reviewerName = item.users ? `${item.users.first_name || ''} ${item.users.last_name || ''}`.trim() : 'Anonymous';
    const reviewerImage = item.users?.profile_image_url || 'https://via.placeholder.com/40?text=User';
    const reviewDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A';
    
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Image source={{ uri: reviewerImage }} style={styles.reviewerImage} />
          <View style={styles.reviewerInfo}>
            <Text style={styles.reviewerName}>{reviewerName}</Text>
            {renderStars(item.rating)}
          </View>
          <Text style={styles.reviewDate}>{reviewDate}</Text>
        </View>
        <Text style={styles.reviewTitle}>{item.title}</Text>
        <Text style={styles.reviewComment}>{item.review_text}</Text>
        {item.is_verified_booking && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
            <Text style={styles.verifiedText}>Verified Booking</Text>
          </View>
        )}
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
          
          {/* Add Review Button */}
          <TouchableOpacity 
            style={styles.addReviewFloatingButton}
            onPress={() => {
              setShowAllReviewsModal(false);
              setShowAddReviewModal(true);
            }}
          >
            <Ionicons name="pencil" size={20} color="white" />
            <Text style={styles.addReviewFloatingText}>Write a Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Function to render add review modal
  const renderAddReviewModal = () => (
    <Modal
      visible={showAddReviewModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Write a Review</Text>
          <Text style={styles.modalSubtitle}>
            Share your experience at {getHouseName()}
          </Text>
          
          {/* Rating Selection */}
          <View style={styles.ratingSelection}>
            <Text style={styles.ratingLabel}>Your Rating</Text>
            <View style={styles.starRatingContainer}>
              {renderStars(userRating, 32, setUserRating)}
            </View>
          </View>
          
          {/* Review Text Input */}
          <TextInput
            style={styles.reviewTextInput}
            multiline
            numberOfLines={6}
            placeholder="Share details of your own experience at this property..."
            value={userReview}
            onChangeText={setUserReview}
            textAlignVertical="top"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowAddReviewModal(false);
                setUserRating(0);
                setUserReview('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.submitButton]}
              onPress={submitReview}
            >
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Existing functions with safe property access
  const handleCallLandlord = () => {
    const landlord = getLandlord();
    Linking.openURL(`tel:${landlord.phone}`);
  };

  const handleMessageLandlord = () => {
    const landlord = getLandlord();
    const contactKey = (c) => (c?.id || c?.email || c?.phone || c?.name || '').toString();
    router.push({
      pathname: '/(tenant)/chat',
      params: { 
        landlordId: contactKey(landlord),
        landlordName: landlord.name,
        landlordImage: landlord.image,
        houseName: getHouseName(),
      }
    });
  };

  const handleImageScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setActiveImageIndex(index);
  };

  const handleShare = async () => {
    try {
      const shareMessage = `Check out ${getHouseName()} - ₱${getHousePrice()}/month at ${getHouseLocation()}. ${getHouseDescription().substring(0, 100)}...`;
      Alert.alert('Share', shareMessage);
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleExpressInterest = () => {
    setShowInquiryModal(true);
  };

  const handleReadyToBook = () => {
    setShowBookingModal(true);
  };

  const submitInquiry = () => {
    const landlord = getLandlord();
    const messageText = inquiryMessage || `I'm interested in ${getHouseName()}. Can you provide more details?`;

    if (!tenantProfileId || !house?.landlord_profile?.id) {
      Alert.alert('Error', 'Unable to send inquiry. Missing profile information.');
      return;
    }

    setIsLoading(true);

    (async () => {
      try {
        // Send interest message which creates conversation and inquiry
        const { success, conversationId, error } = await sendInterestMessage(
          tenantProfileId,
          house.landlord_profile.id,
          house.id,
          messageText
        );

        if (!success || !conversationId) {
          throw new Error(error || 'Failed to create conversation');
        }

        Alert.alert('Inquiry Sent!', `Your interest in ${getHouseName()} has been sent to ${landlord.first_name || landlord.name}.`);
        setShowInquiryModal(false);
        setInquiryMessage('');

        router.push({
          pathname: '/(tenant)/chat',
          params: {
            conversationId: conversationId,
            landlordId: landlord.id,
            landlordEmail: landlord.email,
            landlordPhone: landlord.phone,
            landlordName: `${landlord.first_name || ''} ${landlord.last_name || ''}`.trim(),
            landlordImage: landlord.profile_image_url,
            houseName: getHouseName(),
          }
        });
      } catch (e) {
        console.error('Failed to send inquiry', e);
        Alert.alert('Error', e.message || 'Failed to send inquiry. Please try again.');
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const submitBooking = async () => {
    const landlord = getLandlord();
    const messageText = `I'd like to book ${getHouseName()} on ${bookingDate || 'N/A'} for ${bookingGuests} guest(s). Please confirm availability.`;

    try {
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      if (!tenantProfileId || !house?.landlord_profile?.id) {
        Alert.alert('Error', 'Missing tenant or landlord profile information');
        return;
      }

      // Use createConversation helper like sendInterestMessage does
      const { success: convSuccess, conversation, error: convError } = await createConversation(
        tenantProfileId,
        house.landlord_profile.id,
        house.id
      );

      if (!convSuccess || !conversation) {
        Alert.alert('Error', convError || 'Failed to create conversation');
        return;
      }

      const conversationId = conversation.id;

      // Send the booking message
      const { success, error } = await sendMessage(
        conversationId,
        currentUser.id,
        messageText,
        null // no image for booking message
      );

      if (!success) {
        Alert.alert('Error', error || 'Failed to send booking request');
        return;
      }

      Alert.alert('Booking Request Sent!', `Your booking request for ${getHouseName()} has been sent to ${landlord.first_name || landlord.name}.`);
      setShowBookingModal(false);
      setBookingDate('');
      setBookingGuests('1');

      router.push({
        pathname: '/(tenant)/chat',
        params: {
          conversationId: conversationId,
          landlordId: landlord.id,
          landlordEmail: landlord.email,
          landlordPhone: landlord.phone,
          landlordName: `${landlord.first_name || ''} ${landlord.last_name || ''}`.trim(),
          landlordImage: landlord.profile_image_url,
          houseName: getHouseName(),
        }
      });
    } catch (e) {
      console.error('Failed to send booking request', e);
      Alert.alert('Error', 'Failed to send booking request. Please try again.');
    }
  };

  const handleViewLandlordProfile = () => {
    const landlord = getLandlord();
    const contactKey = (c) => (c?.id || c?.email || c?.phone || c?.name || '').toString();
    router.push({
      pathname: '/(tenant)/landlord-profile',
      params: { landlordId: contactKey(landlord) }
    });
  };

  const handleViewFavorites = () => {
    router.push('/(tenant)/favorites');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!house) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={{fontSize: 18, color: '#666'}}>House not found</Text>
          <Text style={{fontSize: 14, color: '#999', marginTop: 8}}>The listing may have been removed.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.favoritesHeaderButton}
            onPress={handleViewFavorites}
          >
            <Ionicons name="heart" size={24} color="#ef4444" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Image Section */}
        <View style={styles.imageSection}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleImageScroll}
            scrollEventThrottle={16}
          >
            {getHouseImages().map((image, index) => (
              <TouchableOpacity 
                key={index}
                activeOpacity={0.9}
                onPress={() => openImageModal(index)}
              >
                <Image
                  source={{ uri: image }}
                  style={styles.houseImage}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Image Indicators */}
          {getHouseImages().length > 1 && (
            <View style={styles.imageIndicators}>
              {getHouseImages().map((_, index) => (
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

          {/* Favorite Button */}
          <TouchableOpacity 
            style={[
              styles.favoriteButton,
              isFavorite && styles.favoriteButtonActive
            ]}
            onPress={toggleFavoriteHandler}
          >
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={24} 
              color={isFavorite ? "#ef4444" : "white"} 
            />
          </TouchableOpacity>
        </View>

        {/* Basic Info Section */}
        <View style={styles.section}>
          <View style={styles.titleSection}>
            <Text style={styles.houseName}>{getHouseName()}</Text>
            <Text style={styles.housePrice}>₱{getHousePrice()}/month</Text>
          </View>

          <View style={styles.locationSection}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={styles.locationText}>{getHouseLocation()}</Text>
            <Text style={styles.distanceText}>{getHouseDistance()}</Text>
          </View>

          <View style={styles.ratingSection}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.rating}>{calculateAverageRating()}</Text>
              <Text style={styles.reviewsCount}>({reviews.length} reviews)</Text>
            </View>
            <Text style={styles.houseType}>{getHouseType()}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={handleExpressInterest}
          >
            <Ionicons name="heart-outline" size={20} color="#667eea" />
            <Text style={styles.quickActionText}>Interested</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={handleReadyToBook}
          >
            <Ionicons name="calendar-outline" size={20} color="#667eea" />
            <Text style={styles.quickActionText}>Book Now</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => setShowAddReviewModal(true)}
          >
            <Ionicons name="star-outline" size={20} color="#667eea" />
            <Text style={styles.quickActionText}>Rate</Text>
          </TouchableOpacity>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={20} color="#667eea" />
              <View style={styles.locationDetails}>
                <Text style={styles.locationAddress}>{getHouseLocation()}</Text>
                {getHouseLocationData() && (
                  <Text style={styles.locationCoordinates}>
                    {getHouseLocationData().latitude.toFixed(6)}, {getHouseLocationData().longitude.toFixed(6)}
                  </Text>
                )}
              </View>
            </View>
            
            {/* Mini Map Preview */}
            {getHouseLocationData() && (
              <TouchableOpacity style={styles.mapPreview} onPress={openMapModal}>
                <MapView
                  style={styles.miniMap}
                  region={{
                    latitude: getHouseLocationData().latitude,
                    longitude: getHouseLocationData().longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: getHouseLocationData().latitude,
                      longitude: getHouseLocationData().longitude,
                    }}
                    title={getHouseName()}
                    pinColor="#667eea"
                  />
                </MapView>
                <View style={styles.mapOverlay}>
                  <Text style={styles.mapPreviewText}>Tap to view full map</Text>
                </View>
              </TouchableOpacity>
            )}
            
            <View style={styles.locationActions}>
              <TouchableOpacity style={styles.locationActionButton} onPress={openMapModal}>
                <Ionicons name="map" size={16} color="#667eea" />
                <Text style={styles.locationActionText}>View Map</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.locationActionButton} onPress={getDirections}>
                <Ionicons name="navigate" size={16} color="#10b981" />
                <Text style={styles.locationActionText}>Directions</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.locationActionButton} onPress={openInGoogleMaps}>
                <Ionicons name="open" size={16} color="#f59e0b" />
                <Text style={styles.locationActionText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Landlord Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Landlord Information</Text>
          <View style={styles.landlordCard}>
            <View style={styles.landlordInfo}>
              <Ionicons 
                name={getLandlord().verified ? "checkmark-circle" : "person-circle"} 
                size={40} 
                color={getLandlord().verified ? "#10b981" : "#667eea"} 
              />
              <View style={styles.landlordDetails}>
                <Text style={styles.landlordName}>{getLandlord().name}</Text>
                <Text style={styles.landlordPhone}>{getLandlord().phone}</Text>
                <Text style={styles.landlordEmail}>{getLandlord().email}</Text>
                <View style={styles.verificationBadge}>
                  <Ionicons 
                    name={getLandlord().verified ? "shield-checkmark" : "time"} 
                    size={14} 
                    color={getLandlord().verified ? "#10b981" : "#666"} 
                  />
                  <Text style={[
                    styles.verificationText,
                    { color: getLandlord().verified ? "#10b981" : "#666" }
                  ]}>
                    {getLandlord().verified ? 'Verified Landlord' : 'Pending Verification'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.landlordActions}>
              <TouchableOpacity 
                style={styles.messageLandlordButton}
                onPress={handleMessageLandlord}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#667eea" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.viewProfileButton}
                onPress={handleViewLandlordProfile}
              >
                <Text style={styles.viewProfileText}>View Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{getHouseDescription()}</Text>
        </View>

        {/* Amenities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {getHouseAmenities().map((amenity, index) => (
              <View key={index} style={styles.amenityItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* House Rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>House Rules</Text>
          <View style={styles.rulesList}>
            {getHouseRules().map((rule, index) => (
              <View key={index} style={styles.ruleItem}>
                <Ionicons name="information-circle" size={18} color="#667eea" />
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.availabilityInfo}>
            <Ionicons name="calendar" size={20} color="#10b981" />
            <Text style={styles.availabilityText}>
              {getHouseAvailable() ? 'Available Now' : 'Currently Occupied'}
            </Text>
          </View>
          {getHouseAvailableFrom() && (
            <Text style={styles.availableFromText}>
              Available from: {getHouseAvailableFrom()}
            </Text>
          )}
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <TouchableOpacity onPress={() => setShowAllReviewsModal(true)}>
              <Text style={styles.seeAllReviews}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {reviews.length > 0 ? (
            <FlatList
              data={reviews.slice(0, 2)}
              renderItem={renderReview}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noReviews}>
              <Ionicons name="star-outline" size={48} color="#ccc" />
              <Text style={styles.noReviewsText}>No reviews yet</Text>
              <Text style={styles.noReviewsSubtext}>Be the first to review this property</Text>
              <TouchableOpacity 
                style={styles.addFirstReviewButton}
                onPress={() => setShowAddReviewModal(true)}
              >
                <Text style={styles.addFirstReviewText}>Write First Review</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          
          <ScrollView
            ref={imageScrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleModalImageScroll}
            scrollEventThrottle={16}
            style={styles.imageModalScrollView}
          >
            {getHouseImages().map((image, index) => (
              <View key={index} style={styles.fullScreenImageContainer}>
                <Image
                  source={{ uri: image }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
          
          {/* Image counter */}
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {activeImageIndex + 1} / {getHouseImages().length}
            </Text>
          </View>

          {/* Thumbnail preview */}
          {getHouseImages().length > 1 && (
            <View style={styles.thumbnailContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailScrollView}>
                {getHouseImages().map((image, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.thumbnail,
                      index === activeImageIndex && styles.thumbnailActive
                    ]}
                    onPress={() => navigateToImage(index)}
                  >
                    <Image
                      source={{ uri: image }}
                      style={styles.thumbnailImage}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Full Screen Map Modal */}
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
            
            {getHouseLocationData() && (
              <MapView
                style={styles.fullMap}
                region={{
                  latitude: getHouseLocationData().latitude,
                  longitude: getHouseLocationData().longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                showsUserLocation={true}
                showsMyLocationButton={true}
              >
                <Marker
                  coordinate={{
                    latitude: getHouseLocationData().latitude,
                    longitude: getHouseLocationData().longitude,
                  }}
                  title={getHouseName()}
                  description={getHouseLocation()}
                  pinColor="#667eea"
                />
              </MapView>
            )}
            
            <View style={styles.mapModalActions}>
              <TouchableOpacity style={styles.mapActionButton} onPress={getDirections}>
                <Ionicons name="navigate" size={20} color="white" />
                <Text style={styles.mapActionText}>Get Directions</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mapActionButton} onPress={openInGoogleMaps}>
                <Ionicons name="open" size={20} color="white" />
                <Text style={styles.mapActionText}>Open in Google Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* All Reviews Modal */}
      {renderAllReviewsModal()}

      {/* Add Review Modal */}
      {renderAddReviewModal()}

      {/* Inquiry Modal */}
      <Modal
        visible={showInquiryModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Express Interest</Text>
            <Text style={styles.modalSubtitle}>
              Send a message to {getLandlord().name} about {getHouseName()}
            </Text>
            
            <TextInput
              style={styles.messageInput}
              multiline
              numberOfLines={4}
              placeholder="Tell the landlord why you're interested... (optional)"
              value={inquiryMessage}
              onChangeText={setInquiryMessage}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowInquiryModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitInquiry}
              >
                <Text style={styles.submitButtonText}>Send Interest</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Booking Modal */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ready to Book</Text>
            <Text style={styles.modalSubtitle}>
              Send booking request for {getHouseName()}
            </Text>
            
            <View style={styles.priceSection}>
              <Text style={styles.priceLabel}>Monthly Rate:</Text>
              <Text style={styles.priceValue}>₱{getHousePrice()}/month</Text>
            </View>
            
            <View style={styles.bookingForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Preferred Move-in Date</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  value={bookingDate}
                  onChangeText={setBookingDate}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Number of Guests</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="1"
                  keyboardType="numeric"
                  value={bookingGuests}
                  onChangeText={setBookingGuests}
                />
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowBookingModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitBooking}
              >
                <Text style={styles.submitButtonText}>Request Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Action Bar */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity 
          style={styles.callButton}
          onPress={handleCallLandlord}
        >
          <Ionicons name="call" size={20} color="#667eea" />
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.interestButton}
          onPress={handleExpressInterest}
        >
          <Ionicons name="heart-outline" size={20} color="white" />
          <Text style={styles.interestButtonText}>Interested</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.bookButton}
          onPress={handleReadyToBook}
        >
          <Ionicons name="calendar" size={20} color="white" />
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ... (keep all the same styles from the previous code)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  header: {
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoritesHeaderButton: {
    padding: 8,
    marginRight: 8,
  },
  shareButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    position: 'relative',
  },
  houseImage: {
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
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
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
  distanceText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starRatingContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
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
  addReviewFloatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addReviewFloatingText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  ratingSelection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  reviewTextInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  noReviews: {
    alignItems: 'center',
    padding: 40,
  },
  noReviewsText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  addFirstReviewButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstReviewText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  locationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  locationDetails: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationCoordinates: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  mapPreview: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  miniMap: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPreviewText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  locationActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  locationActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    flex: 1,
    justifyContent: 'center',
  },
  locationActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  landlordCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  landlordInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  landlordDetails: {
    flex: 1,
  },
  landlordName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  landlordPhone: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  landlordEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  landlordActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  messageLandlordButton: {
    padding: 10,
    backgroundColor: '#e0e7ff',
    borderRadius: 20,
  },
  viewProfileButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  viewProfileText: {
    color: 'white',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
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
    marginBottom: 12,
  },
  amenityText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  rulesList: {
    gap: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  ruleText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    lineHeight: 22,
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  availabilityText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  availableFromText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 28,
  },
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
  thumbnailContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  thumbnailScrollView: {
    maxWidth: screenWidth - 40,
  },
  thumbnail: {
    width: 60,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderColor: '#667eea',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
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
  mapModalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  mapActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#667eea',
    borderRadius: 10,
  },
  mapActionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
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
    maxWidth: 400,
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
  priceSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  bookingForm: {
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
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
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#667eea',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
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
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    marginRight: 8,
  },
  callButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  interestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 8,
  },
  interestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    marginLeft: 8,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
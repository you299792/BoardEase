import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getListingReviews, toggleFavorite, getCurrentUser, getTenantProfile } from '../lib/supabaseClient';

const BoardingHouseCard = ({ house, onPress, onFavoriteChange, isFavoriteProp }) => {
  const [imageError, setImageError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(isFavoriteProp || false);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [tenantProfileId, setTenantProfileId] = useState(null);
  
  const imageUrl = house.images && house.images.length > 0 ? house.images[0] : house.image;

  useEffect(() => {
    setIsFavorite(isFavoriteProp || false);
  }, [isFavoriteProp]);

  useEffect(() => {
    initializeTenant();
    loadAverageRating();
  }, [house.id]);

  useFocusEffect(
    React.useCallback(() => {
      loadAverageRating();
    }, [house.id])
  );

  const loadAverageRating = async () => {
    try {
      // Fetch reviews from database
      const { success, reviews } = await getListingReviews(house.id);
      
      if (success && reviews) {
        setReviewCount(reviews.length);
        
        if (reviews.length === 0) {
          setAverageRating(0);
        } else {
          const total = reviews.reduce((sum, review) => sum + review.rating, 0);
          const average = (total / reviews.length).toFixed(1);
          setAverageRating(parseFloat(average));
        }
      } else {
        setAverageRating(0);
        setReviewCount(0);
      }
    } catch (error) {
      console.error('Failed to load average rating', error);
      setAverageRating(0);
      setReviewCount(0);
    }
  };

  const initializeTenant = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        const { profile } = await getTenantProfile(user.id);
        if (profile?.id) {
          setTenantProfileId(profile.id);
        }
      }
    } catch (error) {
      console.error('Failed to initialize tenant', error);
    }
  };

  const toggleFavoriteHandler = async () => {
    try {
      if (!tenantProfileId || !house?.id) return;
      
      const result = await toggleFavorite(tenantProfileId, house.id, isFavorite);
      if (result.success) {
        setIsFavorite(!isFavorite);
        if (onFavoriteChange) {
          onFavoriteChange(house.id, !isFavorite);
        }
      }
    } catch (error) {
      console.error('Failed to toggle favorite', error);
    }
  };

  const checkIfFavorite = async () => {
    try {
      // Favorite state is managed by parent component via isFavoriteProp
      // No need to check here
    } catch (error) {
      console.error('Failed to check favorite status', error);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        {!imageError ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.image} 
            onError={handleImageError}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="home-outline" size={40} color="#ccc" />
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        
        {/* Favorite Button */}
        <TouchableOpacity 
          style={[
            styles.favoriteButton,
            isFavorite && styles.favoriteButtonActive
          ]} 
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering the card press
            toggleFavoriteHandler();
          }}
        >
          <Ionicons 
            name={isFavorite ? "heart" : "heart-outline"} 
            size={20} 
            color={isFavorite ? "#ef4444" : "white"} 
          />
        </TouchableOpacity>
        
        {/* Availability Badge */}
        <View style={styles.availabilityBadge}>
          <Text style={styles.availabilityText}>
            {house.available ? 'Available' : 'Occupied'}
          </Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{house.name}</Text>
          <Text style={styles.price}>₱{house.price}/mo</Text>
        </View>
        
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.location} numberOfLines={1}>{house.location}</Text>
        </View>
        
        <View style={styles.ratingContainer}>
          <View style={styles.ratingGroup}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.rating}>{averageRating}</Text>
            <Text style={styles.reviews}>({reviewCount})</Text>
          </View>
          <Text style={styles.distance}>{house.distance}</Text>
        </View>
        
        <View style={styles.typeContainer}>
          <Text style={styles.houseType}>{house.type}</Text>
        </View>
        
        <View style={styles.amenitiesContainer}>
          {house.amenities.slice(0, 3).map((amenity, index) => (
            <View key={index} style={styles.amenityTag}>
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
          {house.amenities.length > 3 && (
            <View style={styles.amenityTag}>
              <Text style={styles.amenityText}>+{house.amenities.length - 3}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.landlordInfo}>
          <Ionicons 
            name={house.landlord?.verified ? "checkmark-circle" : "person-circle"} 
            size={16} 
            color={house.landlord?.verified ? "#10b981" : "#666"} 
          />
          <Text style={styles.landlordName} numberOfLines={1}>
            {house.landlord?.name || 'Unknown'}
          </Text>
          {house.landlord?.verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 200,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  availabilityBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  availabilityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  location: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviews: {
    fontSize: 12,
    color: '#666',
  },
  distance: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  typeContainer: {
    marginBottom: 8,
  },
  houseType: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  amenityTag: {
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  amenityText: {
    fontSize: 10,
    color: '#667eea',
    fontWeight: '500',
  },
  landlordInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  landlordName: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '500',
  },
});

export default BoardingHouseCard;
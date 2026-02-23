
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BoardingHouseCard = ({ house, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image source={{ uri: house.image }} style={styles.image} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{house.name}</Text>
          <Text style={styles.price}>₱{house.price}/mo</Text>
        </View>
        <Text style={styles.location}>{house.location}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={16} color="#FFD700" />
          <Text style={styles.rating}>{house.rating}</Text>
          <Text style={styles.reviews}>({house.reviews} reviews)</Text>
          <Text style={styles.distance}>{house.distance}</Text>
        </View>
        <Text style={styles.houseType}>{house.type}</Text>
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
            name={house.landlord.verified ? "checkmark-circle" : "person-circle"} 
            size={16} 
            color={house.landlord.verified ? "#10b981" : "#666"} 
          />
          <Text style={styles.landlordName}>{house.landlord.name}</Text>
          {house.landlord.verified && (
            <Text style={styles.verifiedText}>Verified</Text>
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
  image: {
    width: '100%',
    height: 200,
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
    marginRight: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
    marginRight: 8,
  },
  reviews: {
    fontSize: 12,
    color: '#666',
    marginRight: 'auto',
  },
  distance: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  houseType: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
    marginBottom: 8,
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
    marginRight: 8,
  },
  verifiedText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '500',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
});

export default BoardingHouseCard;
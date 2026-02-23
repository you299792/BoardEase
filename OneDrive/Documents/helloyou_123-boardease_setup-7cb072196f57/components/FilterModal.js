import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FilterModal = ({ visible, onClose, onApplyFilters, currentFilters }) => {
  const [filters, setFilters] = useState(currentFilters || {
    priceRange: [1000, 5000],
    roomType: '',
    amenities: [],
    location: '',
    withPhotos: false,
    verifiedOnly: false,
  });

  const roomTypes = ['Single Room', 'Shared Room', 'Studio Unit', 'Apartment'];
  const amenitiesList = ['WiFi', 'Aircon', 'Kitchen', 'Laundry', 'Parking', 'CR', '24/7 Security', 'Study Area'];
  const locations = ['Divisoria', 'Nazareth', 'Carmen', 'Lapasan', 'Corrales Ext', 'Kauswagan', 'Gusa'];

  const toggleAmenity = (amenity) => {
    setFilters(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const toggleRoomType = (type) => {
    setFilters(prev => ({
      ...prev,
      roomType: prev.roomType === type ? '' : type
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({
      priceRange: [1000, 5000],
      roomType: '',
      amenities: [],
      location: '',
      withPhotos: false,
      verifiedOnly: false,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Range</Text>
            <View style={styles.priceRangeContainer}>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Min</Text>
                <View style={styles.priceInput}>
                  <Text style={styles.currency}>₱</Text>
                  <TextInput
                    style={styles.priceTextInput}
                    value={filters.priceRange[0].toString()}
                    onChangeText={(text) => {
                      const min = parseInt(text) || 0;
                      setFilters(prev => ({
                        ...prev,
                        priceRange: [min, prev.priceRange[1]]
                      }));
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.priceSeparator} />
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Max</Text>
                <View style={styles.priceInput}>
                  <Text style={styles.currency}>₱</Text>
                  <TextInput
                    style={styles.priceTextInput}
                    value={filters.priceRange[1].toString()}
                    onChangeText={(text) => {
                      const max = parseInt(text) || 5000;
                      setFilters(prev => ({
                        ...prev,
                        priceRange: [prev.priceRange[0], max]
                      }));
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Room Type</Text>
            <View style={styles.roomTypeContainer}>
              {roomTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.roomTypeButton,
                    filters.roomType === type && styles.roomTypeButtonActive
                  ]}
                  onPress={() => toggleRoomType(type)}
                >
                  <Text style={[
                    styles.roomTypeText,
                    filters.roomType === type && styles.roomTypeTextActive
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.locationContainer}>
              {locations.map((location) => (
                <TouchableOpacity
                  key={location}
                  style={[
                    styles.locationButton,
                    filters.location === location && styles.locationButtonActive
                  ]}
                  onPress={() => setFilters(prev => ({
                    ...prev,
                    location: prev.location === location ? '' : location
                  }))}
                >
                  <Text style={[
                    styles.locationText,
                    filters.location === location && styles.locationTextActive
                  ]}>
                    {location}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesContainer}>
              {amenitiesList.map((amenity) => (
                <TouchableOpacity
                  key={amenity}
                  style={[
                    styles.amenityButton,
                    filters.amenities.includes(amenity) && styles.amenityButtonActive
                  ]}
                  onPress={() => toggleAmenity(amenity)}
                >
                  <Text style={[
                    styles.amenityText,
                    filters.amenities.includes(amenity) && styles.amenityTextActive
                  ]}>
                    {amenity}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Filters</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>With Photos Only</Text>
              <Switch
                value={filters.withPhotos}
                onValueChange={(value) => setFilters(prev => ({ ...prev, withPhotos: value }))}
                trackColor={{ false: '#f0f0f0', true: '#667eea' }}
                thumbColor={filters.withPhotos ? '#fff' : '#f4f3f4'}
              />
            </View>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Verified Landlords Only</Text>
              <Switch
                value={filters.verifiedOnly}
                onValueChange={(value) => setFilters(prev => ({ ...prev, verifiedOnly: value }))}
                trackColor={{ false: '#f0f0f0', true: '#667eea' }}
                thumbColor={filters.verifiedOnly ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  resetButton: {
    padding: 4,
  },
  resetText: {
    color: '#667eea',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  currency: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  priceTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  priceSeparator: {
    width: 12,
    height: 1,
    backgroundColor: '#ccc',
    marginTop: 20,
  },
  roomTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roomTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  roomTypeButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  roomTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  roomTypeTextActive: {
    color: 'white',
  },
  locationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  locationButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  locationTextActive: {
    color: 'white',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  amenityButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  amenityText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  amenityTextActive: {
    color: 'white',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  applyButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FilterModal;
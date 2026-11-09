import React, { useState, useEffect } from 'react'; // <-- ADDED useEffect
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert, // <-- ADDED Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// NEW: Helper function to safely parse number and apply default for empty/invalid
const parsePrice = (priceString, defaultVal) => {
  // Removes all non-numeric characters and then converts to integer
  const num = parseInt(priceString?.replace(/[^0-9]/g, '') || '', 10);
  return isNaN(num) ? defaultVal : num;
};

// RENAMED PROPS: using 'onApply' and 'currentFilters' to match home.js
const FilterModal = ({ visible, onClose, onApply, currentFilters }) => { 
  
  // NEW STATE: Separate string states for text inputs
  const currentMin = currentFilters?.priceRange ? currentFilters.priceRange[0].toString() : '';
  const currentMax = currentFilters?.priceRange ? currentFilters.priceRange[1].toString() : '';
  
  const [minPrice, setMinPrice] = useState(currentMin);
  const [maxPrice, setMaxPrice] = useState(currentMax);

  // Existing state structure for other filters, currentized from currentFilters
  const [filters, setFilters] = useState(currentFilters || {
    // priceRange will be managed by minPrice/maxPrice state and overwritten in handleApply
    roomType: '',
    amenities: [],
    location: '',
    withPhotos: false,
    verifiedOnly: false,
  });

  const roomTypes = ['Single Room', 'Shared Room', 'Studio Unit', 'Apartment'];
  const amenitiesList = ['WiFi', 'Aircon', 'Kitchen', 'Laundry', 'Parking', 'CR', '24/7 Security', 'Study Area'];
  const locations = ['Divisoria', 'Nazareth', 'Carmen', 'Lapasan', 'Corrales Ext', 'Kauswagan', 'Gusa'];

  // NEW: useEffect to correctly sync local state when the modal opens or current filters change
  useEffect(() => {
    if (visible) {
      const currentMin = currentFilters?.priceRange ? currentFilters.priceRange[0].toString() : '';
      const currentMax = currentFilters?.priceRange ? currentFilters.priceRange[1].toString() : '';
      
      setMinPrice(currentMin);
      setMaxPrice(currentMax);
      
      // Sync the rest of the filters
      setFilters(currentFilters || {
        roomType: '',
        amenities: [],
        location: '',
        withPhotos: false,
        verifiedOnly: false,
      });
    }
  }, [visible, currentFilters]);

  // Existing logic for other filters...
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
  
  const toggleLocation = (loc) => {
    setFilters(prev => ({
      ...prev,
      location: prev.location === loc ? '' : loc
    }));
  };


  const handleApply = () => {
    // Use 0 as default for empty min (no minimum price)
    const minNum = parsePrice(minPrice, 0); 
    // Use a large number (e.g., 999999) as default for empty max price (no maximum price limit)
    const maxNum = parsePrice(maxPrice, 999999); 
    
    const filtersToApply = {
        ...filters,
        // Override the priceRange with the new, parsed, and customizable values
        priceRange: [minNum, maxNum],
    };
    
    // Pass the new filters to home.js, which performs the MIN < MAX validation
    onApply(filtersToApply);
    onClose(); // Close the modal after applying
  };
  
  const handleClear = () => {
    setMinPrice('');
    setMaxPrice('');
    setFilters({
      priceRange: [0, 999999], 
      roomType: '',
      amenities: [],
      location: '',
      withPhotos: false,
      verifiedOnly: false,
    });
    // Don't close, allow user to apply or adjust
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible} // Renamed from isVisible in my previous example, using your prop name
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle-outline" size={30} color="#667eea" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Filter Listings</Text>
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollView}>
            
            {/* Price Range Filter (UPDATED JSX) */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Price Range (per month)</Text>
              <View style={styles.priceInputsContainer}>
                
                {/* Minimum Price Input */}
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.currency}>₱</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Min (e.g., 1000)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={minPrice}
                    onChangeText={setMinPrice}
                  />
                </View>

                <Text style={styles.separator}>to</Text>
                
                {/* Maximum Price Input (FIXED: Customizable max and placeholder) */}
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.currency}>₱</Text>
                  <TextInput
                    style={styles.textInput}
                    // Custom placeholder and linked to the new string state
                    placeholder="Max (e.g., 5000)" 
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
              </View>
            </View>
            
            {/* Room Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Room Type</Text>
              <View style={styles.roomTypeContainer}>
                {roomTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.roomTypeButton,
                      filters.roomType === type && styles.roomTypeButtonActive,
                    ]}
                    onPress={() => toggleRoomType(type)}
                  >
                    <Text
                      style={[
                        styles.roomTypeText,
                        filters.roomType === type && styles.roomTypeTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Amenities Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesContainer}>
                {amenitiesList.map((amenity) => (
                  <TouchableOpacity
                    key={amenity}
                    style={[
                      styles.amenityButton,
                      filters.amenities.includes(amenity) && styles.amenityButtonActive,
                    ]}
                    onPress={() => toggleAmenity(amenity)}
                  >
                    <Text
                      style={[
                        styles.amenityText,
                        filters.amenities.includes(amenity) && styles.amenityTextActive,
                      ]}
                    >
                      {amenity}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Location Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.optionsContainer}>
                {locations.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[
                      styles.locationButton,
                      filters.location === loc && styles.locationButtonActive,
                    ]}
                    onPress={() => toggleLocation(loc)}
                  >
                    <Text
                      style={[
                        styles.locationText,
                        filters.location === loc && styles.locationTextActive,
                      ]}
                    >
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Other Toggles */}
            <View style={styles.filterSection}>
              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>Show only listings with photos</Text>
                <Switch
                  onValueChange={(value) => setFilters(prev => ({ ...prev, withPhotos: value }))}
                  value={filters.withPhotos}
                  trackColor={{ false: '#e9ecef', true: '#667eea' }}
                  thumbColor={'#fff'}
                />
              </View>
              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>Show only verified listings</Text>
                <Switch
                  onValueChange={(value) => setFilters(prev => ({ ...prev, verifiedOnly: value }))}
                  value={filters.verifiedOnly}
                  trackColor={{ false: '#e9ecef', true: '#667eea' }}
                  thumbColor={'#fff'}
                />
              </View>
            </View>

          </ScrollView>

          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ... Styles (using existing user styles but adding necessary new ones) ...
const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  filterSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  // NEW PRICE INPUT STYLES
  priceInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 12,
    flex: 1,
    height: 50,
  },
  currency: {
    fontSize: 16,
    color: '#666',
    marginRight: 5,
    fontWeight: '600',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    // Remove vertical padding that might push the container height
    paddingVertical: 0, 
  },
  separator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 10,
  },
  // END NEW PRICE INPUT STYLES

  // Existing styles adjusted for clarity
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
  optionsContainer: { // Used for Location
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
    borderBottomColor: '#f5f5f5',
  },
  switchText: {
    fontSize: 16,
    color: '#333',
  },
  applyButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default FilterModal;
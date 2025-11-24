import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  Modal,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Colors } from '../../constants/Colors';
import PropertyImageGrid from '../../components/PropertyImageGrid';
import { GlobalListingContext } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import {
  getCurrentUser,
  createListing as createListingDB,
  updateListing as updateListingDB,
  getLandlordListings,
} from '../../lib/supabaseClient'; 

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CreateListing() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { listings, updateListing, addListing } = useContext(GlobalListingContext);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  
  const [heading, setHeading] = useState('Create Property Listing');
  const [submitText, setSubmitText] = useState('Create Listing');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [rent, setRent] = useState('');
  const [description, setDescription] = useState('');
  const [virtualTour, setVirtualTour] = useState('');
  const [houseType, setHouseType] = useState('Single Room');
  const [distance, setDistance] = useState('');
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [available, setAvailable] = useState(true);
  const [maxGuests, setMaxGuests] = useState('');
  const [totalRooms, setTotalRooms] = useState('');
  const [availableRooms, setAvailableRooms] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [size, setSize] = useState(''); // For Sq. Ft.
  const [minStay, setMinStay] = useState(''); // For Min Stay in days
  const [availableFrom, setAvailableFrom] = useState('');
  const [amenities, setAmenities] = useState({
    wifi: false,
    airConditioning: false,
    parking: false,
    kitchen: false,
    laundry: false,
    security: false,
    furnished: false,
    waterIncluded: false,
    electricityIncluded: false,
    petsAllowed: false,
  });
  const [photos, setPhotos] = useState([]);
  const [floorPlans, setFloorPlans] = useState([]);
  
  // Real Google Maps Location State
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapAddress, setMapAddress] = useState('');
  const [currentRegion, setCurrentRegion] = useState({
    latitude: 8.4833, // Default to Cagayan de Oro coordinates
    longitude: 124.6500,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [mapType, setMapType] = useState('standard');

  const houseTypes = [
    'Single Room',
    'Shared Room',
    'Studio Unit',
    'Apartment',
    'Dormitory',
    'Boarding House'
  ];

  const resetForm = () => {
    console.log('Resetting form...');
    setTitle('');
    setAddress('');
    setRent('');
    setDescription('');
    setVirtualTour('');
    setHouseType('Single Room');
    setDistance('');
    setRules([]);
    setNewRule('');
    setAvailable(true);
    setMaxGuests('');
    setTotalRooms('');
    setAvailableRooms('');
    setPostalCode('');
    setBedrooms('');
    setBathrooms('');
    setSize('');
    setMinStay('');
    setAvailableFrom('');
    setAmenities({
      wifi: false,
      airConditioning: false,
      parking: false,
      kitchen: false,
      laundry: false,
      security: false,
      furnished: false,
      waterIncluded: false,
      electricityIncluded: false,
      petsAllowed: false,
    });
    setPhotos([]);
    setFloorPlans([]);
    setIsEditing(false);
    setHeading('Create Property Listing');
    setSubmitText('Create Listing');
    // Reset location
    setSelectedLocation(null);
    setMapAddress('');
  };

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  // When params.id or listings/currentUser change - ensure edit mode is set reliably.
  useEffect(() => {
    const loadForEdit = async () => {
      const paramId = params?.id;
      if (paramId && paramId !== 'undefined') {
        // Try to find listing in context first
        let existingListing = listings?.find(b => String(b.id) === String(paramId));

        // If not found in context, attempt to fetch landlord listings and find it.
        if (!existingListing && currentUser) {
          try {
            const { success, listings: dbListings, error } = await getLandlordListings(currentUser.id);
            if (success && Array.isArray(dbListings)) {
              existingListing = dbListings.find(b => String(b.id) === String(paramId));
            } else {
              console.warn('Could not load landlord listings for edit:', error);
            }
          } catch (err) {
            console.warn('Error fetching landlord listings for edit:', err);
          }
        }

        if (existingListing) {
          console.log('Loading editing data for:', existingListing.name || existingListing.title || existingListing.id);
          // Map fields from existingListing (support both name/title keys)
          setTitle(existingListing.name ?? existingListing.title ?? '');
          setAddress(existingListing.location ?? existingListing.address ?? '');
          setRent(String(existingListing.price ?? existingListing.rent ?? ''));
          setDescription(existingListing.description ?? existingListing.details ?? '');
          setHouseType(existingListing.type ?? existingListing.houseType ?? 'Single Room');
          setDistance(existingListing.distance ?? '');
          setRules(existingListing.rules ?? []);
          setMaxGuests(String(existingListing.max_guests || ''));
          setTotalRooms(String(existingListing.total_rooms || ''));
          setAvailableRooms(String(existingListing.available_rooms || ''));
          setPostalCode(existingListing.postal_code || '');
          setBedrooms(String(existingListing.bedrooms || ''));
          setBathrooms(String(existingListing.bathrooms || ''));
          setSize(String(existingListing.size || ''));
          setMinStay(String(existingListing.min_stay || ''));
          setAvailable(existingListing.available !== false);
          setAvailableFrom(existingListing.availableFrom ?? '');
          
          // Load location data if exists
          if (existingListing.locationData) {
            setSelectedLocation(existingListing.locationData);
            setMapAddress(existingListing.locationData.address || existingListing.location || existingListing.address || '');
            setCurrentRegion({
              latitude: existingListing.locationData.latitude,
              longitude: existingListing.locationData.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          } else if (existingListing.latitude && existingListing.longitude) {
            setSelectedLocation({
              latitude: existingListing.latitude,
              longitude: existingListing.longitude,
              address: existingListing.location || existingListing.address || '',
            });
            setMapAddress(existingListing.location || existingListing.address || '');
            setCurrentRegion({
              latitude: existingListing.latitude,
              longitude: existingListing.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
          
          // Amenities mapping
          const amenitiesObj = {
            wifi: false,
            airConditioning: false,
            parking: false,
            kitchen: false,
            laundry: false,
            security: false,
            furnished: false,
            waterIncluded: false,
            electricityIncluded: false,
            petsAllowed: false,
          };
          if (existingListing.amenities && Array.isArray(existingListing.amenities)) {
            existingListing.amenities.forEach(amenity => {
              const key = amenity.toLowerCase().replace(/\s+/g, '');
              if (amenitiesObj.hasOwnProperty(key)) {
                amenitiesObj[key] = true;
              }
            });
          }
          setAmenities(amenitiesObj);

          // Photos / images
          setPhotos(existingListing.images || existingListing.photos || []);

          setIsEditing(true);
          setHeading('Edit Property Listing');
          setSubmitText('Update Listing');
          return;
        } else {
          // If we couldn't find the listing yet, prepare form for edit state
          console.warn('Listing to edit not found in context or DB result for id:', paramId);
          // keep isEditing false for now — when user submits we'll treat it as update only if we have a valid id and isEditing true
        }
      } else {
        // no id param -> ensure form cleared for create
        resetForm();
      }
    };

    loadForEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id, listings, currentUser]);

  // Request location permission and get current location
  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      
      // Request location permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        setIsLoadingLocation(false);
        return;
      }

      // Get current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      
      // Update map region to current location
      setCurrentRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Reverse geocode to get address
      const [addressResult] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const formattedAddress = [
        addressResult.name,
        addressResult.street,
        addressResult.city,
        addressResult.region,
        addressResult.country,
      ]
        .filter(Boolean)
        .join(', ');

      setMapAddress(formattedAddress);
      
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get current location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Geocode address to coordinates
  const geocodeAddress = async (addressStr) => {
    try {
      setIsLoadingLocation(true);
      const results = await Location.geocodeAsync(addressStr);
      
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        setCurrentRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        return { latitude, longitude };
      } else {
        Alert.alert('Error', 'Could not find this address. Please try a different address.');
        return null;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Error', 'Could not geocode address. Please try again.');
      return null;
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const pickImage = async (setter, multiple = false) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setter((prev) => [...prev, uri]);
      }
    } catch (err) {
      console.warn('Image pick error', err);
    }
  };

  const removeAt = (arrSetter) => (index) => {
    arrSetter((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAmenity = (key) => {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  
  const addRule = () => {
    if (newRule.trim()) {
      setRules([...rules, newRule.trim()]);
      setNewRule('');
    }
  };

  const removeRule = (index) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const openRulesModal = () => {
    setShowRulesModal(true);
  };

  const closeRulesModal = () => {
    setShowRulesModal(false);
    setNewRule('');
  };

  // Real Google Maps Location Functions
  const openMapModal = async () => {
    setShowMapModal(true);
    
    // If we have existing location data, center map on it
    if (selectedLocation) {
      setCurrentRegion({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setMapAddress(selectedLocation.address);
    } else if (address) {
      // Try to geocode the existing address
      setMapAddress(address);
      await geocodeAddress(address);
    } else {
      // Get current location if no existing data
      await getCurrentLocation();
    }
  };

  const closeMapModal = () => {
    setShowMapModal(false);
  };

  // Handle map region change
  const handleRegionChange = (region) => {
    setCurrentRegion(region);
  };

  // Handle map press to set marker
  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation({
      ...coordinate,
      address: mapAddress || 'Selected Location',
    });
  };

  // Handle address search
  const handleAddressSearch = async () => {
    if (mapAddress.trim()) {
      const coordinates = await geocodeAddress(mapAddress.trim());
      if (coordinates) {
        setSelectedLocation({
          ...coordinates,
          address: mapAddress.trim(),
        });
      }
    }
  };

  // Use current location
  const handleUseCurrentLocation = async () => {
    await getCurrentLocation();
    // Set marker at current location
    setSelectedLocation({
      latitude: currentRegion.latitude,
      longitude: currentRegion.longitude,
      address: mapAddress,
    });
  };

  const handleMapLocationSelect = () => {
    if (selectedLocation) {
      setAddress(selectedLocation.address); // Also update the main address field
      Alert.alert('Location Saved', 'Property location has been set successfully!');
      closeMapModal();
    } else {
      Alert.alert('Error', 'Please select a location on the map first');
    }
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    setMapAddress('');
    Alert.alert('Location Cleared', 'Property location has been removed.');
  };

  // Function to open Google Maps with the selected location
  const openInGoogleMaps = () => {
    if (selectedLocation) {
      const { latitude, longitude } = selectedLocation;
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(url).catch(err => 
        Alert.alert('Error', 'Could not open Google Maps')
      );
    }
  };

  // Toggle map type
  const toggleMapType = () => {
    setMapType(mapType === 'standard' ? 'satellite' : 'standard');
  };

  const getAmenitiesArray = () => {
    const amenitiesMap = {
      wifi: 'WiFi',
      airConditioning: 'Air Conditioning',
      parking: 'Parking',
      kitchen: 'Kitchen',
      laundry: 'Laundry',
      security: 'Security',
      furnished: 'Furnished',
      waterIncluded: 'Water Included',
      electricityIncluded: 'Electricity Included',
      petsAllowed: 'Pets Allowed',
    };

    return Object.entries(amenities)
      .filter(([key, value]) => value)
      .map(([key]) => amenitiesMap[key] || key);
  };

  const validateAndSubmit = async () => {
    if (!title.trim()) return Alert.alert('Validation', 'Title is required');
    if (!address.trim()) return Alert.alert('Validation', 'Address is required');
    // sanitize rent input (remove commas & currency symbols)
    const rentSanitized = (rent ?? '').toString().replace(/[,₱\s]/g, '');
    const parsedPrice = parseFloat(rentSanitized);
    if (!rentSanitized || Number.isNaN(parsedPrice)) return Alert.alert('Validation', 'Rent must be a number');
    if (!description.trim()) return Alert.alert('Validation', 'Description is required');

    if (!currentUser) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    setIsSubmitting(true);

    try {
      const amenitiesArray = getAmenitiesArray();

      const listingData = {
        title,
        description,
        address,
        city: address.split(',').pop()?.trim() || address,
        price: parsedPrice,
        houseType,
        distance: distance?.trim() || null, // include distance so it's saved
        availableFrom,
        amenities: amenitiesArray,
        maxGuests: parseInt(maxGuests) || 1,
        totalRooms: parseInt(totalRooms) || null,
        availableRooms: parseInt(availableRooms) || null,
        postalCode: postalCode.trim() || null,
        bedrooms: parseInt(bedrooms) || null,
        bathrooms: parseInt(bathrooms) || null,
        size: parseInt(size) || null,
        minStay: parseInt(minStay) || null,
        rules,
        images: photos.length > 0 ? photos : ['https://via.placeholder.com/150/0000FF/808080?text=New+Listing'],
        latitude: selectedLocation?.latitude || 0,
        longitude: selectedLocation?.longitude || 0,
      };

      let result;
      // Use isEditing + params.id to determine update vs create.
      if ((isEditing || params?.id) && params?.id) {
        // Update existing listing
        result = await updateListingDB(params.id, listingData);
        if (result.success) {
          // Update context if available
          try {
            const updatedRecord = result.listing || { ...listingData, id: params.id };
            if (typeof updateListing === 'function') updateListing(params.id, updatedRecord);
          } catch (err) {
            console.warn('Error updating context after update:', err);
          }

          Alert.alert('Success', 'Listing updated successfully!', [
            {
              text: 'OK',
              onPress: () => {
                resetForm();
                // Go back to landlord dashboard (replace so back stack is clean)
                router.replace('/landlord');
              },
            },
          ]);
        } else {
          Alert.alert('Error', result.error || 'Failed to update listing');
        }
      } else {
        // Create new listing
        result = await createListingDB(listingData, currentUser.id);
        if (result.success) {
          try {
            if (typeof addListing === 'function') addListing(result.listing || { ...listingData });
          } catch (err) {
            console.warn('Error adding created listing to context:', err);
          }

          Alert.alert('Success', 'Listing created successfully!', [
            {
              text: 'OK',
              onPress: () => {
                resetForm();
                router.replace('/landlord');
              },
            },
          ]);
        } else {
          Alert.alert('Error', result.error || 'Failed to create listing');
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to save listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Check if we can go back in the navigation stack
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        // If not, replace the current screen with the landlord dashboard
        router.replace('/landlord');
      }
    } catch (e) {
      router.replace('/landlord');
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>{heading}</Text>

        {isEditing && (
          <View style={styles.editIndicator}>
            <Text style={styles.editIndicatorText}>Editing</Text>
          </View>
        )}

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} placeholder="e.g., Cozy 2BR near downtown" value={title} onChangeText={setTitle} />

        {/* Location Section with Real Map Integration */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <Text style={styles.label}>Property Location</Text>
            <TouchableOpacity style={styles.mapButton} onPress={openMapModal}>
              <Ionicons name="map" size={20} color="#667eea" />
              <Text style={styles.mapButtonText}>Set on Map</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput 
            style={styles.input} 
            placeholder="Full address" 
            value={address} 
            onChangeText={setAddress} 
          />

          {selectedLocation && (
            <View style={styles.locationPreview}>
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={16} color="#10b981" />
                <View style={styles.locationDetails}>
                  <Text style={styles.locationText} numberOfLines={2}>
                    {selectedLocation.address}
                  </Text>
                  <Text style={styles.coordinatesText}>
                    {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
              <View style={styles.locationActions}>
                <TouchableOpacity 
                  style={styles.locationActionButton}
                  onPress={openInGoogleMaps}
                >
                  <Ionicons name="navigate" size={16} color="#667eea" />
                  <Text style={styles.locationActionText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.locationActionButton}
                  onPress={clearLocation}
                >
                  <Ionicons name="trash" size={16} color="#ef4444" />
                  <Text style={styles.locationActionText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Monthly Rent (PHP)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={rent}
              onChangeText={(text) => setRent(text)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Distance</Text>
            <TextInput style={styles.input} placeholder="e.g., 1.2 km from XU" value={distance} onChangeText={setDistance} />
          </View>
        </View>

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Total Rooms</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10"
              keyboardType="number-pad"
              value={totalRooms}
              onChangeText={setTotalRooms}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Available Rooms</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2"
              keyboardType="number-pad"
              value={availableRooms}
              onChangeText={setAvailableRooms}
            />
          </View>
        </View>

        <Text style={styles.label}>Max Guests per Room</Text>
        <TextInput style={styles.input} placeholder="e.g., 2" keyboardType="number-pad" value={maxGuests} onChangeText={setMaxGuests} />

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Bedrooms</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 3"
              keyboardType="number-pad"
              value={bedrooms}
              onChangeText={setBedrooms}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Bathrooms</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2"
              keyboardType="number-pad"
              value={bathrooms}
              onChangeText={setBathrooms}
            />
          </View>
        </View>

        <View style={styles.rowInputs}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Size (Sq. Ft.)</Text>
            <TextInput style={styles.input} placeholder="e.g., 500" keyboardType="number-pad" value={size} onChangeText={setSize} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Min. Stay (Days)</Text>
            <TextInput style={styles.input} placeholder="e.g., 30" keyboardType="number-pad" value={minStay} onChangeText={setMinStay} />
          </View>
        </View>


        <Text style={styles.label}>House Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
          <View style={styles.typeContainer}>
            {houseTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  houseType === type && styles.typeButtonActive
                ]}
                onPress={() => setHouseType(type)}
              >
                <Text style={[
                  styles.typeButtonText,
                  houseType === type && styles.typeButtonTextActive
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 120 }]}
          placeholder="Describe the property, layout, nearby points of interest..."
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Virtual Tour Link (optional)</Text>
        <TextInput style={styles.input} placeholder="https://" value={virtualTour} onChangeText={setVirtualTour} autoCapitalize="none" />

        <Text style={styles.section}>Availability</Text>
        <View style={styles.availabilityContainer}>
          <View style={styles.availabilityRow}>
            <Text style={styles.availabilityText}>Currently Available</Text>
            <Switch value={available} onValueChange={setAvailable} />
          </View>
          {available && (
            <View style={styles.availabilityInput}>
              <Text style={styles.label}>Available From (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Immediately, March 2024"
                value={availableFrom}
                onChangeText={setAvailableFrom}
              />
            </View>
          )}
        </View>

        <Text style={styles.section}>Amenities</Text>
        <View style={styles.amenitiesBox}>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Wi-Fi</Text>
            <Switch value={amenities.wifi} onValueChange={() => toggleAmenity('wifi')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Air Conditioning</Text>
            <Switch value={amenities.airConditioning} onValueChange={() => toggleAmenity('airConditioning')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Parking</Text>
            <Switch value={amenities.parking} onValueChange={() => toggleAmenity('parking')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Kitchen</Text>
            <Switch value={amenities.kitchen} onValueChange={() => toggleAmenity('kitchen')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Laundry</Text>
            <Switch value={amenities.laundry} onValueChange={() => toggleAmenity('laundry')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>24/7 Security</Text>
            <Switch value={amenities.security} onValueChange={() => toggleAmenity('security')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Furnished</Text>
            <Switch value={amenities.furnished} onValueChange={() => toggleAmenity('furnished')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Water Included</Text>
            <Switch value={amenities.waterIncluded} onValueChange={() => toggleAmenity('waterIncluded')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Electricity Included</Text>
            <Switch value={amenities.electricityIncluded} onValueChange={() => toggleAmenity('electricityIncluded')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Pets Allowed</Text>
            <Switch value={amenities.petsAllowed} onValueChange={() => toggleAmenity('petsAllowed')} />
          </View>
        </View>

        <View style={styles.rulesSection}>
          <View style={styles.rulesHeader}>
            <Text style={styles.section}>House Rules</Text>
            <TouchableOpacity style={styles.addRuleButton} onPress={openRulesModal}>
              <Ionicons name="add-circle" size={20} color="#667eea" />
              <Text style={styles.addRuleText}>Add Rules</Text>
            </TouchableOpacity>
          </View>
          
          {rules.length > 0 ? (
            <View style={styles.rulesList}>
              {rules.map((rule, index) => (
                <View key={index} style={styles.ruleItem}>
                  <Ionicons name="information-circle" size={16} color="#667eea" />
                  <Text style={styles.ruleText}>{rule}</Text>
                  <TouchableOpacity onPress={() => removeRule(index)} style={styles.removeRuleButton}>
                    <Ionicons name="close-circle" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noRulesText}>No house rules added yet.</Text>
          )}
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Photos</Text>
        <PropertyImageGrid
          images={photos}
          onAdd={() => pickImage(setPhotos)}
          onRemove={removeAt(setPhotos)}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Floor Plans (images)</Text>
        <PropertyImageGrid
          images={floorPlans}
          onAdd={() => pickImage(setFloorPlans)}
          onRemove={removeAt(setFloorPlans)}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={validateAndSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{submitText}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>
            {isEditing ? 'Cancel Edit' : 'Cancel'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showRulesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeRulesModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add House Rule</Text>
            
            <TextInput
              style={styles.ruleInput}
              placeholder="Enter a house rule (e.g., No smoking inside rooms)"
              value={newRule}
              onChangeText={setNewRule}
              multiline
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={closeRulesModal}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.addModalButton]}
                onPress={() => { addRule(); closeRulesModal(); }}
                disabled={!newRule.trim()}
              >
                <Text style={styles.addModalButtonText}>Add Rule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Real Interactive Google Maps Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeMapModal}
        statusBarTranslucent={true}
      >
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapModalContent}>
            <View style={styles.mapModalHeader}>
              <Text style={styles.mapModalTitle}>Set Property Location</Text>
              <TouchableOpacity style={styles.mapCloseButton} onPress={closeMapModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.mapModalSubtitle}>
              Tap on the map to set your property location or search for an address
            </Text>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search address or place..."
                value={mapAddress}
                onChangeText={setMapAddress}
                onSubmitEditing={handleAddressSearch}
              />
              <TouchableOpacity style={styles.searchButton} onPress={handleAddressSearch}>
                <Ionicons name="search" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.mapContainer}>
              {isLoadingLocation ? (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color="#667eea" />
                  <Text style={styles.mapLoadingText}>Loading map...</Text>
                </View>
              ) : (
                <MapView
                  style={styles.map}
                  region={currentRegion}
                  onRegionChangeComplete={handleRegionChange}
                  onPress={handleMapPress}
                  mapType={mapType}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  showsCompass={true}
                  showsScale={true}
                >
                  {selectedLocation && (
                    <Marker
                      coordinate={selectedLocation}
                      title="Property Location"
                      description={selectedLocation.address}
                      pinColor="#667eea"
                    />
                  )}
                </MapView>
              )}
            </View>

            <View style={styles.mapControls}>
              <TouchableOpacity style={styles.mapControlButton} onPress={handleUseCurrentLocation}>
                <Ionicons name="locate" size={20} color="#667eea" />
                <Text style={styles.mapControlText}>Current Location</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mapControlButton} onPress={toggleMapType}>
                <Ionicons name={mapType === 'standard' ? 'map' : 'earth'} size={20} color="#667eea" />
                <Text style={styles.mapControlText}>
                  {mapType === 'standard' ? 'Satellite' : 'Map'}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedLocation && (
              <View style={styles.selectedLocationInfo}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <View style={styles.selectedLocationText}>
                  <Text style={styles.selectedLocationTitle}>Location Selected</Text>
                  <Text style={styles.selectedLocationAddress} numberOfLines={2}>
                    {selectedLocation.address}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.mapModalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={closeMapModal}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.addModalButton]}
                onPress={handleMapLocationSelect}
                disabled={!selectedLocation}
              >
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.addModalButtonText}>Save Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f6f7fb',
  },
  
  container: {
    padding: 16
  },
  
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  
  heading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    paddingTop : 20,
    color: Colors.primary,
  },
  editIndicator: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  editIndicatorText: {
    color: '#92400e',
    fontWeight: '600',
    fontSize: 14,
  },
  label: {
    marginTop: 8,
    marginBottom: 6,
    color: '#333',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#eef0f3',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fbfcfe',
  },
  locationSection: {
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
  },
  mapButtonText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 14,
  },
  locationPreview: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  locationDetails: {
    flex: 1,
  },
  locationText: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  coordinatesText: {
    color: '#047857',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  locationActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  locationActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  typeScroll: {
    marginBottom: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  typeButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  section: {
    marginTop: 12,
    fontWeight: '700',
    color: '#333',
    fontSize: 16,
  },
  availabilityContainer: {
    backgroundColor: '#fbfbfc',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  availabilityText: {
    color: '#444',
    fontWeight: '600',
  },
  availabilityInput: {
    marginTop: 8,
  },
  amenitiesBox: {
    backgroundColor: '#fbfbfc',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  amenitiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  amenityText: { color: '#444' },
  rulesSection: {
    marginTop: 12,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addRuleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  addRuleText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 14,
  },
  rulesList: {
    backgroundColor: '#fbfbfc',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  ruleText: {
    flex: 1,
    color: '#444',
    fontSize: 14,
  },
  removeRuleButton: {
    padding: 4,
  },
  noRulesText: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#fbfbfc',
    borderRadius: 10,
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
    marginBottom: 40,
  },
  cancelText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
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
  mapCloseButton: {
    padding: 4,
  },
  mapModalSubtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fbfcfe',
  },
  searchButton: {
    backgroundColor: '#667eea',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    height: 300,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  mapLoadingText: {
    marginTop: 8,
    color: '#666',
  },
  mapControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  mapControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  mapControlText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    marginBottom: 16,
  },
  selectedLocationText: {
    flex: 1,
    marginLeft: 12,
  },
  selectedLocationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 2,
  },
  selectedLocationAddress: {
    fontSize: 12,
    color: '#047857',
  },
  mapModalButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  ruleInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cancelModalButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  cancelModalButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  addModalButton: {
    backgroundColor: '#667eea',
  },
  addModalButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
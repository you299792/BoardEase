import React, { useState, useEffect, useContext } from 'react'; // ADDED: useContext
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router'; 
import { Colors } from '../../constants/Colors';
import PropertyImageGrid from '../../components/PropertyImageGrid';
import { boardingHouses } from '../../data/mockData'; 
import { GlobalListingContext } from './_layout'; // ADDED: Import context

export default function CreateListing() {
  const params = useLocalSearchParams(); 
  // CRITICAL FIX: Get the update function from context
  const { listings, updateListing } = useContext(GlobalListingContext); 
  
  const [isEditing, setIsEditing] = useState(false);
  const [heading, setHeading] = useState('Create Property Listing');
  const [submitText, setSubmitText] = useState('Create Listing');

  // Existing form states
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [rent, setRent] = useState('');
  const [description, setDescription] = useState('');
  const [virtualTour, setVirtualTour] = useState('');

  // Amenities as toggles
  const [amenities, setAmenities] = useState({
    parking: false,
    utilitiesIncluded: false,
    petsAllowed: false,
    wifi: false,
    furnished: false,
  });

  // images and floor plans
  const [photos, setPhotos] = useState([]);
  const [floorPlans, setFloorPlans] = useState([]);

  // Effect to load data if editing
  useEffect(() => {
    if (params.id) {
      const listingId = params.id;
      // CRITICAL FIX: Find the listing in the CONTEXT's current data, not the static mock data
      const existingListing = listings.find(b => String(b.id) === listingId); 

      if (existingListing) {
        // Populate the form fields with existing data
        setTitle(existingListing.name);
        setAddress(existingListing.location);
        setRent(String(existingListing.price)); 
        setDescription(existingListing.details || ''); 
        setAmenities(existingListing.amenities || {
            parking: false, utilitiesIncluded: false, petsAllowed: false, 
            wifi: false, furnished: false, 
        });
        setPhotos(existingListing.images || []);
        
        // Update states for editing mode
        setIsEditing(true);
        setHeading('Edit Property Listing');
        setSubmitText('Update Listing');
      }
    }
  }, [params.id, listings]); // Added 'listings' dependency to re-run if context data changes

  // ... (pickImage, removeAt, toggleAmenity functions remain the same) ...
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


  const validateAndSubmit = () => {
    if (!title.trim()) return Alert.alert('Validation', 'Title is required');
    if (!address.trim()) return Alert.alert('Validation', 'Address is required');
    if (!rent.trim() || isNaN(Number(rent))) return Alert.alert('Validation', 'Rent must be a number');

    // Create a normalized payload
    const payload = {
      // NOTE: Using a mock image array and details for a clean update
      images: photos.length > 0 ? photos : ['https://via.placeholder.com/150/0000FF/808080?text=New+Listing'],
      details: description, // Assuming 'details' is what the dashboard uses for description
      location: address,
      price: Number(rent),
      name: title,
      amenities,
      virtualTour,
      floorPlans,
    };
    
    if (isEditing) {
      // CRITICAL FIX: Call the global update function
      updateListing(params.id, payload);
      console.log(`Updating listing ${params.id}`);

      Alert.alert('Success', 'Listing updated successfully!', [
        { text: 'OK', onPress: () => router.replace('/landlord') },
      ]);
    } else {
      // CRITICAL FIX: For creation, use a temporary ID (like Date.now())
      updateListing(null, payload);
      console.log('Listing created');

      Alert.alert('Success', 'Listing created successfully!', [
        { text: 'OK', onPress: () => router.replace('/landlord') },
      ]);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>{heading}</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} placeholder="e.g., Cozy 2BR near downtown" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} placeholder="Full address" value={address} onChangeText={setAddress} />

        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Monthly Rent (PHP)</Text>
            <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={rent} onChangeText={setRent} />
          </View>
        </View>

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

        <Text style={styles.section}>Amenities</Text>
        <View style={styles.amenitiesBox}>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Parking</Text>
            <Switch value={amenities.parking} onValueChange={() => toggleAmenity('parking')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Utilities included</Text>
            <Switch value={amenities.utilitiesIncluded} onValueChange={() => toggleAmenity('utilitiesIncluded')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Pets allowed</Text>
            <Switch value={amenities.petsAllowed} onValueChange={() => toggleAmenity('petsAllowed')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Wi-Fi</Text>
            <Switch value={amenities.wifi} onValueChange={() => toggleAmenity('wifi')} />
          </View>
          <View style={styles.amenitiesRow}>
            <Text style={styles.amenityText}>Furnished</Text>
            <Switch value={amenities.furnished} onValueChange={() => toggleAmenity('furnished')} />
          </View>
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

        <TouchableOpacity style={styles.submitBtn} onPress={validateAndSubmit}>
          <Text style={styles.submitText}>{submitText}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f6f7fb',
  },
  container: {
    padding: 16,
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
    color: Colors.primary,
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
  rowInputs: {
    flexDirection: 'row',
  },
  section: {
    marginTop: 12,
    fontWeight: '700',
    color: '#333',
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
  submitBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
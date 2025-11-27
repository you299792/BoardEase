import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import BoardingHouseCard from '../../components/BoardingHouseCard';
import {
  getListings,
  getLandlordProfile as fetchLandlordProfile,
} from '../../lib/supabaseClient';

export default function LandlordProfile() {
  const { landlordId } = useLocalSearchParams();
  const [landlord, setLandlord] = useState(null);
  const [otherListings, setOtherListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
 
  const handleCall = () => {
    if (landlord?.phone) {
      Linking.openURL(`tel:${landlord.phone}`);
    }
  };

  const handleMessage = () => {
    router.push({
      pathname: '/(tenant)/chat',
      params: {
        landlordId: landlord?.id || landlord?.email,
        landlordName: landlord?.name,
        landlordImage: landlord?.photoURL || landlord?.image,
      },
    });
  };

  useEffect(() => {
    const fetchLandlordData = async () => {
      try {
        setIsLoading(true);
        if (!landlordId) {
          throw new Error("Landlord ID is missing.");
        }

        // Directly fetch the landlord's profile and their listings
        const { success, profile, error } = await fetchLandlordProfile(landlordId);

        if (success && profile) {
          // Calculate combined rating from all listings
          const listings = profile.listings || [];
          let combinedRating = 0;
          let totalReviews = 0;
          
          if (listings.length > 0) {
            const ratingsData = listings.filter(l => l.rating && l.rating > 0);
            if (ratingsData.length > 0) {
              const totalRating = ratingsData.reduce((sum, listing) => sum + (listing.rating || 0), 0);
              combinedRating = parseFloat((totalRating / ratingsData.length).toFixed(1));
            }
            totalReviews = listings.reduce((sum, listing) => sum + (listing.total_reviews || 0), 0);
          }

          const landlordData = {
            id: profile.user_id,
            name: `${profile.users?.first_name || ''} ${profile.users?.last_name || ''}`.trim(),
            email: profile.users?.email,
            phone: profile.users?.phone,
            image: profile.users?.profile_image_url,
            rating: combinedRating,
            totalReviews: totalReviews,
            verified: profile.bank_account_verified,
            joinDate: profile.users?.created_at ? new Date(profile.users.created_at).getFullYear() : null,
            bio: profile.users?.bio,
          };
          setLandlord(landlordData);

          // The listings are now directly available on the profile object
          const transformedListings = (profile.listings || []).map(listing => ({
            ...listing,
            id: listing.id,
            name: listing.title,
            location: listing.city,
            price: listing.price_per_month,
            type: (function(enumVal) {
              const labels = {
                single_room: 'Single Room',
                shared_room: 'Shared Room',
                studio: 'Studio Unit',
                suite: 'Suite',
                bed_space: 'Bed Space',
              };
              return labels[enumVal] || (enumVal || 'Boarding House');
            })(listing.room_type),
            amenities: listing.amenities || [],
            available: listing.available !== undefined ? listing.available : true,
            landlord: {
              name: landlordData.name || 'Unknown',
              verified: landlordData.verified || false,
            },
          }));
          setOtherListings(transformedListings);
        } else {
          throw new Error(error || 'Failed to load landlord data');
        }
      } catch (e) {
        console.error('Failed to load landlord data', e);
        Alert.alert('Error', e.message || 'An unexpected error occurred.');
        setLandlord(null); // Ensure no stale data is shown
      } finally {
        setIsLoading(false);
      }
    };

    fetchLandlordData();
  }, [landlordId]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading landlord profile...</Text>
      </View>
    );
  }

  if (!landlord) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Landlord Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={{ marginTop: 20, fontSize: 16, color: '#666' }}>Could not find landlord profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
     
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Landlord Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: landlord.image || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.userName}>{landlord.name}</Text>

          
          {landlord.company ? (
            <Text style={styles.companyText}>{landlord.company}</Text>
          ) : null}

          <View style={styles.userTypeContainer}>
            <Ionicons 
              name={landlord.verified ? "shield-checkmark" : "shield-outline"} 
              size={16} 
              color={landlord.verified ? "#10b981" : "#666"} 
            />
            <Text style={[styles.userType, {color: landlord.verified ? "#10b981" : "#666"}]}> 
              {landlord.verified ? 'Verified Landlord' : 'Not Verified'}
            </Text>

            {landlord.yearsExperience ? (
              <Text style={styles.experienceSmall}>{landlord.yearsExperience} yrs</Text>
            ) : null}
          </View>
        </View>

        
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.messageButton]} onPress={handleMessage}>
            <Ionicons name="chatbubble" size={18} color="#fff" />
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>
        </View>

        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{otherListings.length}</Text>
            <Text style={styles.statLabel}>Properties</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{landlord.rating || 0}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{landlord.totalReviews || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>

        {landlord.joinDate ? (
          <View style={styles.joinDateRow}>
            <Text style={styles.joinDateText}>Member since {landlord.joinDate}</Text>
          </View>
        ) : null}

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <Text style={styles.infoText}>{landlord.name}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <Text style={styles.infoText}>{landlord.email || landlord.contactEmail || 'Not available'}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <Text style={styles.infoText}>{landlord.phone || landlord.contactPhone || 'Not available'}</Text>
          </View>

          {landlord.bio ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>About</Text>
              <Text style={styles.infoText}>{landlord.bio}</Text>
            </View>
          ) : null}

          {landlord.company ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company</Text>
              <Text style={styles.infoText}>{landlord.company}</Text>
            </View>
          ) : null}

          {landlord.yearsExperience ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Experience</Text>
              <Text style={styles.infoText}>{landlord.yearsExperience} years</Text>
            </View>
          ) : null}
        </View>

       
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Listings from {landlord.name}</Text>

          {otherListings.length === 0 ? (
            <Text style={styles.infoText}>No listings found for this landlord.</Text>
          ) : (
            otherListings.map(h => (
              <BoardingHouseCard
                key={h.id}
                house={h}
                onPress={() => router.push({ pathname: '/(tenant)/boarding-house-details', params: { id: h.id } })}
              />
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}


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
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 30,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#667eea',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  userTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  userType: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  companyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  experienceSmall: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  messageButton: {
    backgroundColor: '#10b981',
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  joinDateRow: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  joinDateText: {
    fontSize: 12,
    color: '#666',
  },
});
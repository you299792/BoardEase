import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FilterModal from '../../components/FilterModal';
import { router } from 'expo-router'; 
import BoardingHouseCard from '../../components/BoardingHouseCard';
import SearchBar from '../../components/SearchBar';
import { getListings, toggleFavorite, getCurrentUser, getTenantProfile } from '../../lib/supabaseClient';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState(null);
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [tenantProfileId, setTenantProfileId] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [listings, searchQuery, activeFilters]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        return;
      }

      setUserData(user);

      // Get tenant profile
      const { profile } = await getTenantProfile(user.id);
      if (profile?.id) {
        setTenantProfileId(profile.id);
      }

      // Fetch listings from Supabase
      let filters = {};
      if (activeFilters) {
        if (activeFilters.priceRange) {
          filters.minPrice = activeFilters.priceRange[0];
          filters.maxPrice = activeFilters.priceRange[1];
        }
        if (activeFilters.roomType) {
          filters.roomType = activeFilters.roomType;
        }
        if (activeFilters.location) {
          filters.city = activeFilters.location;
        }
        if (activeFilters.minRating) {
          filters.minRating = activeFilters.minRating;
        }
      }

      const { success, listings: data } = await getListings(filters);

      if (success) {
        // Transform Supabase data to match component expectations
          // Only show available properties (not occupied)
          const transformedListings = data
            .filter(listing => listing.status !== 'occupied')
            .map(listing => {
              console.log(`[Home] Listing: ${listing.title}, Images:`, listing.images);
              return {
                id: listing.id,
                name: listing.title,
                description: listing.description,
                location: listing.city,
                address: listing.address,
                price: listing.price_per_month,
                type: (listing.room_type ? (function(enumVal){
                  const labels = {
                    single_room: 'Single Room',
                    shared_room: 'Shared Room',
                    studio: 'Studio Unit',
                    suite: 'Suite',
                    bed_space: 'Bed Space',
                  };
                  return labels[enumVal] || enumVal;
                })(listing.room_type) : 'Boarding House'),
                rating: listing.rating,
                totalReviews: listing.total_reviews,
                images: listing.images || [],
                amenities: listing.amenities || [],
                available: listing.available === undefined ? true : listing.available,
                status: listing.status || null,
                landlord: {
                  id: listing.landlord_profile?.user_id,
                  name: `${listing.landlord_profile?.users?.first_name} ${listing.landlord_profile?.users?.last_name}`,
                  image: listing.landlord_profile?.users?.profile_image_url,
                  rating: listing.landlord_profile?.rating,
                  verified: listing.landlord_profile?.bank_account_verified,
                },
                latitude: listing.latitude,
                longitude: listing.longitude,
              };
            });

          setListings(transformedListings);
      }
    } catch (error) {
      console.error('Load data error:', error);
      Alert.alert('Error', 'Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  };


  const applyFilters = (filters) => {
    // Validate price range
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      if (max < min) {
        Alert.alert('Filter Error', 'Maximum price cannot be lower than minimum price.');
        return;
      }
    }

    setActiveFilters(filters);
    setFilterModalVisible(false);
  };

  const applyFiltersAndSearch = () => {
    let filtered = listings;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(house =>
        house.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        house.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        house.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply active filters
    if (activeFilters) {
      // Price range filter
      if (activeFilters.priceRange) {
        const [min, max] = activeFilters.priceRange;
        filtered = filtered.filter(h => h.price >= min && h.price <= max);
      }

      // Room type filter
      if (activeFilters.roomType) {
        filtered = filtered.filter(h => h.type === activeFilters.roomType);
      }

      // Location filter
      if (activeFilters.location) {
        filtered = filtered.filter(h =>
          h.location.toLowerCase().includes(activeFilters.location.toLowerCase())
        );
      }

      // Amenities filter
      if (activeFilters.amenities && activeFilters.amenities.length > 0) {
        filtered = filtered.filter(h =>
          activeFilters.amenities.every(amenity =>
            h.amenities.includes(amenity)
          )
        );
      }

      // Verified landlord filter
      if (activeFilters.verifiedOnly) {
        filtered = filtered.filter(h => h.landlord?.verified);
      }

      // Minimum rating filter
      if (activeFilters.minRating) {
        filtered = filtered.filter(h => h.rating >= activeFilters.minRating);
      }
    }

    setFilteredListings(filtered);
  };

  const handleToggleFavorite = async (listingId) => {
    if (!tenantProfileId) return;
    
    try {
      const isFavorited = favorites.includes(listingId);
      const result = await toggleFavorite(tenantProfileId, listingId, isFavorited);
      
      if (result.success) {
        if (isFavorited) {
          setFavorites(favorites.filter(id => id !== listingId));
        } else {
          setFavorites([...favorites, listingId]);
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to update favorite');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite');
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading listings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ... (rest of your JSX header is unchanged) ... */}
      <View style={styles.header}> 
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>
            Hello, {userData?.first_name || 'Guest'}!
          </Text>
          <Text style={styles.subGreeting}>Find your perfect boarding house</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person-circle" size={32} color="#667eea" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ... (rest of your JSX is unchanged) ... */}
         <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search boarding houses..."
          />
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)} // Corrected state setter usage
          >
            <Ionicons name="filter" size={20} color="white" />
            {activeFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>!</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active Filters Display */}
        {activeFilters && (
          <View style={styles.activeFiltersContainer}>
            <View style={styles.activeFiltersHeader}>
              <Text style={styles.activeFiltersTitle}>Active Filters</Text>
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersList}>
              {activeFilters.roomType && (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterText}>{activeFilters.roomType}</Text>
                  <TouchableOpacity onPress={() => setActiveFilters(prev => ({ ...prev, roomType: '' }))}>
                    <Ionicons name="close" size={14} color="#667eea" />
                  </TouchableOpacity>
                </View>
              )}
              {activeFilters.location && (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterText}>{activeFilters.location}</Text>
                  <TouchableOpacity onPress={() => setActiveFilters(prev => ({ ...prev, location: '' }))}>
                    <Ionicons name="close" size={14} color="#667eea" />
                  </TouchableOpacity>
                </View>
              )}
              {activeFilters.amenities.map((amenity, index) => (
                <View key={index} style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterText}>{amenity}</Text>
                  <TouchableOpacity onPress={() => setActiveFilters(prev => ({
                    ...prev,
                    amenities: prev.amenities.filter(a => a !== amenity)
                  }))}>
                    <Ionicons name="close" size={14} color="#667eea" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.activeFilterTag}>
                <Text style={styles.activeFilterText}>
                  ₱{activeFilters.priceRange[0]} - ₱{activeFilters.priceRange[1]}
                </Text>
              </View>
              {activeFilters.verifiedOnly && (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterText}>Verified Only</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Results Count */}
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {filteredListings.length} boarding house{filteredListings.length !== 1 ? 's' : ''} found
            {searchQuery ? ` for "${searchQuery}"` : ''}
          </Text>
        </View>

        {/* Featured Listings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {searchQuery || activeFilters ? 'Search Results' : 'Featured in CDO'}
          </Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Boarding Houses List */}
        {filteredListings.length > 0 ? (
          <FlatList
            data={filteredListings}
            renderItem={({ item }) => (
              <BoardingHouseCard
                house={item}
                onPress={() => router.push(`/boarding-house-details?id=${item.id}`)}
                isFavoriteProp={favorites.includes(item.id)}
                onFavoriteChange={(listingId, newFavoriteStatus) => {
                  if (newFavoriteStatus) {
                    setFavorites([...favorites, listingId]);
                  } else {
                    setFavorites(favorites.filter(id => id !== listingId));
                  }
                }}
              />
            )}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search" size={64} color="#ccc" />
            <Text style={styles.noResultsTitle}>No boarding houses found</Text>
            <Text style={styles.noResultsText}>
              Try adjusting your search or filters to find more results.
            </Text>
            <TouchableOpacity 
              style={styles.resetSearchButton}
              onPress={() => {
                setSearchQuery('');
                setActiveFilters(null);
              }}
            >
              <Text style={styles.resetSearchText}>Reset Search</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={applyFilters}
        currentFilters={activeFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ... (all your existing styles are unchanged)
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
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subGreeting: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  profileButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  filterButton: {
    backgroundColor: '#667eea',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeFiltersContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeFiltersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  clearFiltersText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 14,
  },
  activeFiltersList: {
    flexDirection: 'row',
  },
  activeFilterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    color: '#667eea',
    fontWeight: '600',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  resetSearchButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resetSearchText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
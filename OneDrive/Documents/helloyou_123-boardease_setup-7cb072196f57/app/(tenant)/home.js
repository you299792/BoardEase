


import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FilterModal from '../../components/FilterModal';
import BoardingHouseCard from '../../components/BoardingHouseCard';
import SearchBar from '../../components/SearchBar';
import { useListings } from '../../hooks/useListings';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState(null); // This will hold the filter state object
  const boardingHouses = useListings();

  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
  };

  const filteredHouses = boardingHouses.filter(house => {
    // Search filter
    const matchesSearch = house.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         house.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         house.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!activeFilters) return matchesSearch;

    // Price range filter
    const matchesPrice = house.price >= activeFilters.priceRange[0] && 
                        house.price <= activeFilters.priceRange[1];
    
    // Room type filter
    const matchesType = !activeFilters.roomType || house.type === activeFilters.roomType;
    
    // Location filter
    const matchesLocation = !activeFilters.location || 
                           house.location.toLowerCase().includes(activeFilters.location.toLowerCase());
    
    // Amenities filter
    const matchesAmenities = activeFilters.amenities.length === 0 || 
                            activeFilters.amenities.every(amenity => 
                              house.amenities.includes(amenity));
    
    // Verified landlord filter
    const matchesVerified = !activeFilters.verifiedOnly || house.landlord.verified;

    return matchesSearch && matchesPrice && matchesType && matchesLocation && 
           matchesAmenities && matchesVerified;
  });

  const clearFilters = () => {
    // Also clear withPhotos filter if it was added
    setActiveFilters(null);
  };

  const handleHousePress = (house) => {
    console.log('Pressed house:', house.name);
  };

  const renderBoardingHouse = ({ item }) => (
    <BoardingHouseCard 
      house={item} 
      onPress={() => handleHousePress(item)}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}> 
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Hello, Tenant!</Text>
          <Text style={styles.subGreeting}>Find your perfect boarding house</Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <Ionicons name="person-circle" size={32} color="#667eea" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar and Filter */}
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
            {filteredHouses.length} boarding house{filteredHouses.length !== 1 ? 's' : ''} found
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
        {filteredHouses.length > 0 ? (
          <FlatList
            data={filteredHouses}
            renderItem={renderBoardingHouse}
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
        onApplyFilters={handleApplyFilters}
        currentFilters={activeFilters}
      />
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
    paddingTop: 20,
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
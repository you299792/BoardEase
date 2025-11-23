import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BoardingHouseCard from '../../components/BoardingHouseCard';
import {
  getCurrentUser,
  getTenantProfile,
  getFavorites,
  toggleFavorite,
} from '../../lib/supabaseClient';

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantProfileId, setTenantProfileId] = useState(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [])
  );

  // Handle System Back Action
  useFocusEffect(
    useCallback(() => {
      
      const handleBackPress = () => {
        // This function is executed when the system "Back" action occurs.
        router.replace('/(tenant)/menu');
        
        return true; 
      };
      let backHandlerSubscription; // variable to hold the listener object

      if (Platform.OS === 'android') {
        // listener and capture the returned subscription object
        backHandlerSubscription = BackHandler.addEventListener(
          'hardwareBackPress', 
          handleBackPress
        );
      }
      //Removes the listener when the screen is no longer focused.
      return () => {
        if (Platform.OS === 'android' && backHandlerSubscription) {
          backHandlerSubscription.remove();
        }
      };
    }, []) 
  );

  const loadFavorites = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not logged in');
        setIsLoading(false);
        return;
      }

      // Get tenant profile
      const { profile } = await getTenantProfile(user.id);
      if (profile?.id) {
        setTenantProfileId(profile.id);

        // Fetch favorites with listings data
        const { success, favorites: favoritesList, error } = await getFavorites(profile.id);

        if (success) {
          // Transform Supabase data to match component expectations
          const transformedFavorites = favoritesList.map(favorite => ({
            id: favorite.listings?.id,
            name: favorite.listings?.title,
            description: favorite.listings?.description,
            location: favorite.listings?.city,
            address: favorite.listings?.address,
            price: favorite.listings?.price_per_month,
            type: favorite.listings?.room_type,
            rating: favorite.listings?.rating,
            totalReviews: favorite.listings?.total_reviews,
            images: favorite.listings?.images || [],
            amenities: favorite.listings?.amenities || [],
            landlord: {
              id: favorite.listings?.landlord_profile?.user_id,
              name: `${favorite.listings?.landlord_profile?.users?.first_name} ${favorite.listings?.landlord_profile?.users?.last_name}`,
              image: favorite.listings?.landlord_profile?.users?.profile_image_url,
              rating: favorite.listings?.landlord_profile?.rating,
              verified: favorite.listings?.landlord_profile?.bank_account_verified,
            },
            latitude: favorite.listings?.latitude,
            longitude: favorite.listings?.longitude,
          }));

          setFavorites(transformedFavorites);
        } else {
          Alert.alert('Error', error || 'Failed to load favorites');
        }
      }
    } catch (error) {
      console.error('Failed to load favorites', error);
      Alert.alert('Error', 'Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromFavorites = async (listingId) => {
    try {
      if (!tenantProfileId) return;

      const result = await toggleFavorite(tenantProfileId, listingId, true);

      if (result.success) {
        setFavorites(favorites.filter(house => house.id !== listingId));
      } else {
        Alert.alert('Error', result.error || 'Failed to remove from favorites');
      }
    } catch (error) {
      console.error('Failed to remove favorite', error);
      Alert.alert('Error', 'Failed to remove from favorites');
    }
  };

  const handleHousePress = (house) => {
    router.push({
      pathname: '/(tenant)/boarding-house-details',
      params: { id: house.id }
    });
  };

  const handleRemoveFavorite = (house) => {
    Alert.alert(
      'Remove Favorite',
      `Remove ${house.name} from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeFromFavorites(house.id)
        }
      ]
    );
  };

  const renderFavoriteItem = ({ item }) => (
    <View style={styles.favoriteItem}>
      <BoardingHouseCard 
        house={item} 
        onPress={() => handleHousePress(item)}
      />
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => handleRemoveFavorite(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'My Favorites',
            headerShown: true,
            headerStyle: {
              backgroundColor: '#667eea',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 16 }}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Favorites',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#667eea',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Content */}
        {favorites.length > 0 ? (
          <FlatList
            data={favorites}
            renderItem={renderFavoriteItem}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={[styles.centerContent, styles.emptyState]}>
            <Ionicons name="heart-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              Tap the heart icon on boarding houses to add them to your favorites
            </Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => router.push('/(tenant)/home')}
            >
              <Text style={styles.browseButtonText}>Browse Houses</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  favoriteItem: {
    position: 'relative',
    marginBottom: 16,
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'white',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyState: {
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
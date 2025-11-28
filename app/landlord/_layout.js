import React, { useState, useCallback, useEffect } from 'react'; 
import { Tabs, router } from 'expo-router';
import { TouchableOpacity, Alert, ActivityIndicator } from 'react-native'; 
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { boardingHouses } from '../../data/mockData'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InquiriesTabIcon, LandlordNotificationsTabIcon } from '../../components/TabBarBadge'; 

const LISTINGS_STORAGE_KEY = '@landlord_listings';

export const GlobalListingContext = React.createContext({
    listings: boardingHouses,
    updateListing: () => {},
    deleteListing: () => {},
});

export default function LandlordLayout() {
  const primaryColor = Colors.primary || '#667eea'; 
 
  const [listingsData, setListingsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true); 

  useEffect(() => {
    const loadListingsFromStorage = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem(LISTINGS_STORAGE_KEY);
        if (jsonValue !== null) {
          setListingsData(JSON.parse(jsonValue));
        } else {
          setListingsData([]); 
        }
      } catch (e) {
        console.error("Failed to load listings", e);
        setListingsData([]); 
      } finally {
        setIsLoading(false);
      }
    };

    loadListingsFromStorage();
  }, []); 

  useEffect(() => {
    if (!isLoading) {
      const saveListingsToStorage = async () => {
        try {
          const jsonValue = JSON.stringify(listingsData);
          await AsyncStorage.setItem(LISTINGS_STORAGE_KEY, jsonValue);
        } catch (e) {
          console.error("Failed to save listings", e);
        }
      };
      saveListingsToStorage();
    }
  }, [listingsData, isLoading]); 

  const updateListing = useCallback((id, updatedPayload) => {
    setListingsData(prevListings => {
      const index = prevListings.findIndex(l => String(l.id) === String(id));
      if (index === -1) {
        const newId = Date.now();
        return [...prevListings, { id: newId, ...updatedPayload }];
      }
      const newArray = [...prevListings];
      newArray[index] = { ...newArray[index], ...updatedPayload };
      return newArray;
    });
  }, []);

  const deleteListing = useCallback((id) => {
    setListingsData(prevListings => prevListings.filter(l => String(l.id) !== String(id)));
  }, []);

  const contextValue = {
    listings: listingsData,
    updateListing: updateListing,
    deleteListing: deleteListing,
  };

  if (isLoading) {
    return (
      <ActivityIndicator size="large" color={primaryColor} style={{ flex: 1 }} />
    );
  }

  return (
    <GlobalListingContext.Provider value={contextValue}>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopColor: '#e5e5e5',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: primaryColor,
          tabBarInactiveTintColor: '#666',
          headerStyle: {
            backgroundColor: primaryColor,
          },
          headerTintColor: 'white',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {/* --- VISIBLE TABS --- */}
        <Tabs.Screen
          name="index" 
          options={{
            title: 'Dashboard',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="inquiries" 
          options={{
            title: 'Messages',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <InquiriesTabIcon color={color} size={size} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="create-listing" 
          options={{
            title: 'Add Listing',
            headerShown: true, 
            tabBarIcon: ({ color, size }) => (
              <Feather name="plus-square" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="notifications" 
          options={{
            title: 'Notifications',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <LandlordNotificationsTabIcon color={color} size={size} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="menu" 
          options={{
            title: 'Account',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="menu" size={size} color={color} />
            ),
          }}
        />

        {/* --- HIDDEN SCREENS (href: null) --- */}
        {/* These screens are reachable via navigation but don't show in the tab bar */}
        
        <Tabs.Screen name="tenants" options={{ href: null }} /> {/* <--- Added Tenants here */}
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="privacy-security" options={{ href: null }} />
        <Tabs.Screen name="financials" options={{ href: null }} />
        <Tabs.Screen name="listing-details" options={{ href: null }} />
        <Tabs.Screen name="payment-method" options={{ href: null }} />
        <Tabs.Screen name="add-payment-form" options={{ href: null }} />
        <Tabs.Screen name="chat" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="privacy" options={{ href: null }} />
        <Tabs.Screen name="terms" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="AuthContext" options={{ href: null }} />
        <Tabs.Screen name="tenantprofile" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="verify" options={{ href: null, headerShown: false }} />
      </Tabs>
    </GlobalListingContext.Provider>
  );
}
import React, { useState, useCallback } from 'react';
import { Tabs, router } from 'expo-router';
import { TouchableOpacity, Alert } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { boardingHouses } from '../../data/mockData'; // Import mock data

// Create a simple, global context object to hold and share state and functions
export const GlobalListingContext = React.createContext({
    listings: boardingHouses,
    updateListing: () => {},
    deleteListing: () => {},
});

export default function LandlordLayout() {
  const primaryColor = Colors.primary || '#667eea'; 

  // 1. Lift the listing state here
  const [listingsData, setListingsData] = useState(boardingHouses);

  // 2. Create the update function
  const updateListing = useCallback((id, updatedPayload) => {
    setListingsData(prevListings => {
      // Find the index of the listing being updated
      const index = prevListings.findIndex(l => String(l.id) === String(id));
      if (index === -1) {
        // If the ID is new (e.g., in a real app, assign a new ID)
        const newId = Date.now();
        return [...prevListings, { id: newId, ...updatedPayload }];
      }

      // If the listing exists, replace it with the new data
      const newArray = [...prevListings];
      newArray[index] = { ...newArray[index], ...updatedPayload };
      return newArray;
    });
  }, []);

  // 3. Create the delete function
  const deleteListing = useCallback((id) => {
    setListingsData(prevListings => prevListings.filter(l => String(l.id) !== String(id)));
  }, []);


  const contextValue = {
    listings: listingsData,
    updateListing: updateListing,
    deleteListing: deleteListing,
  };

  return (
    // 4. Wrap the entire application in the context provider
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
        {/* ... (Tabs.Screen components remain unchanged) ... */}
        <Tabs.Screen
          name="index" 
          options={{
            title: 'Dashboard',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="inquiries" 
          options={{
            title: 'Messages',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="create-listing" 
          options={{
            title: 'Add Listing',
            headerShown: false, 
            tabBarIcon: ({ color, size }) => (
              <Feather name="plus-square" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="notifications" 
          options={{
            title: 'Alerts',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="menu" 
          options={{
            title: 'Account',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="menu" size={size} color={color} />
            ),
          }}
        />
        
      </Tabs>
    </GlobalListingContext.Provider>
  );
}
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './landlord/AuthContext';

// Use a fallback primary color hex code. If your Landlord theme uses a different color,
// replace '#667eea' with that color.
const primaryColor = '#667eea'; 

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tenant)" options={{ headerShown: false }} />
          
          {/* 1. Landlord Tabs Group */}
          <Stack.Screen name="(landlord)" options={{ headerShown: false }} />
          
          {/* ✅ 2. CRITICAL FIX: Register the specific edit-profile screen */}
          {/* This tells the router that /landlord/edit-profile is a valid path. */}
          <Stack.Screen 
            name="landlord/edit-profile" 
            options={{ 
              title: 'Edit Profile', 
              headerTintColor: 'white', 
              headerStyle: { backgroundColor: primaryColor }, 
              tabBarStyle: { display: 'none' }, 
            }} 
          />

          
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
} 
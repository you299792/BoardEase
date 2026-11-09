import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './landlord/AuthContext';
import { useEffect } from 'react';
import { logCacheInfo } from '../lib/cachePersistence';
import { Platform } from 'react-native';


const primaryColor = '#667eea'; 

export default function RootLayout() {
  // Verify cache persistence on app startup
  useEffect(() => {
    logCacheInfo();
    // Global handler for unhandled promise rejections (e.g. keep-awake activation issues)
    const handleUnhandledRejection = (event) => {
      try {
        const reason = event && (event.reason || event);
        const msg = (reason && (reason.message || reason.toString())) || '';
        if (msg.includes && msg.includes('Unable to activate keep awake')) {
          // Silently ignore this known non-fatal error
          console.warn('[Global] Ignored keep awake activation error:', msg);
          return;
        }
      } catch (error) {
        console.warn('[Global] error while handling unhandled rejection:', error);
      }
      // For other errors, keep the default behavior (log)
      console.error('[Global] Unhandled promise rejection event:', event);
    };

    try {
      if (typeof process !== 'undefined' && process?.on) {
        process.on('unhandledRejection', handleUnhandledRejection);
      }
      if (typeof window !== 'undefined' && window?.addEventListener) {
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
      }
    } catch (e) {
      console.warn('Failed to attach unhandled rejection handler', e);
    }

    // Global error handler for synchronous exceptions
    let prevGlobalHandler = null;
    try {
      if (global && typeof global.ErrorUtils !== 'undefined' && typeof global.ErrorUtils.setGlobalHandler === 'function') {
        prevGlobalHandler = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
        global.ErrorUtils.setGlobalHandler((error, isFatal) => {
          try {
            if (error && error.message && error.message.includes('Unable to activate keep awake')) {
              console.warn('[Global] Ignored keep awake error:', error.message);
              return;
            }
          } catch (err) {
            console.warn('[Global] Error handling error:', err);
          }
          if (typeof prevGlobalHandler === 'function') {
            prevGlobalHandler(error, isFatal);
          } else {
            console.error('[Global] Uncaught error', error);
          }
        });
      }
    } catch (e) {
      // Ignore if ErrorUtils not present
    }
    
    return () => {
      try {
        if (typeof process !== 'undefined' && process?.off) {
          process.off('unhandledRejection', handleUnhandledRejection);
        } else if (typeof process !== 'undefined' && process?.removeListener) {
          process.removeListener('unhandledRejection', handleUnhandledRejection);
        }
        if (typeof window !== 'undefined' && window?.removeEventListener) {
          window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        }
        if (prevGlobalHandler && global && global.ErrorUtils && global.ErrorUtils.setGlobalHandler) {
          global.ErrorUtils.setGlobalHandler(prevGlobalHandler);
        }
      } catch (e) {
        console.warn('Error cleaning up global handlers', e);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tenant)" options={{ headerShown: false }} />
          
          
          <Stack.Screen name="landlord" options={{ headerShown: false }} />
          
          
          <Stack.Screen 
            name="landlord/edit-profile" 
            options={{ 
              title: 'Edit Profile', 
              headerTintColor: 'white', 
              headerStyle: { backgroundColor: primaryColor }, 
              tabBarStyle: { display: 'none' }, 
            }} 
          />
          <Stack.Screen 
            name="landlord/financials" 
            options={{ 
              title: 'Financials & Payments', 
              headerTintColor: 'white', 
              headerStyle: { backgroundColor: primaryColor }, 
              tabBarStyle: { display: 'none' }, 
            }} 
          />
          <Stack.Screen 
            name="landlord/settings" 
            options={{ 
              title: 'App Settings', 
              headerTintColor: 'white', 
              headerStyle: { backgroundColor: primaryColor }, 
              tabBarStyle: { display: 'none' }, 
            }} 
          />
          <Stack.Screen 
            name="landlord/support" 
            options={{ 
              title: 'Help & Support', 
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

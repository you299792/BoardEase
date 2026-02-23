import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="tenant-signup" 
        options={{ 
          headerTitle: "Tenant Sign Up",
          headerStyle: {
            backgroundColor: '#667eea',
          },
          headerTintColor: '#fff',
        }} 
      />
      <Stack.Screen 
        name="landlord-signup" 
        options={{ 
          headerTitle: "Landlord Sign Up",
          headerStyle: {
            backgroundColor: '#667eea',
          },
          headerTintColor: '#fff',
        }} 
      />
    </Stack>
  );
}
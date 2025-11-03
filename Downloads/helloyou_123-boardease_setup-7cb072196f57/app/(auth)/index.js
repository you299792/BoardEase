import { Redirect } from 'expo-router';

export default function AuthIndex() {
  // Redirect to the tenant signup by default
  return <Redirect href="/(auth)/tenant-signup" />;
}
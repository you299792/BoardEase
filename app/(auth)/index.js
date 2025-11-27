import { Redirect } from 'expo-router';

export default function AuthIndex() {
  // Redirect to the login screen by default
  return <Redirect href="/(auth)/login" />;
}
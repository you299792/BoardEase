import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Linking
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  getCurrentUser,
  getLandlordBookings,
} from '../../lib/supabaseClient';

export default function MyTenantsScreen() {
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadTenants();
    }, [])
  );

  const loadTenants = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      if (!user) return;

      // 1. Fetch all bookings for this landlord
      const { success, bookings, error } = await getLandlordBookings(user.id);

      if (success && bookings) {
        // 2. FILTER: Only show 'approved' bookings
        // This logic ensures that once you approve a booking in Chat, it appears here.
        const activeTenants = bookings.filter(
          b => b.status === 'approved' || b.status === 'occupied'
        );
        setTenants(activeTenants);
      } else {
        console.error("Error fetching bookings:", error);
      }
    } catch (error) {
      console.error('Failed to load tenants', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageTenant = (tenantId, tenantName, tenantImage, propertyName) => {
    router.push({
      pathname: '/landlord/chat',
      params: { 
        id: tenantId,
        tenantName: tenantName,
        tenantImage: tenantImage || '',
        property: propertyName
      }
    });
  };

  const handleCallTenant = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert("No Phone", "Tenant does not have a phone number listed.");
    }
  };

  const renderTenantCard = ({ item }) => {
    // Extract Tenant Data
    const tenant = item.tenant_profile?.users;
    const tenantName = tenant?.first_name 
      ? `${tenant.first_name} ${tenant.last_name}`
      : 'Unknown Tenant';
    
    const tenantImage = tenant?.profile_image_url;
    const tenantPhone = tenant?.phone;
    
    // Extract Property Data
    const propertyName = item.listings?.title || item.listings?.name || 'Property Name';
    const rentAmount = item.listings?.price || item.listings?.rent || 0;
    const moveInDate = item.move_in_date || item.created_at;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            {/* Avatar */}
            {tenantImage ? (
              <Image source={{ uri: tenantImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color="#666" />
              </View>
            )}
            
            <View>
              {/* --- REQUESTED LABEL --- */}
              <Text style={styles.occupiedLabel}>Occupied by:</Text>
              
              <Text style={styles.tenantName}>{tenantName}</Text>
              <Text style={styles.moveInDate}>Since: {new Date(moveInDate).toLocaleDateString()}</Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Occupied</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.propertyInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="home-outline" size={16} color="#666" />
            <Text style={styles.infoText} numberOfLines={1}>{propertyName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="wallet-outline" size={16} color="#666" />
            <Text style={styles.infoText}>Rent: ₱{rentAmount.toLocaleString()}/mo</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.messageBtn]}
            onPress={() => handleMessageTenant(item.tenant_id, tenantName, tenantImage, propertyName)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.callBtn]}
            onPress={() => handleCallTenant(tenantPhone)}
          >
            <Feather name="phone" size={18} color="#10b981" />
            <Text style={[styles.actionText, {color: '#10b981'}]}>Call</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Tenants',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={tenants}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTenantCard}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No active tenants.</Text>
                <Text style={styles.emptySubText}>
                  When you approve a booking request in your chat, the tenant will appear here.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', 
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // --- NEW STYLE FOR "Occupied by:" ---
  occupiedLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    fontStyle: 'italic',
  },
  tenantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  moveInDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  propertyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#444',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  messageBtn: {
    borderColor: Colors.primary,
    backgroundColor: '#f0f4ff',
  },
  callBtn: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
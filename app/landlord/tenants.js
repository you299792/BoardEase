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
  Linking,
  RefreshControl
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  getCurrentUser,
  getLandlordBookings,
  deleteBooking // Assume this helper function exists or we use supabase directly
} from '../../lib/supabaseClient';
import { supabase } from '../../lib/supabaseClient'; // Import supabase directly for delete if helper missing

export default function MyTenantsScreen() {
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTenants();
    }, [])
  );

  const loadTenants = async () => {
    try {
      if (!refreshing) setIsLoading(true);
      const user = await getCurrentUser();
      if (!user) return;

      const { success, bookings, error } = await getLandlordBookings(user.id);

      if (success && bookings) {
        const normalized = bookings.map(b => ({
          ...b,
          listings: b.listing ? b.listing : b.listings,
          tenant_profile: b.tenant_profile ? b.tenant_profile : { users: b.tenant },
          tenant_id: b.tenant_profile?.id || b.tenant_id || (b.tenant ? b.tenant.id : null),
          next_due_date: calculateNextDueDate(b.move_in_date || b.created_at)
        }));

        const activeTenants = normalized.filter(b => {
          const status = b.status ? b.status.toLowerCase() : '';
          return status === 'approved' || status === 'occupied';
        });

        setTenants(activeTenants);
      } else {
        console.error("Error fetching bookings:", error);
      }
    } catch (error) {
      console.error('Failed to load tenants', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const calculateNextDueDate = (moveInDateStr) => {
    if (!moveInDateStr) return null;
    const moveIn = new Date(moveInDateStr);
    const today = new Date();
    let nextDue = new Date(moveIn);
    while (nextDue <= today) {
      nextDue.setDate(nextDue.getDate() + 30);
    }
    return nextDue.toISOString();
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTenants();
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

  // --- DELETE LOGIC ---
  const handleDeleteTenant = (bookingId, tenantName) => {
    Alert.alert(
      "Remove Tenant",
      `Are you sure you want to remove ${tenantName} from your active tenants? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            try {
              // Delete from Supabase 'bookings' table
              const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', bookingId);

              if (error) {
                Alert.alert("Error", "Failed to remove tenant. Please try again.");
                console.error(error);
              } else {
                // Optimistically remove from list
                setTenants(prev => prev.filter(t => t.id !== bookingId));
                Alert.alert("Success", "Tenant removed successfully.");
              }
            } catch (err) {
              Alert.alert("Error", "An unexpected error occurred.");
            }
          } 
        }
      ]
    );
  };

  const renderTenantCard = ({ item }) => {
    const tenant = item.tenant || item.tenant_profile?.users;
    const tenantName = tenant?.first_name 
      ? `${tenant.first_name} ${tenant.last_name}`
      : 'Unknown Tenant';
    const tenantImage = tenant?.profile_image_url;
    const tenantPhone = tenant?.phone;
    const propertyName = item.listings?.title || item.listings?.name || 'Property Name';
    const rentAmount = item.listings?.price || item.listings?.rent || 0;
    const moveInDate = item.move_in_date || item.created_at;
    const dueDate = item.next_due_date;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            {tenantImage ? (
              <Image source={{ uri: tenantImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color="#666" />
              </View>
            )}
            <View style={{flex: 1}}>
              <Text style={styles.occupiedLabel}>Occupied by:</Text>
              <Text style={styles.tenantName}>{tenantName}</Text>
              <Text style={styles.moveInDate}>Since: {new Date(moveInDate).toLocaleDateString()}</Text>
              
              {dueDate && (
                  <>
                    <Text style={[styles.dueDateText, {marginTop:4}]}>
                      Next Due: {new Date(dueDate).toLocaleDateString()}
                    </Text>
                    {(() => {
                      const today = new Date();
                      const due = new Date(dueDate);
                      const diffTime = due - today;
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays <= 5 && diffDays >= 0) {
                        return (
                          <Text style={{color:'#d97706', fontWeight:'bold', fontSize:12, marginTop:2}}>
                            ⚠️ Due in {diffDays} day{diffDays !== 1 ? 's' : ''}
                          </Text>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}
            </View>
          </View>
          
          {/* Status & Delete Icon Container */}
          <View style={{alignItems: 'flex-end'}}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Occupied</Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteIconBtn} 
              onPress={() => handleDeleteTenant(item.id, tenantName)}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
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
            <TouchableOpacity onPress={() => router.replace('/landlord/menu')} style={{ marginLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {isLoading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={tenants}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTenantCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No active tenants.</Text>
                <Text style={styles.emptySubText}>
                  When you approve a booking request in your chat, the tenant will appear here.
                </Text>
                <TouchableOpacity onPress={onRefresh} style={{marginTop:20, padding:10, backgroundColor:Colors.primary, borderRadius:8}}>
                   <Text style={{color:'white'}}>Refresh List</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  occupiedLabel: { fontSize: 12, color: '#666', marginBottom: 2, fontStyle: 'italic' },
  tenantName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  moveInDate: { fontSize: 12, color: '#888', marginTop: 2 },
  dueDateText: { fontSize: 12, color: '#444', fontWeight: '600' },
  statusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  statusText: { fontSize: 11, color: '#166534', fontWeight: '600' },
  deleteIconBtn: { padding: 8, alignSelf: 'flex-end' }, // New delete icon style
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  propertyInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  infoText: { fontSize: 14, color: '#444' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6, borderWidth: 1 },
  messageBtn: { borderColor: Colors.primary, backgroundColor: '#f0f4ff' },
  callBtn: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  actionText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 16 },
  emptySubText: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
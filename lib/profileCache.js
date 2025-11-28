/**
 * Profile Cache Utility
 * Purpose: Persistent storage of user profile data for offline access
 * Ensures profiles remain accessible even after session expiration or offline periods
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TENANT_PROFILE_KEY = '@tenant_profile_cache';
const LANDLORD_PROFILE_KEY = '@landlord_profile_cache';
const USER_TYPE_KEY = '@user_type';
const PROFILE_METADATA_KEY = '@profile_metadata';

/**
 * Save Tenant Profile to Local Storage
 * @param {string} userId - User ID
 * @param {object} userData - User data from users table
 * @param {object} profileData - Profile data from tenant_profile table
 */
export const saveTenantProfile = async (userId, userData, profileData) => {
  try {
    const cacheData = {
      userId,
      userData,
      profileData,
      cachedAt: new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(TENANT_PROFILE_KEY, JSON.stringify(cacheData));
    await AsyncStorage.setItem(USER_TYPE_KEY, 'tenant');
    
    // Save metadata
    const metadata = {
      userId,
      userType: 'tenant',
      lastUpdated: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PROFILE_METADATA_KEY, JSON.stringify(metadata));
    
    console.log('✅ Tenant profile cached successfully');
    return true;
  } catch (error) {
    console.error('Failed to cache tenant profile:', error);
    return false;
  }
};

/**
 * Save Landlord Profile to Local Storage
 * @param {string} userId - User ID
 * @param {object} userData - User data from users table
 * @param {object} profileData - Profile data from landlord_profile table
 */
export const saveLandlordProfile = async (userId, userData, profileData) => {
  try {
    const cacheData = {
      userId,
      userData,
      profileData,
      cachedAt: new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(LANDLORD_PROFILE_KEY, JSON.stringify(cacheData));
    await AsyncStorage.setItem(USER_TYPE_KEY, 'landlord');
    
    // Save metadata
    const metadata = {
      userId,
      userType: 'landlord',
      lastUpdated: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PROFILE_METADATA_KEY, JSON.stringify(metadata));
    
    console.log('✅ Landlord profile cached successfully');
    return true;
  } catch (error) {
    console.error('Failed to cache landlord profile:', error);
    return false;
  }
};

/**
 * Get Cached Tenant Profile
 * @returns {object|null} Cached profile data or null if not found
 */
export const getCachedTenantProfile = async () => {
  try {
    const cached = await AsyncStorage.getItem(TENANT_PROFILE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      console.log('📦 Retrieved cached tenant profile');
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to retrieve cached tenant profile:', error);
    return null;
  }
};

/**
 * Get Cached Landlord Profile
 * @returns {object|null} Cached profile data or null if not found
 */
export const getCachedLandlordProfile = async () => {
  try {
    const cached = await AsyncStorage.getItem(LANDLORD_PROFILE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      console.log('📦 Retrieved cached landlord profile');
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to retrieve cached landlord profile:', error);
    return null;
  }
};

/**
 * Get Cached User Type
 * @returns {string|null} 'tenant', 'landlord', or null
 */
export const getCachedUserType = async () => {
  try {
    const userType = await AsyncStorage.getItem(USER_TYPE_KEY);
    return userType;
  } catch (error) {
    console.error('Failed to retrieve cached user type:', error);
    return null;
  }
};

/**
 * Get Profile Metadata (last update time, user type, etc.)
 * @returns {object|null} Metadata or null
 */
export const getProfileMetadata = async () => {
  try {
    const metadata = await AsyncStorage.getItem(PROFILE_METADATA_KEY);
    if (metadata) {
      return JSON.parse(metadata);
    }
    return null;
  } catch (error) {
    console.error('Failed to retrieve profile metadata:', error);
    return null;
  }
};

/**
 * Clear All Cached Profile Data (for logout)
 */
export const clearAllProfileCache = async () => {
  try {
    await AsyncStorage.multiRemove([
      TENANT_PROFILE_KEY,
      LANDLORD_PROFILE_KEY,
      USER_TYPE_KEY,
      PROFILE_METADATA_KEY,
    ]);
    console.log('🗑️ All profile cache cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear profile cache:', error);
    return false;
  }
};

/**
 * Update Cached Tenant Profile (partial update)
 * @param {object} updates - Fields to update
 */
export const updateCachedTenantProfile = async (updates) => {
  try {
    const cached = await getCachedTenantProfile();
    if (!cached) {
      console.warn('No cached tenant profile to update');
      return false;
    }

    const { userUpdates, profileUpdates } = updates;
    
    if (userUpdates) {
      cached.userData = { ...cached.userData, ...userUpdates };
    }
    
    if (profileUpdates) {
      cached.profileData = { ...cached.profileData, ...profileUpdates };
    }
    
    cached.cachedAt = new Date().toISOString();
    
    await AsyncStorage.setItem(TENANT_PROFILE_KEY, JSON.stringify(cached));
    console.log('✅ Cached tenant profile updated');
    return true;
  } catch (error) {
    console.error('Failed to update cached tenant profile:', error);
    return false;
  }
};

/**
 * Update Cached Landlord Profile (partial update)
 * @param {object} updates - Fields to update
 */
export const updateCachedLandlordProfile = async (updates) => {
  try {
    const cached = await getCachedLandlordProfile();
    if (!cached) {
      console.warn('No cached landlord profile to update');
      return false;
    }

    const { userUpdates, profileUpdates } = updates;
    
    if (userUpdates) {
      cached.userData = { ...cached.userData, ...userUpdates };
    }
    
    if (profileUpdates) {
      cached.profileData = { ...cached.profileData, ...profileUpdates };
    }
    
    cached.cachedAt = new Date().toISOString();
    
    await AsyncStorage.setItem(LANDLORD_PROFILE_KEY, JSON.stringify(cached));
    console.log('✅ Cached landlord profile updated');
    return true;
  } catch (error) {
    console.error('Failed to update cached landlord profile:', error);
    return false;
  }
};

/**
 * Check if profile cache exists
 * @returns {boolean}
 */
export const hasProfileCache = async () => {
  try {
    const userType = await getCachedUserType();
    if (!userType) return false;
    
    const key = userType === 'tenant' ? TENANT_PROFILE_KEY : LANDLORD_PROFILE_KEY;
    const cached = await AsyncStorage.getItem(key);
    return cached !== null;
  } catch (error) {
    return false;
  }
};

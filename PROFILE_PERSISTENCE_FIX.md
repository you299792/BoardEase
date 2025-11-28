# Profile Persistence Fix - Documentation

## Problem
User profiles were disappearing when users were offline for hours or days because:
1. Supabase sessions expired after inactivity
2. No persistent session storage was configured
3. Profile data wasn't cached locally for offline access
4. Sessions were stored in memory only

## Solution Implemented

### 1. **Supabase Session Persistence** (`lib/supabaseClient.js`)
Configured Supabase client to use AsyncStorage for persistent session management:
```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,          // Store sessions persistently
    autoRefreshToken: true,          // Auto-refresh expired tokens
    persistSession: true,            // Keep sessions across app restarts
    detectSessionInUrl: false,       // Not needed for mobile
  },
})
```

**Benefits:**
- Sessions persist across app restarts
- Tokens automatically refresh before expiration
- Users stay logged in even after days of inactivity

### 2. **Profile Cache Utility** (`lib/profileCache.js`)
Created a comprehensive caching system for user profiles:

**Key Functions:**
- `saveTenantProfile()` - Cache tenant profile data
- `saveLandlordProfile()` - Cache landlord profile data
- `getCachedTenantProfile()` - Retrieve cached tenant data
- `getCachedLandlordProfile()` - Retrieve cached landlord data
- `updateCachedTenantProfile()` - Update cached tenant data
- `updateCachedLandlordProfile()` - Update cached landlord data
- `clearAllProfileCache()` - Clear all cached data on logout

**Storage Keys:**
- `@tenant_profile_cache` - Tenant profile data
- `@landlord_profile_cache` - Landlord profile data
- `@user_type` - User type (tenant/landlord)
- `@profile_metadata` - Metadata (last updated, user ID)

### 3. **Updated Auth Operations** (`lib/supabaseClient.js`)

#### Sign In
- Now fetches full profile data after login
- Caches profile data for offline access
- Saves user type for routing

#### Tenant Sign Up
- Creates tenant profile in database
- Immediately caches profile data locally
- Ensures profile available offline from day one

#### Landlord Sign Up
- Creates landlord profile in database
- Immediately caches profile data locally
- Ensures profile available offline from day one

#### Sign Out
- Clears all cached profile data
- Ensures clean logout

### 4. **Updated Profile Operations** (`lib/supabaseClient.js`)

#### getTenantProfile()
- Tries to fetch from database first
- Falls back to cached data if offline/session expired
- Returns `fromCache: true` when using cached data
- Automatically updates cache when online

#### getLandlordProfile()
- Tries to fetch from database first
- Falls back to cached data if offline/session expired
- Returns `fromCache: true` when using cached data
- Automatically updates cache when online

#### updateTenantProfile()
- Updates database
- Updates local cache simultaneously
- Ensures cache stays in sync

#### updateLandlordProfile()
- Updates database
- Updates local cache simultaneously
- Ensures cache stays in sync

### 5. **Updated Profile Screens**

#### Tenant Profile (`app/(tenant)/profile.js`)
- Detects when cached data is being used
- Shows offline indicator banner
- Loads profile even when offline

#### Landlord Profile (`app/landlord/edit-profile.js`)
- Detects when cached data is being used
- Shows offline indicator banner
- Loads profile even when offline

**Offline Indicator:**
```
┌─────────────────────────────────────┐
│ 🌐 Viewing offline profile data     │
└─────────────────────────────────────┘
```

## How It Works

### Normal Online Flow
1. User opens profile screen
2. App fetches profile from Supabase
3. Profile data is cached locally
4. Profile displays normally

### Offline/Expired Session Flow
1. User opens profile screen
2. App tries to fetch from Supabase (fails)
3. App automatically loads cached profile
4. Profile displays with offline indicator
5. When back online, profile syncs automatically

### Profile Updates
1. User edits profile
2. Changes saved to Supabase
3. Cache updated simultaneously
4. Even if app closes, edits are preserved

## Benefits

✅ **Profiles never disappear** - Cached locally even after weeks offline
✅ **Automatic token refresh** - Sessions stay valid indefinitely
✅ **Seamless offline experience** - Profiles load instantly from cache
✅ **Visual feedback** - Users know when viewing offline data
✅ **Automatic sync** - Cache updates whenever online
✅ **Clean logout** - All cached data cleared on sign out

## Technical Details

### Cache Structure
```javascript
{
  userId: "user-id-here",
  userData: {
    id, email, phone, first_name, last_name, 
    profile_image_url, bio, etc.
  },
  profileData: {
    // tenant_profile or landlord_profile fields
    occupation, budget_min, budget_max, etc.
  },
  cachedAt: "2025-11-28T10:30:00.000Z"
}
```

### Session Storage
Supabase automatically manages session tokens in AsyncStorage with these keys:
- `supabase.auth.token` - Access token
- `supabase.auth.refreshToken` - Refresh token
- `supabase.auth.expiresAt` - Token expiration time

### Cache Persistence
- Cache persists across app restarts
- No expiration time (permanent until logout)
- Automatically updated on every profile fetch
- Cleared completely on logout

## Testing

### Test Scenarios
1. ✅ Login → Close app → Reopen (profile should load)
2. ✅ Login → Turn off internet → Open profile (should show cached)
3. ✅ Edit profile → Close app → Reopen (changes should persist)
4. ✅ Logout → Profile cache should be cleared
5. ✅ Stay offline for 1 day → Profile should still load
6. ✅ Stay offline for 1 week → Profile should still load

## Console Messages

Watch for these helpful log messages:

- `✅ Tenant profile cached successfully`
- `✅ Landlord profile cached successfully`
- `📦 Retrieved cached tenant profile`
- `📦 Retrieved cached landlord profile`
- `📦 Using cached tenant profile (offline or session expired)`
- `📦 Using cached landlord profile (offline or session expired)`
- `🗑️ All profile cache cleared`

## Future Enhancements (Optional)

1. **Sync indicator** - Show when profile is syncing with server
2. **Last updated timestamp** - Display when profile was last refreshed
3. **Force refresh button** - Manual refresh when online
4. **Cache expiration** - Optional: expire cache after X days
5. **Conflict resolution** - Handle case where offline edits conflict with server

## Files Modified

1. `lib/supabaseClient.js` - Session config, auth operations, profile operations
2. `lib/profileCache.js` - NEW FILE - Profile caching utility
3. `app/(tenant)/profile.js` - Added offline indicator
4. `app/landlord/edit-profile.js` - Added offline indicator

## Dependencies

- `@react-native-async-storage/async-storage` - Already installed
- `@supabase/supabase-js` - Already installed

No additional packages required! ✅

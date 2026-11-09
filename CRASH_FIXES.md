# APK Crash Fixes - Login, Signup & Critical Operations

## Issues Found & Fixed

### 1. **Unhandled `.single()` Errors in Login Flow** ❌ FIXED
**Location:** `lib/supabaseClient.js` - `signIn()` function (line 288)

**Problem:** 
- When fetching user profiles after successful login, `.single()` throws if:
  - No user record exists in `users` table
  - Multiple records match (shouldn't happen but Supabase throws)
- The app crashes without a try-catch wrapper

**Fix:**
- Changed `.single()` to `.maybeSingle()` (returns null instead of throwing)
- Added proper error checking before accessing user data
- Wrapped profile fetch in try-catch to prevent caching errors from crashing

```javascript
// BEFORE (CRASHES):
const { data: userData, error: userError } = await supabase
  .from('users')
  .select('*')
  .eq('id', data.user.id)
  .single()  // ❌ THROWS if record not found

// AFTER (SAFE):
const { data: userData, error: userError } = await supabase
  .from('users')
  .select('*')
  .eq('id', data.user.id)
  .maybeSingle()  // ✅ Returns null if not found
```

---

### 2. **Unhandled Profile Caching Errors in Signup** ❌ FIXED
**Location:** `lib/supabaseClient.js` - `tenantSignUp()` and `landlordSignUp()` functions

**Problem:**
- After successful user/profile creation, the functions try to cache to AsyncStorage
- If caching fails (disk full, permissions issue), the entire signup crashes
- User can't proceed even though account was created

**Fix:**
- Wrapped profile caching in try-catch blocks
- Changed error handling from `throw` to `console.warn()`
- Signup succeeds even if caching fails (non-critical operation)

```javascript
// BEFORE (CRASHES):
await saveTenantProfile(userId, userData, profileData);  // ❌ Uncaught error crashes app

// AFTER (SAFE):
try {
  await saveTenantProfile(userId, userData, profileData);
} catch (cacheError) {
  console.warn('Failed to cache profile:', cacheError);
  // Continue - caching is non-critical
}
```

---

### 3. **Missing Navigation Safety Checks** ❌ FIXED
**Location:** 
- `app/(auth)/login.js` - `handleLogin()` function
- `app/(auth)/tenant-signup.js` - `handleSignUp()` function
- `app/(auth)/landlord-signup.js` - `handleSubmit()` function

**Problem:**
- Router navigation could fail if user object is incomplete
- Image uploads could fail but crash the signup flow
- No try-catch around router.replace() calls

**Fix:**
- Added validation before routing:
  ```javascript
  if (!user || !user.user_type) {
    Alert.alert('Error', 'User profile is incomplete.');
    return;
  }
  ```
- Wrapped router navigation in try-catch
- Wrapped image uploads in try-catch (non-critical)

---

### 4. **Other Dangerous `.single()` Calls** ❌ PARTIALLY FIXED
**Location:** Multiple functions in `lib/supabaseClient.js`

Functions that could crash when records don't exist:
- `getTenantProfile()` (line 437) - **FIXED**
- `getUserProfile()` (line 395) - **FIXED**
- `getLandlordProfile()` - Already using `maybeSingle()`

Other `.single()` calls (line 721, 761, 882, etc.) are in less critical paths but should be reviewed:
- `getListingsForTenant()` - Used after login
- `createBooking()` - Used when booking
- `sendMessage()` - Used in chat
- And many more database queries

---

## Why APK Crashes When Creating Account

The most likely scenarios:

1. **AsyncStorage write fails** (PRIMARY)
   - Disk full / permissions issue
   - Profile caching throws uncaught error
   - Entire signup flow crashes after account is created

2. **User exists in auth but NOT in `users` table** (SECONDARY)
   - Signup process fails partway through
   - `.single()` throws "No rows returned"
   - App crashes before showing success message

3. **Navigation fails**
   - Invalid route path
   - Router state not ready
   - Unhandled error during navigation

4. **Image upload fails**
   - Network issue during upload
   - Uncaught error crashes the signup

---

## Why APK Crashes When Logging In

The most likely scenarios:

1. **User exists in auth but NOT in `users` table**
   - Signup process failed to create user record
   - `.single()` throws "No rows returned"
   - App crashes instantly after successful password verification

2. **User type not set in database**
   - `user_type` field is NULL or missing
   - Router can't determine which screen to open
   - Navigation fails, app crashes

3. **Profile caching throws an error**
   - AsyncStorage write fails (disk full, permissions)
   - Error bubbles up and crashes login flow

4. **Router navigation fails**
   - Invalid path provided
   - Missing route definition
   - Unhandled error in route handler

---

## Testing Checklist

After applying these fixes, test:

**Login Tests:**
- [ ] Log in with correct credentials → Should work without crashing
- [ ] Log in with incorrect credentials → Should show error alert
- [ ] Verify user is routed to tenant home OR landlord portal
- [ ] Check if profile was cached (check AsyncStorage)
- [ ] Clear AsyncStorage and test login again → Should fetch from Supabase
- [ ] Test on slow network → Timeout handling
- [ ] Test with missing user record → Should show user-friendly error

**Signup Tests:**
- [ ] Create tenant account → Should complete without crashing
- [ ] Create landlord account (no image) → Should complete without crashing
- [ ] Create landlord account (with image) → Should complete even if upload fails
- [ ] Try duplicate email → Should show error alert
- [ ] Test on slow network → Should handle timeouts gracefully
- [ ] Verify user is logged in after signup
- [ ] Check if profile was cached

---

## Additional Recommendations

1. **Database Constraints:**
   - Add NOT NULL constraint on `users.user_type`
   - Add foreign key: `tenant_profile.user_id` → `users.id`
   - Add foreign key: `landlord_profile.user_id` → `users.id`

2. **Code Review:**
   - Audit all `.single()` calls throughout codebase
   - Consider creating utility wrapper functions:
     ```javascript
     const safeQuery = {
       single: async (query) => {
         try {
           return await query.single();
         } catch (err) {
           if (err.code === 'PGRST116') return { data: null, error: null };
           throw err;
         }
       }
     }
     ```

3. **Error Monitoring:**
   - Add Sentry or similar error tracking
   - Log all Supabase errors with context
   - Monitor AsyncStorage failures

4. **User Feedback:**
   - Show loading spinner during profile fetch
   - Display helpful error messages (not just "Login failed")
   - Provide "Retry" or "Contact Support" options

5. **AsyncStorage Optimization:**
   - Add storage size limits
   - Implement cleanup of old cached data
   - Handle storage quota errors gracefully

---

## Files Modified

- ✅ `lib/supabaseClient.js` - Fixed signIn(), tenantSignUp(), landlordSignUp(), getTenantProfile(), getUserProfile()
- ✅ `app/(auth)/login.js` - Added navigation safety checks
- ✅ `app/(auth)/tenant-signup.js` - Added image upload and navigation error handling
- ✅ `app/(auth)/landlord-signup.js` - Added image upload and navigation error handling

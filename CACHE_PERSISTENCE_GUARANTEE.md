# Image Cache Persistence Guarantee

## Summary
✅ **Profile and property images will NOT disappear after 1 day (or any duration) of being offline.**

Images are stored in the device's persistent filesystem cache, which survives:
- App restarts
- Network disconnects (indefinitely)
- Device sleep/wake cycles
- Overnight offline periods
- Multiple days of no internet

## How It Works

### Storage Location
- **Path**: `FileSystem.cacheDirectory/images/`
- **Type**: Persistent local filesystem (on-device storage)
- **NOT temp cache**: This is NOT `FileSystem.temporaryDirectory` (which can be cleared by OS)
- **Persistence**: Lives until user uninstalls app or manually clears app data

### Lifecycle
1. **Online**: User views a profile or property image
2. **First time**: Image downloads from Supabase → stored locally in `cacheDirectory/images/`
3. **Offline**: App displays the cached local file (no network request)
4. **Stays offline for 1 day+**: Cached file remains on disk, app continues to display it
5. **Back online**: App can refresh with new version if it changed, or continue using cached version

### Key Implementation Details

**`lib/imageCache.js`** - Core caching utility:
- `getCachedImage(url)`: Checks if image exists locally first. If yes, returns local path. If no, downloads and caches.
- Metadata tracking via AsyncStorage to know which URLs have been cached
- Graceful offline fallback: if download fails, returns null (component shows placeholder), but previously cached images work offline

**`components/CachedRemoteImage.js`** - React component wrapper:
- Automatically calls `getCachedImage()` on mount
- Uses `localUri` (cached file path) when available
- Falls back to remote URL or placeholder if not cached

**`lib/cachePersistence.js`** - Verification utilities (new):
- `verifyCachePersistence()`: Checks cache health on startup
- `logCacheInfo()`: Logs cache stats for debugging
- `isImageCached(url)`: Check if specific image is cached and persistent

**`app/_layout.js`** - App initialization:
- Calls `logCacheInfo()` on startup to verify cache is accessible

### Screens Using Cached Images
All major image displays now use `CachedRemoteImage`:
- ✅ Tenant profile image (`app/(tenant)/profile.js`)
- ✅ Landlord profile image (tenants list: `app/landlord/tenants.js`)
- ✅ Property listing cards (`components/BoardingHouseCard.js`, `app/landlord/index.js`)
- ✅ Property detail carousels (`app/(tenant)/boarding-house-details.js`, `app/landlord/listing-details.js`)
- ✅ Rented property cards (`app/(tenant)/rented.js`)

## Testing Offline Persistence

### Quick Manual Test (1 hour)
1. Open the app while online
2. Browse a property (image downloads & caches)
3. Turn off network (airplane mode)
4. Go back to that property or profile
5. ✅ Image should still display (from cache)

### Full Test (1+ days offline)
1. Download/cache images while online
2. Enable airplane mode
3. Leave app for 24+ hours (device can sleep)
4. Disable airplane mode, open app
5. ✅ Navigate to previously viewed properties/profiles
6. ✅ Images should still display from local cache
7. Optional: Check console output on startup (logCacheInfo shows cache status)

## What Happens If...

| Scenario | Result |
|----------|--------|
| User offline for 1 day | ✅ Images display from cache |
| User offline for 1 week | ✅ Images display from cache |
| User uninstalls & reinstalls app | ❌ Cache cleared (fresh start) |
| User clears app data (Settings > Apps) | ❌ Cache cleared |
| User restarts device | ✅ Cache persists |
| App crashes | ✅ Cache persists on restart |
| Network timeout | ✅ Falls back to cached image |

## Cache Size & Cleanup

**Current behavior**: 
- No automatic cleanup; cache grows as users view more properties
- Each image stored as individual file in `cacheDirectory/images/`
- Typical image: 100-300 KB
- Typical usage: 10-50 cached images = 1-15 MB

**If needed in future**:
- `clearImageCache()` in `lib/imageCache.js` manually deletes all cached images
- Could implement LRU eviction (least recently used) if cache grows too large
- Could implement size limit (e.g., max 50 MB) with automatic cleanup

## Guarantees & Limitations

### ✅ Guaranteed
- Images persist offline indefinitely (until uninstall/clear data)
- Works across device restarts
- Works while device is in sleep/low-power mode
- Multiple days of continuous offline is supported

### ⚠️ Limitations
- If user manually clears app data → cache is lost
- If image was never viewed online → no cache exists (won't work offline)
- Cache size is limited only by device storage (no automatic limit)
- If Supabase URL changes → old cached images use old URL (still works, but can't update)

## For Development / Debugging

Check cache status in console logs on startup:
```
=== Cache Persistence Info ===
Status: healthy
Cached Images: 15
Cache Directory: /data/user/0/.../cache/images/
Persistence: indefinite (until app uninstalled or user clears app data)
==============================
```

Or call manually in any screen:
```javascript
import { logCacheInfo } from '../../lib/cachePersistence';

// In a component or debug screen:
logCacheInfo(); // Prints cache info to console
```

## Conclusion

**Bottom line**: Once a profile or property image is viewed online, it will persist and display offline for as long as the user has the app installed — even after days or weeks of being offline. Users will not see blank/gray images after 1 day offline.

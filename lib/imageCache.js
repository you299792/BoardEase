import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Persistent image cache: images stored in FileSystem.cacheDirectory/images/ persist across app restarts
// and offline periods (days or weeks). Uses AsyncStorage metadata to track cache entries.
// Usage: const localUri = await getCachedImage(remoteUrl)

const IMAGES_DIR = `${FileSystem.cacheDirectory}images/`;
const CACHE_METADATA_KEY = '@image_cache_metadata';

export const ensureImagesDir = async () => {
  try {
    const info = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    }
  } catch (err) {
    // ignore
  }
};

const filenameForUrl = (url) => {
  if (!url) return null;
  // Keep filename short and filesystem-safe
  return encodeURIComponent(url).slice(0, 200);
};

// Helper: save metadata to AsyncStorage so we know which images are cached
const saveCacheMetadata = async (url, filename) => {
  try {
    const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    const cache = metadata ? JSON.parse(metadata) : {};
    cache[url] = {
      filename,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(cache));
  } catch (err) {
    // ignore metadata errors; cache still works without it
  }
};

// Helper: load metadata to check if image was previously cached
const getCacheMetadata = async (url) => {
  try {
    const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    return metadata ? JSON.parse(metadata)[url] : null;
  } catch (err) {
    return null;
  }
};

export const getCachedImage = async (url) => {
  if (!url) return null;
  try {
    await ensureImagesDir();
    const filename = filenameForUrl(url);
    if (!filename) return null;
    const path = `${IMAGES_DIR}${filename}`;

    // Check if file exists on disk (most reliable for offline persistence)
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      // File exists; return it immediately (works offline indefinitely)
      return path;
    }

    // File doesn't exist; try to download from remote URL
    try {
      const result = await FileSystem.downloadAsync(url, path);
      if (result && result.status === 200) {
        // Save metadata so we know the image was cached
        await saveCacheMetadata(url, filename);
        return result.uri;
      }
    } catch (downloadErr) {
      // Download failed (e.g., offline); check if we have metadata indicating it was cached before
      const metadata = await getCacheMetadata(url);
      if (metadata) {
        // Metadata exists but file doesn't; this is unusual (user may have cleared app data)
        console.warn('Image metadata exists but file missing:', url);
      }
    }

    return null;
  } catch (err) {
    console.warn('getCachedImage error', err?.message || err);
    return null;
  }
};

export const clearImageCache = async () => {
  try {
    const info = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(IMAGES_DIR, { idempotent: true });
    }
    // Also clear metadata
    await AsyncStorage.removeItem(CACHE_METADATA_KEY);
  } catch (err) {
    // ignore
  }
};

// Helper: get cache stats (useful for debugging)
export const getCacheStats = async () => {
  try {
    const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    const cache = metadata ? JSON.parse(metadata) : {};
    const files = await FileSystem.readDirectoryAsync(IMAGES_DIR);
    return {
      cachedUrls: Object.keys(cache).length,
      cachedFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
      cacheDir: IMAGES_DIR,
    };
  } catch (err) {
    return { error: err.message };
  }
};

export default { getCachedImage, clearImageCache, getCacheStats, ensureImagesDir };

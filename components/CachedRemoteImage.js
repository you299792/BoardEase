import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import { getCachedImage } from '../lib/imageCache';

export default function CachedRemoteImage({ uri, style, placeholder }) {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (!uri) {
          console.log('[CachedRemoteImage] No URI provided');
          return;
        }
        console.log(`[CachedRemoteImage] Loading image: ${uri}`);
        const cached = await getCachedImage(uri);
        if (mounted && cached) {
          console.log(`[CachedRemoteImage] Cached image found: ${cached}`);
          setLocalUri(cached);
        } else if (mounted) {
          console.log(`[CachedRemoteImage] No cached image, using remote: ${uri}`);
        }
      } catch (err) {
        console.warn('[CachedRemoteImage] Cache load error:', err);
      }
    };

    load();

    return () => { mounted = false; };
  }, [uri]);

  const finalUri = localUri || uri || placeholder;
  console.log(`[CachedRemoteImage] Rendering with URI:`, finalUri);

  return (
    <Image source={{ uri: finalUri }} style={style} />
  );
}

import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import { getCachedImage } from '../lib/imageCache';

export default function CachedRemoteImage({ uri, style, placeholder }) {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (!uri) return;
        const cached = await getCachedImage(uri);
        if (mounted && cached) setLocalUri(cached);
      } catch (err) {
        // ignore
      }
    };

    load();

    return () => { mounted = false; };
  }, [uri]);

  return (
    <Image source={{ uri: localUri || uri || placeholder }} style={style} />
  );
}

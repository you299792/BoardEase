import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function OpenStreetMap({ latitude, longitude, zoom = 15, style, onLocationSelect }) {
  const [marker, setMarker] = useState({ latitude, longitude });

  // Create OpenStreetMap URL with marker at selected location
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${marker.longitude - 0.01},${marker.latitude - 0.01},${marker.longitude + 0.01},${marker.latitude + 0.01}&layer=mapnik&marker=${marker.latitude},${marker.longitude}`;

  // Inject JS to capture clicks and send coordinates
  const injectedJS = `
    document.addEventListener('click', function(e) {
      var map = document.getElementById('map');
      if (!map) return;
      var rect = map.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var width = rect.width;
      var height = rect.height;
      var lat = ${marker.latitude} + ((height/2 - y) * 0.00018 * ${zoom});
      var lon = ${marker.longitude} + ((x - width/2) * 0.00018 * ${zoom});
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat, lon }));
    });
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ uri: mapUrl }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        injectedJavaScript={injectedJS}
        onMessage={event => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.lat && data.lon) {
              setMarker({ latitude: data.lat, longitude: data.lon });
              if (onLocationSelect) {
                onLocationSelect({ latitude: data.lat, longitude: data.lon });
              }
            }
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  interactiveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  marker: {
    fontSize: 30,
  },
});
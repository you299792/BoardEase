import React from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Lightweight full-screen viewer for chat attachments
 */
const FullScreenImageModal = ({ visible, imageUri, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
          onPress={onClose}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <ActivityIndicator size="large" color="#fff" />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.select({ ios: 60, android: 40, default: 40 }),
    paddingBottom: 40,
  },
  image: {
    width: '100%',
    height: '90%',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.select({ ios: 50, android: 30, default: 30 }),
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});

export default FullScreenImageModal;

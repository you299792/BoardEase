import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '../constants/Colors';

const ShareProfileModal = ({ visible, onClose, user }) => {
  if (!user) return null;

  // This would be a deep link or a URL to a public profile page in a real app
  const profileUrl = `https://boardease.app/landlord/${user.email}`;

    // Safe QR Code rendering with error handling
    const renderQRCode = () => {
      try {
        return (
          <QRCode
            value={profileUrl}
            size={220}
            logo={user.photoURL ? { uri: user.photoURL } : undefined}
            logoSize={40}
            logoBackgroundColor="white"
            logoBorderRadius={20}
          />
        );
      } catch (error) {
        console.error('Error rendering QR code:', error);
        return (
          <Text style={styles.errorText}>
            Unable to generate QR code at this time
          </Text>
        );
      }
    };

  const onShare = async () => {
    try {
      await Share.share({
        message: `Check out this landlord on BoardEase: ${user.name} (${profileUrl})`,
        url: profileUrl, // for iOS
        title: 'Share Landlord Profile',
      });
    } catch (error) {
      console.error('Error sharing:', error.message);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={30} color="#ccc" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Share Profile</Text>

          <View style={styles.profileHeader}>
            <Image
              source={{ uri: user.photoURL || 'https://via.placeholder.com/100' }}
              style={styles.profileImage}
            />
            <View>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.qrContainer}>
            {renderQRCode()}
          </View>

          <Text style={styles.shareInstructions}>
            Scan this QR code to view the landlord's profile.
          </Text>

          <TouchableOpacity style={styles.shareButton} onPress={onShare}>
            <Ionicons name="share-social" size={20} color="white" />
            <Text style={styles.shareButtonText}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  closeButton: { position: 'absolute', top: 15, right: 15 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, alignSelf: 'flex-start' },
  profileImage: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  profileEmail: { fontSize: 14, color: '#666' },
  qrContainer: {
    marginBottom: 25,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
      },
      errorText: {
        color: Colors.error || '#ff0000',
        textAlign: 'center',
        marginVertical: 10,
        fontSize: 14,
    elevation: 3,
  },
  shareInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  shareButtonText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
});

export default ShareProfileModal;
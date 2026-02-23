import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function PropertyImageGrid({ images = [], onRemove = () => {}, onAdd = null }) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {images.map((uri, idx) => (
          <View key={idx} style={styles.imageWrap}>
            <Image source={{ uri }} style={styles.image} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(idx)}>
              <MaterialIcons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {onAdd && (
          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <MaterialIcons name="add" size={28} color={Colors.primary} />
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageWrap: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    marginBottom: 12,
    backgroundColor: '#f2f2f2',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 2,
  },
  addBtn: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  addText: {
    marginTop: 4,
    color: '#444',
    fontSize: 12,
  },
});

/**
 * Evaluator: large image + previous/next controls
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_SIZE = SCREEN_WIDTH - 32;

interface ImageControllerProps {
  imageUrl: string | null;
  imageIndex: number;
  totalImages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function ImageController({
  imageUrl,
  imageIndex,
  totalImages,
  onPrev,
  onNext,
}: ImageControllerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <FastImage
            source={{ uri: imageUrl, priority: FastImage.priority.high }}
            style={styles.image}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.navButton, imageIndex <= 0 && styles.navButtonDisabled]}
          onPress={onPrev}
          disabled={imageIndex <= 0}
        >
          <Text style={styles.navButtonText}>← Previous</Text>
        </TouchableOpacity>
        <Text style={styles.counter}>
          {imageIndex + 1} / {totalImages}
        </Text>
        <TouchableOpacity
          style={[
            styles.navButton,
            imageIndex >= totalImages - 1 && styles.navButtonDisabled,
          ]}
          onPress={onNext}
          disabled={imageIndex >= totalImages - 1}
        >
          <Text style={styles.navButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  imageWrapper: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    alignSelf: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  navButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  navButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  counter: {
    color: '#888',
    fontSize: 16,
  },
});

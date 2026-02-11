/**
 * Full-screen image display with optional caching
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import FastImage from 'react-native-fast-image';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
  imageUrl: string | null;
  imageIndex?: number;
}

export function ImageViewer({ imageUrl, imageIndex = 0 }: ImageViewerProps) {
  if (!imageUrl) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <FastImage
        source={{
          uri: imageUrl,
          priority: FastImage.priority.normal,
        }}
        style={styles.image}
        resizeMode={FastImage.resizeMode.contain}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

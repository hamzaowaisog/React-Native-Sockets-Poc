/**
 * Client: full-screen image viewer, receives updates in real time
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreenView } from '../../components/SafeScreenView';
import { useRealtime } from '../../context';
import { ImageViewer } from '../../components/ImageViewer';

export function ImageViewerScreen({
  evaluatorName,
  onSessionEnd,
}: {
  evaluatorName: string | null;
  onSessionEnd: () => void;
}) {
  const { service } = useRealtime();
  const [imageIndex, setImageIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onUpdate = (index: number, url: string) => {
      setImageIndex(index);
      setImageUrl(url);
      setLoading(false);
    };
    const onEnd = () => {
      onSessionEnd();
    };
    service.onImageUpdate(onUpdate);
    service.onSessionEnd(onEnd);
    return () => {
      service.onImageUpdate(() => {});
      service.onSessionEnd(() => {});
    };
  }, [service, onSessionEnd]);

  const insets = useSafeAreaInsets();
  return (
    <SafeScreenView style={styles.container} edges={['left', 'right', 'bottom']} backgroundColor="#000">
      <View style={[styles.badge, { top: insets.top + 8 }]}>
        <Text style={styles.badgeText} numberOfLines={1}>
          Connected to: {evaluatorName ?? 'Evaluator'}
        </Text>
      </View>
      {loading && !imageUrl ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.waiting}>Waiting for images...</Text>
        </View>
      ) : (
        <ImageViewer imageUrl={imageUrl} imageIndex={imageIndex} />
      )}
    </SafeScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  badge: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  badgeText: {
    color: '#22c55e',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waiting: {
    color: '#888',
    marginTop: 16,
  },
});

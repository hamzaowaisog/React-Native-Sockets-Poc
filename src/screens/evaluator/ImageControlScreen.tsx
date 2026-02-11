/**
 * Evaluator: image navigation, send updates to client, end session
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeScreenView } from '../../components/SafeScreenView';
import { useSession } from '../../context';
import { ImageController } from '../../components/ImageController';
import { PerformanceMetrics } from '../../components/PerformanceMetrics';
import { IMAGE_DATASET, IMAGE_COUNT } from '../../constants/images';

export function ImageControlScreen({ onEndSession }: { onEndSession: () => void }) {
  const {
    currentImageIndex,
    currentImageUrl,
    setCurrentImageIndex,
    setCurrentImageUrl,
    sendImageUpdate,
    endSession,
    connectedClientName,
    isSessionActive,
    getMetrics,
  } = useSession();

  const image = IMAGE_DATASET[currentImageIndex];
  const imageUrl = image?.url ?? currentImageUrl;

  useEffect(() => {
    if (imageUrl && isSessionActive) {
      sendImageUpdate(currentImageIndex, imageUrl);
    }
  }, [currentImageIndex, imageUrl, isSessionActive, sendImageUpdate]);

  const goNext = useCallback(() => {
    const next = Math.min(currentImageIndex + 1, IMAGE_COUNT - 1);
    setCurrentImageIndex(next);
    setCurrentImageUrl(IMAGE_DATASET[next]?.url ?? null);
  }, [currentImageIndex, setCurrentImageIndex, setCurrentImageUrl]);

  const goPrev = useCallback(() => {
    const prev = Math.max(currentImageIndex - 1, 0);
    setCurrentImageIndex(prev);
    setCurrentImageUrl(IMAGE_DATASET[prev]?.url ?? null);
  }, [currentImageIndex, setCurrentImageIndex, setCurrentImageUrl]);

  const handleEndSession = async () => {
    await endSession();
    onEndSession();
  };

  if (!isSessionActive) {
    return (
      <SafeScreenView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.waiting}>Starting session...</Text>
        </View>
      </SafeScreenView>
    );
  }

  return (
    <SafeScreenView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badge} numberOfLines={1}>Connected to: {connectedClientName ?? 'Client'}</Text>
        <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
          <Text style={styles.endButtonText}>End Session</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ImageController
          imageUrl={imageUrl}
          imageIndex={currentImageIndex}
          totalImages={IMAGE_COUNT}
          onNext={goNext}
          onPrev={goPrev}
        />
        <PerformanceMetrics metrics={getMetrics()} />
      </ScrollView>
    </SafeScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f14',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  badge: {
    color: '#22c55e',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  endButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#dc2626',
    borderRadius: 8,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  waiting: {
    color: '#888',
    marginTop: 16,
  },
});

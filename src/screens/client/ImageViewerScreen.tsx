/**
 * Client: full-screen image viewer, receives updates in real time.
 * When first image is shown, audio recording starts. When next image arrives (evaluator pressed Next),
 * current recording + current image ref (signedUrl) are sent to server, then next recording starts.
 * WebRTC P2P remains intact: image + signedUrl over data channel; only segment upload goes to server.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreenView } from '../../components/SafeScreenView';
import { useRealtime, useAuth } from '../../context';
import { ImageViewer } from '../../components/ImageViewer';
import { getRecordingAdapter } from '../../services/audio/RecordingAdapter';
import { submitSegment } from '../../services/session/SegmentService';

export function ImageViewerScreen({
  evaluatorName,
  evaluatorId,
  sessionId,
  onSessionEnd,
  onLogout,
}: {
  evaluatorName: string | null;
  evaluatorId?: string | null;
  sessionId?: string | null;
  onSessionEnd: () => void;
  onLogout?: () => void;
}) {
  const { service } = useRealtime();
  const { user } = useAuth();
  const [imageIndex, setImageIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [segmentsSent, setSegmentsSent] = useState(0);
  const [lastSegmentStatus, setLastSegmentStatus] = useState<string>('');
  const previousRef = useRef<{ imageIndex: number; signedUrl: string | undefined } | null>(null);
  const recordingStartedRef = useRef(false);
  const sentImageIndicesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const recorder = getRecordingAdapter();

    const onUpdate = async (index: number, url: string, signedUrlForImage?: string) => {
      const prev = previousRef.current;
      const isNewImage = prev === null || prev.imageIndex !== index;
      if (prev !== null && recordingStartedRef.current && prev.imageIndex !== index) {
        const audioBase64 = await recorder.stopRecording().catch(() => null);
        submitSegment({
          sessionId: sessionId ?? undefined,
          evaluatorId: evaluatorId ?? undefined,
          clientId: user?.id ?? undefined,
          imageIndex: prev.imageIndex,
          signedUrl: prev.signedUrl ?? null,
          audioBase64,
        })
          .then(() => {
            sentImageIndicesRef.current.add(prev.imageIndex);
            setSegmentsSent((n) => n + 1);
            setLastSegmentStatus(`Segment sent: image ${prev.imageIndex} (signedUrl + audio)`);
          })
          .catch((e) => setLastSegmentStatus(`Segment failed: ${e.message}`));
      }
      if (isNewImage) {
        recordingStartedRef.current = true;
        await recorder.startRecording();
      }
      previousRef.current = { imageIndex: index, signedUrl: signedUrlForImage };
      setImageIndex(index);
      setImageUrl(url);
      setSignedUrl(signedUrlForImage);
      setLoading(false);
      if (prev === null) setLastSegmentStatus('Recording started for image ' + index);
    };

    const onEnd = async () => {
      const prev = previousRef.current;
      const alreadySent = prev !== null && sentImageIndicesRef.current.has(prev.imageIndex);
      if (prev !== null && recordingStartedRef.current && !alreadySent) {
        const audioBase64 = await getRecordingAdapter().stopRecording().catch(() => null);
        submitSegment({
          sessionId: sessionId ?? undefined,
          evaluatorId: evaluatorId ?? undefined,
          clientId: user?.id ?? undefined,
          imageIndex: prev.imageIndex,
          signedUrl: prev.signedUrl ?? null,
          audioBase64,
        })
          .then(() => setSegmentsSent((n) => n + 1))
          .catch(() => {});
      }
      previousRef.current = null;
      recordingStartedRef.current = false;
      sentImageIndicesRef.current.clear();
      onSessionEnd();
    };

    service.onImageUpdate(onUpdate);
    service.onSessionEnd(onEnd);
    return () => {
      service.onImageUpdate(() => {});
      service.onSessionEnd(() => {});
    };
  }, [service, onSessionEnd, evaluatorId, sessionId, user?.id]);

  const insets = useSafeAreaInsets();
  return (
    <SafeScreenView style={styles.container} edges={['left', 'right', 'bottom']} backgroundColor="#000">
      <View style={[styles.badgeRow, { top: insets.top + 8 }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            Connected to: {evaluatorName ?? 'Evaluator'}
          </Text>
        </View>
        {onLogout ? (
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {loading && !imageUrl ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.waiting}>Waiting for images...</Text>
        </View>
      ) : (
        <>
          <ImageViewer imageUrl={imageUrl} imageIndex={imageIndex} />
          <View style={[styles.outputBar, { paddingBottom: 10 + insets.bottom }]}>
            <Text style={styles.outputText}>Image {imageIndex + 1} • Recording</Text>
            <Text style={styles.outputText}>Segments sent: {segmentsSent}</Text>
            {lastSegmentStatus ? (
              <Text style={styles.outputStatus} numberOfLines={1}>{lastSegmentStatus}</Text>
            ) : null}
          </View>
        </>
      )}
    </SafeScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  badgeRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: '#22c55e',
    fontSize: 14,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: '#93c5fd',
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
  outputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  outputText: {
    color: '#a5b4fc',
    fontSize: 12,
  },
  outputStatus: {
    color: '#22c55e',
    fontSize: 11,
    marginTop: 4,
  },
});

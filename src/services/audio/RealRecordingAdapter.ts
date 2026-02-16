/**
 * Real recording adapter using react-native-audio-recorder-player and react-native-fs.
 * Records audio, returns base64 for segment upload. Used when packages are installed and linked.
 */

import { Platform } from 'react-native';
import type { RecordingAdapter } from './RecordingAdapter';

let cachedAdapter: RecordingAdapter | null = null;

async function requestAudioPermissionIfNeeded(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const { PermissionsAndroid } = require('react-native');
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone',
        message: 'This app records audio for each image segment.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function createAdapter(): RecordingAdapter {
  const AudioRecorderPlayer = require('react-native-audio-recorder-player').default;
  const RNFS = require('react-native-fs');

  const recorder = new AudioRecorderPlayer();

  return {
    startRecording: async () => {
      const ok = await requestAudioPermissionIfNeeded();
      if (!ok) return;
      await recorder.startRecorder();
    },
    stopRecording: async (): Promise<string | null> => {
      try {
        const path = await recorder.stopRecorder();
        if (!path || typeof path !== 'string') return null;
        const filePath = path.startsWith('file://') ? path.slice(7) : path;
        const base64 = await RNFS.readFile(filePath, 'base64');
        return base64 || null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Returns the real recording adapter if native modules are available, otherwise null.
 * Use with setRecordingAdapter() in App.tsx so the app falls back to stub when native isn't linked.
 */
export function getRealRecordingAdapter(): RecordingAdapter | null {
  if (cachedAdapter !== null) return cachedAdapter;
  try {
    cachedAdapter = createAdapter();
    return cachedAdapter;
  } catch {
    return null;
  }
}

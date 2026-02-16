/**
 * Recording adapter: start/stop and return audio as base64 for segment upload.
 *
 * Default is a STUB: stopRecording() returns null, so server receives hasAudio: false.
 * To get real audio: add react-native-audio-recorder-player or react-native-nitro-sound,
 * and react-native-fs to read the recorded file as base64 in stopRecording(), then
 * call setRecordingAdapter(yourAdapter) at app init.
 */

export type RecordingAdapter = {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
};

const stubAdapter: RecordingAdapter = {
  startRecording: async () => {},
  stopRecording: async () => null, // → hasAudio: false on server until you set a real adapter
};

let currentAdapter: RecordingAdapter = stubAdapter;

export function setRecordingAdapter(adapter: RecordingAdapter): void {
  currentAdapter = adapter;
}

export function getRecordingAdapter(): RecordingAdapter {
  return currentAdapter;
}

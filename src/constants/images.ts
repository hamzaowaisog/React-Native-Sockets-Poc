/**
 * Predefined image dataset for real-time sync POC
 * Using placeholder images (picsum.photos) - replace with local assets if needed
 */

import type { ImageItem } from '../types/realtime.types';

const BASE = 'https://picsum.photos/seed';
const W = 800;
const H = 600;

export const IMAGE_DATASET: ImageItem[] = Array.from({ length: 25 }, (_, i) => {
  const url = `${BASE}/img${i + 1}/${W}/${H}`;
  return {
    id: i + 1,
    url,
    // POC: use same URL as signedUrl; replace with real presigned URL (e.g. S3) for production
    signedUrl: url,
  };
});

export const getImageByIndex = (index: number): ImageItem | undefined =>
  IMAGE_DATASET[index];

export const IMAGE_COUNT = IMAGE_DATASET.length;

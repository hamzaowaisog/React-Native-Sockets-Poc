/**
 * Predefined image dataset for real-time sync POC
 * Using placeholder images (picsum.photos) - replace with local assets if needed
 */

import type { ImageItem } from '../types/realtime.types';

const BASE = 'https://picsum.photos/seed';
const W = 800;
const H = 600;

export const IMAGE_DATASET: ImageItem[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  url: `${BASE}/img${i + 1}/${W}/${H}`,
}));

export const getImageByIndex = (index: number): ImageItem | undefined =>
  IMAGE_DATASET[index];

export const IMAGE_COUNT = IMAGE_DATASET.length;

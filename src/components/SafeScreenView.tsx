/**
 * Wraps screen content with safe area insets so nothing is hidden under notch/home indicator.
 */

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeScreenViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  backgroundColor?: string;
}

export function SafeScreenView({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = '#0f0f14',
}: SafeScreenViewProps) {
  return (
    <SafeAreaView style={[styles.root, { backgroundColor }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/**
 * Hook to get safe area insets for custom positioning (e.g. absolute back button, badges).
 */
export function useSafeArea() {
  return useSafeAreaInsets();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

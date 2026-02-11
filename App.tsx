import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { SocketExample } from './src/components';

/**
 * Main App Component
 * Entry point for the React Native WebSocket POC
 */
const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SocketExample />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;

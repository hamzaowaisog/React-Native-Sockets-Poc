/**
 * Evaluator: list of online clients, select one to start session
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeScreenView } from '../../components/SafeScreenView';
import { useSession } from '../../context';

export function ClientSelectionScreen({
  onSelectClient,
  onBack,
}: {
  onSelectClient: (clientId: string) => void;
  onBack: () => void;
}) {
  const { clients, refreshClients } = useSession();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    refreshClients();
  }, [refreshClients]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshClients();
    setRefreshing(false);
  };

  return (
    <SafeScreenView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Logout</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select Client</Text>
      </View>
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No clients online. Ask a client to log in first.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => onSelectClient(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, item.online && styles.dotOnline]} />
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.id}>{item.id}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backText: {
    color: '#3b82f6',
    fontSize: 16,
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#444',
    marginRight: 12,
  },
  dotOnline: {
    backgroundColor: '#22c55e',
  },
  name: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  id: {
    color: '#666',
    fontSize: 14,
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    padding: 32,
  },
});

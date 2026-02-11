import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS } from '../constants/socket.constants';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  sender?: string;
}

/**
 * Example component demonstrating WebSocket usage
 * Shows connection status, message sending, and receiving
 */
export const SocketExample: React.FC = () => {
  const {
    isConnected,
    isConnecting,
    isError,
    connectionStatus,
    error,
    connect,
    disconnect,
    emit,
    on,
    off,
  } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [username, setUsername] = useState('User' + Math.floor(Math.random() * 1000));

  /**
   * Handle incoming chat messages
   */
  useEffect(() => {
    const handleMessage = (data: any) => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        text: data.text || data.message || JSON.stringify(data),
        timestamp: data.timestamp || Date.now(),
        sender: data.sender || 'Unknown',
      };
      setMessages((prev) => [...prev, newMessage]);
    };

    // Register listener for chat messages
    on(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
    on(SOCKET_EVENTS.MESSAGE, handleMessage);

    // Cleanup
    return () => {
      off(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
      off(SOCKET_EVENTS.MESSAGE, handleMessage);
    };
  }, [on, off]);

  /**
   * Handle user joined event
   */
  useEffect(() => {
    const handleUserJoined = (data: any) => {
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        text: `${data.username || 'Someone'} joined the chat`,
        timestamp: Date.now(),
        sender: 'System',
      };
      setMessages((prev) => [...prev, systemMessage]);
    };

    on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);

    return () => {
      off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    };
  }, [on, off]);

  /**
   * Send a chat message
   */
  const sendMessage = () => {
    if (!inputText.trim() || !isConnected) return;

    emit(SOCKET_EVENTS.CHAT_MESSAGE, {
      text: inputText,
      sender: username,
      timestamp: Date.now(),
    });

    // Add to local messages
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      timestamp: Date.now(),
      sender: username,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
  };

  /**
   * Get status color based on connection state
   */
  const getStatusColor = () => {
    if (isConnected) return '#4CAF50';
    if (isError) return '#F44336';
    if (isConnecting) return '#FF9800';
    return '#9E9E9E';
  };

  /**
   * Get status text
   */
  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    if (isError) return `Error: ${error?.message || 'Unknown error'}`;
    return 'Disconnected';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>WebSocket Chat POC</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {/* Connection Controls */}
      <View style={styles.controls}>
        <TextInput
          style={styles.usernameInput}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          editable={!isConnected}
        />
        <TouchableOpacity
          style={[styles.button, isConnected && styles.buttonDisconnect]}
          onPress={isConnected ? disconnect : connect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isConnected ? 'Disconnect' : 'Connect'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <ScrollView style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Connect and start chatting!</Text>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={styles.messageItem}>
              <Text style={styles.messageSender}>{message.sender}</Text>
              <Text style={styles.messageText}>{message.text}</Text>
              <Text style={styles.messageTime}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          editable={isConnected}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, !isConnected && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!isConnected || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Debug Info */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>Status: {connectionStatus}</Text>
        <Text style={styles.debugText}>Messages: {messages.length}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 16,
    paddingTop: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  usernameInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  buttonDisconnect: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
  },
  messageItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageSender: {
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  messageInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  debugContainer: {
    backgroundColor: '#333',
    padding: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default SocketExample;

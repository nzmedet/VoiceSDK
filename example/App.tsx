import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { VoiceSDK, useCall, useIncomingCall } from '../src';

// Note: Firebase should be initialized separately via @react-native-firebase/app
// before calling VoiceSDK.init()

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [calleeId, setCalleeId] = useState('');

  useEffect(() => {
    // Initialize SDK
    // Note: Firebase should be initialized separately via @react-native-firebase/app
    VoiceSDK.init({
      appName: 'VoiceSDK Example',
      turnServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    })
      .then(() => {
        setInitialized(true);
        VoiceSDK.enableDebugMode();
      })
      .catch((error) => {
        console.error('Failed to initialize VoiceSDK:', error);
        Alert.alert('Initialization Error', error.message);
      });

    // Listen for call ended events
    VoiceSDK.on('call:ended', (event) => {
      // Calculate duration from startTime and endTime (both are Unix timestamps in milliseconds)
      const durationMinutes = (event.endTime - event.startTime) / 60000;
      Alert.alert(
        'Call Ended',
        `Duration: ${durationMinutes.toFixed(2)} minutes`
      );
    });
  }, []);

  const CallControls = () => {
    const {
      startCall,
      endCall,
      isConnected,
      callState,
      error,
    } = useCall();

    const { incomingCall, answer, decline } = useIncomingCall();

    if (!initialized) {
      return (
        <View style={styles.section}>
          <Text style={styles.statusText}>Initializing VoiceSDK...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.title}>VoiceSDK Example</Text>
          <Text style={styles.statusText}>
            Status: {callState} {isConnected ? '✓' : ''}
          </Text>
        </View>

        {incomingCall && (
          <View style={styles.section}>
            <Text style={styles.incomingTitle}>Incoming Call</Text>
            <Text style={styles.incomingText}>
              {incomingCall.caller.displayName} ({incomingCall.caller.id})
            </Text>
            <View style={styles.buttonRow}>
              <Button
                title="Answer"
                onPress={answer}
                color="#4CAF50"
              />
              <Button
                title="Decline"
                onPress={decline}
                color="#F44336"
              />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start Call</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter callee user ID"
            value={calleeId}
            onChangeText={setCalleeId}
            autoCapitalize="none"
          />
          <Button
            title="Call"
            onPress={async () => {
              if (!calleeId.trim()) {
                Alert.alert('Error', 'Please enter a callee user ID');
                return;
              }
              try {
                await startCall(calleeId.trim());
              } catch (err) {
                Alert.alert('Call Failed', err.message);
              }
            }}
            disabled={callState !== 'idle'}
          />
        </View>

        <View style={styles.section}>
          <Button
            title="End Call"
            onPress={endCall}
            color="#F44336"
            disabled={callState === 'idle'}
          />
        </View>

        {error && (
          <View style={styles.section}>
            <Text style={styles.errorText}>Error: {error.message}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Call States</Text>
          <Text style={styles.infoText}>
            • idle: No active call{'\n'}
            • ringing: Call is ringing{'\n'}
            • connecting: Establishing connection{'\n'}
            • active: Call is active{'\n'}
            • ended: Call has ended{'\n'}
            • failed: Call failed
          </Text>
        </View>
      </ScrollView>
    );
  };

  return <CallControls />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
  },
  incomingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  incomingText: {
    fontSize: 16,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});


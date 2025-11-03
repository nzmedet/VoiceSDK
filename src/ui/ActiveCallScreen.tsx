import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useCall } from '../hooks/useCall';

export interface ActiveCallScreenProps {
  participantName?: string;
}

export const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({
  participantName = 'Unknown',
}) => {
  const { callState, endCall, isConnected } = useCall();

  useEffect(() => {
    // Auto-dismiss if call is ended
    if (callState === 'ended' || callState === 'failed') {
      // Handle navigation if needed
    }
  }, [callState]);

  const getStatusText = () => {
    switch (callState) {
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'active':
        return isConnected ? 'Connected' : 'Connecting...';
      case 'ended':
        return 'Call Ended';
      case 'failed':
        return 'Call Failed';
      default:
        return 'Call';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.name}>{participantName}</Text>
        <Text style={styles.status}>{getStatusText()}</Text>
        <View style={styles.statusIndicator}>
          <View
            style={[
              styles.indicatorDot,
              isConnected && callState === 'active' ? styles.indicatorActive : styles.indicatorInactive,
            ]}
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.endButton]} onPress={endCall}>
          <Text style={styles.buttonText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  status: {
    fontSize: 18,
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
  },
  statusIndicator: {
    alignItems: 'center',
  },
  indicatorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  indicatorActive: {
    backgroundColor: '#4CAF50',
  },
  indicatorInactive: {
    backgroundColor: '#999',
  },
  buttonContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  button: {
    paddingHorizontal: 60,
    paddingVertical: 18,
    borderRadius: 30,
    minWidth: 200,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});


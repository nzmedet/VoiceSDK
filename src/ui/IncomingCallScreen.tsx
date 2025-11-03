import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useIncomingCall } from '../hooks/useIncomingCall';

export interface IncomingCallScreenProps {
  // This component gets all data from useIncomingCall hook
  // No props needed - it's self-contained
}

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = () => {
  const { incomingCall, answer, decline, isAnswering } = useIncomingCall();

  if (!incomingCall) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No incoming call</Text>
      </View>
    );
  }

  const caller = incomingCall.caller;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{caller.displayName}</Text>
      <Text style={styles.subtitle}>is calling...</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={decline}
          disabled={isAnswering}
        >
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.answerButton]}
          onPress={answer}
          disabled={isAnswering}
        >
          <Text style={styles.buttonText}>
            {isAnswering ? 'Answering...' : 'Answer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#999',
    marginBottom: 40,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 400,
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    minWidth: 120,
    alignItems: 'center',
  },
  answerButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

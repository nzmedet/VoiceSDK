# @nzmedet/voice-sdk API Documentation

## Installation

```bash
npm install @nzmedet/voice-sdk
```

## Setup

### Initialization

```typescript
import { VoiceSDK } from '@nzmedet/voice-sdk';

VoiceSDK.init({
  firebaseConfig: {
    apiKey: 'your-api-key',
    authDomain: 'your-auth-domain',
    projectId: 'your-project-id',
    storageBucket: 'your-storage-bucket',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
  },
  appName: 'MyApp',
  turnServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: 'your-username',
      credential: 'your-credential',
    },
  ],
  callbacks: {
    // Optional client-side callbacks
    onTokenUpdate: async (platform, token) => {
      // Store token in your database
    },
    onCallStarted: async (callId, callerId, calleeId) => {
      // Client-side logic when call starts
    },
    onCallStateChanged: async (callId, state) => {
      // Client-side logic when call state changes
    },
    onCallEnded: async (callId, startTime, endTime) => {
      // Client-side logic when call ends
    },
  },
  customScreens: {
    // Optional custom screen components
    IncomingCallScreen: CustomIncomingScreen,
    ActiveCallScreen: CustomActiveScreen,
  },
});
```

### Enable Debug Mode

```typescript
VoiceSDK.enableDebugMode();
```

### Token Management

Tokens are automatically registered and received by the SDK. When tokens are available, your `onTokenUpdate` callback is called, where you should store them in your database.

### Event Listeners

```typescript
VoiceSDK.on('call:ended', (event: CallEvent) => {
  const durationMinutes = (event.endTime - event.startTime) / 60000;
  console.log('Call ended:', event.callId, 'Duration:', durationMinutes, 'minutes');
});
```

## Hooks

### `useCall()`

Hook for managing outgoing calls.

```typescript
const {
  startCall,
  endCall,
  isConnected,
  callState,
  remoteStream,
  localStream,
  callId,
  error,
} = useCall();
```

#### Methods

- `startCall(calleeId: string): Promise<void>` - Start a new call
- `endCall(): Promise<void>` - End the current call

#### State

- `isConnected: boolean` - Whether the call is connected
- `callState: CallState` - Current call state ('idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'failed')
- `remoteStream?: MediaStream` - Remote audio stream
- `localStream?: MediaStream` - Local audio stream (internal use)
- `callId?: CallId` - Current call ID
- `error?: Error` - Any error that occurred

### `useIncomingCall()`

Hook for managing incoming calls.

```typescript
const {
  incomingCall,
  answer,
  decline,
  isAnswering,
} = useIncomingCall();
```

#### Methods

- `answer(): Promise<void>` - Answer the incoming call
- `decline(): Promise<void>` - Decline the incoming call

#### State

- `incomingCall: IncomingCall | null` - Current incoming call information
- `isAnswering: boolean` - Whether the call is currently being answered

## Types

### `CallState`

```typescript
type CallState = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'failed';
```

### `CallEvent`

```typescript
interface CallEvent {
  callId: CallId;
  startTime: number; // Unix timestamp in milliseconds
  endTime: number; // Unix timestamp in milliseconds
  participants: [UserId, UserId];
}
```

### `IncomingCall`

```typescript
interface IncomingCall {
  callId: CallId;
  callerId: UserId;
  callerName: string;
}
```

## UI Components

### `IncomingCallScreen`

Pre-built screen component for displaying incoming calls.

```typescript
import { IncomingCallScreen } from 'voice-sdk';

<IncomingCallScreen
  route={{
    params: {
      callerName: 'John Doe',
      callId: 'call-123',
    },
  }}
/>
```

### `ActiveCallScreen`

Pre-built screen component for displaying active calls.

```typescript
import { ActiveCallScreen } from 'voice-sdk';

<ActiveCallScreen
  participantName="John Doe"
/>
```

## Example

### Complete Example App

```tsx
import React from 'react';
import { View, Button, Text } from 'react-native';
import { VoiceSDK, useCall, useIncomingCall } from 'voice-sdk';

// Initialize once in your app
VoiceSDK.init({
  firebaseConfig: {
    apiKey: 'your-api-key',
    authDomain: 'your-auth-domain',
    projectId: 'your-project-id',
    storageBucket: 'your-storage-bucket',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
  },
  appName: 'MyApp',
});

export default function App() {
  const { startCall, endCall, callState, isConnected } = useCall();
  const { incomingCall, answer, decline } = useIncomingCall();

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Call State: {callState}</Text>
      <Text>Connected: {isConnected ? 'Yes' : 'No'}</Text>

      <Button title="Call Alice" onPress={() => startCall('alice123')} />
      <Button title="End Call" onPress={endCall} />

      {incomingCall && (
        <View>
          <Text>{incomingCall.callerName} is calling...</Text>
          <Button title="Answer" onPress={answer} />
          <Button title="Decline" onPress={decline} />
        </View>
      )}
    </View>
  );
}
```

## Firebase Configuration

### Firestore Security Rules

The package includes Firestore security rules that should be deployed:

```bash
firebase deploy --only firestore:rules
```

### Cloud Functions

**Important:** You must implement your own Cloud Functions. The SDK provides reusable helper functions that you can import.

**Required Functions (You Implement):**
- **Call Initiation**: Create call records, send push notifications
- **Call Termination**: Process ended calls, calculate duration
- **Billing**: Calculate costs, update balances, process payments
- **Cleanup** (optional): Handle stale/abandoned calls

**Helper Functions Available:**
- `handleCallEnded()` - Processes call termination, calculates duration
- `calculateCallCost()` - Calculates billing based on duration
- `handleCallStarted()` - Creates call records
- `updateCallState()` - Updates call state

See `firebase/functions/README.md` for detailed documentation and usage examples.


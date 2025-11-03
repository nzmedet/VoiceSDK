# voice-sdk

Production-grade WebRTC voice calling SDK for React Native with Firebase signaling, CallKeep UI, VoIP push, metered billing, and auto-reconnect.

## Installation

```bash
npm install @nzmedet/voice-sdk
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install react react-native @react-native-firebase/app @react-native-firebase/firestore react-native-webrtc react-native-callkeep react-native-pushkit
```

## Setup

### 1. Initialize the SDK

```typescript
import { VoiceSDK } from 'voice-sdk';
// initialise @react-native-firebase
// initialiseApp
VoiceSDK.init({
  appName: 'MyApp',
  turnServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password',
    },
  ],
  callbacks: {
    // Optional: Store push tokens in your database
    onTokenUpdate: async (platform, token) => {
      // Store token in your backend
    },
    // Optional: Client-side call event handlers
    onCallStarted: async (callId, callerId, calleeId) => {
      // Client-side logic when call starts
    },
    onCallStateChanged: async (callId, state) => {
      // Client-side logic when call state changes
    },
    onCallEnded: async (callId, startTime, endTime) => {
      // Client-side logic when call ends
      // Note: For server-side billing, implement Cloud Functions
    },
  },
});
```

### 2. Enable Debug Mode (Optional)

```typescript
VoiceSDK.enableDebugMode();
```

### 3. Token Management

The SDK automatically handles VoIP push token registration (iOS) and FCM token registration (Android). Tokens are automatically received and passed to your `onTokenUpdate` callback, where you should store them in your database.

## Usage

### Starting a Call

```typescript
import { useCall } from 'voice-sdk';

function MyComponent() {
  const { startCall, callState, isConnected, endCall } = useCall();

  const handleCall = async () => {
    try {
      await startCall('callee-user-id');
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  return (
    <>
      <Button title="Call" onPress={handleCall} />
      <Button title="End Call" onPress={endCall} />
      <Text>Status: {callState}</Text>
      <Text>Connected: {isConnected ? 'Yes' : 'No'}</Text>
    </>
  );
}
```

### Handling Incoming Calls

```typescript
import { useIncomingCall } from 'voice-sdk';

function IncomingCallComponent() {
  const { incomingCall, answer, decline } = useIncomingCall();

  if (incomingCall) {
    return (
      <View>
        <Text>{incomingCall.callerName} is calling...</Text>
        <Button title="Answer" onPress={answer} />
        <Button title="Decline" onPress={decline} />
      </View>
    );
  }

  return null;
}
```

### Using UI Components

```typescript
import { IncomingCallScreen, ActiveCallScreen } from 'voice-sdk';

// In your navigation
<Stack.Screen
  name="IncomingCall"
  component={IncomingCallScreen}
/>

<Stack.Screen
  name="ActiveCall"
  component={ActiveCallScreen}
/>
```

## Firebase Setup

### Firestore Rules

Deploy the included Firestore rules:

```bash
firebase deploy --only firestore:rules
```

### Cloud Functions

**Important:** This SDK does NOT include complete Cloud Functions. You must implement your own Cloud Functions to handle:

- **Call Initiation**: Creating call records, sending push notifications, validation
- **Call Termination**: Processing ended calls, calculating duration
- **Billing**: Calculating costs, updating user balances, processing payments (Stripe, etc.)
- **Cleanup**: Removing stale calls, handling abandoned calls

The SDK provides reusable helper functions that you can import into your own Cloud Functions. See `firebase/functions/README.md` for documentation and usage examples.

**You are responsible for:**
- Implementing your own Cloud Functions based on your requirements
- Setting up your billing logic (Stripe, in-app purchases, subscription models, etc.)
- Defining your database schema and collection structure
- Implementing authentication, authorization, and security rules
- Customizing push notification delivery

Copy the helper utilities to your Firebase Functions project:
```bash
mkdir -p your-firebase-project/functions/utils
cp firebase/functions/utils/callHelpers.ts your-firebase-project/functions/utils/
```

## Features

- ✅ WebRTC voice calling with auto-reconnect
- ✅ Firebase Cloud Firestore signaling
- ✅ CallKeep integration for native call UI
- ✅ VoIP push notifications (iOS)
- ✅ FCM push notifications (Android)
- ✅ Billing helpers (you implement your own billing logic)
- ✅ TypeScript support
- ✅ React hooks API

## License

MIT


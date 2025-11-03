# Voice SDK Architecture

## Overview

The Voice SDK is a production-grade WebRTC voice calling solution for React Native applications. It provides a complete infrastructure for peer-to-peer voice calls with Firebase as the signaling backend.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                        │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  useCall()   │  │useIncomingCall│  │ UI Components│      │
│  │    Hook      │  │    Hook       │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
└─────────┼─────────────────┼──────────────────┼───────────────┘
          │                 │                  │
          └─────────────────┼──────────────────┘
                            │
          ┌─────────────────▼──────────────────┐
          │         VoiceSDK (Singleton)       │
          │  - Initialization                  │
          │  - Event Management                │
          │  - Token Management                │
          └─────┬──────────────┬───────────────┘
                │              │
    ┌───────────┘              └───────────┐
    │                                       │
┌───▼───────────┐              ┌──────────▼──────┐
│ CallEngine    │              │ SignalingManager│
│ - WebRTC PC   │              │ - Firestore     │
│ - ICE Handling│              │ - Signaling     │
│ - Reconnect   │              │ - Subscriptions │
└───┬───────────┘              └─────────────────┘
    │
    │ WebRTC
    │
┌───▼───────────────────────────────────────────┐
│            WebRTC Peer Connection              │
│  ┌─────────────┐         ┌─────────────┐      │
│  │ Local Audio │         │ Remote Audio│      │
│  └─────────────┘         └─────────────┘      │
└───────────────────────────────────────────────┘
```

## Component Architecture

### 1. Core Components

#### CallEngine (`src/core/CallEngine.ts`)
- Manages WebRTC PeerConnection lifecycle
- Handles ICE candidates and connection states
- Implements auto-reconnect on ICE failure
- Manages local and remote media streams

#### SignalingManager (`src/core/SignalingManager.ts`)
- Manages Firestore signaling subcollection
- Handles offer/answer/ICE candidate exchange
- Implements message sequencing
- Provides subscription/unsubscription

### 2. Platform Integration

#### CallKeepManager (`src/callkeep/CallKeepManager.ts`)
- Integrates with react-native-callkeep
- Provides native call UI on iOS/Android
- Handles call state reporting

#### VoIP Push Handlers
- **iOS**: `VoIPPushIOS.ts` - PushKit integration
- **Android**: `FCMPushAndroid.ts` - Firebase Cloud Messaging

### 3. React Hooks

#### useCall()
Manages outgoing calls:
- Call initiation via Cloud Function
- WebRTC connection establishment
- Call state management
- Error handling

#### useIncomingCall()
Manages incoming calls:
- Push notification handling
- Call acceptance/decline
- Connection establishment

### 4. Firebase Backend

#### Firestore Schema
- `/users/{userId}` - User profiles and tokens
- `/calls/{callId}` - Call documents
- `/calls/{callId}/signaling` - Signaling messages

#### Cloud Functions (You Must Implement)

You are responsible for implementing your own Cloud Functions to handle:
- Call initiation (creating records, sending push notifications)
- Call termination (processing ended calls, calculating duration)
- Billing (calculating costs, processing payments)
- Cleanup (stale calls, abandoned calls)

The SDK provides reusable helper functions in `firebase/functions/utils/callHelpers.ts` that you can import into your own Cloud Functions. See the README in that directory for usage examples.

## Data Flow

### Outgoing Call Flow

1. User calls `startCall(calleeId)`
2. `useCall` hook generates call ID and notifies SDK (optional callback)
3. You implement: Cloud Function or direct database write to create call document
4. You implement: Send push notification to callee
5. CallEngine creates WebRTC offer
6. SignalingManager sends offer to Firestore
7. Callee receives push, accepts call
8. Callee's CallEngine creates answer
9. SignalingManager exchanges answer and ICE candidates
10. WebRTC connection established
11. Media streams flow peer-to-peer

### Incoming Call Flow

1. Push notification received
2. CallKeep displays native call UI
3. `useIncomingCall` hook receives call info
4. User answers or declines
5. If answered: CallEngine handles offer, creates answer
6. Signaling exchange completes
7. WebRTC connection established

## Reliability Features

### Auto-Reconnect
- Monitors ICE connection state
- Automatically restarts ICE on failure
- Limits reconnect attempts (max 5)
- Emits connection state changes

### Version Control
- Firestore documents use version numbers
- Prevents race conditions
- Ensures atomic updates

### Stale Call Cleanup
- You implement: Scheduled Cloud Function (if needed)
- Monitors calls that haven't been pinged
- Marks stale calls as ended
- Prevents resource leaks

## Security

### Firestore Rules
- Users can only read/write their own user documents
- Calls can only be created by authenticated callers
- Call updates require version increment
- Signaling messages require participant verification

## Billing Integration

### You Implement Your Own Billing
- The SDK provides helper functions to calculate duration and cost
- You are responsible for:
  - Implementing your pricing model
  - Integrating with payment processors (Stripe, in-app purchases, etc.)
  - Updating user balances or subscriptions
  - Handling refunds, disputes, etc.
- See `firebase/functions/utils/callHelpers.ts` for reusable billing calculation helpers

## Testing

- Unit tests for CallEngine and SignalingManager
- Mocked WebRTC APIs
- Mocked Firebase functions
- Jest configuration included

## Deployment

### Package Structure
- Source code in `src/`
- Compiled output in `dist/`
- Firebase rules and functions in `firebase/`
- Example app in `example/`

### Publishing
```bash
npm run build
npm publish --access public
```


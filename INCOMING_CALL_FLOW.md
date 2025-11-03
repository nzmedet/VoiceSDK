# Incoming Call Flow & Token Management

This document explains how incoming VoIP push notifications trigger CallKeep UI and how tokens are managed.

## 🎯 Quick Summary

**Incoming Call:**
1. Push notification arrives → `VoiceSDK.handleIncomingCall()` called
2. **Two things happen simultaneously:**
   - CallKeep shows **native call UI** (iOS/Android system UI)
   - React hook updates **state** (for your custom UI)

**Tokens:**
1. Platform automatically provides token (iOS: PushKit, Android: FCM)
2. SDK passes token to your `onTokenUpdate` callback
3. **You must store it** in your database
4. Your backend uses stored token to send push notifications

---

## 📱 Incoming Call Flow (Complete Picture)

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Push Notification Arrives                                  │
│    iOS: PushKit receives VoIP push                            │
│    Android: FCM receives data message                          │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Push Handler Triggers Callback                            │
│    VoIPPushIOS/FCMPushAndroid.incomingCallCallback()        │
│    Called with: { callId, caller, callee?, metadata? }       │
│    where caller/callee are CallParticipant objects           │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. VoiceSDK.handleIncomingCall() is called                   │
│    Does TWO things in parallel:                              │
│                                                               │
│    A) Calls incomingCallHandler (set by useIncomingCall)    │
│       └─> Updates React state in useIncomingCall hook         │
│                                                               │
│    B) Calls CallKeepManager.reportIncomingCall()            │
│       └─> Shows NATIVE iOS/Android call UI immediately        │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. User Sees Call UI                                         │
│    - Native CallKeep UI shows (iOS/Android native UI)        │
│    - React hook state updates (incomingCall is set)          │
│    - Your React components can show custom UI too            │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. User Answers/Declines                                     │
│    - CallKeep UI buttons trigger CallKeep events            │
│    - OR your React UI calls answer()/decline()               │
│    - WebRTC connection established                           │
└─────────────────────────────────────────────────────────────┘
```

## 🔑 Token Management Flow

### iOS (VoIP Push Token)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. App Launches                                              │
│    VoiceSDK.init() is called                                  │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. VoIPPushIOS.initialize() registers with PushKit          │
│    PushKit.pushRegistry is created                           │
│    Delegate set: pushRegistryDidUpdatePushCredentials       │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PushKit Receives Token (Automatically)                   │
│    iOS PushKit automatically gets VoIP token from Apple     │
│    Calls delegate.pushRegistryDidUpdatePushCredentials       │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Token Flows Through SDK                                   │
│    VoIPPushIOS → VoiceSDK.onToken callback                   │
│    → Your onTokenUpdate callback                             │
│    → YOU store token in YOUR database                        │
│                                                               │
│    SDK does NOT store token - only passes it to you          │
└─────────────────────────────────────────────────────────────┘
```

### Android (FCM Token)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. App Launches                                              │
│    VoiceSDK.init() is called                                  │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FCMPushAndroid.initialize()                              │
│    - Requests notification permission                         │
│    - Gets FCM token automatically                            │
│    - Listens for token refresh                               │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. FCM Provides Token (Automatically)                        │
│    Firebase Cloud Messaging automatically provides token      │
│    Calls tokenCallback when received/refreshed               │
└───────────────────┬───────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Token Flows Through SDK                                   │
│    FCMPushAndroid → VoiceSDK.onToken callback                │
│    → Your onTokenUpdate callback                             │
│    → YOU store token in YOUR database                        │
│                                                               │
│    SDK does NOT store token - only passes it to you          │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Complete Incoming Call Sequence

### iOS Example

1. **Server sends VoIP push** → Apple Push Notification Service (APNs)
2. **PushKit receives push** → `pushRegistryDidReceiveIncomingPushWithPayload` called
3. **VoIPPushIOS extracts data** → `{ callId, caller: CallParticipant, callee?: CallParticipant, metadata? }`
4. **Calls `incomingCallCallback`** → Registered by `VoiceSDK.initializePushNotifications()`
5. **VoiceSDK.handleIncomingCall()** executes:
   ```typescript
   // Part A: Notify React hook
   if (this.incomingCallHandler) {
     this.incomingCallHandler(payload); // This updates useIncomingCall state
   }
   
   // Part B: Show native UI
   CallKeepManager.reportIncomingCall(
     payload.callId,
     payload.caller.id,
     payload.caller.displayName
   ); // This shows iOS native call screen
   ```
6. **Two UIs show**:
   - Native iOS call UI (via CallKeep)
   - React state updates (via useIncomingCall hook)

### Android Example

1. **Server sends FCM message** → Firebase Cloud Messaging
2. **FCM receives message** → `onMessage` callback fires (foreground) OR background handler
3. **FCMPushAndroid extracts data** → `{ callId, caller: CallParticipant, callee?: CallParticipant, metadata? }`
4. **Calls `incomingCallCallback`** → Registered by `VoiceSDK.initializePushNotifications()`
5. **VoiceSDK.handleIncomingCall()** executes (same as iOS)
6. **Two UIs show**:
   - Native Android call UI (via CallKeep)
   - React state updates (via useIncomingCall hook)

## 🔗 How useIncomingCall Hook Connects

The `useIncomingCall` hook registers itself to receive incoming calls:

### Step 1: VoiceSDK Creates Global Handler Method

When `VoiceSDK.init()` is called, it sets up a global handler mechanism:

```typescript
// In src/index.ts, VoiceSDKInstance.init()
(global as unknown as GlobalVoiceSDK).VoiceSDK = {
  config: this.config,
  instance: this,
  setIncomingCallHandler: (handler) => {
    this.incomingCallHandler = handler || undefined;
  },
};
```

This creates `global.VoiceSDK.setIncomingCallHandler()` that any component can use.

### Step 2: Hook Registers Itself

The `useIncomingCall` hook registers a handler:

```typescript
// In src/hooks/useIncomingCall.ts
useEffect(() => {
  const handler = (payload) => {
    setIncomingCall(payload); // Update React state
  };

  // Register handler with VoiceSDK
  const globalSDK = global.VoiceSDK;
  if (globalSDK) {
    globalSDK.setIncomingCallHandler(handler);
  }
  
  return () => {
    // Cleanup on unmount
    if (globalSDK) {
      globalSDK.setIncomingCallHandler(undefined);
    }
  };
}, []);
```

### Step 3: Push Arrives, Handler Called

When push notification arrives:

```typescript
// In src/index.ts, handleIncomingCall()
private handleIncomingCall(payload: VoIPPushPayload | FCMPushPayload): void {
  // Part A: Notify React hook (if registered)
  if (this.incomingCallHandler) {
    this.incomingCallHandler(payload); // ← Calls the hook's handler
  }

  // Part B: Show CallKeep UI
  CallKeepManager.reportIncomingCall(...);
}
```

**Complete Flow:**
1. Push arrives → `VoIPPushIOS`/`FCMPushAndroid` calls callback
2. `VoiceSDK.handleIncomingCall()` is called
3. Calls `this.incomingCallHandler()` (set by useIncomingCall hook)
4. Handler updates React state → `incomingCall` becomes non-null
5. Your component re-renders with incoming call data
6. **Simultaneously:** CallKeep shows native UI

## 📝 Token Storage Responsibility

**Important:** The SDK does NOT store tokens. You must store them in your database.

### Token Flow

```typescript
VoiceSDK.init({
  callbacks: {
    onTokenUpdate: async (platform, token) => {
      // 1. Token received from iOS PushKit or Android FCM
      // 2. Passed to your callback
      // 3. YOU must store it in YOUR database
      
      await fetch('https://your-api.com/users/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: auth.currentUser.uid,
          platform, // 'ios' or 'android'
          token,    // VoIP token (iOS) or FCM token (Android)
        }),
      });
      
      // Your backend needs this token to send push notifications
    },
  },
});
```

### Token Lifecycle

1. **App Launch:** SDK requests token automatically
2. **Token Received:** Platform provides token → `onTokenUpdate` called
3. **You Store It:** Save to your database
4. **Token Refresh:** Platform may refresh token → `onTokenUpdate` called again
5. **You Update:** Update token in your database

### Why SDK Doesn't Store Tokens

- **SDK is client-only** - doesn't have database access
- **Your backend needs tokens** - to send push notifications when calls start
- **Tokens change** - refresh on reinstall, app update, etc.
- **Multiple devices** - user might have multiple devices (need all tokens)

### When Tokens Are Received

- **iOS:** When PushKit registers → `pushRegistryDidUpdatePushCredentials`
- **Android:** When FCM initialized → `getToken()` + `onTokenRefresh()`
- **Both:** Automatically on app launch and when refreshed

## 🎯 Key Points

1. **CallKeep UI shows immediately** when push arrives (via `CallKeepManager.reportIncomingCall()`)
2. **React state updates** happen simultaneously (via `incomingCallHandler`)
3. **Tokens are NOT stored by SDK** - only passed to your `onTokenUpdate` callback
4. **You must store tokens** in your database via the callback
5. **Two separate flows:**
   - Push notification → CallKeep (native UI)
   - Push notification → useIncomingCall hook (React state)

## ⚠️ Important Notes

### Android Background Handling

**Current Implementation:** Only handles **foreground** messages via `onMessage`.

For **background** messages, you need to set up a `FirebaseMessagingService` in your native Android code:

```java
// In MainApplication.java or a separate service
public class CallMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage message) {
        if (message.getData().containsKey("callId")) {
            // Trigger CallKeep and notify React Native
            // This requires native module or event emitter
        }
    }
}
```

**Why:** Android FCM works differently for foreground vs background messages.

### iOS VoIP Push

- **Background/Killed:** VoIP push works automatically
- **Foreground:** Uses same mechanism, but you might want to show in-app UI

### Token Refresh

- Tokens automatically refresh when:
  - App reinstalled
  - App updated
  - User logs out/in (sometimes)
- SDK automatically calls `onTokenUpdate` when refreshed
- **Important:** Always update token in your database on refresh

### Multiple Handlers Limitation

**Current behavior:** Only the **last** `useIncomingCall` hook that mounts receives calls.

- If you have multiple `useIncomingCall` hooks, only one will receive calls
- The global handler is overwritten each time
- **Solution:** Use a single `useIncomingCall` hook at the app root and share state via context/state management

### Token Storage Best Practices

1. **Store immediately** when received
2. **Update on refresh** - check if token changed before updating
3. **Store user association** - link token to userId
4. **Handle multiple devices** - user can have multiple tokens
5. **Clean up old tokens** - remove tokens when user logs out or app uninstalled


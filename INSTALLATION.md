# Installation Guide

This guide shows how to install `@nzmedet/voice-sdk` from a private GitHub repository into your React Native project (e.g., "beheard").

### Step 1: Install Peer Dependencies

The SDK requires these peer dependencies:

```bash
npm install \
  react \
  react-native \
  firebase \
  @react-native-firebase/app \
  @react-native-firebase/firestore \
  @react-native-firebase/messaging \
  react-native-webrtc \
  react-native-callkeep \
  react-native-pushkit

# Or using yarn
yarn add \
  react \
  react-native \
  firebase \
  @react-native-firebase/app \
  @react-native-firebase/firestore \
  @react-native-firebase/messaging \
  react-native-webrtc \
  react-native-callkeep \
  react-native-pushkit
```

### Step 2: Install Native Dependencies

**iOS:**
```bash
cd ios
pod install
cd ..
```

**Android:**
No additional steps needed (gradle will handle it automatically).

### Step 3: Configure React Native Packages

Some packages require native configuration:

#### iOS Setup

1. **Add PushKit capabilities** (for VoIP push):
   - Open `ios/YourApp.xcworkspace` in Xcode
   - Select your app target → Signing & Capabilities
   - Click "+ Capability" → Add "Push Notifications"
   - Add "Background Modes" → Enable "Voice over IP"

2. **Configure Info.plist**:
   ```xml
   <key>UIBackgroundModes</key>
   <array>
     <string>voip</string>
     <string>audio</string>
   </array>
   ```

#### Android Setup

1. **Add to `android/app/src/main/AndroidManifest.xml`**:
   ```xml
   <manifest>
     <!-- Add permissions -->
     <uses-permission android:name="android.permission.INTERNET" />
     <uses-permission android:name="android.permission.RECORD_AUDIO" />
     <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
     <uses-permission android:name="android.permission.WAKE_LOCK" />
     
     <application>
       <!-- ... existing config ... -->
     </application>
   </manifest>
   ```

2. **Add Google Services** (for FCM):
   - Download `google-services.json` from Firebase Console
   - Place it in `android/app/`

### Step 4: Import and Use

```typescript
// In your beheard app
import { VoiceSDK, useCall, useIncomingCall } from 'voice-sdk';

// Initialize in your App.tsx or root component
VoiceSDK.init({
  firebaseConfig: {
    // Your Firebase config
  },
  appName: 'app',
  // ... rest of config
});
```

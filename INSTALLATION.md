# Installation Guide - Private GitHub Repository

This guide shows how to install `voice-sdk` from a private GitHub repository into your React Native project (e.g., "beheard").

## Prerequisites

1. **GitHub Access**: You must have read access to the private repository
2. **Git Authentication**: Set up GitHub authentication (SSH key or personal access token)
3. **React Native Project**: Your project should be initialized with React Native

## Method 1: SSH (Recommended for Private Repos)

### Step 1: Set up SSH key (if not already done)

```bash
# Check if you have an SSH key
ls -al ~/.ssh

# If not, generate one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add the public key to GitHub:
# Settings → SSH and GPG keys → New SSH key
```

### Step 2: Install the package

In your "beheard" project directory:

```bash
npm install git+ssh://git@github.com:YOUR_USERNAME/voice-sdk.git

# Or using yarn
yarn add git+ssh://git@github.com:YOUR_USERNAME/voice-sdk.git
```

**Replace `YOUR_USERNAME` with the GitHub username/organization that owns the repository.**

## Method 2: Personal Access Token (HTTPS)

### Step 1: Create GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Give it a name (e.g., "beheard-install")
4. Select scopes: `repo` (for private repos)
5. Copy the token (you won't see it again!)

### Step 2: Install using token

**Option A: Inline token (not recommended for production)**
```bash
npm install git+https://YOUR_TOKEN@github.com/YOUR_USERNAME/voice-sdk.git

# Or using yarn
yarn add git+https://YOUR_TOKEN@github.com/YOUR_USERNAME/voice-sdk.git
```

**Option B: Configure Git credentials (more secure)**

For macOS/Linux:
```bash
# Store credentials in keychain
git config --global credential.helper osxkeychain  # macOS
git config --global credential.helper store       # Linux

# Then install normally - Git will prompt for credentials
npm install git+https://github.com/YOUR_USERNAME/voice-sdk.git
```

### Step 3: Use .npmrc for team projects (Recommended)

Create or edit `.npmrc` in your "beheard" project root:

```bash
# .npmrc
@YOUR_USERNAME:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Then install:
```bash
npm install @YOUR_USERNAME/voice-sdk
```

## Method 3: Git Submodule (Alternative)

If you want to modify the SDK code directly:

```bash
# Add as submodule
git submodule add git@github.com:YOUR_USERNAME/voice-sdk.git packages/voice-sdk

# Initialize submodules
git submodule update --init --recursive
```

Then in your `package.json`:
```json
{
  "dependencies": {
    "voice-sdk": "file:./packages/voice-sdk"
  }
}
```

## After Installation

### Step 1: Install Peer Dependencies

The SDK requires these peer dependencies. Install them in your "beheard" project:

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
  appName: 'Beheard',
  // ... rest of config
});
```

## Troubleshooting

### Issue: "Permission denied (publickey)"

**Solution**: Set up SSH keys or use HTTPS with token
```bash
# Test SSH connection
ssh -T git@github.com

# If it fails, add your SSH key to GitHub
```

### Issue: "Repository not found"

**Solutions**:
- Verify you have access to the private repo
- Check repository name/username is correct
- Ensure you're authenticated

### Issue: "Package not found after install"

**Solution**: 
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Native dependencies not linking

**Solution**:
```bash
# iOS
cd ios && pod install && cd ..

# Android
cd android && ./gradlew clean && cd ..
```

### Issue: TypeScript errors

**Solution**: The package includes TypeScript definitions. If you see errors:

```bash
# Ensure TypeScript is installed
npm install --save-dev typescript @types/react @types/react-native

# Restart TypeScript server in your IDE
```

## Version Management

### Install Specific Branch/Tag

```bash
# Install from specific branch
npm install git+ssh://git@github.com:YOUR_USERNAME/voice-sdk.git#branch-name

# Install specific tag
npm install git+ssh://git@github.com:YOUR_USERNAME/voice-sdk.git#v1.0.0

# Install from specific commit
npm install git+ssh://git@github.com:YOUR_USERNAME/voice-sdk.git#abc1234
```

### Update Package

```bash
# Update to latest from main branch
npm install git+ssh://git@github.com:YOUR_USERNAME/voice-sdk.git#main

# Or update all packages
npm update
```

## CI/CD Setup

For automated builds (GitHub Actions, CircleCI, etc.):

### Option 1: SSH Key in CI

```yaml
# .github/workflows/ci.yml
- uses: webfactory/ssh-agent@v0.7.0
  with:
    ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
- run: npm install
```

### Option 2: Personal Access Token

```yaml
# Set GITHUB_TOKEN as secret in CI/CD
- name: Install dependencies
  run: npm install
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Or use `.npmrc` in repo (but don't commit the token!):
```bash
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Quick Start Checklist

- [ ] Set up GitHub authentication (SSH or token)
- [ ] Install package: `npm install git+ssh://git@github.com:USERNAME/voice-sdk.git`
- [ ] Install peer dependencies
- [ ] Run `pod install` (iOS)
- [ ] Configure Firebase
- [ ] Configure push notifications
- [ ] Initialize SDK in your app
- [ ] Test on device

## Example package.json Entry

After installation, your `package.json` will look like:

```json
{
  "dependencies": {
    "voice-sdk": "git+ssh://git@github.com:YOUR_USERNAME/voice-sdk.git",
    "react": "^18.0.0",
    "react-native": "^0.70.0",
    "firebase": "^10.0.0",
    "@react-native-firebase/app": "^18.0.0",
    "@react-native-firebase/firestore": "^18.0.0",
    "@react-native-firebase/messaging": "^18.0.0",
    "react-native-webrtc": "^118.0.0",
    "react-native-callkeep": "^5.0.0",
    "react-native-pushkit": "^2.0.0"
  }
}
```

## Next Steps

After installation, follow the [README.md](./README.md) and [docs/API.md](./docs/API.md) for:
- Firebase setup
- Cloud Functions implementation
- Token management
- UI integration


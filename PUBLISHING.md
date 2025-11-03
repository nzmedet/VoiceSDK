# Publishing Checklist

## Pre-Publish Verification

✅ **Build Status**: TypeScript compilation successful
✅ **Tests**: All 11 tests passing
✅ **Documentation**: All docs updated and correct
✅ **Package.json**: Configured for npm publishing

## What's Included in the Package

The following files/directories will be published (via `files` field in package.json):

- `dist/` - Compiled JavaScript and TypeScript declarations
- `firebase/` - Firestore rules, indexes, and Cloud Function helpers/examples
- `docs/` - API documentation
- `ARCHITECTURE.md` - Architecture documentation
- `README.md` - Main package documentation

## Excluded Files (via .npmignore)

- `node_modules/`
- `__tests__/`
- `example/`
- `*.test.ts`
- `*.test.tsx`
- Source TypeScript files (only dist/ is included)
- Config files (tsconfig.json, jest.config.js)

## Package Information

- **Name**: `voice-sdk`
- **Version**: `1.0.0`
- **Main Entry**: `dist/index.js`
- **Types Entry**: `dist/index.d.ts`
- **License**: MIT

## Exports

### Main Exports
- `VoiceSDK` - Main SDK singleton instance
- `useCall` - React hook for outgoing calls
- `useIncomingCall` - React hook for incoming calls
- `IncomingCallScreen` - UI component
- `ActiveCallScreen` - UI component

### Types
- `CallState`
- `CallEvent`
- `IncomingCall`
- `CallId`
- `UserId`
- `UseCallReturn`
- `UseIncomingCallReturn`
- `VoiceSDKConfig`
- `VoiceSDKCallbacks`
- `FirebaseAppConfig`

## Before Publishing

1. **Update repository URL** in `package.json` if you have a Git repository
2. **Add author information** if desired
3. **Test locally** by running `npm pack` to verify what will be included
4. **Review version number** - currently `1.0.0`

## Publishing Command

```bash
# Build the package
npm run build

# Verify what will be published
npm pack

# Publish (when ready)
npm publish --access public
```

## Post-Publish

After publishing, verify:
1. Package appears on npmjs.com
2. Installation works: `npm install voice-sdk`
3. TypeScript declarations are accessible
4. Documentation is visible on npm


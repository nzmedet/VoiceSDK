# Publishing to Private npm Registry

This guide covers publishing `voice-sdk` to private npm registries: **npm private packages** and **GitHub Packages**.

## Option 1: GitHub Packages (Recommended for GitHub Repos)

Since your repo is on GitHub, GitHub Packages is the easiest option.

### Step 1: Update package.json

Add the publish configuration to your `package.json`:

```json
{
  "name": "@YOUR_GITHUB_USERNAME/voice-sdk",
  "version": "1.0.0",
  "description": "Production-grade WebRTC voice calling SDK for React Native",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_GITHUB_USERNAME/voice-sdk.git"
  }
}
```

**Important:** Package name must be scoped as `@username/package-name`

### Step 2: Build the Package

```bash
npm run build
```

This creates the `dist/` directory with compiled JavaScript and TypeScript definitions.

### Step 3: Authenticate with GitHub

Create a Personal Access Token (PAT) with `write:packages` permission:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Name it (e.g., "npm-publish")
4. Select scope: `write:packages`
5. Copy the token

### Step 4: Configure npm for GitHub Packages

**Option A: One-time authentication (recommended)**

```bash
# macOS/Linux
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> ~/.npmrc

# Or edit ~/.npmrc directly
```

**Option B: Per-project (if using multiple registries)**

Create `.npmrc` in the package root:
```bash
# .npmrc (in voice-sdk directory)
@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

**Option C: Environment variable (CI/CD)**

```bash
export NPM_TOKEN=YOUR_TOKEN
```

### Step 5: Publish

```bash
npm publish
```

Your package will be published to: `@YOUR_GITHUB_USERNAME/voice-sdk`

### Step 6: Install in "beheard" Project

```bash
# Create .npmrc in beheard project
echo "@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> .npmrc

# Install
npm install @YOUR_GITHUB_USERNAME/voice-sdk
```

## Option 2: npm Private Packages

For npm's private package registry (requires paid npm account).

### Step 1: Update package.json

```json
{
  "name": "@YOUR_NPM_USERNAME/voice-sdk",
  "version": "1.0.0",
  "publishConfig": {
    "access": "restricted"
  }
}
```

**Note:** Package must be scoped (`@username/package`)

### Step 2: Login to npm

```bash
npm login
# Enter your npm username, password, and email
```

### Step 3: Verify Authentication

```bash
npm whoami
# Should show your npm username
```

### Step 4: Build and Publish

```bash
npm run build
npm publish
```

### Step 5: Install in "beheard"

```bash
npm install @YOUR_NPM_USERNAME/voice-sdk
```

**Note:** Users need access to your private npm organization or must be added as collaborators.

## Option 3: Private npm Registry (Self-Hosted)

For self-hosted npm registries (Verdaccio, Artifactory, etc.).

### Step 1: Configure Registry

```bash
npm config set registry https://your-registry.com
npm config set //your-registry.com/:_authToken YOUR_TOKEN
```

### Step 2: Update package.json

```json
{
  "publishConfig": {
    "registry": "https://your-registry.com"
  }
}
```

### Step 3: Publish

```bash
npm publish
```

## Pre-Publish Checklist

Before publishing, ensure:

- [ ] **Build succeeds**: `npm run build` completes without errors
- [ ] **Tests pass**: `npm test` all tests passing
- [ ] **Version updated**: Update version in `package.json` (semantic versioning)
- [ ] **Files included**: Check `files` field in `package.json` includes:
  - `dist/` (compiled code)
  - `firebase/` (Firestore rules, Cloud Function examples)
  - `docs/` (documentation)
  - `README.md`, `ARCHITECTURE.md` (if needed)
- [ ] **No secrets**: Ensure no API keys, tokens, or secrets in published files
- [ ] **Repository URL**: Set correct repository URL in `package.json`
- [ ] **License**: Set appropriate license (currently MIT)

## Versioning Strategy

Follow semantic versioning:

```bash
# Patch version (bug fixes)
npm version patch  # 1.0.0 → 1.0.1

# Minor version (new features, backwards compatible)
npm version minor  # 1.0.0 → 1.1.0

# Major version (breaking changes)
npm version major  # 1.0.0 → 2.0.0
```

This automatically:
1. Updates version in `package.json`
2. Creates a git tag
3. Commits the change

Then publish:
```bash
npm publish
git push --tags  # Push the new tag
```

## Complete Publishing Script

Create a `publish.sh` script for easy publishing:

```bash
#!/bin/bash
# publish.sh

set -e  # Exit on error

echo "🔨 Building package..."
npm run build

echo "✅ Running tests..."
npm test

echo "📦 Publishing to GitHub Packages..."
npm publish

echo "✅ Published successfully!"
echo "📝 Don't forget to:"
echo "   1. Push tags: git push --tags"
echo "   2. Create GitHub release (optional)"
```

Make it executable:
```bash
chmod +x publish.sh
./publish.sh
```

## CI/CD Publishing (GitHub Actions)

Automate publishing on version tags:

```yaml
# .github/workflows/publish.yml
name: Publish Package

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@YOUR_GITHUB_USERNAME'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Test
        run: npm test
      
      - name: Publish to GitHub Packages
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Publish Release Notes
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.repos.createRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              tag_name: context.ref.replace('refs/tags/', ''),
              name: `Release ${{ github.ref_name }}`
            })
```

## Troubleshooting

### Error: "You must be logged in to publish packages"

**Solution:**
```bash
npm login
# Or for GitHub Packages:
# Add token to ~/.npmrc or .npmrc
```

### Error: "Package name already exists"

**Solution:** Either:
1. Update version number
2. Use a different package name/scope
3. Unpublish (if published <72 hours ago): `npm unpublish @scope/package@version`

### Error: "Package name must be scoped for private packages"

**Solution:** Use scoped package name:
```json
{
  "name": "@username/voice-sdk"
}
```

### Error: "E401 Unauthorized"

**Solution:**
- Check token is valid
- Verify token has correct permissions
- Check `.npmrc` configuration

### Error: "ENOENT: dist/index.js"

**Solution:** Build the package first:
```bash
npm run build
```

## Package.json Example (GitHub Packages)

Complete `package.json` for GitHub Packages:

```json
{
  "name": "@YOUR_GITHUB_USERNAME/voice-sdk",
  "version": "1.0.0",
  "description": "Production-grade WebRTC voice calling SDK for React Native",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "firebase",
    "docs",
    "ARCHITECTURE.md",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src",
    "prepublishOnly": "npm run build && npm test"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_GITHUB_USERNAME/voice-sdk.git"
  },
  "keywords": [
    "webrtc",
    "voice",
    "call",
    "firebase",
    "callkeep",
    "voip",
    "react-native"
  ],
  "author": "YOUR_NAME",
  "license": "MIT",
  "peerDependencies": {
    "react": ">=19",
    "react-native": ">=0.80",
    "firebase": "^12.5.0",
    "@react-native-firebase/app": "^23.5.0",
    "@react-native-firebase/firestore": "^23.5.0",
    "@react-native-firebase/messaging": "^23.5.0",
    "react-native-webrtc": "^124.0.7",
    "react-native-callkeep": "github:cometchat/react-native-callkeep",
    "react-native-pushkit": "^0.1.0"
  },
  "dependencies": {
    "events": "^3.3.0"
  }
}
```

## Installing from Private Registry

### GitHub Packages

In your "beheard" project:

1. Create `.npmrc`:
```bash
@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

2. Install:
```bash
npm install @YOUR_GITHUB_USERNAME/voice-sdk
```

### npm Private Packages

1. Ensure you're logged in:
```bash
npm login
```

2. Install:
```bash
npm install @YOUR_NPM_USERNAME/voice-sdk
```

## Security Best Practices

1. **Never commit tokens**: Add `.npmrc` to `.gitignore` if it contains tokens
2. **Use environment variables**: In CI/CD, use secrets
3. **Rotate tokens regularly**: Update tokens periodically
4. **Limit token scope**: Only grant necessary permissions
5. **Use scoped packages**: Always use scoped names for private packages

## Quick Commands Reference

```bash
# Build
npm run build

# Test
npm test

# Publish (GitHub Packages)
npm publish

# Publish (npm)
npm publish --registry=https://registry.npmjs.org

# Update version
npm version patch|minor|major

# Check who you're logged in as
npm whoami

# View package info
npm view @username/voice-sdk

# Unpublish (within 72 hours)
npm unpublish @username/voice-sdk@version
```


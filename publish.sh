#!/bin/bash
# Quick publish script for voice-sdk

set -e  # Exit on error

echo "🔨 Building package..."
npm run build

echo "✅ Running tests..."
npm test

echo "📦 Publishing to npm..."
npm publish

echo "✅ Published successfully to npm!"
echo ""
echo "📝 Next steps:"
echo "   1. Install anywhere: npm install voice-sdk"
echo "   2. Push tags: git push --tags (if you used npm version)"
echo "   3. Create GitHub release (optional)"
echo "   4. Share: https://www.npmjs.com/package/voice-sdk"


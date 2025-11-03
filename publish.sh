#!/bin/bash
# Quick publish script for voice-sdk

set -e  # Exit on error

echo "🔨 Building package..."
npm run build

echo "✅ Running tests..."
npm test

echo "📦 Publishing to GitHub Packages..."
npm publish

echo "✅ Published successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Install in beheard: npm install @nzmedet/voice-sdk"
echo "   2. Push tags: git push --tags (if you used npm version)"
echo "   3. Create GitHub release (optional)"


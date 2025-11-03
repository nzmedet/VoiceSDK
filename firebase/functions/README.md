# Firebase Cloud Functions - Reusable Helpers

This package provides reusable helper functions that you can import and use in your own Firebase Cloud Functions to handle call events, billing, and database operations.

## Important: You Must Implement Your Own Cloud Functions

**This package does NOT include complete Cloud Functions.** You must implement your own Cloud Functions using these helpers. This keeps the SDK framework-agnostic and allows you to customize:

- Your database schema (collections, documents, fields)
- Your billing logic (pricing model, payment processor)
- Your business logic (notifications, analytics, etc.)
- Your security rules and validation

## Installation

Copy the helper utilities and examples to your Firebase Functions project:

```bash
# Copy helper utilities
mkdir -p your-firebase-project/functions/utils
cp firebase/functions/utils/callHelpers.ts your-firebase-project/functions/utils/

# Copy examples (optional, for reference)
mkdir -p your-firebase-project/functions/examples
cp firebase/functions/examples/*.example.ts your-firebase-project/functions/examples/
```

**Note:** The examples are templates. You MUST customize them before deploying to production.

## Available Helper Functions

### `handleCallEnded(callData, db?)`

Processes call termination, calculates duration, and optionally updates Firestore.

**Parameters:**
- `callData: CallData` - Object containing call information:
  ```typescript
  {
    callId: string;
    callerId: string;
    calleeId: string;
    startTime: number;  // Unix timestamp in milliseconds
    endTime: number;    // Unix timestamp in milliseconds
    duration?: number;   // Optional, will be calculated if not provided
  }
  ```
- `db?: Firestore` - Optional Firestore instance (uses default if not provided)

**Returns:** `Promise<CallData>` - Call data with calculated duration

**Usage:**
```typescript
import { handleCallEnded } from './utils/callHelpers';

const callData = await handleCallEnded({
  callId: 'call123',
  callerId: 'user1',
  calleeId: 'user2',
  startTime: 1234567890000,
  endTime: 1234567950000,
});
// callData.duration is now calculated (in minutes)
```

### `calculateCallCost(durationMinutes, pricePerMinuteCents?)`

Calculates call cost based on duration. Customize the pricing logic for your business model.

**Parameters:**
- `durationMinutes: number` - Call duration in minutes
- `pricePerMinuteCents?: number` - Price per minute in cents (default: 100 = $0.01/min)

**Returns:** `number` - Cost in cents

**Usage:**
```typescript
import { calculateCallCost } from './utils/callHelpers';

const cost = calculateCallCost(5.5, 100); // 5.5 minutes × $0.01 = 550 cents ($5.50)
```

### `handleCallStarted(callData, db?)`

Creates call records in your Firestore database. Adapt the document structure to your schema.

**Parameters:**
- `callData: { callId, callerId, calleeId }` - Call identification
- `db?: Firestore` - Optional Firestore instance

**Returns:** `Promise<DocumentData>` - Created call document data

**Usage:**
```typescript
import { handleCallStarted } from './utils/callHelpers';

await handleCallStarted({
  callId: 'call123',
  callerId: 'user1',
  calleeId: 'user2',
});
```

### `updateCallState(callId, state, db?)`

Updates call state in your Firestore database.

**Parameters:**
- `callId: string` - Call ID
- `state: string` - New call state (e.g., 'ringing', 'active', 'ended')
- `db?: Firestore` - Optional Firestore instance

**Returns:** `Promise<void>`

**Usage:**
```typescript
import { updateCallState } from './utils/callHelpers';

await updateCallState('call123', 'active');
```

## Implementing Your Own Cloud Functions

### Example 1: Firestore Trigger for Call Ending

```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { handleCallEnded, calculateCallCost } from './utils/callHelpers';

/**
 * This function is triggered when a call document is updated.
 * It processes call termination, calculates billing, and updates records.
 */
export const processCallEnded = functions.firestore
  .document('calls/{callId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only process when state changes to 'ended'
    if (before.state !== 'ended' && after.state === 'ended') {
      // Extract timestamps (adjust based on your schema)
      const startTime = before.startTime?.toMillis?.() || before.startTime;
      const endTime = after.endTime?.toMillis?.() || after.endTime;

      if (!startTime || !endTime) {
        console.error('Missing timestamps:', context.params.callId);
        return;
      }

      // Use helper to process call ending
      const callData = await handleCallEnded({
        callId: context.params.callId,
        callerId: after.caller || '',
        calleeId: after.callee || '',
        startTime: typeof startTime === 'number' ? startTime : startTime.getTime(),
        endTime: typeof endTime === 'number' ? endTime : endTime.getTime(),
      });

      // Calculate cost using your pricing model
      const cost = calculateCallCost(callData.duration || 0, 100); // Customize price

      // YOUR BILLING LOGIC HERE
      // Examples:
      // - Update user balance in your database
      // - Create billing record
      // - Send to Stripe/other payment processor
      // - Update analytics
      // - Send notifications

      console.log('Call processed:', {
        callId: context.params.callId,
        duration: callData.duration,
        cost,
      });
    }
  });
```

### Example 2: HTTP Callable Function for Call Initiation

```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { handleCallStarted } from './utils/callHelpers';

/**
 * Call this function from your React Native app to start a call.
 * Adapt to your authentication and validation needs.
 */
export const startCall = functions.https.onCall(async (data, context) => {
  // YOUR AUTHENTICATION & VALIDATION
  if (!context?.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { calleeId } = data;
  if (!calleeId) {
    throw new functions.https.HttpsError('invalid-argument', 'calleeId required');
  }

  // YOUR VALIDATION LOGIC
  // - Verify callee exists
  // - Check if users can call each other
  // - Rate limiting, etc.

  // Generate call ID (adjust based on your needs)
  const callId = admin.firestore().collection('calls').doc().id;

  // Use helper to create call record
  await handleCallStarted({
    callId,
    callerId: context.auth.uid,
    calleeId,
  });

  // YOUR NOTIFICATION LOGIC
  // - Send push notifications
  // - Send in-app notifications
  // - Update presence, etc.

  return { callId };
});
```

### Example 3: Scheduled Function for Cleanup

```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Cleanup stale calls. Customize the logic based on your needs.
 */
export const cleanupStaleCalls = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const db = admin.firestore();
    
    // YOUR CLEANUP LOGIC
    // - Find stale calls
    // - Update state
    // - Handle billing for abandoned calls
    // - Send notifications, etc.
    
    // Example:
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
    const stale = await db.collection('calls')
      .where('lastPing', '<', cutoff)
      .where('state', 'in', ['ringing', 'connecting'])
      .get();
    
    // Process stale calls...
  });
```

## Data Structures

### CallData Interface

```typescript
interface CallData {
  callId: string;
  callerId: string;
  calleeId: string;
  startTime: number;  // Unix timestamp in milliseconds
  endTime: number;    // Unix timestamp in milliseconds
  duration?: number;  // Duration in minutes (calculated by handleCallEnded)
}
```

## Customization

These helpers are designed to be adapted to your needs:

1. **Database Schema**: Modify Firestore collection names, document structure, and field names to match your schema
2. **Billing Logic**: Replace or extend `calculateCallCost` with your pricing model
3. **Business Logic**: Add your own validation, notifications, analytics, etc.
4. **Security**: Implement your own authentication and authorization checks

## Example Implementations

See the `examples/` directory for complete example Cloud Functions:
- `startCall.example.ts` - Example HTTP callable for call initiation
- `endCall.example.ts` - Example HTTP callable and Firestore trigger for call termination
- `cleanup.example.ts` - Example scheduled function for cleaning up stale calls

**Important:** These are EXAMPLES only. You MUST customize them to:
- Match your database schema
- Implement your billing logic
- Add your authentication/authorization
- Integrate with your payment processor
- Add your business validation rules

Do NOT use these examples as-is. Copy and adapt them to your needs.

## Notes

- All timestamps in the SDK are Unix timestamps in milliseconds (JavaScript `Date.now()` format)
- Helper functions use optional Firestore parameters - if not provided, they use the default admin instance
- Errors in helpers are logged but don't throw - this allows your functions to continue even if some operations fail
- Adjust all collection paths, field names, and logic to match your actual database schema
- Example functions are in `examples/` directory - treat them as templates, not production code

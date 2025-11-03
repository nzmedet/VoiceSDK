/**
 * EXAMPLE: Cloud Function for Call Termination and Billing
 * 
 * This is an EXAMPLE implementation. Copy and customize this to match:
 * - Your database schema
 * - Your billing model (pricing, payment processor)
 * - Your notification logic
 * - Your analytics tracking
 * 
 * Do NOT use this as-is. Adapt it to your needs.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { handleCallEnded, calculateCallCost } from '../utils/callHelpers';

/**
 * Example HTTP callable function to end a call and process billing.
 * Deploy: firebase deploy --only functions:endCall
 * 
 * Call from your React Native app:
 * ```typescript
 * const functions = getFunctions();
 * const endCall = httpsCallable(functions, 'endCall');
 * await endCall({ 
 *   callId: 'call123',
 *   startTime: 1234567890000,
 *   endTime: 1234567950000 
 * });
 * ```
 */
export const endCall = functions.https.onCall(async (data, context) => {
  // YOUR AUTHENTICATION CHECK
  if (!context?.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { callId, startTime, endTime, callerId, calleeId } = data as {
    callId: string;
    startTime: number;
    endTime: number;
    callerId?: string;
    calleeId?: string;
  };

  // YOUR VALIDATION
  if (!callId || !startTime || !endTime) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'callId, startTime, and endTime are required'
    );
  }

  const db = admin.firestore();

  // Use helper to process call ending
  const callData = await handleCallEnded(
    {
      callId,
      callerId: callerId || context.auth.uid,
      calleeId: calleeId || '',
      startTime,
      endTime,
    },
    db
  );

  // YOUR BILLING LOGIC
  // Example: Calculate cost (customize pricing model)
  const cost = calculateCallCost(callData.duration || 0, 100); // $0.01/min = 100 cents/min

  // YOUR PAYMENT PROCESSING
  // Examples:
  // 1. Stripe:
  //    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  //    await stripe.charges.create({ amount: cost, currency: 'usd', ... });
  //
  // 2. Update user balance:
  //    await db.collection('users').doc(callerId).update({
  //      balance: admin.firestore.FieldValue.increment(-cost)
  //    });
  //
  // 3. Create billing record:
  //    await db.collection('billing').add({
  //      callId,
  //      userId: callerId,
  //      amount: cost,
  //      duration: callData.duration,
  //      timestamp: admin.firestore.FieldValue.serverTimestamp()
  //    });

  // YOUR ANALYTICS/NOTIFICATIONS
  // - Track call metrics
  // - Send notifications to users
  // - Update dashboards

  console.log('Call ended and billed:', {
    callId,
    duration: callData.duration,
    cost,
  });

  return {
    callId,
    duration: callData.duration,
    cost,
  };
});

/**
 * Example Firestore trigger that automatically processes call ending.
 * This is RECOMMENDED for automatic billing.
 * Deploy: firebase deploy --only functions:processCallEnded
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

      const db = admin.firestore();

      // Use helper to process call ending
      const callData = await handleCallEnded(
        {
          callId: context.params.callId,
          callerId: after.caller || '',
          calleeId: after.callee || '',
          startTime: typeof startTime === 'number' ? startTime : startTime.getTime(),
          endTime: typeof endTime === 'number' ? endTime : endTime.getTime(),
        },
        db
      );

      // YOUR BILLING LOGIC
      const cost = calculateCallCost(callData.duration || 0, 100);

      // YOUR PAYMENT PROCESSING (same as above)

      console.log('Processed call ended:', {
        callId: context.params.callId,
        duration: callData.duration,
        cost,
      });
    }
  });


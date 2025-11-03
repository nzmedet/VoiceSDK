/**
 * EXAMPLE: Cloud Function for Call Initiation
 * 
 * This is an EXAMPLE implementation. Copy and customize this to match:
 * - Your database schema (collection names, field names)
 * - Your authentication/authorization logic
 * - Your push notification setup
 * - Your business validation rules
 * 
 * Do NOT use this as-is. Adapt it to your needs.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { handleCallStarted } from '../utils/callHelpers';

/**
 * Example HTTP callable function to initiate a call.
 * Deploy: firebase deploy --only functions:startCall
 * 
 * Call from your React Native app:
 * ```typescript
 * const functions = getFunctions();
 * const startCall = httpsCallable(functions, 'startCall');
 * const result = await startCall({ calleeId: 'user123' });
 * const { callId } = result.data;
 * ```
 */
export const startCall = functions.https.onCall(async (data, context) => {
  // YOUR AUTHENTICATION CHECK
  if (!context?.auth?.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const callerId = context.auth.uid;
  const { calleeId } = data;

  // YOUR VALIDATION LOGIC
  if (!calleeId || typeof calleeId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'calleeId is required and must be a string'
    );
  }

  const db = admin.firestore();

  // YOUR BUSINESS LOGIC: Verify callee exists, check permissions, rate limits, etc.
  // Example:
  // const calleeDoc = await db.collection('users').doc(calleeId).get();
  // if (!calleeDoc.exists) {
  //   throw new functions.https.HttpsError('not-found', 'Callee not found');
  // }

  // Generate call ID (or use your own ID generation logic)
  const callId = db.collection('calls').doc().id;

  // Use helper to create call record (modify to match your schema)
  await handleCallStarted(
    {
      callId,
      callerId,
      calleeId,
    },
    db
  );

  // YOUR PUSH NOTIFICATION LOGIC
  // Example:
  // const calleeData = calleeDoc.data();
  // if (calleeData?.voipToken) {
  //   await admin.messaging().send({
  //     token: calleeData.voipToken,
  //     // ... your push notification config
  //   });
  // }

  return {
    callId,
    callerId,
    calleeId,
  };
});


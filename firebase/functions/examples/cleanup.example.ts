/**
 * EXAMPLE: Scheduled Cloud Function for Cleanup
 * 
 * This is an EXAMPLE implementation. Copy and customize this to match:
 * - Your cleanup criteria (timeout duration, states to clean)
 * - Your stale call handling (notification, billing, etc.)
 * 
 * Do NOT use this as-is. Adapt it to your needs.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Example scheduled function to cleanup stale calls.
 * Runs every 5 minutes. Adjust schedule and criteria as needed.
 * 
 * Deploy: firebase deploy --only functions:cleanupStaleCalls
 * 
 * To customize schedule:
 * ```typescript
 * functions.pubsub.schedule('every 10 minutes') // Change frequency
 * ```
 */
export const cleanupStaleCalls = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    
    // YOUR CLEANUP CRITERIA
    // Example: Calls that haven't been pinged in 5 minutes
    const cutoffTime = admin.firestore.Timestamp.fromMillis(
      Date.now() - 5 * 60 * 1000 // 5 minutes ago
    );

    // Find stale calls (adjust query to match your schema)
    const staleCallsQuery = db
      .collection('calls')
      .where('lastPing', '<', cutoffTime)
      .where('state', 'in', ['ringing', 'connecting', 'active']); // Adjust states

    const snapshot = await staleCallsQuery.get();

    if (snapshot.empty) {
      console.log('No stale calls to cleanup');
      return null;
    }

    // Process stale calls
    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      // const callData = doc.data();
      
      // YOUR STALE CALL HANDLING
      // Examples:
      // - Mark as ended
      // - Calculate partial billing
      // - Send notifications
      // - Update analytics

      batch.update(doc.ref, {
        state: 'ended',
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        reason: 'stale_timeout',
        // Add any other fields needed
      });
      
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Cleaned up ${count} stale calls`);
    }

    return null;
  });


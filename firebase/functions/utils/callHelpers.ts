import * as admin from 'firebase-admin';

export interface CallData {
  callId: string;
  callerId: string;
  calleeId: string;
  startTime: number; // Unix timestamp in milliseconds
  endTime: number; // Unix timestamp in milliseconds
  duration?: number; // Duration in minutes (calculated)
}

/**
 * Reusable function to handle call ending logic.
 * Use this in your own Cloud Functions to process call termination.
 * 
 * **Note:** This function attempts to update a Firestore document at `calls/{callId}`.
 * If your schema differs, modify this function or handle database updates separately.
 * 
 * @param callData - Call information including IDs, timestamps, and participants
 * @param db - Firestore database instance (optional, will use default if not provided)
 * @returns Call data with calculated duration (in minutes)
 */
export async function handleCallEnded(
  callData: CallData,
  db?: admin.firestore.Firestore
): Promise<CallData> {
  const firestoreDb = db || admin.firestore();
  
  // Calculate duration in minutes
  const duration = (callData.endTime - callData.startTime) / 60000;
  const roundedDuration = Math.round(duration * 100) / 100; // Round to 2 decimals
  
  const finalCallData: CallData = {
    ...callData,
    duration: roundedDuration,
  };
  
  // Update call document if it exists
  try {
    const callRef = firestoreDb.collection('calls').doc(callData.callId);
    const callDoc = await callRef.get();
    
    if (callDoc.exists) {
      await callRef.update({
        state: 'ended',
        endTime: admin.firestore.Timestamp.fromMillis(callData.endTime),
        duration: roundedDuration,
      });
    }
  } catch (error) {
    console.error('Failed to update call document:', error);
    // Don't throw - allow billing to proceed even if document update fails
  }
  
  return finalCallData;
}

/**
 * Reusable function to calculate call cost based on duration.
 * Customize the pricing logic to match your business model.
 * 
 * @param durationMinutes - Call duration in minutes
 * @param pricePerMinuteCents - Price per minute in cents (default: 1 cent = $0.01)
 * @returns Cost in cents
 */
export function calculateCallCost(
  durationMinutes: number,
  pricePerMinuteCents: number = 100
): number {
  return Math.ceil(durationMinutes * pricePerMinuteCents);
}

/**
 * Reusable function to handle call started logic.
 * Use this in your own Cloud Functions to create call records.
 * 
 * **Note:** This function writes to `calls/{callId}` with a specific schema.
 * Adapt this function to match your database schema, or use it as a reference
 * and implement your own call record creation logic.
 * 
 * @param callData - Call information including IDs
 * @param db - Firestore database instance (optional, will use default if not provided)
 * @returns Created call document data
 */
export async function handleCallStarted(
  callData: Pick<CallData, 'callId' | 'callerId' | 'calleeId'>,
  db?: admin.firestore.Firestore
): Promise<admin.firestore.DocumentData> {
  const firestoreDb = db || admin.firestore();
  
  // NOTE: This writes to 'calls' collection with a specific schema
  // Modify this to match your database schema or use as reference
  const callRef = firestoreDb.collection('calls').doc(callData.callId);
  
  const callDataToStore = {
    caller: callData.callerId,
    callee: callData.calleeId,
    state: 'ringing',
    startTime: admin.firestore.Timestamp.fromMillis(Date.now()),
    lastPing: admin.firestore.Timestamp.now(),
    version: 1,
  };
  
  await callRef.set(callDataToStore);
  
  return callDataToStore;
}

/**
 * Reusable function to update call state.
 * Use this in your own Cloud Functions to update call state.
 * 
 * **Note:** This function updates a document at `calls/{callId}`.
 * Modify to match your database schema or implement your own state update logic.
 * 
 * @param callId - Call ID
 * @param state - New call state (e.g., 'ringing', 'active', 'ended')
 * @param db - Firestore database instance (optional, will use default if not provided)
 */
export async function updateCallState(
  callId: string,
  state: string,
  db?: admin.firestore.Firestore
): Promise<void> {
  const firestoreDb = db || admin.firestore();
  
  const callRef = firestoreDb.collection('calls').doc(callId);
  const callDoc = await callRef.get();
  
  if (callDoc.exists) {
    const currentVersion = callDoc.data()?.version || 0;
    await callRef.update({
      state,
      version: currentVersion + 1,
    });
  }
}


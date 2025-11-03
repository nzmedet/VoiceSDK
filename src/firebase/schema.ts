import { UserId, CallState, FirebaseTimestamp } from '../core/types';
import type { RTCIceCandidateInit } from '../core/webrtc-types';

// Firestore: /users/{userId}
// Note: This is a minimal reference schema. Add your own fields for payment processors,
// user profiles, preferences, etc. as needed for your application.
export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  voipToken?: string; // Required for iOS VoIP push notifications
  fcmToken?: string; // Required for Android FCM push notifications
  // Add your own fields here (billing, payment processor IDs, etc.)
}

// Firestore: /calls/{callId}
// Note: This is a minimal reference schema for call signaling and state management.
// Add your own fields for billing, analytics, metadata, etc. as needed.
// Keep this document lean - store billing records separately if possible.
export interface CallDoc {
  caller: UserId;
  callee: UserId;
  state: CallState;
  start_time: FirebaseTimestamp;
  end_time?: FirebaseTimestamp;
  duration?: number; // in minutes (optional, calculated when call ends)
  lastPing: FirebaseTimestamp; // For stale call detection
  version: number; // For optimistic concurrency control
  // Add your own fields here (payment IDs, billing records, etc.) if needed
}

// Subcollection: /calls/{callId}/signaling
export interface SignalingMessageDoc {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  seq: number;
  sender: UserId;
  timestamp: FirebaseTimestamp;
}


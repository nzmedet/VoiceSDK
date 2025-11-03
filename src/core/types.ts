export type UserId = string;
export type CallId = string;

export type CallState =
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'active'
  | 'ended'
  | 'failed';

// Participant object - reusable structure for caller and callee
export interface CallParticipant {
  id: string;
  displayName: string;
  photoURL?: string;
}

export interface CallEvent {
  callId: CallId;
  startTime: number; // Unix timestamp in milliseconds
  endTime: number; // Unix timestamp in milliseconds
  participants: [UserId, UserId];
}

export interface IncomingCall {
  callId: CallId;
  caller: CallParticipant;
  callee?: CallParticipant; // Current user receiving the call (optional - can be auto-populated)
}

// Firebase Timestamp type
export type FirebaseTimestamp = {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
};

import type { RTCIceCandidateInit } from './webrtc-types';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  seq: number;
  sender: UserId;
  timestamp: FirebaseTimestamp | null; // Firebase Timestamp
}


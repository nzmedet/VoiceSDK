export type UserId = string;
export type CallId = string;

export type CallState =
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'active'
  | 'ended'
  | 'failed';

export interface CallEvent {
  callId: CallId;
  startTime: number; // Unix timestamp in milliseconds
  endTime: number; // Unix timestamp in milliseconds
  participants: [UserId, UserId];
}

export interface IncomingCall {
  callId: CallId;
  callerId: UserId;
  callerName: string;
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


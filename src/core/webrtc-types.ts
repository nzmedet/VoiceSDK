// Re-export types from react-native-webrtc package
import type RTCPeerConnectionClass from 'react-native-webrtc/lib/typescript/RTCPeerConnection';
import type RTCSessionDescriptionClass from 'react-native-webrtc/lib/typescript/RTCSessionDescription';
import type RTCIceCandidateClass from 'react-native-webrtc/lib/typescript/RTCIceCandidate';
import type MediaStreamClass from 'react-native-webrtc/lib/typescript/MediaStream';
import type MediaStreamTrackClass from 'react-native-webrtc/lib/typescript/MediaStreamTrack';

// Extract types from RTCPeerConnection (these are declared internally in the package)
// Since react-native-webrtc uses declare type (not exported), we need to infer from the class
export type RTCPeerConnection = InstanceType<typeof RTCPeerConnectionClass> & {
  // Legacy event handler support (react-native-webrtc may support these at runtime)
  onicecandidate?: ((event: RTCIceCandidateEvent) => void) | null;
  ontrack?: ((event: RTCTrackEvent) => void) | null;
  onconnectionstatechange?: (() => void) | null;
  oniceconnectionstatechange?: (() => void) | null;
  onsignalingstatechange?: (() => void) | null;
};

import type RTCIceCandidateEventClass from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent';
import type RTCTrackEventClass from 'react-native-webrtc/lib/typescript/RTCTrackEvent';

type RTCIceCandidateEvent = InstanceType<typeof RTCIceCandidateEventClass>;
type RTCTrackEvent = InstanceType<typeof RTCTrackEventClass>;

export type RTCSessionDescription = InstanceType<typeof RTCSessionDescriptionClass>;
export type RTCIceCandidate = InstanceType<typeof RTCIceCandidateClass>;
export type MediaStream = InstanceType<typeof MediaStreamClass>;
export type MediaStreamTrack = InstanceType<typeof MediaStreamTrackClass>;

// Import and re-export RTCSessionDescriptionInit
export type { RTCSessionDescriptionInit } from 'react-native-webrtc/lib/typescript/RTCSessionDescription';

// Type aliases for internal types (these match what react-native-webrtc uses internally)
// These are inferred from RTCPeerConnection usage
export type RTCIceServer = {
  urls?: string | string[];
  url?: string;
  username?: string;
  credential?: string;
};

export type RTCConfiguration = {
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: 'all' | 'relay';
  bundlePolicy?: 'balanced' | 'max-compat' | 'max-bundle';
  rtcpMuxPolicy?: 'negotiate' | 'require';
  iceCandidatePoolSize?: number;
};

// Extract state types from RTCPeerConnection properties
export type RTCPeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
export type RTCIceConnectionState = 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';
export type RTCSignalingState = 'stable' | 'have-local-offer' | 'have-remote-offer' | 'have-local-pranswer' | 'have-remote-pranswer' | 'closed';
export type RTCIceGatheringState = 'new' | 'gathering' | 'complete';

// RTCIceCandidateInit matches what's in RTCIceCandidate
export type RTCIceCandidateInit = {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
};

// RTCOfferOptions
export type { RTCOfferOptions } from 'react-native-webrtc/lib/typescript/RTCUtil';

// Global type augmentation for runtime access (react-native-webrtc registers these globally)
declare global {
  // eslint-disable-next-line no-var
  var RTCPeerConnection: typeof RTCPeerConnectionClass;
  // eslint-disable-next-line no-var
  var RTCSessionDescription: typeof RTCSessionDescriptionClass;
  // eslint-disable-next-line no-var
  var RTCIceCandidate: typeof RTCIceCandidateClass;
  // eslint-disable-next-line no-var
  var MediaStream: typeof MediaStreamClass;
  // eslint-disable-next-line no-var
  var MediaStreamTrack: typeof MediaStreamTrackClass;
  // eslint-disable-next-line no-var
  var navigator: {
    mediaDevices: {
      getUserMedia(constraints: { audio?: boolean; video?: boolean }): Promise<MediaStream>;
      enumerateDevices(): Promise<MediaDeviceInfo[]>;
    };
  };
}

interface MediaDeviceInfo {
  deviceId: string;
  kind: string;
  label: string;
  groupId: string;
}

// Helper functions to get constructors at runtime
interface GlobalWithWebRTC {
  RTCPeerConnection?: typeof RTCPeerConnectionClass;
  RTCSessionDescription?: typeof RTCSessionDescriptionClass;
  RTCIceCandidate?: typeof RTCIceCandidateClass;
}

export function getRTCPeerConnection(): typeof RTCPeerConnectionClass {
  const globalObj = (globalThis as unknown as GlobalWithWebRTC) || (global as unknown as GlobalWithWebRTC);
  if (!globalObj.RTCPeerConnection) {
    throw new Error('RTCPeerConnection is not available. Make sure react-native-webrtc is installed.');
  }
  return globalObj.RTCPeerConnection;
}

export function getRTCSessionDescription(): typeof RTCSessionDescriptionClass {
  const globalObj = (globalThis as unknown as GlobalWithWebRTC) || (global as unknown as GlobalWithWebRTC);
  if (!globalObj.RTCSessionDescription) {
    throw new Error('RTCSessionDescription is not available. Make sure react-native-webrtc is installed.');
  }
  return globalObj.RTCSessionDescription;
}

export function getRTCIceCandidate(): typeof RTCIceCandidateClass {
  const globalObj = (globalThis as unknown as GlobalWithWebRTC) || (global as unknown as GlobalWithWebRTC);
  if (!globalObj.RTCIceCandidate) {
    throw new Error('RTCIceCandidate is not available. Make sure react-native-webrtc is installed.');
  }
  return globalObj.RTCIceCandidate;
}

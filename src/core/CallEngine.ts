// EventEmitter polyfill for React Native
type EventListener = (...args: unknown[]) => void;

class EventEmitter {
  private listeners: Map<string, Set<EventListener>> = new Map();

  on(event: string, listener: EventListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          // Error logged but not thrown to prevent breaking event chain
        }
      });
    }
    return true;
  }

  onRemoteStream(listener: (stream: MediaStream) => void): this {
    return this.on('remoteStream', listener as EventListener);
  }

  onStateChange(listener: (state: RTCPeerConnectionState) => void): this {
    return this.on('stateChange', listener as EventListener);
  }

  onConnectionStateChange(listener: (state: RTCIceConnectionState) => void): this {
    return this.on('connectionStateChange', listener as EventListener);
  }

  onError(listener: (error: Error) => void): this {
    return this.on('error', listener as EventListener);
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  removeListener(event: string, listener: EventListener): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }
}
import { SignalingMessage } from './types';
import type {
  RTCPeerConnection,
  RTCPeerConnectionState,
  RTCIceConnectionState,
  RTCIceServer,
  RTCSessionDescriptionInit,
  RTCIceCandidateInit,
  RTCIceCandidate,
  MediaStream,
  MediaStreamTrack,
} from './webrtc-types';
import {
  getRTCPeerConnection,
  getRTCSessionDescription,
  getRTCIceCandidate,
} from './webrtc-types';
import { logger } from '../utils/logger';
import { forceSdpOptimization } from '../utils/force-sdp';

export interface CallEngineEvents {
  remoteStream: [stream: MediaStream];
  stateChange: [state: RTCPeerConnectionState];
  connectionStateChange: [state: RTCIceConnectionState];
  error: [error: Error];
}

export class CallEngine extends EventEmitter {
  private pc!: RTCPeerConnection; // Initialized in initPC
  private callId: string;
  private role: 'caller' | 'callee';
  private seq = 0;
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private localStream?: MediaStream;
  private sendSignaling?: (msg: SignalingMessage) => Promise<void>;

  constructor(callId: string, role: 'caller' | 'callee', turnServers?: RTCIceServer[]) {
    super();
    this.callId = callId;
    this.role = role;
    this.initPC(turnServers);
  }

  setSignalingHandler(handler: (msg: SignalingMessage) => Promise<void>): void {
    this.sendSignaling = handler;
  }

  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    const tracks = stream.getTracks();
    const transceiver = this.pc.addTransceiver('audio', { direction: 'sendrecv' });
    tracks.forEach((track) => {
      this.pc.addTrack(track, stream);
      transceiver.sender.replaceTrack(track);
    });
  }

  private initPC(turnServers?: RTCIceServer[]): void {
    // RTCPeerConnection is provided by react-native-webrtc at runtime
    const RTCPeerConnectionConstructor = getRTCPeerConnection();
    this.pc = new RTCPeerConnectionConstructor({
      iceServers: turnServers || [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    });

    this.pc.addTransceiver('audio', { direction: 'sendrecv' });

    this.pc.onicecandidate = ((e: { candidate: RTCIceCandidate | null }) => {
      if (e.candidate && this.sendSignaling) {
        this.sendSignaling({
          type: 'candidate',
          candidate: e.candidate.toJSON(),
          seq: ++this.seq,
          sender: '',
          timestamp: null,
        });
      }
    }) as ((event: { candidate: RTCIceCandidate | null }) => void) | null;

    this.pc.ontrack = ((e: { streams: MediaStream[]; track: MediaStreamTrack | null }) => {
      if (e.streams && e.streams[0]) {
        this.emit('remoteStream', e.streams[0] as unknown);
      }
    }) as ((event: { streams: MediaStream[]; track: MediaStreamTrack | null }) => void) | null;

    this.pc.onconnectionstatechange = () => {
      this.handleStateChange();
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      logger.debug('ICE connection state changed:', state);

      if (state === 'failed') {
        logger.warn('ICE connection failed, attempting restart');
        this.restartIce();
      } else if (state === 'disconnected') {
        logger.warn('ICE connection disconnected');
        // Don't restart immediately - wait to see if it reconnects
      } else if (state === 'connected' || state === 'completed') {
        logger.debug('ICE connection established');
        // Reset reconnect attempts on successful connection
        if (this.reconnectAttempts > 0) {
          logger.debug('ICE reconnected successfully, resetting reconnect attempts');
          this.reconnectAttempts = 0;
        }
      }
    };
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      offer.sdp = forceSdpOptimization(offer.sdp)

      await this.pc.setLocalDescription(offer);

      if (this.sendSignaling) {
        try {
          await this.sendSignaling({
            type: 'offer',
            sdp: offer.sdp || undefined,
            seq: ++this.seq,
            sender: '',
            timestamp: null,
          });
        } catch (signalingError) {
          logger.error('Failed to send offer via signaling:', signalingError);
          // Don't throw - offer is set locally and might still work
        }
      }

      return offer;
    } catch (error) {
      logger.error('Failed to create offer:', error);
      throw new Error(`Failed to create WebRTC offer: ${(error as Error).message}`);
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!offer.sdp) {
      throw new Error('Offer missing SDP');
    }

    try {
      const RTCSessionDescriptionConstructor = getRTCSessionDescription();
      await this.pc.setRemoteDescription(new RTCSessionDescriptionConstructor(offer));

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      if (this.sendSignaling) {
        try {
          await this.sendSignaling({
            type: 'answer',
            sdp: answer.sdp || undefined,
            seq: ++this.seq,
            sender: '',
            timestamp: null,
          });
        } catch (signalingError) {
          logger.error('Failed to send answer via signaling:', signalingError);
          // Don't throw - answer is set locally and might still work
        }
      }
    } catch (error) {
      logger.error('Failed to handle offer:', error);
      throw new Error(`Failed to handle WebRTC offer: ${(error as Error).message}`);
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!answer.sdp) {
      throw new Error('Answer missing SDP');
    }

    try {
      const RTCSessionDescriptionConstructor = getRTCSessionDescription();
      await this.pc.setRemoteDescription(new RTCSessionDescriptionConstructor(answer));
    } catch (error) {
      logger.error('Failed to handle answer:', error);
      throw new Error(`Failed to handle WebRTC answer: ${(error as Error).message}`);
    }
  }

  async handleCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    // Validate candidate
    if (!candidate.candidate && !candidate.sdpMid) {
      logger.warn('Invalid ICE candidate: missing candidate and sdpMid');
      return;
    }

    try {
      const RTCIceCandidateConstructor = getRTCIceCandidate();
      await this.pc.addIceCandidate(new RTCIceCandidateConstructor(candidate));
    } catch (error) {
      // Log but don't throw - invalid candidates are common and non-fatal
      logger.debug('Failed to add ICE candidate (non-fatal):', error);
    }
  }

  private async restartIce(): Promise<void> {
    // Prevent ICE restart if already restarting or connection is closed
    if (this.pc.signalingState !== 'stable') {
      logger.debug('Cannot restart ICE: signaling state is not stable', this.pc.signalingState);
      return;
    }

    if (this.pc.connectionState === 'closed') {
      logger.debug('Cannot restart ICE: connection is closed');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnects) {
      const error = new Error('Max reconnection attempts reached');
      logger.error(error.message, { attempts: this.reconnectAttempts, max: this.maxReconnects });
      this.emit('error', error);
      return;
    }

    this.reconnectAttempts++;
    logger.debug('Restarting ICE', { attempt: this.reconnectAttempts, max: this.maxReconnects });

    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        iceRestart: true
      });
      offer.sdp = forceSdpOptimization(offer.sdp);
      await this.pc.setLocalDescription(offer);

      if (this.sendSignaling) {
        try {
          await this.sendSignaling({
            type: 'offer',
            sdp: offer.sdp || undefined,
            seq: ++this.seq,
            sender: '',
            timestamp: null,
          });
        } catch (signalingError) {
          logger.error('Failed to send ICE restart offer:', signalingError);
          // Don't throw - ICE restart offer might still work locally
        }
      }
    } catch (error) {
      logger.error('Failed to restart ICE:', error);
      this.emit('error', error as Error);
    }
  }

  private handleStateChange(): void {
    this.emit('stateChange', this.pc.connectionState);
    this.emit('connectionStateChange', this.pc.iceConnectionState);
  }

  async endCall(): Promise<void> {
    try {
      logger.info('CallEngine: Ending call and cleaning up resources');
      // Stop local stream tracks
      if (this.localStream) {
        try {
          const tracks = this.localStream.getTracks();
          tracks.forEach((track) => {
            try {
              track.stop();
            } catch (err) {
              logger.warn('Error stopping track:', err);
            }
          });
        } catch (err) {
          logger.warn('Error accessing local stream tracks:', err);
        }
        this.localStream = undefined;
      }

      // Close peer connection
      try {
        if (this.pc.connectionState !== 'closed') {
          this.pc.close();
        }
      } catch (err) {
        logger.warn('Error closing peer connection:', err);
      }

      // Remove all event listeners
      try {
        this.removeAllListeners();
      } catch (err) {
        logger.warn('Error removing listeners:', err);
      }

      // Reset state
      this.sendSignaling = undefined;
      this.reconnectAttempts = 0;
      this.seq = 0;
    } catch (err) {
      logger.error('Error in endCall:', err);
      // Ensure cleanup happens even on error
      try {
        this.pc.close();
      } catch (closeErr) {
        logger.error('Error forcing peer connection close:', closeErr);
      }
    }
  }

  getPeerConnection(): RTCPeerConnection {
    return this.pc;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}


import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
// Removed Firestore imports - hooks no longer manage call state in Firestore
// Developers should handle call state in their own database via callbacks
import { CallEngine } from '../core/CallEngine';
import { SignalingManager } from '../core/SignalingManager';
import { CallKeepManager } from '../callkeep/CallKeepManager';
import { IncomingCall, SignalingMessage, CallId, CallState, UserId } from '../core/types';
import { logger } from '../utils/logger';
import type { VoIPPushPayload } from '../voip/VoIPPushIOS';
import type { FCMPushPayload } from '../voip/FCMPushAndroid';
import type { RTCSessionDescriptionInit, MediaStream, RTCIceServer } from '../core/webrtc-types';
import '../core/webrtc-types'; // Import for global type declarations

// Shared interface for accessing VoiceSDK instance
interface GlobalVoiceSDK {
  VoiceSDK?: {
    instance?: {
      notifyCallStateChanged: (callId: CallId, state: CallState) => Promise<void>;
      notifyCallEnded: (callId: CallId, startTime: number, endTime: number, participants: [UserId, UserId]) => Promise<void>;
    };
    config?: { turnServers?: RTCIceServer[] };
  };
}

export interface UseIncomingCallReturn {
  incomingCall: IncomingCall | null;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  isAnswering: boolean;
}

// Helper to get local stream (moved to utils for reuse)
async function getLocalStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  // Cast to our MediaStream interface - runtime stream from react-native-webrtc
  return stream as unknown as MediaStream;
}

interface IncomingCallMetadata {
  callId: CallId;
  callerId: UserId;
  startTime: number; // When call was received
}

export function useIncomingCall(
  onIncomingCall?: (call: IncomingCall) => void
): UseIncomingCallReturn {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  const engineRef = useRef<CallEngine | undefined>(undefined);
  const signalingRef = useRef<SignalingManager | undefined>(undefined);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const callMetadataRef = useRef<IncomingCallMetadata | undefined>(undefined);
  const localStreamRef = useRef<MediaStream | undefined>(undefined);
  const remoteStreamRef = useRef<MediaStream | undefined>(undefined);

  // Listen for incoming calls from push notifications
  useEffect(() => {
    const handler = (payload: { callId: string; callerId: string; callerName?: string }) => {
      // Validate payload
      if (!payload || !payload.callId || !payload.callerId) {
        logger.warn('Invalid incoming call payload:', payload);
        return;
      }

      // Prevent duplicate incoming calls (check both state and ref)
      const currentCallId = incomingCall?.callId || callMetadataRef.current?.callId;
      if (currentCallId === payload.callId) {
        logger.debug('Duplicate incoming call ignored:', payload.callId);
        return;
      }

      logger.debug('Incoming call received:', payload);
      
      // Store metadata
      callMetadataRef.current = {
        callId: payload.callId,
        callerId: payload.callerId,
        startTime: Date.now(),
      };

      const call: IncomingCall = {
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName || 'Unknown',
      };

      setIncomingCall(call);

      if (onIncomingCall) {
        try {
          onIncomingCall(call);
        } catch (err) {
          logger.error('Error in onIncomingCall callback:', err);
        }
      }
    };

    // Register handler with VoiceSDK
    interface GlobalVoiceSDK {
      VoiceSDK?: {
        setIncomingCallHandler?: (handler: ((payload: VoIPPushPayload | FCMPushPayload) => void) | undefined) => void;
      };
    }
    const globalSDK = (global as unknown as GlobalVoiceSDK).VoiceSDK;
    if (globalSDK) {
      globalSDK.setIncomingCallHandler?.(handler);
    }

    return () => {
      if (globalSDK) {
        globalSDK.setIncomingCallHandler?.(undefined);
      }
    };
  }, [onIncomingCall]);

  const answer = useCallback(async () => {
    if (!incomingCall) {
      logger.warn('Attempted to answer call but no incoming call');
      return;
    }

    // Prevent concurrent answer attempts
    if (isAnswering) {
      logger.warn('Answer already in progress');
      return;
    }

    const callId = incomingCall.callId;
    try {
      setIsAnswering(true);
      const auth = getAuth();
      if (!auth.currentUser?.uid) {
        throw new Error('User not authenticated');
      }

      // Notify SDK about call state changes
      const voiceSDK = (global as unknown as GlobalVoiceSDK).VoiceSDK;
      if (voiceSDK?.instance) {
        try {
          await voiceSDK.instance.notifyCallStateChanged(callId, 'connecting');
        } catch (err) {
          logger.warn('Error notifying SDK of connecting state:', err);
          // Continue even if callback fails
        }
      }

      // Get local stream
      let stream: MediaStream;
      try {
        stream = await getLocalStream();
        localStreamRef.current = stream;
      } catch (err) {
        logger.error('Failed to get local stream:', err);
        throw new Error(`Failed to access microphone: ${(err as Error).message}`);
      }

      // Initialize call engine
      const config = voiceSDK?.config;
      let engine: CallEngine;
      try {
        engine = new CallEngine(callId, 'callee', config?.turnServers);
        engineRef.current = engine;
        engine.setLocalStream(stream);
      } catch (err) {
        throw new Error(`Failed to initialize call engine: ${(err as Error).message}`);
      }

      // Initialize signaling
      let signaling: SignalingManager;
      try {
        signaling = new SignalingManager(callId);
        signalingRef.current = signaling;
      } catch (err) {
        throw new Error(`Failed to initialize signaling: ${(err as Error).message}`);
      }

      // Set signaling handler with error handling
      engine.setSignalingHandler(async (msg) => {
        try {
          await signaling.sendSignaling(msg);
        } catch (err) {
          logger.error('Error sending signaling message:', err);
          // Don't throw - allow retry
        }
      });

      // Listen for remote stream
      engine.onRemoteStream((remote: MediaStream) => {
        logger.debug('Remote stream received');
        remoteStreamRef.current = remote;
      });

      // Listen for connection state changes
      engine.onConnectionStateChange((state) => {
        logger.debug('ICE connection state changed:', state);
      });

      // Listen for errors
      engine.onError((err: Error) => {
        logger.error('Call engine error:', err);
        // Don't auto-decline on error, let user handle it
      });

      // Handle signaling messages with error recovery
      const unsubscribe = signaling.subscribeToSignaling(
        async (msg: SignalingMessage) => {
          try {
            if (msg.type === 'offer') {
              if (!msg.sdp) {
                logger.warn('Received offer without SDP');
                return;
              }
              await engine.handleOffer({ type: 'offer', sdp: msg.sdp } as RTCSessionDescriptionInit);
              
              // Notify call is active
              if (voiceSDK?.instance) {
                try {
                  await voiceSDK.instance.notifyCallStateChanged(callId, 'active');
                  await CallKeepManager.setCurrentCallActive(callId);
                } catch (err) {
                  logger.warn('Error notifying SDK of active state:', err);
                }
              }

              setIncomingCall(null);
            } else if (msg.type === 'candidate' && msg.candidate) {
              await engine.handleCandidate(msg.candidate);
            }
          } catch (err) {
            logger.error('Error handling signaling message:', err);
            // Don't auto-decline - allow retry
          }
        },
        (err: Error) => {
          logger.error('Signaling subscription error:', err);
          // Don't auto-decline on subscription error
        }
      );

      cleanupRef.current = unsubscribe;

    } catch (err) {
      logger.error('Failed to answer call:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Cleanup on error
      try {
        await decline();
      } catch (declineErr) {
        logger.error('Error declining after failed answer:', declineErr);
      }
      
      throw error;
    } finally {
      setIsAnswering(false);
    }
  }, [incomingCall, isAnswering]);

  const decline = useCallback(async () => {
    if (!incomingCall) {
      return;
    }

    const callId = incomingCall.callId;
    try {
      // Cleanup resources
      if (engineRef.current) {
        try {
          await engineRef.current.endCall();
        } catch (err) {
          logger.warn('Error ending engine on decline:', err);
        }
        engineRef.current = undefined;
      }

      // Clean up local stream
      if (localStreamRef.current) {
        try {
          const tracks = localStreamRef.current.getTracks();
          tracks.forEach((track) => {
            try {
              track.stop();
            } catch (err) {
              logger.warn('Error stopping local track on decline:', err);
            }
          });
        } catch (err) {
          logger.warn('Error accessing local stream tracks on decline:', err);
        }
        localStreamRef.current = undefined;
      }

      // Clean up remote stream
      if (remoteStreamRef.current) {
        try {
          const tracks = remoteStreamRef.current.getTracks();
          tracks.forEach((track) => {
            try {
              track.stop();
            } catch (err) {
              logger.warn('Error stopping remote track on decline:', err);
            }
          });
        } catch (err) {
          logger.warn('Error accessing remote stream tracks on decline:', err);
        }
        remoteStreamRef.current = undefined;
      }

      // Clean up signaling
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (err) {
          logger.warn('Error cleaning up signaling on decline:', err);
        }
        cleanupRef.current = undefined;
      }

      if (signalingRef.current) {
        try {
          signalingRef.current.cleanup();
        } catch (err) {
          logger.warn('Error cleaning up signaling manager on decline:', err);
        }
        signalingRef.current = undefined;
      }

      // Notify SDK about call declined/ended with proper metadata
      const metadata = callMetadataRef.current;
      const voiceSDKDecline = (global as unknown as GlobalVoiceSDK).VoiceSDK;
      if (voiceSDKDecline?.instance && metadata) {
        try {
          await voiceSDKDecline.instance.notifyCallStateChanged(callId, 'ended');
          const endTime = Date.now();
          const auth = getAuth();
          const calleeId = auth.currentUser?.uid || '';
          await voiceSDKDecline.instance.notifyCallEnded(
            callId,
            metadata.startTime,
            endTime,
            [metadata.callerId, calleeId]
          );
        } catch (err) {
          logger.error('Error notifying SDK of call decline:', err);
        }
      }

      // End CallKeep call
      try {
        await CallKeepManager.endCall(callId);
      } catch (err) {
        logger.warn('Error ending CallKeep call:', err);
      }

      setIncomingCall(null);
      callMetadataRef.current = undefined;
    } catch (err) {
      logger.error('Failed to decline call:', err);
      // Ensure state is cleared even on error
      setIncomingCall(null);
      callMetadataRef.current = undefined;
    }
  }, [incomingCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup signaling
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (err) {
          logger.warn('Error cleaning up signaling on unmount:', err);
        }
      }

      if (signalingRef.current) {
        try {
          signalingRef.current.cleanup();
        } catch (err) {
          logger.warn('Error cleaning up signaling manager on unmount:', err);
        }
      }

      // End engine
      if (engineRef.current) {
        try {
          engineRef.current.endCall();
        } catch (err) {
          logger.warn('Error ending engine on unmount:', err);
        }
      }

      // Stop local stream
      if (localStreamRef.current) {
        try {
          const tracks = localStreamRef.current.getTracks();
          tracks.forEach((track) => {
            try {
              track.stop();
            } catch (err) {
              logger.warn('Error stopping local track on unmount:', err);
            }
          });
        } catch (err) {
          logger.warn('Error accessing local stream tracks on unmount:', err);
        }
      }

      // Stop remote stream
      if (remoteStreamRef.current) {
        try {
          const tracks = remoteStreamRef.current.getTracks();
          tracks.forEach((track) => {
            try {
              track.stop();
            } catch (err) {
              logger.warn('Error stopping remote track on unmount:', err);
            }
          });
        } catch (err) {
          logger.warn('Error accessing remote stream tracks on unmount:', err);
        }
      }

      callMetadataRef.current = undefined;
    };
  }, []);

  return {
    incomingCall,
    answer,
    decline,
    isAnswering,
  };
}


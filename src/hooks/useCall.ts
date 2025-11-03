import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
// Removed Firestore imports - hooks no longer manage call state in Firestore
// Developers should handle call state in their own database via callbacks
import { CallEngine } from '../core/CallEngine';
import { SignalingManager } from '../core/SignalingManager';
import { CallKeepManager } from '../callkeep/CallKeepManager';
import { CallId, CallState, SignalingMessage, UserId } from '../core/types';
import { logger } from '../utils/logger';
import type { RTCSessionDescriptionInit, MediaStream } from '../core/webrtc-types';
import '../core/webrtc-types'; // Import for global type declarations

// Shared interface for accessing VoiceSDK instance
interface GlobalVoiceSDK {
  VoiceSDK?: {
    instance?: {
      notifyCallStarted: (callId: CallId, callerId: UserId, calleeId: UserId) => Promise<void>;
      notifyCallStateChanged: (callId: CallId, state: CallState) => Promise<void>;
      notifyCallEnded: (callId: CallId, startTime: number, endTime: number, participants: [UserId, UserId]) => Promise<void>;
    };
    config?: { turnServers?: RTCIceServer[] };
  };
}

// Import RTCIceServer for the interface
import type { RTCIceServer } from '../core/webrtc-types';

export interface UseCallReturn {
  startCall: (calleeId: string) => Promise<void>;
  endCall: () => Promise<void>;
  isConnected: boolean;
  callState: CallState;
  remoteStream?: MediaStream;
  localStream?: MediaStream;
  callId?: CallId;
  error?: Error;
}

interface CallMetadata {
  callId: CallId;
  callerId: UserId;
  calleeId: UserId;
  startTime: number; // Unix timestamp in milliseconds
}

export function useCall(): UseCallReturn {
  const [callState, setCallState] = useState<CallState>('idle');
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [callId, setCallId] = useState<CallId>();
  const [error, setError] = useState<Error>();
  const [isConnected, setIsConnected] = useState(false);

  const engineRef = useRef<CallEngine | undefined>(undefined);
  const signalingRef = useRef<SignalingManager | undefined>(undefined);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const callMetadataRef = useRef<CallMetadata | undefined>(undefined);
  const isCallInProgressRef = useRef<boolean>(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      // Cast to our MediaStream interface - runtime stream from react-native-webrtc
      return stream as unknown as MediaStream;
    } catch (err) {
      logger.error('Failed to get local stream:', err);
      throw err;
    }
  }, []);

  const endCall = useCallback(async () => {
    // Prevent concurrent endCall calls
    if (!isCallInProgressRef.current && callState === 'idle') {
      return;
    }

    try {
      // Clear any pending timeouts
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = undefined;
      }

      // End engine and cleanup resources
      if (engineRef.current) {
        try {
          await engineRef.current.endCall();
        } catch (err) {
          logger.warn('Error ending engine:', err);
        }
        engineRef.current = undefined;
      }

      // Clean up local stream
      if (localStream) {
        try {
          const tracks = localStream.getTracks();
          tracks.forEach((track) => {
            track.stop();
          });
        } catch (err) {
          logger.warn('Error stopping local stream tracks:', err);
        }
        setLocalStream(undefined);
      }

      // Clean up remote stream
      if (remoteStream) {
        try {
          const tracks = remoteStream.getTracks();
          tracks.forEach((track) => {
            track.stop();
          });
        } catch (err) {
          logger.warn('Error stopping remote stream tracks:', err);
        }
        setRemoteStream(undefined);
      }

      // Clean up signaling subscription
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (err) {
          logger.warn('Error cleaning up signaling:', err);
        }
        cleanupRef.current = undefined;
      }

      if (signalingRef.current) {
        try {
          signalingRef.current.cleanup();
        } catch (err) {
          logger.warn('Error cleaning up signaling manager:', err);
        }
        signalingRef.current = undefined;
      }

      // Notify SDK about call ended with proper metadata
      const metadata = callMetadataRef.current;
      if (metadata) {
        const voiceSDKEnded = (global as unknown as GlobalVoiceSDK).VoiceSDK;
        if (voiceSDKEnded?.instance) {
          try {
            const endTime = Date.now();
            await voiceSDKEnded.instance.notifyCallStateChanged(metadata.callId, 'ended');
            await voiceSDKEnded.instance.notifyCallEnded(
              metadata.callId,
              metadata.startTime,
              endTime,
              [metadata.callerId, metadata.calleeId]
            );
          } catch (err) {
            logger.error('Error notifying SDK of call end:', err);
          }
        }

        // End CallKeep call
        try {
          await CallKeepManager.endCall(metadata.callId);
        } catch (err) {
          logger.warn('Error ending CallKeep call:', err);
        }
      }

      // Reset state
      setIsConnected(false);
      setCallId(undefined);
      setCallState('idle');
      setError(undefined);
      callMetadataRef.current = undefined;
      isCallInProgressRef.current = false;
    } catch (err) {
      logger.error('Error ending call:', err);
      setError(err as Error);
      // Ensure state is reset even on error
      setCallState('idle');
      isCallInProgressRef.current = false;
    }
  }, [callId, callState, localStream, remoteStream]);

  const startCall = useCallback(async (calleeId: string) => {
    // Validate input
    if (!calleeId || typeof calleeId !== 'string' || calleeId.trim().length === 0) {
      const err = new Error('Invalid calleeId: must be a non-empty string');
      setError(err);
      throw err;
    }

    // Prevent concurrent calls
    if (isCallInProgressRef.current) {
      const err = new Error('Call already in progress. End current call before starting a new one.');
      setError(err);
      throw err;
    }

    // Ensure previous call is fully cleaned up
    if (callState !== 'idle') {
      logger.warn('Previous call not fully cleaned up, cleaning up now...');
      await endCall();
      // Wait a bit for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      isCallInProgressRef.current = true;
      setError(undefined);
      setCallState('ringing');

      const auth = getAuth();
      if (!auth.currentUser?.uid) {
        throw new Error('User not authenticated');
      }

      const callerId = auth.currentUser.uid;

      // Start local stream
      let stream: MediaStream | undefined;
      try {
        stream = await getLocalStream();
        setLocalStream(stream);
      } catch (err) {
        logger.error('Failed to get local stream:', err);
        throw new Error(`Failed to access microphone: ${(err as Error).message}`);
      }

      // Generate call ID (developers can override this with their own call creation logic)
      // The callId should be created by the developer's backend/database, not by this SDK
      const newCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now(); // Track start time immediately
      
      // Store call metadata
      callMetadataRef.current = {
        callId: newCallId,
        callerId,
        calleeId: calleeId.trim(),
        startTime,
      };

      setCallId(newCallId);
      
      // Notify SDK about call started
      const voiceSDK = (global as unknown as GlobalVoiceSDK).VoiceSDK;
      if (voiceSDK?.instance) {
        try {
          await voiceSDK.instance.notifyCallStarted(newCallId, callerId, calleeId);
          await voiceSDK.instance.notifyCallStateChanged(newCallId, 'ringing');
        } catch (err) {
          logger.warn('Error notifying SDK of call start:', err);
          // Continue even if callback fails
        }
      }

      // Initialize call engine
      const config = voiceSDK?.config;
      let engine: CallEngine;
      try {
        engine = new CallEngine(newCallId, 'caller', config?.turnServers);
        engineRef.current = engine;
      } catch (err) {
        throw new Error(`Failed to initialize call engine: ${(err as Error).message}`);
      }

      // Set local stream
      engine.setLocalStream(stream);

      // Initialize signaling
      let signaling: SignalingManager;
      try {
        signaling = new SignalingManager(newCallId);
        signalingRef.current = signaling;
      } catch (err) {
        throw new Error(`Failed to initialize signaling: ${(err as Error).message}`);
      }

      // Set signaling handler
      engine.setSignalingHandler(async (msg) => {
        try {
          await signaling.sendSignaling(msg);
        } catch (err) {
          logger.error('Error sending signaling message:', err);
          // Don't throw - allow retry
        }
      });


      // Listen for connection state changes
      engine.onConnectionStateChange((state) => {
        logger.debug('ICE connection state changed:', state);
        if (state === 'connected' || state === 'completed') {
          setIsConnected(true);
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = undefined;
          }
        } else if (state === 'failed' || state === 'disconnected') {
          setIsConnected(false);
        }
      });

      // Listen for errors
      engine.onError((err: Error) => {
        logger.error('Call engine error:', err);
        setError(err);
        if (callState !== 'ended') {
          setCallState('failed');
        }
      });

      // Handle signaling messages with error recovery
      const unsubscribe = signaling.subscribeToSignaling(
        async (msg: SignalingMessage) => {
          try {
            if (msg.type === 'answer') {
              if (!msg.sdp) {
                logger.warn('Received answer without SDP');
                return;
              }
              await engine.handleAnswer({ type: 'answer', sdp: msg.sdp } as RTCSessionDescriptionInit);
              setCallState('active');
              
              // Notify SDK about state change
              const voiceSDKAnswer = (global as unknown as GlobalVoiceSDK).VoiceSDK;
              if (voiceSDKAnswer?.instance && newCallId) {
                try {
                  await voiceSDKAnswer.instance.notifyCallStateChanged(newCallId, 'active');
                } catch (err) {
                  logger.warn('Error notifying SDK of active state:', err);
                }
              }

              // Clear connection timeout
              if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = undefined;
              }
            } else if (msg.type === 'candidate' && msg.candidate) {
              await engine.handleCandidate(msg.candidate);
            }
          } catch (err) {
            logger.error('Error handling signaling message:', err);
            setError(err as Error);
            // Don't end call on signaling error - allow retry
          }
        },
        (err: Error) => {
          logger.error('Signaling subscription error:', err);
          setError(err);
          setCallState('failed');
        }
      );

      cleanupRef.current = unsubscribe;

      // Create offer
      try {
        await engine.createOffer();
      } catch (err) {
        throw new Error(`Failed to create WebRTC offer: ${(err as Error).message}`);
      }

      // Notify connecting state
      setCallState('connecting');
      const voiceSDKConnecting = (global as unknown as GlobalVoiceSDK).VoiceSDK;
      if (voiceSDKConnecting?.instance) {
        try {
          await voiceSDKConnecting.instance.notifyCallStateChanged(newCallId, 'connecting');
        } catch (err) {
          logger.warn('Error notifying SDK of connecting state:', err);
        }
      }

      // Listen for remote stream
      const timeoutStateRef = { active: false };
      engine.onRemoteStream((remote: MediaStream) => {
        timeoutStateRef.active = true;
        logger.debug('Remote stream received');
        setRemoteStream(remote);
        setIsConnected(true);
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = undefined;
        }
      });

      // Set connection timeout (30 seconds to establish connection)
      // Use ref to avoid stale closure issues
      const timeoutCallId = newCallId;
      connectionTimeoutRef.current = setTimeout(() => {
        // Check if this timeout is still relevant (call hasn't ended or already connected)
        if (callMetadataRef.current?.callId === timeoutCallId && !timeoutStateRef.active) {
          logger.warn('Connection timeout - call taking too long to establish');
          setError(new Error('Connection timeout: Call took too long to establish'));
          setCallState('failed');
          isCallInProgressRef.current = false;
        }
      }, 30000);

    } catch (err) {
      logger.error('Failed to start call:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setCallState('failed');
      isCallInProgressRef.current = false;
      
      // Cleanup on error
      try {
        await endCall();
      } catch (cleanupErr) {
        logger.error('Error during cleanup after failed start:', cleanupErr);
      }
      
      throw error;
    }
  }, [getLocalStream, endCall, isConnected, callState]);

  // Cleanup on unmount or when call state changes to idle
  useEffect(() => {
    return () => {
      // Clear timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

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
      if (localStream) {
        try {
          const tracks = localStream.getTracks();
          tracks.forEach((track) => {
            try {
              track.stop();
            } catch (err) {
              logger.warn('Error stopping track on unmount:', err);
            }
          });
        } catch (err) {
          logger.warn('Error accessing local stream tracks on unmount:', err);
        }
      }

      // Stop remote stream
      if (remoteStream) {
        try {
          const tracks = remoteStream.getTracks();
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

      // Reset refs
      isCallInProgressRef.current = false;
      callMetadataRef.current = undefined;
    };
  }, [localStream, remoteStream]);

  return {
    startCall,
    endCall,
    isConnected,
    callState,
    remoteStream,
    localStream,
    callId,
    error,
  };
}


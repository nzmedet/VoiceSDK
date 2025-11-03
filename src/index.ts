import { CallKeepManager } from './callkeep/CallKeepManager';
import { VoIPPushIOS, VoIPPushPayload } from './voip/VoIPPushIOS';
import { FCMPushAndroid, FCMPushPayload } from './voip/FCMPushAndroid';
import { logger } from './utils/logger';
import { CallEvent, CallState, CallId, UserId } from './core/types';
import type { RTCIceServer } from './core/webrtc-types';
import { registerGlobals } from 'react-native-webrtc';
import auth from '@react-native-firebase/auth';

import { CallParticipant } from './core/types';

// Extended call metadata interface for stored call information
export interface CallMetadata {
  callId: CallId;
  caller: CallParticipant;
  callee: CallParticipant;
  metadata?: Record<string, unknown>; // Additional metadata from push payload
  receivedAt: number; // Timestamp when call was received
}

export interface VoiceSDKCallbacks {
  /**
   * Called when a push token is received. Implement this to store tokens in your database.
   * Optional - you can handle token storage via your own push notification handlers.
   */
  onTokenUpdate?: (platform: 'ios' | 'android', token: string) => Promise<void> | void;
  
  /**
   * Called when a call is started. Use this for client-side logic only.
   * For server-side logic (database updates, billing), use the reusable functions
   * from firebase/functions/ in your own Cloud Functions.
   */
  onCallStarted?: (callId: CallId, callerId: UserId, calleeId: UserId) => Promise<void> | void;
  
  /**
   * Called when a call state changes. Use this for client-side logic only.
   * For server-side logic, use the reusable functions from firebase/functions/.
   */
  onCallStateChanged?: (callId: CallId, state: CallState) => Promise<void> | void;
  
  /**
   * Called when a call ends. Use this for client-side UI updates only.
   * For server-side logic (billing, database), use the reusable functions
   * from firebase/functions/ in your own Cloud Functions.
   * startTime and endTime are Unix timestamps in milliseconds.
   */
  onCallEnded?: (callId: CallId, startTime: number, endTime: number) => Promise<void> | void;
}

export interface VoiceSDKConfig {
  turnServers?: RTCIceServer[];
  appName: string;
  /**
   * Optional callbacks for client-side handling only.
   * For server-side logic (billing, database), use the reusable functions
   * from firebase/functions/ in your own Cloud Functions.
   */
  callbacks?: VoiceSDKCallbacks;
  customScreens?: {
    IncomingCallScreen?: React.ComponentType<Record<string, unknown>>;
    ActiveCallScreen?: React.ComponentType<Record<string, unknown>>;
  };
}

export class VoiceSDKInstance {
  config?: VoiceSDKConfig;
  private eventListeners: Map<string, Set<(data: CallEvent) => void>> = new Map();
  private incomingCallHandler?: (payload: VoIPPushPayload | FCMPushPayload) => void;
  // Store call metadata keyed by callId for easy access without refetching
  private callMetadataStore: Map<CallId, CallMetadata> = new Map();
  
  private getCallbacks(): VoiceSDKCallbacks {
    return this.config?.callbacks || {};
  }

  async init(config: VoiceSDKConfig): Promise<void> {
    this.config = config;

    // Register WebRTC globals (required for react-native-webrtc)
    try {
      registerGlobals();
      logger.info('WebRTC globals registered');
    } catch (error) {
      logger.warn('Failed to register WebRTC globals (may already be registered):', error);
    }

    logger.info('Firebase initialized');

    // Initialize CallKeep
    await CallKeepManager.initialize(config.appName);

    // Initialize push notifications
    this.initializePushNotifications();

    logger.info('VoiceSDK initialized');
  }

  /**
   * Get the context value for VoiceSDKProvider
   * This should be called after init() and passed to VoiceSDKProvider
   */
  getContextValue(): {
    config?: VoiceSDKConfig;
    instance: VoiceSDKInstance;
    setIncomingCallHandler: (handler: ((payload: VoIPPushPayload | FCMPushPayload) => void) | undefined) => void;
    getCallMetadata: (callId: CallId) => CallMetadata | undefined;
  } {
    return {
      config: this.config,
      instance: this,
      setIncomingCallHandler: (handler) => {
        this.incomingCallHandler = handler || undefined;
      },
      getCallMetadata: (callId: CallId) => this.getCallMetadata(callId),
    };
  }

  private initializePushNotifications(): void {
    const callbacks = this.getCallbacks();
    
    // iOS VoIP Push
    VoIPPushIOS.initialize(
      async (token) => {
        logger.debug('VoIP token received:', token);
        
        // Call callback if provided (for client-side handling)
        // Developer should store the token in their own database
        if (callbacks.onTokenUpdate) {
          try {
            await callbacks.onTokenUpdate('ios', token);
          } catch (error) {
            logger.error('Error in onTokenUpdate callback:', error);
          }
        }
      },
      (payload) => {
        logger.debug('VoIP push received:', payload);
        this.handleIncomingCall(payload);
      }
    );

    // Android FCM Push
    FCMPushAndroid.initialize(
      async (token) => {
        logger.debug('FCM token received:', token);
        
        // Call callback if provided (for client-side handling)
        // Developer should store the token in their own database
        if (callbacks.onTokenUpdate) {
          try {
            await callbacks.onTokenUpdate('android', token);
          } catch (error) {
            logger.error('Error in onTokenUpdate callback:', error);
          }
        }
      },
      (payload) => {
        logger.debug('FCM push received:', payload);
        this.handleIncomingCall(payload);
      }
    );
  }

  private handleIncomingCall(payload: VoIPPushPayload | FCMPushPayload): void {
    // Get current user ID (callee - person receiving the call)
    const currentUser = auth().currentUser;
    
    // Auto-populate callee if not provided
    const callee: CallParticipant = payload.callee || {
      id: currentUser?.uid || '',
      displayName: currentUser?.displayName || 'Unknown',
      photoURL: currentUser?.photoURL || '',
    };
    
    // Enrich payload with callee if not provided
    const enrichedPayload = {
      ...payload,
      callee,
    };
    
    // Store call metadata for later access
    const callMetadata: CallMetadata = {
      callId: enrichedPayload.callId,
      caller: enrichedPayload.caller,
      callee: enrichedPayload.callee || callee,
      receivedAt: Date.now(),
    };
    
    this.callMetadataStore.set(enrichedPayload.callId, callMetadata);
    logger.debug('Stored call metadata:', callMetadata);
    
    // Pass enriched payload to handler
    if (this.incomingCallHandler) {
      this.incomingCallHandler(enrichedPayload);
    }

    // Also report to CallKeep
    CallKeepManager.reportIncomingCall(
      enrichedPayload.callId,
      enrichedPayload.caller.id,
      enrichedPayload.caller.displayName
    ).catch((error: unknown) => {
      logger.error('Failed to report incoming call to CallKeep:', error);
    });
  }

  /**
   * Call this method when a call is started. It will trigger the onCallStarted callback.
   * For server-side logic, use the reusable functions from firebase/functions/ in your Cloud Functions.
   */
  async notifyCallStarted(callId: CallId, callerId: UserId, calleeId: UserId): Promise<void> {
    const callbacks = this.getCallbacks();
    if (callbacks.onCallStarted) {
      try {
        await callbacks.onCallStarted(callId, callerId, calleeId);
      } catch (error) {
        logger.error('Error in onCallStarted callback:', error);
      }
    }
  }
  
  /**
   * Call this method when a call state changes. It will trigger the onCallStateChanged callback.
   * For server-side logic, use the reusable functions from firebase/functions/ in your Cloud Functions.
   */
  async notifyCallStateChanged(callId: CallId, state: CallState): Promise<void> {
    const callbacks = this.getCallbacks();
    if (callbacks.onCallStateChanged) {
      try {
        await callbacks.onCallStateChanged(callId, state);
      } catch (error) {
        logger.error('Error in onCallStateChanged callback:', error);
      }
    }
  }
  
  /**
   * Call this method when a call ends. It will trigger the onCallEnded callback and emit the call:ended event.
   * startTime and endTime should be Unix timestamps in milliseconds.
   * For server-side logic (billing, database), use the reusable functions from firebase/functions/ in your Cloud Functions.
   */
  async notifyCallEnded(callId: CallId, startTime: number, endTime: number, participants: [UserId, UserId]): Promise<void> {
    const callbacks = this.getCallbacks();
    if (callbacks.onCallEnded) {
      try {
        await callbacks.onCallEnded(callId, startTime, endTime);
      } catch (error) {
        logger.error('Error in onCallEnded callback:', error);
      }
    }
    
    // Emit event for backwards compatibility
    this.emit('call:ended', {
      callId,
      startTime,
      endTime,
      participants,
    });
    
    // Clean up stored metadata after a delay to allow apps to access it
    // Clear after 5 minutes to handle edge cases
    setTimeout(() => {
      this.clearCallMetadata(callId);
    }, 5 * 60 * 1000);
  }

  enableDebugMode(): void {
    logger.enableDebug();
    logger.debug('Debug mode enabled');
  }

  disableDebugMode(): void {
    logger.disableDebug();
  }

  on(event: 'call:ended', callback: (data: CallEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: 'call:ended', callback: (data: CallEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event: 'call:ended', data: CallEvent): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Get stored call metadata by callId.
   * This allows apps to access caller/callee info without refetching from backend.
   * 
   * @param callId - The call ID to look up
   * @returns Call metadata if found, undefined otherwise
   */
  getCallMetadata(callId: CallId): CallMetadata | undefined {
    return this.callMetadataStore.get(callId);
  }

  /**
   * Remove call metadata from store (called when call ends to free memory).
   * 
   * @param callId - The call ID to remove
   */
  clearCallMetadata(callId: CallId): void {
    this.callMetadataStore.delete(callId);
    logger.debug('Cleared call metadata for:', callId);
  }
}

// Export singleton instance
export const VoiceSDK = new VoiceSDKInstance();

// Export Context provider
export { VoiceSDKProvider, useVoiceSDKContext } from './context/VoiceSDKContext';
export type { VoiceSDKContextValue, VoiceSDKProviderProps } from './context/VoiceSDKContext';

// Export hooks
export { useCall } from './hooks/useCall';
export { useIncomingCall } from './hooks/useIncomingCall';

// Export UI components
export { IncomingCallScreen } from './ui/IncomingCallScreen';
export { ActiveCallScreen } from './ui/ActiveCallScreen';

// Export types
export type {
  CallState,
  CallEvent,
  IncomingCall,
  CallId,
  UserId,
  CallParticipant,
} from './core/types';

// CallMetadata is already exported as an interface above
export type { UseCallReturn } from './hooks/useCall';
export type { UseIncomingCallReturn } from './hooks/useIncomingCall';


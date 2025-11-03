import { addTokenListener, addPayloadListener, addErrorListener } from 'react-native-pushkit';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

import { CallParticipant } from '../core/types';

export interface VoIPPushPayload {
  callId: string;
  caller: CallParticipant;
  callee?: CallParticipant; // Current user receiving the call (will be auto-populated if not provided)
  // Additional metadata from backend can be stored here
  metadata?: Record<string, unknown>;
}

interface TokenPayload {
  token: string;
}

interface PayloadPayload {
  payload: Record<string, unknown>;
}

interface ErrorPayload {
  error: string | Error;
}

export class VoIPPushIOS {
  private static tokenCallback?: (token: string) => void;
  private static incomingCallCallback?: (payload: VoIPPushPayload) => void;
  private static storedToken: string | null = null;
  private static isInitialized = false;

  static initialize(
    onToken: (token: string) => void,
    onIncomingCall: (payload: VoIPPushPayload) => void
  ): void {
    if (Platform.OS !== 'ios') {
      logger.warn('VoIPPushIOS: Only available on iOS');
      return;
    }

    // Prevent multiple initializations
    if (this.isInitialized) {
      logger.warn('VoIPPushIOS: Already initialized');
      return;
    }

    this.tokenCallback = onToken;
    this.incomingCallCallback = onIncomingCall;

    try {
      // Use event listeners instead of PushRegistry
      addTokenListener((event: TokenPayload) => {
        const token = event.token;
        logger.debug('VoIP push token received:', token);
        
        // Store token for getToken() method
        this.storedToken = token;
        
        if (this.tokenCallback) {
          this.tokenCallback(token);
        }
      });

      addPayloadListener((event: PayloadPayload) => {
        logger.debug('VoIP push received:', event.payload);
        const data = event.payload;
        
        if (this.incomingCallCallback) {
          const callId = String(data.callId || '');
          
          // Extract caller - must be an object with id, displayName, photoURL
          const callerObj = data.caller as Record<string, unknown> | undefined;
          if (!callerObj || typeof callerObj !== 'object' || Array.isArray(callerObj)) {
            logger.error('Invalid caller object in VoIP push payload');
            return;
          }
          
          const caller: CallParticipant = {
            id: String(callerObj.id || ''),
            displayName: String(callerObj.displayName || 'Unknown'),
            photoURL: callerObj.photoURL ? String(callerObj.photoURL) : undefined,
            // Include any additional fields from the caller object
            ...Object.keys(callerObj).reduce((acc, key) => {
              if (!['id', 'displayName', 'photoURL'].includes(key)) {
                acc[key] = callerObj[key];
              }
              return acc;
            }, {} as Record<string, unknown>),
          };
          
          // Extract callee - optional, must be an object if provided
          let callee: CallParticipant | undefined;
          if (data.callee && typeof data.callee === 'object' && !Array.isArray(data.callee)) {
            const calleeObj = data.callee as Record<string, unknown>;
            callee = {
              id: String(calleeObj.id || ''),
              displayName: String(calleeObj.displayName || 'Unknown'),
              photoURL: calleeObj.photoURL ? String(calleeObj.photoURL) : undefined,
              // Include any additional fields from the callee object
              ...Object.keys(calleeObj).reduce((acc, key) => {
                if (!['id', 'displayName', 'photoURL'].includes(key)) {
                  acc[key] = calleeObj[key];
                }
                return acc;
              }, {} as Record<string, unknown>),
            };
          }
          
          // Extract metadata (any additional fields from backend, excluding caller/callee objects)
          const metadata: Record<string, unknown> = {};
          Object.keys(data).forEach((key) => {
            if (!['callId', 'caller', 'callee'].includes(key)) {
              metadata[key] = data[key];
            }
          });
          
          this.incomingCallCallback({
            callId,
            caller,
            callee,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
        }
      });

      addErrorListener((event: ErrorPayload) => {
        const error = event.error;
        logger.error('VoIP push registration error:', error);
      });

      this.isInitialized = true;
      logger.info('VoIP push initialized for iOS');
    } catch (error) {
      logger.error('VoIP push initialization failed:', error);
      this.isInitialized = false;
    }
  }

  static getToken(): Promise<string | null> {
    return new Promise((resolve) => {
      if (Platform.OS !== 'ios') {
        resolve(null);
        return;
      }

      // react-native-pushkit doesn't provide a way to get current token
      // Return stored token if available (set when addTokenListener fires)
      if (this.storedToken) {
        resolve(this.storedToken);
      } else {
        // Token not yet received, return null
        logger.debug('VoIP token not yet available');
        resolve(null);
      }
    });
  }

  /**
   * Manually set token (for testing or manual registration)
   */
  static setToken(token: string): void {
    this.storedToken = token;
    if (this.tokenCallback) {
      this.tokenCallback(token);
    }
  }
}

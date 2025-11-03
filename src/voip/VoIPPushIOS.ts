import { addTokenListener, addPayloadListener, addErrorListener } from 'react-native-pushkit';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

export interface VoIPPushPayload {
  callId: string;
  callerId: string;
  callerName?: string;
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
          // Handle both camelCase and snake_case properties
          const callId = (data.callId as string) || (data['callId'] as string) || (data['call_id'] as string) || '';
          const callerId = (data.callerId as string) || (data['callerId'] as string) || (data['caller_id'] as string) || '';
          const callerName = (data.callerName as string) || (data['callerName'] as string) || (data['caller_name'] as string);
          
          this.incomingCallCallback({
            callId,
            callerId,
            callerName,
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

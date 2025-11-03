import { Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes, AuthorizationStatus } from '@react-native-firebase/messaging';
import { logger } from '../utils/logger';
import { CallParticipant } from '../core/types';

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

export interface FCMPushPayload {
  callId: string;
  caller: CallParticipant;
  callee?: CallParticipant; // Current user receiving the call (will be auto-populated if not provided)
  // Additional metadata from backend can be stored here
  metadata?: Record<string, unknown>;
}

export class FCMPushAndroid {
  private static incomingCallCallback?: (payload: FCMPushPayload) => void;
  private static tokenCallback?: (token: string) => void;

  static initialize(
    onToken: (token: string) => void,
    onIncomingCall: (payload: FCMPushPayload) => void
  ): void {
    if (Platform.OS !== 'android') {
      logger.warn('FCMPushAndroid: Only available on Android');
      return;
    }

    this.tokenCallback = onToken;
    this.incomingCallCallback = onIncomingCall;

    try {
      // Request permission
      const messagingInstance = messaging();
      messagingInstance
        .requestPermission()
        .then((authStatus) => {
          if (authStatus === AuthorizationStatus.AUTHORIZED) {
            logger.info('FCM: Notification permission granted');
            this.getToken();
          }
        });

      // Get initial token
      this.getToken();

      // Listen for token refresh
      messagingInstance.onTokenRefresh((token: string) => {
        logger.debug('FCM: Token refreshed:', token);
        if (this.tokenCallback) {
          this.tokenCallback(token);
        }
      });

      // Handle foreground messages
      messagingInstance.onMessage(async (remoteMessage: RemoteMessage) => {
        logger.debug('FCM: Foreground message received:', remoteMessage);
        const messageData = remoteMessage.data;
        if (messageData?.callId) {
          if (this.incomingCallCallback) {
            const callId = String(messageData.callId);
            
            // Extract caller - must be an object or JSON string with id, displayName, photoURL
            let caller: CallParticipant;
            if (messageData.caller && typeof messageData.caller === 'string') {
              // JSON string - parse it
              try {
                const callerObj = JSON.parse(messageData.caller) as Record<string, unknown>;
                caller = {
                  id: String(callerObj.id || ''),
                  displayName: String(callerObj.displayName || 'Unknown'),
                  photoURL: callerObj.photoURL ? String(callerObj.photoURL) : undefined,
                  ...Object.keys(callerObj).reduce((acc, key) => {
                    if (!['id', 'displayName', 'photoURL'].includes(key)) {
                      acc[key] = callerObj[key];
                    }
                    return acc;
                  }, {} as Record<string, unknown>),
                };
              } catch (error) {
                logger.error('Failed to parse caller JSON in FCM payload:', error);
                return;
              }
            } else if (messageData.caller && typeof messageData.caller === 'object' && !Array.isArray(messageData.caller)) {
              // Direct object
              const callerObj = messageData.caller as Record<string, unknown>;
              caller = {
                id: String(callerObj.id || ''),
                displayName: String(callerObj.displayName || 'Unknown'),
                photoURL: callerObj.photoURL ? String(callerObj.photoURL) : undefined,
                ...Object.keys(callerObj).reduce((acc, key) => {
                  if (!['id', 'displayName', 'photoURL'].includes(key)) {
                    acc[key] = callerObj[key];
                  }
                  return acc;
                }, {} as Record<string, unknown>),
              };
            } else {
              logger.error('Invalid caller in FCM payload - must be object or JSON string');
              return;
            }
            
            // Extract callee - optional, must be an object or JSON string if provided
            let callee: CallParticipant | undefined;
            if (messageData.callee) {
              if (typeof messageData.callee === 'string') {
                // JSON string - parse it
                try {
                  const calleeObj = JSON.parse(messageData.callee) as Record<string, unknown>;
                  callee = {
                    id: String(calleeObj.id || ''),
                    displayName: String(calleeObj.displayName || 'Unknown'),
                    photoURL: calleeObj.photoURL ? String(calleeObj.photoURL) : undefined,
                    ...Object.keys(calleeObj).reduce((acc, key) => {
                      if (!['id', 'displayName', 'photoURL'].includes(key)) {
                        acc[key] = calleeObj[key];
                      }
                      return acc;
                    }, {} as Record<string, unknown>),
                  };
                } catch (error) {
                  logger.error('Failed to parse callee JSON in FCM payload:', error);
                }
              } else if (typeof messageData.callee === 'object' && !Array.isArray(messageData.callee)) {
                // Direct object
                const calleeObj = messageData.callee as Record<string, unknown>;
                callee = {
                  id: String(calleeObj.id || ''),
                  displayName: String(calleeObj.displayName || 'Unknown'),
                  photoURL: calleeObj.photoURL ? String(calleeObj.photoURL) : undefined,
                  ...Object.keys(calleeObj).reduce((acc, key) => {
                    if (!['id', 'displayName', 'photoURL'].includes(key)) {
                      acc[key] = calleeObj[key];
                    }
                    return acc;
                  }, {} as Record<string, unknown>),
                };
              }
            }
            
            // Extract metadata (any additional fields from backend)
            const metadata: Record<string, unknown> = {};
            Object.keys(messageData).forEach((key) => {
              if (!['callId', 'caller', 'callee'].includes(key)) {
                metadata[key] = messageData[key];
              }
            });
            
            this.incomingCallCallback({
              callId,
              caller,
              callee,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });
          }
        }
      });

      logger.info('FCM push initialized for Android');
    } catch (error) {
      logger.error('FCM push initialization failed:', error);
    }
  }

  static async getToken(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      return null;
    }

    try {
      const messagingInstance = messaging();
      const token = await messagingInstance.getToken();
      logger.debug('FCM token received:', token);
      if (this.tokenCallback) {
        this.tokenCallback(token);
      }
      return token;
    } catch (error) {
      logger.error('Failed to get FCM token:', error);
      return null;
    }
  }
}


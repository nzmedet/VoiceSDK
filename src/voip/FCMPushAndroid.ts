import { Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes, AuthorizationStatus } from '@react-native-firebase/messaging';
import { logger } from '../utils/logger';
import { CallParticipant } from '../core/types';

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

export interface FCMPushPayload {
  callId: string;
  caller: CallParticipant;
  callee?: CallParticipant; // Current user receiving the call (will be auto-populated if not provided)
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
            const callId = messageData.callId as string
            const caller = JSON.parse(messageData.caller as string) as CallParticipant
            const callee = messageData.callee ? JSON.parse(messageData.callee as string) as CallParticipant : undefined;
            
            this.incomingCallCallback({
              callId,
              caller,
              callee,
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


import { Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes, AuthorizationStatus } from '@react-native-firebase/messaging';
import { logger } from '../utils/logger';

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

export interface FCMPushPayload {
  callId: string;
  callerId: string;
  callerName?: string;
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
            this.incomingCallCallback({
              callId: String(messageData.callId),
              callerId: String(messageData.callerId || ''),
              callerName: messageData.callerName ? String(messageData.callerName) : undefined,
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


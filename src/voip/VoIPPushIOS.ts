import PushKit from 'react-native-pushkit';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

export interface VoIPPushPayload {
  callId: string;
  callerId: string;
  callerName?: string;
}

interface PushRegistry {
  delegate?: {
    pushRegistryDidUpdatePushCredentials?: (registry: unknown, credentials: { token: { toString: () => string } }) => void;
    pushRegistryDidReceiveIncomingPushWithPayload?: (registry: unknown, payload: { dictionaryPayload: Record<string, unknown> }) => void;
  };
  pushCredentialsForType: (type: string) => { token: { toString: () => string } } | null;
}

export class VoIPPushIOS {
  private static pushRegistry: PushRegistry | null = null;
  private static tokenCallback?: (token: string) => void;
  private static incomingCallCallback?: (payload: VoIPPushPayload) => void;

  static initialize(
    onToken: (token: string) => void,
    onIncomingCall: (payload: VoIPPushPayload) => void
  ): void {
    if (Platform.OS !== 'ios') {
      logger.warn('VoIPPushIOS: Only available on iOS');
      return;
    }

    this.tokenCallback = onToken;
    this.incomingCallCallback = onIncomingCall;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PushKitModule = PushKit as any;
      this.pushRegistry = new PushKitModule.PushRegistry('voip') as PushRegistry;

      if (!this.pushRegistry) {
        throw new Error('Failed to create PushRegistry');
      }

      this.pushRegistry.delegate = {
        pushRegistryDidUpdatePushCredentials: (
          _registry: unknown,
          credentials: { token: { toString: () => string } }
        ) => {
          const token = credentials.token.toString();
          logger.debug('VoIP push token received:', token);
          if (this.tokenCallback) {
            this.tokenCallback(token);
          }
        },

        pushRegistryDidReceiveIncomingPushWithPayload: (
          _registry: unknown,
          payload: { dictionaryPayload: Record<string, unknown> }
        ) => {
          logger.debug('VoIP push received:', payload.dictionaryPayload);
          const data = payload.dictionaryPayload;
          if (this.incomingCallCallback) {
            this.incomingCallCallback({
              callId: (data.callId as string) || (data['callId'] as string) || '',
              callerId: (data.callerId as string) || (data['callerId'] as string) || '',
              callerName: (data.callerName as string) || (data['callerName'] as string),
            });
          }
        },
      };

      logger.info('VoIP push initialized for iOS');
    } catch (error) {
      logger.error('VoIP push initialization failed:', error);
    }
  }

  static getToken(): Promise<string | null> {
    return new Promise((resolve) => {
      if (Platform.OS !== 'ios' || !this.pushRegistry) {
        resolve(null);
        return;
      }

      try {
        const credentials = this.pushRegistry.pushCredentialsForType('voip');
        if (credentials && credentials.token) {
          resolve(credentials.token.toString());
        } else {
          resolve(null);
        }
      } catch (error) {
        logger.error('Failed to get VoIP token:', error);
        resolve(null);
      }
    });
  }
}


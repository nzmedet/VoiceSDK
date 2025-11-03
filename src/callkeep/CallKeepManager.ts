import RNCallKeep from 'react-native-callkeep';
import { CallId, UserId } from '../core/types';
import { logger } from '../utils/logger';

export class CallKeepManager {
  private static initialized = false;

  static async initialize(appName: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const options = {
        ios: {
          appName,
        },
        android: {
          alertTitle: 'Permissions required',
          alertDescription: 'This application needs to access your phone accounts',
          cancelButton: 'Cancel',
          okButton: 'ok',
          additionalPermissions: [],
        },
      };

      await RNCallKeep.setup(options);
      RNCallKeep.setAvailable(true);

      // Event handlers
      RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
        logger.debug('CallKeep: answerCall', callUUID);
      });

      RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
        logger.debug('CallKeep: endCall', callUUID);
      });

      this.initialized = true;
      logger.info('CallKeep initialized');
    } catch (error) {
      logger.error('CallKeep initialization failed:', error);
      throw error;
    }
  }

  static async reportIncomingCall(
    callId: CallId,
    callerId: UserId,
    callerName: string = 'Unknown'
  ): Promise<void> {
    try {
      const uuid = callId;
      await RNCallKeep.displayIncomingCall(uuid, callerName, callerName, 'number');
      logger.debug('CallKeep: reported incoming call', { callId, callerId, callerName });
    } catch (error) {
      logger.error('CallKeep: failed to report incoming call:', error);
      throw error;
    }
  }

  static startCall(callId: CallId, calleeName: string): void {
    try {
      const uuid = callId;
      RNCallKeep.startCall(uuid, calleeName, 'number');
      logger.debug('CallKeep: started call', { callId, calleeName });
    } catch (error) {
      logger.error('CallKeep: failed to start call:', error);
      throw error;
    }
  }

  static endCall(callId: CallId): void {
    try {
      const uuid = callId;
      RNCallKeep.endCall(uuid);
      logger.debug('CallKeep: ended call', callId);
    } catch (error) {
      logger.error('CallKeep: failed to end call:', error);
      throw error;
    }
  }

  static setOnHold(callId: CallId, hold: boolean): void {
    try {
      const uuid = callId;
      RNCallKeep.setOnHold(uuid, hold);
      logger.debug('CallKeep: set on hold', { callId, hold });
    } catch (error) {
      logger.error('CallKeep: failed to set on hold:', error);
      throw error;
    }
  }

  static setCurrentCallActive(callId: CallId): void {
    try {
      const uuid = callId;
      RNCallKeep.setCurrentCallActive(uuid);
      logger.debug('CallKeep: set current call active', callId);
    } catch (error) {
      logger.error('CallKeep: failed to set current call active:', error);
      throw error;
    }
  }

  static backToForeground(): void {
    try {
      RNCallKeep.backToForeground();
      logger.debug('CallKeep: returned to foreground');
    } catch (error) {
      logger.error('CallKeep: failed to return to foreground:', error);
    }
  }
}


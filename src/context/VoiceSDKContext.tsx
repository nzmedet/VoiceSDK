import React, { createContext, useContext, ReactNode } from 'react';
import type { VoiceSDKConfig, CallMetadata } from '../index';
import type { VoiceSDKInstance } from '../index';
import { CallId } from '../core/types';
import { VoIPPushPayload } from '../voip/VoIPPushIOS';
import { FCMPushPayload } from '../voip/FCMPushAndroid';

export interface VoiceSDKContextValue {
  config?: VoiceSDKConfig;
  instance?: VoiceSDKInstance;
  setIncomingCallHandler: (handler: ((payload: VoIPPushPayload | FCMPushPayload) => void) | undefined) => void;
  getCallMetadata: (callId: CallId) => CallMetadata | undefined;
}

const VoiceSDKContext = createContext<VoiceSDKContextValue | null>(null);

export interface VoiceSDKProviderProps {
  value: VoiceSDKContextValue;
  children: ReactNode;
}

export function VoiceSDKProvider({ value, children }: VoiceSDKProviderProps): React.ReactElement {
  return <VoiceSDKContext.Provider value={value}>{children}</VoiceSDKContext.Provider>;
}

export function useVoiceSDKContext(): VoiceSDKContextValue {
  const context = useContext(VoiceSDKContext);
  if (!context) {
    throw new Error('useVoiceSDKContext must be used within a VoiceSDKProvider');
  }
  return context;
}


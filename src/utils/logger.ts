// Console type declaration for React Native
declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

let debugMode = false;

export const logger = {
  enableDebug: () => {
    debugMode = true;
  },

  disableDebug: () => {
    debugMode = false;
  },

  debug: (...args: unknown[]) => {
    if (debugMode) {
      console.log('[VoiceSDK]', ...args);
    }
  },

  info: (...args: unknown[]) => {
    console.log('[VoiceSDK]', ...args);
  },

  warn: (...args: unknown[]) => {
    console.warn('[VoiceSDK]', ...args);
  },

  error: (...args: unknown[]) => {
    console.error('[VoiceSDK]', ...args);
  },
};


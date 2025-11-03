// Jest setup file

// Mock react-native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: 'ios',
      select: jest.fn((dict) => dict.ios),
    },
  };
});

// Mock react-native-callkeep
jest.mock('react-native-callkeep', () => ({
  setup: jest.fn().mockResolvedValue(undefined),
  setAvailable: jest.fn(),
  displayIncomingCall: jest.fn().mockResolvedValue(undefined),
  startCall: jest.fn().mockResolvedValue(undefined),
  endCall: jest.fn().mockResolvedValue(undefined),
  setOnHold: jest.fn().mockResolvedValue(undefined),
  setCurrentCallActive: jest.fn().mockResolvedValue(undefined),
  backToForeground: jest.fn().mockResolvedValue(undefined),
  addEventListener: jest.fn(),
}));

// Mock react-native-pushkit
jest.mock('react-native-pushkit', () => ({
  __esModule: true,
  default: {
    PushRegistry: jest.fn().mockImplementation(() => ({
      delegate: {},
    })),
  },
}));

// Mock @react-native-firebase/messaging
jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    requestPermission: jest.fn().mockResolvedValue(1),
    getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
    onTokenRefresh: jest.fn(),
    onMessage: jest.fn(),
  })),
}));


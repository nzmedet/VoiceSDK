import { SignalingManager } from '../src/core/SignalingManager';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
  })),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(() => {
    // Return unsubscribe function
    return jest.fn();
  }),
  addDoc: jest.fn().mockResolvedValue({ id: 'msg-123' }),
  serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' })),
  getDocs: jest.fn().mockResolvedValue({
    docs: [],
  }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: {
      uid: 'user-123',
    },
  })),
}));

describe('SignalingManager', () => {
  let manager: SignalingManager;

  beforeEach(() => {
    manager = new SignalingManager('test-call-123');
  });

  test('should initialize with call ID', () => {
    expect(manager).toBeDefined();
  });

  test('should send signaling message', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { addDoc } = require('firebase/firestore');
    await manager.sendSignaling({
      type: 'offer',
      sdp: 'test-sdp',
      seq: 1,
    });

    expect(addDoc).toHaveBeenCalled();
  });

  test('should subscribe to signaling messages', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { onSnapshot } = require('firebase/firestore');
    const callback = jest.fn();
    const unsubscribe = manager.subscribeToSignaling(callback);

    expect(onSnapshot).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });

  test('should cleanup on unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = manager.subscribeToSignaling(callback);
    unsubscribe();

    manager.cleanup();
    expect(manager).toBeDefined();
  });
});


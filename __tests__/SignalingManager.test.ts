import { SignalingManager } from '../src/core/SignalingManager';

// Create shared mocks - must be at module level for jest.mock hoisting
const mockAdd = jest.fn();
const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn();
const mockGet = jest.fn();
let mockCurrentUser: { uid: string } | null = { uid: 'test-user-id' };

// Mock react-native-firebase modules
jest.mock('@react-native-firebase/firestore', () => {
  // Define FieldValue mock inside the factory to avoid hoisting issues
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => 'server-timestamp'),
  };
  
  // Access shared mocks via closure
  const firestoreFn = jest.fn(() => {
    const mockSignalingCollection = {
      add: mockAdd,
      orderBy: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          onSnapshot: mockOnSnapshot,
          get: mockGet,
        })),
      })),
    };
    
    const mockCallDoc = {
      collection: jest.fn(() => mockSignalingCollection),
    };
    
    const mockCallsCollection = {
      doc: jest.fn(() => mockCallDoc),
    };
    
    return {
      collection: jest.fn(() => mockCallsCollection),
      FieldValue: mockFieldValue,
    };
  });
  
  // Add FieldValue as static property on the function
  (firestoreFn as unknown as { FieldValue: typeof mockFieldValue }).FieldValue = mockFieldValue;
  return firestoreFn;
});

jest.mock('@react-native-firebase/auth', () => {
  // Access shared mock via closure
  return jest.fn(() => ({
    currentUser: mockCurrentUser,
  }));
});

describe('SignalingManager', () => {
  let manager: SignalingManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    mockAdd.mockResolvedValue({ id: 'test-doc-id' });
    mockUnsubscribe.mockReturnValue(undefined);
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);
    mockGet.mockResolvedValue({ docs: [] });
    mockCurrentUser = { uid: 'test-user-id' };
    
    manager = new SignalingManager('test-call-123');
  });

  test('should initialize with call ID', () => {
    expect(manager).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const firestore = require('@react-native-firebase/firestore');
    expect(firestore).toHaveBeenCalled();
  });

  test('should send signaling message', async () => {
    mockAdd.mockResolvedValue({ id: 'test-doc-id' });

    await manager.sendSignaling({
      type: 'offer',
      sdp: 'test-sdp',
      seq: 1,
    });

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'offer',
        sdp: 'test-sdp',
        seq: 1,
        sender: 'test-user-id',
      })
    );
  });

  test('should subscribe to signaling messages', () => {
    const callback = jest.fn();
    const unsubscribe = manager.subscribeToSignaling(callback);

    expect(mockOnSnapshot).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
    // The unsubscribe function is the one returned by onSnapshot, which is mockUnsubscribe
    expect(unsubscribe).toBeDefined();
  });

  test('should handle subscription errors', async () => {
    const mockOnError = jest.fn();
    mockOnSnapshot.mockImplementation((onNext, onError) => {
      // Simulate error being called
      if (onError) {
        setTimeout(() => {
          onError(new Error('Test error'));
        }, 0);
      }
      return mockUnsubscribe;
    });

    const callback = jest.fn();
    manager.subscribeToSignaling(callback, mockOnError);

    expect(mockOnSnapshot).toHaveBeenCalled();
    
    // Wait for async error callback
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
  });

  test('should get signaling history', async () => {
    const mockDocs = [
      { data: () => ({ type: 'offer', seq: 1, sdp: 'test-sdp' }) },
      { data: () => ({ type: 'answer', seq: 2, sdp: 'test-answer' }) },
    ];
    mockGet.mockResolvedValue({ docs: mockDocs });

    const history = await manager.getSignalingHistory();

    expect(mockGet).toHaveBeenCalled();
    expect(history).toHaveLength(2);
    expect(history[0]).toHaveProperty('type', 'offer');
    expect(history[1]).toHaveProperty('type', 'answer');
  });

  test('should cleanup on unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = manager.subscribeToSignaling(callback);
    
    unsubscribe();
    manager.cleanup();
    
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(manager).toBeDefined();
  });

  test('should throw error when user not authenticated', async () => {
    // Set current user to null
    const originalUser = mockCurrentUser;
    mockCurrentUser = null;
    
    // Recreate manager with null user - auth() will return null currentUser
    manager = new SignalingManager('test-call-123');

    await expect(
      manager.sendSignaling({
        type: 'offer',
        sdp: 'test-sdp',
        seq: 1,
      })
    ).rejects.toThrow('User not authenticated');
    
    // Restore for other tests
    mockCurrentUser = originalUser;
  });

  test('should validate signaling message before sending', async () => {
    await expect(
      manager.sendSignaling({
        type: '' as 'offer' | 'answer' | 'candidate',
        seq: 0,
      })
    ).rejects.toThrow('Invalid signaling message');
  });

  test('should retry on network failure', async () => {
    // Reset mock for this test
    mockAdd.mockReset();
    // Fail first two attempts, succeed on third (maxRetries = 3)
    mockAdd
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ id: 'test-doc-id' });

    await manager.sendSignaling({
      type: 'offer',
      sdp: 'test-sdp',
      seq: 1,
    });

    expect(mockAdd).toHaveBeenCalledTimes(3);
    expect(mockAdd).toHaveBeenNthCalledWith(3, expect.objectContaining({
      type: 'offer',
      seq: 1,
    }));
  });
});

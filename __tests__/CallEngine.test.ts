import { off } from 'process';
import { CallEngine } from '../src/core/CallEngine';
import type { MediaStream, MediaStreamTrack } from '../src/core/webrtc-types';

// Mock WebRTC
const mockRTCPeerConnectionImpl = jest.fn().mockImplementation(() => ({
  addTrack: jest.fn(),
  createOffer: jest.fn().mockResolvedValue({
    type: 'offer',
    sdp: 'mock-sdp',
  }),
  createAnswer: jest.fn().mockResolvedValue({
    type: 'answer',
    sdp: 'mock-sdp',
  }),
  setLocalDescription: jest.fn().mockResolvedValue(undefined),
  setRemoteDescription: jest.fn().mockResolvedValue(undefined),
  addIceCandidate: jest.fn().mockResolvedValue(undefined),
  addTransceiver: jest.fn().mockReturnValue({
    sender: {
      replaceTrack: jest.fn(),
    }
  }),
  close: jest.fn(),
  signalingState: 'stable',
  connectionState: 'new',
  iceConnectionState: 'new',
  onicecandidate: null,
  ontrack: null,
  onconnectionstatechange: null,
  oniceconnectionstatechange: null,
}));

// Create a properly typed mock constructor with static method
const mockRTCPeerConnection = Object.assign(mockRTCPeerConnectionImpl, {
  generateCertificate: jest.fn(),
}) as unknown as typeof RTCPeerConnection;

global.RTCPeerConnection = mockRTCPeerConnection;

global.RTCSessionDescription = jest.fn().mockImplementation((desc) => desc);
global.RTCIceCandidate = jest.fn().mockImplementation((candidate) => candidate);

// Mock MediaStream
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([
        {
          stop: jest.fn(),
        },
      ]),
    }),
  },
} as unknown as typeof navigator;

describe('CallEngine', () => {
  let engine: CallEngine;
  let sendSignalingMock: jest.Mock;

  beforeEach(() => {
    sendSignalingMock = jest.fn().mockResolvedValue(undefined);
    engine = new CallEngine('test-call-123', 'caller');
    engine.setSignalingHandler(sendSignalingMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with call ID and role', () => {
    expect(engine).toBeDefined();
  });

  test('should create offer when starting call', async () => {
    await engine.createOffer();
    expect(RTCPeerConnection).toHaveBeenCalled();
  });

  test('should handle ICE restart on connection failure', async () => {
    // Use the public getter method instead of accessing private property
    const pc = engine.getPeerConnection();
    pc.iceConnectionState = 'failed';
    pc.signalingState = 'stable';
    pc.createOffer = jest.fn().mockResolvedValue({
      type: 'offer',
      sdp: 'mock-sdp-restart',
    });

    // Trigger ICE connection state change
    if (pc.oniceconnectionstatechange) {
      pc.oniceconnectionstatechange();
    }

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(pc.createOffer).toHaveBeenCalledWith({ iceRestart: true, offerToReceiveAudio: true, offerToReceiveVideo: false });
  });

  test('should handle answer', async () => {
    const answer = {
      type: 'answer' as const,
      sdp: 'mock-answer-sdp',
    };
    await engine.handleAnswer(answer);
    const pc = engine.getPeerConnection();
    expect(pc.setRemoteDescription).toHaveBeenCalled();
  });

  test('should handle ICE candidate', async () => {
    const candidate = {
      candidate: 'mock-candidate',
      sdpMLineIndex: 0,
      sdpMid: '0',
    };
    await engine.handleCandidate(candidate);
    const pc = engine.getPeerConnection();
    expect(pc.addIceCandidate).toHaveBeenCalled();
  });

  test('should end call and cleanup', async () => {
    const mockTrack = {
      stop: jest.fn(),
      id: 'mock-track-id',
      kind: 'audio',
      label: 'mock-track',
      enabled: true,
      muted: false,
      onended: null,
      onmute: null,
      onunmute: null,
      readyState: 'live',
      clone: jest.fn() as unknown as () => never,
    } as unknown as MediaStreamTrack;
    
    const stream = {
      getTracks: jest.fn().mockReturnValue([mockTrack]),
      getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
      getVideoTracks: jest.fn().mockReturnValue([]),
      getTrackById: jest.fn(),
      addTrack: jest.fn(),
      removeTrack: jest.fn(),
      clone: jest.fn() as unknown as () => never,
      id: 'mock-stream-id',
      active: true,
    } as unknown as MediaStream;

    engine.setLocalStream(stream);
    await engine.endCall();

    const pc = engine.getPeerConnection();
    expect(pc.close).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  test('should limit reconnection attempts', async () => {
    const pc = engine.getPeerConnection();
    pc.iceConnectionState = 'failed';
    pc.signalingState = 'stable';
    pc.createOffer = jest.fn().mockResolvedValue({
      type: 'offer',
      sdp: 'mock-sdp',
    });

    // Trigger multiple failures
    for (let i = 0; i < 10; i++) {
      if (pc.oniceconnectionstatechange) {
        pc.oniceconnectionstatechange();
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(engine.getReconnectAttempts()).toBeLessThanOrEqual(5);
  });
});


import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { CallId, SignalingMessage } from './types';
import { logger } from '../utils/logger';

export class SignalingManager {
  private db = getFirestore();
  private auth = getAuth();
  private unsubscribe?: () => void;
  private lastSeq = 0;

  constructor(private callId: CallId) {}

  async sendSignaling(msg: Omit<SignalingMessage, 'sender' | 'timestamp'>): Promise<void> {
    const sender = this.auth.currentUser?.uid;
    if (!sender) {
      throw new Error('User not authenticated');
    }

    // Validate message
    if (!msg.type || !msg.seq || msg.seq <= 0) {
      throw new Error(`Invalid signaling message: type=${msg.type}, seq=${msg.seq}`);
    }

    // Retry logic for network failures
    const maxRetries = 3;
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await addDoc(collection(this.db, 'calls', this.callId, 'signaling'), {
          ...msg,
          sender,
          timestamp: serverTimestamp(),
        });
        logger.debug('Signaling message sent successfully', { type: msg.type, seq: msg.seq, attempt });
        return; // Success
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Failed to send signaling message (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to send signaling message after ${maxRetries} attempts: ${lastError?.message}`);
  }

  subscribeToSignaling(
    callback: (msg: SignalingMessage) => void,
    onError?: (error: Error) => void
  ): () => void {
    // Cleanup existing subscription if any
    if (this.unsubscribe) {
      try {
        this.unsubscribe();
      } catch (err) {
        logger.warn('Error cleaning up existing signaling subscription:', err);
      }
      this.unsubscribe = undefined;
    }

    const signalingRef = collection(this.db, 'calls', this.callId, 'signaling');
    const q = query(signalingRef, orderBy('seq', 'asc'), orderBy('timestamp', 'asc'));

    try {
      this.unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                try {
                  const data = change.doc.data() as SignalingMessage;
                  
                  // Validate message data
                  if (!data.type || !data.seq) {
                    logger.warn('Invalid signaling message received:', data);
                    return;
                  }

                  // Only process messages from other users
                  if (data.sender !== this.auth.currentUser?.uid) {
                    // Skip messages we've already processed (handle duplicates)
                    if (data.seq > this.lastSeq) {
                      this.lastSeq = data.seq;
                      
                      // Validate and call callback
                      try {
                        callback(data);
                      } catch (callbackError) {
                        logger.error('Error in signaling callback:', callbackError);
                        // Don't rethrow - continue processing other messages
                      }
                    } else {
                      logger.debug('Skipping duplicate signaling message', { seq: data.seq, lastSeq: this.lastSeq });
                    }
                  }
                } catch (err) {
                  logger.error('Error processing signaling message:', err);
                  // Continue processing other messages
                }
              }
            });
          } catch (err) {
            logger.error('Error processing signaling snapshot:', err);
            if (onError) {
              onError(err as Error);
            }
          }
        },
        (error) => {
          logger.error('Signaling subscription error:', error);
          if (onError) {
            try {
              onError(error as Error);
            } catch (callbackError) {
              logger.error('Error in error callback:', callbackError);
            }
          }
        }
      );
    } catch (error) {
      logger.error('Failed to subscribe to signaling:', error);
      if (onError) {
        onError(error as Error);
      }
    }

    return () => {
      if (this.unsubscribe) {
        try {
          this.unsubscribe();
        } catch (err) {
          logger.warn('Error unsubscribing from signaling:', err);
        }
        this.unsubscribe = undefined;
      }
      this.lastSeq = 0; // Reset sequence tracking
    };
  }

  async getSignalingHistory(): Promise<SignalingMessage[]> {
    const signalingRef = collection(this.db, 'calls', this.callId, 'signaling');
    const q = query(signalingRef, orderBy('seq', 'asc'), orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as SignalingMessage);
  }

  cleanup(): void {
    if (this.unsubscribe) {
      try {
        this.unsubscribe();
      } catch (err) {
        logger.warn('Error during signaling cleanup:', err);
      }
      this.unsubscribe = undefined;
    }
    this.lastSeq = 0;
  }
}


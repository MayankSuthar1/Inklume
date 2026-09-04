import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import firebaseConfig from '../firebase-applet-config.json';
import type { JournalEntry, JournalTurn } from './types';
import { isSessionEmpty } from './editor-utils';

// Initialize Firebase App singleton
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Authentication
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with configured database ID
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

// Graceful App Check initialization (client-side only)
if (typeof window !== 'undefined' && firebaseConfig.recaptchaSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(firebaseConfig.recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // App check initialization is non-fatal if offline or in dev
    console.warn('Firebase App Check initialization skipped:', err);
  }
}

// Authentication Helpers
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// Helper to strip undefined values recursively before writing to Firestore
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = sanitizeForFirestore(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        item !== null && typeof item === 'object' ? sanitizeForFirestore(item) : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

// Firestore Operations (Strictly owner-scoped under /users/{userId}/entries/{entryId})

export function subscribeToUserEntries(
  userId: string,
  onEntries: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const validEntries: JournalEntry[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const item: JournalEntry = {
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled reflection',
          content: data.content || null,
          summary: data.summary || '',
          keyInsights: data.keyInsights || [],
          tags: data.tags || [],
          turns: (data.turns || []).map((t: any) => ({
            id: t.id || String(Math.random()),
            role: t.role,
            text: t.text || '',
            timestamp: t.timestamp || Date.now(),
          })),
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          status: data.status || 'active',
        };

        // If an empty entry exists on Firestore (from earlier saves), purge it and do NOT include it!
        if (isSessionEmpty(item)) {
          deleteDoc(docSnap.ref).catch(() => {});
        } else {
          validEntries.push(item);
        }
      });
      onEntries(validEntries);
    },
    (error) => {
      console.error('Firestore entries subscription error code:', error.code);
      onError?.(error);
    }
  );
}

export async function saveJournalEntry(
  userId: string,
  entry: Partial<JournalEntry> & { id: string; turns?: JournalTurn[] }
): Promise<void> {
  if (!userId) throw new Error('Unauthorized: User ID is required to save entry');

  const payload: JournalEntry = {
    id: entry.id,
    userId,
    title: entry.title || 'Untitled reflection',
    content: entry.content !== undefined ? entry.content : null,
    summary: entry.summary || '',
    keyInsights: entry.keyInsights || [],
    tags: entry.tags || [],
    turns: entry.turns || [],
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: entry.status || 'active',
  };

  // STRICT GUARD: Do not save empty sessions to Firestore under any circumstances
  if (isSessionEmpty(payload)) {
    return;
  }

  const entryRef = doc(db, 'users', userId, 'entries', entry.id);
  const sanitized = sanitizeForFirestore(payload);
  await setDoc(entryRef, sanitized, { merge: true });
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error('Unauthorized or invalid entry identifier');
  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryRef);
}

/**
 * Hard delete the entire user subtree in Firestore, then clean up auth account if requested.
 * Complies with Directive 7: A hard delete of their Firestore subtree, not a soft flag.
 */
export async function hardDeleteUserData(userId: string): Promise<void> {
  if (!userId) throw new Error('Unauthorized: User ID is required');

  // Query and batch delete all entries in /users/{userId}/entries
  const entriesRef = collection(db, 'users', userId, 'entries');
  const snapshot = await getDocs(entriesRef);
  
  if (!snapshot.empty) {
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }

  // Delete root user doc
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
}

/**
 * Hard delete all journal entries for a user, while keeping the user account active.
 */
export async function deleteAllUserEntries(userId: string): Promise<void> {
  if (!userId) throw new Error('Unauthorized: User ID is required');
  const entriesRef = collection(db, 'users', userId, 'entries');
  const snapshot = await getDocs(entriesRef);
  
  if (!snapshot.empty) {
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
}


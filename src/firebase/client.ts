/**
 * Firebase Web SDK Initialization & Hardened Error Telemetry
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isPermissionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('permission-denied') ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('PERMISSION_DENIED')
  );
}

export class GoogleAuthActionError extends Error {
  readonly code: string;
  readonly unauthorizedHost?: string;

  constructor(message: string, code: string, unauthorizedHost?: string) {
    super(message);
    this.name = 'GoogleAuthActionError';
    this.code = code;
    this.unauthorizedHost = unauthorizedHost;
  }
}

export function formatGoogleAuthError(error: unknown): GoogleAuthActionError {
  if (error instanceof GoogleAuthActionError) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const rawMsg = error instanceof Error ? error.message : String(error);
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain' || rawMsg.includes('unauthorized-domain')) {
    return new GoogleAuthActionError(
      `Domain "${host || 'current domain'}" belum didaftarkan di Firebase Authentication Authorized Domains. Tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains.`,
      'auth/unauthorized-domain',
      host
    );
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return new GoogleAuthActionError(
      'Popup login Google ditutup sebelum selesai. Klik Sign In lagi untuk melanjutkan.',
      code
    );
  }
  if (code === 'auth/popup-blocked') {
    return new GoogleAuthActionError(
      'Popup login diblokir oleh browser. Izinkan popup atau tunggu pengalihan ke halaman Google.',
      code
    );
  }
  if (code === 'auth/network-request-failed') {
    return new GoogleAuthActionError(
      'Koneksi ke Google Auth gagal. Periksa koneksi internet atau nonaktifkan ad-blocker.',
      code
    );
  }
  return new GoogleAuthActionError(rawMsg || 'Google Sign-In failed.', code || 'auth/unknown');
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client is offline).');
      return false;
    }
    return true;
  }
}

void testFirestoreConnection();

// Complete any pending OAuth redirect login (e.g. mobile / Safari popup fallback on Vercel)
void getRedirectResult(auth).catch((error) => {
  console.warn('Google Sign-In redirect check:', formatGoogleAuthError(error).message);
});

export async function signInWithGoogleAccount(): Promise<User> {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    try {
      document.exitPointerLock();
    } catch {
      // ignore
    }
  }

  try {
    const res = await signInWithPopup(auth, googleProvider);
    return res.user;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        throw formatGoogleAuthError(redirectErr);
      }
      throw new GoogleAuthActionError(
        'Popup diblokir browser — mengalihkan ke halaman login Google...',
        'auth/redirecting'
      );
    }

    throw formatGoogleAuthError(error);
  }
}

export async function signOutGoogleAccount(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };

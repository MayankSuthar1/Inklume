import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();

export async function verifyIdToken(token: string) {
  return adminAuth.verifyIdToken(token);
}

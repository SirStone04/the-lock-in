import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  initializeAuth,
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const configured = !!(
  config.apiKey &&
  config.authDomain &&
  config.projectId &&
  config.appId
);
export const trustedDevice =
  localStorage.getItem("lock-in-trusted-device") === "yes";
const app = configured ? initializeApp(config) : null;
export const auth = app
  ? initializeAuth(app, {
      persistence: trustedDevice
        ? browserLocalPersistence
        : browserSessionPersistence,
    })
  : null;
export const db = app
  ? initializeFirestore(app, {
      localCache: trustedDevice
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    })
  : null;

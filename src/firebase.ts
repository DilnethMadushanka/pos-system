import { initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

const app = firebaseConfigured ? initializeApp(config) : null

// These are only touched after AccountGate has confirmed the config exists.
export const auth = (app ? getAuth(app) : null) as Auth
export const firestore = (
  app
    ? initializeFirestore(app, {
        // Reads and writes keep working offline and sync when the connection returns.
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true,
      })
    : null
) as Firestore

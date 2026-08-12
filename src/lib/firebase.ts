import { initializeApp, getApps, FirebaseOptions } from 'firebase/app'
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getDatabase, Database } from 'firebase/database'

// Log Firebase configuration (excluding sensitive data)
console.log('Firebase Config:', {
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY
});

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

// Validate required configuration
if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
  console.error('Firebase Database URL is not configured. Rate limiting will be disabled.');
} else {
  firebaseConfig.databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
}

// Initialize Firebase with retry logic
let app;
let retryCount = 0;
const MAX_RETRIES = 3;

const initializeFirebase = () => {
  try {
    if (getApps().length === 0) {
      console.log('Initializing Firebase app...');
      app = initializeApp(firebaseConfig);
    } else {
      console.log('Firebase app already initialized');
      app = getApps()[0];
    }
    return true;
  } catch (error) {
    console.error(`Firebase initialization attempt ${retryCount + 1} failed:`, error);
    return false;
  }
};

while (!app && retryCount < MAX_RETRIES) {
  if (initializeFirebase()) {
    break;
  }
  retryCount++;
}

if (!app) {
  console.error('Failed to initialize Firebase after multiple attempts');
  throw new Error('Firebase initialization failed');
}

// Initialize services with error handling and proper typing
let auth: Auth;
try {
  auth = getAuth(app);
  
  // Set persistent authentication to keep the user logged in
  if (typeof window !== 'undefined') {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Firebase Auth persistence set to LOCAL');
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
      });
  }
  
  console.log('Firebase Auth initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Auth:', error);
  throw error;
}

let db: Firestore;
try {
  db = getFirestore(app);
  console.log('Firestore initialized successfully');
} catch (error) {
  console.error('Error initializing Firestore:', error);
  throw error;
}

// Initialize Realtime Database with retry logic
let database: Database | undefined;
if (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
  retryCount = 0;
  while (!database && retryCount < MAX_RETRIES) {
    try {
      database = getDatabase(app);
      console.log('Realtime Database initialized successfully');
      break;
    } catch (error) {
      console.error(`Realtime Database initialization attempt ${retryCount + 1} failed:`, error);
      retryCount++;
    }
  }
  
  if (!database) {
    console.error('Failed to initialize Realtime Database after multiple attempts');
  }
}

export { app, auth, db, database }
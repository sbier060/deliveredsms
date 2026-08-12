import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Define a variable to hold the database instance
let dbInstance: admin.database.Database;
let authInstance: admin.auth.Auth;
let storageInstance: admin.storage.Storage;

// Safely process the private key
function getPrivateKey() {
  // Try the base64 encoded private key first
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
    } catch (e) {
      console.error('Failed to decode base64 private key:', e);
    }
  }
  
  // Try the direct private key with newline handling
  if (process.env.FIREBASE_PRIVATE_KEY) {
    // Handle potential escaping issues
    return process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  
  // If we have a full service account JSON in base64
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      return serviceAccount.private_key;
    } catch (e) {
      console.error('Failed to parse base64 service account:', e);
    }
  }
  
  return undefined;
}

// Use a singleton pattern better suited for serverless environments
const getFirebaseAdmin = () => {
  if (!admin.apps.length) {
    try {
      // Get private key using our safe method
      const privateKey = getPrivateKey();
      
      // Log the initialization attempt (without exposing the actual key)
      console.log('Firebase Admin SDK Initialization:', {
        projectId: process.env.FIREBASE_PROJECT_ID ? 'Present' : 'Missing',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'Present' : 'Missing',
        privateKey: privateKey ? 'Present' : 'Missing',
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'Missing'
      });

      // Check if required environment variables are defined
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
        throw new Error('Firebase Admin SDK configuration is missing or incomplete');
      }

      // Initialize the app
      const app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      });

      // Initialize database, auth, and storage instances
      dbInstance = admin.database(app);
      authInstance = admin.auth(app);
      storageInstance = getStorage(app);
      
      console.log('Firebase Admin SDK successfully initialized!');
    } catch (error) {
      console.error('Firebase Admin SDK initialization error:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        if (error.message.includes('DECODER')) {
          console.error('Private key format error. Check that your private key includes proper newlines.');
        } else if (error.message.includes('invalid argument')) {
          console.error('Invalid credential configuration. Check project ID, client email, and private key.');
        }
      }
      
      throw error;
    }
  } else {
    // If the app is already initialized, get the existing instances
    const app = admin.app();
    dbInstance = admin.database(app);
    authInstance = admin.auth(app);
    storageInstance = getStorage(app);
  }

  return { db: dbInstance, auth: authInstance, storage: storageInstance };
};

// Initialize the instances
const { db, auth, storage } = getFirebaseAdmin();

// Get the default bucket for session recordings
const getSessionBucket = () => storage.bucket();

// Export the instances
export { auth, db, storage, getSessionBucket };

// Export a function to test database connectivity (for diagnostic use only)
export async function testDatabaseConnection() {
  try {
    // Test read (this is much faster and less likely to have permission issues than write)
    const snapshot = await db.ref('.info/connected').once('value');
    return {
      success: true,
      connected: snapshot.val() === true
    };
  } catch (error) {
    console.error('Database connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
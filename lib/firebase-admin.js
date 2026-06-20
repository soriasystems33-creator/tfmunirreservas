import admin from 'firebase-admin';

// Firebase Admin SDK — TFM UNIR
// Las credenciales se leen desde variables de entorno (.env.local)
function getDb() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    return null;
  }

  if (!admin.apps.length) {
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

      if (privateKey) {
        privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, ' ').replace(/\n/g, ' ');

        let body = '';
        const match = privateKey.match(/-----BEGIN PRIVATE KEY-----\s*(.*?)\s*-----END PRIVATE KEY-----/);
        if (match) {
          body = match[1];
        } else {
          body = privateKey.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '');
        }

        body = body.replace(/\s+/g, '');
        privateKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    } catch (error) {
      console.error('Firebase admin initialization error:', error.message);
      return null;
    }
  }

  return admin.firestore();
}

export const db = getDb();

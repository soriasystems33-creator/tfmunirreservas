import admin from 'firebase-admin';

// Firebase Admin SDK — TFM UNIR
// Las credenciales se leen desde variables de entorno (.env.local / Vercel)
function getDb() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.warn('Firebase Admin: missing env vars FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL');
    return null;
  }

  if (!admin.apps.length) {
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

      if (privateKey) {
        // Quitar comillas externas si las hay (cuando se pega con comillas en Vercel)
        privateKey = privateKey.replace(/^\"|\"$/g, '');
        // Convertir \n literales a saltos de línea reales
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });

      console.log('Firebase Admin: initialized OK for project', process.env.FIREBASE_PROJECT_ID);
    } catch (error) {
      console.error('Firebase admin initialization error:', error.message);
      return null;
    }
  }

  return admin.firestore();
}

export const db = getDb();

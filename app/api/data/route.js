import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase no configurado' }, { status: 500 });
    }

    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;

    const [settingsSnap, servicesSnap, categoriesSnap, employeesSnap] = await Promise.all([
      db.doc(`${basePath}/settings/main`).get(),
      db.collection(`${basePath}/services`).get(),
      db.collection(`${basePath}/categories`).get(),
      db.collection(`${basePath}/employees`).get()
    ]);

    const settings = settingsSnap.exists ? settingsSnap.data() : { start: "09:00", end: "20:00", specialDays: {} };
    const services = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      success: true,
      settings,
      services,
      categories,
      employees
    });
  } catch (error) {
    console.error('Error fetching basic data:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

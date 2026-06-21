import { NextResponse } from 'next/server';
import { db, doc, getDoc, getDocs, collection } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;

    const [settingsSnap, servicesSnap, categoriesSnap, employeesSnap] = await Promise.all([
      getDoc(doc(db, `${basePath}/settings/main`)),
      getDocs(collection(db, `${basePath}/services`)),
      getDocs(collection(db, `${basePath}/categories`)),
      getDocs(collection(db, `${basePath}/employees`))
    ]);

    const settings = settingsSnap.exists() ? settingsSnap.data() : { start: "09:00", end: "20:00", specialDays: {} };
    const services = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const categories = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({
      success: true,
      settings,
      services,
      categories,
      employees
    });
  } catch (error) {
    console.error('Error fetching basic data:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ success: false, error: 'Missing date parameter' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase no configurado' }, { status: 500 });
    }

    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;

    const aptsSnap = await db.collection(`${basePath}/appointments`)
      .where('date', '==', date)
      .get();

    let appointments = aptsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        time: data.time,
        duration: data.duration,
        employee: data.employee,
        status: data.status,
        services: data.services
      };
    });

    appointments = appointments.filter(apt => apt.status !== 'cancelled');

    return NextResponse.json({ success: true, appointments });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

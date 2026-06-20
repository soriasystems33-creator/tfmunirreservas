import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Falta ID de cita' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase no configurado' }, { status: 500 });
    }

    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;

    const docRef = db.collection(`${basePath}/appointments`).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
    }

    const apt = { id: docSnap.id, ...docSnap.data() };
    const phone = apt.clientPhone;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Cita sin teléfono de cliente' }, { status: 400 });
    }

    const allSnap = await db.collection(`${basePath}/appointments`)
      .where('clientPhone', '==', phone)
      .get();

    let appointments = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    appointments.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    return NextResponse.json({ success: true, clientName: apt.clientName, appointments });
  } catch (error) {
    console.error('Error fetching my appointments:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

import { db } from '../../../lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase no configurado' }, { status: 500 });
    }

    const doc = await db.collection('artifacts/tfm-unir-default/public/data/appointments').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: doc.id,
      ...doc.data()
    });
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json({ error: 'Error al obtener la reserva' }, { status: 500 });
  }
}

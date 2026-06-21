import { db } from '../../../lib/firebase-admin';
import { doc, getDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const docRef = doc(db, `artifacts/tfm-unir-default/public/data/appointments/${id}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: docSnap.id,
      ...docSnap.data()
    });
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener la reserva' }, { status: 500 });
  }
}

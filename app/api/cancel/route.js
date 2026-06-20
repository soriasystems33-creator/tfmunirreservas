import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { notifyWebhook } from '@/lib/webhook';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID parameter' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase no configurado' }, { status: 500 });
    }

    const aid = "tfm-unir-default";
    const docRef = db.doc(`artifacts/${aid}/public/data/appointments/${id}`);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    const data = docSnap.data();

    return NextResponse.json({
      success: true,
      appointment: {
        id: docSnap.id,
        service: data.service,
        date: data.date,
        time: data.time,
        clientName: data.clientName,
        status: data.status
      }
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID parameter' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase no configurado' }, { status: 500 });
    }

    const aid = "tfm-unir-default";
    const docRef = db.doc(`artifacts/${aid}/public/data/appointments/${id}`);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    const data = docSnap.data();
    if (data.status === 'cancelled') {
      return NextResponse.json({ success: true, message: 'Already cancelled' });
    }

    await docRef.update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'client_link'
    });

    await notifyWebhook('cancellation', { id, ...data });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

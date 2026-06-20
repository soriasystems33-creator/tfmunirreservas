import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { notifyWebhook } from '@/lib/webhook';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { oldId, newDate, newTime } = body;

    if (!oldId || !newDate || !newTime) {
      return NextResponse.json({ success: false, error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: false, error: 'Firebase no configurado' }, { status: 500 });
    }

    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;

    const oldDocRef = db.collection(`${basePath}/appointments`).doc(oldId);
    const oldDoc = await oldDocRef.get();

    if (!oldDoc.exists) {
      return NextResponse.json({ success: false, error: 'Reserva original no encontrada' }, { status: 404 });
    }

    const oldData = oldDoc.data();

    if (oldData.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'La cita original ya está cancelada' }, { status: 400 });
    }

    // Resolver empleada genérica
    const emplSnap = await db.collection(`${basePath}/employees`).get();
    const realEmps = emplSnap.docs.map(d => d.data().name).filter(Boolean);
    const firstEmp = realEmps.length > 0 ? realEmps[0] : '';
    let employee = oldData.employee || '';
    if (!employee || employee === 'Todas' || employee === 'Cualquiera' || employee === 'Ambos') {
      employee = firstEmp;
    }

    // Collect unique employee names (handle comma-separated)
    const newEmpNames = [...new Set(employee.split(',').map(e => e.trim()).filter(Boolean).map(e => e.toLowerCase()))];
    const t2m = (t) => { const p = (t || '0:00').split(':').map(Number); return p[0] * 60 + p[1]; };

    function aEmpNames(a) {
      const names = new Set();
      if (a.employee) a.employee.split(',').forEach(n => { const t = n.trim().toLowerCase(); if (t) names.add(t); });
      if (a.services && Array.isArray(a.services)) a.services.forEach(s => { const t = (s.employee || '').trim().toLowerCase(); if (t) names.add(t); });
      return names;
    }

    // Validar solapamiento
    const existingSnap = await db.collection(`${basePath}/appointments`)
      .where('date', '==', newDate)
      .where('status', '==', 'confirmed')
      .get();
    const dur = oldData.duration || 15;
    const tStart = t2m(newTime);
    const tEnd = tStart + dur;
    for (const doc of existingSnap.docs) {
      if (doc.id === oldId) continue;
      const a = doc.data();
      if (!a) continue;
      const aNames = aEmpNames(a);
      if (aNames.size === 0) continue;
      const aS = t2m(a.time), aE = aS + (a.duration || 15);
      if (tStart >= aE || tEnd <= aS) continue;
      const clash = newEmpNames.some(en => aNames.has(en));
      if (clash) {
        return NextResponse.json({ success: false, error: `Ya existe una cita en ese horario para ${employee}. Por favor, elige otra hora.` }, { status: 409 });
      }
    }

    const newData = {
      clientName: oldData.clientName,
      clientPhone: oldData.clientPhone,
      clientEmail: oldData.clientEmail || '',
      notes: oldData.notes || '',
      services: oldData.services || [{ name: oldData.service, employee, duration: dur, price: oldData.price || 0 }],
      service: oldData.service,
      employee,
      duration: dur,
      price: oldData.price || 0,
      date: newDate,
      time: newTime,
      status: 'confirmed',
      isPaid: false,
      source: 'cliente',
      type: 'web',
      modifiedFrom: oldId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newDocRef = await db.collection(`${basePath}/appointments`).add(newData);

    await oldDocRef.update({
      status: 'cancelled',
      modifiedTo: newDocRef.id,
      updatedAt: new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'modification'
    });

    await notifyWebhook('modification', { id: newDocRef.id, oldId, newId: newDocRef.id, ...newData });

    return NextResponse.json({ success: true, newId: newDocRef.id });
  } catch (error) {
    console.error('Error modifying appointment:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

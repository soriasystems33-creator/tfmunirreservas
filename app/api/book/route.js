import { NextResponse } from 'next/server';
import { db, doc, getDoc, getDocs, addDoc, updateDoc, collection, query, where } from '@/lib/firebase-admin';
import { notifyWebhook } from '@/lib/webhook';

// Helper: minutos desde medianoche
const t2m = (t) => { const p = (t || '0:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };

// Extrae todos los nombres de empleada de una cita (campo employee o array services)
function empNamesInApt(a) {
  const names = new Set();
  if (a.employee) {
    a.employee.split(',').forEach(n => { const t = n.trim(); if (t) names.add(t.toLowerCase()); });
  }
  if (a.services && Array.isArray(a.services)) {
    a.services.forEach(s => { const t = (s.employee || '').trim(); if (t) names.add(t.toLowerCase()); });
  }
  return names;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { clientName, clientPhone, clientEmail, notes, date, time } = body;

    if (!clientName || !clientPhone || !date || !time) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Sanitizar teléfono: quitar +34, espacios, guiones, etc.
    const cleanPhone = (v) => v.replace(/^\+34/,'').replace(/[\s\-\(\)\.]/g,'').replace(/^34(?=\d{9})/,'');
    body.clientPhone = cleanPhone(body.clientPhone);

    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;

    let services = body.services;
    let service = body.service;
    let price = body.price || 0;

    // Normalizar services: si viene vacío, construir desde los campos simples
    if (!services || !Array.isArray(services) || services.length === 0) {
      if (!service) {
        return NextResponse.json({ success: false, error: 'Falta servicio' }, { status: 400 });
      }
      services = [{ name: service, employee: body.employee || '', duration: body.duration || 30, price }];
    }

    // Resolver empleada genérica → primera empleada real
    const emplSnap = await getDocs(collection(db, `${basePath}/employees`));
    const realEmps = emplSnap.docs.map(d => d.data().name).filter(Boolean);
    const firstEmp = realEmps.length > 0 ? realEmps[0] : '';

    services.forEach(s => {
      const flex = !s.employee || s.employee === 'Todas' || s.employee === 'Cualquiera' || s.employee === 'Ambos'
        || s.employee.toLowerCase() === 'automático' || s.employee.toLowerCase() === 'automatico';
      if (flex) s.employee = firstEmp;
    });

    // Calcular empleadas únicas involucradas
    const uniqueEmps = [...new Set(services.map(s => s.employee).filter(Boolean))];

    // employee: "Nombre1, Nombre2" (coma + espacio, formato canónico)
    const employee = uniqueEmps.join(', ');

    // duration: si hay varias empleadas simultáneas → máximo; si es la misma → suma
    let duration;
    if (uniqueEmps.length > 1) {
      const durByEmp = {};
      services.forEach(s => {
        const e = s.employee || '';
        durByEmp[e] = (durByEmp[e] || 0) + (s.duration || 0);
      });
      duration = Math.max(...Object.values(durByEmp));
    } else {
      duration = services.reduce((sum, s) => sum + (s.duration || 0), 0);
    }

    price = services.reduce((sum, s) => sum + (s.price || 0), 0);

    const tStart = t2m(time);
    const tEnd = tStart + duration;

    // Validar solapamiento por cada empleada implicada
    const existingSnap = await getDocs(
      query(collection(db, `${basePath}/appointments`), where('date', '==', date))
    );

    for (const docSnap of existingSnap.docs) {
      const a = docSnap.data();
      if (!a || a.status === 'cancelled') continue;

      const aEmpNames = empNamesInApt(a);
      const aS = t2m(a.time);
      const aE = aS + (a.duration || 15);

      if (tStart >= aE || tEnd <= aS) continue;

      const clash = uniqueEmps.some(en => aEmpNames.has(en.toLowerCase()));
      if (clash) {
        return NextResponse.json({
          success: false,
          error: `Ya existe una cita en ese horario para ${employee}. Por favor, elige otra hora.`
        }, { status: 409 });
      }
    }

    const data = {
      clientName,
      clientPhone: body.clientPhone,
      clientEmail: clientEmail || '',
      notes: notes || '',
      services,
      service: services.map(s => s.name).join(' + '),
      employee,
      date,
      time,
      duration,
      price,
      status: 'confirmed',
      isPaid: false,
      source: 'cliente',
      type: 'web',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, `${basePath}/appointments`), data);

    await notifyWebhook('new', { id: docRef.id, ...data });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('Error in booking API:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;
    const docRef = doc(db, `${basePath}/appointments/${id}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const data = docSnap.data();

    const now = new Date();
    const aptDateTime = new Date(`${data.date}T${data.time}:00`);
    const threeHoursInMs = 3 * 60 * 60 * 1000;

    if (aptDateTime.getTime() - now.getTime() < threeHoursInMs) {
      return NextResponse.json({
        error: 'Las cancelaciones online deben hacerse con al menos 3 horas de antelación. Por favor, llame al estudio.'
      }, { status: 400 });
    }

    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });

    await notifyWebhook('cancellation', { id, ...data });

    return NextResponse.json({ success: true, message: 'Reserva cancelada' });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    return NextResponse.json({ error: error.message || 'Error al cancelar la reserva' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db, getDocs, collection, query, where } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ success: false, error: 'Missing date parameter' }, { status: 400 });
    }

    const aid = "tfm-unir-default";
    const basePath = `artifacts/${aid}/public/data`;

    const aptsSnap = await getDocs(
      query(collection(db, `${basePath}/appointments`), where('date', '==', date))
    );

    let appointments = aptsSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        date: data.date,
        time: data.time,
        duration: data.duration,
        employee: data.employee,
        status: data.status,
        services: data.services
      };
    });

    appointments = appointments.filter(apt => apt.status !== 'cancelled');

    // Fetch blocks
    const blocksSnap = await getDocs(collection(db, `${basePath}/blocks`));
    const allBlocks = blocksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Filter blocks active on this date
    const reqDate = new Date(date + 'T12:00:00');
    const reqWeekday = reqDate.getDay();
    
    const blocks = allBlocks.filter(b => {
      if(b.recurrenceEnd && b.recurrenceEnd < date) return false;
      if(b.recurrence === 'none') return b.date === date;
      if(b.recurrence === 'daily') return true;
      if(b.recurrence === 'weekly') return b.weekday === reqWeekday;
      if(b.recurrence === 'biweekly') return b.weekday === reqWeekday; // Simpler check for biweekly for now
      return false;
    });

    return NextResponse.json({ success: true, appointments, blocks });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

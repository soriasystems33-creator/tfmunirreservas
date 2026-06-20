'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, Clock, User, Scissors, ChevronRight, XCircle, AlertCircle, CheckCircle, ExternalLink, CalendarX } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

function MisCitasContent() {
  const searchParams = useSearchParams();
  const phone = searchParams.get('c');

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!phone) { setLoading(false); return; }

    const aptsRef = collection(db, 'artifacts/tfm-unir-default/public/data/appointments');
    const q = query(aptsRef, where('clientPhone', '==', phone), orderBy('date', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setAppointments(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching appointments:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [phone]);

  const todayStr = new Date().toISOString().split('T')[0];

  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  const isPast = (apt) => {
    if (apt.date < todayStr) return true;
    if (apt.date === todayStr && apt.time <= timeStr) return true;
    return false;
  };

  const canCancel = (apt) => {
    if (apt.status !== 'confirmed') return false;
    if (apt.date < todayStr) return false;
    if (apt.date === todayStr) {
      const aptMin = parseInt(apt.time.split(':')[0]) * 60 + parseInt(apt.time.split(':')[1]);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return (aptMin - nowMin) >= 180;
    }
    return true;
  };

  const handleCancel = async (apt) => {
    if (!window.confirm(`¿Anular la cita del ${apt.date} a las ${apt.time}h?\n\nEsta acción no se puede deshacer.`)) return;

    setCancelling(apt.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/book?id=${apt.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: 'Cita cancelada correctamente.' });
      } else {
        setMsg({ type: 'error', text: data.error || 'No se pudo cancelar.' });
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Error de conexión.' });
    }
    setCancelling(null);
  };

  const upcomings = appointments.filter(a => a.status === 'confirmed' && !isPast(a));
  const history = appointments.filter(a => a.status !== 'confirmed' || isPast(a));

  if (!phone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--cream)'}}>
        <div className="card p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{background:'var(--green)'}}>
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold italic mb-2" style={{fontFamily:"'Cormorant Garamond',serif",color:'var(--brown)'}}>Enlace no válido</h2>
          <p className="text-sm font-medium mb-6" style={{color:'var(--brown-mid)'}}>Para acceder a tus citas, usa el enlace que recibiste por WhatsApp.</p>
          <a href="/" className="btn-primary inline-flex">Ir a reservar</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{background:'linear-gradient(160deg, #f5f0ec 0%, #edf3f7 50%, #f5eef0 100%)'}}>
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{background:'rgba(250,247,244,.95)', backdropFilter:'blur(20px)', borderColor:'var(--brown-light)'}}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'var(--green)'}}>
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold italic leading-none" style={{fontFamily:"'Cormorant Garamond',serif",color:'var(--brown)'}}>Clínica Estética UNIR</h1>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{color:'var(--green-deep)'}}>Mis Citas</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-2xl border text-sm font-semibold flex items-center gap-2 ${
            msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            {msg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="spinner mb-4" style={{borderColor:'var(--brown-light)', borderTopColor:'var(--green-deep)'}}></div>
            <p className="text-sm font-medium" style={{color:'var(--brown-mid)'}}>Buscando tus citas...</p>
          </div>
        )}

        {!loading && appointments.length === 0 && (
          <div className="card p-10 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{background:'var(--cream-dark)'}}>
              <CalendarX className="w-8 h-8" style={{color:'var(--brown-mid)'}} />
            </div>
            <h2 className="text-2xl font-semibold italic mb-2" style={{fontFamily:"'Cormorant Garamond',serif",color:'var(--brown)'}}>Sin citas encontradas</h2>
            <p className="text-sm font-medium mb-6" style={{color:'var(--brown-mid)'}}>No hay citas asociadas a este número de teléfono.</p>
            <a href="/" className="btn-primary inline-flex">Reservar una cita</a>
          </div>
        )}

        {!loading && upcomings.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold italic mb-4 flex items-center gap-2" style={{fontFamily:"'Cormorant Garamond',serif",color:'var(--brown)'}}>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
              Próximas Citas
            </h2>
            <div className="space-y-3">
              {upcomings.map(apt => (
                <div key={apt.id} className="card p-5 border-l-4" style={{borderLeftColor:'var(--green-deep)'}}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-sm" style={{color:'var(--brown)'}}>{apt.service || apt.services?.map(s => s.name).join(' + ')}</h3>
                      <p className="text-xs font-medium mt-0.5" style={{color:'var(--brown-mid)'}}>
                        {apt.employee && apt.employee !== 'Todas' && apt.employee !== 'Cualquiera' && <> con <strong>{apt.employee}</strong></>}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 shrink-0">Activa</span>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs" style={{color:'var(--brown-mid)'}}>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5" style={{color:'var(--green-deep)'}} />
                      {apt.date.split('-').reverse().join('/')}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" style={{color:'var(--green-deep)'}} />
                      {apt.time}h
                    </span>
                    {apt.price > 0 && (
                      <span className="flex items-center gap-1.5 font-bold" style={{color:'var(--green-deep)'}}>
                        {apt.price}€
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5" style={{color:'var(--green-deep)'}} />
                      {apt.duration} min
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <a href={`/modificar?id=${apt.id}`} className="flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all text-center"
                      style={{borderColor:'var(--green-deep)', color:'var(--green-deep)', background:'white'}}>
                      Modificar
                    </a>
                    <button
                      onClick={() => handleCancel(apt)}
                      disabled={cancelling === apt.id || !canCancel(apt)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-all text-center ${
                        canCancel(apt) ? 'border-red-200 text-red-500 hover:bg-red-50 cursor-pointer' : 'border-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                      title={!canCancel(apt) && apt.date === todayStr ? 'Deben faltar al menos 3 horas' : ''}
                    >
                      {cancelling === apt.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </div>
                  {!canCancel(apt) && apt.date === todayStr && apt.status === 'confirmed' && (
                    <p className="mt-2 text-[10px] font-medium text-center" style={{color:'var(--brown-light)'}}>
                      Solo puedes cancelar con 3h de antelación
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && history.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold italic mb-4 flex items-center gap-2" style={{fontFamily:"'Cormorant Garamond',serif",color:'var(--brown)'}}>
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:'var(--brown-light)'}}></span>
              Historial
            </h2>
            <div className="space-y-2">
              {history.map(apt => (
                <div key={apt.id} className="card p-4 opacity-80">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm" style={{color:'var(--brown)'}}>{apt.service || apt.services?.map(s => s.name).join(' + ')}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs" style={{color:'var(--brown-mid)'}}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {apt.date.split('-').reverse().join('/')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {apt.time}h
                        </span>
                        {apt.price > 0 && <span className="font-bold" style={{color:'var(--green-deep)'}}>{apt.price}€</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                      apt.status === 'cancelled' ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {apt.status === 'cancelled' ? 'Cancelada' : isPast(apt) ? 'Completada' : apt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && appointments.length > 0 && (
          <div className="mt-8 text-center">
            <a href="/" className="btn-primary inline-flex">
              <Calendar className="w-4 h-4" /> Reservar nueva cita
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

export default function MisCitasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{background:'var(--cream)'}}>
        <div className="spinner" style={{borderColor:'var(--brown-light)', borderTopColor:'var(--green-deep)'}}></div>
      </div>
    }>
      <MisCitasContent />
    </Suspense>
  );
}

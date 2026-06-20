'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, Phone } from 'lucide-react';
import Link from 'next/link';

function MisCitasContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [clientName, setClientName] = useState('');
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    if (!id) {
      setErrorMsg('Enlace incorrecto (falta ID de cita). Revisa tu correo.');
      setLoading(false);
      return;
    }

    fetch(`/api/my-appointments?id=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setClientName(data.clientName);
          setAppointments(data.appointments);
        } else {
          setErrorMsg(data.error || 'No se pudieron cargar tus citas.');
        }
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('Error de conexión. Inténtalo de nuevo.');
        setLoading(false);
      });
  }, [id]);

  const statusBadge = (apt) => {
    if (apt.status === 'cancelled') {
      return <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#c0464f]"><XCircle className="w-3.5 h-3.5" /> Cancelada</span>;
    }
    if (apt.isPaid) {
      return <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#5b8f7a]"><CheckCircle className="w-3.5 h-3.5" /> Pagada</span>;
    }
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#5b8f7a]"><CheckCircle className="w-3.5 h-3.5" /> Confirmada</span>;
  };

  const fmtDate = (d) => d?.split('-').reverse().join('/');

  return (
    <div className="flex flex-col items-center p-4 min-h-screen">
      <div className="max-w-lg w-full relative mt-10">
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-4xl font-semibold italic mb-1 text-[#2e2826] cursor-pointer" style={{fontFamily:"'Cormorant Garamond',serif"}}>Clínica Estética UNIR</h1>
          </Link>
        </div>

        <div className="card overflow-hidden bg-white rounded-[24px] shadow-[0_4px_24px_rgba(46,40,38,.07)] border border-[#e0d8d5]">
          {loading && (
            <div className="p-10 text-center">
              <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4 border-[#e0d8d5] border-t-[#5b8f7a]"></div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#7a6b67]">Cargando tus citas...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto bg-[#fdf0f1] text-[#c0464f]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[#c0464f]">{errorMsg}</p>
              <Link href="/" className="block text-xs font-bold underline text-[#5b8f7a]">Volver a inicio</Link>
            </div>
          )}

          {!loading && !errorMsg && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 bg-[#c8ddd6]">
                  <Calendar className="w-6 h-6 text-[#5b8f7a]" />
                </div>
                <h2 className="text-xl font-semibold italic text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>
                  Mis Citas
                </h2>
                <p className="text-xs font-medium uppercase tracking-widest text-[#7a6b67] mt-1">
                  {clientName ? `Bienvenida, ${clientName}` : 'Tus reservas'}
                </p>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[#7a6b67]">No tienes citas registradas.</p>
                  <Link href="/" className="mt-4 inline-block bg-[#5b8f7a] text-white hover:bg-[#4a7d6e] font-bold text-sm rounded-2xl px-8 py-3">Reservar ahora</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map(apt => (
                    <div key={apt.id} className={`rounded-2xl p-4 border ${apt.status === 'cancelled' ? 'bg-[#fdf0f1] border-[#f3c6cb]' : 'bg-[#faf7f4] border-[#e0d8d5]'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-sm text-[#2e2826]">{apt.service}</p>
                          {apt.employee && <p className="text-[11px] text-[#7a6b67] mt-0.5">con {apt.employee}</p>}
                        </div>
                        {statusBadge(apt)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#7a6b67] mt-2">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(apt.date)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {apt.time}h</span>
                      </div>
                      {apt.status !== 'cancelled' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-[#e0d8d5]">
                          <Link href={`/modificar?id=${apt.id}`} className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl border border-[#5b8f7a] text-[#5b8f7a] hover:bg-[#5b8f7a] hover:text-white transition-all">
                            Modificar
                          </Link>
                          <Link href={`/cancelar?id=${apt.id}`} className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl border border-[#c0464f] text-[#c0464f] hover:bg-[#c0464f] hover:text-white transition-all">
                            Cancelar
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 text-center">
                <Link href="/" className="inline-block bg-[#5b8f7a] text-white hover:bg-[#4a7d6e] font-bold text-sm rounded-2xl px-8 py-3 transition-all w-full text-center">
                  Nueva reserva
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-[10px] uppercase tracking-widest text-[#a8a29e]">
            <Phone className="inline w-3 h-3 mr-1" />
            ¿Problemas? Llámanos
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MisCitasPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 rounded-full animate-spin border-[#e0d8d5] border-t-[#5b8f7a]"></div>
      </div>
    }>
      <MisCitasContent />
    </Suspense>
  );
}

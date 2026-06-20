'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarX, Check, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function CancelContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [apt, setApt] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!id) {
      setStatus('error');
      setErrorMsg('Enlace de cancelación incorrecto (Falta ID de la cita).');
      setLoading(false);
      return;
    }

    fetch(`/api/cancel?id=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.appointment.status === 'cancelled') {
            setStatus('already_cancelled');
          } else {
            setApt(data.appointment);
            setStatus('confirm');
          }
        } else {
          setStatus('error');
          setErrorMsg(data.error || 'La cita no existe en el sistema.');
        }
        setLoading(false);
      })
      .catch(e => {
        setStatus('error');
        setErrorMsg('Error de conexión. Inténtalo de nuevo.');
        setLoading(false);
      });
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();

      if (data.success) {
        setStatus('success');
      } else {
        alert("Hubo un error al intentar cancelar. Por favor llama al centro.");
      }
    } catch (e) {
      alert("Hubo un error de conexión.");
    }
    setCancelling(false);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen">
      <div className="max-w-md w-full relative mt-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Clínica Estética UNIR</h1>
        </div>

        <div className="card overflow-hidden bg-white rounded-[24px] shadow-[0_4px_24px_rgba(46,40,38,.07)] border border-[#e0d8d5]">

          {status === 'loading' && (
            <div className="p-10 text-center">
              <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4 border-[#e0d8d5] border-t-[#5b8f7a]"></div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#7a6b67]">Conectando...</p>
            </div>
          )}

          {status === 'confirm' && apt && (
            <div className="p-8 animate-[fadeIn_0.3s_ease]">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#fdf0f1] text-[#c0464f]">
                  <CalendarX className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Gestionar Reserva</h2>
                <p className="text-xs font-medium uppercase tracking-widest text-[#7a6b67]">Vas a cancelar la cita de:</p>
              </div>

              <div className="rounded-2xl p-4 text-left space-y-2 mb-6 border bg-[#faf7f4] border-[#e0d8d5]">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Servicio</span>
                  <span className="font-bold text-right max-w-[60%] text-[#2e2826]">{apt.service}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Fecha y hora</span>
                  <span className="font-bold text-[#5b8f7a]">{apt.date?.split('-').reverse().join('/')} · {apt.time}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Cliente</span>
                  <span className="font-bold text-[#2e2826]">{apt.clientName}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border mb-6 text-[10px] text-center leading-relaxed bg-[#f0ebe6] border-[#e0d8d5] text-[#7a6b67]">
                <span className="font-bold">Aviso:</span> Al cancelar, este hueco quedará libre para otro cliente inmediatamente.
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full bg-[#fdf0f1] text-[#c0464f] border border-[#f3c6cb] hover:bg-[#f3c6cb] hover:text-[#a9313a] disabled:bg-[#e0d8d5] disabled:text-white disabled:border-none padding-14px-28px rounded-2xl font-bold text-sm cursor-pointer transition-all inline-flex items-center justify-center gap-2"
                  style={{padding:'14px 28px', borderRadius:'16px'}}
                >
                  {cancelling ? (
                    <><div className="w-4 h-4 border-2 border-t-white border-white/30 rounded-full animate-spin"></div> Cancelando...</>
                  ) : (
                    'Sí, anular cita'
                  )}
                </button>
                <Link href={`/modificar?id=${id}`} className="block text-center text-xs font-bold mt-4 underline transition-colors text-[#5b8f7a] hover:text-[#2e2826]">
                  Quiero cambiar la fecha/hora
                </Link>
                <Link href="/" className="block text-center text-xs font-bold mt-4 underline transition-colors text-[#7a6b67]">
                  No, mantener cita y volver
                </Link>
              </div>
            </div>
          )}

          {(status === 'success' || status === 'already_cancelled') && (
            <div className="p-10 text-center space-y-6 animate-[fadeIn_0.3s_ease]">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm bg-gradient-to-br from-[#8fbca8] to-[#5b8f7a]">
                <Check className="w-8 h-8 text-white" />
              </div>
              <div className="font-semibold text-2xl italic text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>
                {status === 'success' ? '¡Cita Anulada!' : 'Cita ya cancelada'}
              </div>
              <p className="text-sm font-medium text-[#7a6b67]">
                {status === 'success'
                  ? <><span className="block">Tu reserva ha sido cancelada correctamente.</span>Gracias por avisar.</>
                  : 'Esta cita ya constaba como cancelada en el sistema.'}
              </p>
              <Link href="/" className="mt-4 bg-[#5b8f7a] text-white hover:bg-[#4a7d6e] padding-14px-28px rounded-2xl font-bold text-sm cursor-pointer transition-all inline-flex items-center justify-center gap-2" style={{padding:'14px 28px', borderRadius:'16px', display: 'inline-flex', width: '100%'}}>
                Hacer una nueva reserva
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="p-10 text-center space-y-4 animate-[fadeIn_0.3s_ease]">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2 bg-[#fdf0f1] text-[#c0464f]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-[#c0464f]">
                <p>{errorMsg}</p>
              </div>
              <p className="text-xs font-medium mt-2 text-[#7a6b67]">Si crees que es un error, por favor llámanos.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 rounded-full animate-spin border-[#e0d8d5] border-t-[#5b8f7a]"></div>
      </div>
    }>
      <CancelContent />
    </Suspense>
  );
}

'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarSync, ChevronLeft, ChevronRight, Clock, Check, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function ModifyContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [apt, setApt] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [data, setData] = useState({ services: [], categories: [], employees: [], settings: null });
  const [calViewDate, setCalViewDate] = useState(new Date());
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const t2m = (t) => {
    if (!t) return 0;
    const p = t.split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  };

  const m2t = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  const getDCforEmp = useCallback((dateStr, empName) => {
    const ss = data.settings;
    const sd = ss?.specialDays || {};
    // 1) Override MANUAL de la empleada
    if (sd[dateStr] && sd[dateStr][empName] && !sd[dateStr][empName]._auto) return sd[dateStr][empName];
    
    // 2) Estado del día especial global (si está configurado, sobrescribe horarios semanales o generales)
    if (sd[dateStr]?.global) {
      if (sd[dateStr].global.type === 'closed') return { type: 'closed' };
      if (sd[dateStr].global.type === 'custom') {
        return {
          type: 'standard',
          start: sd[dateStr].global.start,
          end: sd[dateStr].global.end,
          closedHours: sd[dateStr].global.closedHours || []
        };
      }
    }
    
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    // 3) Horario semanal individual
    let hasWeekly = false, weeklyClosed = false, weeklyStart = null, weeklyEnd = null, weeklyType = null, weeklyStart2 = null, weeklyEnd2 = null;
    const key = 'weekly_' + empName;
    if (ss && ss[key] && ss[key][day]) {
      hasWeekly = true;
      const w = ss[key][day];
      if (w.closed) weeklyClosed = true;
      else {
        weeklyType = w.type || 'standard';
        weeklyStart = w.start; weeklyEnd = w.end;
        if (weeklyType === 'split') { weeklyStart2 = w.start2; weeklyEnd2 = w.end2; }
      }
    }
    // 4) Global "Cerrado" → cierra a TODOS
    if (globalClosed) return { type: 'closed' };
    // 5) Empleada con horario semanal → intersectar con global custom
    if (hasWeekly) {
      if (weeklyClosed) return { type: 'closed' };
      if (weeklyType === 'split') {
        const s1 = globalStart ? (t2m(weeklyStart) > t2m(globalStart) ? weeklyStart : globalStart) : weeklyStart;
        const e1 = globalEnd ? (t2m(weeklyEnd) < t2m(globalEnd) ? weeklyEnd : globalEnd) : weeklyEnd;
        return { type: 'split', start: s1, end: e1, start2: weeklyStart2, end2: weeklyEnd2 };
      }
      const start = globalStart ? (t2m(weeklyStart) > t2m(globalStart) ? weeklyStart : globalStart) : weeklyStart;
      const end = globalEnd ? (t2m(weeklyEnd) < t2m(globalEnd) ? weeklyEnd : globalEnd) : weeklyEnd;
      return { type: 'standard', start, end };
    }
    // 6) Global custom (empleada sin weekly)
    if (globalStart) return { type: 'standard', start: globalStart, end: globalEnd };
    // 7) Horario semanal global
    if (ss?.weekly) {
      const w2 = ss.weekly[day];
      if (w2) {
        if (w2.closed) return { type: 'closed' };
        if (w2.type === 'split') return { type: 'split', start: w2.start, end: w2.end, start2: w2.start2, end2: w2.end2 };
        return { type: 'standard', start: w2.start, end: w2.end };
      }
    }
    // 8) Por defecto
    return { type: 'standard', start: ss?.start || "09:00", end: ss?.end || "20:00" };
  }, [data.settings]);

  const isDayClosed = useCallback((dateStr) => {
    if (data.employees.length === 0) {
      const sd = data.settings?.specialDays || {};
      if (sd[dateStr] && sd[dateStr].global) return sd[dateStr].global.type === 'closed';
      if (data.settings?.weekly) {
        const d = new Date(dateStr + 'T12:00:00');
        const w = data.settings.weekly[d.getDay()];
        if (w && w.closed) return true;
      }
      return false;
    }
    return data.employees.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
  }, [data.employees, data.settings, getDCforEmp]);

  useEffect(() => {
    if (!id) {
      setStatus('error');
      setErrorMsg('Enlace de modificación incorrecto (Falta ID de la cita).');
      setLoading(false);
      return;
    }

    Promise.all([
      fetch('/api/data').then(r => r.json()),
      fetch(`/api/reserva?id=${id}`).then(r => r.json())
    ]).then(([dataRes, aptRes]) => {
      if (dataRes.success) {
        setData({ services: dataRes.services, categories: dataRes.categories, employees: dataRes.employees, settings: dataRes.settings });
      }
      if (aptRes.success) {
        if (aptRes.status === 'cancelled') {
          setStatus('cancelled');
        } else {
          setApt(aptRes);
          setStatus('ready');
        }
      } else {
        setStatus('error');
        setErrorMsg('Reserva no encontrada en el sistema.');
      }
      setLoading(false);
    }).catch(e => {
      setStatus('error');
      setErrorMsg('Error de conexión. Inténtalo de nuevo.');
      setLoading(false);
    });
  }, [id]);

  const fetchSlotsForDate = async (ds) => {
    if (!apt) return;
    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelTime(null);
    try {
      const res = await fetch(`/api/availability?date=${ds}`);
      const rdata = await res.json();
      if (rdata.success) {
        calculateSlots(ds, rdata.appointments || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingSlots(false);
  };

  const calculateSlots = (ds, dayApts) => {
    if (!apt) return;
    const dur = apt.duration || 15;
    const empRestriction = apt.employee || 'Todas';
    let candidates = [...data.employees];
    if (empRestriction !== 'Todas' && empRestriction !== 'Ambos' && empRestriction !== 'Cualquiera') {
      const allowed = empRestriction.split(',').map(v => v.trim());
      candidates = candidates.filter(e => allowed.includes(e.name));
    }
    const getDCRange = (dc) => {
      if (dc.type === 'closed') return { s: t2m('09:00'), e: t2m('20:00') };
      if (dc.type === 'split') return { s: t2m(dc.start), e: t2m(dc.end2) };
      return { s: t2m(dc.start || data.settings?.start || '09:00'), e: t2m(dc.end || data.settings?.end || '20:00') };
    };
    const isTimeInDC = (dc, startMin, dur) => {
      const endMin = startMin + dur;
      if (dc.type === 'closed') return false;
      if (dc.type === 'split') {
        const m1s = t2m(dc.start), m1e = t2m(dc.end);
        const m2s = t2m(dc.start2), m2e = t2m(dc.end2);
        return (startMin >= m1s && endMin <= m1e) || (startMin >= m2s && endMin <= m2e);
      }
      const s = t2m(dc.start || data.settings?.start || '09:00');
      const e = t2m(dc.end || data.settings?.end || '20:00');
      return startMin >= s && endMin <= e;
    };
    let rangeStart = null, rangeEnd = null;
    if (candidates.length > 0) {
      candidates.forEach(emp => {
        const dc = getDCforEmp(ds, emp.name);
        if (dc.type !== 'closed') {
          const r = getDCRange(dc);
          if (rangeStart === null || r.s < rangeStart) rangeStart = r.s;
          if (rangeEnd === null || r.e > rangeEnd) rangeEnd = r.e;
        }
      });
    }
    if (rangeStart === null) {
      const d = new Date(ds + 'T12:00:00');
      const gday = d.getDay();
      if (data.settings?.weekly && data.settings.weekly[gday] && !data.settings.weekly[gday].closed) {
        const gw = data.settings.weekly[gday];
        rangeStart = t2m(gw.start || "09:00");
        rangeEnd = gw.type === 'split' ? t2m(gw.end2 || "20:00") : t2m(gw.end || "20:00");
      } else {
        rangeStart = t2m(data.settings?.start || "09:00");
        rangeEnd = t2m(data.settings?.end || "20:00");
      }
    }
    if (rangeStart === null || rangeStart >= rangeEnd) {
      setAvailableSlots([]);
      return;
    }
    const now = new Date();
    const todayStr = getLocalDateStr(now);
    const nowMin = ds === todayStr ? now.getHours() * 60 + now.getMinutes() + 15 : 0;
    const slots = [];
    for (let t = rangeStart; t + dur <= rangeEnd; t += 15) {
      if (ds === todayStr && t <= nowMin) continue;
      let slotFree = false;
      if (candidates.length === 0) {
        slotFree = true;
      } else {
        for (const emp of candidates) {
          const dc = getDCforEmp(ds, emp.name);
          if (dc.type === 'closed') continue;
          if (!isTimeInDC(dc, t, dur)) continue;
          const empApts = dayApts.filter(a => {
            if (a.id === id) return false;
            if (a.status === 'cancelled') return false;
            const aEmp = a.employee || '';
            return aEmp === emp.name || aEmp === 'Todas' || aEmp === 'Cualquiera' || aEmp === 'Ambos';
          });
          const busy = empApts.some(a => {
            const aStart = t2m(a.time);
            const aEnd = aStart + (a.duration || 15);
            return t < aEnd && (t + dur) > aStart;
          });
          if (!busy) { slotFree = true; break; }
        }
      }
      slots.push({ time: m2t(t), free: slotFree });
    }
    setAvailableSlots(slots);
  };

  const selectDate = (ds) => {
    setSelDate(ds);
    fetchSlotsForDate(ds);
  };

  const handleSubmit = async () => {
    if (!selDate || !selTime) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldId: id,
          newDate: selDate,
          newTime: selTime
        })
      });
      const resData = await res.json();
      if (resData.success) {
        setStatus('success');
      } else {
        alert('Error: ' + (resData.error || 'No se pudo modificar la cita.'));
      }
    } catch (e) {
      alert('Error de conexión.');
    }
    setSubmitting(false);
  };

  const y = calViewDate.getFullYear();
  const mo = calViewDate.getMonth();
  const firstDay = new Date(y, mo, 1);
  const off = (firstDay.getDay() + 6) % 7;
  const dim = new Date(y, mo + 1, 0).getDate();
  const todayStr = getLocalDateStr(new Date());
  const maxDateObj = new Date();
  maxDateObj.setMonth(new Date().getMonth() + 2);
  const maxDateStr = getLocalDateStr(maxDateObj);
  const isNextMonthDisabled = y > maxDateObj.getFullYear() || (y === maxDateObj.getFullYear() && mo >= maxDateObj.getMonth());
  const msNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dayNames = ['L','M','X','J','V','S','D'];

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen" style={{background:'var(--cream)'}}>
      <div className="max-w-md w-full relative mt-6">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Clínica Estética UNIR</h1>
        </div>

        <div className="card overflow-hidden bg-white rounded-[24px] shadow-[0_4px_24px_rgba(46,40,38,.07)] border border-[#e0d8d5]">

          {status === 'loading' && (
            <div className="p-10 text-center">
              <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4 border-[#e0d8d5] border-t-[#5b8f7a]"></div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#7a6b67]">Buscando tu cita...</p>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto bg-[#fdf0f1] text-[#c0464f]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="font-bold text-[#c0464f]">Esta cita ya fue cancelada y no puede modificarse.</p>
              <Link href="/" className="block mt-4 bg-[#5b8f7a] text-white px-6 py-3 rounded-2xl font-bold text-sm text-center">Hacer una nueva reserva</Link>
            </div>
          )}

          {status === 'error' && (
            <div className="p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto bg-[#fdf0f1] text-[#c0464f]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="font-bold text-[#c0464f]">{errorMsg}</p>
            </div>
          )}

          {status === 'ready' && apt && (
            <div className="p-6">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{background:'var(--green)'}}>
                  <CalendarSync className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Modificar Cita</h2>
                <p className="text-xs font-medium text-[#7a6b67]">Elige una nueva fecha y hora</p>
              </div>

              <div className="rounded-2xl p-4 text-left space-y-2 mb-5 border bg-[#faf7f4] border-[#e0d8d5]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#5b8f7a] mb-2">Cita actual</p>
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

              <div className="mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-[#2e2826]">Nueva fecha</h3>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setCalViewDate(new Date(y, mo - 1, 1))} className="p-2 rounded-xl border bg-white border-[#e0d8d5] hover:bg-slate-50">
                    <ChevronLeft className="w-4 h-4 text-[#7a6b67]" />
                  </button>
                  <span className="font-bold text-sm capitalize text-[#2e2826]">{msNames[mo]} {y}</span>
                  <button disabled={isNextMonthDisabled} onClick={() => setCalViewDate(new Date(y, mo + 1, 1))} className={`p-2 rounded-xl border ${isNextMonthDisabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'} border-[#e0d8d5]`}>
                    <ChevronRight className="w-4 h-4 text-[#7a6b67]" />
                  </button>
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase mb-2 text-[#7a6b67]">
                  {dayNames.map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {Array.from({ length: off }).map((_, i) => <div key={`e-${i}`}></div>)}
                  {Array.from({ length: dim }).map((_, i) => {
                    const day = i + 1;
                    const ds = `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isPast = ds < todayStr;
                    const isTooFar = ds > maxDateStr;
                    const closed = !isPast && isDayClosed(ds);
                    const isSel = selDate === ds;
                    const isToday = ds === todayStr;
                    const disabled = isPast || isTooFar || closed;
                    let cls = 'day-btn';
                    if (isPast || isTooFar) cls += ' day-past';
                    else if (closed) cls += ' day-closed';
                    else if (isSel) cls += ' day-selected';
                    else if (isToday) cls += ' day-today';
                    return (
                      <button key={day} disabled={disabled} onClick={() => selectDate(ds)} className={cls}>
                        {day}
                      </button>
                    );
                  })}
                </div>

                {selDate && (
                  <div className="mt-3 pt-3 border-t border-[#e0d8d5]">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-[#5b8f7a]" />
                      <h3 className="font-bold text-sm uppercase text-[#2e2826]">Nueva hora</h3>
                      <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-lg bg-[#c8ddd6] text-[#5b8f7a]">
                        {selDate.split('-').reverse().join('/')}
                      </span>
                    </div>
                    {loadingSlots ? (
                      <div className="flex justify-center py-4"><div className="spinner !border-[#e0d8d5] !border-t-[#5b8f7a]"></div></div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {availableSlots.length === 0 ? (
                          <p className="col-span-full text-center py-4 text-slate-400 font-medium text-sm">Sin horas disponibles este día</p>
                        ) : (
                          availableSlots.map(slot => (
                            <button key={slot.time} disabled={!slot.free}
                              onClick={() => setSelTime(slot.time)}
                              className={`time-slot ${slot.free ? (selTime === slot.time ? 'selected' : '') : 'occupied'}`}>
                              {slot.time}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3">
                <button onClick={handleSubmit} disabled={!selDate || !selTime || submitting}
                  className="w-full py-4 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{background: 'var(--green-deep)'}}>
                  {submitting ? <div className="spinner !border-white/30 !border-t-white"></div> : <CalendarSync className="w-5 h-5" />}
                  {submitting ? 'Modificando...' : 'Confirmar cambio de fecha'}
                </button>
                <Link href={`/cancelar?id=${id}`} className="block text-center text-xs font-bold underline text-[#7a6b67] hover:text-[#c0464f] transition-colors">
                  Prefiero cancelar la cita
                </Link>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="p-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm" style={{background:'linear-gradient(135deg,var(--green),var(--green-deep))'}}>
                <Check className="w-8 h-8 text-white" />
              </div>
              <div className="font-semibold text-2xl italic text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>
                ¡Cita modificada!
              </div>
              <p className="text-sm font-medium text-[#7a6b67]">Recibirás un correo de confirmación con los nuevos detalles.</p>
              <Link href="/" className="block mt-4 bg-[#5b8f7a] text-white px-6 py-3 rounded-2xl font-bold text-sm text-center">
                Volver al inicio
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ModifyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" style={{background:'var(--cream)'}}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin border-[#e0d8d5] border-t-[#5b8f7a]"></div>
      </div>
    }>
      <ModifyContent />
    </Suspense>
  );
}

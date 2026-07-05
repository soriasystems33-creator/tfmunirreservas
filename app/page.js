'use client';
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, ClipboardCheck, ArrowLeft, ArrowRight, Check, PlusCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#faf7f4]"><div className="spinner border-[#e0d8d5] border-t-[#5b8f7a]"></div></div>}>
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const FLEX_VALS = ['Todas', 'Ambos', 'Cualquiera'];
  const isFlex = (e) => !e || FLEX_VALS.includes(e);

  const getTotalDur = function(svcs) {
    if (!svcs || svcs.length === 0) return 0;
    var allFlexDur = svcs.every(function(s){ return isFlex(s.employee); });
    // Todos flexibles → intentaremos simultáneo → usar máximo
    if (allFlexDur) return Math.max(...svcs.map(function(s){ return s.duration || 0; }));
    // Empleadas específicas implicadas
    var specEmps = [...new Set(svcs.filter(s => !isFlex(s.employee)).map(s => s.employee))];
    // Solo 1 empleada específica (o mezcla específica+flexible) → secuencial → suma
    if (specEmps.length <= 1) return svcs.reduce(function(sum,s){ return sum + (s.duration || 0); }, 0);
    // Varias empleadas específicas distintas → simultáneo → máximo
    return Math.max(...svcs.map(function(s){ return s.duration || 0; }));
  };
  const [data, setData] = useState({ services: [], categories: [], employees: [], settings: null });
  const settingsRef = useRef(data.settings);
  const employeesRef = useRef(data.employees);
  const [loading, setLoading] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  
  const [step, setStep] = useState(0); // 0 = intro, 1 = service, 2 = datetime, 3 = info, 4 = success
  const [activeCat, setActiveCat] = useState('all');
  
  const [selServices, setSelServices] = useState([]);
  const [showSvcConfirm, setShowSvcConfirm] = useState(false);
  const [calViewDate, setCalViewDate] = useState(new Date());
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);
  
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableEmpsForSelSlot, setAvailableEmpsForSelSlot] = useState([]);
  const [slotAssign, setSlotAssign] = useState(null);
  
  const [formName, setFormName] = useState('');
  const cleanPhone = (v) => v.replace(/^\+34/,'').replace(/[\s\-\(\)\.]/g,'').replace(/^34(?=\d{9})/,'');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formEmp, setFormEmp] = useState('Cualquiera');
  const [formGdpr, setFormGdpr] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Estados para modo edición/cancelación
  const searchParams = useSearchParams();
  const [editId, setEditId] = useState(null);
  const [isCancelMode, setIsCancelMode] = useState(false);
  const [existingReserva, setExistingReserva] = useState(null);
  const [bookingResult, setBookingResult] = useState(null); // { success: string, error: string }

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData({
            services: res.services,
            categories: res.categories,
            employees: res.employees,
            settings: res.settings
          });
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });

    // Detectar modo edición/cancelación
    const id = searchParams.get('id');
    const cancel = searchParams.get('cancel');
    if (id) {
      setEditId(id);
      if (cancel === '1') setIsCancelMode(true);
      
      // Cargar datos de la reserva
      fetch(`/api/reserva?id=${id}`)
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            setExistingReserva(res);
            // Si no es cancelación, podríamos pre-cargar el formulario aquí para edición
          }
        });
    }
  }, [searchParams]);

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
  
  const m2t = (m) => {
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };

  const getDCforEmp = useCallback((dateStr, empName) => {
    const ss = settingsRef.current;
    const sd = ss?.specialDays || {};
    // 1) Override MANUAL de la empleada para una fecha específica (por ID o por Nombre)
    const emp = (employeesRef.current || []).find(e => e.name.toLowerCase() === empName.toLowerCase());
    const empId = emp ? emp.id : null;
    const empOverride = (sd[dateStr] && empId && sd[dateStr][empId]) || (sd[dateStr] && sd[dateStr][empName]);
    if (empOverride && !empOverride._auto) return empOverride;
    
    // 2) Estado del día especial global (si existe, prioriza frente a horarios semanales o generales)
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
    
    let globalClosed = false, globalStart = null, globalEnd = null;
    if (sd[dateStr]?.global) {
      if (sd[dateStr].global.type === 'closed') globalClosed = true;
      else if (sd[dateStr].global.type === 'custom') { globalStart = sd[dateStr].global.start; globalEnd = sd[dateStr].global.end; }
    }
    
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    // 2.5) Si el día de la semana está cerrado globalmente en el horario semanal general, se cierra para todos
    if (ss?.weekly && ss.weekly[day] && ss.weekly[day].closed) {
      return { type: 'closed' };
    }
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
    // 5) Empleada con horario semanal → intersectar con global custom / global weekly
    if (hasWeekly) {
      if (weeklyClosed) return { type: 'closed' };
      const gWeekly = ss?.weekly?.[day];
      if (weeklyType === 'split') {
        let s1 = weeklyStart, e1 = weeklyEnd, s2 = weeklyStart2, e2 = weeklyEnd2;
        if (globalStart) {
          s1 = globalStart ? (t2m(weeklyStart) > t2m(globalStart) ? weeklyStart : globalStart) : weeklyStart;
          e1 = globalEnd ? (t2m(weeklyEnd) < t2m(globalEnd) ? weeklyEnd : globalEnd) : weeklyEnd;
          s2 = globalStart ? (t2m(weeklyStart2) > t2m(globalStart) ? weeklyStart2 : globalStart) : weeklyStart2;
          e2 = globalEnd ? (t2m(weeklyEnd2) < t2m(globalEnd) ? weeklyEnd2 : globalEnd) : weeklyEnd2;
        } else if (gWeekly && gWeekly.type === 'split') {
          s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
          e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
          s2 = t2m(weeklyStart2) > t2m(gWeekly.start2) ? weeklyStart2 : gWeekly.start2;
          e2 = t2m(weeklyEnd2) < t2m(gWeekly.end2) ? weeklyEnd2 : gWeekly.end2;
        }
        return { type: 'split', start: s1, end: e1, start2: s2, end2: e2 };
      }
      if (gWeekly && gWeekly.type === 'split' && !globalStart) {
        const s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
        const e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
        const s2 = t2m(weeklyStart) > t2m(gWeekly.start2) ? weeklyStart : gWeekly.start2;
        const e2 = t2m(weeklyEnd) < t2m(gWeekly.end2) ? weeklyEnd : gWeekly.end2;
        if (t2m(s2) < t2m(e2)) {
          return { type: 'split', start: s1, end: e1, start2: s2, end2: e2 };
        } else {
          return { type: 'standard', start: s1, end: e1 };
        }
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
  }, []);

  // Helper: ¿cabe el slot (startMin, dur) dentro del horario dc? Soporta split.
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

  // Helper: extremos del día (inicio más temprano, fin más tardío)
  const getDCRange = (dc) => {
    if (dc.type === 'closed') return { s: t2m('09:00'), e: t2m('20:00') };
    if (dc.type === 'split') {
      const e = dc.end2 ? dc.end2 : dc.end; // Fallback to end if end2 is somehow missing
      return { s: t2m(dc.start), e: t2m(e) };
    }
    return { s: t2m(dc.start || data.settings?.start || '09:00'), e: t2m(dc.end || data.settings?.end || '20:00') };
  };

  const isDayClosed = useCallback((dateStr) => {
    const ee = employeesRef.current || [];
    const ss = settingsRef.current;
    if (ee.length === 0) {
      const sd = ss?.specialDays || {};
      if (sd[dateStr] && sd[dateStr].global) return sd[dateStr].global.type === 'closed';
      if (ss?.weekly) {
        const d = new Date(dateStr + 'T12:00:00');
        const w = ss.weekly[d.getDay()];
        if (w && w.closed) return true;
      }
      return false;
    }
    return ee.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
  }, [getDCforEmp]);

  const fetchSlotsForDate = async (ds, overrideServices) => {
    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelTime(null);
    try {
      const [aptRes, dataRes] = await Promise.all([
        fetch(`/api/availability?date=${ds}`),
        fetch('/api/data')
      ]);
      const rdata = await aptRes.json();
      const freshData = await dataRes.json();
      let freshSettings = data.settings;
      let freshEmployees = data.employees;
      if (freshData.success) {
        freshSettings = freshData.settings;
        freshEmployees = freshData.employees;
        settingsRef.current = freshSettings;
        employeesRef.current = freshEmployees;
        setData({
          services: freshData.services,
          categories: freshData.categories,
          employees: freshData.employees,
          settings: freshData.settings
        });
      }
      if (rdata.success) {
        calculateSlots(ds, rdata.appointments || [], freshSettings, freshEmployees, overrideServices, rdata.blocks || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingSlots(false);
  };

  const calculateSlots = (ds, dayApts, freshSettings, freshEmployees, overrideServices, blocks = []) => {
    const settings = freshSettings || data.settings;
    const employees = freshEmployees || data.employees;
    // Use overrideServices to bypass React stale closure when specialist dropdown changes
    const activeServices = overrideServices || selServices;
    if (activeServices.length === 0) {
      setAvailableSlots([]);
      setSelTime(null);
      return;
    }
    
    // Build map: employee → total duration needed
    const empDurs = {};
    const hasFlexible = activeServices.some(s => !s.employee || s.employee === 'Todas' || s.employee === 'Ambos' || s.employee === 'Cualquiera');
    activeServices.forEach(s => {
      const e = s.employee || '';
      if (!e || e === 'Todas' || e === 'Ambos' || e === 'Cualquiera') return;
      if (!empDurs[e]) empDurs[e] = 0;
      empDurs[e] += (s.duration || 0);
    });
    
    const uniqueEmps = Object.keys(empDurs);
    const isMultiEmp = uniqueEmps.length > 1;
    
    // Determine effective duration for the loop
    const effDur = isMultiEmp ? Math.max(...uniqueEmps.map(e => empDurs[e]), ...activeServices.filter(s => !s.employee || s.employee === 'Todas' || s.employee === 'Ambos' || s.employee === 'Cualquiera').map(s => s.duration || 0)) : getTotalDur(activeServices);
    
    // Determine range from all involved employees
    let rangeStart = null, rangeEnd = null;
    const checkEmps = isMultiEmp ? uniqueEmps : employees.map(e => e.name);
    checkEmps.forEach(empName => {
      const names = empName.includes(',') ? empName.split(',').map(n => n.trim()) : [empName];
      names.forEach(n => {
        const dc = getDCforEmp(ds, n);
        if (dc.type !== 'closed') {
          const r = getDCRange(dc);
          if (rangeStart === null || r.s < rangeStart) rangeStart = r.s;
          if (rangeEnd === null || r.e > rangeEnd) rangeEnd = r.e;
        }
      });
    });
    if (rangeStart === null) {
      const d2 = new Date(ds + 'T12:00:00');
      const gday = d2.getDay();
      if (settings?.weekly && settings.weekly[gday] && !settings.weekly[gday].closed) {
        const gw = settings.weekly[gday];
        rangeStart = t2m(gw.start || "09:00");
        rangeEnd = gw.type === 'split' ? t2m(gw.end2 || "20:00") : t2m(gw.end || "20:00");
      } else {
        rangeStart = t2m(settings?.start || "09:00");
        rangeEnd = t2m(settings?.end || "20:00");
      }
    }
    if (rangeStart === null || rangeStart >= rangeEnd) { setAvailableSlots([]); return; }
    
    const now = new Date();
    const todayStr = getLocalDateStr(now);
    const nowMin = ds === todayStr ? now.getHours() * 60 + now.getMinutes() + 15 : 0;
    const closedHours = settings?.specialDays?.[ds]?.closedHours || [];
    
    const isSlotClosedForEmp = (slotStart, slotEnd, empName, dc) => {
      // 1) Verificar closedHours globales/emp que vienen del Firestore general (objetos {from, to, entity})
      const hasDbClosed = closedHours.some(ch => {
        const chFrom = t2m(ch.from), chTo = t2m(ch.to);
        if (slotStart < chTo && slotEnd > chFrom) {
          if (ch.entity === 'global' || ch.entity === empName) return true;
        }
        return false;
      });
      if (hasDbClosed) return true;

      // 2) Verificar closedHours de jornada partida en masa que vienen en la propiedad dc.closedHours (array de strings)
      if (dc && dc.closedHours && Array.isArray(dc.closedHours)) {
        const hasCustomClosed = dc.closedHours.some(timeStr => {
          const chMin = t2m(timeStr);
          // Si el slot se solapa con el bloque de 15 min [chMin, chMin + 15]
          return slotStart < (chMin + 15) && slotEnd > chMin;
        });
        if (hasCustomClosed) return true;
      }

      return false;
    };

    const GENERIC_EMPS = ['automático', 'automatico', 'todas', 'cualquiera', 'ambos'];

    const isEmpBusy = (empName, start, end) => {
      const empL = (empName || '').toLowerCase().trim();
      
      // 1. Check appointments
      const hasApt = dayApts.some(a => {
        if (a.status === 'cancelled') return false;
        const aEmp = (a.employee || '').toLowerCase().trim();
        
        let blocksEmp = false;
        if (GENERIC_EMPS.includes(aEmp)) blocksEmp = true;
        else if (aEmp === empL || aEmp.split(',').map(e => e.trim()).includes(empL)) blocksEmp = true;
        if (!blocksEmp && a.services && a.services.some(s => {
          const sE = (s.employee || '').toLowerCase().trim();
          return sE === empL || GENERIC_EMPS.includes(sE);
        })) blocksEmp = true;
        
        if (!blocksEmp) return false;
        const aS = t2m(a.time), aE = aS + (a.duration || 15);
        return start < aE && end > aS;
      });
      if(hasApt) return true;

      // 2. Check blocks
      const hasBlock = blocks.some(b => {
        if(b.employee !== empName) return false;
        const bS = t2m(b.startTime);
        const bE = t2m(b.endTime);
        return start < bE && end > bS;
      });
      if(hasBlock) return true;

      return false;
    };

    
    const slots = [];
    if (isMultiEmp) {
      // Multi-employee: ALL employees must be free simultaneously for their individual durations
      for (let t = rangeStart; t + effDur <= rangeEnd; t += 15) {
        if (ds === todayStr && t <= nowMin) continue;
        let allFree = true, empsList = [];
        for (const empName of uniqueEmps) {
          const dc = getDCforEmp(ds, empName);
          if (dc.type === 'closed') { allFree = false; break; }
          const eDur = empDurs[empName];
          // Comprueba que el slot cabe en el horario (soporta split)
          if (!isTimeInDC(dc, t, eDur)) { allFree = false; break; }
          if (isSlotClosedForEmp(t, t + eDur, empName, dc)) { allFree = false; break; }
          if (isEmpBusy(empName, t, t + eDur)) { allFree = false; break; }
          const emp = employees.find(e => e.name === empName);
          if (emp) empsList.push(emp);
        }
        // Also check flexible services (no specific employee)
        if (allFree) {
          const flexSvcs = activeServices.filter(s => !s.employee || s.employee === 'Todas' || s.employee === 'Ambos' || s.employee === 'Cualquiera');
          if (flexSvcs.length > 0) {
            const flexDur = flexSvcs.reduce((sum, s) => sum + (s.duration || 0), 0);
            const anyFlexFree = employees.some(emp => {
              if (uniqueEmps.includes(emp.name)) return false;
              const dc = getDCforEmp(ds, emp.name);
              if (dc.type === 'closed') return false;
              if (!isTimeInDC(dc, t, flexDur)) return false;
              if (isSlotClosedForEmp(t, t + flexDur, emp.name, dc)) return false;
              if (isEmpBusy(emp.name, t, t + flexDur)) return false;
              empsList.push(emp);
              return true;
            });
            if (!anyFlexFree) allFree = false;
          }
        }
        slots.push({ time: m2t(t), free: allFree, emps: empsList });
      }
    } else {
      // All flexible or single employee
        var allFlex = activeServices.every(function(s){ return isFlex(s.employee); });
        var hasSpec = activeServices.some(function(s){ return !isFlex(s.employee); });
      
      if (allFlex) {
        // All flexible: try simultaneous FIRST (different employees)
        var maxDur = Math.max(...activeServices.map(function(s){ return s.duration || 0; }));
        var totalDur = activeServices.reduce(function(sum,s){ return sum + (s.duration || 0); }, 0);
        for (let t = rangeStart; t + maxDur <= rangeEnd; t += 15) {
          if (ds === todayStr && t <= nowMin) continue;
          // Try to assign each service to a different free employee
          var assigned = []; var canAssign = true;
          var sorted = [...activeServices].sort(function(a,b){ return (b.duration||0) - (a.duration||0); });
          for (var si = 0; si < sorted.length; si++) {
            var svcDur = sorted[si].duration || 0;
            var found = employees.some(function(emp){
              if (assigned.includes(emp.name)) return false;
              var dc2 = getDCforEmp(ds, emp.name);
              if (dc2.type === 'closed') return false;
              if (!isTimeInDC(dc2, t, svcDur)) return false;
              if (isSlotClosedForEmp(t, t + svcDur, emp.name, dc2)) return false;
              if (isEmpBusy(emp.name, t, t + svcDur)) return false;
              assigned.push(emp.name);
              return true;
            });
            if (!found) { canAssign = false; break; }
          }
          if (canAssign) {
            var svcAssign=[];for(var si2=0;si2<activeServices.length;si2++){var sortIdx2=sorted.indexOf(activeServices[si2]);svcAssign.push(sortIdx2!==-1?assigned[sortIdx2]:'')}
            slots.push({ time: m2t(t), free: true, emps: assigned.map(function(n){ return employees.find(function(e){ return e.name === n; }); }).filter(Boolean), assign: svcAssign });
          } else {
            // Fallback: sequential by one employee
            var seqFree = employees.some(function(emp){
              var dc2 = getDCforEmp(ds, emp.name);
              if (dc2.type === 'closed') return false;
              if (!isTimeInDC(dc2, t, totalDur)) return false;
              if (isSlotClosedForEmp(t, t + totalDur, emp.name, dc2)) return false;
              return !isEmpBusy(emp.name, t, t + totalDur);
            });
            slots.push({ time: m2t(t), free: seqFree, emps: seqFree ? [employees.find(function(e){
              var dc2 = getDCforEmp(ds, e.name);
              if (dc2.type === 'closed') return false;
              if (!isTimeInDC(dc2, t, totalDur)) return false;
              if (isSlotClosedForEmp(t, t + totalDur, e.name, dc2)) return false;
              return !isEmpBusy(e.name, t, t + totalDur);
            })].filter(Boolean) : [] });
          }
        }
      } else {
        // Has specific employee(s)
        // Servicios flexibles dentro de esta combinación
        const flexSvcsInSpec = activeServices.filter(s => isFlex(s.employee));
        const flexDurInSpec   = flexSvcsInSpec.reduce((sum, s) => sum + (s.duration || 0), 0);
        // Empleadas específicas únicas → si solo hay 1 (o mezcla+flex) es secuencial
        const specEmpsUniq = [...new Set(activeServices.filter(s => !isFlex(s.employee)).map(s => s.employee))];
        const totalDur = getTotalDur(activeServices);  // ya corregido arriba
        // Candidatas: solo las empleadas específicamente nombradas
        const allowedNames = specEmpsUniq;
        let candidates = employees.filter(e => allowedNames.includes(e.name));
        // Si no hay restricción específica → todas las empleadas
        if (candidates.length === 0) candidates = [...employees];

        for (let t = rangeStart; t + totalDur <= rangeEnd; t += 15) {
          if (ds === todayStr && t <= nowMin) continue;
          let slotFree = false, empsSlot = [];

          if (candidates.length === 0) {
            slotFree = !closedHours.some(function(ch){ return ch.entity === 'global' && t < t2m(ch.to) && (t + totalDur) > t2m(ch.from); });
          } else {
            for (const emp of candidates) {
              const dc2 = getDCforEmp(ds, emp.name);
              if (dc2.type === 'closed') continue;
              // El slot completo (suma secuencial) debe caber en el horario de esta empleada
              if (!isTimeInDC(dc2, t, totalDur)) continue;
              if (isSlotClosedForEmp(t, t + totalDur, emp.name, dc2)) continue;
              if (isEmpBusy(emp.name, t, t + totalDur)) continue;

              // Si además hay servicios flexibles EN esta combinación que requieren una 2ª empleada:
              // (solo aplica cuando specEmpsUniq.length > 1 y hay servicios flex)
              // En el caso de 1 empleada + flex, ya está contado en totalDur (secuencial).
              // En el caso de distintas empleadas específicas es isMultiEmp → no llega aquí.
              slotFree = true;
              empsSlot.push(emp);
            }
          }
          slots.push({ time: m2t(t), free: slotFree, emps: empsSlot });
        }
      }
    }
    setAvailableSlots(slots);
  };

  const selectDate = (ds) => {
    setSelDate(ds);
    setSelTime(null);
    fetchSlotsForDate(ds);
  };

  // Re-calcular slots cuando cambian los servicios seleccionados
  useEffect(() => {
    if (selServices.length > 0 && selDate) {
      setSelTime(null);
      fetchSlotsForDate(selDate);
    } else if (!selDate) {
      setAvailableSlots([]);
      setSelTime(null);
    }
  }, [selServices.length, selDate]);

  const handleTimeSelect = (slot) => {
    if (!slot.free) return;
    setSelTime(slot.time);
    setAvailableEmpsForSelSlot(slot.emps || []);
    setSlotAssign(slot.assign || null);
    // Reset the employee selection to 'Cualquiera' to avoid stale selection
    setFormEmp('Cualquiera');
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!formName || !formPhone || !formGdpr) {
      setErrorMsg('Rellena todos los campos obligatorios y acepta la política.');
      return;
    }
    if (formEmail && !formEmail.includes('@')) {
      setErrorMsg('El email introducido no parece válido. Corrígelo o déjalo en blanco.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    
    const servicesPayload = selServices.map(s => ({ name: s.name, employee: s.employee || '', duration: s.duration || 30, price: s.price || 0 }));
    // Asignar empleada automática: usar la primera disponible del horario seleccionado
    var slotEmps = availableEmpsForSelSlot || [];
    servicesPayload.forEach(function(s, idx) {
      const needsResolve = !s.employee || s.employee === 'Todas' || s.employee === 'Ambos' || s.employee === 'Cualquiera' || s.employee.includes(',');
      if (needsResolve && slotEmps.length > 0) {
        if (slotAssign && slotAssign[idx]) s.employee = slotAssign[idx];
        else s.employee = slotEmps[0].name;
      }
    });
    const allEmps = [...new Set(servicesPayload.map(s => s.employee).filter(Boolean))];
    const payload = {
      clientName: formName,
      clientPhone: cleanPhone(formPhone),
      clientEmail: formEmail,
      notes: formNotes,
      services: servicesPayload,
      service: servicesPayload.map(s => s.name).join(' + '),
      employee: allEmps.join(', ') || 'Todas',
      date: selDate,
      time: selTime,
      duration: getTotalDur(servicesPayload),
      price: servicesPayload.reduce((sum, s) => sum + (s.price || 0), 0)
    };
    
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      
      if (resData.success) {
        setStep(4);
      } else {
        setErrorMsg('Error: ' + resData.error);
      }
    } catch (err) {
      setErrorMsg('Error de conexión.');
    }
    setSubmitting(false);
  };

  const cancelReservation = async () => {
    setSubmitting(true);
    setBookingResult(null);
    try {
      const res = await fetch(`/api/book?id=${editId}`, {
        method: 'DELETE'
      });
      const resData = await res.json();
      if (resData.success) {
        setBookingResult({ success: 'Tu cita ha sido cancelada correctamente. ¡Esperamos verte en otra ocasión!' });
      } else {
        setBookingResult({ error: resData.error || 'No se ha podido cancelar la cita.' });
      }
    } catch (e) {
      setBookingResult({ error: 'Error de conexión al intentar cancelar.' });
    }
    setSubmitting(false);
  };

  const resetBooking = () => {
    setStep(0);
    setSelServices([]);
    setShowSvcConfirm(false);
    setSelDate(null);
    setSelTime(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormNotes('');
    setFormGdpr(false);
  };

  // Render variables
  const normalizeStr = (s) => (s || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const desiredOrder = [
    "esmaltado semipermanente",
    "manicura con refuerzo",
    "pedicura spa",
    "esmaltado tradicional",
    "extension de unas en gel",
    "depilacion de cejas",
    "depilacion de bigote"
  ];

  let filteredServices = activeCat === 'all' 
    ? [...data.services] 
    : data.services.filter(s => s.category === activeCat);

  if (activeCat === 'all') {
    filteredServices.sort((a, b) => {
      const nameA = normalizeStr(a.name);
      const nameB = normalizeStr(b.name);
      
      let indexA = desiredOrder.findIndex(d => nameA.includes(d));
      let indexB = desiredOrder.findIndex(d => nameB.includes(d));
      
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      
      return indexA - indexB;
    });
  }

  // Calendar setup
  const y = calViewDate.getFullYear();
  const mo = calViewDate.getMonth();
  const firstDay = new Date(y, mo, 1);
  const off = (firstDay.getDay() + 6) % 7;
  const dim = new Date(y, mo + 1, 0).getDate();
  const todayStr = getLocalDateStr(new Date());
  
  // 2 month limit
  const maxDateObj = new Date();
  maxDateObj.setMonth(new Date().getMonth() + 2);
  const maxDateStr = getLocalDateStr(maxDateObj);
  const isNextMonthDisabled = y > maxDateObj.getFullYear() || (y === maxDateObj.getFullYear() && mo >= maxDateObj.getMonth());

  const msNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dayNames = ['L','M','X','J','V','S','D'];

  return (
    <>
      {showLocation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{background:'rgba(46,40,38,.85)', backdropFilter:'blur(4px)'}}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-[fadeIn_0.3s_ease]" style={{border:'1px solid var(--brown-light)'}}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{background:'var(--green)'}}>
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <h2 className="text-xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Clínica Estética UNIR</h2>
              <p className="text-sm font-semibold text-[#2e2826] mb-4">📍 Av. de la Paz, 137, 26006 Logroño, La Rioja</p>
              <div className="rounded-2xl overflow-hidden mb-4 shadow-sm border border-[#e0d8d5] h-40">
                <iframe
                  title="Ubicación Clínica Estética UNIR"
                  src="https://maps.google.com/maps?q=Av+de+la+Paz+137+Logrono&output=embed"
                  width="100%" height="100%" style={{border:0}} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                href="https://maps.google.com/maps?q=Av+de+la+Paz+137+Logrono"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-bold text-[#5b8f7a] mb-4 underline underline-offset-2"
              >
                Ver en Google Maps →
              </a>
              <button
                onClick={() => setShowLocation(false)}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white shadow-lg active:scale-[0.98] transition-all"
                style={{background:'var(--green-deep)'}}
              >
                Entendido, quiero reservar
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{background:'rgba(250,247,244,.95)', backdropFilter:'blur(20px)', borderColor:'var(--brown-light)'}}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white overflow-hidden" onClick={() => window.location.href='/'} style={{cursor:'pointer'}}>
              <img src="/logo.png" alt="Clínica Estética UNIR" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-base tracking-tight leading-none font-semibold italic text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Clínica Estética UNIR</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#5b8f7a]">Reserva tu cita online</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 border border-[#e0d8d5] shadow-sm">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75"></div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5b8f7a]">En línea</span>
          </div>

        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-32">
        {isCancelMode && (
          <div className="animate-[fadeIn_0.5s_ease]">
            {bookingResult ? (
              <div className="card p-10 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${bookingResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  {bookingResult.success ? <Check className="w-10 h-10 text-green-600" /> : <AlertCircle className="w-10 h-10 text-red-600" />}
                </div>
                <h2 className="text-3xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>
                  {bookingResult.success ? 'Cancelación Realizada' : 'No se pudo cancelar'}
                </h2>
                <p className="font-medium mb-8 text-[#7a6b67]">{bookingResult.success || bookingResult.error}</p>
                <button onClick={() => window.location.href = '/'} className="btn-primary w-full justify-center">
                  Ir a la página principal
                </button>
              </div>
            ) : existingReserva ? (
              <div className="card p-8 text-center border-red-100 bg-gradient-to-b from-white to-[#fffcfc]">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6 text-red-500">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>¿Anular tu cita?</h2>
                <p className="text-sm text-[#7a6b67] mb-8">Si confirmas, tu reserva será eliminada y el hueco quedará libre para otra clienta.</p>

                <div className="rounded-2xl p-6 text-left space-y-3 mb-8 border bg-white border-red-50 shadow-sm">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-[#7a6b67]">Tratamiento</span>
                    <span className="font-bold text-[#2e2826]">{existingReserva.service}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-[#7a6b67]">Fecha</span>
                    <span className="font-bold text-[#5b8f7a]">{existingReserva.date?.split('-').reverse().join('/')}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-[#7a6b67]">Hora</span>
                    <span className="font-bold text-[#5b8f7a]">{existingReserva.time}h</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={cancelReservation}
                    disabled={submitting}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <div className="spinner !border-white/30 !border-t-white"></div> : <Trash2 className="w-5 h-5" />}
                    Confirmar Anulación
                  </button>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all"
                  >
                    Mantener Cita
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="spinner mb-4 border-[#e0d8d5] border-t-[#5b8f7a]"></div>
                <p className="text-sm font-medium">Buscando tu reserva...</p>
              </div>
            )}
          </div>
        )}

        {!isCancelMode && step === 0 && (
          <div className="min-h-[80vh] flex flex-col items-center justify-center text-center py-12 animate-[fadeIn_0.5s_ease]">
            <div className="mb-8">
              <div className="w-28 h-28 rounded-3xl mx-auto shadow-xl mb-6 overflow-hidden" style={{boxShadow:'0 16px 48px rgba(91,143,122,.2)'}}>
                <img src="/logo.png" alt="Clínica Estética UNIR" className="w-full h-full object-cover" />
              </div>
            </div>
            <h1 className="text-5xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Clínica Estética UNIR</h1>
            <p className="text-sm font-medium mb-10 max-w-xs text-[#7a6b67]">Tu centro de tratamientos estéticos de pruebas.</p>
            <button onClick={() => setStep(1)} className="btn-primary text-base px-10 py-4 rounded-2xl shadow-xl active:scale-95" style={{boxShadow:'0 12px 32px rgba(91,143,122,.3)'}}>
              <CalendarPlus className="w-5 h-5" /> Reservar cita
            </button>
            <p className="text-xs font-medium mt-6 text-[#e0d8d5]">Reserva online · Sin esperas · 100% gratis</p>
          </div>
        )}

        {!isCancelMode && step > 0 && step < 4 && (
          <div className="flex items-start mb-8 px-4 animate-[fadeIn_0.3s_ease]">
            {[1, 2, 3].map(num => (
              <React.Fragment key={num}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`step-dot ${step === num ? 'active' : step > num ? 'done' : 'pending'}`}>{num}</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#7a6b67]">
                    {num === 1 ? 'Servicio' : num === 2 ? 'Fecha/Hora' : 'Datos'}
                  </span>
                </div>
                {num < 3 && <div className={`step-line ${step > num ? 'done' : 'pending'}`}></div>}
              </React.Fragment>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="step active">
            <div className="card p-6">
              <h2 className="text-2xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>¿Qué tratamiento deseas?</h2>
              <p className="text-sm font-medium mb-5 text-[#7a6b67]">Selecciona los servicios que deseas (puedes elegir varios)</p>

              {selServices.length > 0 && (
                <div className="mb-4 p-3 rounded-xl border" style={{borderColor:'var(--green)',background:'linear-gradient(135deg,var(--cream),white)'}}>
                  <p className="text-[10px] font-bold uppercase mb-2" style={{color:'var(--green-deep)'}}>Servicios seleccionados</p>
                  <div className="flex flex-wrap gap-2">
                    {selServices.map((s, i) => (
                      <span key={s.id || i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white border shadow-sm" style={{borderColor:'var(--green-mid)',color:'var(--brown)'}}>
                        {s.name}
                        <button onClick={() => setSelServices(selServices.filter(sv => sv.id !== s.id))} className="text-red-400 hover:text-red-600 ml-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </span>
                    ))}
                    <span className="text-[10px] font-bold self-center ml-1" style={{color:'var(--green-deep)'}}>
                      {getTotalDur(selServices)} min · {selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mb-5">
                <button className={`cat-pill ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>Todos</button>
                {data.categories.map(c => (
                  <button key={c.id} className={`cat-pill ${activeCat === c.name ? 'active' : ''}`} onClick={() => setActiveCat(c.name)}>
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredServices.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-sm">No hay servicios disponibles</p>
                ) : (
                  filteredServices.map(s => {
                    const isSel = selServices.some(sv => sv.id === s.id);
                    return (
                      <div key={s.id} className={`service-card ${isSel ? 'selected' : ''}`} onClick={() => {
                        if (isSel) setSelServices(selServices.filter(sv => sv.id !== s.id));
                        else setSelServices([...selServices, s]);
                      }}>
                        <div style={{flex:1}}>
                          <h4 className="font-bold text-sm text-[#2e2826]">{s.name}</h4>
                          {s.desc && <p className="text-xs mt-0.5 text-[#7a6b67]">{s.desc}</p>}
                          <div className="flex gap-3 mt-2">
                            <span className="text-[11px] font-semibold text-[#7a6b67]">⏱ {s.duration} min</span>
                          </div>
                        </div>
                        <div style={{textAlign:'right', flexShrink:0}}>
                          <span className="text-lg font-bold text-[#5b8f7a]">{s.price}€</span>
                          {isSel && <div className="text-[11px] font-bold mt-1 text-[#5b8f7a]">✓ Elegido</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-6 p-3.5 rounded-xl flex items-start gap-3" style={{background:'var(--cream)', border:'1px solid var(--green-mid)'}}>
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{color:'var(--green-deep)'}} />
                <p className="text-xs font-medium leading-relaxed" style={{color:'var(--brown)'}}>
                  <strong>Nota sobre servicios extra:</strong> Ten en cuenta que si el día de tu cita te apetece añadir algún detalle extra (como decoración en las uñas, francesa, etc.) que no esté en el servicio original, el precio final podría tener un pequeño suplemento. ¡Te informaremos en el salón encantadas!
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step active">
            <div className="card p-6 mb-4">
              <h2 className="text-2xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Elige fecha y hora</h2>
              <p className="text-sm font-medium mb-5 text-[#7a6b67]">Elige día y hora disponible</p>
              
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalViewDate(new Date(y, mo - 1, 1))} className="p-2 rounded-xl border bg-white transition-colors border-[#e0d8d5] hover:bg-slate-50">
                  <ChevronLeft className="w-5 h-5 text-[#7a6b67]" />
                </button>
                <span className="font-bold text-sm capitalize text-[#2e2826]">{msNames[mo]} {y}</span>
                <button disabled={isNextMonthDisabled} onClick={() => setCalViewDate(new Date(y, mo + 1, 1))} className={`p-2 rounded-xl border transition-colors border-[#e0d8d5] ${isNextMonthDisabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'}`}>
                  <ChevronRight className="w-5 h-5 text-[#7a6b67]" />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase mb-2 tracking-widest text-[#7a6b67]">
                {dayNames.map(d => <div key={d}>{d}</div>)}
              </div>
              
              <div className="grid grid-cols-7 gap-1 mb-2">
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
                <div className="mt-4 pt-4 border-t border-[#e0d8d5]">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-[#5b8f7a]" />
                    <h3 className="font-bold text-sm uppercase" style={{color:'var(--green-deep)'}}>Selecciona hora</h3>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-lg capitalize bg-[#c8ddd6] text-[#5b8f7a]">
                      {selDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                  
                  {loadingSlots ? (
                    <div className="flex justify-center py-4"><div className="spinner border-[#e0d8d5] border-t-[#5b8f7a]"></div></div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {availableSlots.length === 0 ? (
                        <div className="col-span-full text-center py-4">
                          <p className="text-slate-400 font-medium text-sm">No hay horario libre ese día</p>
                          <p className="text-[10px] mt-1 text-slate-400">Prueba con otra fecha</p>
                        </div>
                      ) : (
                        availableSlots.map(slot => (
                          <button 
                            key={slot.time} 
                            disabled={!slot.free}
                            onClick={() => handleTimeSelect(slot)}
                            className={`time-slot ${slot.free ? (selTime === slot.time ? 'selected' : '') : 'occupied'}`}
                          >
                            {slot.time}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selServices.length > 0 && (
                    <div className="mt-4 p-3 rounded-xl border" style={{borderColor:'var(--green)',background:'linear-gradient(135deg,var(--cream),white)'}}>
                      <p className="text-[10px] font-bold uppercase mb-2" style={{color:'var(--green-deep)'}}>Especialistas disponibles</p>
                      {selServices.map((s, i) => {
                        var isFlex = !s.employee || s.employee === 'Todas' || s.employee === 'Ambos' || s.employee === 'Cualquiera' || s.employee.includes(',');
                        return (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 text-xs" style={{borderColor:'var(--brown-light)'}}>
                            <span style={{color:'var(--brown)'}}>{s.name}</span>
                            {isFlex ? (
                              <select value={s.employee || ''} onChange={function(ev){
                                var updated = selServices.map(function(sv, idx){ return idx === i ? {...sv, employee: ev.target.value} : sv; });
                                setSelServices(updated);
                                // Pass updated services directly to bypass React stale closure
                                if (selDate) { setSelTime(null); fetchSlotsForDate(selDate, updated); }
                              }} className="p-1.5 border rounded-lg text-[10px] font-bold outline-none" style={{background:'white',borderColor:'var(--green-mid)',color:'var(--green-deep)'}}>
                                <option value="">Automático</option>
                                {data.employees.map(function(emp){ return <option key={emp.id} value={emp.name}>{emp.name}</option>; })}
                              </select>
                            ) : (
                              <span className="font-bold" style={{color:'var(--green-deep)'}}>{s.employee}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selServices.length > 1 && (function(){
                    var empList = selServices.map(function(s){ return s.employee; }).filter(Boolean);
                    var allSame = empList.length > 0 && empList.every(function(e){ return e === empList[0]; });
                    var hasFlex = selServices.some(function(s){ return !s.employee || s.employee === 'Todas' || s.employee === 'Ambos' || s.employee === 'Cualquiera'; });
                    if (allSame && !hasFlex) {
                      return <div className="mt-4 p-3 rounded-lg text-xs leading-relaxed border" style={{background:'#fff8e6',borderColor:'#f0dca0',color:'var(--brown-mid)'}}>
                        <strong>⏱ Una misma especialista:</strong> Todos los servicios los hará <strong>{empList[0]}</strong> uno tras otro. El tiempo total se <strong>suma</strong> ({getTotalDur(selServices)} min seguidos). Reserva suficiente tiempo.
                      </div>;
                    }
                    if (empList.length > 1) {
                      return <div className="mt-4 p-3 rounded-lg text-xs leading-relaxed border" style={{background:'#e8f5e9',borderColor:'#a5d6a7',color:'var(--brown-mid)'}}>
                        <strong>✅ Todo a la vez:</strong> Cada servicio tiene su propia profesional, así que se hacen <strong>al mismo tiempo</strong>. La hora que ves es la de inicio para todas.
                      </div>;
                    }
                    return <div className="mt-4 p-3 rounded-lg text-xs leading-relaxed border" style={{background:'#fff8e6',borderColor:'#f0dca0',color:'var(--brown-mid)'}}>
                      <strong>⏱ Atención:</strong> Los servicios con especialista fija asignan a esa profesional. Los que tienen "Automático" buscan otra disponible. Si todo lo hace la misma persona, el tiempo se suma ({getTotalDur(selServices)} min).
                    </div>;
                  })()}
                </div>
              )}
            </div>
            <button className="btn-back" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="step active">
            <div className="card p-5 mb-4 bg-gradient-to-br from-[#edf3f7] to-[#e8eef3] border-[#8fbca8]">
              <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 text-[#5b8f7a]">
                <ClipboardCheck className="w-4 h-4" /> Resumen de tu cita
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-[#7a6b67] shrink-0 mr-2">Servicios</span>
                  <span className="font-bold text-right text-xs" style={{color:'var(--brown)'}}>{selServices.map(s => s.name).join(' + ') || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[#7a6b67]">Duración total</span>
                  <span className="font-bold" style={{color:'var(--green-deep)'}}>{getTotalDur(selServices)} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[#7a6b67]">Fecha y hora</span>
                  <span className="font-bold" style={{color:'var(--green-deep)'}}>{selDate?.split('-').reverse().join('/')} · {selTime}h</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t" style={{borderColor:'var(--green)'}}>
                  <span className="font-medium text-[#7a6b67]">Precio total</span>
                  <span className="font-bold" style={{color:'var(--green-deep)'}}>{selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€</span>
                </div>
              </div>
            </div>

            <form onSubmit={submitBooking} className="card p-6 mb-4">
              <h2 className="text-2xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Tus datos</h2>
              <p className="text-sm font-medium mb-5 text-[#7a6b67]">Necesitamos tus datos para confirmar la cita</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#7a6b67]">Nombre completo *</label>
                  <input type="text" required value={formName} onChange={e=>setFormName(e.target.value)} className="input-field" placeholder="Tu nombre y apellidos" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#7a6b67]">Teléfono *</label>
                  <input type="tel" required value={formPhone} onChange={e=>setFormPhone(cleanPhone(e.target.value))} className="input-field" placeholder="600 000 000" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#7a6b67]">Email</label>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{background:'#fff3cd', color:'#856404', border:'1px solid #ffc107'}}>Opcional</span>
                  </div>
                  <input type="email" value={formEmail} onChange={e=>setFormEmail(e.target.value)} className="input-field" placeholder="tu@email.com" />
                  {/* Banner recomendación email */}
                  <div className="mt-2 p-3 rounded-xl flex items-start gap-2.5" style={{background:'linear-gradient(135deg,#edf7f0,#e0f0e8)', border:'1.5px solid #8fbca8'}}>
                    <span className="text-base shrink-0">💌</span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{color:'#3a7a5e'}}>Muy recomendable</p>
                      <p className="text-[10px] leading-relaxed" style={{color:'#5a7a6a'}}>
                        Con tu email podrás <strong>recibir el recordatorio</strong> de la cita, <strong>modificarla</strong> o <strong>cancelarla sin llamar</strong> cuando quieras desde el enlace que te enviaremos. Sin email, cualquier cambio requiere llamada telefónica.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#7a6b67]">Notas o comentarios (opcional)</label>
                  <textarea value={formNotes} onChange={e=>setFormNotes(e.target.value)} className="input-field resize-none" style={{height:'80px'}} placeholder="Alergias, peticiones especiales..."></textarea>
                </div>
                <div className="border border-[#e0d8d5] rounded-2xl overflow-hidden bg-white">
                  <div onClick={()=>setShowTerms(!showTerms)} className="flex items-center justify-between p-4 cursor-pointer text-xs font-bold text-[#7a6b67] hover:text-[#2e2826] uppercase tracking-widest select-none">
                    <span>Condiciones de Cita y Protección de Datos</span>
                    <svg className={'w-4 h-4 transition-transform '+(showTerms?'rotate-180':'')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </div>
                  {showTerms && (
                    <div className="px-4 pb-4 space-y-4 text-xs text-[#7a6b67] leading-relaxed max-h-52 overflow-y-auto border-t border-[#e0d8d5] pt-4">
                      <div><h4 className="font-bold text-[#2e2826] text-xs uppercase tracking-widest mb-2">1. Condiciones de la Cita</h4><p>La cita se confirma una vez recibida y procesada por el sistema. Clínica Estética UNIR se reserva el derecho de modificar o cancelar la cita en caso de incidencias técnicas o de agenda, informando al cliente por los medios facilitados. En caso de no presentarse sin aviso previo con al menos 3 horas de antelación, el estudio podrá requerir una confirmación previa para futuras reservas.</p></div>
                      <div><h4 className="font-bold text-[#2e2826] text-xs uppercase tracking-widest mb-2">2. Responsabilidad del Cliente</h4><p>El cliente se compromete a facilitar datos veraces y actualizados. La información sobre alergias, sensibilidades cutáneas o condiciones médicas se facilita voluntariamente; el estudio hará lo posible por atenderlas pero no puede garantizar la ausencia total de reacciones en tratamientos de belleza.</p></div>
                      <div><h4 className="font-bold text-[#2e2826] text-xs uppercase tracking-widest mb-2">3. Protección de Datos (RGPD)</h4><p><strong>Responsable:</strong> Clínica Estética UNIR.</p><p><strong>Finalidad:</strong> Gestionar citas, enviar recordatorios, comunicar cambios o cancelaciones, enviar encuesta post-visita por email, y mantener histórico de visitas.</p><p><strong>Base legítima:</strong> Ejecución de un contrato (la cita) y consentimiento explícito.</p><p><strong>Destinatarios:</strong> No se cederán a terceros salvo obligación legal. Servicios cloud (Vercel, Google Cloud) acogidos al Privacy Framework UE-EEUU.</p><p><strong>Plazo:</strong> Durante la relación comercial y hasta 5 años después.</p><p><strong>Derechos:</strong> Acceso, rectificación, supresión, limitación, portabilidad y oposición escribiendo a <strong>soriasystems33@gmail.com</strong>. Reclamación ante la AEPD.</p><p><strong>Comunicaciones:</strong> Al facilitar email y teléfono, el cliente consiente recibir comunicaciones de su cita y un email post-visita de valoración, sin publicidad comercial.</p></div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-4 border-t border-[#e0d8d5] bg-[#faf7f4]">
                    <input type="checkbox" id="terms-check" required checked={formGdpr} onChange={e=>setFormGdpr(e.target.checked)} className="mt-1 w-5 h-5 rounded cursor-pointer shrink-0" style={{accentColor:'var(--green-deep)'}} />
                    <label htmlFor="terms-check" className="text-xs font-medium cursor-pointer leading-relaxed text-[#7a6b67]">
                      He leído y acepto las <strong className="text-[#2e2826]">condiciones de cita</strong> y la <strong className="text-[#2e2826]">política de privacidad</strong> según el RGPD.
                    </label>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="mt-4 text-sm font-semibold px-4 py-3 rounded-2xl border bg-[#fdf0f1] border-[#f3c6cb] text-[#c0464f]">
                  {errorMsg}
                </div>
              )}

              <div className="mt-8">
                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center text-base py-4 rounded-2xl shadow-2xl" style={{boxShadow:'0 8px 32px rgba(91,143,122,.35)'}}>
                  {submitting ? <div className="spinner"></div> : <Check className="w-5 h-5" />}
                  <span>{submitting ? 'Reservando...' : 'Confirmar Cita'}</span>
                </button>
              </div>
            </form>
            <button className="btn-back" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="step active">
            <div className="card p-10 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#8fbca8] to-[#5b8f7a]" style={{boxShadow:'0 12px 32px rgba(91,143,122,.3)'}}>
                <Check className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>¡Cita confirmada!</h2>
              <p className="font-medium mb-6 text-[#7a6b67]">Te esperamos en Clínica Estética UNIR. Hasta pronto 🌸</p>

              <div className="rounded-2xl p-5 text-left space-y-3 mb-8 border bg-[#faf7f4] border-[#e0d8d5]">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Servicios</span>
                  <span className="font-bold text-right max-w-[65%]" style={{color:'var(--brown)'}}>{selServices.map(s => s.name).join(' + ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Duración total</span>
                  <span className="font-bold" style={{color:'var(--green-deep)'}}>{getTotalDur(selServices)} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Fecha y hora</span>
                  <span className="font-bold" style={{color:'var(--green-deep)'}}>{selDate?.split('-').reverse().join('/')} · {selTime}h</span>
                </div>
              </div>

              <p className="text-xs font-medium mb-6 text-[#7a6b67]">Para cancelar o modificar tu cita, utiliza el enlace que llegará a tu correo electrónico.</p>
              <button onClick={resetBooking} className="btn-primary w-full justify-center">
                <PlusCircle className="w-4 h-4" /> Hacer otra reserva
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Flotante para paso 1 y 2 */}
      {step > 0 && step < 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3 pb-5 pointer-events-none" style={{background:'linear-gradient(to top,rgba(250,247,244,1) 70%,rgba(250,247,244,0))'}}>
          <div className="max-w-2xl mx-auto pointer-events-auto">
            {step === 1 && selServices.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-medium truncate mr-3 text-[#7a6b67]">{selServices.map(s => s.name).join(' + ')} · {getTotalDur(selServices)} min</p>
                <p className="text-sm font-bold whitespace-nowrap text-[#5b8f7a]">{selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€</p>
              </div>
            )}
            {step === 2 && selServices.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-medium truncate mr-3 text-[#7a6b67]">{selServices.map(s => s.name).join(' + ')} · {getTotalDur(selServices)} min</p>
                <p className="text-sm font-bold whitespace-nowrap text-[#5b8f7a]">{selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€</p>
              </div>
            )}
            {step === 1 && showSvcConfirm && (
              <div className="flex gap-2">
                <button onClick={function(){setShowSvcConfirm(false)}} className="flex-1 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all bg-white border-2" style={{borderColor:'var(--green-deep)',color:'var(--green-deep)'}}>+ Añadir más</button>
                <button onClick={function(){setShowSvcConfirm(false);setStep(2)}} className="flex-1 py-4 rounded-2xl font-bold text-sm text-white shadow-lg active:scale-[0.98] transition-all" style={{background:'var(--green-deep)'}}>Elegir fecha</button>
              </div>
            )}
            {(!showSvcConfirm || step === 2) && (
            <button 
              onClick={function(){if(step===1){setShowSvcConfirm(true)}else{setStep(3)}}}
              disabled={step === 1 ? selServices.length === 0 : !(selDate && selTime)}
              className="btn-primary w-full justify-center text-base py-4 rounded-2xl shadow-2xl" 
              style={{boxShadow:'0 8px 32px rgba(91,143,122,.35)'}}
            >
              <ArrowRight className="w-5 h-5" />
              <span>{step === 1 ? 'Continuar' : (selDate && selTime ? 'Reservar' : 'Elige hora')}</span>
            </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

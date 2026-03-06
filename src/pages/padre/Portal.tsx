import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Alumno, Pago, Reporte, Asistencia } from '../../types';
import { CreditCard, FileText, CalendarCheck, AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Portal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Buscar padre por uid (sin filtro deleted para evitar índice)
      const padreSnap = await getDocs(query(
        collection(db, 'educarte_padres'),
        where('uid', '==', user.uid)
      ));

      console.log('Padre encontrado:', padreSnap.size, 'uid buscado:', user.uid);

      if (padreSnap.empty) {
        console.warn('No se encontró padre con uid:', user.uid);
        setLoading(false);
        return;
      }

      const padre = padreSnap.docs[0].data();
      const alumnosIds: string[] = padre.alumnosIds || [];

      console.log('AlumnosIds:', alumnosIds);

      if (alumnosIds.length === 0) {
        setLoading(false);
        return;
      }

      // Traer TODOS los alumnos y filtrar en cliente
      const alumnosSnap = await getDocs(collection(db, 'educarte_alumnos'));
      const alumnosList = alumnosSnap.docs
        .filter(d => alumnosIds.includes(d.id) && !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Alumno));

      console.log('Alumnos encontrados:', alumnosList.length);
      setAlumnos(alumnosList);

      if (alumnosList.length === 0) {
        setLoading(false);
        return;
      }

      const mesActual = new Date().toISOString().slice(0, 7);

      // Pagos del mes - filtrar en cliente
      const pagosSnap = await getDocs(collection(db, 'educarte_pagos'));
      const pagosList = pagosSnap.docs
        .filter(d => {
          const data = d.data();
          return alumnosIds.includes(data.alumnoId) && data.mes === mesActual && !data.deleted;
        })
        .map(d => ({ id: d.id, ...d.data() } as Pago));
      setPagos(pagosList);

      // Reportes - filtrar en cliente
      const reportesSnap = await getDocs(collection(db, 'educarte_reportes'));
      const reportesList = reportesSnap.docs
        .filter(d => alumnosIds.includes(d.data().alumnoId) && !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Reporte));
      setReportes(reportesList);

      // Asistencia del mes - filtrar en cliente
      const asistSnap = await getDocs(collection(db, 'educarte_asistencia'));
      const asistList = asistSnap.docs
        .filter(d => {
          const data = d.data();
          return alumnosIds.includes(data.alumnoId) && data.fecha?.startsWith(mesActual);
        })
        .map(d => ({ id: d.id, ...d.data() } as Asistencia));
      setAsistencias(asistList);

    } catch (e) {
      console.error('Error cargando portal:', e);
    } finally {
      setLoading(false);
    }
  };

  const getPagoAlumno = (alumnoId: string) => pagos.find(p => p.alumnoId === alumnoId);

  const getAsistenciaMes = (alumnoId: string) => {
    const registros = asistencias.filter(a => a.alumnoId === alumnoId);
    const presentes = registros.filter(a => a.estado === 'presente').length;
    const total = registros.length;
    return { presentes, total, porcentaje: total > 0 ? Math.round((presentes / total) * 100) : 0 };
  };

  const getUltimoReporte = (alumnoId: string) =>
    reportes.filter(r => r.alumnoId === alumnoId).sort((a, b) => {
      const fa = (a.createdAt as any)?.toDate?.() || new Date(a.createdAt);
      const fb = (b.createdAt as any)?.toDate?.() || new Date(b.createdAt);
      return fb.getTime() - fa.getTime();
    })[0];

  const estadoPagoConfig: Record<string, { label: string; color: string; icon: any }> = {
    pagado: { label: 'Al día', color: 'text-green-600', icon: CheckCircle },
    pendiente: { label: 'Pendiente', color: 'text-yellow-600', icon: Clock },
    vencido: { label: 'Vencido', color: 'text-red-600', icon: AlertTriangle },
    parcial: { label: 'Pago parcial', color: 'text-blue-600', icon: CreditCard },
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
    </div>
  );

  if (alumnos.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <p className="text-lg font-medium">No tienes hijos registrados aún</p>
      <p className="text-sm mt-1">Contacta al administrador para vincular tus hijos</p>
    </div>
  );

  const mesActual = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {user?.nombre || 'Padre'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {mesActual.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Card por alumno */}
      {alumnos.map(alumno => {
        const pago = getPagoAlumno(alumno.id);
        const asist = getAsistenciaMes(alumno.id);
        const reporte = getUltimoReporte(alumno.id);
        const pagoConfig = pago ? estadoPagoConfig[pago.estado] : null;
        const PagoIcon = pagoConfig?.icon || Clock;

        return (
          <div key={alumno.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Alumno header */}
            <div className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">{alumno.nombre.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">{alumno.nombre}</h2>
                <p className="text-primary-100 text-sm">{alumno.grado}</p>
              </div>
              <div className="ml-auto">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                  alumno.estado === 'activo' ? 'bg-green-400/20 text-white' : 'bg-gray-400/20 text-white'
                }`}>
                  {alumno.estado === 'activo' ? '● Activo' : '● Inactivo'}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {/* Pago */}
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Pago {MESES[mesActual.getMonth()]}
                  </p>
                </div>
                {pago ? (
                  <div>
                    <div className={`flex items-center gap-1.5 ${pagoConfig?.color}`}>
                      <PagoIcon className="w-4 h-4" />
                      <span className="font-semibold text-sm">{pagoConfig?.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ${pago.montoPagado?.toLocaleString()} / ${pago.monto?.toLocaleString()}
                    </p>
                    {pago.estado !== 'pagado' && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Pendiente: ${(pago.monto - (pago.montoPagado || 0)).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Sin cobro generado</p>
                )}
              </div>

              {/* Asistencia */}
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarCheck className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Asistencia</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${
                    asist.porcentaje >= 80 ? 'text-green-600' :
                    asist.porcentaje >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {asist.porcentaje}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {asist.presentes} de {asist.total} días registrados
                </p>
                <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      asist.porcentaje >= 80 ? 'bg-green-500' :
                      asist.porcentaje >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${asist.porcentaje}%` }}
                  />
                </div>
              </div>

              {/* Último reporte */}
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Último reporte</p>
                </div>
                {reporte ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{reporte.periodo}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{reporte.desempeno}</p>
                    {reporte.calificacion && (
                      <span className="inline-block mt-1 bg-primary-50 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {reporte.calificacion}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Sin reportes aún</p>
                )}
              </div>
            </div>

            {/* Accesos rápidos */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex gap-4">
              <button
                onClick={() => navigate('/portal/pagos')}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition"
              >
                Ver pagos <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/portal/reportes')}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition"
              >
                Ver reportes <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/portal/asistencia')}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition"
              >
                Ver asistencia <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Asistencia, Alumno } from '../../types';
import { CalendarCheck, Check, X, Clock } from 'lucide-react';
import { db } from '../../../firebase';

const estadoConfig = {
  presente: { label: 'Presente', color: 'text-green-700', bg: 'bg-green-100', icon: Check },
  ausente: { label: 'Ausente', color: 'text-red-700', bg: 'bg-red-100', icon: X },
  justificado: { label: 'Justificado', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock },
};

export default function PortalAsistencia() {
  const { user } = useAuth();
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [filtroAlumno, setFiltroAlumno] = useState('todos');

  useEffect(() => { fetchData(); }, [user, mes]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const padreSnap = await getDocs(query(
        collection(db, 'educarte_padres'),
        where('uid', '==', user.uid)
      ));
      if (padreSnap.empty) { setLoading(false); return; }
      const alumnosIds: string[] = padreSnap.docs[0].data().alumnosIds || [];

      const alumnosSnap = await getDocs(collection(db, 'educarte_alumnos'));
      setAlumnos(alumnosSnap.docs
        .filter(d => alumnosIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() } as Alumno)));

      const asistSnap = await getDocs(collection(db, 'educarte_asistencia'));
      setAsistencias(asistSnap.docs
        .filter(d => {
          const data = d.data();
          return alumnosIds.includes(data.alumnoId) && data.fecha?.startsWith(mes);
        })
        .map(d => ({ id: d.id, ...d.data() } as Asistencia)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const asistenciasFiltradas = asistencias.filter(a =>
    filtroAlumno === 'todos' || a.alumnoId === filtroAlumno
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const getNombreAlumno = (id: string) => alumnos.find(a => a.id === id)?.nombre || 'Alumno';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asistencia</h1>
        <p className="text-sm text-gray-500 mt-0.5">{asistencias.length} registros este mes</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {alumnos.length > 1 && (
          <select
            value={filtroAlumno}
            onChange={e => setFiltroAlumno(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todos">Todos los hijos</option>
            {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        )}
      </div>

      {/* Resumen por alumno */}
      {alumnos.map(alumno => {
        const registros = asistencias.filter(a => a.alumnoId === alumno.id);
        const presentes = registros.filter(a => a.estado === 'presente').length;
        const ausentes = registros.filter(a => a.estado === 'ausente').length;
        const justificados = registros.filter(a => a.estado === 'justificado').length;
        const total = registros.length;
        const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
        return (
          <div key={alumno.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-bold">{alumno.nombre.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{alumno.nombre}</p>
                <p className="text-xs text-gray-400">{total} días registrados</p>
              </div>
              <span className={`text-2xl font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {pct}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-green-50 rounded-lg py-2">
                <p className="font-bold text-green-700 text-lg">{presentes}</p>
                <p className="text-green-600">Presentes</p>
              </div>
              <div className="bg-red-50 rounded-lg py-2">
                <p className="font-bold text-red-700 text-lg">{ausentes}</p>
                <p className="text-red-600">Ausentes</p>
              </div>
              <div className="bg-yellow-50 rounded-lg py-2">
                <p className="font-bold text-yellow-700 text-lg">{justificados}</p>
                <p className="text-yellow-600">Justificados</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Lista detallada */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : asistenciasFiltradas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin registros este mes</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {asistenciasFiltradas.map(a => {
              const cfg = estadoConfig[a.estado];
              const Icon = cfg.icon;
              return (
                <div key={a.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    {alumnos.length > 1 && (
                      <p className="text-xs text-gray-400">{getNombreAlumno(a.alumnoId)}</p>
                    )}
                    {a.nota && <p className="text-xs text-gray-500 italic mt-0.5">"{a.nota}"</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
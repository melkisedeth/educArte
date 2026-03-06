import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Asistencia as AsistenciaType, Alumno } from '../../types';
import { CalendarCheck, Search, Check, X, Clock, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../firebase';

type EstadoAsistencia = 'presente' | 'ausente' | 'justificado';

const estadoConfig: Record<EstadoAsistencia, { label: string; color: string; bg: string; icon: any }> = {
  presente: { label: 'Presente', color: 'text-green-700', bg: 'bg-green-100', icon: Check },
  ausente: { label: 'Ausente', color: 'text-red-700', bg: 'bg-red-100', icon: X },
  justificado: { label: 'Justificado', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock },
};

const hoy = () => new Date().toISOString().split('T')[0];

export default function Asistencia() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState(hoy());
  const [search, setSearch] = useState('');
  const [registros, setRegistros] = useState<Record<string, { estado: EstadoAsistencia; nota: string }>>({});
  const [vistaResumen, setVistaResumen] = useState(false);
  const [mesResumen, setMesResumen] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { fetchAlumnos(); }, []);
  useEffect(() => { if (!vistaResumen) fetchAsistenciaDia(); }, [fecha, vistaResumen]);
  useEffect(() => { if (vistaResumen) fetchResumenMes(); }, [mesResumen, vistaResumen]);

  const fetchAlumnos = async () => {
    try {
      const snap = await getDocs(collection(db, 'educarte_alumnos'));
      setAlumnos(snap.docs
        .filter(d => !d.data().deleted && d.data().estado === 'activo')
        .map(d => ({ id: d.id, ...d.data() } as Alumno)));
    } catch (e) {
      toast.error('Error cargando alumnos');
    } finally {
      setLoading(false);
    }
  };

  const fetchAsistenciaDia = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'educarte_asistencia'));
      const data = snap.docs
        .filter(d => d.data().fecha === fecha)
        .map(d => ({ id: d.id, ...d.data() } as AsistenciaType));
      setAsistencias(data);
      const map: Record<string, { estado: EstadoAsistencia; nota: string }> = {};
      data.forEach(a => {
        map[a.alumnoId] = { estado: a.estado, nota: a.nota || '' };
      });
      setRegistros(map);
    } catch (e) {
      toast.error('Error cargando asistencia');
    } finally {
      setLoading(false);
    }
  };

  const fetchResumenMes = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'educarte_asistencia'));
      setAsistencias(snap.docs
        .filter(d => d.data().fecha?.startsWith(mesResumen))
        .map(d => ({ id: d.id, ...d.data() } as AsistenciaType)));
    } catch (e) {
      toast.error('Error cargando resumen');
    } finally {
      setLoading(false);
    }
  };

  const setEstado = (alumnoId: string, estado: EstadoAsistencia) => {
    setRegistros(prev => ({
      ...prev,
      [alumnoId]: { estado, nota: prev[alumnoId]?.nota || '' }
    }));
  };

  const setNota = (alumnoId: string, nota: string) => {
    setRegistros(prev => ({
      ...prev,
      [alumnoId]: { ...prev[alumnoId], nota }
    }));
  };

  const marcarTodos = (estado: EstadoAsistencia) => {
    const map: Record<string, { estado: EstadoAsistencia; nota: string }> = {};
    alumnos.forEach(a => {
      map[a.id] = { estado, nota: registros[a.id]?.nota || '' };
    });
    setRegistros(map);
  };

  const guardarAsistencia = async () => {
    if (Object.keys(registros).length === 0) {
      toast.error('Marca la asistencia de al menos un alumno');
      return;
    }
    setSaving(true);
    try {
      for (const alumno of alumnos) {
        const registro = registros[alumno.id];
        if (!registro) continue;

        const existente = asistencias.find(a => a.alumnoId === alumno.id);
        const data = {
          alumnoId: alumno.id,
          fecha,
          estado: registro.estado,
          nota: registro.nota || '',
          createdAt: new Date(),
        };

        if (existente) {
          await updateDoc(doc(db, 'educarte_asistencia', existente.id), data);
        } else {
          await addDoc(collection(db, 'educarte_asistencia'), data);
        }
      }
      toast.success('Asistencia guardada');
      fetchAsistenciaDia();
    } catch (e) {
      toast.error('Error guardando asistencia');
    } finally {
      setSaving(false);
    }
  };

  const cambiarFecha = (dias: number) => {
    const d = new Date(fecha);
    d.setDate(d.getDate() + dias);
    setFecha(d.toISOString().split('T')[0]);
  };

  const getResumenAlumno = (alumnoId: string) => {
    const registrosAlumno = asistencias.filter(a => a.alumnoId === alumnoId);
    const total = registrosAlumno.length;
    const presentes = registrosAlumno.filter(a => a.estado === 'presente').length;
    const ausentes = registrosAlumno.filter(a => a.estado === 'ausente').length;
    const justificados = registrosAlumno.filter(a => a.estado === 'justificado').length;
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;
    return { total, presentes, ausentes, justificados, porcentaje };
  };

  const alumnosFiltrados = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistencia</h1>
          <p className="text-sm text-gray-500 mt-0.5">{alumnos.length} alumnos activos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVistaResumen(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              !vistaResumen ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Registro diario
          </button>
          <button
            onClick={() => setVistaResumen(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              vistaResumen ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Resumen mensual
          </button>
        </div>
      </div>

      {!vistaResumen ? (
        <>
          {/* Controles fecha */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => cambiarFecha(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={() => cambiarFecha(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => setFecha(hoy())}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
              >
                Hoy
              </button>
            </div>

            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => marcarTodos('presente')}
                className="px-3 py-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition font-medium"
              >
                ✓ Todos presentes
              </button>
              <button
                onClick={() => marcarTodos('ausente')}
                className="px-3 py-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition font-medium"
              >
                ✗ Todos ausentes
              </button>
            </div>
          </div>

          {/* Lista asistencia */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : alumnosFiltrados.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No hay alumnos activos</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alumnosFiltrados.map(alumno => {
                  const reg = registros[alumno.id];
                  return (
                    <div key={alumno.id} className="px-5 py-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-3 flex-1 min-w-40">
                          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-semibold text-sm">
                              {alumno.nombre.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{alumno.nombre}</p>
                            <p className="text-xs text-gray-400">{alumno.grado}</p>
                          </div>
                        </div>

                        {/* Botones estado */}
                        <div className="flex gap-2">
                          {(Object.keys(estadoConfig) as EstadoAsistencia[]).map(estado => {
                            const cfg = estadoConfig[estado];
                            const Icon = cfg.icon;
                            const activo = reg?.estado === estado;
                            return (
                              <button
                                key={estado}
                                onClick={() => setEstado(alumno.id, estado)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                                  activo
                                    ? `${cfg.bg} ${cfg.color} border-transparent`
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Nota */}
                        {reg?.estado === 'ausente' || reg?.estado === 'justificado' ? (
                          <input
                            type="text"
                            placeholder="Nota (opcional)"
                            value={reg?.nota || ''}
                            onChange={e => setNota(alumno.id, e.target.value)}
                            className="flex-1 min-w-32 max-w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guardar */}
          {alumnosFiltrados.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={guardarAsistencia}
                disabled={saving}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar asistencia</>}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Resumen mensual */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <input
              type="month"
              value={mesResumen}
              onChange={e => setMesResumen(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Alumno</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Presentes</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Ausentes</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Justificados</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">% Asistencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {alumnosFiltrados.map(alumno => {
                      const res = getResumenAlumno(alumno.id);
                      return (
                        <tr key={alumno.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <span className="text-primary-600 font-semibold text-xs">{alumno.nombre.charAt(0)}</span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{alumno.nombre}</p>
                                <p className="text-xs text-gray-400">{alumno.grado}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-green-700 font-semibold">{res.presentes}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-red-600 font-semibold">{res.ausentes}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-yellow-600 font-semibold">{res.justificados}</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-24">
                                <div
                                  className={`h-2 rounded-full ${res.porcentaje >= 80 ? 'bg-green-500' : res.porcentaje >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${res.porcentaje}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold ${res.porcentaje >= 80 ? 'text-green-600' : res.porcentaje >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {res.porcentaje}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
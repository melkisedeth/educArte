import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Reporte, Alumno } from '../../types';
import { Plus, Search, X, Loader2, FileText, Edit2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../firebase';

const initialForm = {
  alumnoId: '',
  periodo: '',
  materias: '',
  desempeno: '',
  fortalezas: '',
  areasMejora: '',
  calificacion: '',
};

export default function Reportes() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroAlumno, setFiltroAlumno] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [verDetalle, setVerDetalle] = useState<Reporte | null>(null);
  const [editando, setEditando] = useState<Reporte | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportesSnap, alumnosSnap] = await Promise.all([
        getDocs(collection(db, 'educarte_reportes')),
        getDocs(collection(db, 'educarte_alumnos'))
      ]);
      setAlumnos(alumnosSnap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Alumno)));
      setReportes(reportesSnap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Reporte)));
    } catch (e) {
      toast.error('Error cargando reportes');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (reporte?: Reporte) => {
    if (reporte) {
      setEditando(reporte);
      setForm({
        alumnoId: reporte.alumnoId,
        periodo: reporte.periodo,
        materias: reporte.materias,
        desempeno: reporte.desempeno,
        fortalezas: reporte.fortalezas,
        areasMejora: reporte.areasMejora,
        calificacion: reporte.calificacion,
      });
    } else {
      setEditando(null);
      setForm(initialForm);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditando(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.alumnoId || !form.periodo || !form.desempeno) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await updateDoc(doc(db, 'educarte_reportes', editando.id), { ...form });
        toast.success('Reporte actualizado');
      } else {
        await addDoc(collection(db, 'educarte_reportes'), {
          ...form,
          deleted: false,
          createdAt: new Date(),
        });
        toast.success('Reporte creado');
      }
      closeModal();
      fetchData();
    } catch (e) {
      toast.error('Error guardando reporte');
    } finally {
      setSaving(false);
    }
  };

  const getNombreAlumno = (id: string) =>
    alumnos.find(a => a.id === id)?.nombre || 'Desconocido';

  const filtrados = reportes.filter(r => {
    const nombre = getNombreAlumno(r.alumnoId).toLowerCase();
    const matchSearch = nombre.includes(search.toLowerCase()) ||
      r.periodo.toLowerCase().includes(search.toLowerCase());
    const matchAlumno = filtroAlumno === 'todos' || r.alumnoId === filtroAlumno;
    return matchSearch && matchAlumno;
  });

  const formatFecha = (fecha: any) => {
    if (!fecha) return '—';
    if (fecha?.toDate) return fecha.toDate().toLocaleDateString('es-ES');
    return new Date(fecha).toLocaleDateString('es-ES');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes Académicos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{reportes.length} reportes generados</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Reporte
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por alumno o período..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filtroAlumno}
          onChange={e => setFiltroAlumno(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="todos">Todos los alumnos</option>
          {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No hay reportes</p>
            <p className="text-sm mt-1">Crea el primer reporte académico</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Alumno</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Período</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Materias</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Calificación</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(reporte => (
                  <tr key={reporte.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-semibold text-xs">
                            {getNombreAlumno(reporte.alumnoId).charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">{getNombreAlumno(reporte.alumnoId)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{reporte.periodo}</td>
                    <td className="px-5 py-3 text-gray-600 max-w-[180px] truncate">{reporte.materias}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block bg-primary-50 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        {reporte.calificacion || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatFecha(reporte.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setVerDetalle(reporte)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openModal(reporte)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? 'Editar Reporte' : 'Nuevo Reporte Académico'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alumno *</label>
                  <select
                    value={form.alumnoId}
                    onChange={e => setForm({ ...form, alumnoId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    disabled={!!editando}
                  >
                    <option value="">Seleccionar alumno</option>
                    {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período *</label>
                  <input
                    type="text"
                    value={form.periodo}
                    onChange={e => setForm({ ...form, periodo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Ej: Enero - Marzo 2026"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materias trabajadas</label>
                  <input
                    type="text"
                    value={form.materias}
                    onChange={e => setForm({ ...form, materias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Ej: Matemáticas, Español"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calificación</label>
                  <input
                    type="text"
                    value={form.calificacion}
                    onChange={e => setForm({ ...form, calificacion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Ej: Excelente / 9.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del desempeño *</label>
                <textarea
                  value={form.desempeno}
                  onChange={e => setForm({ ...form, desempeno: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                  placeholder="Describe el desempeño general del alumno..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fortalezas</label>
                  <textarea
                    value={form.fortalezas}
                    onChange={e => setForm({ ...form, fortalezas: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={3}
                    placeholder="Puntos fuertes del alumno..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Áreas de mejora</label>
                  <textarea
                    value={form.areasMejora}
                    onChange={e => setForm({ ...form, areasMejora: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={3}
                    placeholder="Aspectos a mejorar..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Detalle */}
      {verDetalle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Detalle del Reporte</h2>
              <button onClick={() => setVerDetalle(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Alumno</p>
                  <p className="font-semibold text-gray-800 text-lg">{getNombreAlumno(verDetalle.alumnoId)}</p>
                </div>
                <span className="bg-primary-50 text-primary-700 font-semibold px-3 py-1 rounded-full text-sm">
                  {verDetalle.calificacion || 'Sin calificación'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Período</p>
                  <p className="text-gray-800 font-medium">{verDetalle.periodo}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Materias</p>
                  <p className="text-gray-800 font-medium">{verDetalle.materias || '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Desempeño</p>
                <p className="text-gray-700 text-sm bg-gray-50 rounded-lg p-3">{verDetalle.desempeno}</p>
              </div>

              {verDetalle.fortalezas && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Fortalezas</p>
                  <p className="text-gray-700 text-sm bg-green-50 rounded-lg p-3">{verDetalle.fortalezas}</p>
                </div>
              )}

              {verDetalle.areasMejora && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Áreas de mejora</p>
                  <p className="text-gray-700 text-sm bg-yellow-50 rounded-lg p-3">{verDetalle.areasMejora}</p>
                </div>
              )}

              <div className="text-right">
                <button
                  onClick={() => { setVerDetalle(null); openModal(verDetalle); }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Editar reporte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
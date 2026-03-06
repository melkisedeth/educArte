import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Alumno, Pago } from '../../types';
import { Plus, Search, Edit2, UserX, UserCheck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../firebase';

const GRADOS = ['Kínder', '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°', '11°'];

const initialForm = {
  nombre: '',
  fechaNacimiento: '',
  grado: '',
  fechaIngreso: new Date().toISOString().split('T')[0],
  estado: 'activo' as 'activo' | 'inactivo',
  montoPago: 0,
  diaCicloPago: 1,
};

export default function Alumnos() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroGrado, setFiltroGrado] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Alumno | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAlumnos(); }, []);

  const fetchAlumnos = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'educarte_alumnos'));
      setAlumnos(snap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Alumno)));
    } catch (e) {
      toast.error('Error cargando alumnos');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (alumno?: Alumno) => {
    if (alumno) {
      setEditando(alumno);
      setForm({
        nombre: alumno.nombre,
        fechaNacimiento: alumno.fechaNacimiento,
        grado: alumno.grado,
        fechaIngreso: alumno.fechaIngreso,
        estado: alumno.estado,
        montoPago: alumno.montoPago,
        diaCicloPago: alumno.diaCicloPago,
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
    if (!form.nombre || !form.grado || !form.fechaNacimiento) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await updateDoc(doc(db, 'educarte_alumnos', editando.id), { ...form });
        toast.success('Alumno actualizado');
      } else {
        // Crear alumno
        const docRef = await addDoc(collection(db, 'educarte_alumnos'), {
          ...form,
          padresIds: [],
          deleted: false,
          createdAt: new Date(),
        });

        // Generar cobros retroactivos desde fecha de ingreso hasta mes actual
        const fechaIngreso = new Date(form.fechaIngreso + 'T12:00:00');
        const hoy = new Date();
        const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        let cursor = new Date(fechaIngreso.getFullYear(), fechaIngreso.getMonth(), 1);
        const cobrosGenerados: number[] = [];

        while (cursor <= mesActual) {
          const mes = cursor.toISOString().slice(0, 7);
          const fechaVencimiento = new Date(cursor.getFullYear(), cursor.getMonth(), form.diaCicloPago);
          const estado: Pago['estado'] = hoy > fechaVencimiento ? 'vencido' : 'pendiente';

          await addDoc(collection(db, 'educarte_pagos'), {
            alumnoId: docRef.id,
            alumnoNombre: form.nombre,
            mes,
            monto: form.montoPago,
            montoPagado: 0,
            estado,
            deleted: false,
            createdAt: new Date(),
          });

          cobrosGenerados.push(cursor.getMonth());
          cursor.setMonth(cursor.getMonth() + 1);
        }

        toast.success(`Alumno registrado con ${cobrosGenerados.length} cobro(s) generado(s)`);
      }
      closeModal();
      fetchAlumnos();
    } catch (e) {
      toast.error('Error guardando alumno');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };
  const toggleEstado = async (alumno: Alumno) => {
    try {
      const nuevoEstado = alumno.estado === 'activo' ? 'inactivo' : 'activo';
      await updateDoc(doc(db, 'educarte_alumnos', alumno.id), { estado: nuevoEstado });
      toast.success(`Alumno ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'}`);
      fetchAlumnos();
    } catch (e) {
      toast.error('Error actualizando estado');
    }
  };

  const filtrados = alumnos.filter(a => {
    const matchSearch = a.nombre.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === 'todos' || a.estado === filtroEstado;
    const matchGrado = filtroGrado === 'todos' || a.grado === filtroGrado;
    return matchSearch && matchEstado && matchGrado;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alumnos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{alumnos.filter(a => a.estado === 'activo').length} activos</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Alumno
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar alumno..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <select
          value={filtroGrado}
          onChange={e => setFiltroGrado(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="todos">Todos los grados</option>
          {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No hay alumnos</p>
            <p className="text-sm mt-1">Registra el primer alumno con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Grado</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Ingreso</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Monto</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(alumno => (
                  <tr key={alumno.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold text-xs">
                            {alumno.nombre.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">{alumno.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{alumno.grado}</td>
                    <td className="px-5 py-3 text-gray-600">{alumno.fechaIngreso}</td>
                    <td className="px-5 py-3 text-gray-600">${alumno.montoPago?.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        alumno.estado === 'activo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {alumno.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(alumno)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleEstado(alumno)}
                          className={`p-1.5 rounded-lg transition ${
                            alumno.estado === 'activo'
                              ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                          }`}
                          title={alumno.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        >
                          {alumno.estado === 'activo' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? 'Editar Alumno' : 'Nuevo Alumno'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Nombre del alumno"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento *</label>
                  <input
                    type="date"
                    value={form.fechaNacimiento}
                    onChange={e => setForm({ ...form, fechaNacimiento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grado *</label>
                  <select
                    value={form.grado}
                    onChange={e => setForm({ ...form, grado: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Seleccionar</option>
                    {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso *</label>
                  <input
                    type="date"
                    value={form.fechaIngreso}
                    onChange={e => setForm({ ...form, fechaIngreso: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm({ ...form, estado: e.target.value as 'activo' | 'inactivo' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto mensual ($) *</label>
                  <input
                    type="number"
                    value={form.montoPago}
                    onChange={e => setForm({ ...form, montoPago: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Día de pago</label>
                  <input
                    type="number"
                    value={form.diaCicloPago}
                    onChange={e => setForm({ ...form, diaCicloPago: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min={1}
                    max={28}
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
    </div>
  );
}
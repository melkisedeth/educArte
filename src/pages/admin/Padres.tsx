import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Padre, Alumno } from '../../types';
import { Plus, Search, Edit2, X, Loader2, UserCheck, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '../../../firebase';

const initialForm = {
  nombre: '',
  cedula: '',
  telefono: '',
  email: '',
  relacion: 'padre' as 'padre' | 'madre' | 'tutor',
  alumnosIds: [] as string[],
  password: '',
};

export default function Padres() {
  const [padres, setPadres] = useState<Padre[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Padre | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [verDetalle, setVerDetalle] = useState<Padre | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [padresSnap, alumnosSnap] = await Promise.all([
        getDocs(collection(db, 'educarte_padres')),
        getDocs(collection(db, 'educarte_alumnos'))
      ]);
      setPadres(padresSnap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Padre)));
      setAlumnos(alumnosSnap.docs
        .filter(d => !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Alumno)));
    } catch (e) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (padre?: Padre) => {
    if (padre) {
      setEditando(padre);
      setForm({
        nombre: padre.nombre,
        cedula: padre.cedula,
        telefono: padre.telefono,
        email: padre.email,
        relacion: padre.relacion,
        alumnosIds: padre.alumnosIds || [],
        password: '',
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

  const toggleAlumno = (alumnoId: string) => {
    setForm(prev => ({
      ...prev,
      alumnosIds: prev.alumnosIds.includes(alumnoId)
        ? prev.alumnosIds.filter(id => id !== alumnoId)
        : [...prev.alumnosIds, alumnoId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.email || !form.cedula || !form.telefono) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }
    if (!editando && !form.password) {
      toast.error('La contraseña es requerida para nuevos padres');
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await updateDoc(doc(db, 'educarte_padres', editando.id), {
          nombre: form.nombre,
          cedula: form.cedula,
          telefono: form.telefono,
          relacion: form.relacion,
          alumnosIds: form.alumnosIds,
        });
        toast.success('Padre actualizado');
      } else {
        // Crear usuario en Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        // Guardar en Firestore
        await addDoc(collection(db, 'educarte_padres'), {
          nombre: form.nombre,
          cedula: form.cedula,
          telefono: form.telefono,
          email: form.email,
          relacion: form.relacion,
          alumnosIds: form.alumnosIds,
          uid: cred.user.uid,
          deleted: false,
          createdAt: new Date(),
        });
        // Crear documento en educarte_users con rol padre
        await import('firebase/firestore').then(({ setDoc, doc: fsDoc }) =>
          setDoc(fsDoc(db, 'educarte_users', cred.user.uid), {
            email: form.email,
            nombre: form.nombre,
            role: 'padre',
            createdAt: new Date(),
          })
        );
        toast.success('Padre registrado con acceso al portal');
      }
      closeModal();
      fetchData();
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        toast.error('Este correo ya está registrado');
      } else {
        toast.error('Error guardando padre');
        console.error(e);
      }
    } finally {
      setSaving(false);
    }
  };

  const filtrados = padres.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.cedula.includes(search)
  );

  const getNombreAlumnos = (ids: string[]) =>
    ids.map(id => alumnos.find(a => a.id === id)?.nombre || '').filter(Boolean).join(', ');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Padres / Tutores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{padres.length} registrados</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Padre
        </button>
      </div>

      {/* Búsqueda */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o cédula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No hay padres registrados</p>
            <p className="text-sm mt-1">Registra el primer padre con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Cédula</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Teléfono</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Relación</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Hijos</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(padre => (
                  <tr key={padre.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-semibold text-xs">
                            {padre.nombre.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{padre.nombre}</p>
                          <p className="text-xs text-gray-400">{padre.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{padre.cedula}</td>
                    <td className="px-5 py-3 text-gray-600">{padre.telefono}</td>
                    <td className="px-5 py-3">
                      <span className="capitalize text-gray-600">{padre.relacion}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 max-w-[200px] truncate">
                      {getNombreAlumnos(padre.alumnosIds) || <span className="text-gray-400 italic">Sin hijos asignados</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setVerDetalle(padre)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openModal(padre)}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? 'Editar Padre/Tutor' : 'Nuevo Padre/Tutor'}
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
                  placeholder="Nombre completo"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cédula / ID *</label>
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={e => setForm({ ...form, cedula: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Número de cédula"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Teléfono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="correo@ejemplo.com"
                    disabled={!!editando}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relación</label>
                  <select
                    value={form.relacion}
                    onChange={e => setForm({ ...form, relacion: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="padre">Padre</option>
                    <option value="madre">Madre</option>
                    <option value="tutor">Tutor</option>
                  </select>
                </div>
              </div>

              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña temporal *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                </div>
              )}

              {/* Alumnos vinculados */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hijos vinculados</label>
                {alumnos.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No hay alumnos registrados aún</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {alumnos.filter(a => a.estado === 'activo').map(alumno => (
                      <label key={alumno.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={form.alumnosIds.includes(alumno.id)}
                          onChange={() => toggleAlumno(alumno.id)}
                          className="rounded text-primary-500"
                        />
                        <span className="text-sm text-gray-700">{alumno.nombre}</span>
                        <span className="text-xs text-gray-400">({alumno.grado})</span>
                      </label>
                    ))}
                  </div>
                )}
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

      {/* Modal Detalle */}
      {verDetalle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Detalle del Padre</h2>
              <button onClick={() => setVerDetalle(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-xl">{verDetalle.nombre.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-lg">{verDetalle.nombre}</p>
                  <p className="text-sm text-gray-500 capitalize">{verDetalle.relacion}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Correo</p>
                  <p className="font-medium text-gray-800">{verDetalle.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Cédula</p>
                  <p className="font-medium text-gray-800">{verDetalle.cedula}</p>
                </div>
                <div>
                  <p className="text-gray-500">Teléfono</p>
                  <p className="font-medium text-gray-800">{verDetalle.telefono}</p>
                </div>
                <div>
                  <p className="text-gray-500">Hijos registrados</p>
                  <p className="font-medium text-gray-800">{verDetalle.alumnosIds?.length || 0}</p>
                </div>
              </div>
              {verDetalle.alumnosIds?.length > 0 && (
                <div>
                  <p className="text-gray-500 text-sm mb-2">Hijos vinculados:</p>
                  <div className="space-y-1">
                    {verDetalle.alumnosIds.map(id => {
                      const alumno = alumnos.find(a => a.id === id);
                      return alumno ? (
                        <div key={id} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg">
                          <UserCheck className="w-4 h-4 text-primary-500" />
                          <span className="text-gray-700">{alumno.nombre}</span>
                          <span className="text-gray-400">· {alumno.grado}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
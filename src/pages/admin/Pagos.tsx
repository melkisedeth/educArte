import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Pago, Alumno } from '../../types';
import { Plus, Search, X, Loader2, CheckCircle, Clock, AlertTriangle, DollarSign, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../firebase';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const getMesActual = () => new Date().toISOString().slice(0, 7);

const estadoConfig: Record<string, { label: string; color: string; icon: any }> = {
  pagado: { label: 'Pagado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  vencido: { label: 'Vencido', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  parcial: { label: 'Parcial', color: 'bg-blue-100 text-blue-700', icon: DollarSign },
};

const initialForm = {
  alumnoId: '',
  mes: getMesActual(),
  monto: 0,
  montoPagado: 0,
  estado: 'pendiente' as Pago['estado'],
  medioPago: 'efectivo' as Pago['medioPago'],
  referencia: '',
  fechaPago: new Date().toISOString().split('T')[0],
  descuento: 0,
  justificacionDescuento: '',
};

export default function Pagos() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroMes, setFiltroMes] = useState(getMesActual());
  const [vistaDeudas, setVistaDeudas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Pago | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [generando, setGenerando] = useState(false);

  useEffect(() => { fetchData(); }, [filtroMes]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const alumnosSnap = await getDocs(collection(db, 'educarte_alumnos'));
      const alumnosList = alumnosSnap.docs
        .filter(d => !d.data().deleted && d.data().estado === 'activo')
        .map(d => ({ id: d.id, ...d.data() } as Alumno));
      setAlumnos(alumnosList);

      const pagosSnap = await getDocs(collection(db, 'educarte_pagos'));
      const pagosList = pagosSnap.docs
        .filter(d => !d.data().deleted)
        .map(d => {
          const p = { id: d.id, ...d.data() } as Pago;
          p.alumnoNombre = alumnosList.find(a => a.id === p.alumnoId)?.nombre || p.alumnoNombre || 'Desconocido';
          return p;
        });
      setPagos(pagosList);
    } catch (e) {
      toast.error('Error cargando pagos');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generarPagosMes = async () => {
    setGenerando(true);
    try {
      const pagosMes = pagos.filter(p => p.mes === filtroMes);
      const pagosExistentes = pagosMes.map(p => p.alumnoId);
      const alumnosSinPago = alumnos.filter(a => !pagosExistentes.includes(a.id));
      if (alumnosSinPago.length === 0) {
        toast('Todos los alumnos ya tienen cobro este mes', { icon: 'ℹ️' });
        setGenerando(false);
        return;
      }
      const hoy = new Date();
      for (const alumno of alumnosSinPago) {
        const [anio, mes] = filtroMes.split('-').map(Number);
        const fechaVencimiento = new Date(anio, mes - 1, alumno.diaCicloPago);
        const estado: Pago['estado'] = hoy > fechaVencimiento ? 'vencido' : 'pendiente';
        await addDoc(collection(db, 'educarte_pagos'), {
          alumnoId: alumno.id,
          alumnoNombre: alumno.nombre,
          mes: filtroMes,
          monto: alumno.montoPago,
          montoPagado: 0,
          estado,
          deleted: false,
          createdAt: new Date(),
        });
      }
      toast.success(`${alumnosSinPago.length} cobros generados`);
      fetchData();
    } catch (e) {
      toast.error('Error generando pagos');
    } finally {
      setGenerando(false);
    }
  };

  const openModal = (pago?: Pago) => {
    if (pago) {
      setEditando(pago);
      setForm({
        alumnoId: pago.alumnoId,
        mes: pago.mes,
        monto: pago.monto,
        montoPagado: pago.montoPagado,
        estado: pago.estado,
        medioPago: pago.medioPago || 'efectivo',
        referencia: pago.referencia || '',
        fechaPago: pago.fechaPago || new Date().toISOString().split('T')[0],
        descuento: pago.descuento || 0,
        justificacionDescuento: pago.justificacionDescuento || '',
      });
    } else {
      setEditando(null);
      setForm({ ...initialForm, mes: filtroMes });
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
    setSaving(true);
    try {
      const montoFinal = form.monto - (form.descuento || 0);
      let estado: Pago['estado'] = form.estado;
      if (form.montoPagado >= montoFinal) estado = 'pagado';
      else if (form.montoPagado > 0) estado = 'parcial';

      const data = {
        ...form,
        monto: montoFinal,
        estado,
        alumnoNombre: alumnos.find(a => a.id === form.alumnoId)?.nombre || editando?.alumnoNombre || '',
      };

      if (editando) {
        await updateDoc(doc(db, 'educarte_pagos', editando.id), data);
        toast.success('Pago actualizado');
      } else {
        await addDoc(collection(db, 'educarte_pagos'), {
          ...data,
          deleted: false,
          createdAt: new Date(),
        });
        toast.success('Pago registrado');
      }
      closeModal();
      fetchData();
    } catch (e) {
      toast.error('Error guardando pago');
    } finally {
      setSaving(false);
    }
  };

  // Pagos del mes seleccionado
  const pagosMesFiltrados = pagos
    .filter(p => p.mes === filtroMes)
    .filter(p => {
      const matchSearch = (p.alumnoNombre || '').toLowerCase().includes(search.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
      return matchSearch && matchEstado;
    });

  // Deudas: todos los pagos vencidos o parciales
  const deudasFiltradas = pagos
    .filter(p => p.estado === 'vencido' || p.estado === 'parcial')
    .filter(p => (p.alumnoNombre || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // Agrupar deudas por alumno
  const deudasPorAlumno = deudasFiltradas.reduce((acc, pago) => {
    if (!acc[pago.alumnoId]) {
      acc[pago.alumnoId] = {
        nombre: pago.alumnoNombre || '',
        pagos: [],
        totalDeuda: 0,
      };
    }
    acc[pago.alumnoId].pagos.push(pago);
    acc[pago.alumnoId].totalDeuda += pago.monto - (pago.montoPagado || 0);
    return acc;
  }, {} as Record<string, { nombre: string; pagos: Pago[]; totalDeuda: number }>);

  const totalMes = pagosMesFiltrados.reduce((s, p) => s + (p.monto || 0), 0);
  const totalCobrado = pagosMesFiltrados.reduce((s, p) => s + (p.montoPagado || 0), 0);
  const totalDeudaGlobal = deudasFiltradas.reduce((s, p) => s + (p.monto - (p.montoPagado || 0)), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagos.length} registros totales</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={generarPagosMes}
            disabled={generando || vistaDeudas}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            Generar cobros del mes
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Registrar Pago
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setVistaDeudas(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            !vistaDeudas ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Por mes
        </button>
        <button
          onClick={() => setVistaDeudas(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            vistaDeudas ? 'bg-red-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Deudas pendientes
          {deudasFiltradas.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${vistaDeudas ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>
              {Object.keys(deudasPorAlumno).length}
            </span>
          )}
        </button>
      </div>

      {!vistaDeudas ? (
        <>
          {/* Resumen mes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total a cobrar', value: totalMes, color: 'text-gray-800' },
              { label: 'Cobrado', value: totalCobrado, color: 'text-green-600' },
              { label: 'Pendiente', value: totalMes - totalCobrado, color: 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>${value.toLocaleString()}</p>
              </div>
            ))}
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
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const val = d.toISOString().slice(0, 7);
                return <option key={val} value={val}>{MESES[d.getMonth()]} {d.getFullYear()}</option>;
              })}
            </select>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="vencido">Vencido</option>
              <option value="parcial">Parcial</option>
            </select>
          </div>

          {/* Tabla mes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : pagosMesFiltrados.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg font-medium">No hay pagos este mes</p>
                <p className="text-sm mt-1">Usa "Generar cobros del mes" para crearlos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Alumno</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Monto</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Pagado</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Saldo</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Medio</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-600">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagosMesFiltrados.map(pago => {
                      const cfg = estadoConfig[pago.estado];
                      const Icon = cfg.icon;
                      const saldo = pago.monto - (pago.montoPagado || 0);
                      return (
                        <tr key={pago.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3 font-medium text-gray-800">{pago.alumnoNombre}</td>
                          <td className="px-5 py-3 text-gray-800 font-medium">${pago.monto?.toLocaleString()}</td>
                          <td className="px-5 py-3 text-green-600 font-medium">${(pago.montoPagado || 0).toLocaleString()}</td>
                          <td className="px-5 py-3">
                            {saldo > 0
                              ? <span className="text-red-600 font-semibold">${saldo.toLocaleString()}</span>
                              : <span className="text-green-600">—</span>
                            }
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 capitalize">{pago.medioPago || '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => openModal(pago)}
                              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                            >
                              {pago.estado === 'pagado' ? 'Ver' : 'Registrar pago'}
                            </button>
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
      ) : (
        <>
          {/* Vista Deudas */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-red-800">Deuda total acumulada</p>
              <p className="text-2xl font-bold text-red-600">${totalDeudaGlobal.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-red-600">{Object.keys(deudasPorAlumno).length} alumnos con deuda</p>
              <p className="text-sm text-red-600">{deudasFiltradas.length} cobros pendientes</p>
            </div>
          </div>

          {/* Búsqueda deudas */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="relative max-w-sm">
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

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : Object.keys(deudasPorAlumno).length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-800 text-lg">¡Sin deudas pendientes!</p>
              <p className="text-green-600 text-sm mt-1">Todos los alumnos están al día.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(deudasPorAlumno).map(([alumnoId, data]) => (
                <div key={alumnoId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Alumno header */}
                  <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-red-200 rounded-full flex items-center justify-center">
                        <span className="text-red-700 font-bold text-sm">{data.nombre.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{data.nombre}</p>
                        <p className="text-xs text-red-600">{data.pagos.length} mes(es) pendiente(s)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Deuda total</p>
                      <p className="text-xl font-bold text-red-600">${data.totalDeuda.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Meses vencidos */}
                  <div className="divide-y divide-gray-50">
                    {data.pagos.map(pago => {
                      const [anio, mes] = pago.mes.split('-');
                      const saldo = pago.monto - (pago.montoPagado || 0);
                      const cfg = estadoConfig[pago.estado];
                      const Icon = cfg.icon;
                      return (
                        <div key={pago.id} className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {MESES[parseInt(mes) - 1]} {anio}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                              <span>Total: ${pago.monto.toLocaleString()}</span>
                              {pago.montoPagado > 0 && <span className="text-green-600">Abonado: ${pago.montoPagado.toLocaleString()}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Saldo</p>
                              <p className="font-bold text-red-600">${saldo.toLocaleString()}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                            <button
                              onClick={() => openModal(pago)}
                              className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium transition"
                            >
                              Registrar pago
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? `Pago — ${editando.alumnoNombre}` : 'Registrar Pago'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {editando && (
                <div className="bg-gray-50 rounded-lg px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Alumno</p>
                    <p className="font-semibold text-gray-800">{editando.alumnoNombre}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Mes</p>
                    <p className="font-semibold text-gray-800">
                      {MESES[parseInt(editando.mes.split('-')[1]) - 1]} {editando.mes.split('-')[0]}
                    </p>
                  </div>
                </div>
              )}

              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alumno *</label>
                  <select
                    value={form.alumnoId}
                    onChange={e => {
                      const alumno = alumnos.find(a => a.id === e.target.value);
                      setForm({ ...form, alumnoId: e.target.value, monto: alumno?.montoPago || 0 });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Seleccionar alumno</option>
                    {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto total ($)</label>
                  <input type="number" value={form.monto}
                    onChange={e => setForm({ ...form, monto: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descuento ($)</label>
                  <input type="number" value={form.descuento}
                    onChange={e => setForm({ ...form, descuento: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" min={0} />
                </div>
              </div>

              {form.descuento > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Justificación del descuento</label>
                  <input type="text" value={form.justificacionDescuento}
                    onChange={e => setForm({ ...form, justificacionDescuento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Motivo del descuento" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto pagado ($)</label>
                  <input type="number" value={form.montoPagado}
                    onChange={e => setForm({ ...form, montoPagado: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
                  <input type="date" value={form.fechaPago}
                    onChange={e => setForm({ ...form, fechaPago: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medio de pago</label>
                  <select value={form.medioPago}
                    onChange={e => setForm({ ...form, medioPago: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                  <input type="text" value={form.referencia}
                    onChange={e => setForm({ ...form, referencia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="N° de referencia" />
                </div>
              </div>

              {form.montoPagado > 0 && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
                  Saldo pendiente: <strong>${Math.max(0, (form.monto - form.descuento) - form.montoPagado).toLocaleString()}</strong>
                  {form.montoPagado >= (form.monto - form.descuento) && (
                    <span className="ml-2 text-green-600 font-semibold">✓ Pago completo</span>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
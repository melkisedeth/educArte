import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Pago, Alumno } from '../../types';
import {
  Plus, Search, X, Loader2, CheckCircle, Clock, AlertTriangle,
  DollarSign, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../../firebase';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const estadoConfig: Record<string, { label: string; color: string; icon: any }> = {
  pagado:   { label: 'Pagado',   color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  pendiente:{ label: 'Pendiente',color: 'bg-yellow-100 text-yellow-700',icon: Clock },
  vencido:  { label: 'Vencido',  color: 'bg-red-100 text-red-700',      icon: AlertTriangle },
  parcial:  { label: 'Parcial',  color: 'bg-blue-100 text-blue-700',    icon: DollarSign },
};

// Determina si un pago debería estar vencido según la fecha actual
const debeEstarVencido = (mes: string, diaCicloPago: number): boolean => {
  const [anio, mesNum] = mes.split('-').map(Number);
  const fechaVenc = new Date(anio, mesNum - 1, diaCicloPago);
  return new Date() > fechaVenc;
};

// Calcula el estado correcto de un pago
const calcularEstado = (pago: Pago, alumno?: Alumno): Pago['estado'] => {
  const monto = pago.monto || 0;
  const pagado = pago.montoPagado || 0;
  if (pagado >= monto) return 'pagado';
  if (pagado > 0) return 'parcial';
  const dia = alumno?.diaCicloPago ?? 28;
  if (debeEstarVencido(pago.mes, dia)) return 'vencido';
  return 'pendiente';
};

const getMesActual = () => new Date().toISOString().slice(0, 7);

export default function Pagos() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroMes, setFiltroMes] = useState(getMesActual());
  const [vistaDeudas, setVistaDeudas] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Pago | null>(null);
  const [saving, setSaving] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  // Form para el modal de pago/abono
  const [formAbono, setFormAbono] = useState({
    montoPagado: 0,
    medioPago: 'efectivo' as Pago['medioPago'],
    referencia: '',
    fechaPago: new Date().toISOString().split('T')[0],
    descuento: 0,
    justificacionDescuento: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const alumnosSnap = await getDocs(collection(db, 'educarte_alumnos'));
      const alumnosList = alumnosSnap.docs
        .filter(d => !d.data().deleted)
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
    } catch {
      toast.error('Error cargando pagos');
    } finally {
      setLoading(false);
    }
  };

  // Actualiza el estado de todos los pagos según la fecha actual
  const actualizarEstados = async () => {
    setActualizando(true);
    try {
      let actualizados = 0;
      for (const pago of pagos) {
        if (pago.estado === 'pagado') continue;
        const alumno = alumnos.find(a => a.id === pago.alumnoId);
        const estadoCorrecto = calcularEstado(pago, alumno);
        if (estadoCorrecto !== pago.estado) {
          await updateDoc(doc(db, 'educarte_pagos', pago.id), { estado: estadoCorrecto });
          actualizados++;
        }
      }
      if (actualizados > 0) {
        toast.success(`${actualizados} pago(s) actualizados a vencido`);
        fetchData();
      } else {
        toast('Todos los estados están al día', { icon: 'ℹ️' });
      }
    } catch {
      toast.error('Error actualizando estados');
    } finally {
      setActualizando(false);
    }
  };

  const generarPagosMes = async () => {
    setGenerando(true);
    try {
      const pagosMes = pagos.filter(p => p.mes === filtroMes);
      const alumnosConPago = new Set(pagosMes.map(p => p.alumnoId));
      const alumnosSin = alumnos.filter(a => a.estado === 'activo' && !alumnosConPago.has(a.id));

      if (alumnosSin.length === 0) {
        toast('Todos los alumnos activos ya tienen cobro este mes', { icon: 'ℹ️' });
        setGenerando(false);
        return;
      }

      const hoy = new Date();
      for (const alumno of alumnosSin) {
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
      toast.success(`${alumnosSin.length} cobros generados para ${MESES[parseInt(filtroMes.split('-')[1]) - 1]}`);
      fetchData();
    } catch {
      toast.error('Error generando pagos');
    } finally {
      setGenerando(false);
    }
  };

  const openModal = (pago: Pago) => {
    setEditando(pago);
    setFormAbono({
      montoPagado: pago.montoPagado || 0,
      medioPago: pago.medioPago || 'efectivo',
      referencia: pago.referencia || '',
      fechaPago: pago.fechaPago || new Date().toISOString().split('T')[0],
      descuento: pago.descuento || 0,
      justificacionDescuento: pago.justificacionDescuento || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditando(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setSaving(true);
    try {
      const montoConDescuento = editando.monto - (formAbono.descuento || 0);
      let estado: Pago['estado'];
      if (formAbono.montoPagado >= montoConDescuento) {
        estado = 'pagado';
      } else if (formAbono.montoPagado > 0) {
        estado = 'parcial';
      } else {
        const alumno = alumnos.find(a => a.id === editando.alumnoId);
        estado = calcularEstado(editando, alumno);
      }

      await updateDoc(doc(db, 'educarte_pagos', editando.id), {
        montoPagado: formAbono.montoPagado,
        medioPago: formAbono.medioPago,
        referencia: formAbono.referencia,
        fechaPago: formAbono.fechaPago,
        descuento: formAbono.descuento,
        justificacionDescuento: formAbono.justificacionDescuento,
        estado,
      });

      toast.success(estado === 'pagado' ? '✓ Pago completo registrado' : 'Abono registrado');
      closeModal();
      fetchData();
    } catch {
      toast.error('Error guardando pago');
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (alumnoId: string) =>
    setExpandidos(prev => ({ ...prev, [alumnoId]: !prev[alumnoId] }));

  // Pagos del mes seleccionado con filtros
  const pagosMesFiltrados = pagos
    .filter(p => p.mes === filtroMes)
    .filter(p => {
      const matchSearch = (p.alumnoNombre || '').toLowerCase().includes(search.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
      return matchSearch && matchEstado;
    })
    .sort((a, b) => (a.alumnoNombre || '').localeCompare(b.alumnoNombre || ''));

  // Deudas: vencidos + parciales (todos los meses)
  const deudasTodas = pagos
    .filter(p => p.estado === 'vencido' || p.estado === 'parcial')
    .filter(p => (p.alumnoNombre || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // Agrupar deudas por alumno
  const deudasPorAlumno = deudasTodas.reduce((acc, pago) => {
    if (!acc[pago.alumnoId]) {
      acc[pago.alumnoId] = { nombre: pago.alumnoNombre || '', pagos: [], totalDeuda: 0 };
    }
    acc[pago.alumnoId].pagos.push(pago);
    acc[pago.alumnoId].totalDeuda += pago.monto - (pago.montoPagado || 0);
    return acc;
  }, {} as Record<string, { nombre: string; pagos: Pago[]; totalDeuda: number }>);

  const totalMes = pagosMesFiltrados.reduce((s, p) => s + (p.monto || 0), 0);
  const totalCobradoMes = pagosMesFiltrados.reduce((s, p) => s + (p.montoPagado || 0), 0);
  const totalDeudaGlobal = deudasTodas.reduce((s, p) => s + (p.monto - (p.montoPagado || 0)), 0);
  const totalAlumnosDeuda = Object.keys(deudasPorAlumno).length;

  // Opciones de meses (12 meses atrás + 1 adelante)
  const opcionesMeses = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12 + i);
    const val = d.toISOString().slice(0, 7);
    return { val, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` };
  });

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
            onClick={actualizarEstados}
            disabled={actualizando}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            title="Marca como vencidos los pagos cuya fecha ya pasó"
          >
            {actualizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Actualizar vencidos
          </button>
          {!vistaDeudas && (
            <button
              onClick={generarPagosMes}
              disabled={generando}
              className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generar cobros del mes
            </button>
          )}
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
          Deudas vencidas
          {totalAlumnosDeuda > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              vistaDeudas ? 'bg-white text-red-500' : 'bg-red-500 text-white'
            }`}>
              {totalAlumnosDeuda}
            </span>
          )}
        </button>
      </div>

      {!vistaDeudas ? (
        <>
          {/* Resumen del mes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total a cobrar', value: totalMes, color: 'text-gray-800' },
              { label: 'Cobrado', value: totalCobradoMes, color: 'text-green-600' },
              { label: 'Pendiente', value: totalMes - totalCobradoMes, color: 'text-red-500' },
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
              {opcionesMeses.map(({ val, label }) => (
                <option key={val} value={val}>{label}</option>
              ))}
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

          {/* Tabla del mes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : pagosMesFiltrados.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg font-medium">No hay cobros este mes</p>
                <p className="text-sm mt-1">Usa "Generar cobros del mes" para crearlos automáticamente</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Alumno</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Monto</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Abonado</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Saldo</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Medio / Ref.</th>
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
                          <td className="px-5 py-3 text-gray-700">${pago.monto?.toLocaleString()}</td>
                          <td className="px-5 py-3 text-green-600 font-medium">
                            ${(pago.montoPagado || 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3">
                            {saldo > 0
                              ? <span className="text-red-600 font-semibold">${saldo.toLocaleString()}</span>
                              : <span className="text-green-500">—</span>
                            }
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">
                            {pago.medioPago && <span className="capitalize">{pago.medioPago}</span>}
                            {pago.referencia && <span className="ml-1 text-gray-400">#{pago.referencia}</span>}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => openModal(pago)}
                              className={`text-sm font-medium transition ${
                                pago.estado === 'pagado'
                                  ? 'text-gray-400 hover:text-gray-600'
                                  : 'text-primary-600 hover:text-primary-700'
                              }`}
                            >
                              {pago.estado === 'pagado' ? 'Ver' : 'Registrar pago →'}
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
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-red-800">Deuda total acumulada</p>
              <p className="text-3xl font-bold text-red-600">${totalDeudaGlobal.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-red-600">{totalAlumnosDeuda} alumno(s) con deuda</p>
              <p className="text-sm text-red-600">{deudasTodas.length} cobro(s) pendiente(s)</p>
            </div>
          </div>

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
          ) : totalAlumnosDeuda === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-800 text-lg">¡Sin deudas pendientes!</p>
              <p className="text-green-600 text-sm mt-1">Todos los alumnos están al día.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(deudasPorAlumno).map(([alumnoId, data]) => {
                const expanded = expandidos[alumnoId] !== false; // abierto por defecto
                return (
                  <div key={alumnoId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Cabecera alumno */}
                    <button
                      onClick={() => toggleExpand(alumnoId)}
                      className="w-full px-5 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between hover:bg-red-100 transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-200 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-red-700 font-bold text-sm">
                            {data.nombre.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{data.nombre}</p>
                          <p className="text-xs text-red-600">{data.pagos.length} mes(es) pendiente(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Deuda total</p>
                          <p className="text-xl font-bold text-red-600">${data.totalDeuda.toLocaleString()}</p>
                        </div>
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {/* Meses vencidos */}
                    {expanded && (
                      <div className="divide-y divide-gray-50">
                        {data.pagos.map(pago => {
                          const [anio, mes] = pago.mes.split('-');
                          const saldo = pago.monto - (pago.montoPagado || 0);
                          const cfg = estadoConfig[pago.estado];
                          const Icon = cfg.icon;
                          return (
                            <div key={pago.id} className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-700">
                                  {MESES[parseInt(mes) - 1]} {anio}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                  <span>Total: ${pago.monto.toLocaleString()}</span>
                                  {(pago.montoPagado || 0) > 0 && (
                                    <span className="text-green-600">
                                      Abonado: ${(pago.montoPagado || 0).toLocaleString()}
                                    </span>
                                  )}
                                  {(pago.descuento || 0) > 0 && (
                                    <span className="text-blue-600">
                                      Descuento: ${(pago.descuento || 0).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                                  <Icon className="w-3 h-3" />
                                  {cfg.label}
                                </span>
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">Saldo</p>
                                  <p className="font-bold text-red-600">${saldo.toLocaleString()}</p>
                                </div>
                                <button
                                  onClick={() => openModal(pago)}
                                  className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium transition"
                                >
                                  Abonar / Pagar →
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Registrar Pago / Abono */}
      {modalOpen && editando && (() => {
        const alumno = alumnos.find(a => a.id === editando.alumnoId);
        const [anio, mes] = editando.mes.split('-');
        const montoConDescuento = editando.monto - (formAbono.descuento || 0);
        const saldoActual = montoConDescuento - (formAbono.montoPagado || 0);
        const esPagado = formAbono.montoPagado >= montoConDescuento;

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{editando.alumnoNombre}</h2>
                  <p className="text-sm text-gray-500">{MESES[parseInt(mes) - 1]} {anio}</p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {/* Resumen del cobro */}
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Cobro original</p>
                    <p className="font-bold text-gray-700">${editando.monto.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Ya abonado</p>
                    <p className="font-bold text-green-600">${(editando.montoPagado || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Saldo previo</p>
                    <p className="font-bold text-red-500">
                      ${(editando.monto - (editando.montoPagado || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Descuento */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descuento ($)</label>
                    <input
                      type="number"
                      value={formAbono.descuento}
                      onChange={e => setFormAbono({ ...formAbono, descuento: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min={0}
                      max={editando.monto}
                    />
                  </div>
                  {formAbono.descuento > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del descuento</label>
                      <input
                        type="text"
                        value={formAbono.justificacionDescuento}
                        onChange={e => setFormAbono({ ...formAbono, justificacionDescuento: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ej: Beca, acuerdo especial..."
                      />
                    </div>
                  )}
                </div>

                {/* Monto total abonado acumulado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total abonado acumulado ($)
                    <span className="text-gray-400 font-normal ml-1">— incluye pagos anteriores</span>
                  </label>
                  <input
                    type="number"
                    value={formAbono.montoPagado}
                    onChange={e => setFormAbono({ ...formAbono, montoPagado: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min={0}
                    max={montoConDescuento}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Para registrar un abono de hoy, suma al valor anterior.
                    El máximo es ${montoConDescuento.toLocaleString()}.
                  </p>
                </div>

                {/* Desglose en tiempo real */}
                <div className={`rounded-xl px-4 py-3 text-sm ${
                  esPagado ? 'bg-green-50 border border-green-200' : 'bg-blue-50'
                }`}>
                  <div className="flex justify-between">
                    <span className={esPagado ? 'text-green-700' : 'text-blue-700'}>
                      {esPagado ? '✓ Pago completo' : 'Saldo pendiente'}
                    </span>
                    <span className={`font-bold ${esPagado ? 'text-green-700' : 'text-blue-700'}`}>
                      ${Math.max(0, saldoActual).toLocaleString()}
                    </span>
                  </div>
                  {formAbono.descuento > 0 && (
                    <p className="text-xs mt-1 text-blue-600">
                      Monto con descuento: ${montoConDescuento.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Medio y fecha */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medio de pago</label>
                    <select
                      value={formAbono.medioPago}
                      onChange={e => setFormAbono({ ...formAbono, medioPago: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
                    <input
                      type="date"
                      value={formAbono.fechaPago}
                      onChange={e => setFormAbono({ ...formAbono, fechaPago: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / Comprobante</label>
                  <input
                    type="text"
                    value={formAbono.referencia}
                    onChange={e => setFormAbono({ ...formAbono, referencia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="N° de transferencia, recibo, etc."
                  />
                </div>

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
        );
      })()}
    </div>
  );
}
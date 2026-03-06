import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Pago, Alumno } from '../../types';
import { CreditCard, CheckCircle, Clock, AlertTriangle, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../../firebase';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const estadoConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pagado: { label: 'Pagado', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  pendiente: { label: 'Pendiente', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock },
  vencido: { label: 'Vencido', color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
  parcial: { label: 'Parcial', color: 'text-blue-700', bg: 'bg-blue-100', icon: DollarSign },
};

export default function PortalPagos() {
  const { user } = useAuth();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [filtroAlumno, setFiltroAlumno] = useState('todos');
  const [vistaDeudas, setVistaDeudas] = useState(false);

  useEffect(() => { fetchData(); }, [user]);

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
      const alumnosList = alumnosSnap.docs
        .filter(d => alumnosIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() } as Alumno));
      setAlumnos(alumnosList);

      const pagosSnap = await getDocs(collection(db, 'educarte_pagos'));
      const pagosList = pagosSnap.docs
        .filter(d => alumnosIds.includes(d.data().alumnoId) && !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Pago))
        .sort((a, b) => b.mes.localeCompare(a.mes));
      setPagos(pagosList);

      // Expandir el mes actual por defecto
      const mesActual = new Date().toISOString().slice(0, 7);
      setExpandidos({ [mesActual]: true });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getNombreAlumno = (id: string) => alumnos.find(a => a.id === id)?.nombre || 'Alumno';

  const toggleExpandido = (mes: string) => {
    setExpandidos(prev => ({ ...prev, [mes]: !prev[mes] }));
  };

  // Filtrar por alumno
  const pagosFiltrados = pagos.filter(p =>
    filtroAlumno === 'todos' || p.alumnoId === filtroAlumno
  );

  // Deudas: vencidos y parciales
  const deudas = pagosFiltrados.filter(p => p.estado === 'vencido' || p.estado === 'parcial');
  const totalDeuda = deudas.reduce((s, p) => s + (p.monto - (p.montoPagado || 0)), 0);
  const totalPagado = pagosFiltrados.filter(p => p.estado === 'pagado').reduce((s, p) => s + (p.montoPagado || 0), 0);

  // Agrupar por mes
  const pagosPorMes = pagosFiltrados.reduce((acc, pago) => {
    if (!acc[pago.mes]) acc[pago.mes] = [];
    acc[pago.mes].push(pago);
    return acc;
  }, {} as Record<string, Pago[]>);

  const mesesOrdenados = Object.keys(pagosPorMes).sort((a, b) => b.localeCompare(a));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pagos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Historial completo de pagos</p>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total pagado</p>
          <p className="text-2xl font-bold text-green-600 mt-1">${totalPagado.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${totalDeuda > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className={`text-sm ${totalDeuda > 0 ? 'text-red-600' : 'text-gray-500'}`}>Deuda pendiente</p>
          <p className={`text-2xl font-bold mt-1 ${totalDeuda > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            ${totalDeuda.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Meses registrados</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{mesesOrdenados.length}</p>
        </div>
      </div>

      {/* Alerta deuda */}
      {totalDeuda > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Tienes pagos pendientes</p>
            <p className="text-sm text-red-600 mt-0.5">
              Deuda acumulada de <strong>${totalDeuda.toLocaleString()}</strong> en {deudas.length} cobro(s). Contacta al administrador para regularizar.
            </p>
          </div>
        </div>
      )}

      {/* Filtros y tabs */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
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
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setVistaDeudas(false)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              !vistaDeudas ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Por mes
          </button>
          <button
            onClick={() => setVistaDeudas(true)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              vistaDeudas ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Deudas
            {deudas.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${vistaDeudas ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>
                {deudas.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {pagosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16 text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay pagos registrados</p>
        </div>
      ) : !vistaDeudas ? (
        /* Vista por mes - acordeón */
        <div className="space-y-3">
          {mesesOrdenados.map(mes => {
            const pagosMes = pagosPorMes[mes];
            const [anio, m] = mes.split('-');
            const mesLabel = `${MESES[parseInt(m) - 1]} ${anio}`;
            const totalMes = pagosMes.reduce((s, p) => s + p.monto, 0);
            const pagadoMes = pagosMes.reduce((s, p) => s + (p.montoPagado || 0), 0);
            const hayDeuda = pagosMes.some(p => p.estado === 'vencido' || p.estado === 'parcial');
            const todoPagado = pagosMes.every(p => p.estado === 'pagado');
            const expandido = expandidos[mes];

            return (
              <div key={mes} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                hayDeuda ? 'border-red-200' : todoPagado ? 'border-green-200' : 'border-gray-100'
              }`}>
                {/* Header mes */}
                <button
                  onClick={() => toggleExpandido(mes)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      hayDeuda ? 'bg-red-500' : todoPagado ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <span className="font-semibold text-gray-800">{mesLabel}</span>
                    <span className="text-xs text-gray-400">{pagosMes.length} cobro(s)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">Pagado / Total</p>
                      <p className="text-sm font-semibold text-gray-700">
                        ${pagadoMes.toLocaleString()} / ${totalMes.toLocaleString()}
                      </p>
                    </div>
                    {hayDeuda && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        Deuda: ${(totalMes - pagadoMes).toLocaleString()}
                      </span>
                    )}
                    {todoPagado && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        ✓ Al día
                      </span>
                    )}
                    {expandido
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </button>

                {/* Detalle mes */}
                {expandido && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {pagosMes.map(pago => {
                      const cfg = estadoConfig[pago.estado];
                      const Icon = cfg.icon;
                      const saldo = pago.monto - (pago.montoPagado || 0);
                      return (
                        <div key={pago.id} className="px-5 py-4">
                          <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                              {alumnos.length > 1 && (
                                <p className="text-xs text-gray-400 mb-1">{getNombreAlumno(pago.alumnoId)}</p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                  <Icon className="w-3 h-3" />
                                  {cfg.label}
                                </span>
                                {pago.medioPago && (
                                  <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded-full">
                                    {pago.medioPago}
                                  </span>
                                )}
                                {pago.fechaPago && (
                                  <span className="text-xs text-gray-400">
                                    {new Date(pago.fechaPago + 'T12:00:00').toLocaleDateString('es-ES')}
                                  </span>
                                )}
                              </div>
                              {pago.referencia && (
                                <p className="text-xs text-gray-400 mt-1">Ref: {pago.referencia}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-800">${pago.monto.toLocaleString()}</p>
                              {pago.montoPagado > 0 && pago.estado !== 'pagado' && (
                                <p className="text-xs text-green-600">Abonado: ${pago.montoPagado.toLocaleString()}</p>
                              )}
                              {saldo > 0 && (
                                <p className="text-xs text-red-500 font-semibold">Saldo: ${saldo.toLocaleString()}</p>
                              )}
                              {(pago.descuento ?? 0) > 0 && (
                                <p className="text-xs text-blue-500">Descuento: ${(pago.descuento ?? 0).toLocaleString()}</p>
                              )}
                            </div>
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
      ) : (
        /* Vista deudas */
        <div className="space-y-3">
          {deudas.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-800 text-lg">¡Sin deudas!</p>
              <p className="text-green-600 text-sm mt-1">Estás al día con todos tus pagos.</p>
            </div>
          ) : (
            deudas.map(pago => {
              const cfg = estadoConfig[pago.estado];
              const Icon = cfg.icon;
              const [anio, m] = pago.mes.split('-');
              const saldo = pago.monto - (pago.montoPagado || 0);
              return (
                <div key={pago.id} className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {MESES[parseInt(m) - 1]} {anio}
                      </p>
                      {alumnos.length > 1 && (
                        <p className="text-xs text-gray-400 mt-0.5">{getNombreAlumno(pago.alumnoId)}</p>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Saldo pendiente</p>
                      <p className="text-2xl font-bold text-red-600">${saldo.toLocaleString()}</p>
                      {pago.montoPagado > 0 && (
                        <p className="text-xs text-green-600">Abonado: ${pago.montoPagado.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-red-50 border-t border-red-100">
                    <p className="text-xs text-red-600">
                      Contacta al administrador para realizar el pago de este mes.
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
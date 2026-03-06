import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Users, CreditCard, AlertTriangle, FileText, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../firebase';

interface Stats {
  totalAlumnos: number;
  alumnosActivos: number;
  ingresosMes: number;
  pagosPendientes: number;
  pagosVencidos: number;
  reportesMes: number;
}

interface PagoVencido {
  id: string;
  alumnoNombre: string;
  alumnoId: string;
  mes: string;
  monto: number;
  montoPagado: number;
  diasVencido: number;
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalAlumnos: 0,
    alumnosActivos: 0,
    ingresosMes: 0,
    pagosPendientes: 0,
    pagosVencidos: 0,
    reportesMes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pagosVencidos, setPagosVencidos] = useState<PagoVencido[]>([]);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const mesActual = new Date().toISOString().slice(0, 7);
      const hoy = new Date();

      const alumnosSnap = await getDocs(collection(db, 'educarte_alumnos'));
      const alumnosDocs = alumnosSnap.docs.filter(d => !d.data().deleted);
      const alumnosActivos = alumnosDocs.filter(d => d.data().estado === 'activo');

      const pagosSnap = await getDocs(collection(db, 'educarte_pagos'));
      const todosPagos = pagosSnap.docs.filter(d => !d.data().deleted);
      const pagosMes = todosPagos.filter(d => d.data().mes === mesActual);

      let ingresos = 0;
      let pendientes = 0;
      let vencidos = 0;
      const vencidosList: PagoVencido[] = [];

      // Buscar TODOS los pagos vencidos (no solo del mes actual)
      todosPagos.forEach(doc => {
        const p = doc.data();
        if (p.estado === 'vencido' || p.estado === 'parcial') {
          const [anio, mes] = p.mes.split('-').map(Number);
          const fechaVenc = new Date(anio, mes - 1, 28); // fin de mes
          const diffMs = hoy.getTime() - fechaVenc.getTime();
          const diasVencido = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          vencidosList.push({
            id: doc.id,
            alumnoNombre: p.alumnoNombre || 'Alumno',
            alumnoId: p.alumnoId,
            mes: p.mes,
            monto: p.monto || 0,
            montoPagado: p.montoPagado || 0,
            diasVencido: Math.max(0, diasVencido),
          });
          vencidos++;
        }
      });

      pagosMes.forEach(doc => {
        const p = doc.data();
        if (p.estado === 'pagado') ingresos += p.montoPagado || 0;
        if (p.estado === 'pendiente') pendientes++;
      });

      // Ordenar por días vencido (más antiguos primero)
      vencidosList.sort((a, b) => b.diasVencido - a.diasVencido);

      const reportesSnap = await getDocs(collection(db, 'educarte_reportes'));
      const reportes = reportesSnap.docs.filter(d => !d.data().deleted);

      setStats({
        totalAlumnos: alumnosDocs.length,
        alumnosActivos: alumnosActivos.length,
        ingresosMes: ingresos,
        pagosPendientes: pendientes,
        pagosVencidos: vencidosList.length,
        reportesMes: reportes.length,
      });
      setPagosVencidos(vencidosList);
    } catch (error) {
      console.error('Error cargando stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar vencidos por alumno
  const vencidosPorAlumno = pagosVencidos.reduce((acc, pago) => {
    if (!acc[pago.alumnoId]) {
      acc[pago.alumnoId] = {
        alumnoNombre: pago.alumnoNombre,
        alumnoId: pago.alumnoId,
        meses: [],
        totalDeuda: 0,
        maxDias: 0,
      };
    }
    acc[pago.alumnoId].meses.push(pago.mes);
    acc[pago.alumnoId].totalDeuda += pago.monto - pago.montoPagado;
    acc[pago.alumnoId].maxDias = Math.max(acc[pago.alumnoId].maxDias, pago.diasVencido);
    return acc;
  }, {} as Record<string, { alumnoNombre: string; alumnoId: string; meses: string[]; totalDeuda: number; maxDias: number }>);

  const cards = [
    { label: 'Alumnos Activos', value: stats.alumnosActivos, icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'Ingresos del Mes', value: `$${stats.ingresosMes.toLocaleString()}`, icon: TrendingUp, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
    { label: 'Pagos Pendientes', value: stats.pagosPendientes, icon: Clock, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
    { label: 'Deudas Vencidas', value: stats.pagosVencidos, icon: AlertTriangle, iconBg: 'bg-red-100', iconColor: 'text-red-600' },
    { label: 'Total Alumnos', value: stats.totalAlumnos, icon: Users, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'Reportes Generados', value: stats.reportesMes, icon: FileText, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
    </div>
  );

  const alumnosConDeuda = Object.values(vencidosPorAlumno);
  const deudaTotal = pagosVencidos.reduce((s, p) => s + (p.monto - p.montoPagado), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen deuda total */}
      {alumnosConDeuda.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-semibold text-red-800">
                {alumnosConDeuda.length} alumno{alumnosConDeuda.length > 1 ? 's' : ''} con deuda pendiente
              </p>
              <p className="text-sm text-red-600">
                Deuda total acumulada: <strong>${deudaTotal.toLocaleString()}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/pagos')}
            className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Ver pagos
          </button>
        </div>
      )}

      {/* Tabla alumnos con deuda */}
      {alumnosConDeuda.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-gray-800">Alumnos con Deudas Vencidas</h2>
            </div>
            <span className="text-xs text-gray-400">{alumnosConDeuda.length} alumnos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Alumno</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Meses vencidos</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Deuda total</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Antigüedad</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alumnosConDeuda.map(alumno => (
                  <tr key={alumno.alumnoId} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-red-600 font-semibold text-xs">
                            {alumno.alumnoNombre.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">{alumno.alumnoNombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {alumno.meses.map(mes => {
                          const [anio, m] = mes.split('-');
                          return (
                            <span key={mes} className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                              {MESES[parseInt(m) - 1]} {anio}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-bold text-red-600">${alumno.totalDeuda.toLocaleString()}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        alumno.maxDias > 60 ? 'bg-red-100 text-red-700' :
                        alumno.maxDias > 30 ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {alumno.maxDias > 0 ? `+${alumno.maxDias} días` : 'Reciente'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => navigate('/pagos')}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Gestionar →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Todo al día */}
      {alumnosConDeuda.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-medium text-green-800">¡Todo al día!</p>
            <p className="text-sm text-green-600">No hay pagos vencidos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
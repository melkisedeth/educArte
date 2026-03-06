import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Reporte, Alumno } from '../../types';
import { FileText, X } from 'lucide-react';
import { db } from '../../../firebase';

export default function PortalReportes() {
  const { user } = useAuth();
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [verDetalle, setVerDetalle] = useState<Reporte | null>(null);

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
      setAlumnos(alumnosSnap.docs
        .filter(d => alumnosIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() } as Alumno)));

      const reportesSnap = await getDocs(collection(db, 'educarte_reportes'));
      setReportes(reportesSnap.docs
        .filter(d => alumnosIds.includes(d.data().alumnoId) && !d.data().deleted)
        .map(d => ({ id: d.id, ...d.data() } as Reporte)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getNombreAlumno = (id: string) => alumnos.find(a => a.id === id)?.nombre || 'Alumno';
  const formatFecha = (fecha: any) => {
    if (!fecha) return '—';
    if (fecha?.toDate) return fecha.toDate().toLocaleDateString('es-ES');
    return new Date(fecha).toLocaleDateString('es-ES');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes Académicos</h1>
        <p className="text-sm text-gray-500 mt-0.5">{reportes.length} reportes disponibles</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : reportes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay reportes disponibles</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {reportes.map(reporte => (
              <div key={reporte.id} className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{getNombreAlumno(reporte.alumnoId)}</p>
                    <p className="text-sm text-gray-500">{reporte.periodo}</p>
                    <p className="text-xs text-gray-400">{formatFecha(reporte.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {reporte.calificacion && (
                    <span className="bg-primary-50 text-primary-700 text-sm font-semibold px-3 py-1 rounded-full">
                      {reporte.calificacion}
                    </span>
                  )}
                  <button
                    onClick={() => setVerDetalle(reporte)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {verDetalle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Reporte Académico</h2>
              <button onClick={() => setVerDetalle(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Alumno</p>
                  <p className="font-bold text-gray-800 text-lg">{getNombreAlumno(verDetalle.alumnoId)}</p>
                </div>
                {verDetalle.calificacion && (
                  <span className="bg-primary-50 text-primary-700 font-bold px-4 py-1.5 rounded-full">
                    {verDetalle.calificacion}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400 text-xs uppercase">Período</p><p className="font-medium text-gray-800">{verDetalle.periodo}</p></div>
                <div><p className="text-gray-400 text-xs uppercase">Materias</p><p className="font-medium text-gray-800">{verDetalle.materias || '—'}</p></div>
              </div>
              <div><p className="text-gray-400 text-xs uppercase mb-1">Desempeño</p><p className="text-gray-700 text-sm bg-gray-50 rounded-lg p-3">{verDetalle.desempeno}</p></div>
              {verDetalle.fortalezas && <div><p className="text-gray-400 text-xs uppercase mb-1">Fortalezas</p><p className="text-gray-700 text-sm bg-green-50 rounded-lg p-3">{verDetalle.fortalezas}</p></div>}
              {verDetalle.areasMejora && <div><p className="text-gray-400 text-xs uppercase mb-1">Áreas de mejora</p><p className="text-gray-700 text-sm bg-yellow-50 rounded-lg p-3">{verDetalle.areasMejora}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
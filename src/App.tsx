import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import Alumnos from './pages/admin/Alumnos';
import Padres from './pages/admin/Padres';
import Pagos from './pages/admin/Pagos';
import Reportes from './pages/admin/Reportes';
import Asistencia from './pages/admin/Asistencia';
import Portal from './pages/padre/Portal';
import PortalPagos from './pages/padre/PortalPagos';
import PortalReportes from './pages/padre/PortalReportes';
import PortalAsistencia from './pages/padre/PortalAsistencia';
import { JSX } from 'react';
import Register from './pages/padre/Register';

function PrivateRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'admin' ? '/dashboard' : '/portal'} />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/portal" />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to={user?.role === 'admin' ? '/dashboard' : '/portal'} />} />
        <Route path="dashboard" element={<PrivateRoute roles={['admin']}><Dashboard /></PrivateRoute>} />
        <Route path="alumnos" element={<PrivateRoute roles={['admin']}><Alumnos /></PrivateRoute>} />
        <Route path="padres" element={<PrivateRoute roles={['admin']}><Padres /></PrivateRoute>} />
        <Route path="pagos" element={<PrivateRoute roles={['admin']}><Pagos /></PrivateRoute>} />
        <Route path="reportes" element={<PrivateRoute roles={['admin']}><Reportes /></PrivateRoute>} />
        <Route path="asistencia" element={<PrivateRoute roles={['admin']}><Asistencia /></PrivateRoute>} />
        <Route path="portal" element={<PrivateRoute roles={['padre']}><Portal /></PrivateRoute>} />
        <Route path="portal/pagos" element={<PrivateRoute roles={['padre']}><PortalPagos /></PrivateRoute>} />
        <Route path="portal/reportes" element={<PrivateRoute roles={['padre']}><PortalReportes /></PrivateRoute>} />
        <Route path="portal/asistencia" element={<PrivateRoute roles={['padre']}><PortalAsistencia /></PrivateRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>  {/* ← ÚNICO CAMBIO: BrowserRouter → HashRouter */}
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </HashRouter>
  );
}
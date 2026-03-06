import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { db } from '../../firebase';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
        const result = await login(email, password);
        console.log('Usuario logueado:', result);
        // Redirigir según rol
        const userDoc = await import('firebase/firestore').then(async ({ getDoc, doc }) =>
            getDoc(doc(db, 'educarte_users', (await import('firebase/auth')).getAuth().currentUser!.uid))
        );
        debugger
        const role = userDoc.data()?.role;
        if (role === 'admin') {
            navigate('/dashboard');
        } else {
            navigate('/portal');
        }
    } catch (err: any) {
        console.error('Error login:', err.code, err.message);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
            setError('Correo o contraseña incorrectos');
        } else {
            setError(`Error: ${err.message}`);
        }
    } finally {
        setLoading(false);
    }
};

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
                        <BookOpen className="w-8 h-8 text-primary-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">educArte</h1>
                    <p className="text-primary-100 mt-1">Plataforma de refuerzo académico</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciar sesión</h2>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Correo electrónico
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                                placeholder="correo@ejemplo.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition pr-10"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Ingresando...
                                </>
                            ) : (
                                'Ingresar'
                            )}
                        </button>
                    </form>
                </div>
                <p className="text-center text-primary-100 text-sm mt-6">
                    ¿No tienes cuenta?{' '}
                    <Link to="/register" className="text-white font-semibold hover:underline">
                        Regístrate aquí
                    </Link>
                </p>

                <p className="text-center text-primary-100 text-sm mt-6">
                    ¿Problemas para ingresar? Contacta al administrador
                </p>
            </div>
        </div>
    );
}
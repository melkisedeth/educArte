import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AppUser } from '../types';
import { auth, db } from '../../firebase';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async (uid: string, email: string) => {
    try {
      const userRef = doc(db, 'educarte_users', uid);
      const userSnap = await getDoc(userRef);

      console.log('UID buscado:', uid);
      console.log('Documento existe:', userSnap.exists());
      console.log('Datos del documento:', userSnap.data());

      if (userSnap.exists()) {
        const data = userSnap.data();
        const appUser: AppUser = {
          uid,
          email,
          displayName: data.nombre || '',
          role: data.role || 'padre',
          nombre: data.nombre || '',
          telefono: data.telefono || '',
          cedula: data.cedula || '',
        };
        console.log('Rol asignado:', appUser.role);
        return appUser;
      } else {
        console.warn('No se encontró documento para UID:', uid);
        return {
          uid,
          email,
          displayName: '',
          role: 'padre' as const,
          nombre: '',
        };
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await loadUser(firebaseUser.uid, firebaseUser.email || '');
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const userData = await loadUser(result.user.uid, result.user.email || '');
    setUser(userData);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, User as FirebaseUser } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCLuBRtfAiFraO3SRUWwIE2KoPBNZHy1ik",
  authDomain: "cotiznow-a609d.firebaseapp.com",
  projectId: "cotiznow-a609d",
  storageBucket: "cotiznow-a609d.appspot.com",
  messagingSenderId: "688465903436",
  appId: "1:688465903436:android:67cb10ce94b73724a9d9e9"
};

const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const getUserWithRole = async (firebaseUser: FirebaseUser) => {
  const userDoc = await getDoc(doc(db, 'educarte_users', firebaseUser.uid));
  const userData = userDoc.data();
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || userData?.nombre || '',
    role: userData?.role || 'padre',
    nombre: userData?.nombre || '',
    telefono: userData?.telefono || '',
    cedula: userData?.cedula || '',
  };
};

export const createUserDocument = async (user: FirebaseUser, additionalData = {}) => {
  if (!user) return;
  const userRef = doc(db, 'educarte_users', user.uid);
  const userSnapshot = await getDoc(userRef);
  if (!userSnapshot.exists()) {
    try {
      await setDoc(userRef, {
        email: user.email,
        createdAt: new Date(),
        role: 'padre',
        ...additionalData
      });
    } catch (error) {
      console.error('Error creando documento de usuario:', error);
    }
  }
  return getUserWithRole(user);
};

export default app;
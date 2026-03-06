export type Role = 'admin' | 'padre';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  nombre: string;
  telefono?: string;
  cedula?: string;
}

export interface Alumno {
  id: string;
  nombre: string;
  fechaNacimiento: string;
  grado: string;
  foto?: string;
  fechaIngreso: string;
  estado: 'activo' | 'inactivo';
  padresIds: string[];
  montoPago: number;
  diaCicloPago: number;
  deleted?: boolean;
  createdAt: Date;
}

export interface Padre {
  id: string;
  uid?: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string;
  relacion: 'padre' | 'madre' | 'tutor';
  alumnosIds: string[];
  deleted?: boolean;
  createdAt: Date;
}

export interface Pago {
  id: string;
  alumnoId: string;
  alumnoNombre?: string;
  mes: string; // formato "YYYY-MM"
  estado: 'pagado' | 'pendiente' | 'vencido' | 'parcial';
  monto: number;
  montoPagado: number;
  fechaPago?: string;
  medioPago?: 'efectivo' | 'transferencia' | 'otro';
  referencia?: string;
  descuento?: number;
  justificacionDescuento?: string;
  deleted?: boolean;
  createdAt: Date;
}

export interface Reporte {
  id: string;
  alumnoId: string;
  periodo: string;
  materias: string;
  desempeno: string;
  fortalezas: string;
  areasMejora: string;
  calificacion: string;
  archivos?: string[];
  deleted?: boolean;
  createdAt: Date;
}

export interface Asistencia {
  id: string;
  alumnoId: string;
  fecha: string; // "YYYY-MM-DD"
  estado: 'presente' | 'ausente' | 'justificado';
  nota?: string;
  createdAt: Date;
}

export interface Notificacion {
  id: string;
  usuarioId: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  tipo: 'pago' | 'reporte' | 'asistencia' | 'general';
  createdAt: Date;
}
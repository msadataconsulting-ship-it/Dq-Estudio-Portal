
import { User, Client, Task, UserRole, TaskStatus, TaxType } from './types';

export const INITIAL_STAFF: User[] = [
  { 
    id: 'u1', 
    name: 'Admin Principal', 
    email: 'admin', 
    dni: 'admin',
    role: UserRole.ADMIN, 
    status: 'Activo',
    password: 'admin',
    position: 'Lider',
    clientSpecialty: 'Todos',
    phone: '11-0000-0000'
  },
  { 
    id: 'u2', 
    name: 'Juan Pérez', 
    email: 'juan@estudio.com', 
    dni: '35123456',
    role: UserRole.STAFF, 
    status: 'Activo',
    password: 'usuario',
    position: 'Responsable',
    clientSpecialty: 'Sociedad',
    reportsToId: 'u1',
    phone: '11-5555-1234'
  },
  { 
    id: 'u3', 
    name: 'María Garcia', 
    email: 'maria@estudio.com', 
    dni: '38987654',
    role: UserRole.STAFF, 
    status: 'Activo',
    password: 'usuario',
    position: 'Analista',
    clientSpecialty: 'Monotributo',
    reportsToId: 'u2',
    phone: '11-4444-9876'
  },
];

export const ALL_TASK_TYPES: TaxType[] = [
  'IIBB', 'IVA', '931', 'Recibos', 'Recibos Gerencia', 
  'Sindicatos', 'HyS', 'Autonomos', 'Sicore', 'Agente de Recaudación',
  'GANANCIAS', 'CONVENIO', 'MONOTRIBUTO'
];

export const INITIAL_CLIENTS: Client[] = [
  { 
    id: 'c1', 
    name: 'Distribuidora Norte S.A.', 
    cuit: '30-12345678-9', 
    cuitSociedad: '30-12345678-9',
    type: 'Sociedad',
    status: 'Activo',
    phone: '11-4455-6677',
    email: 'contacto@norte.com',
    hasEmployees: true,
    employeeCount: 15,
    mainActivity: 'Distribución mayorista',
    hasLocal: true,
    monotributoCategory: 'N/A',
    tributoCategory: 'Convenio Multilateral',
    address: 'Av. Corrientes 1234',
    location: 'CABA',
    province: 'Buenos Aires',
    dqSede: 'Sede Canning',
    mainBank: 'Banco Galicia',
    taxConfig: ['IVA', 'IIBB', '931', 'Recibos', 'Sicore'], 
    assignedStaffId: 'u2'
  },
  { 
    id: 'c2', 
    name: 'Tienda de Ropa Estilo', 
    cuit: '27-98765432-1', 
    type: 'Monotributo',
    status: 'Activo',
    phone: '11-2233-4455',
    email: 'estilo@gmail.com',
    hasEmployees: false,
    employeeCount: 0,
    mainActivity: 'Venta minorista indumentaria',
    hasLocal: true,
    monotributoCategory: 'D',
    tributoCategory: 'Regimen Simplificado',
    address: 'Calle Falsa 123',
    location: 'Lomas de Zamora',
    province: 'Buenos Aires',
    dqSede: 'Sede Lomas',
    mainBank: 'Banco Provincia',
    taxConfig: ['MONOTRIBUTO', 'IIBB', 'Autonomos'], 
    assignedStaffId: 'u3'
  }
];

export const INITIAL_TASKS: Task[] = [
  { id: 't1', clientId: 'c1', staffId: 'u2', month: '2024-05', type: 'IVA', status: TaskStatus.IN_PROGRESS, dueDate: '2024-05-20' },
  { id: 't2', clientId: 'c1', staffId: 'u2', month: '2024-05', type: 'IIBB', status: TaskStatus.PENDING, dueDate: '2024-05-18' },
  { id: 't3', clientId: 'c2', staffId: 'u3', month: '2024-05', type: 'MONOTRIBUTO', status: TaskStatus.COMPLETED, dueDate: '2024-05-20' },
];

export const BANK_OPTIONS = ['Banco Galicia', 'Banco Santander', 'Banco Provincia', 'Banco Nación', 'Banco Macro', 'BBVA', 'HSBC', 'ICBC'];

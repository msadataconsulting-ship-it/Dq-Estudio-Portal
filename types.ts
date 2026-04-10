
export type TaxType = 
  | 'IIBB' 
  | 'IVA' 
  | '931' 
  | 'Recibos' 
  | 'Recibos Gerencia' 
  | 'Sindicatos' 
  | 'HyS' 
  | 'Autonomos' 
  | 'Sicore' 
  | 'Agente de Recaudación'
  | 'GANANCIAS' 
  | 'CONVENIO' 
  | 'MONOTRIBUTO'
  | 'Seguridad e Higiene'
  | 'Síndicatos'
  | 'Autónomos'
  | 'Sícore';

export enum TaskStatus {
  PENDING = 'Pendiente',
  IN_PROGRESS = 'En Proceso',
  COMPLETED = 'Completado',
  OVERDUE = 'Vencido'
}

export enum TicketStatus {
  OPEN = 'Abierto',
  IN_ANALYSIS = 'En Análisis',
  RESOLVED = 'Resuelto',
  CLOSED = 'Cerrado'
}

export enum UserRole {
  ADMIN = 'Administrador',
  STAFF = 'Colaborador',
  CLIENT = 'Cliente'
}

export type StaffPosition = 'Analista' | 'Responsable' | 'Lider';
export type StaffClientSpecialty = 'Responsable Inscripto' | 'Sociedad' | 'Monotributo' | 'Todos';
export type UserStatus = 'Activo' | 'Baja';

export interface User {
  id: string;
  name: string;
  email: string;
  dni?: string;
  role: UserRole;
  status: UserStatus;
  password?: string;
  position?: StaffPosition;
  clientSpecialty?: StaffClientSpecialty;
  reportsToId?: string;
  phone?: string;
  associatedClientId?: string; 
}

export type ClientType = 'Responsable Inscripto' | 'Sociedad' | 'Monotributo' | string;
export type ClientStatus = 'Activo' | 'Baja';
export type MonotributoCategory = string;
export type TributoCategory = string;
export type DQSede = 'Sede Lomas' | 'Sede Canning' | string;

export interface Client {
  id: string;
  cuit: string;
  cuitSociedad?: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  phone: string;
  phone2?: string;
  whatsapp?: string;
  email: string;
  appPassword?: string; 
  hasEmployees: boolean;
  employeeCount: number;
  mainActivity: string;
  hasLocal: boolean;
  monotributoCategory: MonotributoCategory;
  tributoCategory: TributoCategory;
  address: string;
  location: string;
  province: string;
  dqSede: DQSede;
  mainBank: string;
  claveAfip?: string;
  claveAgip?: string;
  claveArba?: string;
  cuentaMuni?: string;
  claveMuni?: string;
  claveSindicatos?: string;
  fechaAlta?: string;
  usuarioCreacion?: string;
  fechaBaja?: string;
  motivoBaja?: string;
  usuarioBaja?: string;
  assignedStaffId: string;
  taxConfig: TaxType[];
}

export interface Ticket {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  clientId: string;
  staffId: string;
  month: string; 
  type: TaxType;
  status: TaskStatus;
  dueDate: string;
  notes?: string;
  attachedFileNames?: string[];
}

export interface PlanningTask {
  id: string;
  fecha: string;
  cuit: string;
  tipoCliente: string;
  cliente: string;
  responsable: string;
  tipoTarea: string;
  estado: string;
  vencimiento: string;
  diasVencimiento: string;
  estadoVencimiento: string;
}

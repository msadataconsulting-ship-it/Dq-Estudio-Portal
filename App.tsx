
import React, { useState, useEffect, useMemo } from 'react';
import { User, Client, Task, UserRole, TaskStatus, TaxType, Ticket, TicketStatus, PlanningTask } from './types';
import { INITIAL_STAFF, INITIAL_TASKS } from './constants';
// Import the Gemini service to provide AI insights
import { getSmartInsights } from './gemini-service';
import { supabase } from './supabase-client';
import { 
  LogOut, 
  Calendar,
  FileText,
  FolderOpen,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  MapPin,
  Building2,
  AlertTriangle,
  Search,
  UserCheck,
  Briefcase,
  BarChart3,
  Phone,
  Mail,
  UserCircle,
  Hash,
  X,
  ShieldCheck,
  Key,
  Clock,
  Info,
  CreditCard,
  Building,
  UserPlus,
  UserMinus,
  MessageSquare,
  Lock,
  User as UserIcon,
  Filter,
  CheckCircle2,
  PieChart,
  Users,
  HardDrive,
  Plus,
  Cloud,
  Send,
  MessageCircle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

// --- CONFIGURACIÓN DE GOOGLE SHEETS ---
const PUB_TOKEN = "2PACX-1vTq_9cW8O3hFcZnwQ10MrqHWUfGQQQL-WAXumoRQfmFd7KlxwjTh1y6rIY_wBfNhiu4gJzi4cDH49SK";
const BASE_PUB_URL = `https://docs.google.com/spreadsheets/d/e/${PUB_TOKEN}/pub?output=csv&single=true`;

const CLIENTES_URL = `${BASE_PUB_URL}&gid=0`;
const DOCUMENTACION_URL = `${BASE_PUB_URL}&gid=1793561725`;
const PLANNING_URL = `${BASE_PUB_URL}&gid=1156824379`;

const DQLogo: React.FC<{ size?: number; showText?: boolean }> = ({ size = 120, showText = true }) => (
  <div className="flex flex-col items-center">
    <div className="relative flex items-center justify-center rounded-full overflow-hidden shadow-lg border border-slate-200" 
         style={{ width: size, height: size, background: 'white' }}>
      <svg viewBox="0 0 200 200" className="w-4/5 h-4/5 z-10">
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#BF953F', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#FCF6BA', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#AA771C', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <text x="35" y="130" className="font-logo" style={{ fill: 'url(#goldGradient)', fontSize: '130px', fontWeight: 'bold' }}>D</text>
        <text x="85" y="145" className="font-logo" style={{ fill: 'url(#goldGradient)', fontSize: '130px', fontWeight: 'bold' }}>Q</text>
      </svg>
    </div>
    {showText && (
      <h2 className="mt-2 uppercase tracking-[0.3em] text-[8px] font-black text-slate-400 font-logo">Estudio Integral</h2>
    )}
  </div>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [viewMode, setViewMode] = useState<UserRole>(UserRole.ADMIN);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [planningTasks, setPlanningTasks] = useState<PlanningTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Service Desk State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '' });
  
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Activo' | 'Baja'>('Activo');
  const [nominaTypeFilter, setNominaTypeFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [docPeriodFilter, setDocPeriodFilter] = useState('Todos');
  const [docClientFilter, setDocClientFilter] = useState('');
  const [planningPeriodFilter, setPlanningPeriodFilter] = useState('Todos');
  const [planningRespFilter, setPlanningRespFilter] = useState('Todos');
  const [planningStatusFilter, setPlanningStatusFilter] = useState('Todos');
  const [planningTaskTypeFilter, setPlanningTaskTypeFilter] = useState('Todos');
  const [docTypeFilter, setDocTypeFilter] = useState('Todos');
  const [distributionFilter, setDistributionFilter] = useState<'Todos' | 'Sociedad' | 'Responsable Inscripto' | 'Monotributo'>('Todos');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load tickets from Supabase on init and when user changes
  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setTickets(data as Ticket[]);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    }
  };

  useEffect(() => {
    fetchTickets();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('tickets_changes')
      .on('postgres_changes' as any, { event: '*', table: 'tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const normalizeStr = (str: any) => {
    if (!str) return '';
    return str.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const parseCSV = (text: string) => {
    if (text.trim().startsWith('<')) return { headers: [], rows: [], isHtml: true };
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [], isHtml: false };
    
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const values = parseLine(line);
      const obj: any = {};
      headers.forEach((header, i) => {
        const h = header.trim();
        const val = values[i]?.replace(/^"|"$/g, '').trim() || '';
        // Store all values, but if duplicate header, prefer non-empty value
        if (obj[h] === undefined || (obj[h] === '' && val !== '')) {
          obj[h] = val;
        }
        // Also store with index to ensure no data is lost
        obj[`${h}_${i}`] = val;
      });
      return obj;
    });
    return { headers, rows, isHtml: false };
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const fetchWithRetry = async (url: string, label: string) => {
        const response = await fetch(`${url}&t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Error al obtener ${label} (Status: ${response.status} ${response.statusText || ''})`);
        }
        return await response.text();
      };

      console.log("Syncing clients...");
      const csvCl = await fetchWithRetry(CLIENTES_URL, 'clientes');
      const parsedCl = parseCSV(csvCl);
      
      if (!parsedCl.isHtml) {
        const getVal = (row: any, key: string) => {
          const normalizedKey = key.toUpperCase().trim();
          let firstFound = '';
          // Search all keys in the row object
          for (const k of Object.keys(row)) {
            // Remove index suffix if present (e.g. "ESTADO CLIENTE_42" -> "ESTADO CLIENTE")
            const baseKey = k.replace(/_\d+$/, '').toUpperCase().trim();
            if (baseKey === normalizedKey) {
              const val = row[k]?.toString().trim();
              if (val) return val; // Return first non-empty value found
              if (firstFound === '') firstFound = val;
            }
          }
          return firstFound;
        };

        const mappedClients: Client[] = parsedCl.rows
          .filter(row => (getVal(row, 'CLIENTE'))?.trim())
          .map((row, i) => {
            const statusRaw = getVal(row, 'ESTADO CLIENTE');
            const statusStr = normalizeStr(statusRaw);
            const fechaBajaRaw = getVal(row, 'FECHA DE BAJA CLIENTE');
            const fechaBaja = fechaBajaRaw.toString().trim();
            
            // Robust status check: must contain ACTIVO, not contain INACTIVO/BAJA, and have no fecha de baja
            const isActivo = statusStr.includes('ACTIVO') && 
                             !statusStr.includes('INACTIVO') && 
                             !statusStr.includes('BAJA') && 
                             !fechaBaja;

            return {
              id: `c-${i}`,
              cuit: getVal(row, 'CUIT'),
              cuitSociedad: getVal(row, 'CUIT SOCIEDAD'),
              name: getVal(row, 'CLIENTE') || 'Sin Nombre',
              type: getVal(row, 'TIPO DE CLIENTE') || 'S/D',
              status: isActivo ? 'Activo' : 'Baja',
              phone: getVal(row, 'TELEFONO1'),
              phone2: getVal(row, 'TELEFONO 2'),
              whatsapp: getVal(row, 'WHATSAPP'),
              email: getVal(row, 'MAIL'),
              appPassword: getVal(row, 'Contraseña App'),
              hasEmployees: normalizeStr(getVal(row, 'TIENE EMPLEADOS')) === 'SI',
              employeeCount: parseInt(getVal(row, 'CANTIDAD EMPLEADOS')) || 0,
              mainActivity: getVal(row, 'ACTIVIDAD PRINCIPAL') || 'N/A',
              hasLocal: normalizeStr(getVal(row, 'LOCAL COMERCIAL')) === 'SI',
              monotributoCategory: getVal(row, 'CATEGORIA MONOTRIBUTO') || 'N/A',
              tributoCategory: getVal(row, 'CATEGORIA TRIBUTO') || 'N/A',
              address: getVal(row, 'DIRECCIÓN'),
              location: getVal(row, 'LOCALIDAD'),
              province: getVal(row, 'PROVINCIA'),
              dqSede: getVal(row, 'SEDE CLIENTE') || 'Sede Lomas',
              mainBank: getVal(row, 'BANCO'),
              claveAfip: getVal(row, 'CLAVE AFIP'),
              claveAgip: getVal(row, 'CLAVE AGIP'),
              claveArba: getVal(row, 'CLAVE ARBA'),
              cuentaMuni: getVal(row, 'CUENTA MUNI'),
              claveMuni: getVal(row, 'CLAVE MUNI'),
              claveSindicatos: getVal(row, 'CLAVE SINDICATOS'),
              fechaAlta: getVal(row, 'FECHA DE ALTA CLIENTE'),
              usuarioCreacion: getVal(row, 'USUARIO DE CREACION'),
              fechaBaja: fechaBaja,
              motivoBaja: getVal(row, 'MOTIVO DE BAJA'),
              usuarioBaja: getVal(row, 'USUARIO DE BAJA'),
              assignedStaffId: getVal(row, 'Responsable del cliente') || 'N/A',
              taxConfig: []
            };
          });
        setClients(mappedClients);
      }

      console.log("Syncing documentation...");
      const csvDoc = await fetchWithRetry(DOCUMENTACION_URL, 'documentación');
      const parsedDoc = parseCSV(csvDoc);
      
      if (!parsedDoc.isHtml) {
        const transformed: any[] = [];
        parsedDoc.rows.forEach((row, rowIndex) => {
          const clientVal = row['Cliente'] || row['CLIENTE'] || 'S/D';
          const cuitVal = row['CUIT'] || 'S/N';
          const fechaVal = row['Fecha'] || row['FECHA'] || '-';
          parsedDoc.headers.forEach(header => {
            const val = row[header];
            if (val && typeof val === 'string' && val.toLowerCase().includes('drive.google.com')) {
              transformed.push({
                id: `doc-${rowIndex}-${header}`,
                clientName: clientVal,
                clientCuit: cuitVal,
                periodo: fechaVal,
                name: header,
                url: val
              });
            }
          });
        });
        setAllDocuments(transformed);
      }

      console.log("Syncing planning...");
      const csvPl = await fetchWithRetry(PLANNING_URL, 'planning');
      const parsedPl = parseCSV(csvPl);
      
      if (!parsedPl.isHtml) {
        const mappedPlanning: PlanningTask[] = parsedPl.rows
          .filter(row => (row['Cliente'] || row['CLIENTE'])?.trim())
          .map((row, i) => {
            // Column J is index 9. We try to find it by name or by index suffix
            const situacion = row['Situación'] || row['SITUACIÓN'] || row['Situacion'] || row['SITUACION'] || 
                             row['Estado_9'] || row['Estado_1'] || row['Estado'] || '';
            
            return {
              id: `pl-${i}`,
              fecha: row['Fecha'] || '',
              cuit: row['CUIT'] || '',
              tipoCliente: row['TIPO CLIENTE'] || '',
              cliente: row['Cliente'] || row['CLIENTE'] || '',
              responsable: row['Responsable I'] || '',
              tipoTarea: row['Tipo Tarea'] || '',
              estado: row['Estado'] || '',
              vencimiento: row['Vencimiento'] || '',
              diasVencimiento: row['Días para Vencimiento'] || '',
              estadoVencimiento: situacion
            };
          });
        setPlanningTasks(mappedPlanning);
      }
    } catch (e: any) {
      console.error("Sync Error:", e);
      alert(`Error de sincronización: ${e.message || "Error desconocido"}. Verifique que las hojas de cálculo estén publicadas como CSV.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { syncData(); }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewMode === UserRole.ADMIN) {
      const admin = INITIAL_STAFF.find(s => s.email === loginId && s.password === loginPassword);
      if (admin) {
        setCurrentUser(admin);
        setCurrentTab('dashboard');
      } else {
        alert("Credenciales de administrador incorrectas.");
      }
    } else {
      const inputMail = loginId.trim().toLowerCase();
      const foundClient = clients.find(c => 
        c.email.trim().toLowerCase() === inputMail && 
        c.appPassword === loginPassword
      );

      if (foundClient) {
        setCurrentUser({ 
          id: `u-${foundClient.id}`, 
          name: foundClient.name, 
          email: foundClient.email, 
          role: UserRole.CLIENT, 
          status: 'Activo', 
          associatedClientId: foundClient.id 
        });
        setCurrentTab('documentation');
      } else {
        alert("Usuario o contraseña incorrectos.");
      }
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentClientData) return;

    const newTicketObj: Ticket = {
      id: `tk-${Date.now()}`,
      clientId: currentClientData.id,
      clientName: currentClientData.name,
      title: newTicket.title,
      description: newTicket.description,
      status: TicketStatus.OPEN,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('tickets').insert([newTicketObj]);
      if (error) throw error;
      
      setNewTicket({ title: '', description: '' });
      setIsTicketModalOpen(false);
      // fetchTickets() will be called by the real-time subscription
    } catch (err) {
      console.error('Error creating ticket:', err);
      alert('Error al crear el ticket. Por favor reintente.');
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus, 
          updatedAt: new Date().toISOString() 
        })
        .eq('id', ticketId);
      
      if (error) throw error;
      // fetchTickets() will be called by the real-time subscription
    } catch (err) {
      console.error('Error updating ticket:', err);
      alert('Error al actualizar el ticket.');
    }
  };

  // Function to call Gemini for smart insights
  const currentClientData = useMemo(() => {
    if (!currentUser || currentUser.role !== UserRole.CLIENT) return null;
    return clients.find(c => c.id === currentUser.associatedClientId) || null;
  }, [currentUser, clients]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.cuit.includes(searchQuery);
      
      let matchesType = true;
      if (nominaTypeFilter !== 'Todos') {
        const typeUpper = c.type.toUpperCase();
        if (nominaTypeFilter === 'Monotributo') matchesType = typeUpper.includes('MONOTRIBUTO');
        else if (nominaTypeFilter === 'Responsable Inscripto') matchesType = typeUpper.includes('RESPONSABLE');
        else if (nominaTypeFilter === 'Sociedad') matchesType = typeUpper.includes('SOCIEDAD');
        else if (nominaTypeFilter === 'Otros') matchesType = !typeUpper.includes('MONOTRIBUTO') && !typeUpper.includes('RESPONSABLE') && !typeUpper.includes('SOCIEDAD');
      }

      return matchesStatus && matchesSearch && matchesType;
    });
  }, [clients, statusFilter, searchQuery, nominaTypeFilter]);

  const adminStats = useMemo(() => {
    const activeClientsList = clients.filter(c => c.status === 'Activo');
    const totalActive = activeClientsList.length;

    const byType: Record<string, number> = {
      'Monotributo': 0,
      'Responsable Inscripto': 0,
      'Sociedad': 0,
      'Otros': 0
    };

    const bySede: Record<string, number> = {
      'Sede Lomas': 0,
      'Sede Canning': 0,
      'Otros': 0
    };

    const byResponsible: Record<string, number> = {};

    let employersCount = 0;
    let totalEmployees = 0;

    activeClientsList.forEach(c => {
      const type = c.type.toUpperCase();
      if (type.includes('MONOTRIBUTO')) byType['Monotributo']++;
      else if (type.includes('SOCIEDAD')) byType['Sociedad']++;
      else if (type.includes('RESPONSABLE')) byType['Responsable Inscripto']++;
      else byType['Otros']++;

      const sede = c.dqSede.toUpperCase();
      if (sede.includes('LOMAS')) bySede['Sede Lomas']++;
      else if (sede.includes('CANNING')) bySede['Sede Canning']++;
      else bySede['Otros']++;

      // Filter for distribution by responsible
      let matchesDistributionFilter = false;
      if (distributionFilter === 'Todos') matchesDistributionFilter = true;
      else if (distributionFilter === 'Sociedad') matchesDistributionFilter = type.includes('SOCIEDAD');
      else if (distributionFilter === 'Responsable Inscripto') matchesDistributionFilter = type.includes('RESPONSABLE');
      else if (distributionFilter === 'Monotributo') matchesDistributionFilter = type.includes('MONOTRIBUTO');

      if (matchesDistributionFilter) {
        const resp = c.assignedStaffId || 'Sin Asignar';
        byResponsible[resp] = (byResponsible[resp] || 0) + 1;
      }

      if (c.hasEmployees) {
        employersCount++;
        totalEmployees += c.employeeCount || 0;
      }
    });

    const pendingTickets = tickets.filter(t => t.status === TicketStatus.OPEN || t.status === TicketStatus.IN_ANALYSIS).length;

    const totalFilteredForDistribution = Object.values(byResponsible).reduce((acc, val) => acc + val, 0);

    return {
      totalActive,
      totalDocs: allDocuments.length,
      pendingTickets,
      byType,
      bySede,
      byResponsible,
      totalFilteredForDistribution,
      employersCount,
      totalEmployees,
      participation: {
        'Monotributo': totalActive ? ((byType['Monotributo'] / totalActive) * 100).toFixed(1) : 0,
        'Responsable Inscripto': totalActive ? ((byType['Responsable Inscripto'] / totalActive) * 100).toFixed(1) : 0,
        'Sociedad': totalActive ? ((byType['Sociedad'] / totalActive) * 100).toFixed(1) : 0,
        'Otros': totalActive ? ((byType['Otros'] / totalActive) * 100).toFixed(1) : 0,
      }
    };
  }, [clients, allDocuments, tickets, distributionFilter]);

  const docPeriods = useMemo(() => {
    const periodsSet = new Set<string>();
    allDocuments.forEach(d => { if(d.periodo) periodsSet.add(d.periodo); });
    const monthMap: Record<string, number> = {
      'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
      'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
    };
    const getSortValue = (p: string) => {
      const parts = p.trim().toUpperCase().split(' ');
      if (parts.length < 2) return 0;
      const monthStr = parts[0];
      const year = parseInt(parts[parts.length - 1]);
      const monthIdx = monthMap[monthStr] !== undefined ? monthMap[monthStr] : 0;
      return (year * 13) + monthIdx;
    };
    return Array.from(periodsSet).sort((a, b) => getSortValue(b) - getSortValue(a));
  }, [allDocuments]);

  const docTypes = useMemo(() => {
    const categories = ['IVA', '931', 'INGRESOS BRUTOS', 'IIBB', 'AGENTE DE RECAUDACIÓN', 'AUTÓNOMOS', 'SICORE', 'SINDICATOS', 'RECIBOS', 'HYS', 'GANANCIAS', 'MONOTRIBUTO', 'CONVENIO', 'SEGURIDAD E HIGIENE'];
    const availableCategories = new Set<string>();
    allDocuments.forEach(d => {
      const name = d.name.toUpperCase();
      let found = false;
      for (const cat of categories) {
        if (name.includes(cat)) {
          if (cat === 'IIBB' || cat === 'INGRESOS BRUTOS') availableCategories.add('INGRESOS BRUTOS');
          else availableCategories.add(cat);
          found = true;
          break;
        }
      }
      if (!found) availableCategories.add(d.name.toUpperCase());
    });
    return Array.from(availableCategories).sort();
  }, [allDocuments]);

  const filteredDocs = useMemo(() => {
    let docs = currentUser?.role === UserRole.CLIENT && currentClientData 
      ? allDocuments.filter(d => d.clientCuit === currentClientData.cuit || d.clientName === currentClientData.name)
      : allDocuments;
    return docs.filter(d => {
      const matchesPeriod = docPeriodFilter === 'Todos' || d.periodo === docPeriodFilter;
      const matchesClient = docClientFilter === '' || d.clientName.toLowerCase().includes(docClientFilter.toLowerCase());
      const docNameUpper = d.name.toUpperCase();
      let matchesType = false;
      if (docTypeFilter === 'Todos') matchesType = true;
      else if (docTypeFilter === 'INGRESOS BRUTOS') matchesType = docNameUpper.includes('INGRESOS BRUTOS') || docNameUpper.includes('IIBB');
      else matchesType = docNameUpper.includes(docTypeFilter.toUpperCase());
      return matchesPeriod && matchesType && matchesClient;
    });
  }, [allDocuments, docPeriodFilter, docTypeFilter, docClientFilter, currentUser, currentClientData]);

  // Service Desk Component
  const renderServiceDesk = () => {
    const displayTickets = currentUser?.role === UserRole.CLIENT 
      ? tickets.filter(t => t.clientId === currentClientData?.id)
      : tickets;

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Service Desk</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {currentUser?.role === UserRole.CLIENT ? 'GESTIONE SUS SOLICITUDES Y CONSULTAS' : 'GESTIÓN CENTRALIZADA DE TICKETS'}
            </p>
          </div>
          {currentUser?.role === UserRole.CLIENT && (
            <button 
              onClick={() => setIsTicketModalOpen(true)}
              className="flex items-center gap-3 px-8 py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/10 active:scale-95"
            >
              <Plus size={18} /> Nueva Solicitud
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6">
          {displayTickets.length > 0 ? displayTickets.map(ticket => (
            <div key={ticket.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:border-amber-500/30 transition-all group shadow-xl">
              <div className="flex flex-col lg:flex-row justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4">
                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      ticket.status === TicketStatus.OPEN ? 'bg-amber-500/10 text-amber-600' :
                      ticket.status === TicketStatus.IN_ANALYSIS ? 'bg-blue-500/10 text-blue-600' :
                      ticket.status === TicketStatus.RESOLVED ? 'bg-emerald-500/10 text-emerald-600' :
                      'bg-slate-500/10 text-slate-500'
                    }`}>
                      {ticket.status}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 font-mono">#{ticket.id}</span>
                  </div>
                  <div>
                    {currentUser?.role === UserRole.ADMIN && (
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">{ticket.clientName}</p>
                    )}
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{ticket.title}</h4>
                    <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">{ticket.description}</p>
                  </div>
                  <div className="flex items-center gap-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-2">
                    <span className="flex items-center gap-2"><Clock size={12}/> {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-2"><RefreshCw size={12}/> ACT: {new Date(ticket.updatedAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                {currentUser?.role === UserRole.ADMIN && (
                  <div className="flex flex-col justify-center gap-3 bg-slate-50 p-6 rounded-3xl border border-slate-200 min-w-[240px]">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Cambiar Estado</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(TicketStatus).map(status => (
                        <button
                          key={status}
                          onClick={() => handleUpdateTicketStatus(ticket.id, status)}
                          disabled={ticket.status === status}
                          className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all ${
                            ticket.status === status 
                              ? 'bg-amber-600 text-white shadow-lg' 
                              : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="bg-white border border-slate-200 rounded-[4rem] p-32 text-center shadow-xl">
              <MessageSquare size={64} className="mx-auto mb-8 text-slate-200" />
              <p className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-400">No hay tickets registrados en este momento.</p>
            </div>
          )}
        </div>

        {/* Modal Nuevo Ticket */}
        {isTicketModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsTicketModalOpen(false)} />
            <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-[3.5rem] shadow-2xl p-12 overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Nueva Solicitud</h3>
                <button onClick={() => setIsTicketModalOpen(false)} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all border border-slate-200">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateTicket} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Asunto / Título</label>
                  <input 
                    required
                    type="text" 
                    value={newTicket.title}
                    onChange={(e) => setNewTicket({...newTicket, title: e.target.value})}
                    placeholder="EJ: CAMBIO DE CUIT, CONSULTA LIQUIDACIÓN..." 
                    className="w-full bg-slate-50 px-8 py-5 rounded-2xl border border-slate-200 text-slate-900 text-sm outline-none focus:border-amber-500/40 transition-all font-bold tracking-wider placeholder:text-slate-300" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Descripción Detallada</label>
                  <textarea 
                    required
                    rows={5}
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                    placeholder="DESCRIBA AQUÍ SU CONSULTA O SOLICITUD DE FORMA CLARA..." 
                    className="w-full bg-slate-50 px-8 py-5 rounded-2xl border border-slate-200 text-slate-900 text-sm outline-none focus:border-amber-500/40 transition-all font-bold tracking-wider placeholder:text-slate-300 resize-none" 
                  />
                </div>
                <button type="submit" className="w-full py-6 bg-amber-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-amber-900/20 hover:bg-amber-500 transition-all active:scale-95">
                  Enviar Solicitud
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Rediseño de Documentación a formato Lista (Tabla)
  const renderDocumentation = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-xl">
        <div className="flex-1 flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200">
          <Filter size={18} className="text-slate-400" />
          <div className="flex flex-col flex-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Periodo</label>
            <select 
              value={docPeriodFilter}
              onChange={(e) => setDocPeriodFilter(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase text-slate-900 outline-none w-full appearance-none cursor-pointer"
            >
              <option value="Todos" className="bg-white">Todos los periodos</option>
              {docPeriods.map(p => <option key={p} value={p} className="bg-white">{p}</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex-1 flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200">
          <FileText size={18} className="text-slate-400" />
          <div className="flex flex-col flex-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Categoría</label>
            <select 
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase text-slate-900 outline-none w-full appearance-none cursor-pointer"
            >
              <option value="Todos" className="bg-white">Todos los tipos</option>
              {docTypes.map(t => <option key={t} value={t} className="bg-white">{t}</option>)}
            </select>
          </div>
        </div>

        {currentUser?.role === UserRole.ADMIN && (
          <div className="flex-1 flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200 group focus-within:border-amber-500/50 transition-all">
            <Search size={18} className="text-slate-400 group-focus-within:text-amber-600" />
            <div className="flex flex-col flex-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Buscar Cliente</label>
              <input 
                type="text"
                placeholder="NOMBRE DE EMPRESA..."
                value={docClientFilter}
                onChange={(e) => setDocClientFilter(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase text-slate-900 outline-none w-full placeholder:text-slate-300 tracking-widest"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 overflow-hidden shadow-xl">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {currentUser?.role === UserRole.ADMIN && (
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa / CUIT</th>
                )}
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodo</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comprobante</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length > 0 ? filteredDocs.map(doc => (
                <tr key={doc.id} className="group hover:bg-slate-50 transition-colors">
                  {currentUser?.role === UserRole.ADMIN && (
                    <td className="px-10 py-5">
                      <p className="text-[11px] font-black text-slate-900 uppercase">{doc.clientName}</p>
                      <p className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">{doc.clientCuit}</p>
                    </td>
                  )}
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-300" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{doc.periodo}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
                        <FileText size={16} />
                      </div>
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight group-hover:text-amber-600 transition-colors">{doc.name}</p>
                    </div>
                  </td>
                  <td className="px-10 py-5 text-right">
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-amber-600 text-slate-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      <ExternalLink size={12} /> Abrir Drive
                    </a>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={currentUser?.role === UserRole.ADMIN ? 4 : 3} className="py-40 text-center">
                    <FolderOpen size={64} className="mx-auto text-slate-200 mb-8" />
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">No se encontraron documentos en esta sección.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View for Documentation */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredDocs.length > 0 ? filteredDocs.map(doc => (
            <div key={doc.id} className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  {currentUser?.role === UserRole.ADMIN && (
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{doc.clientName}</p>
                  )}
                  <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-tight">{doc.name}</h4>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                    <Calendar size={12} /> {doc.periodo}
                  </div>
                </div>
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600">
                  <FileText size={18} />
                </div>
              </div>
              <a 
                href={doc.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-center gap-3 w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest active:bg-amber-600 active:text-white transition-all"
              >
                <ExternalLink size={14} /> Ver en Google Drive
              </a>
            </div>
          )) : (
            <div className="py-20 text-center opacity-40">
              <FolderOpen size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-10">No hay documentos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const Section = ({ title, icon: Icon, children }: any) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <Icon size={16} className="text-amber-600" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {children}
      </div>
    </div>
  );

  const Field = ({ label, value, isCode = false, fullWidth = false }: any) => (
    <div className={`space-y-1 ${fullWidth ? 'md:col-span-2 lg:col-span-3' : ''}`}>
      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className={`text-[11px] font-black uppercase ${isCode ? 'font-mono text-amber-600' : 'text-slate-700'}`}>
        {value || '---'}
      </div>
    </div>
  );

  const renderClientProfile = () => {
    if (!currentClientData) return null;
    const c = currentClientData;
    return (
      <div className="space-y-12 animate-in fade-in duration-500 bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <UserIcon size={200} className="text-amber-600" />
        </div>
        
        <header className="mb-8">
           <div className="flex items-center gap-3 mb-4">
              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${c.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                {c.status}
              </span>
              <span className="bg-slate-100 px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">
                {c.type}
              </span>
           </div>
           <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">{c.name}</h3>
           <p className="text-[12px] font-bold text-slate-400 mt-4 flex items-center gap-3">
             <Hash size={14} className="text-amber-600/50" /> 
             <span className="font-mono">CUIT: {c.cuit}</span> 
             {c.cuitSociedad && <><span className="opacity-20">|</span> <span className="font-mono">SOCIEDAD: {c.cuitSociedad}</span></>}
           </p>
        </header>

        <Section title="Credenciales de Acceso" icon={Key}>
          <Field label="Mail de Acceso" value={c.email} />
          <Field label="Contraseña de Acceso" value={c.appPassword} isCode />
        </Section>

        <Section title="General y Ubicación" icon={Building2}>
          <Field label="Actividad Principal" value={c.mainActivity} fullWidth />
          <Field label="Dirección" value={c.address} />
          <Field label="Localidad" value={c.location} />
          <Field label="Provincia" value={c.province} />
          <Field label="Local Comercial" value={c.hasLocal ? 'SÍ' : 'NO'} />
          <Field label="Sede de Atención" value={c.dqSede} />
          <Field label="Banco Principal" value={c.mainBank} />
        </Section>

        <Section title="Contacto y Comunicación" icon={Phone}>
          <Field label="Teléfono principal" value={c.phone} />
          <Field label="Teléfono secundario" value={c.phone2} />
          <Field label="WhatsApp" value={c.whatsapp} />
          <Field label="Email de contacto" value={c.email} fullWidth />
        </Section>

        <Section title="Estatus Fiscal" icon={ShieldCheck}>
          <Field label="Categoría Monotributo" value={c.monotributoCategory} />
          <Field label="Categoría Tributo" value={c.tributoCategory} />
          <Field label="Responsable en Estudio" value={c.assignedStaffId} />
        </Section>

        <Section title="Nómina y Personal" icon={UserCircle}>
          <Field label="Tiene Empleados" value={c.hasEmployees ? 'SÍ' : 'NO'} />
          <Field label="Cantidad Empleados" value={c.employeeCount.toString()} />
        </Section>
      </div>
    );
  };

  const renderClientModal = () => {
    if (!selectedClient) return null;
    const c = selectedClient;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-12 animate-in fade-in zoom-in duration-300">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setSelectedClient(null)} />
        <div className="relative w-full h-full md:h-auto md:max-w-6xl md:max-h-[90vh] bg-white md:border md:border-slate-200 md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-8 md:px-12 py-8 md:py-10 border-b border-slate-200 flex justify-between items-start">
            <div className="pr-12">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${c.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                  {c.status}
                </span>
                <span className="bg-slate-100 px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">
                  {c.type}
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{c.name}</h3>
              <p className="text-[11px] md:text-[12px] font-bold text-slate-400 mt-3 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2"><Hash size={14} className="text-amber-600/50" /> <span className="font-mono">CUIT: {c.cuit}</span></span>
                {c.cuitSociedad && <><span className="hidden md:inline opacity-20">|</span> <span className="font-mono">SOCIEDAD: {c.cuitSociedad}</span></>}
              </p>
            </div>
            <button onClick={() => setSelectedClient(null)} className="p-4 bg-white rounded-2xl md:rounded-3xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-90 border border-slate-200">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar bg-white">
            <Section title="Credenciales de Acceso" icon={Key}>
              <Field label="Mail de Acceso" value={c.email} />
              <Field label="Contraseña de Acceso" value={c.appPassword} isCode />
            </Section>
            <Section title="General y Ubicación" icon={Building2}>
              <Field label="Actividad Principal" value={c.mainActivity} fullWidth />
              <Field label="Dirección" value={c.address} />
              <Field label="Localidad" value={c.location} />
              <Field label="Provincia" value={c.province} />
              <Field label="Local Comercial" value={c.hasLocal ? 'SÍ' : 'NO'} />
              <Field label="Sede de Atención" value={c.dqSede} />
              <Field label="Banco Principal" value={c.mainBank} />
            </Section>
            <Section title="Gestión Fiscal y Claves" icon={ShieldCheck}>
              <Field label="Categoría Monotributo" value={c.monotributoCategory} />
              <Field label="Categoría Tributo" value={c.tributoCategory} />
              <Field label="Responsable Asignado" value={c.assignedStaffId} />
              <Field label="Clave AFIP" value={c.claveAfip} isCode />
              <Field label="Clave AGIP" value={c.claveAgip} isCode />
              <Field label="Clave ARBA" value={c.claveArba} isCode />
              <Field label="Cuenta Municipal" value={c.cuentaMuni} isCode />
              <Field label="Clave Municipal" value={c.claveMuni} isCode />
              <Field label="Clave Sindicatos" value={c.claveSindicatos} isCode />
            </Section>
          </div>
        </div>
      </div>
    );
  };

  const renderPlanningTasks = () => {
    const filteredTasks = planningTasks.filter(t => {
      const matchesPeriod = planningPeriodFilter === 'Todos' || t.fecha === planningPeriodFilter;
      const matchesResp = planningRespFilter === 'Todos' || t.responsable === planningRespFilter;
      const matchesStatus = planningStatusFilter === 'Todos' || t.estadoVencimiento === planningStatusFilter;
      const matchesTaskType = planningTaskTypeFilter === 'Todos' || t.tipoTarea === planningTaskTypeFilter;
      return matchesPeriod && matchesResp && matchesStatus && matchesTaskType;
    });

    const periods = Array.from(new Set(planningTasks.map(t => t.fecha))).filter(Boolean).sort();
    const responsibles = Array.from(new Set(planningTasks.map(t => t.responsable))).filter(Boolean).sort();
    const statuses = Array.from(new Set(planningTasks.map(t => t.estadoVencimiento))).filter(Boolean).sort();
    const taskTypes = Array.from(new Set(planningTasks.map(t => t.tipoTarea))).filter(Boolean).sort();

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Seguimiento de Tareas</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Visualización de tareas importadas desde el Portal</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <Calendar size={16} className="ml-3 text-slate-400" />
              <select 
                value={planningPeriodFilter}
                onChange={(e) => setPlanningPeriodFilter(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer pr-8"
              >
                <option value="Todos">Período</option>
                {periods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <UserIcon size={16} className="ml-3 text-slate-400" />
              <select 
                value={planningRespFilter}
                onChange={(e) => setPlanningRespFilter(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer pr-8"
              >
                <option value="Todos">Responsable</option>
                {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <Hash size={16} className="ml-3 text-slate-400" />
              <select 
                value={planningTaskTypeFilter}
                onChange={(e) => setPlanningTaskTypeFilter(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer pr-8"
              >
                <option value="Todos">Tipo de Tarea</option>
                {taskTypes.map(tt => <option key={tt} value={tt}>{tt}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <Filter size={16} className="ml-3 text-slate-400" />
              <select 
                value={planningStatusFilter}
                onChange={(e) => setPlanningStatusFilter(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer pr-8"
              >
                <option value="Todos">Estado</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsable</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tarea</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencimiento</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Días</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Situación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.length > 0 ? filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{task.fecha}</td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-black text-slate-900 uppercase">{task.cliente}</p>
                      <p className="text-[8px] font-bold text-slate-400 font-mono">{task.cuit}</p>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-600 uppercase">{task.responsable}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[8px] font-black uppercase rounded-full tracking-widest">
                        {task.tipoTarea}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-[8px] font-black uppercase rounded-full tracking-widest ${
                        task.estado.toUpperCase().includes('PENDIENTE') ? 'bg-amber-50 text-amber-600' : 
                        task.estado.toUpperCase().includes('REALIZADO') ? 'bg-emerald-50 text-emerald-600' : 
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {task.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{task.vencimiento}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-mono font-bold ${
                        parseInt(task.diasVencimiento) < 0 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {task.diasVencimiento}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-3 py-1 text-[8px] font-black uppercase rounded-full tracking-widest ${
                        task.estadoVencimiento.toUpperCase().includes('VENCIDA') ? 'bg-rose-50 text-rose-600' : 
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {task.estadoVencimiento}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="py-32 text-center">
                      <CheckCircle2 size={48} className="mx-auto text-emerald-500/20 mb-6" />
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Sin resultados</h4>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">No hay tareas que coincidan con los filtros seleccionados.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderNomina = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-[2rem] md:rounded-3xl border border-slate-200">
        <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200 flex-1 w-full group">
          <Search size={20} className="text-slate-400 group-focus-within:text-amber-600 transition-colors" />
          <input 
            type="text" 
            placeholder="BUSCAR POR NOMBRE O CUIT..." 
            className="bg-transparent text-[11px] font-black uppercase text-slate-900 outline-none w-full placeholder:text-slate-300 tracking-widest"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200 w-full md:w-auto">
          <Filter size={18} className="text-slate-400" />
          <div className="flex flex-col flex-1 min-w-[140px]">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Categoría</label>
            <select 
              value={nominaTypeFilter}
              onChange={(e) => setNominaTypeFilter(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase text-slate-900 outline-none w-full appearance-none cursor-pointer"
            >
              <option value="Todos" className="bg-white">Todas las categorías</option>
              <option value="Monotributo" className="bg-white">Monotributo</option>
              <option value="Responsable Inscripto" className="bg-white">Resp. Inscripto</option>
              <option value="Sociedad" className="bg-white">Sociedad</option>
              <option value="Otros" className="bg-white">Otros</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-2xl border border-slate-200 w-full md:w-auto overflow-x-auto no-scrollbar">
          {(['Todos', 'Activo', 'Baja'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all tracking-widest whitespace-nowrap ${statusFilter === f ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 overflow-hidden shadow-xl">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">CUIT</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map(c => (
                <tr key={c.id} onClick={() => setSelectedClient(c)} className="group hover:bg-slate-50 cursor-pointer transition-all">
                  <td className="px-10 py-5">
                    <p className="text-[12px] font-black text-slate-900 uppercase group-hover:text-amber-600 transition-colors">{c.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[200px] mt-1">{c.mainActivity}</p>
                  </td>
                  <td className="px-8 py-5 text-[11px] font-bold text-slate-500 font-mono">{c.cuit}</td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-3 py-1 rounded-lg">{c.type}</span>
                  </td>
                  <td className="px-8 py-5 text-[11px] font-black text-slate-500 font-mono">{c.phone || '---'}</td>
                  <td className="px-10 py-5 text-right">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${c.status === 'Activo' ? 'text-emerald-600' : 'text-rose-600'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View for Nomina */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredClients.map(c => (
            <div key={c.id} onClick={() => setSelectedClient(c)} className="p-6 space-y-4 active:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="space-y-1 pr-4">
                  <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-tight leading-tight">{c.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 font-mono">{c.cuit}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${c.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {c.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase bg-white/5 px-3 py-1 rounded-lg">{c.type}</span>
                {c.phone && (
                  <span className="text-[9px] font-bold text-slate-600 uppercase bg-white/5 px-3 py-1 rounded-lg flex items-center gap-1">
                    <Phone size={10} /> {c.phone}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-8 wood-pattern">
        <div className="w-full max-w-md bg-white border border-slate-200 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
          <div className="mb-16 text-center scale-110"><DQLogo size={140} /></div>
          <div className="flex bg-slate-50 p-2 rounded-2xl mb-12 border border-slate-200">
            <button onClick={() => setViewMode(UserRole.ADMIN)} className={`flex-1 py-5 text-[10px] font-black uppercase rounded-xl transition-all ${viewMode === UserRole.ADMIN ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Estudio</button>
            <button onClick={() => setViewMode(UserRole.CLIENT)} className={`flex-1 py-5 text-[10px] font-black uppercase rounded-xl transition-all ${viewMode === UserRole.CLIENT ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Clientes</button>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Usuario / Email</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">
                    <UserCircle size={18} />
                  </div>
                  <input 
                    type="text" 
                    value={loginId} 
                    onChange={(e) => setLoginId(e.target.value)} 
                    placeholder={viewMode === UserRole.ADMIN ? "USUARIO ADMINISTRADOR" : "SU@EMAIL.COM"} 
                    className="w-full bg-slate-50 pl-14 pr-6 py-6 rounded-[2rem] border border-slate-200 text-slate-900 text-sm outline-none focus:border-amber-500/40 transition-all font-bold placeholder:text-slate-300 tracking-wider" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Contraseña</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={(e) => setLoginPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="w-full bg-slate-50 pl-14 pr-6 py-6 rounded-[2rem] border border-slate-200 text-slate-900 text-sm outline-none focus:border-amber-500/40 transition-all font-bold placeholder:text-slate-300 tracking-wider" 
                  />
                </div>
              </div>
            </div>
            <button className="w-full py-6 bg-amber-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-amber-900/20 hover:bg-amber-500 transition-all active:scale-95">
              Ingresar al Ecosistema
            </button>
          </form>
          {loading && <div className="mt-10 flex justify-center"><Loader2 size={24} className="text-amber-500 animate-spin" /></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 pb-24 lg:pb-0">
      <aside className="w-80 bg-white border-r border-slate-200 hidden lg:flex flex-col p-10 sticky top-0 h-screen z-50 shadow-xl">
        <div className="mb-20"><DQLogo size={100} /></div>
        <nav className="flex-1 space-y-6">
          {currentUser.role === UserRole.ADMIN ? (
            <>
              {[
                { id: 'dashboard', label: 'Panel Administrador', icon: <BarChart3 size={20}/> },
                { id: 'nomina', label: 'Nómina Global', icon: <Briefcase size={20}/> },
                { id: 'documentation', label: 'Documentación', icon: <FolderOpen size={20}/> },
                { id: 'service-desk', label: 'Service Desk', icon: <MessageSquare size={20}/> },
                { id: 'tasks', label: 'Seguimiento Tareas', icon: <CheckCircle size={20}/> },
              ].map(item => (
                <button key={item.id} onClick={() => setCurrentTab(item.id)} className={`w-full flex items-center gap-5 px-7 py-5 rounded-[2rem] transition-all group ${currentTab === item.id ? 'bg-amber-600 text-white shadow-xl scale-105 font-black' : 'text-slate-400 hover:text-slate-600 font-bold'}`}>
                  <span>{item.icon}</span>
                  <span className="text-[11px] uppercase tracking-[0.2em]">{item.label}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {[
                { id: 'documentation', label: 'Mis Documentos', icon: <FolderOpen size={20}/> },
                { id: 'service-desk', label: 'Service Desk', icon: <MessageSquare size={20}/> },
                { id: 'mis-datos', label: 'Mis Datos', icon: <UserIcon size={20}/> },
              ].map(item => (
                <button key={item.id} onClick={() => setCurrentTab(item.id)} className={`w-full flex items-center gap-5 px-7 py-5 rounded-[2rem] transition-all group ${currentTab === item.id ? 'bg-amber-600 text-white shadow-xl scale-105 font-black' : 'text-slate-400 hover:text-slate-600 font-bold'}`}>
                  <span>{item.icon}</span>
                  <span className="text-[11px] uppercase tracking-[0.2em]">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>
        <button onClick={() => { setCurrentUser(null); setLoginPassword(""); setLoginId(""); }} className="mt-auto flex items-center gap-5 px-7 py-6 text-slate-400 hover:text-rose-500 transition-all font-black text-[11px] uppercase tracking-widest border border-slate-200 rounded-[2rem] hover:bg-rose-500/5">
          <LogOut size={20} /> Cerrar Sesión
        </button>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-[100] flex justify-around items-center p-4">
        {currentUser.role === UserRole.ADMIN ? (
          <>
            {[
              { id: 'dashboard', icon: <BarChart3 size={20}/>, label: 'Panel' },
              { id: 'nomina', icon: <Briefcase size={20}/>, label: 'Nómina' },
              { id: 'documentation', icon: <FolderOpen size={20}/>, label: 'Docs' },
              { id: 'service-desk', icon: <MessageSquare size={20}/>, label: 'Desk' },
              { id: 'tasks', icon: <CheckCircle size={20}/>, label: 'Tareas' },
            ].map(item => (
              <button 
                key={item.id} 
                onClick={() => setCurrentTab(item.id)}
                className={`flex flex-col items-center gap-1 transition-all ${currentTab === item.id ? 'text-amber-600' : 'text-slate-400'}`}
              >
                {item.icon}
                <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            {[
              { id: 'documentation', icon: <FolderOpen size={20}/>, label: 'Docs' },
              { id: 'service-desk', icon: <MessageSquare size={20}/>, label: 'Desk' },
              { id: 'mis-datos', icon: <UserIcon size={20}/>, label: 'Perfil' },
            ].map(item => (
              <button 
                key={item.id} 
                onClick={() => setCurrentTab(item.id)}
                className={`flex flex-col items-center gap-1 transition-all ${currentTab === item.id ? 'text-amber-600' : 'text-slate-400'}`}
              >
                {item.icon}
                <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </>
        )}
        <button 
          onClick={() => { setCurrentUser(null); setLoginPassword(""); setLoginId(""); }}
          className="flex flex-col items-center gap-1 text-slate-400 active:text-rose-500"
        >
          <LogOut size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Salir</span>
        </button>
      </nav>

      <main className="flex-1 p-6 lg:p-20 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
          <div className="w-full flex justify-between items-start">
            <div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter mb-4">
                {currentTab === 'dashboard' ? 'Panel Administrador' : currentTab === 'nomina' ? 'Nómina Global' : currentTab === 'documentation' ? 'Archivo Digital' : currentTab === 'mis-datos' ? 'Mi Perfil' : currentTab === 'service-desk' ? 'Service Desk' : 'Seguimiento Tareas'}
              </h2>
              <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                <span className="flex items-center gap-2"><Shield size={14} className="text-amber-600" /> DQ Estudio Integral</span>
                <span className="hidden md:inline w-1 h-1 bg-slate-200 rounded-full"></span>
                <span className="hidden md:inline">{currentUser.role === UserRole.ADMIN ? 'Panel Administrativo' : 'Portal del Cliente'}</span>
              </div>
            </div>
            <div className="lg:hidden">
              <DQLogo size={50} showText={false} />
            </div>
          </div>
          <button onClick={syncData} className="w-full md:w-auto p-5 bg-white rounded-3xl text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-xl active:scale-90 flex items-center justify-center gap-3 border border-slate-200">
            {loading ? <Loader2 size={24} className="animate-spin" /> : <RefreshCw size={24} />}
            <span className="text-[10px] font-black uppercase tracking-widest pr-2">Actualizar Datos</span>
          </button>
        </header>

        {currentTab === 'dashboard' && currentUser.role === UserRole.ADMIN && (
          <div className="space-y-12 animate-in fade-in duration-700">
            {/* Bento Grid Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Side: 6 Metrics in 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Empresas Activas */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-600">
                      <Briefcase size={24} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                  </div>
                  <div>
                    <h4 className="text-4xl font-black text-slate-900 mb-1">{adminStats.totalActive}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Empresas Activas</p>
                  </div>
                </div>

                {/* Archivos Cloud */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-600">
                      <Cloud size={24} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Drive</span>
                  </div>
                  <div>
                    <h4 className="text-4xl font-black text-slate-900 mb-1">{adminStats.totalDocs}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Archivos Cloud</p>
                  </div>
                </div>

                {/* Tickets Pendientes */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-600">
                      <MessageSquare size={24} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desk</span>
                  </div>
                  <div>
                    <h4 className="text-4xl font-black text-slate-900 mb-1">{adminStats.pendingTickets}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tickets Pendientes</p>
                  </div>
                </div>

                {/* Sociedades Activas */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600">
                      <Building2 size={24} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest">{adminStats.participation['Sociedad']}%</span>
                  </div>
                  <div>
                    <h4 className="text-4xl font-black text-slate-900 mb-1">{adminStats.byType['Sociedad']}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sociedades Activas</p>
                  </div>
                </div>

                {/* Responsables Inscriptos */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-600">
                      <ShieldCheck size={24} />
                    </div>
                    <span className="text-[10px] font-black text-indigo-600/50 uppercase tracking-widest">{adminStats.participation['Responsable Inscripto']}%</span>
                  </div>
                  <div>
                    <h4 className="text-4xl font-black text-slate-900 mb-1">{adminStats.byType['Responsable Inscripto']}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resp. Inscriptos</p>
                  </div>
                </div>

                {/* Monotributos */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-600">
                      <UserCircle size={24} />
                    </div>
                    <span className="text-[10px] font-black text-orange-600/50 uppercase tracking-widest">{adminStats.participation['Monotributo']}%</span>
                  </div>
                  <div>
                    <h4 className="text-4xl font-black text-slate-900 mb-1">{adminStats.byType['Monotributo']}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monotributos Activos</p>
                  </div>
                </div>
              </div>

              {/* Right Side: Distribución por Responsable */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col group hover:border-amber-500/30 transition-all">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Distribución por Responsable</h4>
                  <Users size={18} className="text-slate-400" />
                </div>

                {/* Filter Tabs */}
                <div className="flex bg-slate-50 p-1 rounded-xl mb-8 border border-slate-200">
                  {['Todos', 'Sociedad', 'Responsable Inscripto', 'Monotributo'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setDistributionFilter(f as any)}
                      className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                        distributionFilter === f 
                          ? 'bg-amber-600 text-white shadow-lg' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f === 'Responsable Inscripto' ? 'R.I.' : f}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {Object.entries(adminStats.byResponsible).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, count]) => (
                    <div key={name} className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-slate-500 truncate max-w-[180px]">{name}</span>
                        <span className="text-slate-900">
                          {count as number} 
                          <span className="text-slate-400 ml-1">
                            ({(((count as number) / (adminStats.totalFilteredForDistribution || 1)) * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                          style={{ width: `${((count as number) / (adminStats.totalFilteredForDistribution || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {Object.keys(adminStats.byResponsible).length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                      <Users size={40} className="mb-4 text-slate-400" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin datos para este filtro</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-xl">
                <div className="flex items-center gap-4 mb-10">
                  <PieChart size={24} className="text-amber-600" />
                  <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-900">Participación por Tipo Fiscal</h4>
                </div>
                <div className="space-y-8">
                  {Object.entries(adminStats.byType).filter(([label, count]) => (count as number) > 0 || ['Monotributo', 'Responsable Inscripto', 'Sociedad'].includes(label)).map(([label, count]) => (
                    <div key={label} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</span>
                        <div className="text-right">
                          <span className="text-[14px] font-black text-slate-900 mr-2">{count}</span>
                          <span className="text-[10px] font-bold text-amber-600/60 uppercase">{adminStats.participation[label as keyof typeof adminStats.participation] || 0}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${adminStats.participation[label as keyof typeof adminStats.participation] || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-xl">
                <div className="flex items-center gap-4 mb-10">
                  <MapPin size={24} className="text-amber-600" />
                  <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-900">Distribución Territorial (Sedes)</h4>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {Object.entries(adminStats.bySede).filter(([_, count]) => (count as number) > 0).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-200">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                          <Building2 size={18} className="text-amber-600" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-slate-900">{count}</span>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Empresas Activas</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {currentTab === 'service-desk' && renderServiceDesk()}
        {currentTab === 'nomina' && renderNomina()}
        {currentTab === 'documentation' && renderDocumentation()}
        {currentTab === 'mis-datos' && renderClientProfile()}
        
        {currentTab === 'tasks' && currentUser.role === UserRole.ADMIN && renderPlanningTasks()}
      </main>

      {renderClientModal()}
    </div>
  );
};

export default App;

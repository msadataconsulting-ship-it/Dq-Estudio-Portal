
import React, { useState, useEffect, useMemo } from 'react';
import { User, Client, Task, UserRole, TaskStatus, TaxType, Ticket, TicketStatus } from './types';
import { INITIAL_STAFF, INITIAL_TASKS } from './constants';
// Import the Gemini service to provide AI insights
import { getSmartInsights } from './services/geminiService';
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
  Send,
  MessageCircle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

// --- CONFIGURACIÓN DE GOOGLE SHEETS ---
const PUB_TOKEN = "2PACX-1vTq_9cW8O3hFcZnwQ10MrqHWUfGQQQL-WAXumoRQfmFd7KlxwjTh1y6rIY_wBfNhiu4gJzi4cDH49SK";
const BASE_PUB_URL = `https://docs.google.com/spreadsheets/d/e/${PUB_TOKEN}/pub?output=csv`;

const CLIENTES_URL = `${BASE_PUB_URL}&gid=0`;
const DOCUMENTACION_URL = `${BASE_PUB_URL}&gid=1793561725`;

const DQLogo: React.FC<{ size?: number; showText?: boolean }> = ({ size = 120, showText = true }) => (
  <div className="flex flex-col items-center">
    <div className="relative flex items-center justify-center rounded-full overflow-hidden" 
         style={{ width: size, height: size, background: 'radial-gradient(circle, #2a2a2a 0%, #000 100%)' }}>
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
      <h2 className="mt-2 uppercase tracking-[0.3em] text-[8px] font-black text-white/60 font-logo">Estudio Integral</h2>
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
  const [loading, setLoading] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Gemini Insights State
  const [insights, setInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  // Service Desk State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '' });
  
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Activo' | 'Baja'>('Activo');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [docPeriodFilter, setDocPeriodFilter] = useState('Todos');
  const [docTypeFilter, setDocTypeFilter] = useState('Todos');

  // Load tickets from localStorage on init
  useEffect(() => {
    const savedTickets = localStorage.getItem('dq_tickets');
    if (savedTickets) {
      setTickets(JSON.parse(savedTickets));
    }
  }, []);

  // Save tickets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dq_tickets', JSON.stringify(tickets));
  }, [tickets]);

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
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delimiter && !inQuotes) {
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
        obj[header] = values[i]?.replace(/^"|"$/g, '').trim() || '';
      });
      return obj;
    });
    return { headers, rows, isHtml: false };
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const resCl = await fetch(CLIENTES_URL);
      const csvCl = await resCl.text();
      const parsedCl = parseCSV(csvCl);
      
      if (!parsedCl.isHtml) {
        const mappedClients: Client[] = parsedCl.rows.map((row, i) => ({
          id: `c-${i}`,
          cuit: row['CUIT'] || '',
          cuitSociedad: row['CUIT SOCIEDAD'] || '',
          name: row['CLIENTE'] || 'Sin Nombre',
          type: row['TIPO DE CLIENTE'] || 'S/D',
          status: normalizeStr(row['ESTADO CLIENTE']).includes('ACTIVO') ? 'Activo' : 'Baja',
          phone: row['TELEFONO1'] || '',
          phone2: row['TELEFONO 2'] || '',
          whatsapp: row['WHATSAPP'] || '',
          email: row['MAIL'] || '',
          appPassword: row['Contraseña App'] || '',
          hasEmployees: normalizeStr(row['TIENE EMPLEADOS']) === 'SI',
          employeeCount: parseInt(row['CANTIDAD EMPLEADOS']) || 0,
          mainActivity: row['ACTIVIDAD PRINCIPAL'] || 'N/A',
          hasLocal: normalizeStr(row['LOCAL COMERCIAL']) === 'SI',
          monotributoCategory: row['CATEGORIA MONOTRIBUTO'] || 'N/A',
          tributoCategory: row['CATEGORIA TRIBUTO'] || 'N/A',
          address: row['DIRECCIÓN'] || '',
          location: row['LOCALIDAD'] || '',
          province: row['PROVINCIA'] || '',
          dqSede: row['SEDE CLIENTE'] || 'Sede Lomas',
          mainBank: row['BANCO'] || '',
          claveAfip: row['CLAVE AFIP'] || '',
          claveAgip: row['CLAVE AGIP'] || '',
          claveArba: row['CLAVE ARBA'] || '',
          cuentaMuni: row['CUENTA MUNI'] || '',
          claveMuni: row['CLAVE MUNI'] || '',
          claveSindicatos: row['CLAVE SINDICATOS'] || '',
          fechaAlta: row['FECHA DE ALTA CLIENTE'] || '',
          usuarioCreacion: row['USUARIO DE CREACION'] || '',
          fechaBaja: row['FECHA DE BAJA CLIENTE'] || '',
          motivoBaja: row['MOTIVO DE BAJA'] || '',
          usuarioBaja: row['USUARIO DE BAJA'] || '',
          assignedStaffId: row['Responsable del cliente'] || 'N/A',
          taxConfig: []
        }));
        setClients(mappedClients);
      }

      const resDoc = await fetch(DOCUMENTACION_URL);
      const csvDoc = await resDoc.text();
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
    } catch (e) {
      console.error(e);
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

  const handleCreateTicket = (e: React.FormEvent) => {
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

    setTickets([newTicketObj, ...tickets]);
    setNewTicket({ title: '', description: '' });
    setIsTicketModalOpen(false);
  };

  const handleUpdateTicketStatus = (ticketId: string, newStatus: TicketStatus) => {
    setTickets(tickets.map(t => 
      t.id === ticketId 
        ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } 
        : t
    ));
  };

  // Function to call Gemini for smart insights
  const generateAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await getSmartInsights(clients, INITIAL_TASKS);
      setInsights(res);
    } catch (error) {
      console.error("Error generating insights:", error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const currentClientData = useMemo(() => {
    if (!currentUser || currentUser.role !== UserRole.CLIENT) return null;
    return clients.find(c => c.id === currentUser.associatedClientId) || null;
  }, [currentUser, clients]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.cuit.includes(searchQuery);
      return matchesStatus && matchesSearch;
    });
  }, [clients, statusFilter, searchQuery]);

  const adminStats = useMemo(() => {
    const activeClientsList = clients.filter(c => c.status === 'Activo');
    const totalActive = activeClientsList.length;

    const byType = {
      'Monotributo': 0,
      'Responsable Inscripto': 0,
      'Sociedad': 0,
      'Otros': 0
    };

    const bySede = {
      'Sede Lomas': 0,
      'Sede Canning': 0,
      'Otros': 0
    };

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

      if (c.hasEmployees) {
        employersCount++;
        totalEmployees += c.employeeCount || 0;
      }
    });

    return {
      totalActive,
      totalDocs: allDocuments.length,
      byType,
      bySede,
      employersCount,
      totalEmployees,
      participation: {
        'Monotributo': totalActive ? ((byType['Monotributo'] / totalActive) * 100).toFixed(1) : 0,
        'Responsable Inscripto': totalActive ? ((byType['Responsable Inscripto'] / totalActive) * 100).toFixed(1) : 0,
        'Sociedad': totalActive ? ((byType['Sociedad'] / totalActive) * 100).toFixed(1) : 0,
        'Otros': totalActive ? ((byType['Otros'] / totalActive) * 100).toFixed(1) : 0,
      }
    };
  }, [clients, allDocuments]);

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
      const docNameUpper = d.name.toUpperCase();
      let matchesType = false;
      if (docTypeFilter === 'Todos') matchesType = true;
      else if (docTypeFilter === 'INGRESOS BRUTOS') matchesType = docNameUpper.includes('INGRESOS BRUTOS') || docNameUpper.includes('IIBB');
      else matchesType = docNameUpper.includes(docTypeFilter.toUpperCase());
      return matchesPeriod && matchesType;
    });
  }, [allDocuments, docPeriodFilter, docTypeFilter, currentUser, currentClientData]);

  // Service Desk Component
  const renderServiceDesk = () => {
    const displayTickets = currentUser?.role === UserRole.CLIENT 
      ? tickets.filter(t => t.clientId === currentClientData?.id)
      : tickets;

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Service Desk</h3>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
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
            <div key={ticket.id} className="bg-[#1e2128] border border-white/5 rounded-[2.5rem] p-8 hover:border-white/10 transition-all group">
              <div className="flex flex-col lg:flex-row justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4">
                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      ticket.status === TicketStatus.OPEN ? 'bg-amber-500/10 text-amber-500' :
                      ticket.status === TicketStatus.IN_ANALYSIS ? 'bg-blue-500/10 text-blue-500' :
                      ticket.status === TicketStatus.RESOLVED ? 'bg-emerald-500/10 text-emerald-500' :
                      'bg-slate-500/10 text-slate-500'
                    }`}>
                      {ticket.status}
                    </span>
                    <span className="text-[9px] font-bold text-slate-700 font-mono">#{ticket.id}</span>
                  </div>
                  <div>
                    {currentUser?.role === UserRole.ADMIN && (
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">{ticket.clientName}</p>
                    )}
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">{ticket.title}</h4>
                    <p className="text-[12px] text-slate-400 mt-2 leading-relaxed">{ticket.description}</p>
                  </div>
                  <div className="flex items-center gap-6 text-[9px] font-bold text-slate-600 uppercase tracking-widest pt-2">
                    <span className="flex items-center gap-2"><Clock size={12}/> {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-2"><RefreshCw size={12}/> ACT: {new Date(ticket.updatedAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                {currentUser?.role === UserRole.ADMIN && (
                  <div className="flex flex-col justify-center gap-3 bg-[#0f1115] p-6 rounded-3xl border border-white/5 min-w-[240px]">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center mb-2">Cambiar Estado</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(TicketStatus).map(status => (
                        <button
                          key={status}
                          onClick={() => handleUpdateTicketStatus(ticket.id, status)}
                          disabled={ticket.status === status}
                          className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all ${
                            ticket.status === status 
                              ? 'bg-amber-600 text-white' 
                              : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white'
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
            <div className="bg-[#1e2128] border border-white/5 rounded-[4rem] p-32 text-center opacity-40">
              <MessageSquare size={64} className="mx-auto mb-8 text-slate-800" />
              <p className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-600">No hay tickets registrados en este momento.</p>
            </div>
          )}
        </div>

        {/* Modal Nuevo Ticket */}
        {isTicketModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsTicketModalOpen(false)} />
            <div className="relative w-full max-w-2xl bg-[#1e2128] border border-white/10 rounded-[3.5rem] shadow-2xl p-12 overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Nueva Solicitud</h3>
                <button onClick={() => setIsTicketModalOpen(false)} className="p-4 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateTicket} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Asunto / Título</label>
                  <input 
                    required
                    type="text" 
                    value={newTicket.title}
                    onChange={(e) => setNewTicket({...newTicket, title: e.target.value})}
                    placeholder="EJ: CAMBIO DE CUIT, CONSULTA LIQUIDACIÓN..." 
                    className="w-full bg-[#0f1115] px-8 py-5 rounded-2xl border border-white/5 text-white text-sm outline-none focus:border-amber-500/40 transition-all font-bold tracking-wider placeholder:text-slate-800" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Descripción Detallada</label>
                  <textarea 
                    required
                    rows={5}
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                    placeholder="DESCRIBA AQUÍ SU CONSULTA O SOLICITUD DE FORMA CLARA..." 
                    className="w-full bg-[#0f1115] px-8 py-5 rounded-2xl border border-white/5 text-white text-sm outline-none focus:border-amber-500/40 transition-all font-bold tracking-wider placeholder:text-slate-800 resize-none" 
                  />
                </div>
                <button type="submit" className="w-full py-6 bg-amber-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-amber-900/20 hover:bg-amber-500 transition-all">
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
      <div className="flex flex-col md:flex-row gap-4 bg-[#1e2128] p-4 rounded-3xl border border-white/5 shadow-xl">
        <div className="flex-1 flex items-center gap-4 bg-[#0f1115] px-6 py-4 rounded-2xl border border-white/5">
          <Filter size={18} className="text-slate-600" />
          <div className="flex flex-col flex-1">
            <label className="text-[8px] font-black text-slate-700 uppercase tracking-widest ml-1 mb-1">Periodo</label>
            <select 
              value={docPeriodFilter}
              onChange={(e) => setDocPeriodFilter(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase text-white outline-none w-full appearance-none cursor-pointer"
            >
              <option value="Todos" className="bg-[#1e2128]">Todos los periodos</option>
              {docPeriods.map(p => <option key={p} value={p} className="bg-[#1e2128]">{p}</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex-1 flex items-center gap-4 bg-[#0f1115] px-6 py-4 rounded-2xl border border-white/5">
          <FileText size={18} className="text-slate-600" />
          <div className="flex flex-col flex-1">
            <label className="text-[8px] font-black text-slate-700 uppercase tracking-widest ml-1 mb-1">Categoría</label>
            <select 
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase text-white outline-none w-full appearance-none cursor-pointer"
            >
              <option value="Todos" className="bg-[#1e2128]">Todos los tipos</option>
              {docTypes.map(t => <option key={t} value={t} className="bg-[#1e2128]">{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[#1e2128] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#16191f] border-b border-white/5">
              <tr>
                {currentUser?.role === UserRole.ADMIN && (
                  <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Empresa / CUIT</th>
                )}
                <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Periodo</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Comprobante</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredDocs.length > 0 ? filteredDocs.map(doc => (
                <tr key={doc.id} className="group hover:bg-white/[0.03] transition-colors">
                  {currentUser?.role === UserRole.ADMIN && (
                    <td className="px-10 py-5">
                      <p className="text-[11px] font-black text-white uppercase">{doc.clientName}</p>
                      <p className="text-[9px] font-bold text-slate-600 font-mono mt-0.5">{doc.clientCuit}</p>
                    </td>
                  )}
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-700" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{doc.periodo}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                        <FileText size={16} />
                      </div>
                      <p className="text-[11px] font-bold text-slate-300 uppercase tracking-tight group-hover:text-amber-500 transition-colors">{doc.name}</p>
                    </div>
                  </td>
                  <td className="px-10 py-5 text-right">
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-amber-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      <ExternalLink size={12} /> Abrir Drive
                    </a>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={currentUser?.role === UserRole.ADMIN ? 4 : 3} className="py-40 text-center">
                    <FolderOpen size={64} className="mx-auto text-slate-800 mb-8 opacity-20" />
                    <p className="text-[12px] font-black text-slate-600 uppercase tracking-[0.4em]">No se encontraron documentos en esta sección.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const Section = ({ title, icon: Icon, children }: any) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Icon size={16} className="text-amber-500" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {children}
      </div>
    </div>
  );

  const Field = ({ label, value, isCode = false, fullWidth = false }: any) => (
    <div className={`space-y-1 ${fullWidth ? 'md:col-span-2 lg:col-span-3' : ''}`}>
      <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">{label}</p>
      <div className={`text-[11px] font-black uppercase ${isCode ? 'font-mono text-amber-500/80' : 'text-slate-200'}`}>
        {value || '---'}
      </div>
    </div>
  );

  const renderClientProfile = () => {
    if (!currentClientData) return null;
    const c = currentClientData;
    return (
      <div className="space-y-12 animate-in fade-in duration-500 bg-[#1e2128] p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <UserIcon size={200} className="text-amber-500" />
        </div>
        
        <header className="mb-8">
           <div className="flex items-center gap-3 mb-4">
              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${c.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {c.status}
              </span>
              <span className="bg-white/5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">
                {c.type}
              </span>
           </div>
           <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{c.name}</h3>
           <p className="text-[12px] font-bold text-slate-500 mt-4 flex items-center gap-3">
             <Hash size={14} className="text-amber-500/50" /> 
             <span className="font-mono">CUIT: {c.cuit}</span> 
             {c.cuitSociedad && <><span className="opacity-20">|</span> <span className="font-mono">SOCIEDAD: {c.cuitSociedad}</span></>}
           </p>
        </header>

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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in zoom-in duration-300">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setSelectedClient(null)} />
        <div className="relative w-full max-w-6xl max-h-[90vh] bg-[#1e2128] border border-white/10 rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-[#16191f] px-12 py-10 border-b border-white/5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${c.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {c.status}
                </span>
                <span className="bg-white/5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">
                  {c.type}
                </span>
              </div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{c.name}</h3>
              <p className="text-[12px] font-bold text-slate-500 mt-3 flex items-center gap-3">
                <Hash size={14} className="text-amber-500/50" /> 
                <span className="font-mono">CUIT: {c.cuit}</span> 
                {c.cuitSociedad && <><span className="opacity-20">|</span> <span className="font-mono">SOCIEDAD: {c.cuitSociedad}</span></>}
              </p>
            </div>
            <button onClick={() => setSelectedClient(null)} className="p-4 bg-white/5 rounded-3xl text-slate-500 hover:text-white hover:bg-white/10 transition-all active:scale-90">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
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

  const renderNomina = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#1e2128] p-4 rounded-3xl border border-white/5">
        <div className="flex items-center gap-3 bg-[#0f1115] px-6 py-4 rounded-2xl border border-white/5 flex-1 w-full group">
          <Search size={20} className="text-slate-600 group-focus-within:text-amber-500 transition-colors" />
          <input 
            type="text" 
            placeholder="BUSCAR POR NOMBRE O CUIT..." 
            className="bg-transparent text-[11px] font-black uppercase text-white outline-none w-full placeholder:text-slate-800 tracking-widest"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 p-1.5 bg-[#0f1115] rounded-2xl border border-white/5">
          {(['Todos', 'Activo', 'Baja'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${statusFilter === f ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-600 hover:text-slate-400'}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="bg-[#1e2128] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#16191f] border-b border-white/5">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Empresa</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">CUIT</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Tipo</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">Teléfono</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredClients.map(c => (
                <tr key={c.id} onClick={() => setSelectedClient(c)} className="group hover:bg-white/[0.03] cursor-pointer transition-all">
                  <td className="px-10 py-5">
                    <p className="text-[12px] font-black text-white uppercase group-hover:text-amber-500 transition-colors">{c.name}</p>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider truncate max-w-[200px] mt-1">{c.mainActivity}</p>
                  </td>
                  <td className="px-8 py-5 text-[11px] font-bold text-slate-400 font-mono">{c.cuit}</td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black text-slate-500 uppercase bg-white/5 px-3 py-1 rounded-lg">{c.type}</span>
                  </td>
                  <td className="px-8 py-5 text-[11px] font-black text-slate-400 font-mono">{c.phone || '---'}</td>
                  <td className="px-10 py-5 text-right">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${c.status === 'Activo' ? 'text-emerald-500' : 'text-rose-500'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex flex-col items-center justify-center p-8 wood-pattern">
        <div className="w-full max-w-md bg-[#1e2128] border border-white/5 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
          <div className="mb-16 text-center scale-110"><DQLogo size={140} /></div>
          <div className="flex bg-[#0f1115] p-2 rounded-2xl mb-12 border border-white/5">
            <button onClick={() => setViewMode(UserRole.ADMIN)} className={`flex-1 py-5 text-[10px] font-black uppercase rounded-xl transition-all ${viewMode === UserRole.ADMIN ? 'bg-white text-slate-900 shadow-2xl' : 'text-slate-600'}`}>Estudio</button>
            <button onClick={() => setViewMode(UserRole.CLIENT)} className={`flex-1 py-5 text-[10px] font-black uppercase rounded-xl transition-all ${viewMode === UserRole.CLIENT ? 'bg-white text-slate-900 shadow-2xl' : 'text-slate-600'}`}>Clientes</button>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Usuario / Email</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700">
                    <UserCircle size={18} />
                  </div>
                  <input 
                    type="text" 
                    value={loginId} 
                    onChange={(e) => setLoginId(e.target.value)} 
                    placeholder={viewMode === UserRole.ADMIN ? "USUARIO ADMINISTRADOR" : "SU@EMAIL.COM"} 
                    className="w-full bg-[#0f1115] pl-14 pr-6 py-6 rounded-[2rem] border border-white/5 text-white text-sm outline-none focus:border-amber-500/40 transition-all font-bold placeholder:text-slate-800 tracking-wider" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Contraseña</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={(e) => setLoginPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="w-full bg-[#0f1115] pl-14 pr-6 py-6 rounded-[2rem] border border-white/5 text-white text-sm outline-none focus:border-amber-500/40 transition-all font-bold placeholder:text-slate-800 tracking-wider" 
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
    <div className="flex min-h-screen bg-[#0f1115] text-slate-200">
      <aside className="w-80 bg-[#1e2128] border-r border-white/5 hidden lg:flex flex-col p-10 sticky top-0 h-screen z-50 shadow-2xl">
        <div className="mb-20"><DQLogo size={100} /></div>
        <nav className="flex-1 space-y-6">
          {currentUser.role === UserRole.ADMIN ? (
            <>
              {[
                { id: 'dashboard', label: 'Panel Administrador', icon: <BarChart3 size={20}/> },
                { id: 'nomina', label: 'Nómina Global', icon: <Briefcase size={20}/> },
                { id: 'documentation', label: 'Documentación', icon: <FolderOpen size={20}/> },
                { id: 'service-desk', label: 'Service Desk', icon: <MessageSquare size={20}/> },
                { id: 'tasks', label: 'Agenda Fiscal', icon: <Calendar size={20}/> },
              ].map(item => (
                <button key={item.id} onClick={() => setCurrentTab(item.id)} className={`w-full flex items-center gap-5 px-7 py-5 rounded-[2rem] transition-all group ${currentTab === item.id ? 'bg-amber-600 text-white shadow-2xl scale-105 font-black' : 'text-slate-600 hover:text-slate-300 font-bold'}`}>
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
                <button key={item.id} onClick={() => setCurrentTab(item.id)} className={`w-full flex items-center gap-5 px-7 py-5 rounded-[2rem] transition-all group ${currentTab === item.id ? 'bg-amber-600 text-white shadow-2xl scale-105 font-black' : 'text-slate-600 hover:text-slate-300 font-bold'}`}>
                  <span>{item.icon}</span>
                  <span className="text-[11px] uppercase tracking-[0.2em]">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>
        <button onClick={() => { setCurrentUser(null); setLoginPassword(""); setLoginId(""); }} className="mt-auto flex items-center gap-5 px-7 py-6 text-slate-600 hover:text-rose-500 transition-all font-black text-[11px] uppercase tracking-widest border border-white/5 rounded-[2rem] hover:bg-rose-500/5">
          <LogOut size={20} /> Cerrar Sesión
        </button>
      </aside>

      <main className="flex-1 p-8 lg:p-20 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
          <div>
            <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">
              {currentTab === 'dashboard' ? 'Panel Administrador' : currentTab === 'nomina' ? 'Nómina Global' : currentTab === 'documentation' ? 'Archivo Digital' : currentTab === 'mis-datos' ? 'Mi Perfil' : currentTab === 'service-desk' ? 'Service Desk' : 'Agenda Fiscal'}
            </h2>
            <div className="flex items-center gap-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
              <span className="flex items-center gap-2"><Shield size={14} className="text-amber-500" /> DQ Estudio Integral</span>
              <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
              <span>{currentUser.role === UserRole.ADMIN ? 'Panel Administrativo' : 'Portal del Cliente'}</span>
            </div>
          </div>
          <button onClick={syncData} className="p-5 bg-white/5 rounded-3xl text-amber-500 hover:bg-amber-600 hover:text-white transition-all shadow-2xl active:scale-90 flex items-center gap-3 border border-white/5">
            {loading ? <Loader2 size={24} className="animate-spin" /> : <RefreshCw size={24} />}
            <span className="hidden md:block text-[10px] font-black uppercase tracking-widest pr-2">Actualizar</span>
          </button>
        </header>

        {currentTab === 'dashboard' && currentUser.role === UserRole.ADMIN && (
          <div className="space-y-12 animate-in fade-in duration-700">
            {/* Gemini AI Insights Component */}
            <div className="bg-[#1e2128] p-12 rounded-[4rem] border border-amber-500/20 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-5 text-amber-500 group-hover:scale-110 group-hover:opacity-10 transition-all pointer-events-none">
                <ShieldCheck size={120} />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tighter">Asistente IA Estratégico</h4>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">Análisis predictivo de su cartera de clientes</p>
                  </div>
                </div>
                <button 
                  onClick={generateAIInsights}
                  disabled={loadingInsights}
                  className="px-8 py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {loadingInsights ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                  {insights ? 'Regenerar Análisis' : 'Generar Análisis IA'}
                </button>
              </div>
              
              {insights ? (
                <div className="bg-[#0f1115] p-8 rounded-3xl border border-white/5 animate-in slide-in-from-top-4 duration-500">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-[13px] font-medium italic">
                      {insights}
                    </p>
                  </div>
                </div>
              ) : !loadingInsights && (
                <div className="text-center py-10 opacity-30">
                  <Info size={40} className="mx-auto mb-4 text-slate-600" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Haga clic en el botón para obtener recomendaciones estratégicas basadas en sus datos reales.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-[#1e2128] p-10 rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl group hover:border-emerald-500/30 transition-all">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Empresas Activas</p>
                <h3 className="text-5xl font-black text-white">{adminStats.totalActive}</h3>
                <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-500 group-hover:scale-110 group-hover:opacity-10 transition-all"><UserCheck size={50}/></div>
              </div>
              <div className="bg-[#1e2128] p-10 rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl group hover:border-amber-500/30 transition-all">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Archivos Cloud</p>
                <h3 className="text-5xl font-black text-white">{adminStats.totalDocs}</h3>
                <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-500 group-hover:scale-110 group-hover:opacity-10 transition-all"><HardDrive size={50}/></div>
              </div>
              <div className="bg-[#1e2128] p-10 rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl group hover:border-blue-500/30 transition-all">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Empleadores Activos</p>
                <h3 className="text-5xl font-black text-white">{adminStats.employersCount}</h3>
                <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-500 group-hover:scale-110 group-hover:opacity-10 transition-all"><Users size={50}/></div>
              </div>
              <div className="bg-[#1e2128] p-10 rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl group hover:border-purple-500/30 transition-all">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Tickets Pendientes</p>
                <h3 className="text-5xl font-black text-white">{tickets.filter(t => t.status !== TicketStatus.CLOSED && t.status !== TicketStatus.RESOLVED).length}</h3>
                <div className="absolute top-0 right-0 p-8 opacity-5 text-purple-500 group-hover:scale-110 group-hover:opacity-10 transition-all"><MessageSquare size={50}/></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="bg-[#1e2128] p-12 rounded-[4rem] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-4 mb-10">
                  <PieChart size={24} className="text-amber-500" />
                  <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-white">Participación por Tipo Fiscal</h4>
                </div>
                <div className="space-y-8">
                  {Object.entries(adminStats.byType).filter(([label, count]) => count > 0 || ['Monotributo', 'Responsable Inscripto', 'Sociedad'].includes(label)).map(([label, count]) => (
                    <div key={label} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</span>
                        <div className="text-right">
                          <span className="text-[14px] font-black text-white mr-2">{count}</span>
                          <span className="text-[10px] font-bold text-amber-500/60 uppercase">{adminStats.participation[label as keyof typeof adminStats.participation] || 0}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${adminStats.participation[label as keyof typeof adminStats.participation] || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#1e2128] p-12 rounded-[4rem] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-4 mb-10">
                  <MapPin size={24} className="text-amber-500" />
                  <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-white">Distribución Territorial (Sedes)</h4>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {Object.entries(adminStats.bySede).filter(([_, count]) => count > 0).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between p-6 bg-[#0f1115] rounded-3xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                          <Building2 size={18} className="text-amber-500" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">{label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">{count}</span>
                        <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">Empresas Activas</p>
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
        
        {currentTab === 'tasks' && currentUser.role === UserRole.ADMIN && (
          <div className="bg-[#1e2128] p-32 rounded-[4rem] border border-white/5 text-center shadow-2xl relative overflow-hidden">
             <Calendar size={64} className="mx-auto text-amber-500 mb-8 opacity-20" />
             <h4 className="text-2xl font-black text-white uppercase mb-4 tracking-tighter">Agenda Fiscal Integrada</h4>
             <p className="text-[11px] font-bold text-slate-600 uppercase tracking-[0.3em] max-w-md mx-auto leading-loose">Próximamente: Vinculación automática con el calendario de vencimientos AFIP/ARBA/AGIP.</p>
          </div>
        )}
      </main>

      {renderClientModal()}
    </div>
  );
};

export default App;

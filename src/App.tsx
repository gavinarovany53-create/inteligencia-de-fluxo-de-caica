import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  TrendingDown, 
  TrendingUp, 
  Wallet, 
  AlertCircle,
  Plus,
  ArrowRightLeft,
  Settings,
  PieChart,
  Bell,
  Search,
  Menu,
  Filter,
  Download,
  X,
  LogOut,
  Loader2,
  Lock,
  ShieldCheck,
  Save,
  Bot,
  MessageSquare,
  Sparkles,
  RefreshCw,
  FileText,
  CreditCard,
  Check,
  Activity,
  Target,
  Printer,
  HelpCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDocFromServer } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Data Models ---
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  lgpdConsent: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Transaction {
  id: string;
  uid: string;
  description: string;
  amount: number;
  type: string;
  tax: number;
  status: string;
  date: string;
  createdAt: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou a sua Atendente Virtual CashFlow Intelligence. Como posso ajudar com seu Split Payment ou fluxo de caixa hoje?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Profile Form state
  const [phoneInput, setPhoneInput] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTx, setNewTx] = useState({ description: '', amount: '', type: 'sale' });
  const [billingCycleAnnual, setBillingCycleAnnual] = useState(true);

  // Test Firestore Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoadingAuth(false);
        setUserProfile(null);
        return;
      }
      
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDocFromServer(userRef);
        
        if (userSnap.exists()) {
          const profile = userSnap.data() as UserProfile;
          setUserProfile(profile);
          setPhoneInput(profile.phone);
          setLgpdConsent(profile.lgpdConsent);
        } else {
          // If no profile, they haven't onboarded fully yet
          setActiveTab('profile'); // Force them to onboarding/profile screen
        }
      } catch (error) {
         handleFirestoreError(error, OperationType.GET, 'users');
      } finally {
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Listener
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchTransactions: Transaction[] = [];
        snapshot.forEach((doc) => {
          fetchTransactions.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        setTransactions(fetchTransactions);
        setIsLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setTransactions([]);
      setUserProfile(null);
      setPhoneInput('');
      setLgpdConsent(false);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const amountNum = parseFloat(newTx.amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const taxRate = 0.265;
    const tax = newTx.type === 'sale' ? amountNum * taxRate : 0;
    const finalAmount = newTx.type === 'sale' ? amountNum : -amountNum;

    const newTransactionData = {
      uid: user.uid,
      date: new Date().toISOString().split('T')[0],
      description: newTx.description || 'Nova Transação',
      amount: finalAmount,
      type: newTx.type,
      tax: tax,
      status: 'completed',
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'transactions'), newTransactionData);
      setIsModalOpen(false);
      setNewTx({ description: '', amount: '', type: 'sale' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const demoData = [
        { description: 'Consultoria Financeira', amount: 8500, type: 'sale', daysAgo: 10 },
        { description: 'Licenças de Software', amount: -600, type: 'expense', daysAgo: 9 },
        { description: 'Venda de Projeto ERP', amount: 24000, type: 'sale', daysAgo: 8 },
        { description: 'Despesas de Marketing', amount: -1500, type: 'expense', daysAgo: 7 },
        { description: 'Venda de Licença Prata', amount: 3500, type: 'sale', daysAgo: 6 },
        { description: 'Material de Escritório', amount: -250, type: 'expense', daysAgo: 5 },
        { description: 'Manutenção Servidor', amount: -800, type: 'expense', daysAgo: 4 },
        { description: 'Mentoria Premium', amount: 15000, type: 'sale', daysAgo: 3 },
        { description: 'Curso Online (Lote 1)', amount: 12000, type: 'sale', daysAgo: 2 },
        { description: 'Assessorias Diversas', amount: 4500, type: 'sale', daysAgo: 1 },
        { description: 'Projeto de Automação', amount: 9000, type: 'sale', daysAgo: 0 },
      ];

      const batchPromises = demoData.map(item => {
        const d = new Date();
        d.setDate(d.getDate() - item.daysAgo);
        const taxRate = 0.265;
        const tax = item.type === 'sale' ? item.amount * taxRate : 0;
        const finalAmount = item.type === 'sale' ? item.amount : item.amount;
        
        return addDoc(collection(db, 'transactions'), {
          uid: user.uid,
          date: d.toISOString().split('T')[0],
          description: item.description,
          amount: finalAmount,
          type: item.type,
          tax: tax,
          status: 'completed',
          createdAt: Date.now() - (item.daysAgo * 86400000)
        });
      });

      await Promise.all(batchPromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lgpdConsent) return;

    setIsSavingProfile(true);
    const ts = Date.now();
    const profileData: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Usuário',
      phone: phoneInput,
      lgpdConsent: lgpdConsent,
      createdAt: userProfile?.createdAt || ts,
      updatedAt: ts
    };

    try {
      // NOTE: Using setDoc with { merge: true } might be safer, but our rules strictly enforce all fields anyway.
      // We'll use setDoc (this equates to a write operation, which in SDK maps to create or update).
      // Here we import setDoc from firestore later or just add it to imports.
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', user.uid), profileData);
      setUserProfile(profileData);
      
      // If they just onboarded and gave consent, send them to dashboard
      if (activeTab === 'profile') {
        setActiveTab('dashboard');
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Data', 'Tipo', 'Descrição', 'Valor Bruto', 'Imposto Retido', 'Valor Líquido', 'Status'];
    const rows = transactions.map(t => [
      t.id.substring(0, 8), 
      t.date, 
      t.type === 'sale' ? 'Venda/Entrada' : 'Despesa/Saída', 
      t.description, 
      Math.abs(t.amount).toFixed(2), 
      t.tax.toFixed(2), 
      (Math.abs(t.amount) - t.tax).toFixed(2), 
      t.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cashflow_intelligence_extrato.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Handle responsive sidebar behavior on mount and resize
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };
  
  // Derive Chart Data from real transactions
  const data = useMemo(() => {
    if (transactions.length === 0) return [];
    
    // Group transactions by date
    const groupedByDate: Record<string, { vendasBrutas: number, impostoRetido: number, receitaLiquida: number, despesas: number }> = {};
    
    // Sort oldest to newest for chart progression
    const sortedTx = [...transactions].sort((a, b) => a.createdAt - b.createdAt);
    
    sortedTx.forEach(tx => {
      const d = tx.date;
      if (!groupedByDate[d]) {
        groupedByDate[d] = { vendasBrutas: 0, impostoRetido: 0, receitaLiquida: 0, despesas: 0 };
      }
      if (tx.type === 'sale') {
        groupedByDate[d].vendasBrutas += Math.abs(tx.amount);
        groupedByDate[d].impostoRetido += tx.tax;
        groupedByDate[d].receitaLiquida += (Math.abs(tx.amount) - tx.tax);
      } else {
        groupedByDate[d].despesas += Math.abs(tx.amount);
      }
    });

    const chartData = [];
    let currentCapital = 50000; // Starting capital assumption (mocked base)
    
    let dayCounter = 1;
    for (const [date, daily] of Object.entries(groupedByDate)) {
      currentCapital = currentCapital + daily.receitaLiquida - daily.despesas;
      
      chartData.push({
        day: dayCounter++,
        date: date,
        vendasBrutas: daily.vendasBrutas,
        impostoRetido: daily.impostoRetido,
        receitaLiquida: daily.receitaLiquida,
        despesas: daily.despesas,
        capitalGiro: currentCapital,
        necessidadeCapital: currentCapital < 10000 ? 10000 - currentCapital : 0
      });
    }

    // Always ensure at least 1 point so charts don't crash
    if (chartData.length === 0) {
       chartData.push({
        day: 1,
        date: new Date().toISOString().split('T')[0],
        vendasBrutas: 0,
        impostoRetido: 0,
        receitaLiquida: 0,
        despesas: 0,
        capitalGiro: 50000,
        necessidadeCapital: 0
       });
    }
    return chartData;
  }, [transactions]);
  
  const totals = useMemo(() => {
    return data.reduce((acc, curr) => ({
      vendasBrutas: acc.vendasBrutas + curr.vendasBrutas,
      impostoRetido: acc.impostoRetido + curr.impostoRetido,
      receitaLiquida: acc.receitaLiquida + curr.receitaLiquida,
      despesas: acc.despesas + curr.despesas,
    }), { vendasBrutas: 0, impostoRetido: 0, receitaLiquida: 0, despesas: 0 });
  }, [data]);

  const currentCapital = data.length > 0 ? data[data.length - 1].capitalGiro : 50000;
  const isDeficit = currentCapital < 20000;

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CashFlow<span className="text-blue-600">Intelligence</span></h1>
            <p className="mt-2 text-sm text-gray-600">
              Gestão inteligente para o novo cenário do Split Payment.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Receipt className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Automação IBS/CBS</p>
                <p className="text-[10px] text-gray-500">Cálculo instantâneo de retenções.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Fluxo de Caixa com IA</p>
                <p className="text-[10px] text-gray-500">Projeções otimizadas para 2026.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="p-2 bg-slate-100 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Segurança de Dados</p>
                <p className="text-[10px] text-gray-500">Conformidade total com a LGPD.</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-gray-900"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Entrar com Google
          </button>

          <p className="text-xs text-center text-gray-500">
            Acessando com segurança pelo Google Cloud Identity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* AI Chatbot FAB & Window */}
      <div className="fixed bottom-6 right-6 z-[60]">
        {!isChatOpen ? (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl shadow-blue-300 transition-all hover:scale-110 flex items-center justify-center group"
            title="Atendente Virtual"
          >
            <Bot size={28} className="group-hover:rotate-12 transition-transform" />
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[350px] md:w-[400px] h-[550px] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500 rounded-lg">
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Atendente Virtual</h4>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-slate-400">Online 24/7</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                title="Fechar chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Form */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatInput.trim()) return;
                  const userText = chatInput;
                  setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
                  setChatInput('');
                  
                  // Mock AI Response
                  setTimeout(() => {
                    let response = "Olá! Como especialista em Split Payment, entendi que você quer saber mais sobre \"" + userText + "\". No cenário de 2026, a retenção de IBS/CBS é automática pela rede adquirente.";
                    
                    if (userText.toLowerCase().includes('ajuda') || userText.toLowerCase().includes('como usar')) {
                      response = "Claro! Para começar, complete seu perfil na aba 'Privacidade & Dados'. Depois, você já pode registrar suas transações e ver o saldo líquido projetado.";
                    } else if (userText.toLowerCase().includes('contato') || userText.toLowerCase().includes('suporte')) {
                      response = "Eu sou sua assistente virtual disponível 24h! Para questões de faturamento ou planos Pro/Enterprise, você pode consultar a aba de Assinaturas.";
                    }
                    
                    setChatMessages(prev => [...prev, { role: 'assistant', text: response }]);
                  }, 800);
                }}
                className="flex items-center gap-2"
              >
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Como posso ajudar hoje?"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim()}
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
                >
                  <ArrowRightLeft size={18} className="rotate-90" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900 overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:relative z-50 h-full bg-slate-900 text-white transition-all duration-300 flex flex-col shrink-0",
        isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-20"
      )}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          {isSidebarOpen && <span className="font-bold text-lg tracking-tight text-blue-400">CashFlow<span className="text-white">Intelligence</span></span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:block p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'transactions', icon: ArrowRightLeft, label: 'Transações' },
            { id: 'taxes', icon: Receipt, label: 'Split Payment' },
            { id: 'reports', icon: PieChart, label: 'Relatórios' },
            { id: 'plans', icon: CreditCard, label: 'Planos e Assinaturas' },
            { id: 'profile', icon: Lock, label: 'Privacidade & Dados' },
            { id: 'help', icon: HelpCircle, label: 'Guia de Uso' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "w-full flex items-center px-3 py-3 rounded-lg transition-colors",
                activeTab === item.id 
                  ? "bg-blue-600 text-white" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white",
                !isSidebarOpen && "md:justify-center"
              )}
            >
              <item.icon size={20} className={cn(isSidebarOpen && "mr-3", !isSidebarOpen && "md:mr-0 mr-3")} />
              <span className={cn("font-medium", !isSidebarOpen && "md:hidden")}>{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button 
            onClick={() => handleTabChange('profile')}
            className={cn(
              "w-full flex items-center px-3 py-3 rounded-lg transition-colors",
              activeTab === 'profile'
                ? "bg-blue-600 text-white" 
                : "text-slate-400 hover:bg-slate-800 hover:text-white",
            !isSidebarOpen && "md:justify-center"
          )}>
            <Settings size={20} className={cn(isSidebarOpen && "mr-3", !isSidebarOpen && "md:mr-0 mr-3")} />
            <span className={cn("font-medium", !isSidebarOpen && "md:hidden")}>Configurações</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center overflow-hidden">
            <button 
              className="md:hidden p-2 mr-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg shrink-0"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg md:text-xl font-semibold text-gray-800 truncate">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'transactions' && 'Transações'}
              {activeTab === 'taxes' && 'Split Payment'}
              {activeTab === 'reports' && 'Relatórios'}
              {activeTab === 'plans' && 'Assinaturas e Planos'}
              {activeTab === 'profile' && 'Perfil e Privacidade'}
              {activeTab === 'help' && 'Guia de Uso do App'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all w-48 md:w-64"
              />
            </div>
            <button className="sm:hidden p-2 text-gray-400 hover:text-gray-600">
              <Search size={20} />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-semibold text-sm shadow-sm ml-1 md:ml-0">
              JS
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 md:space-y-6 max-w-7xl mx-auto"
            >
              
              {/* Alert for Working Capital */}
              {isDeficit && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
                  <AlertCircle className="text-red-600 mt-0.5 mr-3 shrink-0" size={20} />
                  <div>
                    <h3 className="text-red-800 font-semibold text-sm md:text-base">Alerta de Capital de Giro</h3>
                    <p className="text-red-600 text-xs md:text-sm mt-1">
                      O impacto do Split Payment reduziu seu capital de giro para níveis críticos. 
                      A projeção indica necessidade de captação externa nos próximos 5 dias para cobrir despesas fixas.
                    </p>
                  </div>
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-500">Vendas Brutas (Mês)</p>
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totals.vendasBrutas)}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-lg">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                  <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                    <span className="text-emerald-600 font-medium flex items-center">
                      <TrendingUp size={14} className="mr-1" /> +12.5%
                    </span>
                    <span className="text-gray-400 ml-2">vs mês anterior</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 md:w-2 h-full bg-red-500"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-500">Imposto Retido na Fonte</p>
                      <h3 className="text-xl md:text-2xl font-bold text-red-600 mt-1">{formatCurrency(totals.impostoRetido)}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-red-50 text-red-600 rounded-lg">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                    <span className="text-gray-500 font-medium">
                      Split Payment (IBS/CBS)
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-500">Receita Líquida Disponível</p>
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totals.receitaLiquida)}</h3>
                    </div>
                    <div className="p-2 md:p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Wallet size={20} />
                    </div>
                  </div>
                  <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                    <span className="text-gray-500 font-medium">
                      {totals.vendasBrutas > 0 ? ((totals.receitaLiquida / totals.vendasBrutas) * 100).toFixed(1) : 0}% do faturamento
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-500">Capital de Giro Atual</p>
                      <h3 className={cn("text-xl md:text-2xl font-bold mt-1", isDeficit ? "text-red-600" : "text-gray-900")}>
                        {formatCurrency(currentCapital)}
                      </h3>
                    </div>
                    <div className={cn("p-2 md:p-3 rounded-lg", isDeficit ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600")}>
                      <TrendingDown size={20} />
                    </div>
                  </div>
                  <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                    {isDeficit ? (
                      <span className="text-red-600 font-medium flex items-center">
                        Abaixo do ideal
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium flex items-center">
                        Saudável
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                
                {/* Main Chart */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6 lg:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6">
                    <div>
                      <h2 className="text-base md:text-lg font-bold text-gray-900">Impacto do Split Payment no Caixa</h2>
                      <p className="text-xs md:text-sm text-gray-500">Vendas brutas vs Receita líquida após retenção</p>
                    </div>
                  </div>
                  <div className="h-64 md:h-80 w-full -ml-4 sm:ml-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 10}}
                          tickFormatter={(value) => `R$ ${value / 1000}k`}
                          dx={-10}
                          width={60}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `Dia ${label} de Abril, 2026`}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="vendasBrutas" name="Vendas Brutas" stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorBruto)" />
                        <Area type="monotone" dataKey="receitaLiquida" name="Receita Líquida" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorLiquido)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Working Capital Chart */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div>
                      <h2 className="text-base md:text-lg font-bold text-gray-900">Evolução do Capital</h2>
                      <p className="text-xs md:text-sm text-gray-500">Saldo diário disponível</p>
                    </div>
                  </div>
                  <div className="h-64 md:h-80 w-full -ml-4 sm:ml-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 10}}
                          tickFormatter={(value) => `R$ ${value / 1000}k`}
                          domain={['dataMin - 5000', 'dataMax + 5000']}
                          dx={-10}
                          width={60}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `Dia ${label}`}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        />
                        <Line type="monotone" dataKey="capitalGiro" name="Capital de Giro" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-gray-900">Transações Recentes</h2>
                    <p className="text-xs md:text-sm text-gray-500">Últimas movimentações com retenção na fonte</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleExportCSV}
                      className="flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-lg transition-colors shadow-sm"
                    >
                      <Download size={16} className="mr-2" />
                      Exportar
                    </button>
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg transition-colors shadow-sm w-full sm:w-auto"
                    >
                      <Plus size={16} className="mr-2" />
                      Nova Transação
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="p-3 md:p-4 font-medium">ID / Data</th>
                        <th className="p-3 md:p-4 font-medium">Descrição</th>
                        <th className="p-3 md:p-4 font-medium text-right">Valor Bruto</th>
                        <th className="p-3 md:p-4 font-medium text-right">Imposto Retido</th>
                        <th className="p-3 md:p-4 font-medium text-right">Valor Líquido</th>
                        <th className="p-3 md:p-4 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                              <p className="mb-4">Nenhuma transação encontrada. Clique em "Nova Transação" ou gere dados fictícios para começar.</p>
                              <button 
                                onClick={handleSeedData}
                                disabled={isLoading}
                                className="flex items-center text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
                              >
                                {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
                                Gerar Dados de Exemplo
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        transactions.slice(0, 5).map((trx) => (
                          <tr key={trx.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 md:p-4">
                              <div className="font-medium text-gray-900 text-xs truncate max-w-[100px]">TRX-{trx.id.substring(0, 6)}</div>
                              <div className="text-gray-500 text-xs mt-0.5">{trx.date}</div>
                            </td>
                            <td className="p-3 md:p-4 text-gray-700">{trx.description}</td>
                            <td className="p-3 md:p-4 text-right font-medium">
                              <span className={trx.type === 'sale' ? 'text-gray-900' : 'text-red-600'}>
                                {formatCurrency(Math.abs(trx.amount))}
                              </span>
                            </td>
                            <td className="p-3 md:p-4 text-right">
                              {trx.tax > 0 ? (
                                <span className="text-red-500 font-medium bg-red-50 px-2 py-1 rounded text-xs whitespace-nowrap">
                                  - {formatCurrency(trx.tax)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-3 md:p-4 text-right font-bold text-gray-900">
                              {formatCurrency(Math.abs(trx.amount) - trx.tax)}
                            </td>
                            <td className="p-3 md:p-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                {trx.status === 'completed' ? 'Concluído' : trx.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 md:p-4 border-t border-gray-100 bg-gray-50/50 text-center">
                  <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    Ver todas as transações
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <motion.div
              key="transactions"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 md:space-y-6 max-w-7xl mx-auto"
            >
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-gray-900">Histórico de Transações</h2>
                    <p className="text-xs md:text-sm text-gray-500">Todas as entradas e saídas do período</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto">
                      <Filter size={16} className="mr-2" />
                      Filtrar
                    </button>
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
                    >
                      <Plus size={16} className="mr-2" />
                      Nova
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="p-3 md:p-4 font-medium">ID / Data</th>
                        <th className="p-3 md:p-4 font-medium">Descrição</th>
                        <th className="p-3 md:p-4 font-medium text-right">Valor Bruto</th>
                        <th className="p-3 md:p-4 font-medium text-right">Imposto Retido</th>
                        <th className="p-3 md:p-4 font-medium text-right">Valor Líquido</th>
                        <th className="p-3 md:p-4 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                              <p className="mb-4">Nenhuma transação encontrada. Clique em "Nova Transação" ou gere dados fictícios para começar.</p>
                              <button 
                                onClick={handleSeedData}
                                disabled={isLoading}
                                className="flex items-center text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
                              >
                                {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
                                Gerar Dados de Exemplo
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        transactions.map((trx) => (
                          <tr key={trx.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 md:p-4">
                              <div className="font-medium text-gray-900 text-xs truncate max-w-[100px]">TRX-{trx.id.substring(0, 6)}</div>
                              <div className="text-gray-500 text-xs mt-0.5">{trx.date}</div>
                            </td>
                            <td className="p-3 md:p-4 text-gray-700">{trx.description}</td>
                            <td className="p-3 md:p-4 text-right font-medium">
                              <span className={trx.type === 'sale' ? 'text-gray-900' : 'text-red-600'}>
                                {formatCurrency(Math.abs(trx.amount))}
                              </span>
                            </td>
                            <td className="p-3 md:p-4 text-right">
                              {trx.tax > 0 ? (
                                <span className="text-red-500 font-medium bg-red-50 px-2 py-1 rounded text-xs whitespace-nowrap">
                                  - {formatCurrency(trx.tax)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-3 md:p-4 text-right font-bold text-gray-900">
                              {formatCurrency(Math.abs(trx.amount) - trx.tax)}
                            </td>
                            <td className="p-3 md:p-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                {trx.status === 'completed' ? 'Concluído' : trx.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 md:p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center text-sm text-gray-500">
                  <span>Mostrando {transactions.length} transações</span>
                  <div className="flex gap-1">
                    <button className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50" disabled>Anterior</button>
                    <button className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100">Próxima</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Taxes Tab */}
          {activeTab === 'taxes' && (
            <motion.div
              key="taxes"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 md:space-y-6 max-w-7xl mx-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-100 shadow-sm">
                  <p className="text-xs md:text-sm font-medium text-gray-500">Total de Impostos Retidos (Mês)</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-red-600 mt-2">{formatCurrency(totals.impostoRetido)}</h3>
                  <div className="mt-4 text-sm text-gray-500">
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span>CBS (Contribuição Federal)</span>
                      <span className="font-medium text-gray-900">{formatCurrency(totals.impostoRetido * 0.35)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>IBS (Imposto Estadual/Municipal)</span>
                      <span className="font-medium text-gray-900">{formatCurrency(totals.impostoRetido * 0.65)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-100 shadow-sm">
                  <p className="text-xs md:text-sm font-medium text-gray-500">Alíquota Efetiva Média</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">26,5%</h3>
                  <p className="text-xs text-gray-400 mt-2">Alíquota padrão aplicada automaticamente nas transações via Split Payment.</p>
                </div>
                <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-100 shadow-sm">
                  <p className="text-xs md:text-sm font-medium text-gray-500">Status de Conformidade</p>
                  <div className="flex items-center mt-2">
                    <div className="h-3 w-3 bg-emerald-500 rounded-full mr-2"></div>
                    <h3 className="text-lg font-bold text-gray-900">100% Regular</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Com o Split Payment, o recolhimento é automático, eliminando o risco de inadimplência tributária.</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6">
                <div className="mb-4 md:mb-6">
                  <h2 className="text-base md:text-lg font-bold text-gray-900">Retenção Diária (Split Payment)</h2>
                  <p className="text-xs md:text-sm text-gray-500">Volume de impostos retidos diretamente na fonte por dia</p>
                </div>
                <div className="h-64 md:h-80 w-full -ml-4 sm:ml-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 10}}
                        tickFormatter={(value) => `R$ ${value / 1000}k`}
                        dx={-10}
                        width={60}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Dia ${label}`}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        cursor={{fill: '#f8fafc'}}
                      />
                      <Bar dataKey="impostoRetido" name="Imposto Retido" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto space-y-6"
            >
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Inteligência Financeira</h2>
                <div className="flex gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center justify-center text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm px-4 py-2.5 rounded-lg transition-all w-full sm:w-auto"
                  >
                    <Printer size={18} className="mr-2" />
                    Imprimir
                  </button>
                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center justify-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md px-5 py-2.5 rounded-lg transition-all w-full sm:w-auto"
                  >
                    <Download size={18} className="mr-2" />
                    Exportar Dados
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden print:shadow-none print:border-none">
                
                {/* Report Header */}
                <div className="bg-slate-900 px-6 py-8 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-white tracking-wide">Relatório Executivo CashFlow</h1>
                      <p className="text-slate-400 mt-1">Análise automatizada de faturamento e Split Payment</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-slate-300">Data de Referência</p>
                      <p className="text-lg font-bold text-white">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>

                {(() => {
                  const salesCount = transactions.filter(t => t.type === 'sale').length;
                  const averageTicket = salesCount > 0 ? totals.vendasBrutas / salesCount : 0;
                  const resultLq = totals.receitaLiquida - totals.despesas;
                  const profitMargin = totals.vendasBrutas > 0 ? ((resultLq) / totals.vendasBrutas) * 100 : 0;
                  const taxImpactPercentage = totals.vendasBrutas > 0 ? (totals.impostoRetido / totals.vendasBrutas) * 100 : 0;
                  const isHealthy = profitMargin > 15;

                  return (
                    <div className="p-6 md:p-8 space-y-8 bg-slate-50">
                      
                      {/* AI Executive Summary Box */}
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-0.5 shadow-lg">
                        <div className="bg-white rounded-lg p-5 md:p-6 h-full w-full">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shrink-0 border border-blue-200">
                              <Sparkles size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                Síntese Preditiva da IA
                                {isHealthy ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/50">
                                    Crescimento Saudável
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200/50">
                                    Atenção ao Caixa
                                  </span>
                                )}
                              </h3>
                              <p className="text-slate-600 mt-3 leading-relaxed text-sm md:text-base">
                                O processamento atual no Split Payment reteve exatamente <strong>{taxImpactPercentage.toFixed(1)}%</strong> do volume transacionado (<strong>{formatCurrency(totals.impostoRetido)}</strong>). 
                                Com uma margem final de lucro sobre as vendas de <strong>{profitMargin.toFixed(1)}%</strong> e um ticket médio de <strong>{formatCurrency(averageTicket)}</strong>, 
                                a operação atual {isHealthy ? "possui caixa superavitário e excelente liquidez para reinvestimento (Capital de Giro seguro)." : "exige otimização de despesas correntes, dado que a margem foi estreitada pelo recolhimento na fonte."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Advanced KPIs */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity size={48} />
                          </div>
                          <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5"><Activity size={16} className="text-blue-500"/> Ticket Médio</p>
                          <h4 className="text-2xl font-black text-slate-900 mt-2">{formatCurrency(averageTicket)}</h4>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <PieChart size={48} />
                          </div>
                          <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5"><PieChart size={16} className="text-red-500"/> Carga Tributária</p>
                          <h4 className="text-2xl font-black text-red-600 mt-2">{taxImpactPercentage.toFixed(1)}%</h4>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Target size={48} />
                          </div>
                          <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5"><Target size={16} className="text-blue-500"/> Margem de Lucro</p>
                          <h4 className="text-2xl font-black text-blue-600 mt-2">{profitMargin.toFixed(1)}%</h4>
                        </div>
                        <div className="bg-emerald-600 p-5 rounded-xl border border-emerald-700 shadow-md text-white relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp size={48} />
                          </div>
                          <p className="text-sm font-medium flex items-center gap-1.5 text-emerald-100"><TrendingUp size={16}/> Resultado Líquido</p>
                          <h4 className="text-2xl font-black mt-2">{formatCurrency(resultLq)}</h4>
                        </div>
                      </div>

                      {/* Charts Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Breakdown Layout */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                          <h3 className="text-sm tracking-widest uppercase font-bold text-slate-400 mb-6">Matriz de Composição Financeira</h3>
                          <div className="space-y-6">
                            <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-semibold text-slate-700">Faturamento Bruto</span>
                                <span className="font-bold text-slate-900">{formatCurrency(totals.vendasBrutas)}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-slate-800 h-2 rounded-full" style={{ width: '100%' }}></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-semibold text-slate-700">Retenção (Split Payment)</span>
                                <span className="font-bold text-red-600">{formatCurrency(totals.impostoRetido)}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${taxImpactPercentage}%` }}></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="font-semibold text-slate-700">Despesas Operacionais</span>
                                <span className="font-bold text-orange-600">{formatCurrency(totals.despesas)}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${totals.vendasBrutas ? (totals.despesas/totals.vendasBrutas)*100 : 0}%` }}></div>
                              </div>
                            </div>
                            <div className="pt-5 mt-2 border-t border-slate-100">
                              <div className="flex justify-between text-sm mb-2">
                                <span className="font-bold text-emerald-700 uppercase tracking-wide">Liquidez / Lucro Cativado</span>
                                <span className="font-bold text-emerald-700 text-lg">{formatCurrency(resultLq)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                           <h3 className="text-sm tracking-widest uppercase font-bold text-slate-400 mb-6">Receitas x Despesas (Diário)</h3>
                           <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(val) => `R$${val/1000}k`} />
                                <Tooltip 
                                  formatter={(value: number) => formatCurrency(value)}
                                  labelFormatter={(label) => `Dia ${label}`}
                                  cursor={{fill: '#f8fafc', opacity: 0.5}}
                                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: "12px", color: '#475569'}}/>
                                <Bar dataKey="receitaLiquida" name="Receita Líquida" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                                <Bar dataKey="despesa" name="Saída (Despesas)" fill="#f97316" radius={[4, 4, 0, 0]} barSize={12} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </motion.div>
          )}

          {/* Profile and Privacy Tab */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 flex items-center justify-between text-white">
                  <div>
                    <h2 className="text-lg font-bold flex items-center">
                      <Lock className="mr-2" size={20} /> Central de Privacidade (LGPD)
                    </h2>
                    <p className="text-sm text-slate-300 mt-1">Seus dados estão protegidos com segurança avançada na nuvem.</p>
                  </div>
                  <ShieldCheck size={40} className="text-emerald-400 opacity-80" />
                </div>
                
                <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                  
                  {/* Read-only Data (from Google) */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Dados Básicos (Google)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Nome Completo</label>
                        <input 
                          type="text" 
                          disabled 
                          value={user.displayName || ''} 
                          className="w-full bg-gray-50 border border-gray-200 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
                        <input 
                          type="email" 
                          disabled 
                          value={user.email || ''} 
                          className="w-full bg-gray-50 border border-gray-200 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Editable Data */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Contato Adicional</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp / Telefone</label>
                      <input 
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">Usaremos este número apenas para comunicações importantes.</p>
                    </div>
                  </div>

                  {/* LGPD Consent Section */}
                  <div className="pt-4 border-t border-gray-100">
                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            required
                            checked={lgpdConsent}
                            onChange={(e) => setLgpdConsent(e.target.checked)}
                            className="mt-1 w-4 h-4 text-blue-600 bg-white border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-sm text-gray-700">
                            <strong>Termos e Consentimento (LGPD)</strong>
                            <br/>
                            Li e concordo com os Termos de Uso e Política de Privacidade.
                            Autorizo que o sistema CashFlow Intelligence e seus administradores tratem meus dados para o funcionamento do app e enviem comunicações ou ofertas de serviços que possam ajudar minha empresa.
                          </span>
                        </label>
                     </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={!lgpdConsent || isSavingProfile}
                      className="flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingProfile ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-2" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-2" />
                          Salvar Dados e Consentimento
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>

              {!userProfile && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm shadow-sm"
                >
                  <AlertCircle className="inline-block w-5 h-5 mb-1" />
                  <br />
                  Complete o seu perfil acima para liberar o acesso ao Dashboard e simulações do CashFlow.
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Plans Tab */}
          {activeTab === 'help' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-8 border-b border-gray-100 bg-slate-50">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <HelpCircle className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Como utilizar o CashFlow Intelligence</h2>
                      <p className="text-gray-500">Guia passo a passo para dominar sua gestão financeira no novo cenário tributário.</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-12">
                  {/* Step 1 */}
                  <section className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-200">1</div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        Complete seu Perfil Empresarial
                        <ShieldCheck className="h-5 w-5 text-emerald-500 ml-2" />
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        O primeiro passo é acessar a aba <strong>Privacidade & Dados</strong>. Lá, você deve preencher o nome da sua empresa, CNPJ e faturamento estimado. Essas informações são cruciais para que nossas projeções de Split Payment sejam precisas.
                      </p>
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                        <strong>Dica:</strong> Seus dados são protegidos por criptografia de ponta a ponta e estão em conformidade com a LGPD.
                      </div>
                    </div>
                  </section>

                  {/* Step 2 */}
                  <section className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-200">2</div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-900">Explore o Dashboard (Visão Geral)</h3>
                      <p className="text-gray-600 leading-relaxed">
                        No <strong>Dashboard</strong>, você tem uma visão em tempo real do seu caixa. O indicador mais importante é o <strong>Saldo Disponível</strong>, que já desconta automaticamente as retenções de IBS/CBS (Split Payment) calculadas pelo nosso motor de IA.
                      </p>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <li className="flex items-center text-sm text-gray-700 bg-gray-50 p-3 rounded-lg"><TrendingUp className="h-4 w-4 text-emerald-500 mr-2" /> Faturamento Bruto: Total de vendas</li>
                        <li className="flex items-center text-sm text-gray-700 bg-gray-50 p-3 rounded-lg"><TrendingDown className="h-4 w-4 text-red-500 mr-2" /> Retenções: Impostos já provisionados</li>
                      </ul>
                    </div>
                  </section>

                  {/* Step 3 */}
                  <section className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-200">3</div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-900">Gerenciando Transações</h3>
                      <p className="text-gray-600 leading-relaxed">
                        Na aba <strong>Transações</strong>, você pode registrar todas as suas entradas e saídas. Ao adicionar uma nova "Venda", o sistema simula instantaneamente o valor que será retido pelo governo (26,5% estimado), permitindo que você saiba exatamente quanto sobrará líquido no momento da venda.
                      </p>
                      <div className="flex items-center gap-4 py-2">
                        <div className="flex items-center text-xs font-medium text-gray-500 border border-gray-200 px-3 py-1 rounded-full"><Plus className="h-3 w-3 mr-1" /> Botão "Nova Transação"</div>
                        <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                        <div className="text-xs font-semibold text-blue-600">Projeção de Lucro Líquido</div>
                      </div>
                    </div>
                  </section>

                  {/* Step 4 */}
                  <section className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-200">4</div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        Relatórios e IA
                        <Sparkles className="h-5 w-5 text-amber-500 ml-2" />
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        Acesse a aba <strong>Relatórios</strong> para exportar seus dados em CSV ou imprimir PDFs executivos para sua contabilidade. Graças à nossa tecnologia de <strong>Smart Extraction</strong>, o sistema identifica padrões de faturamento e gera alertas caso sua carga tributária mude de acordo com novas normativas do Governo Fiscal.
                      </p>
                    </div>
                  </section>
                </div>

                <div className="p-8 bg-slate-900 text-white rounded-b-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-lg">Precisa de Ajuda Extra?</h4>
                      <p className="text-slate-400 text-sm">Nossa Atendente Virtual (IA) está disponível 24/7 para tirar suas dúvidas.</p>
                    </div>
                    <button 
                      onClick={() => setIsChatOpen(true)}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
                    >
                      Falar com IA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plans' && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 max-w-7xl mx-auto py-8"
            >
              <div className="text-center max-w-3xl mx-auto mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Escolha o plano ideal para sua empresa</h2>
                <p className="mt-4 text-gray-500">
                  Nossos planos foram pensados para escalar com o seu negócio. Automatize a gestão do Split Payment e foque na transição fiscal sem burocracias.
                </p>

                <div className="mt-8">
                  {/* Toggle Removed as requested */}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Starter */}
                <div className={cn(
                  "bg-white rounded-2xl border p-8 shadow-sm flex flex-col transition-all",
                  "border-gray-200"
                )}>
                  <h3 className="text-lg font-semibold text-gray-900">Starter</h3>
                  <p className="text-gray-500 text-sm mt-2">Módulo básico de Split Payment e transição tributária.</p>
                  <div className="mt-6">
                    <span className="text-4xl font-bold text-gray-900">
                      R$ 97
                    </span>
                    <span className="text-gray-500">/ano</span>
                  </div>
                  <ul className="mt-8 space-y-4 flex-1">
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">Processamento de até R$ 50k/mês</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">Cálculo de Retenções (IBS/CBS)</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">Exportação de guias básicas</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">Atualizações legais inclusas</span></li>
                  </ul>
                  <button 
                    onClick={() => window.open('https://mpago.la/27qtCQ2', '_blank')}
                    className="mt-8 w-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Assinar Starter
                  </button>
                </div>

                {/* Pro */}
                <div className="bg-blue-600 rounded-2xl border border-blue-700 p-8 shadow-xl flex flex-col relative transform lg:-translate-y-4">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-blue-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Mais Popular
                  </div>
                  <h3 className="text-lg font-semibold text-white">Pro</h3>
                  <p className="text-blue-100 text-sm mt-2">IA Preditiva para gestão financeira de alta performance.</p>
                  <div className="mt-6">
                    <span className="text-4xl font-bold text-white">
                      R$ 297
                    </span>
                    <span className="text-blue-200">/ano</span>
                  </div>
                  <ul className="mt-8 space-y-4 flex-1">
                     <li className="flex items-start"><Check className="h-5 w-5 text-blue-200 mr-2 shrink-0"/> <span className="text-sm text-white">Processamento de até R$ 500k/mês</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-blue-200 mr-2 shrink-0"/> <span className="text-sm text-white">Capital de Giro Preditivo (IA)</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-blue-200 mr-2 shrink-0"/> <span className="text-sm text-white">Alertas de Fluxo de Caixa</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-blue-200 mr-2 shrink-0"/> <span className="text-sm text-white">Atendente Virtual (IA 24/7)</span></li>
                  </ul>
                  <button 
                    onClick={() => window.open('https://mpago.la/2a48YgB', '_blank')}
                    className="mt-8 w-full bg-white text-blue-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition-colors shadow-sm"
                  >
                    Assinar Pro
                  </button>
                </div>

                {/* Enterprise */}
                <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
                  <p className="text-gray-500 text-sm mt-2">Solução corporativa com escala ilimitada.</p>
                  <div className="mt-6">
                    <span className="text-4xl font-bold text-gray-900">
                      R$ 997
                    </span>
                    <span className="text-gray-500">/ano</span>
                  </div>
                  <ul className="mt-8 space-y-4 flex-1">
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">Transações ILIMITADAS</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">Gestão Multi-CNPJs (Filiais)</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">API de Integração (ERP)</span></li>
                     <li className="flex items-start"><Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0"/> <span className="text-sm text-gray-600">Prioridade de Resposta IA</span></li>
                  </ul>
                  <button 
                    onClick={() => window.open('https://mpago.la/2qSPczo', '_blank')}
                    className="mt-8 w-full bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Assinar Enterprise
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          </AnimatePresence>

          {/* Modal Nova Transação */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Nova Transação</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddTransaction} className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Transação</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewTx({...newTx, type: 'sale'})}
                        className={cn("py-2 px-4 text-sm font-medium rounded-lg border transition-colors", newTx.type === 'sale' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50")}
                      >
                        Venda (Entrada)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTx({...newTx, type: 'expense'})}
                        className={cn("py-2 px-4 text-sm font-medium rounded-lg border transition-colors", newTx.type === 'expense' ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50")}
                      >
                        Despesa (Saída)
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <input 
                      type="text" 
                      required
                      value={newTx.description}
                      onChange={(e) => setNewTx({...newTx, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Ex: Venda de Mercadoria"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Bruto (R$)</label>
                    <input 
                      type="number" 
                      required
                      min="0.01"
                      step="0.01"
                      value={newTx.amount}
                      onChange={(e) => setNewTx({...newTx, amount: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="0.00"
                    />
                    {newTx.type === 'sale' && newTx.amount && (
                      <p className="text-xs text-red-500 mt-1">
                        * Retenção estimada (Split Payment 26,5%): {formatCurrency(parseFloat(newTx.amount) * 0.265)}
                      </p>
                    )}
                  </div>
                  <div className="pt-4 flex justify-end gap-2">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      Salvar Transação
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
    </>
  );
}


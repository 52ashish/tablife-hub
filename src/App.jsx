import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { db, auth, provider, signInWithPopup, signOut, collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDoc, setDoc, writeBatch, where, getDocs } from './firebase';
import { onAuthStateChanged } from "firebase/auth";
import { 
  LayoutDashboard, PlusCircle, History, LogOut, 
  ChevronDown, ChevronRight, ChevronLeft, X, UploadCloud, TrendingUp, TrendingDown, Calendar, Trash2, AlertCircle, Tag, Filter, CheckSquare, Square, FileInput, ArrowLeft, Save, CreditCard, Eye, EyeOff, Edit2, Settings, Wallet, Hash, Menu, Plus, PieChart as PieChartIcon,
  Utensils, Car, ShoppingBag, Zap, Home, Activity, Film, Briefcase, HelpCircle, GraduationCap,
  Plane, Gift, Music, Book, Wrench, Heart, Smile, Star, Sun, Moon, Cloud, Umbrella, Droplet, Anchor, Map, Lock, Key, Flag, Bell, Smartphone, Wifi, Coffee, ShoppingCart, Check 
} from 'lucide-react';
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Legend } from 'recharts';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

// --- CONFIG ---
const CATEGORY_RULES = {
  'Food': ['mcdonalds', 'burger', 'starbucks', 'cafe', 'restaurant', 'dining', 'eats', 'taco', 'pizza', 'coffee', 'chipotle', 'lunch', 'dinner'],
  'Transport': ['uber', 'lyft', 'shell', 'exxon', 'chevron', 'gas', 'fuel', 'parking', 'metro', 'train', 'bus', 'tesla'],
  'Shopping': ['amazon', 'walmart', 'target', 'bestbuy', 'apple', 'nike', 'clothing', 'store', 'shop', 'saks', 'lululemon'],
  'Utilities': ['att', 'verizon', 't-mobile', 'comcast', 'water', 'electric', 'power', 'internet', 'subscription', 'netflix', 'spotify', 'hulu', 'peacock'],
  'Housing': ['rent', 'mortgage', 'hotel', 'airbnb', 'lodging', 'residence inn'],
  'Income': ['payroll', 'deposit', 'salary', 'transfer', 'refund', 'credit'],
  'Health': ['doctor', 'pharmacy', 'cvs', 'walgreens', 'hospital', 'dental', 'fitness', 'gym'],
  'CC Payment': ['payment to', 'autopay', 'thank you', 'payment received']
};

const detectCategory = (desc) => {
  if (!desc) return null;
  const lowerDesc = String(desc).toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some(k => lowerDesc.includes(k))) return cat;
  }
  return null;
};

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Utilities', 'Housing', 'Health', 'Entertainment', 'CC Payment', 'Uncategorized'];

// --- ICON MAP ---
const ICON_MAP = {
    Utensils, Car, ShoppingBag, Zap, Home, Activity, Film, Briefcase, GraduationCap,
    Plane, Gift, Music, Book, Wrench, Heart, Smile, Star, Sun, Moon, Cloud, Umbrella, Droplet, Anchor, Map, Lock, Key, Flag, Bell, Smartphone, Wifi, Coffee, ShoppingCart, HelpCircle, Tag
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

// --- HELPERS ---
const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const stringToColor = (str) => {
  let hash = 0;
  const safeStr = String(str || '');
  for (let i = 0; i < safeStr.length; i++) hash = safeStr.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 70%, 60%)`;
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

// --- ICON HELPER ---
const getCategoryIcon = (cat, size = 18, userIcons = {}) => {
    // 1. Check Custom User Icon
    if (userIcons && userIcons[cat] && ICON_MAP[userIcons[cat]]) {
        const IconComponent = ICON_MAP[userIcons[cat]];
        return <IconComponent size={size} />;
    }

    // 2. Default Logic
    const lower = String(cat || '').toLowerCase();
    if (lower.includes('food') || lower.includes('restaurant') || lower.includes('coffee')) return <Utensils size={size} />;
    if (lower.includes('transport') || lower.includes('gas') || lower.includes('uber') || lower.includes('car')) return <Car size={size} />;
    if (lower.includes('shop') || lower.includes('amazon') || lower.includes('clothing')) return <ShoppingBag size={size} />;
    if (lower.includes('util') || lower.includes('bill') || lower.includes('phone')) return <Zap size={size} />;
    if (lower.includes('hous') || lower.includes('rent') || lower.includes('hotel')) return <Home size={size} />;
    if (lower.includes('health') || lower.includes('doctor') || lower.includes('gym')) return <Activity size={size} />;
    if (lower.includes('entertain') || lower.includes('movie') || lower.includes('film')) return <Film size={size} />;
    if (lower.includes('income') || lower.includes('salary') || lower.includes('payroll')) return <Briefcase size={size} />;
    if (lower.includes('education') || lower.includes('school')) return <GraduationCap size={size} />;
    if (lower.includes('cc payment') || lower.includes('transfer')) return <CreditCard size={size} />;
    return <Tag size={size} />;
};

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Dashboard & Graph
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState('month'); 
  const [graphGranularity, setGraphGranularity] = useState('monthly'); 
  const [graphRange, setGraphRange] = useState('6M'); 
  const [visibleCatLines, setVisibleCatLines] = useState(['Total Income']); 
  const [dashboardChartType, setDashboardChartType] = useState('trend'); 

  // Derived Selection String for Highlighting
  const selectedDatePrefix = useMemo(() => {
      if (graphGranularity === 'yearly') return viewYear.toString();
      return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  }, [viewYear, viewMonth, graphGranularity]);

  // Settings
  const [excludedCategories, setExcludedCategories] = useState(() => {
      try {
          const saved = localStorage.getItem('excludedCategories');
          return saved ? JSON.parse(saved) : ['CC Payment', 'Transfer'];
      } catch { return ['CC Payment', 'Transfer']; }
  });

  const [categoryIcons, setCategoryIcons] = useState(() => {
      try {
          const saved = localStorage.getItem('categoryIcons');
          return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
  });
  
  const [historyViewMode, setHistoryViewMode] = useState('list');
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());

  // Managers
  const [showManageModal, setShowManageModal] = useState(null); 
  const [managerConfirm, setManagerConfirm] = useState(null);
  const [manageTab, setManageTab] = useState('category'); 
  const [editingItem, setEditingItem] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(null); 

  // Popups & UI
  const [editTx, setEditTx] = useState(null);
  const [drilldownState, setDrilldownState] = useState(null); 
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [importPreview, setImportPreview] = useState(null); 
  const [importGlobalSource, setImportGlobalSource] = useState(''); 
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [expandedYears, setExpandedYears] = useState({ [today.getFullYear()]: true });
  const [expandedMonths, setExpandedMonths] = useState({});
  const [historySearch, setHistorySearch] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
      try {
          const saved = localStorage.getItem('darkMode');
          return saved === 'true';
      } catch { return false; }
  });

  // --- AUTH & DATA SYNC ---
  useEffect(() => {
      if (darkMode) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark';
      } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
      }
      localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
          listenToTransactions(u.uid);
          try {
            const settingsDoc = await getDoc(doc(db, "users", u.uid, "settings", "preferences"));
            if (settingsDoc.exists()) {
                const data = settingsDoc.data();
                if (data.excludedCategories) {
                    setExcludedCategories(data.excludedCategories);
                    localStorage.setItem('excludedCategories', JSON.stringify(data.excludedCategories));
                }
                if (data.categoryIcons) {
                    setCategoryIcons(data.categoryIcons);
                    localStorage.setItem('categoryIcons', JSON.stringify(data.categoryIcons));
                }
            }
          } catch (e) { console.error("Error fetching settings:", e); }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
      localStorage.setItem('excludedCategories', JSON.stringify(excludedCategories));
      localStorage.setItem('categoryIcons', JSON.stringify(categoryIcons)); 
      if (user) {
          setDoc(doc(db, "users", user.uid, "settings", "preferences"), { excludedCategories, categoryIcons }, { merge: true });
      }
  }, [excludedCategories, categoryIcons, user]);

  const listenToTransactions = (uid) => {
    const q = query(collection(db, "users", uid, "transactions"), orderBy("date", "desc"));
    onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id })));
    });
  };

  const handleLogin = async () => { try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); } };

  // --- CRUD ---
  const handleSave = async (formData) => {
    if(!formData.desc || !formData.amount) return;
    const finalCat = formData.category || 'Uncategorized';
    let finalTags = Array.isArray(formData.tags) ? formData.tags : (formData.tags ? [formData.tags] : []);

    const txData = {
      date: formData.date, description: formData.desc, amount: parseFloat(formData.amount),
      type: formData.type, mode: formData.mode, category: finalCat,
      source: formData.source || '', tags: finalTags, 
      isExcluded: formData.isExcluded 
    };
    try {
      if (formData.id) await updateDoc(doc(db, "users", user.uid, "transactions", formData.id), txData);
      else await addDoc(collection(db, "users", user.uid, "transactions"), { ...txData, id: Date.now() });
      setEditTx(null);
      if (!formData.id) setActiveTab('dashboard'); 
    } catch (e) { alert(e.message); }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
        if (deleteConfirm.type === 'single') {
            await deleteDoc(doc(db, "users", user.uid, "transactions", deleteConfirm.id));
        } else if (deleteConfirm.type === 'group') {
            for (const tx of deleteConfirm.group) await deleteDoc(doc(db, "users", user.uid, "transactions", tx.firestoreId));
        } else if (deleteConfirm.type === 'range') {
            const q = query(
                collection(db, "users", user.uid, "transactions"), 
                where("date", ">=", deleteConfirm.startDate), 
                where("date", "<=", deleteConfirm.endDate)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        setEditTx(null);
        setDeleteConfirm(null);
    } catch(e) { alert("Delete failed: " + e.message); }
    setLoading(false);
  };

  // --- BATCH DELETE & RENAME ---
  const handleBatchDelete = async (type, value) => {
      setLoading(true);
      try {
          const batch = writeBatch(db);
          let q;
          if (type === 'tags') {
              q = query(collection(db, "users", user.uid, "transactions"), where("tags", "array-contains", value));
          } else {
              q = query(collection(db, "users", user.uid, "transactions"), where(type, "==", value));
          }
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(docSnap => {
              const ref = doc(db, "users", user.uid, "transactions", docSnap.id);
              if (type === 'category') batch.update(ref, { category: 'Uncategorized' });
              else if (type === 'source') batch.update(ref, { source: '' });
              else if (type === 'tags') {
                  const newTags = docSnap.data().tags.filter(t => t !== value);
                  batch.update(ref, { tags: newTags });
              }
          });
          await batch.commit();
          if (type === 'category' && excludedCategories.includes(value)) {
              setExcludedCategories(prev => prev.filter(c => c !== value));
          }
          setManagerConfirm(null);
      } catch (e) { alert("Error deleting: " + e.message); }
      setLoading(false);
  };

  const handleRename = async () => {
      if (!editingItem || !editingItem.current.trim() || (editingItem.current === editingItem.original && !editingItem.icon)) {
          setEditingItem(null);
          return;
      }
      setLoading(true);
      try {
          const batch = writeBatch(db);
          const oldVal = editingItem.original;
          const newVal = editingItem.current.trim();
          const type = editingItem.type;

          let q;
          if (type === 'tags') {
              q = query(collection(db, "users", user.uid, "transactions"), where("tags", "array-contains", oldVal));
          } else {
              q = query(collection(db, "users", user.uid, "transactions"), where(type, "==", oldVal));
          }

          const snapshot = await getDocs(q);
          snapshot.docs.forEach(docSnap => {
              const ref = doc(db, "users", user.uid, "transactions", docSnap.id);
              if (type === 'category') batch.update(ref, { category: newVal });
              else if (type === 'source') batch.update(ref, { source: newVal });
              else if (type === 'tags') {
                  const tags = docSnap.data().tags || [];
                  const newTags = tags.map(t => t === oldVal ? newVal : t);
                  batch.update(ref, { tags: newTags });
              }
          });

          if (type === 'category') {
              if (excludedCategories.includes(oldVal)) {
                  const newExcluded = excludedCategories.map(c => c === oldVal ? newVal : c);
                  setExcludedCategories(newExcluded);
              }
              
              // --- START CHANGE: Fix Icon State Update ---
              setCategoryIcons(prev => {
                  const next = { ...prev };
                  // 1. Move old icon preference to new name if renaming
                  if (oldVal !== newVal && next[oldVal]) {
                      next[newVal] = next[oldVal];
                      delete next[oldVal];
                  }
                  // 2. Overwrite with new icon if user selected one
                  if (editingItem.icon) {
                      next[newVal] = editingItem.icon;
                  }
                  return next;
              });
              // --- END CHANGE ---
          }

          await batch.commit();
          setEditingItem(null);
      } catch (e) { alert("Error renaming: " + e.message); }
      setLoading(false);
  };

  // --- PARSERS ---
  const fileInputRef = useRef(null);
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); processFile(e.dataTransfer.files[0]); };
  const triggerFileUpload = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const processFile = async (file) => {
    if(!file) return;
    setLoading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      let parsedData = [];
      if (ext === 'pdf') parsedData = await processPDF(file);
      else if (['xlsx', 'xls', 'csv'].includes(ext)) parsedData = await processExcel(file);
      else if (ext === 'txt') parsedData = await processText(file);
      
      if (parsedData.length > 0) {
          setImportPreview(parsedData);
          setImportGlobalSource(''); 
      } else {
          alert("No transactions found.");
      }
    } catch (err) { alert("Error reading file: " + err.message); }
    setLoading(false);
  };

  const processPDF = async (file) => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async function() {
        try {
          const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const rows = {};
            textContent.items.forEach(item => {
              const y = Math.round(item.transform[5]); 
              if (!rows[y]) rows[y] = [];
              rows[y].push(item.str);
            });
            fullText += Object.keys(rows).sort((a,b)=>b-a).map(y => rows[y].join(' ')).join('\n') + "\n";
          }
          resolve(parseRawText(fullText));
        } catch(e) { reject(e); }
      };
      fileReader.readAsArrayBuffer(file);
    });
  };
  const processExcel = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const sheet = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]];
        resolve(parseRawText(XLSX.utils.sheet_to_csv(sheet)));
      };
      reader.readAsArrayBuffer(file);
    });
  };
  const processText = async (file) => { 
    return new Promise((resolve) => {
      const r = new FileReader(); 
      r.onload = (e) => resolve(parseRawText(e.target.result)); 
      r.readAsText(file);
    });
  };

  const parseRawText = (text) => {
    const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g;
    const moneyPattern = /(-?\$?[\d,]+\.\d{2})/g;
    const results = [];
    text.split(/\r?\n/).forEach(line => {
      const dMatch = line.match(datePattern);
      const mMatch = line.match(moneyPattern);
      if (dMatch && mMatch) {
        const amt = parseFloat(mMatch[0].replace(/[\$,]/g, ''));
        let desc = line.replace(dMatch[0], '').replace(mMatch[0], '').trim().replace(/^,|,$/g, '').trim();
        if (desc.length > 3) {
            const dateObj = new Date(dMatch[0]);
            const isoDate = !isNaN(dateObj) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            
            // --- START CHANGE: Strengthened Rules ---
            let autoCat = 'Uncategorized';
            let type = amt < 0 || /PAYMENT/i.test(desc) ? 'expense' : 'income';

            if (/Zelle.*from/i.test(desc)) {
                autoCat = 'ZelleRecieve';
                type = 'income';
            } else if (/Zelle.*to/i.test(desc)) {
                autoCat = 'ZelleTransfer';
                type = 'expense';
            } else if (/UNITEDWHOLESALE/i.test(desc)) {
                autoCat = 'Housing';
                type = 'expense';
            } else if (/WESTERN UNION/i.test(desc)) {
                autoCat = 'India Transfer';
                type = 'expense';
            } else {
                autoCat = detectCategory(desc) || 'Uncategorized';
            }
            // --- END CHANGE ---

            const isExcluded = ['CC Payment', 'Transfer'].includes(autoCat);
            results.push({
              tempId: Date.now() + Math.random(),
              date: isoDate, description: desc.substring(0, 40),
              amount: Math.abs(amt), type, category: autoCat, mode: 'money', source: 'Import', tags: [], isExcluded
            });
        }
      }
    });
    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const confirmImport = () => {
      if (!importGlobalSource) {
          setShowImportConfirmModal(true);
      } else {
          executeImport();
      }
  };

  const executeImport = async () => {
      setLoading(true);
      try {
          for (const tx of importPreview) {
              const { tempId, ...finalTx } = tx; 
              if (importGlobalSource) finalTx.source = importGlobalSource;
              await addDoc(collection(db, "users", user.uid, "transactions"), { ...finalTx, id: Date.now() + Math.random() });
          }
          setImportPreview(null);
          setImportGlobalSource('');
          setShowImportConfirmModal(false);
          setActiveTab('history');
      } catch(e) { alert(e.message); }
      setLoading(false);
  };

  // --- DROPDOWNS ---
  const { allCategories, allSources, allTags } = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    const sources = new Set(['Cash', 'Credit Card']);
    const tags = new Set(['Trip', 'Business']);
    transactions.forEach(t => {
        if(t.category) cats.add(String(t.category));
        if(t.source) sources.add(String(t.source));
        if(Array.isArray(t.tags)) t.tags.forEach(tag => tag && tag.trim() && tags.add(tag));
    });
    return { 
        allCategories: Array.from(cats).sort(),
        allSources: Array.from(sources).sort(),
        allTags: Array.from(tags).sort()
    };
  }, [transactions]);

  // --- STATS CALC ---
  const statsPrefix = viewMode === 'month' ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}` : `${viewYear}`;
  const allTimeTxs = transactions.filter(t => t.date.startsWith(statsPrefix));
  const validStatsTxs = allTimeTxs.filter(t => !t.isExcluded && !excludedCategories.includes(t.category));
  
  const earned = validStatsTxs.filter(t => t.type === 'income').reduce((a,b) => a+b.amount, 0);
  const spent = validStatsTxs.filter(t => t.type === 'expense').reduce((a,b) => a+b.amount, 0);
  const net = earned - spent; 

  const { categoryStats, tagStats } = useMemo(() => {
    const cStats = {};
    const tStats = {};
    allTimeTxs.filter(t => t.type === 'expense').forEach(t => {
        cStats[t.category] = (cStats[t.category] || 0) + t.amount;
        if (Array.isArray(t.tags)) {
            t.tags.forEach(tag => { if (tag) tStats[tag] = (tStats[tag] || 0) + t.amount; });
        }
    });
    const sortedCats = Object.entries(cStats).sort((a, b) => {
        const isExcludedA = excludedCategories.includes(a[0]);
        const isExcludedB = excludedCategories.includes(b[0]);
        if (isExcludedA && !isExcludedB) return 1;
        if (!isExcludedA && isExcludedB) return -1;
        return b[1] - a[1];
    });
    return {
        categoryStats: sortedCats,
        tagStats: Object.entries(tStats).sort((a, b) => b[1] - a[1])
    };
  }, [allTimeTxs, excludedCategories]);

  const pieData = useMemo(() => {
      return categoryStats
        .filter(([name]) => !excludedCategories.includes(name))
        .map(([name, value]) => ({
          name,
          value,
          fill: stringToColor(name)
      })).sort((a, b) => b.value - a.value);
  }, [categoryStats, excludedCategories]);

  // --- GRAPH DATA LOGIC ---
  const graphData = useMemo(() => {
    const data = [];
    const now = new Date();
    const isYearlyGranularity = graphGranularity === 'yearly'; 
    const isYearMode = viewMode === 'year'; 

    if (isYearlyGranularity) {
        const yearsBack = graphRange === '15Y' ? 15 : (graphRange === '10Y' ? 10 : 5);
        const currentYear = now.getFullYear();
        
        for (let i = yearsBack - 1; i >= 0; i--) {
            const y = currentYear - i;
            const prefix = `${y}`;
            const txs = transactions.filter(t => t.date.startsWith(prefix) && !t.isExcluded && !excludedCategories.includes(t.category));
            
            const point = {
                name: y.toString(),
                fullDate: prefix, 
                type: 'yearly', 
                expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
                income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
                breakdown: txs.filter(t => t.type === 'expense').reduce((acc, t) => {
                    acc[t.category] = (acc[t.category] || 0) + t.amount;
                    return acc;
                }, {})
            };
            visibleCatLines.forEach(cat => {
                if (cat === 'Total Income') return;
                point[cat] = txs.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
            });
            data.push(point);
        }
    } else {
        if (isYearMode) {
            for (let i = 0; i < 12; i++) {
                const d = new Date(viewYear, i, 1);
                const prefix = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
                const label = d.toLocaleString('default', { month: 'short' });

                const txs = transactions.filter(t => t.date.startsWith(prefix) && !t.isExcluded && !excludedCategories.includes(t.category));
                
                const point = {
                    name: label,
                    fullDate: prefix,
                    type: 'monthly',
                    expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
                    income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
                    breakdown: txs.filter(t => t.type === 'expense').reduce((acc, t) => {
                        acc[t.category] = (acc[t.category] || 0) + t.amount;
                        return acc;
                    }, {})
                };
                visibleCatLines.forEach(cat => {
                    if (cat === 'Total Income') return;
                    point[cat] = txs.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
                });
                data.push(point);
            }
        } else {
            const range = graphRange === '6M' ? 6 : (graphRange === 'YTD' ? now.getMonth() + 1 : 12);
            for (let i = range - 1; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleString('default', { month: 'short' });

                const txs = transactions.filter(t => t.date.startsWith(prefix) && !t.isExcluded && !excludedCategories.includes(t.category));
                
                const point = {
                    name: label,
                    fullDate: prefix,
                    type: 'monthly',
                    expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
                    income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
                    breakdown: txs.filter(t => t.type === 'expense').reduce((acc, t) => {
                        acc[t.category] = (acc[t.category] || 0) + t.amount;
                        return acc;
                    }, {})
                };
                visibleCatLines.forEach(cat => {
                    if (cat === 'Total Income') return;
                    point[cat] = txs.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
                });
                data.push(point);
            }
        }
    }
    return data; 
  }, [transactions, graphGranularity, graphRange, visibleCatLines, excludedCategories, viewMode, viewYear]);

  // --- HANDLERS ---
  const handleBarClick = (data) => {
      if (data && data.fullDate) {
        if (data.type === 'yearly') {
            setViewYear(parseInt(data.name));
            setGraphGranularity('monthly');
            setViewMode('year'); 
            setCalendarYear(parseInt(data.name));
        } else {
            const [y, m] = data.fullDate.split('-');
            setViewYear(parseInt(y));
            if (m) {
                const monthIdx = parseInt(m) - 1;
                setViewMonth(monthIdx);
                setCalendarMonth(monthIdx);
            }
            setCalendarYear(parseInt(y));
        }
      }
  };

  const handleDrilldownBack = () => {
    if (drilldownState && drilldownState.stack && drilldownState.stack.length > 0) {
        const parent = drilldownState.stack[drilldownState.stack.length - 1];
        const newStack = drilldownState.stack.slice(0, -1);
        setDrilldownState({ ...parent, stack: newStack });
    } else {
        setDrilldownState(null);
    }
  };

  const openDrilldown = (type, val, datePrefix, title) => {
      setDrilldownState(prev => {
          const newDatePrefix = datePrefix || prev?.datePrefix || '';
          const stack = prev ? [...(prev.stack || []), prev] : []; 
          return { 
              type: 'filter', 
              filterType: type, 
              val, 
              datePrefix: newDatePrefix,
              title: title,
              stack, 
              isGlobalExcluded: false 
          };
      });
  };

  const filterTransactions = (txs, state) => {
      if (!state) return [];
      return txs.filter(t => {
          if (!t.date.startsWith(state.datePrefix)) return false;

          const isTargeted = state.filterType === 'tag' || state.filterType === 'source' || state.filterType === 'category' || state.type === 'category-month';
          if (!isTargeted && (t.isExcluded || excludedCategories.includes(t.category))) return false;

          if (state.filterType === 'tag') return Array.isArray(t.tags) && t.tags.includes(state.val);
          if (state.filterType === 'source') return t.source === state.val;
          if (state.filterType === 'category') return t.category === state.val;
          if (state.filterType === 'type') return t.type === state.val;
          if (state.type === 'category-month') return t.category === state.category;

          return true;
      });
  };

  // --- HISTORY AGGREGATION ---
  const filteredHistoryTransactions = useMemo(() => {
    if (!historySearch) return transactions;
    const lowSearch = historySearch.toLowerCase();
    return transactions.filter(tx => 
        tx.description.toLowerCase().includes(lowSearch) || 
        tx.category.toLowerCase().includes(lowSearch) ||
        (tx.tags && tx.tags.some(tag => tag.toLowerCase().includes(lowSearch))) ||
        (tx.source && tx.source.toLowerCase().includes(lowSearch))
    );
  }, [transactions, historySearch]);

  const nestedHistory = filteredHistoryTransactions.reduce((tree, tx) => {
    const d = parseDate(tx.date); 
    const y = d.getFullYear();
    const m = d.toLocaleString('default', { month: 'long' });
    if (!tree[y]) tree[y] = { months: {}, totalIncome: 0, totalExpense: 0 };
    if (!tree[y].months[m]) tree[y].months[m] = { txs: [], income: 0, expense: 0 };
    
    tree[y].months[m].txs.push(tx);
    
    if (!tx.isExcluded && !excludedCategories.includes(tx.category)) {
        if (tx.type === 'income') {
            tree[y].totalIncome += tx.amount;
            tree[y].months[m].income += tx.amount;
        } else {
            tree[y].totalExpense += tx.amount;
            tree[y].months[m].expense += tx.amount;
        }
    }
    return tree;
  }, {});

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const currentList = filterTransactions(transactions, drilldownState);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 overflow-hidden transition-colors duration-300">
      <aside className="hidden md:flex w-72 flex-col bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 z-10 transition-colors">
        <div className="p-8">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><LayoutDashboard size={18} /></div>
                TabLife.
            </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <SidebarItem icon={<PlusCircle size={20} />} label="Activity" active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
            <SidebarItem icon={<History size={20} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
            <SidebarItem icon={<Settings size={20} />} label="Manage" active={false} onClick={() => setShowManageModal(true)} />
            
            <div className="pt-4 mt-4 border-t border-gray-50 dark:border-gray-700">
                <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                >
                    {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
            </div>
        </nav>
        <div className="p-6 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
                <img src={user.photoURL} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{user.displayName.split(' ')[0]}</span>
            </div>
            <button onClick={() => signOut(auth)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-20">
        <header className="md:hidden flex justify-between items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 relative z-50 transition-colors">
            <h1 className="font-black text-blue-600 text-lg">TabLife.</h1>
            <div className="flex items-center gap-3">
                <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-gray-500 dark:text-gray-400">
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <div className="relative">
                    <img src={user.photoURL} className="w-8 h-8 rounded-full shadow-sm cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
                    {mobileMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2">
                            <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-sm text-red-600 font-bold w-full p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                <LogOut size={14}/> Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="max-w-[2400px] mx-auto space-y-8">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                        {/* MAIN DASHBOARD CONTENT */}
                        <div className="lg:col-span-12 3xl:col-span-8 space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Financial Overview</h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">
                                        {viewMode === 'month' 
                                            ? `Insights for ${new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}` 
                                            : `Annual Summary for ${viewYear}`
                                        }
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <button 
                                        onClick={() => setViewMode(viewMode === 'month' ? 'year' : 'month')} 
                                        className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-sm ${viewMode === 'year' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        {viewMode === 'year' ? 'Annual View' : 'Monthly View'}
                                    </button>
                                    <div className="flex gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                                        {viewMode === 'month' && (
                                            <>
                                                <CustomDropdown 
                                                    value={viewMonth} 
                                                    onChange={(val) => { setViewMonth(val); setCalendarMonth(val); }} 
                                                    options={Array.from({length: 12}, (_, i) => ({ value: i, label: new Date(0, i).toLocaleString('default', { month: 'long' }) }))} 
                                                />
                                                <div className="w-px bg-gray-100 dark:bg-gray-700 my-2"></div>
                                            </>
                                        )}
                                        <CustomDropdown 
                                            value={viewYear} 
                                            onChange={(val) => { setViewYear(val); setCalendarYear(val); }} 
                                            options={Array.from({length: 10}, (_, i) => ({ value: today.getFullYear() - 5 + i, label: today.getFullYear() - 5 + i }))} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatCard 
                                    label={viewMode === 'month' ? "Monthly Income" : "Annual Income"} 
                                    amount={earned} 
                                    icon={<TrendingUp className="text-emerald-100" size={32} />} 
                                    color="bg-emerald-600" 
                                    onClick={() => openDrilldown('type', 'income', statsPrefix, 'Income Details')} 
                                />
                                <StatCard 
                                    label={viewMode === 'month' ? "Monthly Expenses" : "Annual Expenses"} 
                                    amount={spent} 
                                    icon={<TrendingDown className="text-rose-100" size={32} />} 
                                    color="bg-rose-600" 
                                    onClick={() => openDrilldown('type', 'expense', statsPrefix, 'Expense Details')} 
                                />
                                <StatCard 
                                    label={viewMode === 'month' ? "Net Flow" : "Net Annual"} 
                                    amount={net} 
                                    icon={<Wallet className={net >= 0 ? "text-emerald-100" : "text-rose-100"} size={32} />} 
                                    color={net >= 0 ? "bg-emerald-700" : "bg-rose-700"} 
                                    onClick={() => {}} 
                                />
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                                    <div className="flex gap-4 items-center">
                                        <div className="flex bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            {viewMode !== 'year' && ['6M', 'YTD', '1Y'].map(r => (
                                                <button 
                                                    key={r} 
                                                    onClick={() => setGraphRange(r)} 
                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${graphRange === r ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <button 
                                                onClick={() => setDashboardChartType('trend')}
                                                className={`p-2 rounded-xl transition-all ${dashboardChartType === 'trend' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                                                title="Trend Chart"
                                            >
                                                <TrendingUp size={18} />
                                            </button>
                                            <button 
                                                onClick={() => setDashboardChartType('pie')}
                                                className={`p-2 rounded-xl transition-all ${dashboardChartType === 'pie' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                                                title="Pie Chart"
                                            >
                                                <PieChartIcon size={18} />
                                            </button>
                                        </div>
                                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                            {dashboardChartType === 'trend' ? (viewMode === 'year' ? `${viewYear} Trend Analysis` : 'Cashflow Trends') : 'Category Distribution'}
                                        </div>
                                    </div>
                                    {dashboardChartType === 'trend' && <MultiSelectDropdown options={['Total Income', ...allCategories]} selected={visibleCatLines} onChange={setVisibleCatLines} label="Category Lines" />}
                                </div>
                                <div className="h-80 w-full">
                                    {dashboardChartType === 'trend' ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={graphData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#475569" : "#f8fafc"} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} tickFormatter={(value) => `$${value}`} />
                                                <Tooltip 
                                                    cursor={{ fill: darkMode ? '#1e293b' : '#f1f5f9', radius: 12 }} 
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            const sortedCats = Object.entries(data.breakdown || {}).sort((a,b) => b[1] - a[1]).slice(0, 3);
                                                            return (
                                                                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-2xl border border-gray-50 dark:border-gray-700 min-w-[260px] pointer-events-auto z-[9999] animate-in fade-in zoom-in duration-200 transition-colors">
                                                                    <p className="font-black text-gray-900 dark:text-white mb-3 text-lg border-b border-gray-50 dark:border-gray-700 pb-3">{label}</p>
                                                                    <div className="space-y-2 mb-4">
                                                                        <button onClick={(e) => { e.stopPropagation(); openDrilldown('type', 'income', data.fullDate, `Income - ${label}`); }} className="flex justify-between text-sm w-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl p-2.5 transition-colors cursor-pointer group"><span className="text-emerald-600 dark:text-emerald-400 font-black">Income</span> <span className="font-black group-hover:scale-110 transition-transform dark:text-white">${data.income.toFixed(0)}</span></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); openDrilldown('type', 'expense', data.fullDate, `Expenses - ${label}`); }} className="flex justify-between text-sm w-full hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl p-2.5 transition-colors cursor-pointer group"><span className="text-rose-600 dark:text-rose-400 font-black">Expenses</span> <span className="font-black group-hover:scale-110 transition-transform dark:text-white">${data.expense.toFixed(0)}</span></button>
                                                                    </div>
                                                                    {sortedCats.length > 0 && (
                                                                        <div className="pt-3 border-t border-gray-50 dark:border-gray-700">
                                                                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Top Spending</p>
                                                                            {sortedCats.map(([cat, amt]) => (
                                                                                <button key={cat} onClick={(e) => { e.stopPropagation(); openDrilldown('category', cat, data.fullDate, `${cat} in ${label}`); }} className="flex justify-between text-xs text-gray-600 dark:text-gray-400 w-full hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-xl transition-colors cursor-pointer">
                                                                                    <span className="font-bold underline decoration-dotted" style={{color: stringToColor(cat)}}>{cat}</span><span className="font-black dark:text-white">${amt.toFixed(0)}</span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }} 
                                                    wrapperStyle={{ outline: 'none' }} 
                                                />
                                                <Bar dataKey="expense" radius={[10, 10, 10, 10]} barSize={28} onClick={handleBarClick} cursor="pointer">
                                                    {graphData.map((entry, index) => (
                                                        <Cell 
                                                            key={`cell-${index}`} 
                                                            fill="#f43f5e" 
                                                            opacity={entry.fullDate === selectedDatePrefix ? 1 : 0.2} 
                                                        />
                                                    ))}
                                                </Bar>
                                                {visibleCatLines.includes('Total Income') && <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} dot={false} activeDot={{r: 6, strokeWidth: 0}} shadow="0 4px 6px -1px rgb(0 0 0 / 0.1)" />}
                                                {visibleCatLines.map((cat, i) => {
                                                    if (cat === 'Total Income') return null;
                                                    return <Line key={cat} type="monotone" dataKey={cat} stroke={stringToColor(cat)} strokeWidth={3} dot={{r: 4, strokeWidth: 0}} />;
                                                })}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col xl:flex-row items-center justify-between gap-12 px-4">
                                            <div className="relative flex-1 h-full min-h-[350px] w-full group">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={pieData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius="70%"
                                                            outerRadius="95%"
                                                            paddingAngle={4}
                                                            dataKey="value"
                                                            onClick={(data) => openDrilldown('category', data.name, statsPrefix, `${data.name} Details`)}
                                                            cursor="pointer"
                                                            animationBegin={0}
                                                            animationDuration={1200}
                                                        >
                                                            {pieData.map((entry, index) => (
                                                                <Cell 
                                                                    key={`cell-${index}`} 
                                                                    fill={entry.fill} 
                                                                    stroke="none"
                                                                    className="hover:opacity-80 transition-all duration-300"
                                                                />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip 
                                                            content={({ active, payload }) => {
                                                                if (active && payload && payload.length) {
                                                                    return (
                                                                        <div className="bg-white dark:bg-gray-800 p-5 rounded-[1.5rem] shadow-2xl border border-gray-50 dark:border-gray-700 flex items-center gap-4 animate-in fade-in zoom-in duration-200">
                                                                            <div className="w-4 h-12 rounded-full" style={{ backgroundColor: payload[0].payload.fill }}></div>
                                                                            <div>
                                                                                <p className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{payload[0].name}</p>
                                                                                <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(payload[0].value)}</p>
                                                                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg inline-block mt-1">{( (payload[0].value / spent) * 100 ).toFixed(1)}% of total</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Spent</p>
                                                    <p className="text-3xl font-black text-gray-900 dark:text-white">{formatCurrency(spent)}</p>
                                                </div>
                                            </div>
                                            <div className="w-full xl:w-80 max-h-full overflow-y-auto custom-scrollbar">
                                                <div className="grid grid-cols-1 gap-3">
                                                    {pieData.slice(0, 10).map((entry, i) => (
                                                        <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-3 rounded-2xl transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700" onClick={() => openDrilldown('category', entry.name, statsPrefix, `${entry.name} Details`)}>
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: entry.fill }}></div>
                                                                <div>
                                                                    <span className="text-sm font-black text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{entry.name}</span>
                                                                    <div className="w-0 group-hover:w-full h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-300"></div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(entry.value)}</p>
                                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{( (entry.value / spent) * 100 ).toFixed(1)}%</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {pieData.length > 10 && (
                                                        <button onClick={() => setViewMode('year')} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest text-center mt-4 hover:underline">
                                                            + {pieData.length - 10} more categories
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* CATEGORY BREAKDOWN SECTION */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="font-black text-gray-900 dark:text-white text-2xl tracking-tight">Top Categories</h3>
                                    <button onClick={() => setViewMode('year')} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors">See Trends</button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {categoryStats.map(([cat, amount]) => {
                                        const isExcluded = excludedCategories.includes(cat);
                                        return (
                                            <div 
                                                key={cat} 
                                                onClick={() => openDrilldown('category', cat, statsPrefix, `${cat} Details`)}
                                                className={`bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden group ${isExcluded ? 'opacity-50 grayscale' : ''}`}
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="w-12 h-12 rounded-[1.25rem] bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:bg-blue-600 dark:group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-sm">
                                                        {getCategoryIcon(cat, 24, categoryIcons)}
                                                    </div>
                                                    <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-black">
                                                        {( (amount / spent) * 100 ).toFixed(0)}%
                                                    </div>
                                                </div>
                                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 truncate">{cat}</p>
                                                <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(amount)}</p>
                                                <div className="absolute bottom-0 left-0 h-1.5 bg-blue-600 dark:bg-blue-500 transition-all duration-500 w-0 group-hover:w-full"></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* TAGS SECTION */}
                            {tagStats.length > 0 && (
                                <div className="space-y-6">
                                    <h3 className="font-black text-gray-900 dark:text-white text-2xl px-2">Popular Tags</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {tagStats.slice(0, 8).map(([tag, amount]) => (
                                            <button 
                                                key={tag} 
                                                onClick={() => openDrilldown('tag', tag, statsPrefix, `#${tag} History`)}
                                                className="bg-white dark:bg-gray-800 px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-900/50 transition-all flex items-center gap-3 group"
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                                    <Hash size={14} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-black text-gray-900 dark:text-white">#{tag}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{formatCurrency(amount)}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDEBAR: CALENDAR & ACTIVITY - ONLY ON EXTRA LARGE SCREENS TO PREVENT CONGESTION */}
                        <div className="hidden 3xl:block 3xl:col-span-4 space-y-8">
                            <div className="sticky top-8 space-y-8">
                                {/* MINI CALENDAR CARD */}
                                <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl shadow-blue-900/5 dark:shadow-none border border-gray-100 dark:border-gray-700 group transition-colors">
                                    <div className="p-6 flex justify-between items-center border-b border-gray-50 dark:border-gray-700 transition-colors">
                                        <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                                                <Calendar size={18} />
                                            </div>
                                            Calendar
                                        </h3>
                                        <button onClick={() => setActiveTab('history')} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline decoration-2 underline-offset-4">Full Screen</button>
                                    </div>
                                    <div className="p-4">
                                        <CalendarHistory 
                                            transactions={transactions}
                                            selectedDate={selectedDate}
                                            setSelectedDate={setSelectedDate}
                                            calendarMonth={calendarMonth}
                                            setCalendarMonth={setCalendarMonth}
                                            calendarYear={calendarYear}
                                            setCalendarYear={setCalendarYear}
                                            onEditTx={setEditTx}
                                            onFilterClick={(type, val) => openDrilldown(type, val, '', `${val} History`)}
                                            categoryIcons={categoryIcons}
                                            formatCurrency={formatCurrency}
                                            getCategoryIcon={getCategoryIcon}
                                            excludedCategories={excludedCategories}
                                            isMini={true}
                                            onMonthYearChange={(m, y) => {
                                                setViewMonth(m);
                                                setViewYear(y);
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* QUICK ACTIONS / RECENT ACTIVITY */}
                                <div className="bg-gray-900 dark:bg-gray-800 rounded-[3rem] p-8 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden group border border-transparent dark:border-gray-700 transition-colors">
                                    <div className="relative z-10">
                                        <h3 className="font-black text-xl mb-2">Quick Access</h3>
                                        <p className="text-gray-400 dark:text-gray-500 text-sm mb-6 font-medium">Manage your finances on the fly.</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => setEditTx({isNew: true})} className="bg-white/10 hover:bg-white/20 p-4 rounded-3xl transition-all border border-white/5 flex flex-col items-center gap-2 group/btn">
                                                <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/40 group-hover/btn:scale-110 transition-transform"><Plus size={20} /></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">New Entry</span>
                                            </button>
                                            <button onClick={triggerFileUpload} className="bg-white/10 hover:bg-white/20 p-4 rounded-3xl transition-all border border-white/5 flex flex-col items-center gap-2 group/btn">
                                                <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/40 group-hover/btn:scale-110 transition-transform"><UploadCloud size={20} /></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Import</span>
                                            </button>
                                        </div>
                                    </div>
                                    {/* DECORATIVE BLOB */}
                                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl group-hover:bg-blue-600/30 transition-all"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* COMBINED ACTIVITY TAB */}
                {activeTab === 'activity' && (
                    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in py-10">
                        <div className="text-center space-y-2">
                            <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Activity Center</h2>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">How would you like to update your records today?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* MANUAL ENTRY CARD */}
                            <div 
                                onClick={() => setEditTx({isNew: true})}
                                className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] shadow-xl shadow-blue-900/5 border border-gray-100 dark:border-gray-700 text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all group border-b-4 border-b-blue-600"
                            >
                                <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform text-blue-600 dark:text-blue-400 shadow-inner group-hover:rotate-6">
                                    <PlusCircle size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Manual Entry</h3>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 font-medium px-4">Record a single income or expense item with precision.</p>
                                <button className="mt-8 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all active:scale-95">Add Now</button>
                            </div>

                            {/* BULK IMPORT CARD */}
                            <div 
                                onClick={triggerFileUpload}
                                className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] shadow-xl shadow-emerald-900/5 border border-gray-100 dark:border-gray-700 text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all group border-b-4 border-b-emerald-600"
                            >
                                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => processFile(e.target.files[0])} />
                            </div>

                            {/* BULK IMPORT CARD */}
                            <div 
                                onClick={triggerFileUpload}
                                className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] shadow-xl shadow-emerald-900/5 border border-gray-100 dark:border-gray-700 text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all group border-b-4 border-b-emerald-600"
                            >
                                <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform text-emerald-600 dark:text-emerald-400 shadow-inner group-hover:-rotate-6">
                                    <UploadCloud size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Bulk Import</h3>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 font-medium px-4">Upload PDF or Excel statements to sync your accounts instantly.</p>
                                <button className="mt-8 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-700 transition-all active:scale-95">Select File</button>
                            </div>
                        </div>

                        {loading && (
                            <div className="flex flex-col items-center gap-4 py-10 animate-pulse">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-blue-600 dark:text-blue-400 font-black tracking-widest uppercase text-xs">Parsing Statement...</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">History</h2>
                                <p className="text-gray-500 text-sm">Review and manage your past transactions</p>
                            </div>
                            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Search history..." 
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm dark:text-white"
                                    />
                                    {historySearch && (
                                        <button onClick={() => setHistorySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 self-stretch md:self-auto transition-colors">
                                    <button 
                                        onClick={() => setHistoryViewMode('list')}
                                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-bold transition-all ${historyViewMode === 'list' ? 'bg-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        List View
                                    </button>
                                    <button 
                                        onClick={() => setHistoryViewMode('calendar')}
                                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-bold transition-all ${historyViewMode === 'calendar' ? 'bg-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        Calendar View
                                    </button>
                                </div>
                            </div>
                        </div>

                        {historyViewMode === 'calendar' ? (
                            <CalendarHistory 
                                transactions={transactions}
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                calendarMonth={calendarMonth}
                                setCalendarMonth={setCalendarMonth}
                                calendarYear={calendarYear}
                                setCalendarYear={setCalendarYear}
                                onEditTx={setEditTx}
                                onFilterClick={(type, val) => openDrilldown(type, val, '', `${val} History`)}
                                categoryIcons={categoryIcons}
                                formatCurrency={formatCurrency}
                                getCategoryIcon={getCategoryIcon}
                                excludedCategories={excludedCategories}
                            />
                        ) : (
                            <div className="space-y-6">
                                {Object.keys(nestedHistory).length === 0 && (
                                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <History size={24} className="text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <p className="text-gray-400 dark:text-gray-500 font-bold">No history records match your search.</p>
                                        {historySearch && <button onClick={() => setHistorySearch('')} className="mt-2 text-blue-600 dark:text-blue-400 font-bold text-sm">Clear Search</button>}
                                    </div>
                                )}
                                {Object.entries(nestedHistory).sort((a,b) => b[0] - a[0]).map(([year, yearData]) => {
                                    const yearNet = yearData.totalIncome - yearData.totalExpense;
                                    return (
                                    <div key={year} className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6 transition-all hover:shadow-md">
                                        <div className="p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700" onClick={() => setExpandedYears(prev => ({...prev, [year]: !prev[year]}))}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${expandedYears[year] ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                                    <ChevronRight size={20} className={`transition-transform duration-300 ${expandedYears[year] ? 'rotate-90' : ''}`} />
                                                </div>
                                                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{year}</h2>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="hidden md:flex gap-2">
                                                    <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl text-xs font-black border border-emerald-100/50 dark:border-emerald-800/50">
                                                        <span className="opacity-50 mr-1">INC</span> {formatCurrency(yearData.totalIncome)}
                                                    </div>
                                                    <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-4 py-2 rounded-xl text-xs font-black border border-rose-100/50 dark:border-rose-800/50">
                                                        <span className="opacity-50 mr-1">EXP</span> {formatCurrency(yearData.totalExpense)}
                                                    </div>
                                                </div>
                                                <div className={`${yearNet >= 0 ? 'bg-emerald-600 shadow-emerald-200 dark:shadow-none' : 'bg-rose-600 shadow-rose-200 dark:shadow-none'} text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg`}>
                                                    NET {yearNet >= 0 ? '+' : ''}{formatCurrency(yearNet)}
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'range', startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: `Entire Year ${year}` }) }}
                                                    className="p-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={18}/>
                                                </button>
                                            </div>
                                        </div>
                                        {expandedYears[year] && (
                                            <div className="p-6 pt-2 space-y-4">
                                                {Object.entries(yearData.months).sort((a,b) => {
                                                    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                                    return months.indexOf(b[0]) - months.indexOf(a[0]);
                                                }).map(([month, data]) => {
                                                    const monthKey = `${year}-${month}`;
                                                    const monthNet = data.income - data.expense;
                                                    return (
                                                        <div key={monthKey} className="group">
                                                            <div className="flex justify-between items-center px-4 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-[1.5rem] transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700" onClick={() => setExpandedMonths(prev => ({...prev, [monthKey]: !prev[monthKey]}))}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${expandedMonths[monthKey] ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'}`}>
                                                                        <ChevronDown size={16} className={`transition-transform duration-300 ${expandedMonths[monthKey] ? 'rotate-180' : ''}`} />
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="font-black text-gray-700 dark:text-gray-200">{month}</h3>
                                                                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{data.txs.length} Transactions</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="hidden sm:flex gap-3 text-[10px] font-black uppercase tracking-widest">
                                                                        <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(data.income)}</span>
                                                                        <span className="text-rose-500 dark:text-rose-400">-{formatCurrency(data.expense)}</span>
                                                                    </div>
                                                                    <div className={`${monthNet >= 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20'} px-3 py-1 rounded-lg text-xs font-black border border-transparent`}>
                                                                        {monthNet >= 0 ? '+' : ''}{formatCurrency(monthNet)}
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const mIdx = new Date(`${month} 1, 2000`).getMonth() + 1;
                                                                            const mStr = String(mIdx).padStart(2, '0');
                                                                            const lastDay = new Date(year, mIdx, 0).getDate();
                                                                            setDeleteConfirm({ type: 'range', startDate: `${year}-${mStr}-01`, endDate: `${year}-${mStr}-${lastDay}`, label: `${month} ${year}` });
                                                                        }}
                                                                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-gray-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash2 size={14}/>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {expandedMonths[monthKey] && (
                                                                <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-2 animate-slide-down">
                                                                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                                                        {data.txs.map(tx => (
                                                                            <TransactionRow 
                                                                                key={tx.firestoreId} 
                                                                                tx={tx} 
                                                                                onClick={() => setEditTx(tx)} 
                                                                                onFilterClick={(type, val) => openDrilldown(type, val, '', `${val} History`)}
                                                                                isGlobalExcluded={excludedCategories.includes(tx.category)}
                                                                                categoryIcons={categoryIcons}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* POPUPS (EDIT ON TOP z-500) */}
        {editTx && (
            <Popup title={editTx.isNew ? 'New Entry' : 'Edit Entry'} onClose={() => setEditTx(null)} zIndex={500}>
                <TransactionForm 
                    initialData={editTx.isNew ? {} : editTx} 
                    onSave={handleSave} 
                    onDelete={!editTx.isNew ? () => setDeleteConfirm({ type: 'single', id: editTx.firestoreId }) : null} 
                    allCategories={allCategories} 
                    allSources={allSources}
                    allTags={allTags}
                    isCategoryExcluded={excludedCategories.includes(editTx.category)}
                />
            </Popup>
        )}
        
        {/* IMPORT PREVIEW POPUP (z-100) */}
        {importPreview && (
            <Popup title={`Import Preview (${importPreview.length} Items)`} onClose={() => setImportPreview(null)} wide zIndex={100}>
                <div className="flex flex-col h-[70vh]">
                     {/* GLOBAL SOURCE SELECTOR */}
                     <div className="bg-blue-50 p-4 rounded-xl flex items-center gap-4 mb-4 border border-blue-100">
                         <span className="text-sm font-bold text-blue-800">Set Default Payment Source:</span>
                         <div className="w-64">
                             <CreatableCategorySelect 
                                value={importGlobalSource} 
                                onChange={setImportGlobalSource} 
                                options={allSources} 
                                placeholder="Select Source (e.g. Amex)"
                             />
                         </div>
                     </div>

                     <div className="flex-1 overflow-y-auto -mx-6 px-6">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs font-bold text-gray-500 uppercase border-b bg-gray-50 sticky top-0">
                                    <th className="p-3 w-10"></th>
                                    <th className="p-3 w-28">Date</th>
                                    <th className="p-3">Desc</th>
                                    <th className="p-3 w-24">Amount</th>
                                    <th className="p-3 w-24">Flow</th>
                                    <th className="p-3 w-40">Cat</th>
                                    <th className="p-3 w-32">Tags</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {importPreview.map((tx, idx) => {
                                    const isRowExcluded = tx.isExcluded || excludedCategories.includes(tx.category);
                                    return (
                                    <tr key={tx.tempId} className={`border-b hover:bg-gray-50 ${isRowExcluded ? 'opacity-50 grayscale' : ''}`}>
                                        <td className="p-2 text-center">
                                            <button onClick={() => { const n = [...importPreview]; n[idx].isExcluded = !n[idx].isExcluded; setImportPreview(n); }} className="text-gray-400 hover:text-blue-600">
                                                {isRowExcluded ? <EyeOff size={16}/> : <Eye size={16}/>}
                                            </button>
                                        </td>
                                        <td className="p-2"><input className="w-full bg-transparent outline-none font-medium text-sm" value={tx.date} onChange={e => { const n = [...importPreview]; n[idx].date = e.target.value; setImportPreview(n); }} /></td>
                                        <td className="p-2"><input className="w-full bg-transparent outline-none font-medium text-sm" value={tx.description} onChange={e => { const n = [...importPreview]; n[idx].description = e.target.value; setImportPreview(n); }} /></td>
                                        <td className="p-2"><input className="w-full bg-transparent outline-none font-medium text-sm" value={tx.amount} onChange={e => { const n = [...importPreview]; n[idx].amount = e.target.value; setImportPreview(n); }} /></td>
                                        <td className="p-2">
                                            <select 
                                                className="bg-transparent text-sm font-bold outline-none"
                                                value={tx.type} 
                                                onChange={e => { const n = [...importPreview]; n[idx].type = e.target.value; setImportPreview(n); }}
                                            >
                                                <option value="expense">Spent</option>
                                                <option value="income">Earned</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <CreatableCategorySelect 
                                                value={tx.category} 
                                                onChange={(val) => { 
                                                    const n = [...importPreview]; 
                                                    n[idx].category = val; 
                                                    if (val === 'ExpenseReport' || val === 'OverDrive') n[idx].type = 'income';
                                                    setImportPreview(n); 
                                                }} 
                                                options={allCategories}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <CreatableCategorySelect 
                                                value={tx.tags && tx.tags[0] ? tx.tags[0] : ''} 
                                                onChange={(val) => { const n = [...importPreview]; n[idx].tags = [val]; setImportPreview(n); }} 
                                                options={allTags}
                                                placeholder="Tag"
                                            />
                                        </td>
                                        <td className="p-2"><button onClick={() => setImportPreview(importPreview.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><X size={16}/></button></td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                     </div>
                     <div className="pt-4 border-t flex justify-end gap-3 mt-2">
                         <button onClick={() => setImportPreview(null)} className="px-6 py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200">Cancel</button>
                         <button onClick={confirmImport} className="px-6 py-3 rounded-xl font-bold bg-gray-900 text-white hover:scale-105 transition-transform flex items-center gap-2"><Save size={18}/> Confirm Import</button>
                     </div>
                </div>
            </Popup>
        )}

        {/* --- Import Confirmation Modal --- */}
        {showImportConfirmModal && (
            <Popup title="Confirm Import" onClose={() => setShowImportConfirmModal(false)} zIndex={600}>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-xl">
                        <AlertCircle size={24} />
                        <p className="text-sm font-bold">No default payment method selected.</p>
                    </div>
                    <p className="text-gray-600 text-sm">You can select one now to apply to all imported transactions, or ignore to leave them blank.</p>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Payment Method</label>
                        <CreatableCategorySelect 
                            value={importGlobalSource} 
                            onChange={setImportGlobalSource} 
                            options={allSources} 
                            placeholder="Select Source (e.g. Amex)" 
                        />
                    </div>

                                         <div className="flex gap-3 pt-6 mt-4 border-t dark:border-gray-700 transition-colors">
                                            <button onClick={executeImport} className="flex-1 py-4 rounded-2xl font-black bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-all">Ignore & Continue</button>
                                            <button onClick={executeImport} className="flex-1 py-4 rounded-2xl font-black bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all">Confirm Import</button>
                                        </div>                </div>
            </Popup>
        )}

        {/* DRILLDOWN POPUP (z-400) */}
        {drilldownState && (
            <Popup 
                title={
                    <div className="flex flex-col">
                        <span className="dark:text-white">{drilldownState.title}</span>
                        {/* Summary Header */}
                        {currentList.length > 0 && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                                Total: {formatCurrency(currentList.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0))}
                            </span>
                        )}
                    </div>
                }
                onClose={() => setDrilldownState(null)} 
                wide
                zIndex={400} 
                headerAction={
                    (drilldownState.stack && drilldownState.stack.length > 0) ? (
                        <button onClick={handleDrilldownBack} className="flex items-center gap-1 w-8 h-8 justify-center rounded-full bg-gray-100 hover:bg-gray-200 mr-2 transition-colors text-gray-600">
                            <ArrowLeft size={18}/>
                        </button>
                    ) : null
                }
            >
                <div className="overflow-y-auto max-h-[60vh] -mx-6">
                    {currentList.map(tx => (
                        <TransactionRow 
                            key={tx.firestoreId} 
                            tx={tx} 
                            onClick={() => setEditTx(tx)} 
                            onFilterClick={(type, val) => openDrilldown(type, val, '', `${val} History`)}
                            isGlobalExcluded={excludedCategories.includes(tx.category)}
                            categoryIcons={categoryIcons}
                        />
                    ))}
                    {currentList.length === 0 && <div className="text-center text-gray-400 py-10">No records found.</div>}
                </div>
            </Popup>
        )}

        {/* MANAGE MODAL (Categories, Sources, Tags) */}
        {showManageModal && (
            <Popup title="Manage Data" onClose={() => setShowManageModal(null)} zIndex={600}>
                <div className="flex gap-4 border-b dark:border-gray-700 mb-4 transition-colors">
                    {['category', 'source', 'tags'].map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => { setManageTab(tab); setEditingItem(null); }}
                            className={`pb-2 text-sm font-bold capitalize transition-colors ${manageTab === tab ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        >
                            {tab === 'category' ? 'Categories' : (tab === 'source' ? 'Payment Methods' : 'Tags')}
                        </button>
                    ))}
                </div>
                
                <div className="space-y-4">
                     {/* ADD NEW INPUT */}
                     {!editingItem && (
                         <div className="flex gap-2">
                            <input id="newItemInput" placeholder={`Add new ${manageTab}...`} className="flex-1 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg text-sm font-bold outline-none border border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-blue-200 dark:focus:border-blue-800 transition-all dark:text-white"/>
                            <button onClick={() => {
                                const val = document.getElementById('newItemInput').value;
                                if(val) alert(`To add "${val}", simply use it when creating a new transaction. It will automatically be saved!`);
                            }} className="bg-black dark:bg-blue-600 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"><Plus size={14}/> Add</button>
                         </div>
                     )}

                    {/* CONTENT LIST */}
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                        {manageTab === 'category' && allCategories.map(cat => {
                            const isEditing = editingItem && editingItem.type === 'category' && editingItem.original === cat;
                            if (isEditing) {
                                return (
                                    <div key={cat} className="flex gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl">
                                        <div className="relative group">
                                            {/* --- START CHANGE: CLICK TO TOGGLE ICON PICKER --- */}
                                            <button 
                                                onClick={() => setIconPickerOpen(iconPickerOpen === cat ? null : cat)}
                                                className="w-10 h-10 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 shadow-sm"
                                            >
                                                {getCategoryIcon(editingItem.icon || cat, 18, categoryIcons)}
                                            </button>
                                            
                                            {iconPickerOpen === cat && (
                                                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700 rounded-2xl w-64 p-3 grid grid-cols-6 gap-2 z-50 h-48 overflow-y-auto custom-scrollbar">
                                                    {AVAILABLE_ICONS.map(iconKey => {
                                                        const IconCmp = ICON_MAP[iconKey];
                                                        return (
                                                            <button 
                                                                key={iconKey} 
                                                                onClick={() => {
                                                                    setEditingItem(prev => ({ ...prev, icon: iconKey }));
                                                                    setIconPickerOpen(null); // Close on selection
                                                                }} 
                                                                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl flex justify-center transition-colors"
                                                            >
                                                                <IconCmp size={18} className="text-gray-600 dark:text-gray-400" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {/* --- END CHANGE --- */}
                                        </div>
                                        <input 
                                            className="flex-1 bg-white dark:bg-gray-700 px-3 rounded-lg text-sm font-bold outline-none border border-blue-200 dark:border-blue-800 dark:text-white" 
                                            value={editingItem.current} 
                                            onChange={e => setEditingItem(prev => ({ ...prev, current: e.target.value }))}
                                        />
                                        <button onClick={handleRename} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"><Check size={16}/></button>
                                        <button onClick={() => setEditingItem(null)} className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"><X size={16}/></button>
                                    </div>
                                );
                            }
                            return (
                                <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors" 
                                     onClick={() => {
                                         const newExcluded = excludedCategories.includes(cat) ? excludedCategories.filter(c => c !== cat) : [...excludedCategories, cat];
                                         setExcludedCategories(newExcluded);
                                     }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-700">
                                            {getCategoryIcon(cat, 18, categoryIcons)}
                                        </div>
                                        <span className="font-bold text-gray-700 dark:text-gray-200">{cat}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {excludedCategories.includes(cat) ? <CheckSquare size={22} className="text-rose-500"/> : <Square size={22} className="text-gray-300 dark:text-gray-600"/>}
                                        <button onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'category', original: cat, current: cat }); }} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={16}/></button>
                                        <button onClick={(e) => { e.stopPropagation(); setManagerConfirm({ type: 'category', value: cat }) }} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {manageTab === 'source' && allSources.map(src => {
                            const isEditing = editingItem && editingItem.type === 'source' && editingItem.original === src;
                            if (isEditing) {
                                return (
                                    <div key={src} className="flex gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl">
                                        <input 
                                            className="flex-1 bg-white dark:bg-gray-700 px-3 rounded-lg text-sm font-bold outline-none border border-blue-200 dark:border-blue-800 dark:text-white" 
                                            value={editingItem.current} 
                                            onChange={e => setEditingItem(prev => ({ ...prev, current: e.target.value }))}
                                        />
                                        <button onClick={handleRename} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"><Check size={16}/></button>
                                        <button onClick={() => setEditingItem(null)} className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"><X size={16}/></button>
                                    </div>
                                );
                            }
                            return (
                                <div key={src} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <div className="flex items-center gap-3">
                                        <CreditCard size={18} className="text-gray-400 dark:text-gray-500"/>
                                        <span className="font-bold text-gray-700 dark:text-gray-200">{src}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setEditingItem({ type: 'source', original: src, current: src })} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={16}/></button>
                                        <button onClick={() => setManagerConfirm({ type: 'source', value: src })} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            );
                        })}

                        {manageTab === 'tags' && (
                             <div className="flex flex-wrap gap-2">
                                {allTags.map(tag => {
                                    const isEditing = editingItem && editingItem.type === 'tags' && editingItem.original === tag;
                                    if (isEditing) {
                                        return (
                                            <div key={tag} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 p-1 rounded-lg">
                                                <input 
                                                    className="w-24 bg-white dark:bg-gray-700 px-2 py-1 text-xs rounded border border-blue-200 dark:border-blue-800 outline-none dark:text-white" 
                                                    value={editingItem.current} 
                                                    onChange={e => setEditingItem(prev => ({ ...prev, current: e.target.value }))}
                                                />
                                                <button onClick={handleRename} className="text-blue-600 dark:text-blue-400 p-1"><Check size={14}/></button>
                                                <button onClick={() => setEditingItem(null)} className="text-gray-400 dark:text-gray-500 p-1"><X size={14}/></button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={tag} className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-4 py-2 rounded-full text-sm font-bold cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors shadow-sm" onClick={() => setEditingItem({ type: 'tags', original: tag, current: tag })}>
                                            #{tag}
                                            <button onClick={(e) => { e.stopPropagation(); setManagerConfirm({ type: 'tags', value: tag }); }} className="hover:text-red-600 transition-colors ml-1"><X size={14}/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Popup>
        )}

        {/* Manager Confirm Dialog */}
        {managerConfirm && (
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertCircle size={24} /></div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Delete {managerConfirm.value}?</h3>
                    <p className="text-gray-500 mb-6">This will remove this {managerConfirm.type} from all past transactions. This cannot be undone.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setManagerConfirm(null)} className="flex-1 py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200">Cancel</button>
                        <button onClick={() => handleBatchDelete(managerConfirm.type, managerConfirm.value)} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700">Confirm Delete</button>
                    </div>
                </div>
            </div>
        )}

        {deleteConfirm && (
            <Popup title="Confirm Delete" onClose={() => setDeleteConfirm(null)} zIndex={700}>
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto shadow-sm">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2 text-lg border-b border-gray-50 pb-3 dark:text-white dark:border-gray-700">Delete Records?</h3>
                    <p className="text-gray-500 mb-8 font-medium">
                        {deleteConfirm.type === 'single' 
                            ? "Are you sure you want to remove this transaction? This action cannot be undone." 
                            : `This will permanently delete ALL items in ${deleteConfirm.label}. Are you sure?`
                        }
                    </p>
                    <div className="flex gap-4">
                        <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 rounded-2xl font-black text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">Cancel</button>
                        <button onClick={executeDelete} className="flex-1 py-4 rounded-2xl font-black text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 active:scale-95">
                            <Trash2 size={20}/> Delete
                        </button>
                    </div>
                </div>
            </Popup>
        )}
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => processFile(e.target.files[0])} />
      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---

const MultiSelectDropdown = ({ options, selected, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (opt) => {
        if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
        else onChange([...selected, opt]);
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-400 text-xs transition-colors">
                <Filter size={14}/> {label} {selected.length > 0 && `(${selected.length})`} <ChevronDown size={14}/>
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto z-50 p-2">
                    {options.map(opt => (
                        <div key={opt} onClick={() => toggleOption(opt)} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: stringToColor(opt)}}></div>
                            <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{opt}</span>
                            {selected.includes(opt) ? <CheckSquare size={16} className="text-blue-600 dark:text-blue-400"/> : <Square size={16} className="text-gray-300 dark:text-gray-600"/>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CalendarHistory = ({ transactions, selectedDate, setSelectedDate, calendarMonth, setCalendarMonth, calendarYear, setCalendarYear, onEditTx, onFilterClick, categoryIcons, formatCurrency, getCategoryIcon, excludedCategories, isMini, onMonthYearChange }) => {
    const [showDayPopup, setShowDayPopup] = useState(false);
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
    
    // Calculate monthly totals for the summary
    const monthlyStats = useMemo(() => {
        const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
        const monthTxs = transactions.filter(tx => tx.date.startsWith(monthPrefix) && !tx.isExcluded && !excludedCategories.includes(tx.category));
        const income = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        return { income, expense, net: income - expense, count: monthTxs.length };
    }, [transactions, calendarMonth, calendarYear, excludedCategories]);

    const handleMonthChange = (m) => {
        setCalendarMonth(m);
        if (onMonthYearChange) onMonthYearChange(m, calendarYear);
    };

    const handleYearChange = (y) => {
        setCalendarYear(y);
        if (onMonthYearChange) onMonthYearChange(calendarMonth, y);
    };

    const prevMonth = () => {
        let newM = calendarMonth - 1;
        let newY = calendarYear;
        if (calendarMonth === 0) {
            newM = 11;
            newY = calendarYear - 1;
        }
        setCalendarMonth(newM);
        setCalendarYear(newY);
        if (onMonthYearChange) onMonthYearChange(newM, newY);
    };

    const nextMonth = () => {
        let newM = calendarMonth + 1;
        let newY = calendarYear;
        if (calendarMonth === 11) {
            newM = 0;
            newY = calendarYear + 1;
        }
        setCalendarMonth(newM);
        setCalendarYear(newY);
        if (onMonthYearChange) onMonthYearChange(newM, newY);
    };

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className={`h-24 ${isMini ? 'md:h-24' : 'md:h-32'} rounded-2xl bg-gray-50/40 dark:bg-gray-800/40 border border-transparent`}></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayTransactions = transactions.filter(tx => tx.date === dateStr);
        const dayIncome = dayTransactions.reduce((acc, tx) => acc + (tx.type === 'income' && !tx.isExcluded && !excludedCategories.includes(tx.category) ? tx.amount : 0), 0);
        const dayExpense = dayTransactions.reduce((acc, tx) => acc + (tx.type === 'expense' && !tx.isExcluded && !excludedCategories.includes(tx.category) ? tx.amount : 0), 0);
        const isSelected = selectedDate === dateStr;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        days.push(
            <div 
                key={d} 
                onClick={() => { setSelectedDate(dateStr); setShowDayPopup(true); }}
                className={`h-24 ${isMini ? 'md:h-24' : 'md:h-32'} p-2.5 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between relative group border ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-4 ring-blue-500/10 z-10 scale-[1.02] shadow-lg shadow-blue-500/10' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md'}`}
            >
                <div className="flex justify-between items-start">
                    <span className={`text-sm font-black transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : (isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-900/40' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-200')}`}>{d}</span>
                    {dayTransactions.length > 0 && !isMini && (
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded-md border border-gray-100 dark:border-gray-600 group-hover:bg-white dark:group-hover:bg-gray-600 transition-colors">
                            <span className="text-[10px] font-black text-gray-500 dark:text-gray-400">{dayTransactions.length}</span>
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-1 mt-auto overflow-hidden">
                    {(dayIncome > 0 || dayExpense > 0) && (
                        <div className="flex flex-col gap-0.5">
                            {dayIncome > 0 && (
                                <div className={`flex items-center gap-1.5 ${isMini ? '' : 'bg-emerald-50/50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-lg border border-emerald-100/50 dark:border-emerald-800/50'}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shrink-0"></div>
                                    <div className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 truncate">{formatCurrency(dayIncome)}</div>
                                </div>
                            )}
                            {dayExpense > 0 && (
                                <div className={`flex items-center gap-1.5 ${isMini ? '' : 'bg-rose-50/50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded-lg border border-rose-100/50 dark:border-rose-800/50'}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shrink-0"></div>
                                    <div className="text-[9px] font-black text-rose-700 dark:text-rose-400 truncate">{formatCurrency(dayExpense)}</div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Visual Cues for Categories - Prevent overlap */}
                    <div className="flex flex-wrap gap-0.5 pt-1">
                        {[...new Set(dayTransactions.map(t => t.category))].slice(0, 4).map((cat, i) => (
                            <div key={i} title={cat} className={`w-1 h-1 rounded-full ${excludedCategories.includes(cat) ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-400/60'}`}></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const selectedDayTransactions = transactions.filter(tx => tx.date === selectedDate);
    const [selY, selM, selD] = (selectedDate || '').split('-').map(Number);
    const formattedSelectedDate = selectedDate ? new Date(selY, selM - 1, selD).toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: new Date(0, i).toLocaleString('default', { month: 'long' })
    }));

    const yearOptions = Array.from({ length: 11 }, (_, i) => ({
        value: new Date().getFullYear() - 5 + i,
        label: (new Date().getFullYear() - 5 + i).toString()
    }));

    return (
        <div className={`space-y-6 ${isMini ? 'p-2' : ''}`}>
            {/* MONTHLY SUMMARY MINI-DASHBOARD - HIDDEN IN MINI MODE */}
            {!isMini && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Monthly Income</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(monthlyStats.income)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Monthly Expense</p>
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(monthlyStats.expense)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Monthly Net</p>
                        <p className={`text-2xl font-black ${monthlyStats.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{monthlyStats.net >= 0 ? '+' : ''}{formatCurrency(monthlyStats.net)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Activity</p>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{monthlyStats.count} Transactions</p>
                    </div>
                </div>
            )}

            <div className={`bg-white dark:bg-gray-800 rounded-[2.5rem] ${isMini ? 'border border-gray-100 dark:border-gray-700 shadow-sm' : 'shadow-xl shadow-blue-900/5 border border-gray-100 dark:border-gray-700'} overflow-hidden transition-colors`}>
                <div className={`p-6 ${isMini ? 'pb-4 pt-4 px-4' : 'border-b border-gray-50 dark:border-gray-700'} flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-b from-white dark:from-gray-800 to-gray-50/30 dark:to-gray-800/30`}>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-600 shadow-sm">
                        <CustomDropdown 
                            value={calendarMonth} 
                            onChange={handleMonthChange} 
                            options={monthOptions} 
                        />
                        <div className="w-px h-6 bg-gray-100 dark:bg-gray-600 mx-1"></div>
                        <CustomDropdown 
                            value={calendarYear} 
                            onChange={handleYearChange} 
                            options={yearOptions} 
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-2.5 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md rounded-xl transition-all text-gray-400 dark:text-gray-500 hover:text-blue-600 border border-transparent hover:border-gray-100 dark:hover:border-gray-600"><ChevronLeft size={22}/></button>
                        <button onClick={() => { 
                            const now = new Date();
                            handleMonthChange(now.getMonth());
                            handleYearChange(now.getFullYear());
                        }} className="px-5 py-2.5 bg-white dark:bg-gray-700 hover:shadow-md rounded-xl transition-all text-xs font-black text-gray-600 dark:text-gray-300 hover:text-blue-600 border border-gray-100 dark:border-gray-600">Today</button>
                        <button onClick={nextMonth} className="p-2.5 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md rounded-xl transition-all text-gray-400 dark:text-gray-500 hover:text-blue-600 border border-transparent hover:border-gray-100 dark:hover:border-gray-600"><ChevronRight size={22}/></button>
                    </div>
                </div>
                
                <div className={`${isMini ? 'p-2' : 'p-6 bg-gray-50/30 dark:bg-gray-900/30'}`}>
                    <div className="grid grid-cols-7 gap-3 mb-4 px-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-3">
                        {days}
                    </div>
                </div>
            </div>

            {/* POPUP FOR DAY TRANSACTIONS */}
            {showDayPopup && selectedDate && (
                <Popup 
                    title={
                        <div className="flex flex-col">
                            <span className="text-lg font-black text-gray-900 dark:text-white">{formattedSelectedDate}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-bold">{selectedDayTransactions.length} Transactions Found</span>
                        </div>
                    }
                    onClose={() => setShowDayPopup(false)}
                    wide
                    zIndex={1500}
                >
                    <div className="overflow-y-auto max-h-[60vh] -mx-6">
                        {selectedDayTransactions.length > 0 ? (
                            selectedDayTransactions.map(tx => (
                                <TransactionRow 
                                    key={tx.firestoreId} 
                                    tx={tx} 
                                    onClick={() => { onEditTx(tx); setShowDayPopup(false); }} 
                                    onFilterClick={onFilterClick}
                                    isGlobalExcluded={excludedCategories.includes(tx.category)}
                                    categoryIcons={categoryIcons}
                                />
                            ))
                        ) : (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <History size={24} className="text-gray-300" />
                                </div>
                                <p className="text-gray-400 font-medium">No transactions on this day.</p>
                                <button 
                                    onClick={() => { onEditTx({isNew: true, date: selectedDate}); setShowDayPopup(false); }}
                                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:scale-105 transition-transform"
                                >
                                    + Add New Transaction
                                </button>
                            </div>
                        )}
                    </div>
                </Popup>
            )}
        </div>
    );
};

const TransactionRow = ({ tx, onClick, onFilterClick, isGlobalExcluded, categoryIcons }) => {
    const isExcluded = tx.isExcluded || isGlobalExcluded;
    return (
        <div className={`flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors ${isExcluded ? 'opacity-50 grayscale' : ''}`} onClick={onClick}>
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tx.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                    {isExcluded ? <EyeOff size={18}/> : (tx.type === 'income' ? <TrendingUp size={18}/> : <TrendingDown size={18}/>)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{tx.description}</p>
                        {tx.source && tx.source !== 'Cash' && 
                            <span 
                                onClick={(e) => { e.stopPropagation(); onFilterClick('source', tx.source); }}
                                className="text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 rounded text-gray-500 dark:text-gray-400 font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <CreditCard size={10}/> {tx.source}
                            </span>
                        }
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><Calendar size={12}/> {tx.date}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        <span 
                            onClick={(e) => { e.stopPropagation(); onFilterClick('category', tx.category); }}
                            className="bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 px-2 py-0.5 rounded-md text-gray-500 dark:text-gray-400 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            {/* REPLACED WITH ICON HELPER */}
                            {React.cloneElement(getCategoryIcon(tx.category, 10, categoryIcons), { className: "mr-1" })}
                            {tx.category}
                        </span>
                        {Array.isArray(tx.tags) && tx.tags.map(tag => (
                            <span 
                                key={tag}
                                onClick={(e) => { e.stopPropagation(); onFilterClick('tag', tag); }}
                                className="bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-purple-400 text-purple-600 dark:text-purple-400 px-1.5 rounded-md font-bold cursor-pointer transition-colors"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <span className={`font-bold px-3 py-1 rounded-lg text-sm ${tx.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
            </span>
        </div>
    );
};

const Popup = ({ title, onClose, children, wide, headerAction, zIndex }) => (
    <div 
        className={`fixed inset-0 bg-gray-900/30 dark:bg-gray-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in`} 
        style={{ zIndex: zIndex || 1000 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
        <div className={`bg-white dark:bg-gray-800 w-full ${wide ? 'max-w-[90vw]' : 'max-w-md'} rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] transition-colors`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 overflow-hidden">
                    {headerAction}
                    <div className="text-xl font-black text-gray-800 dark:text-white truncate">{title}</div>
                </div>
                <button onClick={onClose} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"><X size={20}/></button>
            </div>
            <div className="text-gray-700 dark:text-gray-200">
                {children}
            </div>
        </div>
    </div>
);

const CreatableCategorySelect = ({ value, onChange, options, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const ref = useRef(null);
    useEffect(() => { setInputValue(value || ''); }, [value]);
    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const filteredOptions = options.filter(o => String(o).toLowerCase().includes(inputValue.toLowerCase()));
    const handleSelect = (val) => { setInputValue(val); onChange(val); setIsOpen(false); };
    const handleChange = (e) => { setInputValue(e.target.value); onChange(e.target.value); setIsOpen(true); };

    return (
        <div className="relative w-full" ref={ref}>
            <input 
                type="text"
                className="w-full bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg font-medium border border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 outline-none transition-colors text-sm text-gray-900 dark:text-white"
                value={inputValue}
                onChange={handleChange}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder || "Select/Type"}
            />
            <div className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 pointer-events-none"><ChevronDown size={14}/></div>
            {isOpen && filteredOptions.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 max-h-40 overflow-y-auto">
                    {filteredOptions.map(opt => (
                        <div key={opt} onClick={() => handleSelect(opt)} className="p-2 text-sm font-bold cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const StyledSelect = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const selectedLabel = options.find(o => o.value === value)?.label || value;
    return (
        <div className="relative w-full" ref={ref}>
            <div onClick={() => setIsOpen(!isOpen)} className="w-full bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl font-bold flex justify-between items-center cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all h-[60px] dark:text-white">
                {selectedLabel} <ChevronDown size={16} className="text-gray-400 dark:text-gray-500"/>
            </div>
            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {options.map(opt => (
                        <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`p-3 text-sm font-bold cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30 ${value === opt.value ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400'}`}>
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CustomDropdown = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-gray-700 dark:text-gray-200 min-w-[100px] justify-between transition-colors">{options.find(o => o.value === value)?.label} <ChevronDown size={14} className="text-gray-400 dark:text-gray-500"/></button>
            {isOpen && <div className="absolute top-full mt-2 left-0 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto z-50 p-1">{options.map(opt => <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${value === opt.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{opt.label}</button>)}</div>}
        </div>
    );
};

const TransactionForm = ({ initialData, onSave, onDelete, allCategories, allSources, allTags, isCategoryExcluded }) => {
    const [formData, setFormData] = useState({ 
        id: initialData.firestoreId || null, 
        date: initialData.date || new Date().toISOString().split('T')[0], 
        desc: initialData.description || '', 
        amount: initialData.amount || '', 
        type: initialData.type || 'expense', 
        mode: initialData.mode || 'money', 
        category: initialData.category || '',
        source: initialData.source || '',
        tags: Array.isArray(initialData.tags) ? initialData.tags : [],
        isExcluded: initialData.isExcluded || false
    });
    const [manuallyChangedCat, setManuallyChangedCat] = useState(false);

    useEffect(() => {
        if (!manuallyChangedCat && formData.desc.length > 2 && !initialData.id) {
            const detected = detectCategory(formData.desc);
            if (detected) setFormData(prev => ({ ...prev, category: detected }));
        }
    }, [formData.desc]);

    const handleCatChange = (val) => {
        setFormData(prev => ({ ...prev, category: val }));
        setManuallyChangedCat(true); 
    };

    return (
        <div className="space-y-5">
            {/* Top Bar: Date & Exclude Toggle */}
            <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Date</label>
                    {/* UPDATED CALENDAR UI */}
                    <div className="relative w-full bg-gray-50 dark:bg-gray-700/50 rounded-xl h-[60px] flex items-center overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 transition-colors">
                        <div className="absolute left-4 text-gray-400 dark:text-gray-300 pointer-events-none">
                            <Calendar size={20} />
                        </div>
                        <input 
                            type="date" 
                            className="w-full h-full bg-transparent border-none pl-12 pr-4 font-bold text-gray-800 dark:text-white outline-none dark:[color-scheme:dark]"
                            value={formData.date} 
                            onChange={e => setFormData({...formData, date: e.target.value})} 
                        />
                    </div>
                </div>
                <div className="flex-1 flex items-end">
                    <button 
                        onClick={() => setFormData(p => ({...p, isExcluded: !p.isExcluded}))}
                        className={`w-full h-[60px] rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isCategoryExcluded ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' : (formData.isExcluded ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400')}`}
                        disabled={isCategoryExcluded}
                    >
                        {isCategoryExcluded ? <><EyeOff size={20}/> Hidden by Category</> : (formData.isExcluded ? <><EyeOff size={20}/> Excluded</> : <><Eye size={20}/> Visible</>)}
                    </button>
                </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Description</label>
                <input className="w-full bg-gray-50 dark:bg-gray-700 border border-transparent dark:border-gray-600 p-4 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white transition-colors" placeholder="What was this?" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} />
            </div>

            <div className="flex gap-4">
                <div className="w-1/2 space-y-1"><label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Amount</label><input type="number" className="w-full bg-gray-50 dark:bg-gray-700 border border-transparent dark:border-gray-600 p-4 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500/20 h-[60px] dark:text-white transition-colors [color-scheme:light] dark:[color-scheme:dark]" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                <div className="w-1/2 space-y-1"><label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Flow</label><StyledSelect value={formData.type} onChange={(v) => setFormData({...formData, type: v})} options={[{value: 'expense', label: 'Spent'}, {value: 'income', label: 'Earned'}]} /></div>
            </div>

            {/* Source & Tags (Smart Dropdowns) */}
            <div className="flex gap-4">
                <div className="w-1/2 space-y-1">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Payment Method</label>
                    <CreatableCategorySelect value={formData.source} onChange={(v) => setFormData({...formData, source: v})} options={allSources} placeholder="Card/Bank" />
                </div>
                <div className="w-1/2 space-y-1">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Tags</label>
                    <CreatableCategorySelect value={formData.tags[0] || ''} onChange={(v) => setFormData({...formData, tags: [v]})} options={allTags} placeholder="Trip, Project" />
                </div>
            </div>

            <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Category (Type to Create)</label>
                 <CreatableCategorySelect value={formData.category} onChange={handleCatChange} options={allCategories} />
            </div>
            
            <div className="pt-2"><button onClick={() => onSave(formData)} className="w-full bg-gray-900 dark:bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-gray-200 dark:shadow-none active:scale-95 transition-all">{formData.id ? 'Save Changes' : 'Add Transaction'}</button>{onDelete && <button onClick={onDelete} className="w-full mt-3 text-red-500 py-2 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">Delete Entry</button>}</div>
        </div>
    );
};

const StatCard = ({ label, amount, color, icon, onClick }) => ( 
    <div onClick={onClick} className={`${color} p-6 rounded-3xl shadow-lg shadow-gray-200 dark:shadow-none text-white cursor-pointer relative overflow-hidden group transition-transform active:scale-95`}>
        <div className="absolute right-[-20px] top-[-20px] opacity-20 group-hover:scale-125 transition-transform duration-500">{icon}</div>
        <div className="relative">
            <p className="opacity-80 text-xs md:text-sm font-bold mb-1 uppercase tracking-wider truncate">{label}</p>
            <p className="text-2xl md:text-3xl lg:text-4xl font-black truncate">${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
    </div> 
);
const SidebarItem = ({ icon, label, active, onClick }) => ( <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all duration-200 ${active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'}`}>{icon} {label}</button> );
const MobileNavItem = ({ icon, label, active, onClick }) => ( <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-blue-600' : 'text-gray-300 dark:text-gray-600'}`}>{icon} <span className="text-[10px] font-bold">{label}</span></button> );
const LoginScreen = ({ onLogin }) => ( <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-6"><button onClick={onLogin} className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-8 py-5 rounded-2xl font-bold shadow-2xl flex items-center gap-3 hover:scale-105 transition-transform">Sign in with Google</button></div> );

export default App;
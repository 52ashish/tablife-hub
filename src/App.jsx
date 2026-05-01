import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx-js-style';
import { db, auth, provider, signInWithPopup, signOut, collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDoc, setDoc, writeBatch, where, getDocs, serverTimestamp } from './firebase';
import { onAuthStateChanged } from "firebase/auth";
import { 
  LayoutDashboard, PlusCircle, History, LogOut, 
  ChevronDown, ChevronRight, ChevronLeft, X, UploadCloud, TrendingUp, TrendingDown, Calendar, Trash2, AlertCircle, Tag, Filter, CheckSquare, Square, FileInput, ArrowLeft, Save, CreditCard, Eye, EyeOff, Edit2, Settings, Wallet, Hash, Menu, Plus, PieChart as PieChartIcon,
  Utensils, Car, ShoppingBag, Zap, Home, Activity, Film, Briefcase, HelpCircle, GraduationCap,
  Plane, Gift, Music, Book, Wrench, Heart, Smile, Star, Sun, Moon, Cloud, Umbrella, Droplet, Anchor, Map, Lock, Key, Flag, Bell, Smartphone, Wifi, Coffee, ShoppingCart, Check,
  ArrowRight, Shield, Globe, Cpu, Sparkles, Monitor, Layers, MousePointer2, Database
} from 'lucide-react';
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Legend, AreaChart, Area, BarChart } from 'recharts';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

// --- CONFIG ---
const CATEGORY_RULES = {
  'Food': ['mcdonalds', 'burger', 'starbucks', 'cafe', 'restaurant', 'dining', 'eats', 'taco', 'pizza', 'coffee', 'chipotle', 'lunch', 'dinner', 'db world foods'],
  'Transport': ['uber', 'lyft', 'shell', 'exxon', 'chevron', 'gas', 'fuel', 'parking', 'metro', 'train', 'bus', 'tesla', 'waymo', 'spothero'],
  'Shopping': ['amazon', 'walmart', 'target', 'bestbuy', 'apple', 'nike', 'clothing', 'store', 'shop', 'saks', 'lululemon'],
  'Utilities': ['att', 'verizon', 't-mobile', 'comcast', 'water', 'electric', 'power', 'internet', 'subscription', 'netflix', 'spotify', 'hulu', 'peacock'],
  'Housing': ['rent', 'mortgage', 'hotel', 'airbnb', 'lodging', 'residence inn'],
  'Income': ['payroll', 'deposit', 'salary', 'transfer', 'refund', 'credit', 'enovation'],
  'Health': ['doctor', 'pharmacy', 'cvs', 'walgreens', 'hospital', 'dental', 'fitness', 'gym'],
  'CC Payment': ['payment to', 'autopay', 'thank you', 'payment received', 'internet payment'],
  'Grocery': ['liquor', 'wholefds', 'woodmans', 'patel brothers', 'hareli', 'desi chowrastha', 'kroger', 'sprouts'],
  'Entertainment': ['cinemark', 'amc'],
  'Interest': ['interest paid', 'interest credit', 'dividend'],
  'SENDTOMOUNI': ['mobile transfer to chk', 'payment to mounisha gona'],
  'Car Payment': ['vhagar']
};

const detectCategory = (desc) => {
  if (!desc) return null;
  const lowerDesc = String(desc).toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some(k => lowerDesc.includes(k))) return cat;
  }
  return null;
};

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Utilities', 'Housing', 'Health', 'Entertainment', 'CC Payment', 'Interest', 'India Transfer', 'SENDTOMOUNI', 'Car Payment', 'Uncategorized'];

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

const formatINR = (amount) => {
    if (!amount) return '₹0';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
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
    if (lower.includes('income') || lower.includes('salary') || lower.includes('payroll') || lower.includes('enovation')) return <Briefcase size={size} />;
    if (lower.includes('education') || lower.includes('school')) return <GraduationCap size={size} />;
    if (lower.includes('cc payment') || lower.includes('transfer') || lower.includes('sendtomouni')) return <CreditCard size={size} />;
    if (lower.includes('car payment')) return <Car size={size} />;
    return <Tag size={size} />;
};

// --- CONSTANTS ---
const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState({});
  const [manageSearch, setManageSearch] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Dashboard & Graph
  const today = new Date();
  const [selectedYears, setSelectedYears] = useState([today.getFullYear()]);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState('month'); 
  const [graphGranularity, setGraphGranularity] = useState('monthly'); 
  const [graphRange, setGraphRange] = useState('6M'); 
  const [visibleCatLines, setVisibleCatLines] = useState(['Total Income']); 
  const [dashboardChartType, setDashboardChartType] = useState('trend'); 
  const [selectedSource, setSelectedSource] = useState(['All Sources']); 

  // Derived Selection String for Highlighting
  const selectedDatePrefix = useMemo(() => {
      if (graphGranularity === 'yearly') return selectedYears[0].toString();
      return `${selectedYears[0]}-${String(viewMonth + 1).padStart(2, '0')}`;
  }, [selectedYears, viewMonth, graphGranularity]);

  // Settings
  const [excludedCategories, setExcludedCategories] = useState(() => {
      try {
          const saved = localStorage.getItem('excludedCategories');
          return saved ? JSON.parse(saved) : ['CC Payment', 'Transfer', 'SENDTOMOUNI'];
      } catch { return ['CC Payment', 'Transfer', 'SENDTOMOUNI']; }
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
  const [importError, setImportError] = useState(null);
  const [importGlobalSource, setImportGlobalSource] = useState(''); 
  const [importToIndiaHub, setImportToIndiaHub] = useState(false);
  
  // India Hub State
  const [indiaViewMode, setIndiaViewMode] = useState('year'); 
  const [indiaGraphGranularity, setIndiaGraphGranularity] = useState('monthly'); 
  const [indiaGraphRange, setIndiaGraphRange] = useState('6M'); 
  const [indiaSelectedYears, setIndiaSelectedYears] = useState(['All Years']);
  const [indiaViewMonth, setIndiaViewMonth] = useState(today.getMonth());
  const [indiaViewRecipient, setIndiaViewRecipient] = useState('All Recipients');
  
  const [showIndiaAuditModal, setShowIndiaAuditModal] = useState(false);
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  const [expandedYears, setExpandedYears] = useState({ [today.getFullYear()]: true });
  const [expandedMonths, setExpandedMonths] = useState({});
  const [historySearch, setHistorySearch] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState([]);
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
          listenToActivityLogs(u.uid);
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

  const listenToActivityLogs = (uid) => {
    const q = query(collection(db, "users", uid, "activity_logs"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        setActivityLogs(snapshot.docs.slice(0, 50).map(doc => ({ ...doc.data(), id: doc.id })));
    });
  };

  let isLoginLocked = false;
  const handleLogin = async () => { 
      if (isLoginLocked) return;
      isLoginLocked = true;
      try { 
          await signInWithPopup(auth, provider); 
      } catch (e) { 
          console.error(e); 
          alert("Login Error: " + e.message + " (Code: " + e.code + ")"); 
      } finally {
          isLoginLocked = false;
      }
  };

  const toggleSelectTx = (id) => {
      setSelectedTxIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // --- LOGGING ---
  const logActivity = async (action, txId, description, changes = {}, isIndiaCorridor = false) => {
    if (!user) return;
    try {
        await addDoc(collection(db, "users", user.uid, "activity_logs"), {
            action,
            transactionId: txId || 'N/A',
            description,
            changes,
            timestamp: serverTimestamp(),
            isIndiaCorridor
        });
    } catch (e) { console.error("Logging failed:", e); }
  };

  // --- CRUD ---
  const handleSave = async (formData) => {
    if(!formData.desc || !formData.amount) return;
    const finalCat = formData.category || 'Uncategorized';
    let finalTags = Array.isArray(formData.tags) ? formData.tags : (formData.tags ? [formData.tags] : []);

    const txData = {
      date: formData.date, description: formData.desc, amount: parseFloat(formData.amount),
      secondaryAmount: formData.secondaryAmount || '',
      notes: formData.notes || '',
      type: formData.type, mode: formData.mode, category: finalCat,
      source: formData.source || '', tags: finalTags, 
      isExcluded: formData.isExcluded,
      isIndiaCorridor: formData.isIndiaCorridor || false,
      recipient: formData.recipient || '',
      rate: formData.rate || ''
    };
    try {
      if (formData.id) {
          // Fetch old state for logging
          const oldSnap = await getDoc(doc(db, "users", user.uid, "transactions", formData.id));
          const oldData = oldSnap.exists() ? oldSnap.data() : {};
          
          await updateDoc(doc(db, "users", user.uid, "transactions", formData.id), txData);
          logActivity('EDIT', formData.id, txData.description, { before: oldData, after: txData }, txData.isIndiaCorridor);
      } else {
          const docRef = await addDoc(collection(db, "users", user.uid, "transactions"), { ...txData, id: Date.now() });
          logActivity('ADD', docRef.id, txData.description, { after: txData }, txData.isIndiaCorridor);
      }
      setEditTx(null);
      if (!formData.id && !txData.isIndiaCorridor) setActiveTab('dashboard'); 
    } catch (e) { alert(e.message); }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
        if (deleteConfirm.type === 'single') {
            if (!deleteConfirm.id) throw new Error("Transaction ID missing.");
            const oldSnap = await getDoc(doc(db, "users", user.uid, "transactions", deleteConfirm.id));
            const oldData = oldSnap.exists() ? oldSnap.data() : {};
            
            await deleteDoc(doc(db, "users", user.uid, "transactions", deleteConfirm.id));
            logActivity('DELETE', deleteConfirm.id, oldData.description || 'Unknown', { before: oldData }, oldData.isIndiaCorridor);
        } else {
            const deletedItems = [];
            let isIndiaBatch = false;

            if (deleteConfirm.type === 'group') {
                const batch = writeBatch(db);
                let count = 0;
                for (const tx of deleteConfirm.group) {
                    let docId = tx.firestoreId;
                    
                    // Fallback for older logs: find docId by matching the internal 'id'
                    if (!docId && tx.id) {
                        const match = transactions.find(t => t.id === tx.id);
                        if (match) docId = match.firestoreId;
                    }

                    if (!docId) continue;
                    
                    deletedItems.push(tx);
                    if (tx.isIndiaCorridor) isIndiaBatch = true;
                    
                    const docRef = doc(collection(db, "users", user.uid, "transactions"), String(docId));
                    batch.delete(docRef);
                    count++;
                }
                if (count > 0) await batch.commit();
            } else if (deleteConfirm.type === 'range') {
                const q = query(
                    collection(db, "users", user.uid, "transactions"), 
                    where("date", ">=", deleteConfirm.startDate), 
                    where("date", "<=", deleteConfirm.endDate)
                );
                const snapshot = await getDocs(q);
                const batch = writeBatch(db);
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    deletedItems.push({ ...data, firestoreId: docSnap.id });
                    if (data.isIndiaCorridor) isIndiaBatch = true;
                    batch.delete(docSnap.ref);
                });
                await batch.commit();
            }

            if (deletedItems.length > 0) {
                logActivity('BULK_DELETE', 'BATCH', `Bulk Purge: ${deletedItems.length} records removed (${deleteConfirm.label})`, { 
                    items: deletedItems,
                    count: deletedItems.length,
                    type: deleteConfirm.type,
                    label: deleteConfirm.label
                }, isIndiaBatch);
            }
        }
        setSelectedTxIds([]);
        setEditTx(null);
        setDeleteConfirm(null);
    } catch(e) { 
        console.error("Delete Error:", e);
        alert("Delete failed: " + e.message); 
    }
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
          const processedItems = [];

          snapshot.docs.forEach(docSnap => {
              const ref = doc(db, "users", user.uid, "transactions", docSnap.id);
              const data = docSnap.data();
              processedItems.push({ ...data, firestoreId: docSnap.id });

              if (type === 'category') batch.update(ref, { category: 'Uncategorized' });
              else if (type === 'source') batch.update(ref, { source: '' });
              else if (type === 'tags') {
                  const newTags = data.tags.filter(t => t !== value);
                  batch.update(ref, { tags: newTags });
              }
          });
          
          await batch.commit();

          if (processedItems.length > 0) {
              const isIndiaBatch = type === 'category' && value === 'India Transfer';
              logActivity('BULK_EDIT', 'BATCH', `Refactor Protocol: ${processedItems.length} records modified via ${type} de-indexing (${value})`, {
                  items: processedItems,
                  count: processedItems.length,
                  editType: type,
                  originalValue: value
              }, isIndiaBatch);
          }

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

  const triggerFileUpload = () => { 
      const input = document.getElementById('global-file-input');
      if (input) input.click(); 
  };

  const processFile = async (file) => {
    if(!file) return;
    setLoading(true);
    setImportError(null);
    const ext = file.name.split('.').pop().toLowerCase();
    const input = document.getElementById('global-file-input');
    
    try {
      let parsedData = [];
      if (ext === 'pdf') parsedData = await processPDF(file);
      else if (['xlsx', 'xls', 'csv'].includes(ext)) parsedData = await processExcel(file);
      else if (ext === 'txt') parsedData = await processText(file);
      
      if (parsedData && parsedData.length > 0) {
          setImportPreview(parsedData);
          setImportGlobalSource(''); 
      } else {
          setImportError("No transactions detected. Please verify the file format and ensure headers like 'USD', 'INR', or 'Date' are present.");
          setImportToIndiaHub(false);
      }
    } catch (err) { 
        console.error("Import Error:", err);
        setImportError("Processing Error: " + err.message); 
        setImportToIndiaHub(false);
    } finally {
        setLoading(false);
        if (input) input.value = ''; // CRITICAL: Allow re-selection of same file
    }
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
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (importToIndiaHub) {
            let allParsed = [];
            let debugInfo = [];
            
            workbook.SheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (rows.length < 1) return;

                // 1. Aggressive Header Search
                const keywords = ['date', 'who', 'send', 'dollar', 'usd', 'rate', 'rupee', 'inr', 'received', 'recieved', 'visible', 'hidden'];
                let headerRowIndex = -1;
                let foundHeader = [];
                
                for (let i = 0; i < Math.min(rows.length, 50); i++) {
                    const rowCells = rows[i];
                    if (!Array.isArray(rowCells)) continue;
                    const rowText = rowCells.map(c => String(c || '').toLowerCase()).join(' ');
                    const matches = keywords.filter(k => rowText.includes(k));
                    if (matches.length >= 2) {
                        headerRowIndex = i;
                        foundHeader = rowCells.map(h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    debugInfo.push(`Sheet "${name}": No header found in first 50 rows.`);
                    return;
                }

                const dataRows = rows.slice(headerRowIndex + 1);
                const sheetParsed = dataRows.map((row, rIdx) => {
                    if (!Array.isArray(row) || row.length === 0) return null;
                    
                    const findVal = (keys) => {
                        const idx = foundHeader.findIndex(h => keys.some(k => h.includes(k)));
                        return idx !== -1 ? row[idx] : null;
                    };

                    // Map specific columns from screenshot
                    let dateVal = findVal(['date', 'day', 'time']);
                    if (typeof dateVal === 'number' && dateVal > 10000) {
                        const d = XLSX.utils.format_cell({ t: 'd', v: dateVal });
                        dateVal = new Date(d).toISOString().split('T')[0];
                    } else if (dateVal) {
                        const d = new Date(dateVal);
                        if (!isNaN(d.getTime())) dateVal = d.toISOString().split('T')[0];
                    }
                    
                    const usd = parseFloat(String(findVal(['dollar', 'usd', 'sent']) || '0').replace(/[$,\s]/g, ''));
                    const rate = parseFloat(String(findVal(['rate', 'conversion', 'fx']) || '0').replace(/[₹,\s]/g, ''));
                    const inr = parseFloat(String(findVal(['rupee', 'inr', 'received', 'recieved']) || '0').replace(/[₹,\s]/g, ''));
                    const recipient = findVal(['who', 'recipient', 'sendto', 'name', 'payee']) || '';
                    const status = String(findVal(['visible', 'hidden', 'status']) || '').toLowerCase();
                    const notes = String(findVal(['description', 'notes', 'memo', 'purpose', 'remarks']) || '');

                    // Only return rows that look like actual transfers
                    if (!usd && !inr) return null;

                    return {
                        tempId: Date.now() + Math.random() + rIdx,
                        date: dateVal || new Date().toISOString().split('T')[0],
                        description: notes || 'India Transfer',
                        amount: usd || (inr && rate ? (inr / rate).toFixed(2) : 0),
                        rate: rate || (usd && inr ? (inr / usd).toFixed(2) : 0),
                        secondaryAmount: inr || (usd && rate ? (usd * rate).toFixed(2) : 0),
                        recipient: String(recipient),
                        type: 'expense',
                        category: 'India Transfer',
                        isIndiaCorridor: true,
                        isExcluded: status.includes('hidden'),
                        source: 'Import',
                        tags: []
                    };
                }).filter(Boolean);
                
                allParsed = [...allParsed, ...sheetParsed];
            });
            
            if (allParsed.length > 0) resolve(allParsed);
            else {
                const err = `Could not detect data. Found headers: ${debugInfo.join(' | ')}`;
                setImportError(err);
                resolve([]);
            }
        } else {
            resolve(parseRawText(XLSX.utils.sheet_to_csv(worksheet)));
        }
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
    // Improved Year Detection: Find all years, filter out future ones, and pick the most frequent or highest
    const allYears = text.match(/\b20\d{2}\b/g) || [];
    const validYears = allYears.map(y => parseInt(y)).filter(y => y <= new Date().getFullYear() + 1);
    
    let statementYear = new Date().getFullYear().toString();
    if (validYears.length > 0) {
        // Count frequencies
        const counts = {};
        validYears.forEach(y => counts[y] = (counts[y] || 0) + 1);
        // Sort by frequency descending, then by year descending
        const sortedYears = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || b - a);
        statementYear = sortedYears[0];
    }

    // DCU Specific: Pre-process text to identify sections
    const isDCU = /DCU|Digital Federal Credit Union/i.test(text);
    
    // Robust date regex: matches MM/DD/YYYY, YYYY-MM-DD, MMM DD (with/out space), and MM/DD
    const datePattern = /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})|(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})|((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s?\d{1,2})|(\b\d{1,2}\/\d{1,2}\b)/i;
    const moneyPattern = /(-?\$?\s?[\d,]+\.\d{2})/;
    const results = [];
    
    // Start as unknown
    let currentSection = 'unknown';
    
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const lowerLine = line.toLowerCase().trim();

      // Section Detection for DCU
      if (isDCU) {
          if (lowerLine.includes('checking') && lowerLine.length < 60) currentSection = 'checking';
          else if ((lowerLine.includes('savings') || lowerLine.includes('membership')) && lowerLine.length < 60) currentSection = 'savings';
          else if ((lowerLine.includes('loan') || lowerLine.includes('mortgage') || lowerLine.includes('vehicle')) && lowerLine.length < 60) {
              if (!lowerLine.includes('activity')) currentSection = 'loan';
          }
          else if (lowerLine.includes('deposits, dividends') || lowerLine.includes('withdrawals, fees') || lowerLine.includes('statement summary')) {
              currentSection = 'ignore';
          }
      }

      // Skip parsing if we are in loan or ignore sections
      if (isDCU && (currentSection === 'loan' || currentSection === 'ignore' || currentSection === 'unknown')) return;

      const dMatch = line.match(datePattern);
      const mMatch = line.match(moneyPattern);
      
      if (dMatch && mMatch) {
        // Skip header/summary lines
        if (lowerLine.includes('previous balance') || lowerLine.includes('new balance') || lowerLine.includes('total dividends') || lowerLine.includes('yield earned')) return;

        const amt = parseFloat(mMatch[0].replace(/[$,\s]/g, ''));
        let desc = line.replace(dMatch[0], '').replace(mMatch[0], '').trim().replace(/^,|,$/g, '').trim();
        
        // DCU Multi-line Description Handling: JUST SHOW LINE 2 if it exists
        if (isDCU && lines[idx + 1]) {
            const nextLine = lines[idx + 1].trim();
            const nextDateMatch = nextLine.match(datePattern);
            if (!nextDateMatch && nextLine.length > 0 && !nextLine.toLowerCase().includes('balance') && !nextLine.toLowerCase().includes('page')) {
                desc = nextLine; 
            }
        }

        if (desc.length > 2) {
            let dateObj = new Date(dMatch[0]);
            
            // Handle shorthand dates (MMM DD or MM/DD) by explicitly applying statementYear
            // Groups 3 and 4 in datePattern are the shorthand formats
            const isShorthand = dMatch[3] || dMatch[4];
            
            if (isShorthand || isNaN(dateObj.getTime()) || dateObj.getFullYear() <= 2001) {
                const dateStr = dMatch[0].trim();
                const mmmddMatch = dateStr.match(/^([a-z]{3})\s?(\d{1,2})$/i);
                if (mmmddMatch) {
                    dateObj = new Date(`${mmmddMatch[1]} ${mmmddMatch[2]} ${statementYear}`);
                } 
                else if (/^\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                    dateObj = new Date(`${dateStr}/${statementYear}`);
                } else if (isShorthand) {
                    // Fallback for other shorthand formats
                    dateObj = new Date(`${dateStr} ${statementYear}`);
                }
            }
            const isoDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            
            const isDiscover = /DISCOVER/i.test(text);
            const isSavings = /SAVINGS|CHECKING/i.test(text) || (isDCU && (currentSection === 'savings' || currentSection === 'checking'));
            let autoCat = 'Uncategorized';
            
            // Default logic: negative is income (for credit cards usually, or reversed logic elsewhere)
            // But for Bank Statements (DCU), negative is EXPENSE.
            let type = amt < 0 ? 'income' : 'expense';

            if (isDiscover || isDCU) {
                if (isSavings) {
                    // DCU Savings/Checking: Handle negative signs from withdrawal columns
                    if (amt < 0 || /WITHDRAWAL|TRANSFER TO|ZELLE.*TO|PURCHASE|DEBIT|PAYMENT/i.test(desc)) type = 'expense';
                    else if (amt > 0 || /INTEREST|DEPOSIT|TRANSFER FROM|ZELLE.*FROM|DIVIDEND|CREDIT/i.test(desc)) type = 'income';
                } else if (isDiscover) {
                    if (/PAYMENT|DIRECTPAY|CREDIT/i.test(desc)) type = 'income';
                    else type = 'expense';
                }
            } else {
                type = amt < 0 || /PAYMENT|DEPOSIT|INTEREST/i.test(desc) ? 'income' : 'expense';
            }

            // DCU Specific Categorization Overrides
            if (isDCU && /DIVIDEND/i.test(desc)) {
                autoCat = 'Interest';
                type = 'income';
            } else if (isDCU && /MOUNISHA GONA/i.test(desc)) {
                autoCat = 'SENDTOMOUNI';
                type = 'expense';
            } else if (isDCU && /VHAGAR/i.test(desc)) {
                autoCat = 'Car Payment';
                type = 'expense';
            } else if (/Zelle.*from/i.test(desc)) {
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
            } else if (/Internet Payment.*Thank/i.test(desc)) {
                autoCat = 'CC Payment';
                type = 'income';
            } else {
                autoCat = detectCategory(desc) || 'Uncategorized';
            }
            // --- END CHANGE ---

            let secondaryAmount = '';
            if (autoCat === 'India Transfer') {
                const inrMatch = line.match(/([\d,]+)\s?INR/i);
                if (inrMatch) secondaryAmount = inrMatch[1].replace(/,/g, '');
            }

            const isExcluded = ['CC Payment', 'Transfer', 'SENDTOMOUNI'].includes(autoCat);
            results.push({
              tempId: Date.now() + Math.random(),
              date: isoDate, description: desc.substring(0, 100),
              amount: Math.abs(amt), 
              secondaryAmount,
              notes: '',
              type, category: autoCat, mode: 'money', source: 'Import', tags: [], isExcluded
            });
        }
      }
    });
    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const confirmImport = () => {
      if (importToIndiaHub) {
          const hasMissingRecipient = importPreview.some(tx => !tx.recipient);
          if (hasMissingRecipient) {
              setShowImportConfirmModal(true);
          } else {
              executeImport();
          }
      } else {
          if (!importGlobalSource) {
              setShowImportConfirmModal(true);
          } else {
              executeImport();
          }
      }
  };

  const executeImport = async () => {
      if (!importPreview || importPreview.length === 0) return;
      setLoading(true);
      const isIndiaImport = importToIndiaHub; // Capture context
      
      try {
          const batch = writeBatch(db);
          const importedTxs = [];
          const yearsToExpand = new Set();
          const monthsToExpand = new Set();
          const sourcesToSelect = new Set();
          let firstTxDate = null;

          for (const tx of importPreview) {
              const { tempId: _tempId, ...finalTx } = tx; 
              if (importGlobalSource) finalTx.source = importGlobalSource;
              if (isIndiaImport) finalTx.isIndiaCorridor = true;
              
              const txId = Date.now() + Math.random();
              const docData = { ...finalTx, id: txId };
              
              // Create a new document reference for the batch
              const newDocRef = doc(collection(db, "users", user.uid, "transactions"));
              batch.set(newDocRef, docData);
              
              importedTxs.push({ ...docData, firestoreId: newDocRef.id });
              
              const [yStr, mStr] = tx.date.split('-');
              if (yStr && mStr) {
                  const txYear = parseInt(yStr);
                  yearsToExpand.add(txYear);
                  
                  const monthName = new Date(txYear, parseInt(mStr) - 1).toLocaleString('default', { month: 'long' });
                  monthsToExpand.add(`${txYear}-${monthName}`);
              }

              if (finalTx.source) sourcesToSelect.add(finalTx.source);
              if (!firstTxDate) firstTxDate = tx.date;
          }
          
          await batch.commit();
          
          const sourceName = importGlobalSource || (isIndiaImport ? 'India Corridor' : 'Mixed Sources');
          
          // Ensure imported sources are visible
          if (!selectedSource.includes('All Sources')) {
              setSelectedSource(prev => {
                  const next = new Set([...prev]);
                  sourcesToSelect.forEach(s => next.add(s));
                  return Array.from(next);
              });
          }

          setExpandedYears(prev => {
              const next = { ...prev };
              yearsToExpand.forEach(y => next[y] = true);
              return next;
          });

          setExpandedMonths(prev => {
              const next = { ...prev };
              monthsToExpand.forEach(mKey => next[mKey] = true);
              return next;
          });

          if (firstTxDate) {
              const [y, m] = firstTxDate.split('-').map(Number);
              if (!isNaN(y) && !isNaN(m)) {
                  setCalendarYear(y);
                  setCalendarMonth(m - 1);
                  setSelectedYears([y]);
                  setViewMonth(m - 1);
              }
          }

          logActivity('IMPORT', 'BULK', `Bulk Data Ingestion: ${importedTxs.length} records mapped to ${sourceName}`, { 
              items: importedTxs,
              source: sourceName,
              count: importedTxs.length
          }, isIndiaImport);

          setImportPreview(null);
          setImportGlobalSource('');
          setImportToIndiaHub(false);
          setShowImportConfirmModal(false);
          setActiveTab(isIndiaImport ? 'india' : 'history');
      } catch(e) { 
          console.error("Batch Import Failed:", e);
          alert("Import failed: " + e.message); 
      }
      setLoading(false);
  };

  // --- DROPDOWNS ---
  const { allCategories, allSources, allTags, allRecipients } = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    const sources = new Set(['Cash', 'Credit Card']);
    const tags = new Set(['Trip', 'Business']);
    const recipients = new Set();
    transactions.forEach(t => {
        if(t.category) {
            const catStr = String(t.category);
            // Normalize SENDTOMOUNI to uppercase to match CONFIG
            if (catStr.toUpperCase() === 'SENDTOMOUNI') cats.add('SENDTOMOUNI');
            else cats.add(catStr);
        }
        if(t.source) sources.add(String(t.source));
        if(Array.isArray(t.tags)) t.tags.forEach(tag => tag && tag.trim() && tags.add(tag));
        if(t.recipient) recipients.add(String(t.recipient));
    });
    return { 
        allCategories: Array.from(cats).sort(),
        allSources: Array.from(sources).sort(),
        allTags: Array.from(tags).sort(),
        allRecipients: Array.from(recipients).sort()
    };
  }, [transactions]);

  // --- STATS CALC ---
  const statsPrefix = viewMode === 'month' ? `${selectedYears[0]}-${String(viewMonth + 1).padStart(2, '0')}` : null;
  const allTimeTxs = transactions.filter(t => {
    const yearMatch = selectedYears.some(y => t.date.startsWith(y.toString()));
    const monthMatch = viewMode === 'month' ? t.date.startsWith(statsPrefix) : true;
    const sourceMatch = selectedSource.includes('All Sources') || selectedSource.includes(t.source);
    return yearMatch && monthMatch && sourceMatch && !t.isIndiaCorridor;
  });
  
  // INDIA HUB INDEPENDENCE: Exclude India Corridor transactions from main dashboard stats
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

    if (isYearlyGranularity || (viewMode === 'year' && selectedYears.length > 1)) {
        // Compare selected years
        const yearsToCompare = selectedYears.includes('All Years') 
            ? Array.from({length: 10}, (_, i) => now.getFullYear() - 5 + i)
            : [...selectedYears].sort((a,b) => a - b);

        yearsToCompare.forEach(y => {
            const prefix = `${y}`;
            const txs = transactions.filter(t => 
                t.date.startsWith(prefix) && 
                !t.isExcluded && 
                !excludedCategories.includes(t.category) &&
                !t.isIndiaCorridor &&
                (selectedSource.includes('All Sources') || selectedSource.includes(t.source))
            );
            
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
        });
    } else {
        // Standard Monthly View for a single year
        if (viewMode === 'year') {
            const yFocus = selectedYears[0];
            for (let i = 0; i < 12; i++) {
                const d = new Date(yFocus, i, 1);
                const prefix = `${yFocus}-${String(i + 1).padStart(2, '0')}`;
                const label = d.toLocaleString('default', { month: 'short' });

                const txs = transactions.filter(t => 
                    t.date.startsWith(prefix) && 
                    !t.isExcluded && 
                    !excludedCategories.includes(t.category) &&
                    !t.isIndiaCorridor &&
                    (selectedSource.includes('All Sources') || selectedSource.includes(t.source))
                );
                
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

                const txs = transactions.filter(t => 
                    t.date.startsWith(prefix) && 
                    !t.isExcluded && 
                    !excludedCategories.includes(t.category) &&
                    !t.isIndiaCorridor &&
                    (selectedSource.includes('All Sources') || selectedSource.includes(t.source))
                );
                
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
  }, [transactions, graphGranularity, graphRange, visibleCatLines, excludedCategories, viewMode, selectedYears, selectedSource]);

  // --- HANDLERS ---
  const handleBarClick = (data) => {
      if (data && data.fullDate) {
        if (data.type === 'yearly') {
            setSelectedYears([parseInt(data.name)]);
            setGraphGranularity('monthly');
            setViewMode('year'); 
            setCalendarYear(parseInt(data.name));
        } else {
            const [y, m] = data.fullDate.split('-');
            setSelectedYears([parseInt(y)]);
            if (m) {
                const monthIdx = parseInt(m) - 1;
                setViewMonth(monthIdx);
                setCalendarMonth(monthIdx);
                setViewMode('month');
                setGraphGranularity('monthly');
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
    let filtered = transactions.filter(t => !t.isIndiaCorridor);
    if (!selectedSource.includes('All Sources')) {
        filtered = filtered.filter(t => selectedSource.includes(t.source));
    }
    if (!historySearch) return filtered;
    const lowSearch = historySearch.toLowerCase();
    return filtered.filter(tx => 
        tx.description.toLowerCase().includes(lowSearch) || 
        tx.category.toLowerCase().includes(lowSearch) ||
        (tx.tags && tx.tags.some(tag => tag.toLowerCase().includes(lowSearch))) ||
        (tx.source && tx.source.toLowerCase().includes(lowSearch))
    );
  }, [transactions, historySearch, selectedSource]);

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
    <div className="flex h-screen bg-white dark:bg-[#020202] font-sans text-gray-900 dark:text-white overflow-hidden transition-colors duration-700 select-none relative">
      <input id="global-file-input" type="file" className="opacity-0 absolute pointer-events-none w-0 h-0" accept=".pdf,.xlsx,.xls,.csv,.txt" onChange={(e) => processFile(e.target.files[0])} />
      
      {/* GLOBAL LOADER */}
      {loading && (
          <div className="fixed inset-0 z-[10000] bg-white/60 dark:bg-black/60 backdrop-blur-md flex items-center justify-center animate-fade-in">
              <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-2xl shadow-blue-600/20"></div>
                  <p className="text-blue-600 dark:text-blue-400 font-black tracking-[0.4em] uppercase text-xs animate-pulse">Synchronizing Intelligence...</p>
              </div>
          </div>
      )}

      {/* AMBIENT BACKGROUND ANIMATION */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 opacity-40 dark:opacity-60">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-bounce duration-[10s]"></div>
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-400/5 rounded-full blur-[100px] animate-pulse delay-700"></div>
      </div>

      <aside className="hidden lg:flex w-72 flex-col bg-gray-50/50 dark:bg-white/[0.01] backdrop-blur-3xl border-r border-gray-200 dark:border-white/5 z-30 transition-all duration-700">
        <div className="p-8">
            <div className="flex items-center gap-3 group cursor-pointer">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                    <LayoutDashboard size={22} />
                </div>
                <div>
                    <h1 className="text-xl font-black tracking-tighter uppercase dark:text-white">TabLife.</h1>
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 leading-none">Intelligence Hub</p>
                </div>
            </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Overview" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <SidebarItem icon={<Globe size={20} />} label="India Hub" active={activeTab === 'india'} onClick={() => setActiveTab('india')} />
            <SidebarItem icon={<PlusCircle size={20} />} label="Activity" active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
            <SidebarItem icon={<History size={20} />} label="Ledger" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
            <SidebarItem icon={<Settings size={20} />} label="Settings" active={false} onClick={() => setShowManageModal(true)} />
            
            <div className="pt-8 px-4">
                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-4">Preference</p>
                <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 dark:text-gray-400 hover:bg-white/5 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white border border-transparent hover:border-gray-200 dark:hover:border-white/5"
                >
                    <div className="flex items-center gap-3">
                        {darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
                        {darkMode ? 'Light' : 'Dark'}
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`}></div>
                    </div>
                </button>
            </div>
        </nav>

        <div className="p-6 border-t border-gray-200 dark:border-white/5 space-y-4">
            <div className="flex items-center justify-between bg-white/50 dark:bg-white/5 p-3 rounded-2xl border border-gray-200 dark:border-white/5 group hover:border-blue-500/30 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative">
                        <img src={user.photoURL} className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/10 group-hover:scale-105 transition-transform" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#050505] rounded-full"></div>
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-black truncate dark:text-white">{user.displayName.split(' ')[0]}</p>
                        <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">Standard Plan</p>
                    </div>
                </div>
                <button onClick={() => signOut(auth)} className="text-gray-400 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-500/10 transition-all"><LogOut size={18} /></button>
            </div>
        </div>
      </aside>

      {/* MOBILE NAV DRAWER */}
      {navDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-[200] animate-fade-in">
              <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setNavDrawerOpen(false)}></div>
              <div className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-[#0a0a0a] shadow-2xl p-8 flex flex-col animate-in slide-in-from-left duration-300">
                  <div className="flex justify-between items-center mb-12">
                      <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic">TL</div>
                          <span className="text-2xl font-black tracking-tighter dark:text-white">TabLife.</span>
                      </div>
                      <button onClick={() => setNavDrawerOpen(false)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><X size={24} /></button>
                  </div>
                  
                  <nav className="flex-1 space-y-2">
                      <SidebarItem icon={<LayoutDashboard size={20} />} label="Overview" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setNavDrawerOpen(false); }} />
                      <SidebarItem icon={<Globe size={20} />} label="India Hub" active={activeTab === 'india'} onClick={() => { setActiveTab('india'); setNavDrawerOpen(false); }} />
                      <SidebarItem icon={<PlusCircle size={20} />} label="Activity" active={activeTab === 'activity'} onClick={() => { setActiveTab('activity'); setNavDrawerOpen(false); }} />
                      <SidebarItem icon={<History size={20} />} label="Ledger" active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setNavDrawerOpen(false); }} />
                      <SidebarItem icon={<Settings size={20} />} label="Settings" active={false} onClick={() => { setShowManageModal(true); setNavDrawerOpen(false); }} />
                  </nav>

                  <div className="mt-auto pt-8 border-t dark:border-white/5">
                      <div className="flex items-center gap-4 mb-8">
                          <img src={user.photoURL} className="w-12 h-12 rounded-xl border border-gray-200 dark:border-white/10" />
                          <div>
                              <p className="font-black dark:text-white">{user.displayName}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest uppercase">Portfolio Architect</p>
                          </div>
                      </div>
                      <button onClick={() => signOut(auth)} className="w-full py-4 bg-rose-500/10 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"><LogOut size={18}/> Authorize Exit</button>
                  </div>
              </div>
          </div>
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-20">
        <header className="lg:hidden flex justify-between items-center p-4 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 relative z-50 transition-colors">
            <div className="flex items-center gap-4">
                <button onClick={() => setNavDrawerOpen(true)} className="p-2 text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
                    <Menu size={24} />
                </button>
                <h1 className="font-black text-blue-600 text-lg tracking-tighter">TabLife.</h1>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-gray-500 dark:text-gray-400">
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <div className="relative">
                    <img src={user.photoURL} className="w-8 h-8 rounded-full shadow-sm cursor-pointer border border-gray-200 dark:border-white/10" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
                    {mobileMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-[#0a0a0a] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-2 backdrop-blur-3xl">
                            <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-500 font-black w-full p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors uppercase tracking-widest">
                                <LogOut size={14}/> Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-transparent transition-colors custom-scrollbar">
            <div className="max-w-full 4xl:max-w-[2560px] mx-auto space-y-12">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-12 gap-10 animate-fade-in pb-20 relative z-10">
                        {/* MAIN DASHBOARD HEADER */}
                        <PageHeader 
                            icon={<LayoutDashboard size={32} />}
                            title={<>Strategic <br /><span className="text-blue-600 dark:text-blue-500 animate-pulse">Wealth.</span></>}
                            subtitle="Universal Asset Intelligence Matrix"
                            badges={[
                                { 
                                    label: `Active Matrix: ${viewMode === 'month' ? `${MONTH_ORDER[viewMonth]} ${selectedYears[0]}` : (selectedYears.includes('All Years') ? 'Portfolio Baseline' : selectedYears.join(' + '))}`,
                                    color: 'bg-blue-600/10 border border-blue-600/20',
                                    textColor: 'text-blue-600',
                                    pulse: true
                                },
                                { label: `Stream: ${selectedSource.includes('All Sources') ? 'Total Portfolio' : selectedSource.join(' + ')}` }
                            ]}
                            filters={
                                <div className="flex flex-row flex-wrap items-center gap-2 w-full md:w-auto overflow-visible pb-2 md:pb-0">
                                    <div className="relative z-[60] flex bg-gray-100/50 dark:bg-white/5 lg:backdrop-blur-3xl p-0.5 md:p-2 rounded-xl md:rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:border-blue-500/30 transition-all duration-500 shrink-0">
                                        <div className="hidden md:flex items-center gap-2 px-4 border-r border-gray-200 dark:border-white/10 mr-2">
                                            <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Source</span>
                                        </div>
                                        <MultiSelectDropdown 
                                            options={['All Sources', ...allSources]} 
                                            selected={selectedSource} 
                                            onChange={setSelectedSource} 
                                            label="" 
                                        />
                                    </div>

                                    <div className="relative z-[50] flex bg-gray-100/50 dark:bg-white/5 lg:backdrop-blur-3xl p-0.5 md:p-2 rounded-xl md:rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:border-blue-500/30 transition-all duration-500 shrink-0">
                                        {viewMode === 'month' ? (
                                            <>
                                                <button onClick={() => setViewMode('year')} className="px-3 md:px-8 py-2 md:py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all hover:bg-white/5">MM</button>
                                                <div className="w-px bg-gray-200 dark:bg-white/10 my-2 mx-1 md:mx-2"></div>
                                                <CustomDropdown value={viewMonth} onChange={(m) => { setViewMonth(m); setCalendarMonth(m); }} options={Array.from({length: 12}, (_, i) => ({ value: i, label: MONTH_ORDER[i].substring(0, 3) }))} />
                                            </>
                                        ) : (
                                            <button onClick={() => setViewMode('month')} className="px-4 md:px-10 py-2 md:py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0">Annual</button>
                                        )}
                                        <div className="w-px bg-gray-200 dark:bg-white/10 my-2 mx-1 md:mx-2"></div>
                                        {viewMode === 'month' ? (
                                            <CustomDropdown 
                                                value={selectedYears[0]} 
                                                onChange={(y) => { setSelectedYears([y]); setCalendarYear(y); }} 
                                                options={Array.from({length: 10}, (_, i) => ({ value: today.getFullYear() - 5 + i, label: (today.getFullYear() - 5 + i).toString() }))} 
                                            />
                                        ) : (
                                            <MultiSelectDropdown 
                                                options={['All Years', ...Array.from({length: 10}, (_, i) => today.getFullYear() - 5 + i)]} 
                                                selected={selectedYears} 
                                                onChange={(years) => { setSelectedYears(years); if (years.length === 1 && typeof years[0] === 'number') setCalendarYear(years[0]); }} 
                                                label="" 
                                            />
                                        )}
                                    </div>
                                </div>
                            }
                        />

                        {/* MAIN DASHBOARD CONTENT */}
                        <div className="col-span-12 2xl:col-span-12 3xl:col-span-6 4xl:col-span-7 space-y-10">
                            {/* TOP METRIC PILLS - ALIGNED LEFT WITH CONTENT */}
                            <div className="flex flex-wrap gap-6 w-full">
                                <MetricCapsule label="Revenue Stream" amount={earned} icon={<TrendingUp size={28}/>} color="text-emerald-500 dark:text-emerald-400" bgColor="bg-emerald-50/50 dark:bg-emerald-500/5" borderColor="border-emerald-100 dark:border-emerald-500/20" onClick={() => openDrilldown('type', 'income', statsPrefix, 'Income Details')} />
                                <MetricCapsule label="Burn Protocol" amount={spent} icon={<TrendingDown size={28}/>} color="text-rose-500 dark:text-rose-400" bgColor="bg-rose-50/50 dark:bg-rose-500/5" borderColor="border-rose-100 dark:border-rose-500/20" onClick={() => openDrilldown('type', 'expense', statsPrefix, 'Expense Details')} />
                                <MetricCapsule label="Liquid Position" amount={net} icon={<Wallet size={28}/>} color={net >= 0 ? "text-blue-500 dark:text-blue-400" : "text-amber-500 dark:text-amber-400"} bgColor={net >= 0 ? "bg-blue-50/50 dark:bg-blue-500/5" : "bg-amber-50/50 dark:bg-amber-500/5"} borderColor={net >= 0 ? "border-blue-100 dark:border-blue-500/20" : "border-amber-100 dark:border-amber-500/20"} onClick={() => {}} />
                            </div>
                            {/* REMOVED DUPLICATE STAT CARDS FROM HERE - THEY ARE NOW IN THE HEADER AS CAPSULES */}

                            <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 transition-all">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex bg-gray-100/50 dark:bg-white/5 p-1.5 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-inner transition-all">
                                            {viewMode !== 'year' && ['6M', 'YTD', '1Y'].map(r => (
                                                <button 
                                                    key={r} 
                                                    onClick={() => setGraphRange(r)} 
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${graphRange === r ? 'bg-white dark:bg-gray-600 shadow-[0_8px_30px_rgb(0,0,0,0.1)] text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex bg-gray-100/50 dark:bg-white/5 p-1.5 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-inner transition-all">
                                            <button 
                                                onClick={() => setDashboardChartType('trend')}
                                                className={`p-2.5 rounded-xl transition-all ${dashboardChartType === 'trend' ? 'bg-white dark:bg-gray-600 shadow-[0_8px_30px_rgb(0,0,0,0.1)] text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                                                title="Trend Matrix"
                                            >
                                                <TrendingUp size={18} />
                                            </button>
                                            <button 
                                                onClick={() => setDashboardChartType('pie')}
                                                className={`p-2.5 rounded-xl transition-all ${dashboardChartType === 'pie' ? 'bg-white dark:bg-gray-600 shadow-[0_8px_30px_rgb(0,0,0,0.1)] text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                                                title="Allocation Spectrum"
                                            >
                                                <PieChartIcon size={18} />
                                            </button>
                                        </div>
                                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">
                                            {dashboardChartType === 'trend' ? (viewMode === 'year' ? `${selectedYears[0]} Matrix` : 'Quantum Trends') : 'Allocation Spectrum'}
                                        </div>
                                    </div>
                                    {dashboardChartType === 'trend' && <MultiSelectDropdown options={['Total Income', ...allCategories]} selected={visibleCatLines} onChange={setVisibleCatLines} label="Matrix Layers" />}
                                </div>
                                <div className="h-96 w-full relative">
                                    <div className="absolute inset-0 bg-blue-600/5 blur-[100px] pointer-events-none rounded-full scale-75"></div>
                                    {dashboardChartType === 'trend' ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={graphData}>
                                                <defs>
                                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                                    </linearGradient>
                                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "rgba(255,255,255,0.03)" : "#f1f5f9"} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dy={15} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} tickFormatter={(value) => `${value}`} />
                                                <Tooltip 
                                                    cursor={{ fill: darkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc', radius: 16 }} 
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            const sortedCats = Object.entries(data.breakdown || {}).sort((a,b) => b[1] - a[1]).slice(0, 3);
                                                            return (
                                                                <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 min-w-[280px] pointer-events-auto z-[9999] animate-in fade-in zoom-in duration-300">
                                                                    <p className="font-black text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-widest border-b dark:border-white/5 pb-3">{label} Analysis</p>
                                                                    <div className="space-y-3 mb-6">
                                                                        <div onClick={() => openDrilldown('type', 'income', data.fullDate, `Income - ${label}`)} className="flex justify-between items-center group cursor-pointer">
                                                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Revenue</span>
                                                                            <span className="text-xl font-black dark:text-white group-hover:text-emerald-500 transition-colors">${data.income.toLocaleString()}</span>
                                                                        </div>
                                                                        <div onClick={() => openDrilldown('type', 'expense', data.fullDate, `Expenses - ${label}`)} className="flex justify-between items-center group cursor-pointer">
                                                                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Spend</span>
                                                                            <span className="text-xl font-black dark:text-white group-hover:text-rose-500 transition-colors">${data.expense.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                    {sortedCats.length > 0 && (
                                                                        <div className="pt-4 border-t dark:border-white/5 space-y-2">
                                                                            <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">Top Vectors</p>
                                                                            {sortedCats.map(([cat, amt]) => (
                                                                                <div key={cat} onClick={() => openDrilldown('category', cat, data.fullDate, `${cat} in ${label}`)} className="flex justify-between items-center group cursor-pointer hover:bg-white/5 rounded-xl p-1 transition-all">
                                                                                    <span className="text-[10px] font-bold dark:text-gray-400 group-hover:text-white transition-colors">{cat}</span>
                                                                                    <span className="text-xs font-black dark:text-white">${amt.toLocaleString()}</span>
                                                                                </div>
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
                                                <Bar dataKey="expense" fill="url(#colorExpense)" radius={[12, 12, 12, 12]} barSize={32} onClick={handleBarClick} cursor="pointer">
                                                    {graphData.map((entry, index) => (
                                                        <Cell 
                                                            key={`cell-${index}`} 
                                                            fill="url(#colorExpense)" 
                                                            opacity={entry.fullDate === selectedDatePrefix ? 1 : 0.5}
                                                            stroke={entry.fullDate === selectedDatePrefix ? "#f43f5e" : "none"}
                                                            strokeWidth={entry.fullDate === selectedDatePrefix ? 2 : 0}
                                                        />
                                                    ))}
                                                </Bar>
                                                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 8, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                                                {visibleCatLines.map((cat) => (
                                                    cat !== 'Total Income' && <Line key={cat} type="monotone" dataKey={cat} stroke={stringToColor(cat)} strokeWidth={2} dot={false} strokeDasharray="5 5" opacity={0.5} />
                                                ))}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col xl:flex-row items-center justify-between gap-12 px-4">
                                            <div className="relative flex-1 h-full min-h-[350px] w-full group">
                                                <div className="relative h-full w-full z-10">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={pieData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius="70%"
                                                                outerRadius="95%"
                                                                paddingAngle={6}
                                                                dataKey="value"
                                                                onClick={(data) => openDrilldown('category', data.name, statsPrefix, `${data.name} Details`)}
                                                                cursor="pointer"
                                                                animationBegin={0}
                                                                animationDuration={1500}
                                                                stroke="none"
                                                            >
                                                                {pieData.map((entry, index) => (
                                                                    <Cell 
                                                                        key={`cell-${index}`} 
                                                                        fill={entry.fill} 
                                                                        className="hover:opacity-80 transition-all duration-500"
                                                                    />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip 
                                                                content={({ active, payload }) => { 
                                                                    if (active && payload && payload.length) { 
                                                                        return ( 
                                                                            <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-white/10 animate-in fade-in zoom-in duration-300"> 
                                                                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2">{payload[0].name}</p> 
                                                                                <p className="text-3xl font-black text-gray-900 dark:text-white">{formatCurrency(payload[0].value)}</p> 
                                                                            </div> 
                                                                        ); 
                                                                    } 
                                                                    return null; 
                                                                }} 
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-1">Aggregate</p>
                                                    <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{formatCurrency(spent)}</p>
                                                </div>
                                            </div>
                                            <div className="w-full xl:w-80 space-y-3 max-h-full overflow-y-auto custom-scrollbar pr-4">
                                                {pieData.slice(0, 8).map((entry, i) => (
                                                    <div 
                                                        key={i} 
                                                        className="group flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:border-blue-500/30 transition-all cursor-pointer shadow-sm" 
                                                        onClick={() => openDrilldown('category', entry.name, statsPrefix, `${entry.name} Details`)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.fill }}></div>
                                                            <span className="text-[11px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{entry.name}</span>
                                                        </div>
                                                        <span className="text-xs font-black text-gray-900 dark:text-white">{formatCurrency(entry.value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* CATEGORY BREAKDOWN SECTION */}
                            <div className="space-y-8">
                                <div className="flex justify-between items-center px-4">
                                    <div className="space-y-1">
                                        <h3 className="font-black text-gray-900 dark:text-white text-2xl tracking-tighter uppercase">Category Matrix</h3>
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Resource Allocation</p>
                                    </div>
                                    <button onClick={() => setViewMode('year')} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-800">Historical Trends</button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {categoryStats.map(([cat, amount]) => {
                                        const isExcluded = excludedCategories.includes(cat);
                                        const catColor = stringToColor(cat);
                                        return (
                                            <div 
                                                key={cat} 
                                                onClick={() => openDrilldown('category', cat, statsPrefix, `${cat} Details`)}
                                                className={`bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden group ${isExcluded ? 'opacity-40 grayscale' : ''}`}
                                            >
                                                <div className="flex justify-between items-start mb-8 relative z-10">
                                                    <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center transition-all duration-500 shadow-inner border border-transparent dark:border-white/5" style={{ color: catColor }}>
                                                        {getCategoryIcon(cat, 28, categoryIcons)}
                                                    </div>
                                                    <div className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border" style={{ color: catColor, borderColor: `${catColor}40`, backgroundColor: `${catColor}10` }}>
                                                        {( (amount / spent) * 100 ).toFixed(0)}%
                                                    </div>
                                                </div>
                                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-2 truncate relative z-10">{cat}</p>
                                                <p className="text-2xl font-black text-gray-900 dark:text-white leading-none relative z-10">{formatCurrency(amount)}</p>
                                                
                                                {/* Ambient Gradient Fill */}
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `linear-gradient(to bottom right, ${catColor}10, transparent)` }}></div>
                                                <div className="absolute bottom-0 left-0 h-1.5 transition-all duration-700 w-0 group-hover:w-full shadow-lg" style={{ backgroundColor: catColor, boxShadow: `0 0 15px ${catColor}80` }}></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* TAGS SECTION */}
                            {tagStats.length > 0 && (
                                <div className="space-y-8">
                                    <div className="px-4 space-y-1">
                                        <h3 className="font-black text-gray-900 dark:text-white text-2xl tracking-tighter uppercase">Metadata Vectors</h3>
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Cross-Category Tags</p>
                                    </div>
                                    <div className="flex flex-wrap gap-4 px-4">
                                        {tagStats.slice(0, 12).map(([tag, amount]) => (
                                            <button 
                                                key={tag} 
                                                onClick={() => openDrilldown('tag', tag, statsPrefix, `#${tag} History`)}
                                                className="bg-white dark:bg-white/[0.02] backdrop-blur-xl px-6 py-4 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:border-purple-200 dark:hover:border-purple-500/30 transition-all flex items-center gap-4 group"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all duration-500 shadow-inner">
                                                    <Hash size={16} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">#{tag}</p>
                                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{formatCurrency(amount)}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDEBAR: CALENDAR & ACTIVITY */}
                        <div className="col-span-12 3xl:col-span-6 4xl:col-span-5 space-y-10">
                            <div className="sticky top-8 space-y-10">
                                {/* MINI CALENDAR CARD */}
                                <div className="bg-white dark:bg-white/[0.03] backdrop-blur-3xl rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-white/5 group overflow-hidden transition-all duration-700 h-full">
                                    <div className="p-10 flex justify-between items-center border-b border-gray-50 dark:border-white/5 transition-colors bg-gray-50/50 dark:bg-white/[0.02]">
                                        <div className="space-y-1">
                                            <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-4 tracking-tighter uppercase text-xl">
                                                <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                                    <Calendar size={24} />
                                                </div>
                                                Temporal Hub
                                            </h3>
                                        </div>
                                        <button onClick={() => setActiveTab('history')} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline decoration-2 underline-offset-8 transition-all hover:scale-105">Access Matrix</button>
                                    </div>
                                    <div className="p-8 relative group/cal">
                                        <CalendarHistory 
                                            transactions={transactions.filter(t => !t.isIndiaCorridor && (selectedSource.includes('All Sources') || selectedSource.includes(t.source)))}
                                            selectedDate={selectedDate}
                                            setSelectedDate={setSelectedDate}
                                            calendarMonth={calendarMonth}
                                            setCalendarMonth={setCalendarMonth}
                                            calendarYear={calendarYear}
                                            setCalendarYear={setCalendarYear}
                                            onEditTx={setEditTx}
                                            onFilterClick={(type, val, prefix, title, persist) => openDrilldown(type, val, prefix || '', title || `${val} History`, persist)}
                                            categoryIcons={categoryIcons}
                                            formatCurrency={formatCurrency}
                                            excludedCategories={excludedCategories}
                                            isMini={true}
                                            selectedTxIds={selectedTxIds}
                                            onSelectTx={toggleSelectTx}
                                            onMonthYearChange={(m, y) => {
                                                setViewMonth(m);
                                                setSelectedYears([y]);
                                            }}
                                        />

                                        {/* CONSOLIDATED VIEW OVERLAY */}
                                        {viewMode === 'year' && (
                                            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center p-8 bg-white/90 dark:bg-[#0a0a0a]/95 backdrop-blur-3xl animate-in fade-in duration-700 rounded-b-[3rem] overflow-y-auto custom-scrollbar">
                                                <div className="text-center space-y-6 w-full max-w-md animate-in zoom-in slide-in-from-bottom-4 duration-1000">
                                                    <div className="space-y-2">
                                                        <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">Baseline <br/><span className="text-blue-600">Consolidated.</span></h3>
                                                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.4em] leading-relaxed">
                                                            {selectedYears.includes('All Years') ? 'Full Portfolio Archive' : `${selectedYears.join(' + ')} Aggregate Stream`}
                                                        </p>
                                                    </div>

                                                    {/* ANNUAL PIE MINI-VIEW */}
                                                    <div className="relative h-64 w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={pieData}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius="60%"
                                                                    outerRadius="90%"
                                                                    paddingAngle={4}
                                                                    dataKey="value"
                                                                    stroke="none"
                                                                >
                                                                    {pieData.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip 
                                                                    content={({ active, payload }) => {
                                                                        if (active && payload && payload.length) {
                                                                            return (
                                                                                <div className="bg-white dark:bg-[#111] p-3 rounded-xl shadow-2xl border border-gray-100 dark:border-white/10">
                                                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{payload[0].name}</p>
                                                                                    <p className="text-sm font-black dark:text-white">{formatCurrency(payload[0].value)}</p>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    }}
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Aggregate</p>
                                                            <p className="text-xl font-black dark:text-white">{formatCurrency(spent)}</p>
                                                        </div>
                                                    </div>

                                                    {/* TOP CATEGORIES LIST */}
                                                    <div className="space-y-2 text-left">
                                                        <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-3 text-center">Top Deployment Vectors</p>
                                                        {pieData.slice(0, 4).map((entry, i) => (
                                                            <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                                                                    <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest truncate max-w-[120px]">{entry.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/10 px-2 py-0.5 rounded-lg">
                                                                        {((entry.value / spent) * 100).toFixed(0)}%
                                                                    </span>
                                                                    <span className="text-xs font-black dark:text-white">{formatCurrency(entry.value)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="flex flex-col gap-3 pt-4">
                                                        <button 
                                                            onClick={() => setViewMode('month')}
                                                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-blue-600/20"
                                                        >
                                                            Restore Temporal Focus
                                                        </button>
                                                        <p className="text-[8px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">Protocol: Single-month context suspended</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* QUICK ACTIONS / RECENT ACTIVITY */}
                                <div className="bg-gray-900 dark:bg-white/[0.03] backdrop-blur-3xl rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group border border-transparent dark:border-white/5 transition-all duration-700">
                                    <div className="relative z-10">
                                        <h3 className="font-black text-2xl mb-2 tracking-tighter uppercase">Operations</h3>
                                        <p className="text-gray-400 dark:text-gray-500 text-xs mb-8 font-bold uppercase tracking-widest leading-relaxed">Direct Execution Protocol</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => setEditTx({isNew: true})} className="bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-blue-600 p-6 rounded-[2.5rem] transition-all border border-white/5 flex flex-col items-center gap-4 group/btn shadow-xl">
                                                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-2xl group-hover/btn:scale-110 group-hover/btn:rotate-6 transition-all duration-500"><Plus size={24} /></div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">New Entry</span>
                                            </button>
                                            <button type="button" onClick={triggerFileUpload} className="bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-emerald-600 p-6 rounded-[2.5rem] transition-all border border-white/5 flex flex-col items-center gap-4 group/btn shadow-xl">
                                                <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-2xl group-hover/btn:scale-110 group-hover/btn:-rotate-6 transition-all duration-500"><UploadCloud size={24} /></div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Import</span>
                                            </button>
                                        </div>
                                    </div>
                                    {/* DECORATIVE AMBIENT BLOB */}
                                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-600/20 dark:bg-blue-600/30 rounded-full blur-[100px] group-hover:scale-125 transition-transform duration-1000"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* COMBINED ACTIVITY TAB */}
                {activeTab === 'activity' && (
                    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in py-20 px-4">
                        <PageHeader 
                            icon={<PlusCircle size={32} />}
                            title={<>Activity <br/><span className="text-blue-600">Nexus.</span></>}
                            subtitle="Operational Entry Protocol"
                            badges={[{ label: "System Ready", color: "bg-emerald-500/10 border border-emerald-500/20", textColor: "text-emerald-600", pulse: true, pulseColor: "bg-emerald-500" }]}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* MANUAL ENTRY CARD */}
                            <div 
                                onClick={() => setEditTx({isNew: true})}
                                className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all group relative overflow-hidden"
                            >
                                <div className="relative z-10">
                                    <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl shadow-blue-600/20">
                                        <PlusCircle size={48} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Manual Entry</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 font-bold uppercase tracking-widest leading-relaxed px-4">Direct record injection for precise capital tracking.</p>
                                    <button className="mt-10 px-12 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-2xl shadow-blue-600/20 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">Initialize</button>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            </div>

                            {/* BULK IMPORT CARD */}
                            <div 
                                onClick={triggerFileUpload}
                                className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all group relative overflow-hidden"
                            >
                                <div className="relative z-10">
                                    <div className="w-24 h-24 bg-emerald-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-2xl shadow-emerald-600/20">
                                        <UploadCloud size={48} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Bulk Import</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 font-bold uppercase tracking-widest leading-relaxed px-4">Automated ingestion of financial data via PDF/Excel.</p>
                                    <button type="button" className="mt-10 px-12 py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-2xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs">Upload Stream</button>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            </div>
                        </div>

                        {loading && (
                            <div className="flex flex-col items-center gap-6 py-20 animate-pulse">
                                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-inner"></div>
                                <p className="text-blue-600 dark:text-blue-400 font-black tracking-[0.3em] uppercase text-[10px]">Processing Data Matrix...</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-12 animate-fade-in py-10 relative z-10">
                        <PageHeader 
                            icon={<History size={32} />}
                            title={<>Chronicle <br/><span className="text-blue-600">Archive.</span></>}
                            subtitle="Historical Data Stream"
                            badges={historyViewMode === 'calendar' ? [
                                { 
                                    label: `Active Stream: ${selectedSource.includes('All Sources') ? 'Consolidated Archive' : selectedSource.join(' + ')}`,
                                    color: 'bg-blue-600/10 border border-blue-600/20',
                                    textColor: 'text-blue-600',
                                    pulse: true
                                }
                            ] : []}
                            filters={
                                <>
                                    <div className="relative z-[60] flex bg-gray-100/50 dark:bg-white/5 lg:backdrop-blur-3xl p-0.5 md:p-2 rounded-xl md:rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] shrink-0 group hover:border-blue-500/30 transition-all">
                                        <div className="flex items-center">
                                            <div className="px-3 md:px-4 text-gray-400"><Hash size={16} /></div>
                                            <input 
                                                type="text" 
                                                placeholder={historySearch ? historySearch : "Search..."}
                                                value={historySearch}
                                                onChange={(e) => setHistorySearch(e.target.value)}
                                                className="w-20 md:w-48 bg-transparent text-[10px] font-black uppercase tracking-widest outline-none dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="relative z-[50] flex bg-gray-100/50 dark:bg-white/5 lg:backdrop-blur-3xl p-0.5 md:p-1.5 rounded-xl md:rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm transition-all group hover:border-blue-500/30 shrink-0">
                                        <div className="hidden md:flex items-center gap-2 px-4 border-r border-gray-200 dark:border-white/10 mr-2">
                                            <CreditCard size={14} className="text-blue-600 dark:text-blue-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Source</span>
                                        </div>
                                        <MultiSelectDropdown 
                                            options={['All Sources', ...allSources]} 
                                            selected={selectedSource} 
                                            onChange={setSelectedSource} 
                                            label="" 
                                        />
                                    </div>
    
                                    <div className="flex bg-gray-100 dark:bg-white/5 p-0.5 md:p-1.5 rounded-xl md:rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm transition-all shrink-0">
                                        <button 
                                            onClick={() => setHistoryViewMode('list')}
                                            className={`px-3 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${historyViewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                                        >
                                            List
                                        </button>
                                        <button 
                                            onClick={() => setHistoryViewMode('calendar')}
                                            className={`px-3 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${historyViewMode === 'calendar' ? 'bg-white dark:bg-gray-600 shadow-md text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                                        >
                                            Cal
                                        </button>
                                    </div>
                                </>
                            }
                        />

                        {historyViewMode === 'calendar' ? (
                            <div className="relative group/cal">
                                <CalendarHistory 
                                    transactions={transactions.filter(t => !t.isIndiaCorridor && (selectedSource.includes('All Sources') || selectedSource.includes(t.source)))}
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
                                    selectedTxIds={selectedTxIds}
                                    onSelectTx={toggleSelectTx}
                                />
                                {selectedYears.length > 1 && (
                                    <div className="absolute inset-0 z-[60] flex items-center justify-center p-10 bg-white/60 dark:bg-[#0a0a0a]/80 backdrop-blur-3xl animate-in fade-in duration-700 rounded-[3rem]">
                                        <div className="text-center space-y-8 max-w-sm animate-in zoom-in slide-in-from-bottom-4 duration-1000">
                                            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-[0_20px_50px_rgba(37,99,235,0.4)] animate-pulse">
                                                <Layers size={40} />
                                            </div>
                                            <div className="space-y-3">
                                                <h3 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">Multi-Year <br/>Consolidation</h3>
                                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.4em] leading-relaxed">
                                                    Aggregating Data from: <span className="text-blue-600 dark:text-blue-400">{selectedYears.join(' + ')}</span>
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <button 
                                                    onClick={() => setSelectedYears([selectedYears[0]])}
                                                    className="w-full py-5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
                                                >
                                                    Switch to Single Year Mode
                                                </button>
                                                <p className="text-[8px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">Protocol: Sequential monthly viewing disabled during consolidation</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8 pb-20">
                                {Object.keys(nestedHistory).length === 0 && (
                                    <div className="text-center py-32 bg-white dark:bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
                                        <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                            <History size={32} className="text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <p className="text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.3em] text-sm">Matrix Error: No matching records found.</p>
                                        {historySearch && <button onClick={() => setHistorySearch('')} className="mt-6 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest border-b-2 border-blue-600 dark:border-blue-400 pb-1">Reset Filters</button>}
                                    </div>
                                )}
                                {Object.entries(nestedHistory).sort((a,b) => b[0] - a[0]).map(([year, yearData]) => {
                                    const yearNet = yearData.totalIncome - yearData.totalExpense;
                                    return (
                                    <div key={year} className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden transition-all hover:shadow-2xl">
                                        <div className="p-10 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.04] transition-all border-b border-gray-50 dark:border-white/5" onClick={() => setExpandedYears(prev => ({...prev, [year]: !prev[year]}))}>
                                            <div className="flex items-center gap-6">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${expandedYears[year] ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30 rotate-90' : 'bg-gray-50 dark:bg-white/5 text-blue-600 dark:text-blue-400 shadow-inner'}`}>
                                                    <ChevronRight size={28} />
                                                </div>
                                                <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">{year}</h2>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="hidden md:flex gap-4">
                                                    <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                                                        <span className="opacity-50 mr-2">REV</span> {formatCurrency(yearData.totalIncome)}
                                                    </div>
                                                    <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-500/20 shadow-sm">
                                                        <span className="opacity-50 mr-2">OUT</span> {formatCurrency(yearData.totalExpense)}
                                                    </div>
                                                </div>
                                                <div className={`${yearNet >= 0 ? 'bg-blue-600 shadow-blue-600/20' : 'bg-rose-600 shadow-rose-600/20'} text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all hover:scale-105`}>
                                                    NET {yearNet >= 0 ? '+' : ''}{formatCurrency(yearNet)}
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'range', startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: `Entire Year ${year}` }) }}
                                                    className="p-3 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-gray-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 rounded-2xl transition-all"
                                                >
                                                    <Trash2 size={20}/>
                                                </button>
                                            </div>
                                        </div>
                                        {expandedYears[year] && (
                                            <div className="p-10 pt-4 space-y-6 animate-slide-down">
                                                {Object.entries(yearData.months).sort((a,b) => {
                                                    return MONTH_ORDER.indexOf(b[0]) - MONTH_ORDER.indexOf(a[0]);
                                                }).map(([month, data]) => {
                                                    const monthKey = `${year}-${month}`;
                                                    const monthNet = data.income - data.expense;
                                                    return (
                                                        <div key={monthKey} className="group">
                                                            <div className="flex justify-between items-center px-6 py-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] rounded-[2.5rem] transition-all border border-transparent hover:border-gray-100 dark:hover:border-white/10" onClick={() => setExpandedMonths(prev => ({...prev, [monthKey]: !prev[monthKey]}))}>
                                                                <div className="flex items-center gap-6">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${expandedMonths[monthKey] ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rotate-180 shadow-xl' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 shadow-inner'}`}>
                                                                        <ChevronDown size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{month}</h3>
                                                                        <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">{data.txs.length} Transactions Found</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-6">
                                                                    <div className="hidden sm:flex gap-4 text-[10px] font-black uppercase tracking-widest">
                                                                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/5 px-3 py-1 rounded-lg">+{formatCurrency(data.income)}</span>
                                                                        <span className="text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/5 px-3 py-1 rounded-lg">-{formatCurrency(data.expense)}</span>
                                                                    </div>
                                                                    <div className={`${monthNet >= 0 ? 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' : 'text-rose-600 bg-rose-50 dark:bg-rose-500/10'} px-4 py-2 rounded-xl text-xs font-black border border-transparent shadow-sm`}>
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
                                                                        className="p-2.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-gray-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash2 size={16}/>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {expandedMonths[monthKey] && (
                                                                <div className="mt-4 ml-6 pl-8 border-l-4 border-blue-600/10 dark:border-white/5 space-y-3 animate-slide-down">
                                                                    <div className="bg-white dark:bg-white/[0.01] rounded-[3rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-inner">
                                                                        {data.txs.map(tx => (
                                                                            <TransactionRow 
                                                                                key={tx.firestoreId} 
                                                                                tx={tx} 
                                                                                onClick={() => setEditTx(tx)} 
                                                                                onFilterClick={(type, val) => openDrilldown(type, val, '', `${val} History`)}
                                                                                isGlobalExcluded={excludedCategories.includes(tx.category)}
                                                                                categoryIcons={categoryIcons}
                                                                                isSelected={selectedTxIds.includes(tx.firestoreId)}
                                                                                onSelect={() => toggleSelectTx(tx.firestoreId)}
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

                {/* INDIA HUB TAB */}
                {activeTab === 'india' && (() => {
                    const baseIndiaTxs = transactions.filter(t => t.isIndiaCorridor);
                    
                    let filteredByRecipient = [...baseIndiaTxs];
                    if (indiaViewRecipient !== 'All Recipients') {
                        filteredByRecipient = filteredByRecipient.filter(t => t.recipient === indiaViewRecipient);
                    }

                    const recipientsList = Array.from(new Set(baseIndiaTxs.map(t => t.recipient).filter(Boolean))).sort();
                    
                    const isYearlyGranularity = indiaGraphGranularity === 'yearly';
                    const statsPrefix = indiaViewMode === 'month' ? `${indiaSelectedYears[0]}-${String(indiaViewMonth + 1).padStart(2, '0')}` : null;
                    
                    const activeTxs = filteredByRecipient.filter(t => {
                        const hasAllYears = indiaSelectedYears.includes('All Years');
                        const yearMatch = hasAllYears || indiaSelectedYears.some(y => t.date.startsWith(y.toString()));
                        const monthMatch = indiaViewMode === 'month' ? t.date.startsWith(statsPrefix) : true;
                        return yearMatch && monthMatch;
                    }).sort((a,b) => new Date(b.date) - new Date(a.date));

                    const totalUSD = activeTxs.reduce((sum, t) => sum + Number(t.amount), 0);
                    const totalINR = activeTxs.reduce((sum, t) => sum + Number(t.secondaryAmount || 0), 0);
                    const avgRate = totalUSD > 0 ? (totalINR / totalUSD) : 0;

                    // Timeline Graph Data
                    const indiaGraphData = [];
                    const now = new Date();
                    
                    if (isYearlyGranularity || (indiaViewMode === 'year' && (indiaSelectedYears.length > 1 || indiaSelectedYears.includes('All Years')))) {
                        let yearsToCompare = [...indiaSelectedYears];
                        if (yearsToCompare.includes('All Years')) {
                            const allYearsInTxs = Array.from(new Set(baseIndiaTxs.map(t => t.date.substring(0, 4))));
                            yearsToCompare = allYearsInTxs.length > 0 ? allYearsInTxs.sort() : [now.getFullYear().toString()];
                        } else {
                            yearsToCompare.sort((a,b) => a - b);
                        }

                        yearsToCompare.forEach(y => {
                            const prefix = `${y}`;
                            const txs = filteredByRecipient.filter(t => t.date.startsWith(prefix) && !t.isExcluded);
                            indiaGraphData.push({
                                name: y.toString(),
                                fullDate: prefix, 
                                type: 'yearly', 
                                usd: txs.reduce((s, t) => s + Number(t.amount), 0),
                                inr: txs.reduce((s, t) => s + Number(t.secondaryAmount || 0), 0)
                            });
                        });
                    } else {
                        // Monthly bars for the focused year (even in month-filter mode)
                        const yFocus = (typeof indiaSelectedYears[0] === 'number') ? indiaSelectedYears[0] : now.getFullYear();
                        for (let i = 0; i < 12; i++) {
                            const d = new Date(yFocus, i, 1);
                            const prefix = `${yFocus}-${String(i + 1).padStart(2, '0')}`;
                            const label = d.toLocaleString('default', { month: 'short' });

                            const txs = filteredByRecipient.filter(t => t.date.startsWith(prefix) && !t.isExcluded);
                            indiaGraphData.push({
                                name: label,
                                fullDate: prefix,
                                type: 'monthly',
                                usd: txs.reduce((s, t) => s + Number(t.amount), 0),
                                inr: txs.reduce((s, t) => s + Number(t.secondaryAmount || 0), 0)
                            });
                        }
                    }

                    // Cumulative Data
                    let cumUsdVal = 0;
                    let cumInrVal = 0;
                    const allYearsPresent = Array.from(new Set(baseIndiaTxs.map(t => parseInt(t.date.substring(0, 4))))).sort((a,b) => a-b);
                    const startY = allYearsPresent.length > 0 ? allYearsPresent[0] : now.getFullYear();
                    const endY = now.getFullYear();
                    
                    const cumGraphData = [];
                    for(let y = startY; y <= endY; y++) {
                        const yrTxs = filteredByRecipient.filter(t => t.date.startsWith(`${y}`) && !t.isExcluded);
                        const yearUsd = yrTxs.reduce((s, t) => s + Number(t.amount), 0);
                        const yearInr = yrTxs.reduce((s, t) => s + Number(t.secondaryAmount || 0), 0);
                        cumUsdVal += yearUsd;
                        cumInrVal += yearInr;
                        cumGraphData.push({ year: y.toString(), totalUsd: cumUsdVal, totalInr: cumInrVal });
                    }

                    const handleExportIndiaHub = () => {
                        const wb = XLSX.utils.book_new();
                        const rows = [];
                        
                        // --- DESIGN SYSTEM: PREMIUM EXECUTIVE PALETTE ---
                        const COLORS = {
                            NAVY: "0F172A",
                            BLUE: "2563EB",
                            EMERALD: "059669",
                            AMBER: "D97706",
                            SLATE_600: "475569",
                            SLATE_100: "F1F5F9",
                            WHITE: "FFFFFF"
                        };

                        const STYLES = {
                            MAIN_TITLE: { font: { bold: true, sz: 22, color: { rgb: COLORS.WHITE } }, fill: { fgColor: { rgb: COLORS.NAVY } }, alignment: { horizontal: "center", vertical: "center" } },
                            SUB_TITLE: { font: { sz: 9, italic: true, color: { rgb: "94A3B8" } }, fill: { fgColor: { rgb: COLORS.NAVY } }, alignment: { horizontal: "center" } },
                            
                            // KPI POWER BLOCKS (2-Column Merged)
                            KPI_L_USD: { font: { bold: true, sz: 10, color: { rgb: COLORS.WHITE } }, fill: { fgColor: { rgb: COLORS.BLUE } }, alignment: { horizontal: "center" } },
                            KPI_V_USD: { font: { bold: true, sz: 22, color: { rgb: COLORS.BLUE } }, fill: { fgColor: { rgb: COLORS.WHITE } }, alignment: { horizontal: "center" }, border: { bottom: { style: "thick", color: { rgb: COLORS.BLUE } } } },
                            
                            KPI_L_INR: { font: { bold: true, sz: 10, color: { rgb: COLORS.WHITE } }, fill: { fgColor: { rgb: COLORS.EMERALD } }, alignment: { horizontal: "center" } },
                            KPI_V_INR: { font: { bold: true, sz: 22, color: { rgb: COLORS.EMERALD } }, fill: { fgColor: { rgb: COLORS.WHITE } }, alignment: { horizontal: "center" }, border: { bottom: { style: "thick", color: { rgb: COLORS.EMERALD } } } },
                            
                            KPI_L_RATE: { font: { bold: true, sz: 10, color: { rgb: COLORS.WHITE } }, fill: { fgColor: { rgb: COLORS.AMBER } }, alignment: { horizontal: "center" } },
                            KPI_V_RATE: { font: { bold: true, sz: 22, color: { rgb: COLORS.AMBER } }, fill: { fgColor: { rgb: COLORS.WHITE } }, alignment: { horizontal: "center" }, border: { bottom: { style: "thick", color: { rgb: COLORS.AMBER } } } },

                            SECTION_HEADER: { font: { bold: true, sz: 11, color: { rgb: COLORS.WHITE } }, fill: { fgColor: { rgb: COLORS.SLATE_600 } }, alignment: { vertical: "center" } },
                            TABLE_HEADER: { font: { bold: true, color: { rgb: COLORS.WHITE } }, fill: { fgColor: { rgb: COLORS.NAVY } }, border: { bottom: { style: "medium", color: { rgb: COLORS.BLUE } } } },
                            
                            YEAR_BAR: { font: { bold: true, sz: 12, color: { rgb: COLORS.BLUE } }, fill: { fgColor: { rgb: COLORS.SLATE_100 } }, border: { bottom: { style: "thin", color: { rgb: COLORS.BLUE } } } },
                            ROW_TOTAL: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: "E2E8F0" } } },
                            ZEBRA: { fill: { fgColor: { rgb: "F8FAFC" } } }
                        };

                        const INDIAN_NUM_FMT = "[$₹-409] #,##,##0"; // Standard LCID for Hindi (India) to force Lakhs/Crores grouping
                        const addCell = (val, style = {}, type = 's') => ({ v: val, s: style, t: type });

                        // 1. BRANDED HEADER
                        rows.push([addCell("INDIA STRATEGIC CORRIDOR: PERFORMANCE AUDIT", STYLES.MAIN_TITLE), "", "", "", "", ""]);
                        rows.push([addCell(`EXECUTIVE SUMMARY | GENERATED: ${new Date().toLocaleString().toUpperCase()}`, STYLES.SUB_TITLE), "", "", "", "", ""]);
                        rows.push([]);

                        // 2. THE KPI DASHBOARD (3 Massive Blocks)
                        rows.push([
                            addCell("TOTAL DEPLOYED (USD)", STYLES.KPI_L_USD), "", 
                            addCell("TOTAL RECEIVED (INR)", STYLES.KPI_L_INR), "",
                            addCell("AVG RATE & VOLUME", STYLES.KPI_L_RATE), ""
                        ]);
                        rows.push([
                            addCell(totalUSD, { ...STYLES.KPI_V_USD, numFmt: "$#,##0" }, 'n'), "", 
                            addCell(totalINR, { ...STYLES.KPI_V_INR, numFmt: INDIAN_NUM_FMT }, 'n'), "",
                            addCell(`${avgRate.toFixed(2)} [${activeTxs.length} TXs]`, STYLES.KPI_V_RATE), ""
                        ]);
                        rows.push([]);

                        // 3. PARAMETERS & LEDGER
                        rows.push([addCell("DETAILED TRANSACTION LEDGER", STYLES.SECTION_HEADER), "", "", "", "", ""]);
                        const ledgerHeaderIdx = rows.length;
                        rows.push([
                            addCell("DATE", STYLES.TABLE_HEADER),
                            addCell("RECIPIENT", STYLES.TABLE_HEADER),
                            addCell("USD SENT ($)", STYLES.TABLE_HEADER),
                            addCell("INR RECV (₹)", STYLES.TABLE_HEADER),
                            addCell("EX. RATE (₹/$)", STYLES.TABLE_HEADER),
                            addCell("CONTEXT / AUDIT NOTES", STYLES.TABLE_HEADER)
                        ]);

                        // 4. GROUPED DATA (Collapsed Logic)
                        const years = [...new Set(activeTxs.map(t => t.date.substring(0, 4)))].sort((a, b) => b - a);
                        const rowMetaData = []; // To track levels and hidden states

                        // Initial rows are all visible and level 0
                        for(let i=0; i < rows.length; i++) rowMetaData.push({ level: 0, hidden: false });

                        years.forEach(yr => {
                            const yrTxs = activeTxs.filter(t => t.date.startsWith(yr));
                            const yrUsd = yrTxs.reduce((s, t) => s + Number(t.amount), 0);
                            const yrInr = yrTxs.reduce((s, t) => s + Number(t.secondaryAmount || 0), 0);
                            const yrRate = yrUsd > 0 ? (yrInr / yrUsd) : 0;
                            
                            // Year Bar (Visible at Level 0 - Contains Aggregate Data)
                            rows.push([
                                addCell(`FY ${yr} ARCHIVE`, STYLES.YEAR_BAR),
                                addCell(`${yrTxs.length} Strategic Entries`, STYLES.YEAR_BAR),
                                addCell(yrUsd, { ...STYLES.YEAR_BAR, numFmt: "$#,##0", alignment: { horizontal: "right" } }, 'n'),
                                addCell(yrInr, { ...STYLES.YEAR_BAR, numFmt: INDIAN_NUM_FMT, alignment: { horizontal: "right" } }, 'n'),
                                addCell(Number(yrRate.toFixed(2)), { ...STYLES.YEAR_BAR, numFmt: "0.00", alignment: { horizontal: "right" } }, 'n'),
                                addCell("AUDITED CONSOLIDATION", STYLES.YEAR_BAR)
                            ]);
                            rowMetaData.push({ level: 0, hidden: false });
                            
                            yrTxs.forEach((t, idx) => {
                                const isZebra = idx % 2 === 0;
                                const rowStyle = isZebra ? STYLES.ZEBRA : {};
                                
                                rows.push([
                                    addCell(t.date, rowStyle),
                                    addCell(t.recipient || 'N/A', rowStyle),
                                    addCell(Number(t.amount), { ...rowStyle, numFmt: "$#,##0" }, 'n'),
                                    addCell(Number(t.secondaryAmount), { ...rowStyle, numFmt: INDIAN_NUM_FMT }, 'n'),
                                    addCell(Number(t.rate || (t.amount > 0 ? (Number(t.secondaryAmount) / Number(t.amount)).toFixed(2) : 0)), { ...rowStyle, numFmt: "0.00" }, 'n'),
                                    addCell(t.notes || '---', { ...rowStyle, alignment: { wrapText: true } })
                                ]);
                                // Transaction rows are level 1 and hidden by default
                                rowMetaData.push({ level: 1, hidden: true });
                            });
                            
                            rows.push([]); // Spacer
                            rowMetaData.push({ level: 0, hidden: false });
                        });

                        const ws = XLSX.utils.aoa_to_sheet(rows);
                        
                        // --- SIZING & GROUPING ---
                        ws['!cols'] = [{wch: 12}, {wch: 22}, {wch: 16}, {wch: 18}, {wch: 12}, {wch: 45}];
                        ws['!rows'] = rowMetaData.map((meta, i) => {
                            let height = 20;
                            if (i === 0) height = 50;
                            if (i === 4) height = 40;
                            return { hpt: height, level: meta.level, hidden: meta.hidden };
                        });

                        // --- INTERACTIVE FEATURES & MERGES ---
                        ws['!autofilter'] = { ref: `A${ledgerHeaderIdx + 1}:F${rows.length}` };
                        
                        ws['!merges'] = [
                            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Title
                            { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Subtitle
                            { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } }, // KPI 1 Label
                            { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, // KPI 1 Value
                            { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } }, // KPI 2 Label
                            { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } }, // KPI 2 Value
                            { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } }, // KPI 3 Label
                            { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, // KPI 3 Value
                            { s: { r: 6, c: 0 }, e: { r: 6, c: 5 } }  // Header
                        ];

                        // Merge Year Bars
                        rows.forEach((row, idx) => {
                            if (row[0] && row[0].v && String(row[0].v).startsWith('FISCAL YEAR')) {
                                ws['!merges'].push({ s: { r: idx, c: 0 }, e: { r: idx, c: 5 } });
                            }
                        });

                        XLSX.utils.book_append_sheet(wb, ws, "India Strategic Report");
                        XLSX.writeFile(wb, `India_Strategic_Ledger_${new Date().getFullYear()}.xlsx`);
                    };

                    const handleIndiaBarClick = (data) => {
                        if (data && data.fullDate) {
                            if (data.type === 'yearly') {
                                setIndiaSelectedYears([parseInt(data.name)]);
                                setIndiaGraphGranularity('monthly');
                                setIndiaViewMode('year'); 
                            } else {
                                const [y, m] = data.fullDate.split('-');
                                setIndiaSelectedYears([parseInt(y)]);
                                if (m) {
                                    setIndiaViewMonth(parseInt(m) - 1);
                                    setIndiaViewMode('month');
                                    setIndiaGraphGranularity('monthly');
                                }
                            }
                        }
                    };

                    return (
                        <div className="grid grid-cols-12 gap-10 animate-fade-in pb-20 relative z-10">
                            {/* HEADER */}
                            <PageHeader 
                                icon={<Globe size={32} />}
                                title={<>India <br /><span className="text-blue-600 dark:text-blue-500">Corridor.</span></>}
                                subtitle="Cross-Border Capital Deployment"
                                badges={[
                                    { 
                                        label: `Active Matrix: ${indiaViewMode === 'month' ? `${MONTH_ORDER[indiaViewMonth]} ${indiaSelectedYears[0]}` : (indiaSelectedYears.includes('All Years') ? 'Portfolio Baseline' : indiaSelectedYears.join(' + '))}`,
                                        color: 'bg-blue-600/10 border border-blue-600/20',
                                        textColor: 'text-blue-600',
                                        pulse: true
                                    },
                                    { label: `Recipient: ${indiaViewRecipient}` }
                                ]}
                                actions={[
                                    { icon: <Plus size={16}/>, label: 'Manual Entry', onClick: () => setEditTx({isNew: true, category: 'India Transfer', description: 'USD to INR Transfer', type: 'expense', date: new Date().toISOString().split('T')[0], isIndiaCorridor: true, recipient: '', mode: 'money'}) },
                                    { icon: <UploadCloud size={16}/>, label: 'Bulk Import', onClick: () => { setImportToIndiaHub(true); triggerFileUpload(); }, className: 'bg-blue-600 text-white shadow-blue-600/20' },
                                    { icon: <FileInput size={16}/>, label: 'Export Matrix', onClick: handleExportIndiaHub, className: 'bg-emerald-600 text-white shadow-emerald-600/20' },
                                    { icon: <History size={16}/>, label: 'Audit Log', onClick: () => setShowIndiaAuditModal(true), className: 'bg-purple-600 text-white shadow-purple-600/20' }
                                ]}
                                filters={
                                    <div className="flex flex-row flex-wrap items-center gap-2 w-full md:w-auto overflow-visible pb-2 md:pb-0">
                                        {indiaViewMode === 'month' || !indiaSelectedYears.includes('All Years') ? (
                                            <button 
                                                onClick={() => {
                                                    setIndiaViewMode('year');
                                                    setIndiaSelectedYears(['All Years']);
                                                    setIndiaViewRecipient('All Recipients');
                                                }}
                                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all group flex items-center gap-2 shrink-0"
                                            >
                                                <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform"/> Reset
                                            </button>
                                        ) : null}

                                        <div className="relative z-[60] flex bg-gray-100/50 dark:bg-white/5 lg:backdrop-blur-3xl p-0.5 md:p-2 rounded-xl md:rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:border-blue-500/30 transition-all duration-500 shrink-0">
                                            <div className="hidden md:flex items-center gap-2 px-4 border-r border-gray-200 dark:border-white/10 mr-2">
                                                <Globe size={16} className="text-blue-600 dark:text-blue-400" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recipient</span>
                                            </div>
                                            <CustomDropdown value={indiaViewRecipient} onChange={setIndiaViewRecipient} options={[{value: 'All Recipients', label: 'All Recipients'}, ...recipientsList.map(r => ({value: r, label: r}))]} />
                                        </div>

                                        <div className="relative z-[50] flex bg-gray-100/50 dark:bg-white/5 lg:backdrop-blur-3xl p-0.5 md:p-2 rounded-xl md:rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:border-blue-500/30 transition-all duration-500 shrink-0">
                                            {indiaViewMode === 'month' ? (
                                                <>
                                                    <button onClick={() => setIndiaViewMode('year')} className="px-3 md:px-8 py-2 md:py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all hover:bg-white/5">MM</button>
                                                    <div className="w-px bg-gray-200 dark:bg-white/10 my-2 mx-1 md:mx-2"></div>
                                                    <CustomDropdown value={indiaViewMonth} onChange={(m) => { setIndiaViewMonth(m); }} options={Array.from({length: 12}, (_, i) => ({ value: i, label: MONTH_ORDER[i].substring(0, 3) }))} />
                                                </>
                                            ) : (
                                                <button onClick={() => setIndiaViewMode('month')} className="px-4 md:px-10 py-2 md:py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0">Annual</button>
                                            )}
                                            <div className="w-px bg-gray-200 dark:bg-white/10 my-2 mx-1 md:mx-2"></div>
                                            {indiaViewMode === 'month' ? (
                                                <CustomDropdown 
                                                    value={typeof indiaSelectedYears[0] === 'number' ? indiaSelectedYears[0] : today.getFullYear()} 
                                                    onChange={(y) => { setIndiaSelectedYears([y]); }} 
                                                    options={Array.from({length: 10}, (_, i) => ({ value: today.getFullYear() - 5 + i, label: (today.getFullYear() - 5 + i).toString() }))} 
                                                />
                                            ) : (
                                                <MultiSelectDropdown options={['All Years', ...Array.from({length: 10}, (_, i) => today.getFullYear() - 5 + i)]} selected={indiaSelectedYears} onChange={(years) => { setIndiaSelectedYears(years); }} />
                                            )}
                                        </div>
                                    </div>
                                }
                            />

                            {/* CONTENT */}
                            <div className="col-span-12 2xl:col-span-12 3xl:col-span-6 4xl:col-span-7 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
                                    <div className="bg-indigo-600 dark:bg-indigo-600 p-6 md:p-10 rounded-[2.5xl] md:rounded-[3rem] shadow-lg md:shadow-[0_20px_50px_rgba(79,70,229,0.3)] relative overflow-hidden group border border-indigo-500/20 transition-all hover:scale-[1.02] flex flex-col justify-center min-w-0">
                                        <div className="relative z-10">
                                            <p className="text-[9px] md:text-[10px] font-black text-indigo-100 uppercase tracking-[0.3em] md:tracking-[0.4em] mb-2 md:mb-4">Capital Deployed (USD)</p>
                                            <p className="text-3xl md:text-5xl font-black text-white tracking-tighter break-all leading-none">${totalUSD.toLocaleString()}</p>
                                        </div>
                                        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                                        <div className="absolute top-0 right-0 p-8 opacity-20 hidden md:block"><TrendingUp size={48} className="text-white" /></div>
                                    </div>

                                    <div className="bg-emerald-600 dark:bg-emerald-600 p-6 md:p-10 rounded-[2.5xl] md:rounded-[3rem] shadow-lg md:shadow-[0_20px_50px_rgba(16,185,129,0.3)] relative overflow-hidden group border border-emerald-500/20 transition-all hover:scale-[1.02] flex flex-col justify-center min-w-0">
                                        <div className="relative z-10">
                                            <p className="text-[9px] md:text-[10px] font-black text-emerald-100 uppercase tracking-[0.3em] md:tracking-[0.4em] mb-2 md:mb-4">Received Value (INR)</p>
                                            <p className="text-3xl md:text-5xl font-black text-white tracking-tighter break-all leading-none">{formatINR(totalINR)}</p>
                                            <div className="mt-2 md:mt-4 text-emerald-100/60 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] break-all">₹{totalINR.toLocaleString('en-IN')}</div>
                                        </div>
                                        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                                        <div className="absolute top-0 right-0 p-8 opacity-20 hidden md:block"><CreditCard size={48} className="text-white" /></div>
                                    </div>

                                    <div className="bg-slate-900 dark:bg-white/5 backdrop-blur-3xl p-6 md:p-10 rounded-[2.5xl] md:rounded-[3rem] shadow-lg md:shadow-2xl relative overflow-hidden group border border-slate-800 dark:border-white/10 transition-all hover:scale-[1.02] flex flex-col justify-center min-w-0">
                                        <div className="relative z-10 flex flex-col justify-center h-full">
                                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.3em] md:tracking-[0.4em] mb-2 md:mb-4">Avg Efficiency</p>
                                            <p className="text-3xl md:text-5xl font-black text-white tracking-tighter break-all leading-none">₹{avgRate.toFixed(2)}</p>
                                            <div className="mt-2 md:mt-4 text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest break-words">{activeTxs.length} Strategic Transfers</div>
                                        </div>
                                        <div className="absolute top-0 right-0 p-8 opacity-10 hidden md:block"><Zap size={48} className="text-white" /></div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 transition-all">
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="flex bg-gray-100/50 dark:bg-white/5 p-1.5 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-inner transition-all">
                                                {indiaViewMode !== 'year' && ['6M', 'YTD', '1Y'].map(r => (
                                                    <button key={r} onClick={() => setIndiaGraphRange(r)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${indiaGraphRange === r ? 'bg-white dark:bg-gray-600 shadow-[0_8px_30px_rgb(0,0,0,0.1)] text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{r}</button>
                                                ))}
                                            </div>
                                            <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Transfer Timeline</div>
                                        </div>
                                    </div>
                                    <div className="h-96 w-full relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={indiaGraphData}>
                                                <defs>
                                                    <linearGradient id="colorIndiaInr" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "rgba(255,255,255,0.03)" : "#f1f5f9"} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dy={15} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} tickFormatter={(val) => formatINR(val).replace('₹', '')} />
                                                <Tooltip cursor={{ fill: darkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc', radius: 16 }} content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 min-w-[240px] z-[9999]">
                                                                <p className="font-black text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-widest border-b dark:border-white/5 pb-3">{label} Transfers</p>
                                                                <div className="space-y-3">
                                                                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">INR Recv.</span><span className="text-xl font-black dark:text-white">{formatINR(d.inr)}</span></div>
                                                                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">USD Sent</span><span className="text-lg font-black dark:text-gray-300">${d.usd.toLocaleString()}</span></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }} />
                                                <Bar dataKey="inr" fill="url(#colorIndiaInr)" radius={[12, 12, 12, 12]} barSize={32} onClick={handleIndiaBarClick} cursor="pointer">
                                                    {indiaGraphData.map((entry, index) => (<Cell key={`cell-${index}`} fill="url(#colorIndiaInr)" opacity={entry.fullDate === statsPrefix ? 1 : 0.6} stroke={entry.fullDate === statsPrefix ? "#10b981" : "none"} strokeWidth={entry.fullDate === statsPrefix ? 2 : 0} />))}
                                                </Bar>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                
                                <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 transition-all">
                                    <div className="flex justify-between items-center mb-12">
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">Cumulative Capital</h3>
                                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">All-Time Growth</div>
                                    </div>
                                    <div className="h-80 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={cumGraphData}>
                                                <defs>
                                                    <linearGradient id="colorIndiaCumInr" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "rgba(255,255,255,0.03)" : "#f1f5f9"} />
                                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dy={15} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} tickFormatter={(val) => formatINR(val).replace('₹', '')} />
                                                <Tooltip content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-white/10 min-w-[200px] z-[9999]">
                                                                <p className="font-black text-gray-900 dark:text-white mb-6 text-[10px] uppercase tracking-widest border-b dark:border-white/5 pb-2">End of {label}</p>
                                                                <div className="space-y-3 pt-2">
                                                                    <div className="flex justify-between items-center"><span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Total INR</span><span className="font-black text-xl text-emerald-500 dark:text-emerald-400 ml-4">{formatINR(d.totalInr)}</span></div>
                                                                    <div className="flex justify-between items-center"><span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Total USD</span><span className="font-black text-lg text-blue-500 dark:text-blue-400 ml-4">${d.totalUsd.toLocaleString()}</span></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }} />
                                                <Area type="monotone" dataKey="totalInr" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorIndiaCumInr)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-12 2xl:col-span-12 3xl:col-span-6 4xl:col-span-5 space-y-10">
                                <div className="sticky top-8 space-y-6">
                                    <div className="flex justify-between items-center px-4">
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">Transfer Ledger</h3>
                                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{activeTxs.length} Records</span>
                                    </div>
                                    <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden max-h-[85vh] overflow-y-auto custom-scrollbar">
                                        {activeTxs.map(tx => (
                                            <TransactionRow key={tx.firestoreId} tx={tx} onClick={() => setEditTx(tx)} onFilterClick={() => {}} isGlobalExcluded={false} categoryIcons={categoryIcons} isSelected={selectedTxIds.includes(tx.firestoreId)} onSelect={() => toggleSelectTx(tx.firestoreId)} />
                                        ))}
                                        {activeTxs.length === 0 && (
                                            <div className="p-20 text-center">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No records found for selection.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* AUDIT LOG MODAL */}
                            {showIndiaAuditModal && (
                                <Popup title="Corridor Audit Log" onClose={() => setShowIndiaAuditModal(false)} zIndex={2000} size="xl" fullHeight>
                                    <div className="flex-1 flex flex-col bg-white dark:bg-transparent overflow-hidden">
                                        <div className="p-8 border-b dark:border-white/5 flex justify-between items-center shrink-0">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Corridor Activity</h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">India Hub History Management</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-3">
                                            {activityLogs.filter(log => log.isIndiaCorridor).length === 0 && (
                                                <div className="text-center py-20 text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">No corridor activity recorded.</div>
                                            )}
                                            {activityLogs.filter(log => log.isIndiaCorridor).map(log => {
                                                const date = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now';
                                                const isExpanded = expandedLogs[log.id];
                                                const actionColors = {
                                                    'ADD': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                                                    'EDIT': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                                                    'DELETE': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                                                    'IMPORT': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                                                    'BULK_DELETE': 'bg-rose-500/20 text-rose-600 border-rose-500/30',
                                                    'BULK_EDIT': 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                                                };
                                                return (
                                                    <div key={log.id} className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden transition-all shadow-sm">
                                                        <div onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id]: !isExpanded }))} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors gap-4">
                                                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black border uppercase tracking-widest shrink-0 ${actionColors[log.action] || actionColors['EDIT']}`}>{log.action.replace('_', ' ')}</span>
                                                                <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight truncate">{log.description}</span>
                                                                {log.changes?.count && (
                                                                    <span className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-500/10 text-gray-500 text-[8px] font-black uppercase tracking-widest border border-gray-500/20">
                                                                        {log.changes.count} ITEMS
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-4 shrink-0">
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest hidden sm:block">{date}</span>
                                                                <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={14} className="text-gray-400" /></div>
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="px-4 pb-4 space-y-4 animate-slide-down border-t dark:border-white/5 pt-4">
                                                                <div className="bg-white/5 rounded-xl p-4 border dark:border-white/5">
                                                                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed uppercase">
                                                                        {log.action === 'IMPORT' && `Corridor ingestion successful. Sync point: ${log.changes.source}.`}
                                                                        {log.action === 'BULK_DELETE' && `Purge protocol executed. ${log.changes.count} corridor records removed (${log.changes.label}).`}
                                                                        {log.action === 'ADD' && `New transfer vector initialized: ${log.description}.`}
                                                                        {log.action === 'EDIT' && `Transfer intelligence updated for: ${log.description}.`}
                                                                    </p>
                                                                    {log.changes.items && (
                                                                        <div className="mt-4 pt-4 border-t border-white/5">
                                                                            <div className="flex justify-between items-center mb-3">
                                                                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Complete Resource Manifest ({log.changes.items.length} Vectors):</p>
                                                                                {log.action === 'IMPORT' && (
                                                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'group', group: log.changes.items, label: `Imported Batch (${log.changes.source})` }); }} className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border border-rose-500/20">Purge Ingestion</button>
                                                                                )}
                                                                            </div>
                                                                            <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                                                {log.changes.items.map((item, idx) => (
                                                                                    <div key={idx} className="flex justify-between text-[9px] font-bold text-gray-500 dark:text-gray-400">
                                                                                        <span>{item.description} (to {item.recipient || 'N/A'})</span>
                                                                                        <span>${Number(item.amount).toFixed(0)}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Popup>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>

        {/* POPUPS (EDIT ON TOP z-500) */}
        {editTx && (
            <Popup title={editTx.isNew ? 'New Entry' : 'Edit Entry'} onClose={() => setEditTx(null)} zIndex={500}>
                {editTx.isIndiaCorridor ? (
                    <IndiaTransferForm 
                        initialData={editTx.isNew ? {isIndiaCorridor: true, category: 'India Transfer', ...editTx} : editTx}
                        onSave={handleSave}
                        onDelete={!editTx.isNew ? () => setDeleteConfirm({ type: 'single', id: editTx.firestoreId }) : null}
                        allRecipients={allRecipients}
                    />
                ) : (
                    <TransactionForm 
                        initialData={editTx.isNew ? {} : editTx} 
                        onSave={handleSave} 
                        onDelete={!editTx.isNew ? () => setDeleteConfirm({ type: 'single', id: editTx.firestoreId }) : null} 
                        allCategories={allCategories} 
                        allSources={allSources}
                        allTags={allTags}
                        isCategoryExcluded={excludedCategories.includes(editTx.category)}
                    />
                )}
            </Popup>
        )}
        
        {/* IMPORT PREVIEW POPUP (z-100) */}
        {importPreview && (
            <Popup title={importToIndiaHub ? `India Transfer Ingestion (${importPreview.length} Records)` : `Import Preview (${importPreview.length} Items)`} onClose={() => { setImportPreview(null); setImportToIndiaHub(false); }} wide zIndex={100}>
                <div className="flex flex-col h-[70vh]">
                     {/* GLOBAL SELECTORS */}
                     <div className="bg-blue-50 dark:bg-blue-500/10 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-6 mb-8 border border-blue-100 dark:border-blue-500/20 shadow-inner">
                         <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                            {importToIndiaHub ? (
                                <div className="flex items-center gap-3">
                                    <Globe size={20} className="text-blue-600 dark:text-blue-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-800 dark:text-blue-300">Default Recipient:</span>
                                    <div className="w-64">
                                        <CreatableCategorySelect 
                                            value={importPreview[0]?.recipient || ''}
                                            options={allRecipients}
                                            placeholder="Assign to (e.g. Family)"
                                            onChange={(val) => {
                                                const next = importPreview.map(tx => ({ ...tx, recipient: val }));
                                                setImportPreview(next);
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <CreditCard size={20} className="text-blue-600 dark:text-blue-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-800 dark:text-blue-300">Origin:</span>
                                        <div className="w-48">
                                            <CreatableCategorySelect 
                                                value={importGlobalSource} 
                                                onChange={setImportGlobalSource} 
                                                options={allSources} 
                                                placeholder="Source (e.g. DCU)"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-800 dark:text-blue-300">Force Year:</span>
                                        <div className="w-32">
                                            <select 
                                                className="w-full bg-white dark:bg-[#0a0a0a] p-3 rounded-xl font-black text-[10px] uppercase tracking-widest outline-none border border-transparent focus:border-blue-500/30 dark:text-white"
                                                onChange={(e) => {
                                                    const newYear = e.target.value;
                                                    if (!newYear) return;
                                                    const nextPreview = importPreview.map(tx => {
                                                        const parts = tx.date.split('-');
                                                        parts[0] = newYear;
                                                        return { ...tx, date: parts.join('-') };
                                                    });
                                                    setImportPreview(nextPreview);
                                                }}
                                                defaultValue=""
                                            >
                                                <option value="">Detect</option>
                                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                         </div>
                     </div>

                     <div className="flex-1 overflow-y-auto -mx-10 px-10">
                        <table className="w-full text-left border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] sticky top-0 bg-white dark:bg-[#0a0a0a] z-20">
                                    <th className="p-4 w-10"></th>
                                    <th className="p-4 w-32 text-left">Date</th>
                                    {importToIndiaHub && <th className="p-4 w-40 text-left">Recipient</th>}
                                    <th className="p-4 text-left">Description</th>
                                    <th className="p-4 w-28 text-left">USD ($)</th>
                                    {importToIndiaHub && <th className="p-4 w-24 text-left">Rate (₹)</th>}
                                    {importToIndiaHub && <th className="p-4 w-32 text-left">INR Received</th>}
                                    <th className="p-4 w-24 text-left">Flow</th>
                                    {!importToIndiaHub && <th className="p-4 w-48 text-left">Category</th>}
                                    {!importToIndiaHub && <th className="p-4 w-32 text-left">Tags</th>}
                                    <th className="p-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="z-10">
                                {importPreview.map((tx, idx) => {
                                    const isRowExcluded = tx.isExcluded || excludedCategories.includes(tx.category);
                                    return (
                                    <tr key={tx.tempId} className={`group transition-all ${isRowExcluded ? 'opacity-40 grayscale' : ''}`}>
                                        <td className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-l-2xl group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                            <button onClick={() => { const n = [...importPreview]; n[idx].isExcluded = !n[idx].isExcluded; setImportPreview(n); }} className="text-gray-400 hover:text-blue-600">
                                                {isRowExcluded ? <EyeOff size={18}/> : <Eye size={18}/>}
                                            </button>
                                        </td>
                                        <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors"><input className="w-full bg-transparent outline-none font-black text-[10px] dark:text-white uppercase tracking-widest" value={tx.date} onChange={e => { const n = [...importPreview]; n[idx].date = e.target.value; setImportPreview(n); }} /></td>
                                        {importToIndiaHub && (
                                            <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                                <input className="w-full bg-transparent outline-none font-bold text-[10px] dark:text-white uppercase" placeholder="Recipient" value={tx.recipient || ''} onChange={e => { const n = [...importPreview]; n[idx].recipient = e.target.value; setImportPreview(n); }} />
                                            </td>
                                        )}
                                        <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors"><input className="w-full bg-transparent outline-none font-bold text-xs dark:text-white uppercase tracking-tight" value={tx.description} onChange={e => { const n = [...importPreview]; n[idx].description = e.target.value; setImportPreview(n); }} /></td>
                                        <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                            <input className="w-full bg-transparent outline-none font-black text-xs dark:text-white" value={tx.amount} onChange={e => { 
                                                const n = [...importPreview]; 
                                                n[idx].amount = e.target.value; 
                                                if (n[idx].rate) n[idx].secondaryAmount = (parseFloat(e.target.value) * parseFloat(n[idx].rate)).toFixed(2);
                                                setImportPreview(n); 
                                            }} />
                                        </td>
                                        {importToIndiaHub && (
                                            <>
                                                <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                                    <input className="w-full bg-transparent outline-none font-black text-[10px] text-blue-600 dark:text-blue-400" placeholder="0.00" value={tx.rate || ''} onChange={e => { 
                                                        const n = [...importPreview]; 
                                                        n[idx].rate = e.target.value; 
                                                        if (n[idx].amount) n[idx].secondaryAmount = (parseFloat(n[idx].amount) * parseFloat(e.target.value)).toFixed(2);
                                                        setImportPreview(n); 
                                                    }} />
                                                </td>
                                                <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                                    <input className="w-full bg-transparent outline-none font-black text-[10px] text-emerald-600 dark:text-emerald-400" placeholder="0.00" value={tx.secondaryAmount || ''} onChange={e => { const n = [...importPreview]; n[idx].secondaryAmount = e.target.value; setImportPreview(n); }} />
                                                </td>
                                            </>
                                        )}
                                        <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                            <select 
                                                className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none dark:text-white"
                                                value={tx.type} 
                                                onChange={e => { const n = [...importPreview]; n[idx].type = e.target.value; setImportPreview(n); }}
                                            >
                                                <option value="expense">OUT</option>
                                                <option value="income">IN</option>
                                            </select>
                                        </td>
                                        {!importToIndiaHub && (
                                            <>
                                                <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
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
                                                <td className="p-4 bg-gray-50 dark:bg-white/[0.02] group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                                    <CreatableCategorySelect 
                                                        value={tx.tags && tx.tags[0] ? tx.tags[0] : ''} 
                                                        onChange={(val) => { const n = [...importPreview]; n[idx].tags = [val]; setImportPreview(n); }} 
                                                        options={allTags}
                                                        placeholder="Tag"
                                                    />
                                                </td>
                                            </>
                                        )}
                                        <td className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-r-2xl group-hover:bg-blue-50 dark:group-hover:bg-blue-600/10 transition-colors">
                                            <button onClick={() => setImportPreview(importPreview.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600 transition-colors"><X size={18}/></button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                     </div>
                     <div className="pt-8 border-t dark:border-white/5 flex justify-end gap-4 mt-6">
                         <button onClick={() => setImportPreview(null)} className="px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 transition-all">Abort Stream</button>
                         <button onClick={confirmImport} className="px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] bg-blue-600 text-white shadow-2xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"><Save size={18}/> Authorize Ingestion</button>
                     </div>
                </div>
            </Popup>
        )}

        {/* IMPORT ERROR POPUP */}
        {importError && (
            <Popup title="Import Status" onClose={() => setImportError(null)} zIndex={2000}>
                <div className="text-center py-6">
                    <div className="w-24 h-24 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-[2.5rem] flex items-center justify-center mb-10 mx-auto shadow-inner">
                        <AlertCircle size={48} />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter leading-none">Detection <br/><span className="text-rose-600">Failed.</span></h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-12 font-bold uppercase tracking-widest text-[10px] leading-relaxed px-4">
                        {importError}
                    </p>
                    <button onClick={() => setImportError(null)} className="w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-gray-900 dark:bg-blue-600 shadow-2xl transition-all hover:scale-105 active:scale-95">
                        Acknowledge
                    </button>
                </div>
            </Popup>
        )}

        {/* --- Import Confirmation Modal --- */}
        {showImportConfirmModal && (
            <Popup title="Confirm Import" onClose={() => setShowImportConfirmModal(false)} zIndex={600}>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-xl">
                        <AlertCircle size={24} />
                        <p className="text-sm font-bold">{importToIndiaHub ? 'No recipients defined.' : 'No default payment method selected.'}</p>
                    </div>
                    <p className="text-gray-600 text-sm">
                        {importToIndiaHub 
                            ? 'You can select a default recipient now to apply to all blank entries, or continue to leave them as is.' 
                            : 'You can select one now to apply to all imported transactions, or ignore to leave them blank.'}
                    </p>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">{importToIndiaHub ? 'Default Recipient' : 'Payment Method'}</label>
                        {importToIndiaHub ? (
                            <input 
                                className="w-full bg-gray-50 dark:bg-white/[0.03] p-4 rounded-xl font-black text-[10px] uppercase tracking-widest border border-transparent focus:bg-white dark:focus:bg-[#0a0a0a] focus:border-blue-500/30 outline-none transition-all dark:text-white shadow-inner"
                                placeholder="Recipient Name (e.g. Family)"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const next = importPreview.map(tx => ({ ...tx, recipient: tx.recipient || val }));
                                    setImportPreview(next);
                                }}
                            />
                        ) : (
                            <CreatableCategorySelect 
                                value={importGlobalSource} 
                                onChange={setImportGlobalSource} 
                                options={allSources} 
                                placeholder="Select Source (e.g. Amex)" 
                            />
                        )}
                    </div>

                    <div className="flex gap-3 pt-6 mt-4 border-t dark:border-gray-700 transition-colors">
                        <button onClick={executeImport} className="flex-1 py-4 rounded-2xl font-black bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-all">Ignore & Continue</button>
                        <button onClick={executeImport} className="flex-1 py-4 rounded-2xl font-black bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all">Confirm Import</button>
                    </div>
                </div>
            </Popup>
        )}

        {/* DRILLDOWN POPUP (z-400) */}
        {drilldownState && (
            <Popup 
                title={
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">{drilldownState.title}</span>
                        {currentList.length > 0 && (
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mt-1">
                                Net Position: {formatCurrency(currentList.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0))}
                            </span>
                        )}
                    </div>
                }
                onClose={() => setDrilldownState(null)} 
                wide
                zIndex={400} 
                headerAction={
                    (drilldownState.stack && drilldownState.stack.length > 0) ? (
                        <button onClick={handleDrilldownBack} className="flex items-center gap-2 w-12 h-12 justify-center rounded-2xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all text-gray-600 dark:text-gray-400 shadow-inner">
                            <ArrowLeft size={20}/>
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

        {/* SOPHISTICATED CONTROL CENTER (z-600) */}
        {showManageModal && (() => {
            const tabs = [
                { id: 'category', label: 'Vectors', icon: <Layers size={18} /> },
                { id: 'source', label: 'Sources', icon: <CreditCard size={18} /> },
                { id: 'tags', label: 'Metadata', icon: <Hash size={18} /> },
                { id: 'audit', label: 'Audit Log', icon: <History size={18} /> }
            ];

            return (
                <Popup title="Control Center" onClose={() => setShowManageModal(null)} zIndex={600} size="xl" fullHeight>
                    <div className="flex h-[650px] overflow-hidden">
                        {/* LEFT SIDEBAR NAVIGATION */}
                        <div className="w-64 bg-gray-50/50 dark:bg-white/[0.02] border-r dark:border-white/5 flex flex-col p-6 gap-2 shrink-0">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4 ml-2">Navigation</p>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setManageTab(tab.id); setEditingItem(null); setManageSearch(''); }}
                                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 relative group ${manageTab === tab.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 translate-x-2' : 'text-gray-500 hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                    {manageTab === tab.id && <div className="absolute -left-1 w-1 h-6 bg-white rounded-full"></div>}
                                </button>
                            ))}
                            <div className="mt-auto p-4 bg-blue-600/5 rounded-[2rem] border border-blue-600/10">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-relaxed text-center">System integrity optimized. All changes are indexed.</p>
                            </div>
                        </div>

                        {/* RIGHT CONTENT AREA */}
                        <div className="flex-1 flex flex-col bg-white dark:bg-transparent overflow-hidden">
                            {/* DYNAMIC HEADER & SEARCH */}
                            <div className="p-8 border-b dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{tabs.find(t => t.id === manageTab).label}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Management & Configuration</p>
                                </div>
                                <div className="relative w-full md:w-72">
                                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Filter results..." 
                                        value={manageSearch}
                                        onChange={(e) => setManageSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-transparent focus:border-blue-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none dark:text-white shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* LIST AREA */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-3">
                                {manageTab === 'audit' && (
                                    <div className="space-y-3">
                                        {activityLogs.filter(log => !log.isIndiaCorridor && log.description.toLowerCase().includes(manageSearch.toLowerCase())).length === 0 && (
                                            <div className="text-center py-20 text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">No activity found in filter.</div>
                                        )}
                                        {activityLogs.filter(log => !log.isIndiaCorridor && log.description.toLowerCase().includes(manageSearch.toLowerCase())).map(log => {
                                            const date = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now';
                                            const isExpanded = expandedLogs[log.id];
                                            const actionColors = {
                                                'ADD': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                                                'EDIT': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                                                'DELETE': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                                                'IMPORT': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                                                'BULK_DELETE': 'bg-rose-500/20 text-rose-600 border-rose-500/30',
                                                'BULK_EDIT': 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                                            };
                                            return (
                                                <div key={log.id} className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden transition-all shadow-sm">
                                                    <div onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id]: !isExpanded }))} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors gap-4">
                                                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black border uppercase tracking-widest shrink-0 ${actionColors[log.action] || actionColors['EDIT']}`}>{log.action.replace('_', ' ')}</span>
                                                            <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight truncate">{log.description}</span>
                                                            {(log.action === 'IMPORT' || log.action === 'BULK_DELETE' || log.action === 'BULK_EDIT') && log.changes?.count && (
                                                                <span className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-500/10 text-gray-500 text-[8px] font-black uppercase tracking-widest border border-gray-500/20">
                                                                    {log.changes.count} ITEMS
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4 shrink-0">
                                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest hidden sm:block">{date}</span>
                                                            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={14} className="text-gray-400" /></div>
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="px-4 pb-4 space-y-4 animate-slide-down border-t dark:border-white/5 pt-4">
                                                            <div className="flex flex-wrap gap-2">
                                                                {(log.action === 'ADD' || log.action === 'EDIT' || log.action === 'DELETE') && (log.changes?.after || log.changes?.before) && (() => {
                                                                    const ctx = log.changes?.after || log.changes?.before;
                                                                    return (
                                                                        <>
                                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 text-[8px] font-black text-gray-500 uppercase tracking-widest"><Calendar size={10} /> {ctx.date}</div>
                                                                            {ctx.source && <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/50 dark:bg-blue-500/5 border border-transparent dark:border-blue-500/10 text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest"><CreditCard size={10} /> {ctx.source}</div>}
                                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50/50 dark:bg-purple-500/5 border border-transparent dark:border-purple-500/10 text-[8px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest"><Tag size={10} /> {ctx.category}</div>
                                                                        </>
                                                                    );
                                                                })()}
                                                                {(log.action === 'IMPORT' || log.action === 'BULK_DELETE' || log.action === 'BULK_EDIT') && (
                                                                    <div className="w-full space-y-3">
                                                                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                            {log.action === 'IMPORT' ? <UploadCloud size={14} /> : (log.action === 'BULK_DELETE' ? <Trash2 size={14} /> : <Edit2 size={14} />)} 
                                                                            {log.action.replace('_', ' ')} Manifest
                                                                        </div>
                                                                        <div className="bg-white/5 rounded-xl p-4 border dark:border-white/5">
                                                                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed uppercase">
                                                                                {log.action === 'IMPORT' && `Ingestion of ${log.changes.count} records successful. All entries synchronized to index point: ${log.changes.source}.`}
                                                                                {log.action === 'BULK_DELETE' && `Purge protocol executed. ${log.changes.count} records permanently removed from the archive (${log.changes.label}).`}
                                                                                {log.action === 'BULK_EDIT' && `Refactor protocol executed. ${log.changes.count} records modified. Type: ${log.changes.editType}, Target: ${log.changes.originalValue}.`}
                                                                            </p>
                                                                                                                                                                {log.changes.items && (
                                                                                                                                                                                                                                                            <div className="mt-4 pt-4 border-t border-white/5">
                                                                                                                                                                                                                                                                <div className="flex justify-between items-center mb-3">
                                                                                                                                                                                                                                                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Complete Resource Manifest ({log.changes.items.length} Vectors):</p>
                                                                                                                                                                                                                                                                    {log.action === 'IMPORT' && (
                                                                                                                                                                                                                                                                        <button 
                                                                                                                                                                                                                                                                            onClick={(e) => {
                                                                                                                                                                                                                                                                                e.stopPropagation();
                                                                                                                                                                                                                                                                                setDeleteConfirm({ 
                                                                                                                                                                                                                                                                                    type: 'group', 
                                                                                                                                                                                                                                                                                    group: log.changes.items, 
                                                                                                                                                                                                                                                                                    label: `Imported Batch (${log.changes.source})` 
                                                                                                                                                                                                                                                                                });
                                                                                                                                                                                                                                                                            }}
                                                                                                                                                                                                                                                                            className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                                                                                                                                                                                                                                                                        >
                                                                                                                                                                                                                                                                            Purge Ingestion
                                                                                                                                                                                                                                                                        </button>
                                                                                                                                                                                                                                                                    )}
                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                                                                                                                                    
                                                                                                                                                                            {log.changes.items.map((item, idx) => (
                                                                                                                                                                                <div key={idx} className="flex justify-between text-[9px] font-bold text-gray-500 dark:text-gray-400">
                                                                                                                                                                                    <span className="truncate pr-4">{item.description}</span>
                                                                                                                                                                                    <span className="shrink-0">${Number(item.amount).toFixed(0)}</span>
                                                                                                                                                                                </div>
                                                                                                                                                                            ))}
                                                                                                                                                                        </div>
                                                                                                                                                                    </div>
                                                                                                                                                                )}
                                                                            
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {log.action === 'EDIT' && log.changes?.before && log.changes?.after && (
                                                                <div className="space-y-2 mt-1">
                                                                    {Object.keys(log.changes.after).map(key => {
                                                                        const before = log.changes.before[key];
                                                                        const after = log.changes.after[key];
                                                                        const isChanged = Array.isArray(after) ? JSON.stringify(after) !== JSON.stringify(before) : after !== before;
                                                                        if (!isChanged || key === 'id') return null;
                                                                        const displayValue = (val) => Array.isArray(val) ? (val.length > 0 ? val.join(', ') : 'None') : (typeof val === 'number' ? `$${val.toFixed(0)}` : (val || 'None'));
                                                                        return (
                                                                            <div key={key} className="flex items-center justify-between">
                                                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest w-20">{key}</span>
                                                                                <div className="flex-1 flex items-center gap-2 overflow-hidden justify-end">
                                                                                    <span className="text-[9px] font-bold text-gray-400 line-through truncate max-w-[100px]">{displayValue(before)}</span>
                                                                                    <ArrowRight size={8} className="text-gray-400 shrink-0" /><span className="text-[9px] font-black text-blue-500 truncate max-w-[100px]">{displayValue(after)}</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {log.action === 'ADD' && log.changes?.after?.amount && <div className="flex justify-end pt-2 border-t dark:border-white/5"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Entry Magnified: +${Number(log.changes.after.amount).toLocaleString()}</span></div>}
                                                            {log.action === 'DELETE' && log.changes?.before?.amount && <div className="flex justify-end pt-2 border-t dark:border-white/5"><span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Entry Purged: -${Number(log.changes.before.amount).toLocaleString()}</span></div>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {manageTab === 'category' && allCategories.filter(c => c.toLowerCase().includes(manageSearch.toLowerCase())).map(cat => {
                                    const isEditing = editingItem && editingItem.type === 'category' && editingItem.original === cat;
                                    if (isEditing) {
                                        return (
                                            <div key={cat} className="flex gap-3 bg-blue-50 dark:bg-blue-600/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-600/30">
                                                <div className="relative group">
                                                    <button onClick={() => setIconPickerOpen(iconPickerOpen === cat ? null : cat)} className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center border border-blue-100 dark:border-blue-800 text-blue-600 shadow-xl">{getCategoryIcon(editingItem.icon || cat, 20, categoryIcons)}</button>
                                                    {iconPickerOpen === cat && (
                                                        <div className="absolute top-full left-0 mt-3 bg-white dark:bg-[#0a0a0a] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 rounded-2xl w-72 p-4 grid grid-cols-6 gap-2 z-[9999] h-56 overflow-y-auto custom-scrollbar">
                                                            {AVAILABLE_ICONS.map(iconKey => {
                                                                const IconCmp = ICON_MAP[iconKey];
                                                                return (
                                                                    <button key={iconKey} onClick={() => { setEditingItem(prev => ({ ...prev, icon: iconKey })); setIconPickerOpen(null); }} className="p-2.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl flex justify-center transition-all hover:scale-110"><IconCmp size={18} className="text-gray-600 dark:text-gray-400 hover:text-blue-600" /></button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                <input className="flex-1 bg-white dark:bg-gray-800 px-4 rounded-xl text-xs font-black uppercase tracking-widest outline-none border border-blue-200 dark:border-blue-800 dark:text-white" value={editingItem.current} onChange={e => setEditingItem(prev => ({ ...prev, current: e.target.value }))}/>
                                                <button onClick={handleRename} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-xl transition-all hover:scale-105"><Check size={18}/></button>
                                                <button onClick={() => setEditingItem(null)} className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl hover:bg-gray-200 transition-all"><X size={18}/></button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={cat} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl hover:bg-gray-100 dark:hover:bg-white/[0.05] cursor-pointer transition-all border border-transparent hover:border-gray-100 dark:hover:border-white/5 shrink-0" onClick={() => setExcludedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-white/10">{getCategoryIcon(cat, 20, categoryIcons)}</div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-200">{cat}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {excludedCategories.includes(cat) ? <CheckSquare size={22} className="text-rose-500"/> : <Square size={22} className="text-gray-300 dark:text-gray-600"/>}
                                                <button onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'category', original: cat, current: cat }); }} className="p-2.5 hover:bg-blue-100 dark:hover:bg-blue-600/20 rounded-xl text-gray-400 hover:text-blue-600 transition-all"><Edit2 size={16}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); setManagerConfirm({ type: 'category', value: cat }) }} className="p-2.5 hover:bg-red-100 dark:hover:bg-red-600/20 rounded-xl text-gray-400 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {manageTab === 'source' && allSources.filter(s => s.toLowerCase().includes(manageSearch.toLowerCase())).map(src => {
                                    const isEditing = editingItem && editingItem.type === 'source' && editingItem.original === src;
                                    if (isEditing) {
                                        return (
                                            <div key={src} className="flex gap-3 bg-blue-50 dark:bg-blue-600/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-600/30">
                                                <input className="flex-1 bg-white dark:bg-gray-800 px-4 rounded-xl text-xs font-black uppercase tracking-widest outline-none border border-blue-200 dark:border-blue-800 dark:text-white" value={editingItem.current} onChange={e => setEditingItem(prev => ({ ...prev, current: e.target.value }))}/>
                                                <button onClick={handleRename} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-xl transition-all hover:scale-105"><Check size={18}/></button>
                                                <button onClick={() => setEditingItem(null)} className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl hover:bg-gray-200 transition-all"><X size={18}/></button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={src} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl transition-all hover:bg-gray-100 dark:hover:bg-white/[0.05] border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500 shadow-sm border border-gray-100 dark:border-white/10"><CreditCard size={20} /></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-200">{src}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setEditingItem({ type: 'source', original: src, current: src })} className="p-2.5 hover:bg-blue-100 dark:hover:bg-blue-600/20 rounded-xl text-gray-400 hover:text-blue-600 transition-all"><Edit2 size={16}/></button>
                                                <button onClick={() => setManagerConfirm({ type: 'source', value: src })} className="p-2.5 hover:bg-red-100 dark:hover:bg-red-600/20 rounded-xl text-gray-400 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {manageTab === 'tags' && (
                                     <div className="flex flex-wrap gap-3">
                                        {allTags.filter(t => t.toLowerCase().includes(manageSearch.toLowerCase())).map(tag => {
                                            const isEditing = editingItem && editingItem.type === 'tags' && editingItem.original === tag;
                                            if (isEditing) {
                                                return (
                                                    <div key={tag} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-600/10 p-2 rounded-xl border border-blue-100 dark:border-blue-600/30">
                                                        <input className="w-32 bg-white dark:bg-gray-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-200 dark:border-blue-800 outline-none dark:text-white" value={editingItem.current} onChange={e => setEditingItem(prev => ({ ...prev, current: e.target.value }))}/>
                                                        <button onClick={handleRename} className="text-blue-600 hover:scale-110 transition-all"><Check size={16}/></button>
                                                        <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:scale-110 transition-all"><X size={16}/></button>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={tag} className="flex items-center gap-3 bg-purple-50 dark:bg-white/5 text-purple-700 dark:text-purple-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:shadow-xl hover:bg-purple-100 dark:hover:bg-white/10 transition-all shadow-sm border border-transparent hover:border-purple-200 dark:hover:border-purple-500/30" onClick={() => setEditingItem({ type: 'tags', original: tag, current: tag })}>
                                                    <Hash size={12} className="opacity-50" />
                                                    #{tag}
                                                    <button onClick={(e) => { e.stopPropagation(); setManagerConfirm({ type: 'tags', value: tag }); }} className="hover:text-rose-600 transition-all ml-1"><X size={14}/></button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* FOOTER ACTION (ADD NEW) */}
                            {manageTab !== 'audit' && !editingItem && (
                                <div className="p-8 border-t dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01] shrink-0">
                                    <div className="flex gap-3">
                                        <input id="newItemInput" placeholder={`Initialize new ${manageTab}...`} className="flex-1 bg-white dark:bg-[#0a0a0a] px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none border border-transparent focus:border-blue-500/30 transition-all dark:text-white shadow-sm"/>
                                        <button onClick={() => {
                                            const val = document.getElementById('newItemInput').value;
                                            if(val) alert(`Protocol: To add "${val}", simply assign it to a new entry. It will be indexed automatically.`);
                                        }} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"><Plus size={16}/> Add New</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Popup>
            );
        })()}

        {/* Manager Confirm Dialog */}
        {managerConfirm && (
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xl z-[9000] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-sm rounded-[3rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-center border border-gray-100 dark:border-white/10">
                    <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-inner"><AlertCircle size={32} /></div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">De-Index {managerConfirm.value}?</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 font-bold uppercase tracking-widest text-[10px] leading-relaxed">This will remove the selected vector from the archive. Data integrity will be maintained, but the identifier will be purged.</p>
                    <div className="flex gap-4">
                        <button onClick={() => setManagerConfirm(null)} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 transition-all">Abort</button>
                        <button onClick={() => handleBatchDelete(managerConfirm.type, managerConfirm.value)} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 shadow-2xl shadow-rose-600/20 transition-all">Confirm Purge</button>
                    </div>
                </div>
            </div>
        )}

        {deleteConfirm && (
            <Popup title="Purge Protocol" onClose={() => setDeleteConfirm(null)} zIndex={7000}>
                <div className="text-center py-6">
                    <div className="w-24 h-24 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-[2.5rem] flex items-center justify-center mb-10 mx-auto shadow-inner">
                        <Trash2 size={48} />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter leading-none">Confirm <br/><span className="text-rose-600">Deletion?</span></h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-12 font-bold uppercase tracking-widest text-[10px] leading-relaxed">
                        {deleteConfirm.type === 'single' 
                            ? "Purge this specific data point from the archive? This operation is permanent." 
                            : `De-Index ALL records from ${deleteConfirm.label}? This will result in permanent data loss.`
                        }
                    </p>
                    <div className="flex gap-4">
                        <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 transition-all">Cancel Abort</button>
                        <button onClick={executeDelete} className="flex-1 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 shadow-[0_20px_50px_rgba(225,29,72,0.3)] transition-all flex items-center justify-center gap-2 active:scale-95">
                            Purge Data
                        </button>
                    </div>
                </div>
            </Popup>
        )}
        {/* BULK ACTION BAR */}
        {selectedTxIds.length > 0 && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[8000] animate-slide-up">
                <div className="bg-gray-900 dark:bg-white text-white dark:text-black px-10 py-6 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.5)] border border-white/10 dark:border-black/5 flex items-center gap-10 backdrop-blur-3xl">
                    <div className="flex items-center gap-4 border-r border-white/10 dark:border-black/10 pr-10">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">{selectedTxIds.length}</div>
                        <p className="text-xs font-black uppercase tracking-widest">Records Selected</p>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => {
                                const group = transactions.filter(t => selectedTxIds.includes(t.firestoreId));
                                setDeleteConfirm({ type: 'group', group, label: `${selectedTxIds.length} Selected Records` });
                            }}
                            className="flex items-center gap-3 px-6 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-rose-600/20"
                        >
                            <Trash2 size={16}/> Purge Selection
                        </button>
                        <button 
                            onClick={() => setSelectedTxIds([])}
                            className="flex items-center gap-3 px-6 py-3 bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                            <X size={16}/> Clear
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---

const MultiSelectDropdown = ({ options, selected, onChange }) => {
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

    const displayLabel = useMemo(() => {
        if (selected.includes('All Sources')) return 'Total Portfolio';
        if (selected.includes('All Years')) return 'Full History';
        if (selected.length === 0) return 'Select Options';
        if (selected.length === 1) return selected[0];
        return `${selected.length} Selected`;
    }, [selected]);

    return (
        <div className={`relative ${isOpen ? 'z-[100]' : 'z-[50]'}`} ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-gray-100/50 dark:bg-white/5 hover:bg-gray-200/50 dark:hover:bg-white/10 border border-gray-200/50 dark:border-white/10 font-black text-gray-600 dark:text-gray-400 text-[9px] md:text-[10px] uppercase tracking-widest transition-all shadow-sm group min-w-0 md:min-w-[140px] justify-between">
                <div className="flex items-center gap-2">
                    <Filter size={12} className="group-hover:text-blue-600 transition-colors hidden md:block"/> 
                    <span className="truncate max-w-[80px] md:max-w-none">{displayLabel}</span>
                </div>
                <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 max-h-72 overflow-y-auto z-[99999] p-2 animate-in fade-in zoom-in duration-200 backdrop-blur-3xl">
                    {options.map(opt => (
                        <div key={opt} onClick={() => toggleOption(opt)} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-all mb-1 last:mb-0 group">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{backgroundColor: stringToColor(opt)}}></div>
                            <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300 truncate group-hover:text-blue-600">{opt}</span>
                            {selected.includes(opt) ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18} className="text-gray-300 dark:text-gray-700"/>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CalendarHistory = ({ transactions, selectedDate, setSelectedDate, calendarMonth, setCalendarMonth, calendarYear, setCalendarYear, onEditTx, onFilterClick, categoryIcons, formatCurrency, excludedCategories, isMini, onMonthYearChange, selectedTxIds, onSelectTx }) => {
    const [showDayPopup, setShowDayPopup] = useState(false);
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
    
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
        days.push(<div key={`empty-${i}`} className={`h-24 ${isMini ? 'md:h-24' : 'md:h-32'} rounded-[2rem] bg-gray-50/20 dark:bg-white/[0.01] border border-transparent`}></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayTransactions = transactions.filter(tx => tx.date === dateStr);
        const dayIncome = dayTransactions.reduce((acc, tx) => acc + (tx.type === 'income' && !tx.isExcluded && !excludedCategories.includes(tx.category) ? tx.amount : 0), 0);
        const dayExpense = dayTransactions.reduce((acc, tx) => acc + (tx.type === 'expense' && !tx.isExcluded && !excludedCategories.includes(tx.category) ? tx.amount : 0), 0);
        const isSelected = selectedDate === dateStr;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        const unlistedCount = dayTransactions.filter(tx => tx.isExcluded || excludedCategories.includes(tx.category)).length;

        days.push(
            <div 
                key={d} 
                onClick={() => { setSelectedDate(dateStr); setShowDayPopup(true); }}
                className={`h-24 ${isMini ? 'md:h-28' : 'md:h-32'} p-2 md:p-3 rounded-[2rem] cursor-pointer transition-all duration-500 flex flex-col justify-between relative group border shadow-sm ${isSelected ? 'bg-blue-600 dark:bg-blue-600 border-blue-600 z-10 scale-[1.05] shadow-[0_20px_50px_rgba(37,99,235,0.3)]' : 'bg-white dark:bg-white/[0.03] backdrop-blur-xl border-gray-100 dark:border-white/5 hover:border-blue-500/50 hover:shadow-2xl hover:-translate-y-1'}`}
            >
                <div className="flex justify-between items-start">
                    <span className={`text-xs md:text-sm font-black transition-all ${isSelected ? 'text-white' : (isToday ? 'bg-blue-600 text-white w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30' : 'text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400')}`}>{d}</span>
                    {dayTransactions.length > 0 && (
                        <div className="flex gap-1">
                            {unlistedCount > 0 && (
                                <div title={`${unlistedCount} Excluded`} className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white/40' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            )}
                            {!isMini && (
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border transition-all ${isSelected ? 'bg-white/20 border-white/20 text-white' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400'}`}>
                                    <span className="text-[8px] font-black">{dayTransactions.length}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-0.5 mt-auto overflow-hidden">
                    {(dayIncome > 0 || dayExpense > 0) && (
                        <div className="flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-1 duration-500">
                            {dayIncome > 0 && (
                                <div className="flex items-center gap-1 px-1 py-0.5 rounded-lg border border-transparent">
                                    <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'} shadow-sm shrink-0`}></div>
                                    <div className={`text-[8px] md:text-[9px] font-black truncate ${isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(dayIncome)}</div>
                                </div>
                            )}
                            {dayExpense > 0 && (
                                <div className="flex items-center gap-1 px-1 py-0.5 rounded-lg border border-transparent">
                                    <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'} shadow-sm shrink-0`}></div>
                                    <div className={`text-[8px] md:text-[9px] font-black truncate ${isSelected ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(dayExpense)}</div>
                                </div>
                            )}
                        </div>
                    )}
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
        <div className={`space-y-8 ${isMini ? 'p-2' : ''}`}>
            {!isMini && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-fade-in">
                    <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2">Revenue</p>
                        <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{formatCurrency(monthlyStats.income)}</p>
                    </div>
                    <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2">Expenses</p>
                        <p className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tighter">{formatCurrency(monthlyStats.expense)}</p>
                    </div>
                    <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2">Net Flow</p>
                        <p className={`text-3xl font-black tracking-tighter ${monthlyStats.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>{monthlyStats.net >= 0 ? '+' : ''}{formatCurrency(monthlyStats.net)}</p>
                    </div>
                    <div className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2">Density</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{monthlyStats.count} <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Log Entries</span></p>
                    </div>
                </div>
            )}

            <div className={`bg-white/80 dark:bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] ${isMini ? 'border border-gray-200 dark:border-white/5' : 'shadow-[0_20px_50px_rgba(0,0,0,0.04)] dark:shadow-2xl border border-gray-200 dark:border-white/5'} overflow-hidden transition-all`}>
                <div className={`p-8 ${isMini ? 'pb-6 pt-6 px-6' : 'border-b border-gray-100 dark:border-white/5'} flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50/50 dark:bg-white/[0.02]`}>
                    {isMini ? (
                        <div className="flex items-center gap-4">
                            <span className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                {new Date(0, calendarMonth).toLocaleString('default', { month: 'long' })} {calendarYear}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-white dark:bg-white/5 p-2 rounded-[1.5rem] border border-gray-200 dark:border-white/10 shadow-inner">
                            <CustomDropdown 
                                value={calendarMonth} 
                                onChange={handleMonthChange} 
                                options={monthOptions} 
                            />
                            <div className="w-px h-6 bg-gray-200 dark:border-white/10 mx-1"></div>
                            <CustomDropdown 
                                value={calendarYear} 
                                onChange={handleYearChange} 
                                options={yearOptions} 
                            />
                        </div>
                    )}
                    <div className="flex gap-4">
                        <button onClick={prevMonth} className="p-4 bg-gray-100/50 dark:bg-white/5 shadow-sm rounded-2xl transition-all text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:scale-110 border border-gray-200/50 dark:border-white/10 active:scale-95 group">
                            <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <button onClick={() => { 
                            const now = new Date();
                            handleMonthChange(now.getMonth());
                            handleYearChange(now.getFullYear());
                        }} className="px-10 py-4 bg-gray-100/50 dark:bg-white/5 shadow-sm rounded-2xl transition-all text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 dark:text-gray-300 hover:text-blue-600 border border-gray-200/50 dark:border-white/10 active:scale-95">
                            Present
                        </button>
                        <button onClick={nextMonth} className="p-4 bg-gray-100/50 dark:bg-white/5 shadow-sm rounded-2xl transition-all text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:scale-110 border border-gray-200/50 dark:border-white/10 active:scale-95 group">
                            <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
                
                <div className={`${isMini ? 'p-2 md:p-4' : 'p-4 md:p-8'}`}>
                    <div className="grid grid-cols-7 gap-1 md:gap-4 mb-6 px-4">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-[8px] md:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 md:gap-4">
                        {days}
                    </div>
                </div>
            </div>

            {showDayPopup && selectedDate && (
                <Popup 
                    title={
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">{formattedSelectedDate}</span>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mt-1">{selectedDayTransactions.length} Record Entries</span>
                        </div>
                    }
                    onClose={() => setShowDayPopup(false)}
                    wide
                    zIndex={1500}
                    centered
                >
                    <div className="overflow-y-auto max-h-[60vh] -mx-6 px-6 space-y-2">
                        {selectedDayTransactions.length > 0 ? (
                            selectedDayTransactions.map(tx => (
                                <TransactionRow 
                                    key={tx.firestoreId} 
                                    tx={tx} 
                                    onClick={() => { onEditTx(tx); setShowDayPopup(false); }} 
                                    onFilterClick={onFilterClick}
                                    isGlobalExcluded={excludedCategories.includes(tx.category)}
                                    categoryIcons={categoryIcons}
                                    isSelected={selectedTxIds.includes(tx.firestoreId)}
                                    onSelect={() => onSelectTx(tx.firestoreId)}
                                />
                            ))
                        ) : (
                            <div className="p-20 text-center space-y-6">
                                <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
                                    <History size={32} className="text-gray-300 dark:text-gray-600" />
                                </div>
                                <p className="text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest text-sm">Void Protocol: No records found.</p>
                                <button 
                                    onClick={() => { onEditTx({isNew: true, date: selectedDate}); setShowDayPopup(false); }}
                                    className="px-10 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/20 hover:scale-105 transition-all"
                                >
                                    + Add New Vector
                                </button>
                            </div>
                        )}
                    </div>
                </Popup>
            )}
        </div>
    );
};

const TransactionRow = ({ tx, onClick, onFilterClick, isGlobalExcluded, categoryIcons, isSelected, onSelect }) => {
    const isExcluded = tx.isExcluded || isGlobalExcluded;
    return (
        <div className={`flex justify-between items-center p-6 hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer border-b border-gray-50 dark:border-white/5 last:border-0 transition-all group ${isExcluded ? 'opacity-40 grayscale' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-600/10' : ''}`} onClick={onClick}>
            <div className="flex items-center gap-6">
                <div 
                    onClick={(e) => { e.stopPropagation(); onSelect(!isSelected); }}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 dark:border-white/10 text-transparent'}`}
                >
                    <Check size={14} strokeWidth={4} />
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm ${tx.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white'}`}>
                    {isExcluded ? <EyeOff size={24}/> : (tx.type === 'income' ? <TrendingUp size={24}/> : <TrendingDown size={24}/>)}
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <p className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-tight">
                            {tx.isIndiaCorridor && tx.recipient ? tx.recipient : tx.description}
                        </p>
                        {tx.isIndiaCorridor && tx.recipient && (
                            <span className="text-[9px] bg-blue-600/10 text-blue-600 px-2 py-0.5 rounded-lg font-black uppercase tracking-widest flex items-center gap-1.5 border border-blue-600/20">
                                <Globe size={10}/> India Corridor
                            </span>
                        )}
                        {tx.source && tx.source !== 'Cash' && !tx.isIndiaCorridor && 
                            <span 
                                onClick={(e) => { e.stopPropagation(); onFilterClick('source', tx.source); }}
                                className="text-[9px] bg-gray-100 dark:bg-white/5 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded-lg text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 border border-transparent dark:border-white/5"
                            >
                                <CreditCard size={10}/> {tx.source}
                            </span>
                        }
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Calendar size={12}/> {tx.date}</span>
                        {tx.rate && <span className="text-blue-500 dark:text-blue-400 font-black">₹{tx.rate}/$</span>}
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/10"></span>
                        <span 
                            onClick={(e) => { e.stopPropagation(); onFilterClick('category', tx.category); }}
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            {React.cloneElement(getCategoryIcon(tx.category, 12, categoryIcons), { className: "opacity-70" })}
                            {tx.category}
                        </span>
                        {Array.isArray(tx.tags) && tx.tags.map(tag => (
                            <span 
                                key={tag}
                                onClick={(e) => { e.stopPropagation(); onFilterClick('tag', tag); }}
                                className="text-purple-500 dark:text-purple-400 hover:text-purple-700 transition-colors"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                    {tx.notes && (
                        <div className="flex items-start gap-2 bg-amber-50/50 dark:bg-amber-500/5 p-2 rounded-xl border border-amber-100 dark:border-amber-500/10 max-w-md">
                            <FileInput size={10} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-[9px] font-bold text-amber-800 dark:text-amber-200/70 italic line-clamp-1">{tx.notes}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
                <span className={`font-black px-4 py-1.5 rounded-xl text-xs shadow-sm transition-all group-hover:scale-110 ${tx.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'}`}>
                    {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                </span>
                {tx.category === 'India Transfer' && tx.secondaryAmount && (
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-xl flex items-center gap-2 border border-blue-100 dark:border-blue-500/20 shadow-sm">
                        <Globe size={12} /> ₹{Number(tx.secondaryAmount).toLocaleString('en-IN')}
                    </span>
                )}
            </div>
        </div>
    );
};

const Popup = ({ title, onClose, children, wide, size = 'md', headerAction, zIndex, centered, fullHeight = false }) => {
    const sizeClasses = {
        'sm': 'max-w-md',
        'md': 'max-w-xl',
        'lg': 'max-w-4xl',
        'xl': 'max-w-5xl',
        'wide': 'max-w-[1400px]'
    };
    const maxWidth = wide ? sizeClasses['wide'] : sizeClasses[size];

    return (
        <div
            className={`fixed inset-0 bg-gray-900/40 dark:bg-[#000000]/60 backdrop-blur-xl flex items-end md:items-center justify-center p-4 md:p-8 animate-fade-in ${centered ? '' : 'md:pl-[340px]'}`} 
            style={{ zIndex: zIndex || 10000 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className={`bg-white dark:bg-[#0a0a0a] w-full ${maxWidth} rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh] border border-gray-100 dark:border-white/10 overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center px-10 py-8 border-b border-gray-50 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-4 overflow-hidden">
                        {headerAction}
                        <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase truncate">{title}</div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-all flex items-center justify-center shadow-inner group">
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300"/>   
                    </button>
                </div>
                
                {fullHeight ? (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {children}
                    </div>
                ) : (
                    <div className="p-10 text-gray-700 dark:text-gray-200 overflow-y-auto custom-scrollbar">     
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
};
const CreatableCategorySelect = ({ value, onChange, options, placeholder, inputClassName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localValue, setLocalValue] = useState(null);
    const ref = useRef(null);

    const inputValue = localValue !== null ? localValue : (value || '');

    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o => String(o).toLowerCase().includes(inputValue.toLowerCase()));
    
    const handleSelect = (val) => { 
        setLocalValue(null);
        onChange(val); 
        setIsOpen(false); 
    };

    const handleChange = (e) => { 
        const val = e.target.value;
        setLocalValue(val);
        onChange(val); 
        setIsOpen(true); 
    };

    return (
        <div className="relative w-full" ref={ref}>
            <div className="relative group">
                <input 
                    type="text"
                    className={inputClassName || "w-full bg-gray-50 dark:bg-white/[0.03] p-4 pr-10 rounded-xl font-black text-[10px] uppercase tracking-widest border border-transparent focus:bg-white dark:focus:bg-[#0a0a0a] focus:border-blue-500/30 outline-none transition-all dark:text-white shadow-inner"}
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder || "Index Point..."}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-600 transition-colors pointer-events-none"><ChevronDown size={14}/></div>
            </div>
            {isOpen && filteredOptions.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 overflow-hidden z-[9999] max-h-56 overflow-y-auto p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    {filteredOptions.map(opt => (
                        <div key={opt} onClick={() => handleSelect(opt)} className="p-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-blue-600 hover:text-white rounded-xl transition-all text-gray-600 dark:text-gray-400 m-1">
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CustomDatePicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    const [viewDate, setViewDate] = useState(new Date(value || new Date()));

    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const monthName = viewDate.toLocaleString('default', { month: 'long' });

    const handleDateSelect = (day) => {
        const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        onChange(selected.toISOString().split('T')[0]);
        setIsOpen(false);
    };

    const changeMonth = (offset) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    };

    return (
        <div className="relative w-full" ref={ref}>
            <div onClick={() => setIsOpen(!isOpen)} className="w-full bg-gray-50 dark:bg-white/[0.03] p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex justify-between items-center cursor-pointer border border-transparent hover:border-blue-500/30 transition-all h-[70px] dark:text-white shadow-inner group">
                <div className="flex items-center gap-4">
                    <Calendar size={22} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span>{value ? new Date(value).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}</span>
                </div>
                <ChevronDown size={16} className={`text-gray-400 group-hover:text-blue-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}/>
            </div>
            {isOpen && (
                <div className="absolute top-full mt-3 left-0 w-80 bg-white dark:bg-[#0a0a0a] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 z-[10000] p-6 animate-in fade-in zoom-in duration-200 backdrop-blur-3xl">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all"><ChevronLeft size={18}/></button>
                        <span className="font-black text-[10px] uppercase tracking-[0.2em] dark:text-white">{monthName} {viewDate.getFullYear()}</span>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all"><ChevronRight size={18}/></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[8px] font-black text-gray-400">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({length: firstDay}).map((_, i) => <div key={`e-${i}`} />)}
                        {Array.from({length: daysInMonth}).map((_, i) => {
                            const d = i + 1;
                            const isSelected = value === new Date(viewDate.getFullYear(), viewDate.getMonth(), d).toISOString().split('T')[0];
                            return (
                                <button key={d} onClick={() => handleDateSelect(d)} className={`aspect-square flex items-center justify-center rounded-xl text-[10px] font-black transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-blue-600'}`}>{d}</button>
                            );
                        })}
                    </div>
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
            <div onClick={() => setIsOpen(!isOpen)} className="w-full bg-gray-100/50 dark:bg-white/5 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex justify-between items-center cursor-pointer border border-gray-200/50 dark:border-white/10 hover:border-blue-500/30 transition-all h-[60px] dark:text-white shadow-sm group">
                {selectedLabel} 
                <ChevronDown size={16} className={`text-gray-400 group-hover:text-blue-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}/>
            </div>
            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 overflow-hidden z-[9999] p-1 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-3xl">
                    {options.map(opt => (
                        <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`p-4 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all rounded-xl m-1 ${value === opt.value ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-blue-600'}`}>
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
        <div className={`relative ${isOpen ? 'z-[100]' : 'z-[50]'}`} ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-gray-100/50 dark:bg-white/5 hover:bg-gray-200/50 dark:hover:bg-white/10 font-black text-[9px] md:text-[10px] uppercase tracking-widest text-gray-700 dark:text-gray-200 min-w-0 md:min-w-[120px] justify-between transition-all border border-gray-200/50 dark:border-white/10 shadow-sm group">
                <span className="truncate max-w-[80px] md:max-w-none">{options.find(o => o.value === value)?.label}</span>
                <ChevronDown size={12} className={`text-gray-400 group-hover:text-blue-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            {isOpen && (
                <div className="absolute top-full mt-3 right-0 w-48 bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-white/10 max-h-64 overflow-y-auto z-[99999] p-2 animate-in fade-in zoom-in duration-200 backdrop-blur-3xl">
                    {options.map(opt => (
                        <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all mb-1 last:mb-0 ${value === opt.value ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-blue-600'}`}>{opt.label}</button>
                    ))}
                </div>
            )}
        </div>
    );
};

const TransactionForm = ({ initialData, onSave, onDelete, allCategories, allSources, allTags, isCategoryExcluded }) => {
    const [formData, setFormData] = useState({ 
        id: initialData.firestoreId || null, 
        date: initialData.date || new Date().toISOString().split('T')[0], 
        desc: initialData.description || '', 
        amount: initialData.amount || '', 
        secondaryAmount: initialData.secondaryAmount || '',
        notes: initialData.notes || '',
        type: initialData.type || 'expense', 
        mode: initialData.mode || 'money', 
        category: initialData.category || '',
        source: initialData.source || '',
        tags: Array.isArray(initialData.tags) ? initialData.tags : [],
        isExcluded: initialData.isExcluded || false
    });
    const [manuallyChangedCat, setManuallyChangedCat] = useState(false);

    const handleDescChange = (e) => {
        const newDesc = e.target.value;
        let newFormData = { ...formData, desc: newDesc };
        
        if (!manuallyChangedCat && newDesc.length > 2 && !initialData.id) {
            const detected = detectCategory(newDesc);
            if (detected) newFormData.category = detected;
        }
        
        setFormData(newFormData);
    };

    const handleCatChange = (val) => {
        setFormData(prev => ({ ...prev, category: val }));
        setManuallyChangedCat(true); 
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Top Bar: Date & Exclude Toggle */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Archive Date</label>
                    <CustomDatePicker value={formData.date} onChange={date => setFormData({...formData, date})} />
                </div>
                <div className="flex-1 flex items-end">
                    <button 
                        onClick={() => setFormData(p => ({...p, isExcluded: !p.isExcluded}))}
                        className={`w-full h-[70px] rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl ${isCategoryExcluded ? 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed' : (formData.isExcluded ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600')}`}
                        disabled={isCategoryExcluded}
                    >
                        {isCategoryExcluded ? <><EyeOff size={20}/> Locked by Vector</> : (formData.isExcluded ? <><EyeOff size={20}/> Purged View</> : <><Eye size={20}/> Active View</>)}
                    </button>
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Descriptor</label>
                <input className="w-full bg-gray-50 dark:bg-white/[0.03] border border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-[#0a0a0a] p-6 rounded-2xl font-black text-sm uppercase tracking-widest outline-none dark:text-white transition-all shadow-inner" placeholder="Identify transaction stream..." value={formData.desc} onChange={handleDescChange} />
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className={`${formData.category === 'India Transfer' ? 'md:w-1/3' : 'md:w-1/2'} w-full space-y-2`}>
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Magnitude ($)</label>
                    <input type="number" className="w-full bg-gray-50 dark:bg-white/[0.03] border border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-[#0a0a0a] p-6 rounded-2xl text-xl font-black outline-none h-[70px] dark:text-white transition-all shadow-inner [color-scheme:light] dark:[color-scheme:dark]" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                {formData.category === 'India Transfer' && (
                    <div className="md:w-1/3 w-full space-y-2">
                        <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Globe size={12}/> Conversion (₹)</label>
                        <input type="number" className="w-full bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 p-6 rounded-2xl text-xl font-black outline-none h-[70px] text-blue-700 dark:text-blue-400 transition-all placeholder:text-blue-300 shadow-inner" placeholder="₹0" value={formData.secondaryAmount} onChange={e => setFormData({...formData, secondaryAmount: e.target.value})} />
                    </div>
                )}
                <div className={`${formData.category === 'India Transfer' ? 'md:w-1/3' : 'md:w-1/2'} w-full space-y-2`}>
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Flow Direction</label>
                    <StyledSelect value={formData.type} onChange={(v) => setFormData({...formData, type: v})} options={[{value: 'expense', label: 'OUTFLOW'}, {value: 'income', label: 'INFLOW'}]} />
                </div>
            </div>

            {/* Source & Tags (Smart Dropdowns) */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/2 w-full space-y-2">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Origin Source</label>
                    <CreatableCategorySelect value={formData.source} onChange={(v) => setFormData({...formData, source: v})} options={allSources} placeholder="Assign Source..." />
                </div>
                <div className="md:w-1/2 w-full space-y-2">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Metadata Tags</label>
                    <CreatableCategorySelect value={formData.tags[0] || ''} onChange={(v) => setFormData({...formData, tags: [v]})} options={allTags} placeholder="Assign Tags..." />
                </div>
            </div>

            <div className="space-y-2 pb-4">
                 <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Vector Category</label>
                 <CreatableCategorySelect value={formData.category} onChange={handleCatChange} options={allCategories} />
            </div>

            <div className="space-y-2 pb-4">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Archive Notes</label>
                <textarea 
                    className="w-full bg-gray-50 dark:bg-white/[0.03] border border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-[#0a0a0a] p-6 rounded-2xl font-bold text-xs outline-none dark:text-white transition-all shadow-inner min-h-[120px] resize-none" 
                    placeholder="Append additional intelligence or context..." 
                    value={formData.notes} 
                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                />
            </div>
            
            <div className="pt-6 border-t dark:border-white/5 flex flex-col gap-4">
                <button onClick={() => onSave(formData)} className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/30 hover:scale-[1.02] active:scale-95 transition-all">
                    {formData.id ? 'Authorize Updates' : 'Initialize Record Entry'}
                </button>
                {onDelete && (
                    <button onClick={onDelete} className="w-full text-rose-500 dark:text-rose-400 py-3 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all">
                        Purge Request
                    </button>
                )}
            </div>
        </div>
    );
};

const IndiaTransferForm = ({ initialData, onSave, onDelete, allRecipients }) => {
    const [formData, setFormData] = useState({
        id: initialData.firestoreId || null,
        date: initialData.date || new Date().toISOString().split('T')[0],
        desc: initialData.description || 'USD to INR Transfer',
        amount: initialData.amount || '',
        rate: initialData.rate || '',
        secondaryAmount: initialData.secondaryAmount || '',
        recipient: initialData.recipient || '',
        notes: initialData.notes || '',
        isExcluded: initialData.isExcluded || false,
        isIndiaCorridor: true,
        type: 'expense',
        mode: 'money',
        category: 'India Transfer'
    });

    const handleUsdChange = (val) => {
        setFormData(prev => {
            const next = { ...prev, amount: val };
            const v = parseFloat(val);
            const r = parseFloat(prev.rate);
            const i = parseFloat(prev.secondaryAmount);
            if (!isNaN(v) && !isNaN(r)) {
                next.secondaryAmount = (v * r).toFixed(2);
            } else if (!isNaN(v) && !isNaN(i) && v !== 0) {
                next.rate = (i / v).toFixed(2);
            }
            return next;
        });
    };

    const handleRateChange = (val) => {
        setFormData(prev => {
            const next = { ...prev, rate: val };
            const r = parseFloat(val);
            const v = parseFloat(prev.amount);
            const i = parseFloat(prev.secondaryAmount);
            if (!isNaN(r) && !isNaN(v)) {
                next.secondaryAmount = (v * r).toFixed(2);
            } else if (!isNaN(r) && !isNaN(i) && r !== 0) {
                next.amount = (i / r).toFixed(2);
            }
            return next;
        });
    };

    const handleInrChange = (val) => {
        setFormData(prev => {
            const next = { ...prev, secondaryAmount: val };
            const i = parseFloat(val);
            const v = parseFloat(prev.amount);
            const r = parseFloat(prev.rate);
            if (!isNaN(i) && !isNaN(v) && v !== 0) {
                next.rate = (i / v).toFixed(2);
            } else if (!isNaN(i) && !isNaN(r) && r !== 0) {
                next.amount = (i / r).toFixed(2);
            }
            return next;
        });
    };

    return (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Transfer Date</label>
                            <CustomDatePicker value={formData.date} onChange={date => setFormData({...formData, date})} />
                        </div>
                        <div className="flex-1 flex items-end">
                            <button 
                                onClick={() => setFormData(p => ({...p, isExcluded: !p.isExcluded}))}
                                className={`w-full h-[70px] rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl ${formData.isExcluded ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600'}`}
                            >
                                {formData.isExcluded ? <><EyeOff size={20}/> Hidden Protocol</> : <><Eye size={20}/> Visible Hub</>}
                            </button>
                        </div>
                    </div>
        
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Recipient Identifier</label>
                        <CreatableCategorySelect 
                            value={formData.recipient}
                            onChange={val => setFormData({...formData, recipient: val})} 
                            options={allRecipients} 
                            placeholder="Who is receiving the capital? (e.g. Self, Family)"
                            inputClassName="w-full bg-gray-50 dark:bg-white/[0.03] border border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-[#0a0a0a] p-6 rounded-2xl font-black text-sm uppercase tracking-widest outline-none dark:text-white transition-all shadow-inner"
                        />
                    </div>
        
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Capital (USD)</label>
                    <input 
                        type="number" 
                        className="w-full bg-gray-50 dark:bg-white/[0.03] border border-transparent focus:border-blue-500/30 p-6 rounded-2xl text-xl font-black outline-none h-[70px] dark:text-white shadow-inner" 
                        placeholder="0.00" 
                        value={formData.amount} 
                        onChange={e => handleUsdChange(e.target.value)} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Dollar Rate (₹)</label>
                    <input 
                        type="number" 
                        className="w-full bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 p-6 rounded-2xl text-xl font-black outline-none h-[70px] text-blue-700 dark:text-blue-400 shadow-inner" 
                        placeholder="0.00" 
                        value={formData.rate} 
                        onChange={e => handleRateChange(e.target.value)} 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">Received (INR)</label>
                    <input 
                        type="number" 
                        className="w-full bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 p-6 rounded-2xl text-xl font-black outline-none h-[70px] text-emerald-700 dark:text-emerald-400 shadow-inner" 
                        placeholder="0.00" 
                        value={formData.secondaryAmount} 
                        onChange={e => handleInrChange(e.target.value)} 
                    />
                </div>
            </div>

            <div className="space-y-2 pb-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Transfer Intelligence</label>
                <textarea 
                    className="w-full bg-gray-50 dark:bg-white/[0.03] border border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-[#0a0a0a] p-6 rounded-2xl font-bold text-xs outline-none dark:text-white transition-all shadow-inner min-h-[120px] resize-none" 
                    placeholder="Append transfer notes or context..." 
                    value={formData.notes} 
                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                />
            </div>

            <div className="pt-6 border-t dark:border-white/5 flex flex-col gap-4">
                <button onClick={() => onSave(formData)} className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-blue-600/30 hover:scale-[1.02] active:scale-95 transition-all">
                    {formData.id ? 'Authorize Corridor Update' : 'Initialize India Transfer'}
                </button>
                {onDelete && (
                    <button onClick={onDelete} className="w-full text-rose-500 dark:text-rose-400 py-3 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all">
                        Purge Record
                    </button>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ label, amount, color, icon, onClick }) => ( 
    <div onClick={onClick} className={`${color} p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group transition-all hover:scale-[1.02] cursor-pointer`}>
        <div className="absolute right-[-10px] top-[-10px] opacity-20 group-hover:scale-110 transition-transform duration-700">{icon}</div>
        <div className="relative z-10">
            <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-2">{label}</p>
            <p className="text-4xl font-black tracking-tighter text-white">${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
    </div> 
);
const FeatureCard = ({ icon, title, desc }) => (
    <div className="bg-white/[0.03] dark:bg-white/[0.02] border border-white/10 dark:border-white/5 p-10 rounded-[3rem] hover:bg-white/[0.05] dark:hover:bg-white/[0.04] hover:border-white/20 dark:hover:border-white/10 transition-all group shadow-xl backdrop-blur-3xl">
        <div className="mb-8 group-hover:scale-110 transition-transform duration-500">{icon}</div>
        <h3 className="text-xl font-black mb-4 tracking-widest uppercase text-gray-900 dark:text-white">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 font-bold leading-relaxed text-sm">{desc}</p>
    </div>
);

const LoginScreen = ({ onLogin }) => {
    return (
        <div className="min-h-screen bg-white dark:bg-[#050505] text-gray-900 dark:text-white selection:bg-blue-500 selection:text-white overflow-x-hidden transition-colors duration-700">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 dark:bg-blue-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-600/5 dark:bg-emerald-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Navigation */}
            <nav className="relative z-50 flex items-center justify-between px-6 md:px-12 py-8 max-w-7xl mx-auto">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 text-white font-black italic group-hover:rotate-6 transition-transform">TL</div>
                    <span className="text-2xl font-black tracking-tighter">TabLife.</span>
                </div>
                <button 
                    onClick={onLogin} 
                    className="group flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gray-200 dark:shadow-white/5 uppercase tracking-widest"
                >
                    Get Started <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-20 pb-32 px-6 max-w-7xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-md animate-fade-in">
                    <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">The Future of Personal Finance</span>
                </div>
                
                <div className="relative inline-block">
                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 animate-slide-up relative">
                        MASTER YOUR MONEY <br /> 
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 uppercase">WITH PRECISION.</span>
                    </h1>
                </div>
                
                <p className="max-w-2xl mx-auto text-gray-500 dark:text-gray-400 text-lg md:text-xl font-medium leading-relaxed mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    TabLife combines ultra-wide data visualization with intelligent parsing to turn your messy financial statements into a clear path toward wealth.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <button 
                        onClick={onLogin} 
                        className="w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2.5xl font-black text-lg transition-all shadow-2xl shadow-blue-600/30 uppercase tracking-widest hover:scale-105 active:scale-95"
                    >
                        Sign in with Google
                    </button>
                    <button className="w-full sm:w-auto bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 px-10 py-5 rounded-2.5xl font-black text-lg dark:text-white transition-all backdrop-blur-xl uppercase tracking-widest">
                        View Demo
                    </button>
                </div>
            </section>

            {/* Proof Section / Mock UI */}
            <section className="relative z-10 px-6 max-w-7xl mx-auto mb-32">
                <div className="relative group">
                    <div className="absolute inset-0 bg-blue-600/20 blur-[100px] group-hover:bg-blue-600/30 transition-all duration-1000 scale-90"></div>
                    <div className="relative bg-gray-50 dark:bg-[#0a0a0a] rounded-[3rem] border border-gray-200 dark:border-white/10 p-4 shadow-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9]">
                        {/* Mock Header */}
                        <div className="flex items-center gap-2 mb-4 px-4 pt-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                            </div>
                            <div className="ml-4 flex-1 h-6 bg-gray-200/50 dark:bg-white/5 rounded-full border border-gray-200 dark:border-white/5"></div>
                        </div>
                        {/* Mock Content */}
                        <div className="grid grid-cols-12 gap-4 h-full p-4">
                            <div className="col-span-3 rounded-2xl bg-gray-200/30 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 p-4 space-y-4">
                                <div className="h-8 w-3/4 bg-gray-300 dark:bg-white/10 rounded-lg"></div>
                                <div className="h-4 w-full bg-gray-200 dark:bg-white/5 rounded-lg"></div>
                                <div className="h-4 w-full bg-gray-200 dark:bg-white/5 rounded-lg"></div>
                                <div className="h-4 w-2/3 bg-gray-200 dark:bg-white/5 rounded-lg"></div>
                                <div className="pt-8 space-y-3">
                                    <div className="h-10 w-full bg-blue-600/20 border border-blue-600/30 rounded-xl"></div>
                                    <div className="h-10 w-full bg-gray-200 dark:bg-white/5 rounded-xl"></div>
                                    <div className="h-10 w-full bg-gray-200 dark:bg-white/5 rounded-xl"></div>
                                </div>
                            </div>
                            <div className="col-span-9 space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="h-32 bg-emerald-600/10 border border-emerald-600/20 rounded-3xl p-4">
                                        <div className="h-4 w-1/2 bg-emerald-400/20 rounded mb-2"></div>
                                        <div className="h-8 w-3/4 bg-emerald-400/20 dark:bg-white/20 rounded-lg"></div>
                                    </div>
                                    <div className="h-32 bg-rose-600/10 border border-rose-600/20 rounded-3xl p-4">
                                        <div className="h-4 w-1/2 bg-rose-400/20 rounded mb-2"></div>
                                        <div className="h-8 w-3/4 bg-rose-400/20 dark:bg-white/20 rounded-lg"></div>
                                    </div>
                                    <div className="h-32 bg-gray-200/30 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-3xl p-4">
                                        <div className="h-4 w-1/2 bg-gray-300 dark:bg-white/10 rounded mb-2"></div>
                                        <div className="h-8 w-3/4 bg-gray-300 dark:bg-white/20 rounded-lg"></div>
                                    </div>
                                </div>
                                <div className="h-full bg-gray-200/20 dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/5 rounded-3xl p-8 flex items-end gap-2 justify-between">
                                    {[40, 70, 45, 90, 65, 80, 35, 50, 85, 60].map((h, i) => (
                                        <div key={i} className="flex-1 bg-gradient-to-t from-blue-600/40 to-blue-400/20 rounded-t-xl transition-all duration-1000 origin-bottom" style={{ height: `${h}%` }}></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Floating Cards */}
                    <div className="absolute top-[10%] right-[-5%] hidden xl:block animate-float">
                        <div className="bg-white/80 dark:bg-white/10 backdrop-blur-2xl border border-gray-200 dark:border-white/20 p-6 rounded-3xl shadow-2xl w-64">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white"><TrendingUp size={24} /></div>
                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase">Savings</p>
                                    <p className="text-xl font-black">+24.8%</p>
                                </div>
                            </div>
                            <div className="h-2 w-full bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full w-[70%] bg-emerald-500"></div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-[10%] left-[-5%] hidden xl:block animate-float" style={{ animationDelay: '1s' }}>
                        <div className="bg-white/80 dark:bg-white/10 backdrop-blur-2xl border border-gray-200 dark:border-white/20 p-6 rounded-3xl shadow-2xl w-64">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white"><UploadCloud size={24} /></div>
                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase">Auto-Parse</p>
                                    <p className="text-xl font-black">CSV / PDF</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="px-3 py-1 bg-gray-200 dark:bg-white/10 rounded-lg text-[10px] font-black uppercase">XLSX</div>
                                <div className="px-3 py-1 bg-gray-200 dark:bg-white/10 rounded-lg text-[10px] font-black uppercase">PDF</div>
                                <div className="px-3 py-1 bg-gray-200 dark:bg-white/10 rounded-lg text-[10px] font-black uppercase">TXT</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="relative z-10 py-32 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-4 text-gray-900 dark:text-white">Hyper-Growth Analytics</h2>
                    <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">Engineered for the Modern Investor</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard icon={<Cpu className="text-blue-600 dark:text-blue-400" size={32} />} title="Intelligent Parsing" desc="Drop your statements and let our algorithms extract date, vendor, amount, and category instantly." />
                    <FeatureCard icon={<Monitor className="text-purple-600 dark:text-purple-400" size={32} />} title="Ultra-Wide Visuals" desc="Designed for modern workstations. Experience immersive charts that reveal long-term trends." />
                    <FeatureCard icon={<Shield className="text-emerald-600 dark:text-emerald-400" size={32} />} title="Privacy Focused" desc="Your data is yours. Using Firebase's enterprise-grade security, everything is encrypted and private." />
                    <FeatureCard icon={<Layers className="text-amber-600 dark:text-amber-400" size={32} />} title="Multi-Dimensional" desc="Filter by tag, payment source, or custom category. Drill down into every cent with a single click." />
                    <FeatureCard icon={<Calendar className="text-rose-600 dark:text-rose-400" size={32} />} title="Calendar Insights" desc="View your spending habits over a monthly grid to identify cycles and peak activity days." />
                    <FeatureCard icon={<MousePointer2 className="text-indigo-600 dark:text-indigo-400" size={32} />} title="Direct Interaction" desc="Edit transactions directly in line. Create new categories on the fly. TabLife adapts to you." />
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-gray-100 dark:border-white/5 py-20 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12 text-gray-900 dark:text-white">
                    <div className="flex flex-col items-center md:items-start space-y-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center font-black italic">TL</div>
                            <span className="text-xl font-black tracking-tighter">TabLife.</span>
                        </div>
                        <p className="max-w-xs text-gray-400 font-medium text-sm text-center md:text-left leading-relaxed uppercase tracking-widest text-[10px]">The modern financial dashboard for high-performers.</p>
                        <p className="pt-8 text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] italic">© 2026 Asish Madhavaram. All rights reserved.</p>
                    </div>
                    <div className="flex gap-12 text-center md:text-left">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Product</p>
                            <div className="flex flex-col gap-2 text-sm font-bold">
                                <a href="#" className="hover:text-blue-600 transition-colors">Security</a>
                                <a href="#" className="hover:text-blue-600 transition-colors">Pricing</a>
                                <a href="#" className="hover:text-blue-600 transition-colors">Documentation</a>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Legal</p>
                            <div className="flex flex-col gap-2 text-sm font-bold">
                                <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
                                <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const SidebarItem = ({ icon, label, active, onClick }) => ( 
    <button 
        onClick={onClick} 
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 relative group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 hover:translate-x-1'}`}
    >
        {icon} {label} 
        {active && <div className="absolute right-4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff]"></div>}
    </button> 
);

const PageHeader = ({ icon, title, subtitle, badges = [], actions = [], filters = null }) => (
    <div className="col-span-12 flex flex-col 3xl:flex-row justify-between items-start 3xl:items-end gap-6 md:gap-10 mb-2 relative z-[100] w-full px-1">
        <div className="space-y-4 w-full">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-600 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-600/20 shrink-0">
                    {icon}
                </div>
                <div>
                    <h2 className="text-4xl md:text-7xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none">{title}</h2>
                </div>
            </div>
            <div className="flex flex-nowrap items-center gap-2 mt-2 md:mt-4 overflow-x-auto no-scrollbar pb-1">
                {badges.map((badge, i) => (
                    <div key={i} className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full ${badge.color || 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'} flex items-center gap-2 shadow-sm shrink-0`}>
                        {badge.pulse && <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${badge.pulseColor || 'bg-blue-600'} animate-pulse`}></div>}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${badge.textColor || 'text-gray-500 dark:text-gray-400'}`}>{badge.label}</span>
                    </div>
                ))}
            </div>
            <p className="text-xs md:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] md:tracking-[0.4em] ml-1 mt-2 md:mt-4">{subtitle}</p>
            
            {actions.length > 0 && (
                <div className="bg-gray-100/50 dark:bg-white/5 p-2 md:p-0 md:bg-transparent md:dark:bg-transparent rounded-3xl border border-gray-200/50 dark:border-white/5 md:border-0 flex flex-row items-center gap-2 md:gap-4 mt-4 md:mt-8 overflow-x-auto no-scrollbar shadow-inner md:shadow-none">
                    {actions.map((action, i) => (
                        <button key={i} onClick={action.onClick} className={`px-5 md:px-8 py-3.5 md:py-4 ${action.className || 'bg-gray-900 dark:bg-white text-white dark:text-black'} rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2 shrink-0`}>
                            {action.icon} <span>{action.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
        <div className="flex flex-row items-center gap-2 order-1 3xl:order-2 w-full 3xl:w-auto overflow-visible pb-2 md:pb-0">
            {filters}
        </div>
    </div>
);

const MetricCapsule = ({ label, amount, color, icon, bgColor, borderColor, onClick }) => {
    const isEmerald = color.includes('emerald');
    const isRose = color.includes('rose');
    const lineBg = isEmerald ? 'bg-emerald-500' : (isRose ? 'bg-rose-500' : 'bg-blue-600');
    
    return (
        <div onClick={onClick} className={`flex-1 min-w-[240px] md:min-w-[280px] ${bgColor} backdrop-blur-3xl border-2 ${borderColor} px-6 md:px-12 py-6 md:py-8 rounded-[2.5rem] md:rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] cursor-pointer group transition-all hover:scale-[1.05] hover:shadow-[0_30px_70px_rgba(0,0,0,0.2)] relative overflow-hidden active:scale-95`}>
            <div className="absolute right-[-15px] top-[-15px] opacity-10 group-hover:scale-150 transition-all duration-1000 group-hover:rotate-12 hidden md:block">{icon}</div>
            <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-3">
                    <div className={`${color} group-hover:scale-110 transition-transform scale-75 md:scale-100`}>{icon}</div>
                    <p className="text-[9px] md:text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] md:tracking-[0.4em] truncate">{label}</p>
                </div>
                <p className={`text-3xl md:text-5xl font-black tracking-tighter ${color} leading-none break-all`}>${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
            <div className={`absolute bottom-0 left-0 h-2 ${lineBg} opacity-0 group-hover:opacity-100 transition-all duration-500 w-0 group-hover:w-full`}></div>
        </div>
    );
};

const QuickStat = ({ label, value, color, prefix = '', isCurrency = true }) => (
    <div className="bg-gray-50 dark:bg-white/[0.03] backdrop-blur-3xl p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl transition-all hover:bg-gray-100 dark:hover:bg-white/[0.06]">
        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">{label}</p>
        <p className={`text-3xl font-black tracking-tighter leading-none ${color}`}>{prefix}{isCurrency ? formatCurrency(value) : value}</p>
    </div>
);

const MobileNavItem = ({ icon, label, active, onClick }) => ( <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-blue-600' : 'text-gray-300 dark:text-gray-600'}`}>{icon} <span className="text-[10px] font-bold">{label}</span></button> );

export default App;
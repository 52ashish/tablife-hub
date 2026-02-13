// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc,
  getDoc,
  setDoc,
  writeBatch, // New
  where,      // New
  getDocs     // New
} from "firebase/firestore";

// --- PASTE YOUR FIREBASE CONFIG OBJECT BELOW ---
const firebaseConfig = {
  apiKey: "AIzaSyChTjt1ZCsdU6Oysv0Lesi4KCp7joyHm3Y",
  authDomain: "tablife-2398c.firebaseapp.com",
  projectId: "tablife-2398c",
  storageBucket: "tablife-2398c.firebasestorage.app",
  messagingSenderId: "1074426677124",
  appId: "1:1074426677124:web:1679264fce1c5760a13fd1",
  measurementId: "G-GVX5XQHDL2"
};
// ------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { 
  db, auth, provider, signInWithPopup, signOut, 
  collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, 
  getDoc, setDoc, writeBatch, where, getDocs 
};
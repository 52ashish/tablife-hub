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
  writeBatch,
  where,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

// Firebase configuration using environment variables for security.
// Ensure VITE_FIREBASE_* variables are set in your .env file.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
console.log("Firebase Config check (API Key exists):", !!firebaseConfig.apiKey, "Auth Domain:", firebaseConfig.authDomain);

// ------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { 
  db, auth, provider, signInWithPopup, signOut, 
  collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, 
  getDoc, setDoc, writeBatch, where, getDocs, serverTimestamp 
};
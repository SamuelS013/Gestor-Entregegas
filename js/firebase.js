// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCsHE-Ee3wLKWRz_Lz4nEXAiuF50JZFkno",
  authDomain: "gestor-fiado.firebaseapp.com",
  databaseURL: "https://gestor-fiado-default-rtdb.firebaseio.com",
  projectId: "gestor-fiado",
  storageBucket: "gestor-fiado.firebasestorage.app",
  messagingSenderId: "1020356204799",
  appId: "1:1020356204799:web:48991a7bb41393f14054ca"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

const auth = getAuth(app);

export const iniciarSesionAnonima = async () => {
  const usuarioActual = await new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });

  if (usuarioActual) return;

  await signInAnonymously(auth);
  console.log("Sesión anónima iniciada correctamente.");
};
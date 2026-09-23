// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
export const db = getFirestore(app);

const auth = getAuth(app);

export const iniciarSesionAnonima = () => {
  return new Promise((resolve, reject) => {
    signInAnonymously(auth)
      .then(() => {
        console.log("Sesión anónima iniciada correctamente.");
        resolve();
      })
      .catch((error) => {
        console.error("Error al iniciar sesión anónima:", error);
        reject(error);
      });
  });
};
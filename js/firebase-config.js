import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Cloudinary use karenge, isliye Firebase Storage abhi required nahi hai.
// import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";


export const firebaseConfig = {
  apiKey: "AIzaSyDJjVl-FE2Z8lN_nZ9mBGpatl7h7fGj7gI",
  authDomain: "veranda-d38e4.firebaseapp.com",
  projectId: "veranda-d38e4",
  storageBucket: "veranda-d38e4.firebasestorage.app",
  messagingSenderId: "138869163345",
  appId: "1:138869163345:web:6263deffa2553980a37f70",
  measurementId: "G-Q6J1Q1QR86"
};


/* Firestore collection names */
export const DB = {
  properties: "properties",
  users: "users",
  enquiries: "enquiries"
};


/* Check Firebase configuration */
export function isConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
  );
}


/* Initialize Firebase */
const app = initializeApp(firebaseConfig);


/* Firebase Authentication */
export const auth = getAuth(app);


/* Cloud Firestore */
export const db = getFirestore(app);
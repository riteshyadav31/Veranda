import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";


export const firebaseConfig = {
  apiKey: "AIzaSyDJjVl-FE2Z8lN_nZ9mBGpatl7h7fGj7gI",
  authDomain: "veranda-d38e4.firebaseapp.com",
  projectId: "veranda-d38e4",
  storageBucket: "veranda-d38e4.firebasestorage.app",
  messagingSenderId: "138869163345",
  appId: "1:138869163345:web:6263deffa2553980a37f70",
  measurementId: "G-Q6J1Q1QR86"
};

/** Collection and storage paths used across the app. */
export const DB = {
  properties: "properties",
  users: "users",
  enquiries: "enquiries",
  imagesPath: "property-images"
};

/** True once real credentials have been filled in above. */
export function isConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
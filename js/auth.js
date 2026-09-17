/**
 * auth.js
 * Firebase Authentication + login/register functionality.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db, DB } from "./firebase-config.js";
import { qs, qsa, onReady } from "./utils.js";

export const VALID_ROLES = ["buyer", "seller"];

export function normalizeRole(value) {
  return value === "seller" ? "seller" : "buyer";
}

function showPanel(name) {
  qsa("[data-auth-tab]").forEach((tab) => {
    const active = tab.dataset.authTab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  qsa("[data-auth-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.authPanel !== name;
  });
}

function setupTabs() {
  const tabs = qsa("[data-auth-tab]");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      showPanel(tab.dataset.authTab);
    });
  });

  if (window.location.hash === "#register") {
    showPanel("register");
  }
}

export function describeError(error) {
  if (!error) {
    return "Something went wrong.";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-email":
      return "Please enter a valid email.";
    case "auth/user-not-found":
      return "User not found.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/operation-not-allowed":
      return "Email/password authentication is not enabled in Firebase.";
    default:
      return error.message || "Something went wrong.";
  }
}

export async function register(name, email, password, phone = "", role = "buyer") {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const safeRole = normalizeRole(role);

    await setDoc(doc(db, DB.users, user.uid), {
      uid: user.uid,
      name,
      email: user.email,
      phone,
      role: safeRole,
      favorites: [],
      createdAt: serverTimestamp()
    });

    return user;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid = auth.currentUser?.uid) {
  if (!uid) return null;

  const snapshot = await getDoc(doc(db, DB.users, uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function getUserRole(uid = auth.currentUser?.uid) {
  const profile = await getUserProfile(uid);
  return normalizeRole(profile?.role);
}

export function guardPage() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();

      if (!user) {
        const currentPage = window.location.pathname.split("/").pop() || "index.html";
        window.location.replace(`login.html?next=${encodeURIComponent(currentPage)}`);
        resolve(null);
        return;
      }

      resolve(user);
    });
  });
}

export async function requireRole(allowedRoles, redirectPath = "dashboard.html") {
  const user = await guardPage();
  if (!user) return null;

  const role = await getUserRole(user.uid);
  if (!allowedRoles.includes(role)) {
    window.location.replace(redirectPath);
    return null;
  }

  return { user, role };
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Password reset error:", error);
    throw error;
  }
}

function setupForms() {
  const status = qs("[data-auth-status]");

  qsa("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const formType = form.dataset.authForm;

      try {
        if (formType === "register") {
          const name = qs("[name='name']", form)?.value.trim();
          const email = qs("[name='email']", form)?.value.trim();
          const phone = qs("[name='phone']", form)?.value.trim() || "";
          const password = qs("[name='password']", form)?.value;
          const role = normalizeRole(qs("[name='role']", form)?.value);

          if (!name || !email || !password) {
            if (status) status.textContent = "Please fill all required fields.";
            return;
          }

          if (status) status.textContent = "Creating account...";

          await register(name, email, password, phone, role);

          if (status) status.textContent = "Account created successfully!";

          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 800);
        } else if (formType === "login") {
          const email = qs("[name='email']", form)?.value.trim();
          const password = qs("[name='password']", form)?.value;

          if (!email || !password) {
            if (status) status.textContent = "Please enter email and password.";
            return;
          }

          if (status) status.textContent = "Signing in...";

          await signIn(email, password);

          if (status) status.textContent = "Login successful!";

          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 500);
        }
      } catch (error) {
        console.error(error);

        if (status) {
          status.textContent = describeError(error);
        }
      }
    });
  });
}

onReady(() => {
  setupTabs();
  setupForms();
});
/**
 * auth.js — login.html and, later, every page that needs the signed-in user.
 * Step 1: tab switching between the sign-in and register panels. No Firebase
 * Authentication calls yet.
 */

import { qs, qsa, onReady } from "./utils.js";
import "./navbar.js";
// Credentials live in firebase-config.js and are read in Step 2.
// import { firebaseConfig } from "./firebase-config.js";

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
    tab.addEventListener("click", () => showPanel(tab.dataset.authTab));
  });
  // Open the register panel directly via login.html#register
  if (window.location.hash === "#register") showPanel("register");
}

function setupForms() {
  const status = qs("[data-auth-status]");
  qsa("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (status) status.textContent = "Accounts are connected in the next step.";
      // signIn() / register() — Step 2
    });
  });
}

/** Placeholder: Firebase email/password sign-in. */
export function signIn(/* email, password */) {}

/** Placeholder: Firebase account creation. */
export function register(/* name, email, password */) {}

/** Placeholder: Firebase sign-out. */
export function signOut() {}

/** Placeholder: subscribes to auth state so the navbar can react. */
export function watchAuthState(/* callback */) {}

onReady(() => {
  setupTabs();
  setupForms();
});

export function describeError(error) {
  if (!error) return "Something went wrong.";

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

    default:
      return error.message || "Something went wrong.";
  }}

/**
 * dashboard.js — dashboard.html
 * Shows only the signed-in user's properties, and lets them edit or delete
 * their own listings. Every query is scoped to auth.currentUser.uid.
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db, DB, isConfigured } from "./firebase-config.js";
import { guardPage, getUserProfile, describeError } from "./auth.js";
import "./navbar.js";
import {
  qs,
  qsa,
  onReady,
  escapeHtml,
  renderState,
  renderLoading,
  formatPriceShort,
  formatDate,
  toDate,
  photoMarkup,
  wirePhotoFallbacks,
  showToast,
  typeLabel,
  listingLabel,
  primaryImage
} from "./utils.js";

let myProperties = [];

/* -------------------------------------------------------------------------
   Panels and user card
   ------------------------------------------------------------------------- */

function setupPanels() {
  const links = qsa("[data-dash-link]");
  const panels = qsa("[data-dash-panel]");
  if (!links.length || !panels.length) return;

  const activate = (target) => {
    links.forEach((link) =>
      link.classList.toggle("is-active", link.dataset.dashLink === target && link.closest(".dash__menu") !== null)
    );
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.dashPanel !== target;
    });
  };

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = link.dataset.dashLink;
      if (!target) return;
      event.preventDefault();
      activate(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

/** Show the signed-in user in the sidebar. */
function fillUserCard(user, profile) {
  const nameEl = qs("[data-user-name]");
  const emailEl = qs("[data-user-email]");
  const avatar = qs(".avatar");
  const name = profile?.name || user.displayName || "Your account";

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = user.email || "";
  if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase() || "V";
}

/* -------------------------------------------------------------------------
   Data
   ------------------------------------------------------------------------- */

/**
 * Fetch the listings owned by this uid. Sorted in the browser so no composite
 * index is required for ownerId + createdAt.
 */
export async function fetchMyProperties(uid) {
  const snapshot = await getDocs(
    query(collection(db, DB.properties), where("ownerId", "==", uid))
  );
  return snapshot.docs
    .map((entry) => ({ ...entry.data(), id: entry.id }))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
}

/* -------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */

/** One row in the owner's list. */
function listingRowHTML(property, { withActions = true } = {}) {
  const href = `property-details.html?id=${encodeURIComponent(property.id)}`;
  const actions = withActions
    ? `<div class="dash-item__actions">
         <a class="btn btn--ghost btn--sm" href="add-property.html?id=${encodeURIComponent(property.id)}">Edit</a>
         <button class="btn btn--danger btn--sm" type="button" data-delete="${escapeHtml(property.id)}">Delete</button>
       </div>`
    : `<div class="dash-item__actions">
         <a class="btn btn--ghost btn--sm" href="${href}">View</a>
       </div>`;

  return `
    <div class="dash-item" data-row="${escapeHtml(property.id)}">
      <div class="dash-item__media">${photoMarkup(primaryImage(property), property.title || "Property photo")}</div>
      <div>
        <p class="dash-item__title"><a href="${href}">${escapeHtml(property.title || "Untitled listing")}</a></p>
        <p class="dash-item__meta">${escapeHtml(property.location || "Location not given")} &middot; ${typeLabel(property.propertyType)} &middot; ${listingLabel(property.listingType)}</p>
        <p class="dash-item__price">${formatPriceShort(property.price)}</p>
      </div>
      ${actions}
    </div>`;
}

function renderRows(container, properties, options, emptyState) {
  if (!container) return;
  if (!properties.length) {
    renderState(container, emptyState);
    return;
  }
  container.innerHTML = properties.map((item) => listingRowHTML(item, options)).join("");
  wirePhotoFallbacks(container);
}

function renderStats(properties) {
  const set = (selector, value) => {
    const el = qs(selector);
    if (el) el.textContent = value;
  };
  const newest = properties
    .map((item) => toDate(item.updatedAt) || toDate(item.createdAt))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];

  set("[data-stat-total]", String(properties.length));
  set("[data-stat-sale]", String(properties.filter((p) => p.listingType === "sale").length));
  set("[data-stat-rent]", String(properties.filter((p) => p.listingType === "rent").length));
  set("[data-stat-updated]", newest ? formatDate(newest) : "—");
}

function renderAll() {
  const empty = {
    title: "No listings yet",
    message: "Publish your first property and it will appear here."
  };
  renderRows(qs("[data-recent-list]"), myProperties.slice(0, 3), { withActions: false }, empty);
  renderRows(qs("[data-owner-list]"), myProperties, { withActions: true }, empty);
  renderStats(myProperties);
}

/* -------------------------------------------------------------------------
   Delete
   ------------------------------------------------------------------------- */

/**
 * Delete one of the current user's properties. The ownership check runs here
 * and again in the Firestore security rules.
 */
export async function deleteProperty(propertyId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again to manage your listings.");

  const reference = doc(db, DB.properties, propertyId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) throw new Error("That listing no longer exists.");
  if (snapshot.data().ownerId !== user.uid) {
    throw new Error("You can only delete properties you published.");
  }

  await deleteDoc(reference);
}

function setupDelete() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;

    const propertyId = button.dataset.delete;
    const property = myProperties.find((item) => item.id === propertyId);
    const name = property?.title || "this listing";

    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    try {
      await deleteProperty(propertyId);
      myProperties = myProperties.filter((item) => item.id !== propertyId);
      renderAll();
      showToast("Listing deleted.");
    } catch (error) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      showToast(describeError(error), "error");
    }
  });
}

/* -------------------------------------------------------------------------
   Start
   ------------------------------------------------------------------------- */

/** Load and paint the signed-in user's listings. */
export async function loadDashboardData(uid) {
  const recent = qs("[data-recent-list]");
  const owned = qs("[data-owner-list]");
  renderLoading(recent, "Fetching your listings.");
  renderLoading(owned, "Fetching your listings.");

  try {
    myProperties = await fetchMyProperties(uid);
    renderAll();
  } catch (error) {
    const failure = {
      title: "Could not load your listings",
      message: describeError(error),
      tone: "error"
    };
    renderState(recent, failure);
    renderState(owned, failure);
  }
}

onReady(async () => {
  setupPanels();
  setupDelete();

  if (!isConfigured()) {
    const notConnected = {
      title: "Firebase is not connected",
      message: "Add your project credentials to js/firebase-config.js to load your listings."
    };
    renderState(qs("[data-recent-list]"), notConnected);
    renderState(qs("[data-owner-list]"), notConnected);
    return;
  }

  // Signed-out visitors are sent to login.html before anything else runs.
  const user = await guardPage();
  if (!user) return;

  const profile = await getUserProfile();
  fillUserCard(user, profile);
  await loadDashboardData(user.uid);
});

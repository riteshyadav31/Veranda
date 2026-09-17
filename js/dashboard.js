/**
 * dashboard.js — dashboard.html
 * Shows only the signed-in user's properties, and lets them edit or delete
 * their own listings. Every query is scoped to auth.currentUser.uid.
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db, DB, isConfigured } from "./firebase-config.js";
import { guardPage, getUserProfile, describeError, normalizeRole, signOut } from "./auth.js";
import { getFavoriteIds } from "./favorites.js";
import { fetchBuyerEnquiries, fetchSellerEnquiries } from "./enquiries.js";
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

function setupDashboardLogout() {
  const button = qs("[data-dashboard-logout]");
  if (!button) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await signOut();
      window.location.href = "index.html";
    } catch (error) {
      button.disabled = false;
      showToast(describeError(error), "error");
    }
  });
}

function setSidebarRole(role) {
  qsa("[data-buyer-only]").forEach((link) => { link.hidden = role !== "buyer"; });
  qsa("[data-seller-only]").forEach((link) => { link.hidden = role !== "seller"; });
}

function fillUserCard(user, profile) {
  const nameEl = qs("[data-user-name]");
  const emailEl = qs("[data-user-email]");
  const phoneEl = qs("[data-user-phone]");
  const accountEl = qs("[data-user-account]");
  const roleEl = qs("[data-user-role]");
  const avatar = qs(".avatar");
  const name = profile?.name || user.displayName || "Your account";
  const phone = profile?.phone || user.phoneNumber || "Phone not added";
  const role = normalizeRole(profile?.role);

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = user.email || "";
  if (phoneEl) phoneEl.textContent = phone === "Phone not added" ? "Phone: not added" : `Phone: ${phone}`;
  if (accountEl) accountEl.textContent = profile ? "Account: profile loaded" : "Account: using Firebase auth";
  if (roleEl) roleEl.textContent = `Role: ${role}`;
  if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase() || "V";
}

function renderBuyerDashboard(user, profile) {
  const menuLinks = qsa("[data-dash-link]");
  const panels = qsa("[data-dash-panel]");

  menuLinks.forEach((link) => {
    const keep = ["overview", "profile"].includes(link.dataset.dashLink);
    link.hidden = !keep;
    link.classList.toggle("is-active", link.dataset.dashLink === "overview");
  });

  panels.forEach((panel) => {
    const shouldShow = ["overview", "profile"].includes(panel.dataset.dashPanel);
    panel.hidden = !shouldShow;
  });

  qsa("[data-user-name]").forEach((el) => {
    el.textContent = profile?.name || user.displayName || "Your account";
  });

  const form = qs("[data-profile-form]");
  if (form) {
    form.querySelector('[name="name"]').value = profile?.name || user.displayName || "";
    form.querySelector('[name="phone"]').value = profile?.phone || "";
    form.querySelector('[name="about"]').value = profile?.about || "";
  }

  const overview = qs('[data-dash-panel="overview"]');
  if (overview) overview.hidden = false;

  const profilePanel = qs('[data-dash-panel="profile"]');
  if (profilePanel) {
    profilePanel.hidden = false;
  }
}

export async function fetchMyProperties(uid) {
  const snapshot = await getDocs(
    query(collection(db, DB.properties), where("ownerId", "==", uid))
  );
  return snapshot.docs
    .map((entry) => ({ ...entry.data(), id: entry.id }))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
}

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

function renderStats(properties, favoriteCount = 0, enquiryStats = { total: 0, new: 0, contacted: 0, closed: 0 }) {
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
  set("[data-stat-favorites]", String(favoriteCount));
  set("[data-stat-enquiries-total]", String(enquiryStats.total));
  set("[data-stat-enquiries-new]", String(enquiryStats.new));
  set("[data-stat-enquiries-contacted]", String(enquiryStats.contacted));
  set("[data-stat-enquiries-closed]", String(enquiryStats.closed));
  set("[data-stat-updated]", newest ? formatDate(newest) : "—");
}

function renderAll(favoriteCount = 0, enquiryStats = { total: 0, new: 0, contacted: 0, closed: 0 }) {
  const empty = {
    title: "No listings yet",
    message: "Publish your first property and it will appear here."
  };
  renderRows(qs("[data-recent-list]"), myProperties.slice(0, 3), { withActions: false }, empty);
  renderRows(qs("[data-owner-list]"), myProperties, { withActions: true }, empty);
  renderStats(myProperties, favoriteCount, enquiryStats);
}

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

export async function loadDashboardData(uid, role = "buyer") {
  const recent = qs("[data-recent-list]");
  const owned = qs("[data-owner-list]");
  renderLoading(recent, role === "seller" ? "Fetching your listings." : "Fetching your favorite properties.");
  renderLoading(owned, role === "seller" ? "Fetching your listings." : "Fetching your favorite properties.");

  try {
    const favoriteCount = (await getFavoriteIds(uid)).length;
    if (role === "seller") {
      myProperties = await fetchMyProperties(uid);
      const enquiries = await fetchSellerEnquiries(uid);
      const enquiryStats = {
        total: enquiries.length,
        new: enquiries.filter((item) => item.status === "new").length,
        contacted: enquiries.filter((item) => item.status === "contacted").length,
        closed: enquiries.filter((item) => item.status === "closed").length
      };
      renderAll(favoriteCount, enquiryStats);
      return;
    }

    const favoriteIds = await getFavoriteIds(uid);
    const buyerEnquiries = await fetchBuyerEnquiries(uid);
    const totalEnquiries = buyerEnquiries.length;

    if (!favoriteIds.length) {
      renderState(recent, {
        title: "No favorites yet",
        message: "Save properties you like to see them here."
      });
      renderState(owned, {
        title: "No favorites yet",
        message: "Save properties you like to see them here."
      });
      renderStats([], favoriteCount, { total: totalEnquiries, new: 0, contacted: 0, closed: 0 });
      return;
    }

    const properties = [];
    for (let i = 0; i < favoriteIds.length; i += 10) {
      const chunk = favoriteIds.slice(i, i + 10);
      const snapshot = await getDocs(query(collection(db, DB.properties), where(documentId(), "in", chunk)));
      snapshot.docs.forEach((entry) => {
        properties.push({ ...entry.data(), id: entry.id });
      });
    }

    myProperties = properties;
    renderAll(favoriteCount, { total: totalEnquiries, new: 0, contacted: 0, closed: 0 });
  } catch (error) {
    const failure = {
      title: role === "seller" ? "Could not load your listings" : "Could not load your favorites",
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
  setupDashboardLogout();

  if (!isConfigured()) {
    const notConnected = {
      title: "Firebase is not connected",
      message: "Add your project credentials to js/firebase-config.js to load your listings."
    };
    renderState(qs("[data-recent-list]"), notConnected);
    renderState(qs("[data-owner-list]"), notConnected);
    return;
  }

  const user = await guardPage();
  if (!user) return;

  const profile = await getUserProfile(user.uid);
  const role = normalizeRole(profile?.role);
  setSidebarRole(role);
  fillUserCard(user, profile);

  if (role === "buyer") {
    renderBuyerDashboard(user, profile);
    await loadDashboardData(user.uid, role);
    return;
  }

  await loadDashboardData(user.uid, role);
});

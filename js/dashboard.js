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
import { bindFavoriteButtons, fetchFavoriteProperties, getFavoriteIds } from "./favorites.js";
import { bindBuyerCancelButtons, bindEnquiryStatusButtons, fetchBuyerEnquiries, fetchSellerEnquiries, makeBuyerRow, makeSellerRow } from "./enquiries.js";
import "./navbar.js";
import {
  qs,
  qsa,
  onReady,
  escapeHtml,
  renderState,
  renderLoading,
  renderPropertyCards,
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

function setDashboardLoading(loading) {
  const state = qs("[data-dashboard-loading]");
  const shell = qs("[data-dashboard-shell]");
  if (state) state.hidden = !loading;
  if (shell) shell.hidden = loading;
}

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
    button.setAttribute("aria-busy", "true");
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Signing out...</span>';
    try {
      await signOut();
      window.location.href = "index.html";
    } catch (error) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "Logout";
      showToast(describeError(error), "error");
    }
  });
}

function setupFavoriteUpdates() {
  window.addEventListener("favorites:updated", (event) => {
    if (event.detail?.isFavorite !== false) return;

    const propertyId = event.detail.propertyId;
    const container = qs("[data-dashboard-favorites]");
    const button = propertyId && container?.querySelector(`[data-favorite-toggle="${CSS.escape(propertyId)}"]`);
    if (!button) return;

    button.closest(".property-card")?.remove();
    const remaining = container.querySelectorAll(".property-card").length;
    const count = qs("[data-stat-favorites]");
    if (count) count.textContent = String(remaining);
    if (!remaining) {
      renderState(container, {
        title: "No favorites yet",
        message: "Save properties you like to see them here."
      });
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
    const keep = ["overview", "favorites", "enquiries", "profile"].includes(link.dataset.dashLink);
    link.hidden = !keep || link.hasAttribute("data-seller-only");
    link.classList.toggle("is-active", link.dataset.dashLink === "overview");
  });

  panels.forEach((panel) => {
    panel.hidden = panel.dataset.dashPanel !== "overview";
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

  const listTitle = qs("[data-dashboard-list-title]");
  if (listTitle) listTitle.textContent = "Recent favorites";

}

function renderDashboardFavorites(properties) {
  const container = qs("[data-dashboard-favorites]");
  if (!container) return;

  renderPropertyCards(container, properties.map((property) => ({ ...property, isFavorite: true })), {
    title: "No favorites yet",
    message: "Save a property from the listings page and it will appear here."
  }, {
    onRender: (root) => bindFavoriteButtons(root, new Set(properties.map((property) => property.id)))
  });
}

function renderDashboardEnquiries(enquiries, role) {
  const container = qs("[data-dashboard-enquiries]");
  const title = qs("[data-dashboard-enquiries-title]");
  const description = qs("[data-dashboard-enquiries-description]");
  if (!container) return;

  if (title) title.textContent = role === "seller" ? "Buyer enquiries" : "My enquiries";
  if (description) description.textContent = role === "seller"
    ? "Messages from people who want to see your property."
    : "Track the properties you have contacted and the status of each enquiry.";

  if (!enquiries.length) {
    renderState(container, {
      title: role === "seller" ? "No enquiries received." : "No enquiries yet.",
      message: role === "seller"
        ? "New buyer enquiries will appear here for your listings."
        : "Your enquiries about properties will appear here once you contact a seller."
    });
    return;
  }

  container.innerHTML = enquiries.map(role === "seller" ? makeSellerRow : makeBuyerRow).join("");
  if (role === "seller") {
    bindEnquiryStatusButtons(container, async () => {
      const user = auth.currentUser;
      if (!user) return;
      const updated = await fetchSellerEnquiries(user.uid);
      renderDashboardEnquiries(updated, role);
    });
  } else {
    bindBuyerCancelButtons(container, async () => {
      const user = auth.currentUser;
      if (!user) return;
      const updated = await fetchBuyerEnquiries(user.uid);
      renderDashboardEnquiries(updated, role);
    });
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
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Deleting...</span>';

    try {
      await deleteProperty(propertyId);
      myProperties = myProperties.filter((item) => item.id !== propertyId);
      renderAll();
      showToast("Listing deleted.");
    } catch (error) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "Delete";
      showToast(describeError(error), "error");
    }
  });
}

export async function loadDashboardData(uid, role = "buyer") {
  const recent = qs("[data-recent-list]");
  const owned = qs("[data-owner-list]");
  renderLoading(recent, role === "seller" ? "Fetching your listings." : "Fetching your favorite properties.");
  renderLoading(owned, role === "seller" ? "Fetching your listings." : "Fetching your favorite properties.");
  renderLoading(qs("[data-dashboard-favorites]"), "Fetching your favorite properties.");
  renderLoading(qs("[data-dashboard-enquiries]"), "Fetching your enquiries.");

  try {
    if (role === "seller") {
      myProperties = await fetchMyProperties(uid);
      const enquiries = await fetchSellerEnquiries(uid);
      const enquiryStats = {
        total: enquiries.length,
        new: enquiries.filter((item) => item.status === "new").length,
        contacted: enquiries.filter((item) => item.status === "contacted").length,
        closed: enquiries.filter((item) => item.status === "closed").length
      };
      renderAll(0, enquiryStats);
      renderDashboardEnquiries(enquiries, role);
      setDashboardLoading(false);
      return;
    }

    const favoriteCount = (await getFavoriteIds(uid)).length;
    const favoriteIds = await getFavoriteIds(uid);
    const favoriteProperties = await fetchFavoriteProperties(uid);
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
      renderDashboardFavorites([]);
      renderDashboardEnquiries(buyerEnquiries, role);
      setDashboardLoading(false);
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
    renderDashboardFavorites(favoriteProperties);
    renderDashboardEnquiries(buyerEnquiries, role);
    setDashboardLoading(false);
  } catch (error) {
    const failure = {
      title: role === "seller" ? "Could not load your listings" : "Could not load your favorites",
      message: describeError(error),
      tone: "error"
    };
    renderState(recent, failure);
    renderState(owned, failure);
    setDashboardLoading(false);
    const favorites = qs("[data-dashboard-favorites]");
    const enquiries = qs("[data-dashboard-enquiries]");
    if (favorites) renderState(favorites, failure);
    if (enquiries) renderState(enquiries, failure);
  }
}

onReady(async () => {
  setupPanels();
  setupDelete();
  setupDashboardLogout();
  setupFavoriteUpdates();

  if (!isConfigured()) {
    const notConnected = {
      title: "Firebase is not connected",
      message: "Add your project credentials to js/firebase-config.js to load your listings."
    };
    renderState(qs("[data-recent-list]"), notConnected);
    renderState(qs("[data-owner-list]"), notConnected);
    setDashboardLoading(false);
    return;
  }

  const user = await guardPage();
  if (!user) return;

  const profile = await getUserProfile(user.uid);
  const role = normalizeRole(profile?.role);
  setSidebarRole(role);
  setDashboardLoading(true);
  fillUserCard(user, profile);

  if (role === "buyer") {
    renderBuyerDashboard(user, profile);
    await loadDashboardData(user.uid, role);
    return;
  }

  await loadDashboardData(user.uid, role);
});

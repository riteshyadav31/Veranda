/**
 * home.js — index.html
 * Search UI plus the featured strip, which pulls the most recent listings
 * from Firestore.
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { db, DB, isConfigured } from "./firebase-config.js";
import { describeError } from "./auth.js";
import "./navbar.js";
import {
  qs,
  qsa,
  onReady,
  renderState,
  renderLoading,
  renderPropertyCards
} from "./utils.js";



const FEATURED_COUNT = 6;

/* -------------------------------------------------------------------------
   Search
   ------------------------------------------------------------------------- */

/** The tabs map onto listingType and propertyType filters. */
const TAB_FILTERS = {
  buy: { purpose: "sale" },
  rent: { purpose: "rent" },
  commercial: { type: "commercial" },
  plot: { type: "plot" }
};

let activeTab = "buy";

function setupSearchTabs() {
  const tabs = qsa("[data-search-tab]");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.searchTab;
      tabs.forEach((other) => {
        const active = other === tab;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-selected", String(active));
      });
    });
  });
}

function setupSearchForm() {
  const form = qs("[data-search-form]");
  if (!form) return;

  // Hand the criteria to properties.html as query parameters.
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const params = new URLSearchParams(TAB_FILTERS[activeTab] || {});
    new FormData(form).forEach((value, key) => {
      const trimmed = String(value).trim();
      if (trimmed) params.set(key, trimmed);
    });

    const queryString = params.toString();
    window.location.href = queryString ? `properties.html?${queryString}` : "properties.html";
  });
}

/* -------------------------------------------------------------------------
   Featured listings
   ------------------------------------------------------------------------- */

/** The newest listings on the site. */
export async function fetchFeatured(max = FEATURED_COUNT) {
  const snapshot = await getDocs(
    query(collection(db, DB.properties), orderBy("createdAt", "desc"), limit(max))
  );
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
}

async function loadFeatured() {
  const container = qs("[data-featured-list]");
  if (!container) return;

  if (!isConfigured()) {
    renderState(container, {
      title: "Firebase is not connected",
      message: "Add your project credentials to js/firebase-config.js to load listings."
    });
    return;
  }

  renderLoading(container, "Fetching the latest listings.");

  try {
    const properties = await fetchFeatured();
    renderPropertyCards(container, properties, {
      title: "No listings yet",
      message: "Once a property is published it will appear here."
    });
  } catch (error) {
    renderState(container, {
      title: "Could not load listings",
      message: describeError(error),
      tone: "error"
    });
  }
}

onReady(async () => {
  setupSearchTabs();
  setupSearchForm();
  await loadFeatured();
});


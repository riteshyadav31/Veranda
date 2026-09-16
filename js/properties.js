/**
 * properties.js — properties.html
 * Reads the `properties` collection, then filters and sorts in the browser so
 * no composite Firestore index is needed for the listing page.
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
  onReady,
  renderState,
  renderLoading,
  renderPropertyCards
} from "./utils.js";

const PAGE_SIZE = 60;
let allProperties = [];

/* -------------------------------------------------------------------------
   Data
   ------------------------------------------------------------------------- */

/** Fetch the most recent listings. Returns an array of plain objects. */
export async function fetchProperties(max = PAGE_SIZE) {
  const snapshot = await getDocs(
    query(collection(db, DB.properties), orderBy("createdAt", "desc"), limit(max))
  );
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
}

/* -------------------------------------------------------------------------
   Filtering and sorting
   ------------------------------------------------------------------------- */

/** Criteria currently in the form, as a plain object. */
function readFilters(form) {
  const criteria = {};
  new FormData(form).forEach((value, key) => {
    const trimmed = String(value).trim();
    if (trimmed) criteria[key] = trimmed;
  });
  return criteria;
}

function matches(property, criteria) {
  if (criteria.location) {
    const haystack = `${property.location || ""} ${property.title || ""}`.toLowerCase();
    if (!haystack.includes(criteria.location.toLowerCase())) return false;
  }
  if (criteria.type && property.propertyType !== criteria.type) return false;
  if (criteria.purpose && property.listingType !== criteria.purpose) return false;
  if (criteria.budget && Number(property.price) > Number(criteria.budget)) return false;
  return true;
}

function sortProperties(list, mode) {
  const sorted = [...list];
  if (mode === "price-asc") sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (mode === "price-desc") sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (mode === "area") sorted.sort((a, b) => (b.area || 0) - (a.area || 0));
  return sorted;
}

/* -------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */

function updateCount(shown, total) {
  const label = qs("[data-result-count]");
  if (!label) return;
  label.textContent =
    shown === total
      ? `${total} ${total === 1 ? "listing" : "listings"}`
      : `${shown} of ${total} listings match your filters`;
}

/** Apply the current filters and sort, then paint the grid. */
function applyView() {
  const container = qs("[data-property-list]");
  const form = qs("[data-filter-form]");
  const sortMode = qs("[data-sort]")?.value || "recent";
  const criteria = form ? readFilters(form) : {};

  const visible = sortProperties(
    allProperties.filter((property) => matches(property, criteria)),
    sortMode
  );

  renderPropertyCards(container, visible, {
    title: allProperties.length ? "No matches" : "No listings yet",
    message: allProperties.length
      ? "Widen your filters, or clear them to see everything."
      : "Be the first to publish a property on Veranda."
  });

  updateCount(visible.length, allProperties.length);
}

/* -------------------------------------------------------------------------
   Filter form
   ------------------------------------------------------------------------- */

/** Populate the filter form from ?location=…&type=… so links stay shareable. */
function hydrateFiltersFromUrl(form) {
  const params = new URLSearchParams(window.location.search);
  params.forEach((value, key) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });
}

function writeFiltersToUrl(form) {
  const params = new URLSearchParams(readFilters(form));
  const queryString = params.toString();
  window.history.replaceState({}, "", queryString ? `?${queryString}` : location.pathname);
}

function setupFilters() {
  const form = qs("[data-filter-form]");
  if (!form) return;

  hydrateFiltersFromUrl(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    writeFiltersToUrl(form);
    applyView();
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      window.history.replaceState({}, "", location.pathname);
      applyView();
    }, 0);
  });

  qs("[data-sort]")?.addEventListener("change", applyView);
}

/* -------------------------------------------------------------------------
   Start
   ------------------------------------------------------------------------- */

/** Load listings into the page. Exported so other views can reuse it. */
export async function loadProperties() {
  const container = qs("[data-property-list]");
  if (!container) return;

  if (!isConfigured()) {
    renderState(container, {
      title: "Firebase is not connected",
      message: "Add your project credentials to js/firebase-config.js to load listings."
    });
    updateCount(0, 0);
    return;
  }

  renderLoading(container, "Fetching listings from Firestore.");

  try {
    allProperties = await fetchProperties();
    applyView();
  } catch (error) {
    renderState(container, {
      title: "Could not load listings",
      message: describeError(error),
      tone: "error"
    });
    updateCount(0, 0);
  }
}

onReady(async () => {
  setupFilters();
  await loadProperties();
});

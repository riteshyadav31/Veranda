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

import { db, DB, isConfigured, auth } from "./firebase-config.js";
import { describeError } from "./auth.js";
import "./navbar.js";
import {
  qs,
  debounce,
  onReady,
  renderState,
  renderLoading,
  renderPropertyCards
} from "./utils.js";
import { bindFavoriteButtons, getFavoriteIds } from "./favorites.js";

const PAGE_SIZE = 60;
let allProperties = [];
let favoriteIds = new Set();

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
  if (criteria.type && !criteria.propertyType) criteria.propertyType = criteria.type;
  if (criteria.purpose && !criteria.listingType) criteria.listingType = criteria.purpose;
  return criteria;
}

function matches(property, criteria) {
  if (criteria.search) {
    const haystack = `${property.title || ""} ${property.location || ""} ${property.description || ""}`.toLowerCase();
    if (!haystack.includes(criteria.search.toLowerCase())) return false;
  }
  if (criteria.propertyType && property.propertyType !== criteria.propertyType) return false;
  if (criteria.listingType && property.listingType !== criteria.listingType) return false;
  if (criteria.minPrice && Number(property.price) < Number(criteria.minPrice)) return false;
  if (criteria.maxPrice && Number(property.price) > Number(criteria.maxPrice)) return false;
  if (criteria.bedrooms && Number(property.bedrooms || 0) < Number(criteria.bedrooms)) return false;
  if (criteria.bathrooms && Number(property.bathrooms || 0) < Number(criteria.bathrooms)) return false;
  if (criteria.minArea && Number(property.area) < Number(criteria.minArea)) return false;
  if (criteria.maxArea && Number(property.area) > Number(criteria.maxArea)) return false;
  return true;
}

function sortProperties(list, mode) {
  const sorted = [...list];
  const dateValue = (value) => value?.toDate ? value.toDate().getTime() : Number(value?.seconds || 0) * 1000;
  if (mode === "oldest") sorted.sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt));
  else if (mode === "price-asc") sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  else if (mode === "price-desc") sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  else if (mode === "area-asc") sorted.sort((a, b) => (Number(a.area) || 0) - (Number(b.area) || 0));
  else if (mode === "area-desc") sorted.sort((a, b) => (Number(b.area) || 0) - (Number(a.area) || 0));
  else sorted.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
  return sorted;
}

/* -------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */

function updateCount(shown, total) {
  const label = qs("[data-result-count]");
  if (!label) return;
  label.textContent =
    total === 0
      ? "No properties listed yet"
      : shown === total
        ? `${total} ${total === 1 ? "property" : "properties"}`
        : `${shown} of ${total} properties match your filters`;
}

/** Apply the current filters and sort, then paint the grid. */
function applyView() {
  const container = qs("[data-property-list]");
  const form = qs("[data-filter-form]");
  const sortMode = qs("[data-sort]")?.value || "newest";
  const criteria = form ? readFilters(form) : {};

  const visible = sortProperties(
    allProperties.filter((property) => matches(property, criteria)).map((property) => ({ ...property, isFavorite: favoriteIds.has(property.id) })),
    sortMode
  );

  if (!visible.length) {
    const clearButton = '<button type="button" class="btn btn--primary" data-clear-filters>Clear Filters</button>';
    container.innerHTML = `
      <div class="state" data-tone="empty">
        <h3>No properties found matching your search.</h3>
        <p>Try widening your search or clearing the current filters.</p>
        ${clearButton}
      </div>
    `;
    updateCount(0, allProperties.length);
    return;
  }

  renderPropertyCards(container, visible, {
    title: allProperties.length ? "No matches" : "No listings yet",
    message: allProperties.length
      ? "Widen your filters, or clear them to see everything."
      : "Be the first to publish a property on Veranda."
  }, { onRender: (root) => bindFavoriteButtons(root, favoriteIds) });

  updateCount(visible.length, allProperties.length);
}


/* -------------------------------------------------------------------------
   Filter form
   ------------------------------------------------------------------------- */

/** Populate the filter form from ?location=…&type=… so links stay shareable. */
function hydrateFiltersFromUrl(form) {
  const params = new URLSearchParams(window.location.search);
  params.forEach((value, key) => {
    const mappedKey = key === "type" ? "propertyType" : key === "purpose" ? "listingType" : key;
    const field = form.elements.namedItem(mappedKey) || form.elements.namedItem(key);
    if (field) field.value = value;
  });
  const sort = params.get("sort");
  if (sort && qs("[data-sort]")) qs("[data-sort]").value = sort;
}

function writeFiltersToUrl(form) {
  const params = new URLSearchParams();
  const criteria = readFilters(form);
  Object.entries(criteria).forEach(([key, value]) => params.set(key, value));

  const sortEl = qs("[data-sort]");
  if (sortEl && sortEl.value) {
    params.set("sort", sortEl.value);
  }

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

  form.addEventListener("input", debounce(() => {
    writeFiltersToUrl(form);
    applyView();
  }, 250));

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      window.history.replaceState({}, "", location.pathname);
      if (qs("[data-sort]")) qs("[data-sort]").value = "newest";
      applyView();
    }, 0);
  });

  qs("[data-sort]")?.addEventListener("change", () => {
    writeFiltersToUrl(form);
    applyView();
  });

  document.addEventListener("click", (event) => {
    const clearButton = event.target.closest("[data-clear-filters]");
    if (!clearButton) return;
    form.reset();
    if (qs("[data-sort]")) qs("[data-sort]").value = "newest";
    window.history.replaceState({}, "", location.pathname);
    applyView();
  });
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
    favoriteIds = new Set(await getFavoriteIds(auth.currentUser?.uid));
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

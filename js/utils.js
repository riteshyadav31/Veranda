/**
 * utils.js
 * Small, dependency-free helpers shared by every page script.
 */

/** Query a single element. */
export const qs = (selector, scope = document) =>
  scope.querySelector(selector);

/** Query all matching elements as a real array. */
export const qsa = (selector, scope = document) =>
  Array.from(scope.querySelectorAll(selector));

/** Run a callback once the DOM is parsed. */
export function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

/** Read a query-string value, e.g. property-details.html?id=abc123 */
export function getParam(name, url = window.location.href) {
  return new URL(url).searchParams.get(name);
}

/** Format a number as Indian rupees: 8500000 → ₹85,00,000 */
export function formatPrice(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

/** Shorten large prices for cards: 8500000 → ₹85 L, 25000000 → ₹2.5 Cr */
export function formatPriceShort(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  if (amount >= 1e7) {
    return `₹${(amount / 1e7)
      .toFixed(2)
      .replace(/\.00$/, "")} Cr`;
  }

  if (amount >= 1e5) {
    return `₹${(amount / 1e5)
      .toFixed(2)
      .replace(/\.00$/, "")} L`;
  }

  return formatPrice(amount);
}

/** Format a built-up area value. */
export function formatArea(value, unit = "sq ft") {
  const area = Number(value);

  if (!Number.isFinite(area)) return "—";

  return `${new Intl.NumberFormat("en-IN").format(area)} ${unit}`;
}

/** Normalise a Firestore Timestamp, millis value or string into a Date. */
export function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Turn a Firestore Timestamp, date string or Date into a readable date. */
export function formatDate(value) {
  const date = toDate(value);

  if (!date) return "—";

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

/** Escape user-supplied text before it is placed into markup. */
export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

/** Delay repeated calls — useful for search-as-you-type later. */
export function debounce(fn, wait = 300) {
  let timer;

  return (...args) => {
    clearTimeout(timer);

    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Replace a container's contents with a message block. */
export function renderState(
  container,
  { title, message, tone = "empty" }
) {
  if (!container) return;

  container.innerHTML = `
    <div class="state" data-tone="${tone}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/** Stamp the current year into any [data-year] element. */
export function setCurrentYear() {
  qsa("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}


/* -------------------------------------------------------------------------
   Property presentation helpers

   Shared by index.html, properties.html, property-details.html and the
   dashboard so a listing looks the same wherever it appears.
   ------------------------------------------------------------------------- */

/** Stored value -> label shown to people. */
export const PROPERTY_TYPES = {
  house: "House",
  apartment: "Apartment",
  villa: "Villa",
  plot: "Plot",
  commercial: "Commercial"
};

export const LISTING_TYPES = {
  sale: "For sale",
  rent: "For rent"
};

export const AMENITIES = [
  "Covered parking",
  "Lift",
  "Power backup",
  "Gated security",
  "24x7 water supply",
  "Modular kitchen",
  "Garden",
  "Gym",
  "Piped gas",
  "Corner unit"
];


const HOUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 10.5 12 3l9 7.5"/>' +
  '<path d="M5 9.8V21h14V9.8"/>' +
  '<path d="M10 21v-6h4v6"/>' +
  '</svg>';


/** Markup for the block that stands in for a missing photograph. */
export const PHOTO_PLACEHOLDER =
  `<div class="ph" aria-hidden="true">${HOUSE_ICON}</div>`;


export const typeLabel = (value) =>
  PROPERTY_TYPES[value] || "Property";

export const listingLabel = (value) =>
  LISTING_TYPES[value] || "Listed";


/** Price plus the unit that matches the listing type. */
export function priceLabel(property) {
  const amount = formatPriceShort(property.price);

  return property.listingType === "rent"
    ? `${amount} <small>per month</small>`
    : amount;
}


/** First usable image URL, or an empty string. */
export function primaryImage(property) {
  const images = Array.isArray(property.images)
    ? property.images
    : [];

  return (
    images.find(
      (url) =>
        typeof url === "string" &&
        url.trim()
    ) || ""
  );
}


/** An <img> when a URL exists, otherwise the placeholder block. */
export function photoMarkup(url, alt) {
  if (!url) {
    return PHOTO_PLACEHOLDER;
  }

  return `
    <img
      src="${escapeHtml(url)}"
      alt="${escapeHtml(alt)}"
      loading="lazy"
      data-photo
    />
  `;
}


/** Swap in the placeholder when an image URL fails to load. */
export function wirePhotoFallbacks(scope = document) {
  qsa("img[data-photo]", scope).forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const host = img.parentElement;

        if (host) {
          host.innerHTML = PHOTO_PLACEHOLDER;
        }
      },
      { once: true }
    );
  });
}


/** One property card. Used on the home page and properties listing. */
export function propertyCardHTML(property) {
  const href =
    `property-details.html?id=${encodeURIComponent(property.id)}`;

  const isFavorite = Boolean(property.isFavorite);

  const isPlot =
    property.propertyType === "plot" ||
    property.propertyType === "commercial";

  const rooms = isPlot
    ? ""
    : `
      <span>
        <strong>${escapeHtml(property.bedrooms ?? "—")}</strong>
        beds
      </span>

      <span>
        <strong>${escapeHtml(property.bathrooms ?? "—")}</strong>
        baths
      </span>
    `;

  return `
    <article class="property-card">

      <div class="property-card__media">

        ${favoriteButtonMarkup(property.id, isFavorite)}

        ${photoMarkup(
          primaryImage(property),
          property.title || "Property photo"
        )}

        <span class="tag${
          property.listingType === "rent"
            ? " tag--brass"
            : ""
        }">
          ${listingLabel(property.listingType)}
        </span>

      </div>


      <div class="property-card__body">

        <p class="property-card__price">
          ${priceLabel(property)}
        </p>

        <h3 class="property-card__title">

          <a href="${href}">
            ${escapeHtml(
              property.title || "Untitled listing"
            )}
          </a>

        </h3>


        <p class="property-card__address">
          ${escapeHtml(
            property.location || "Location not given"
          )}
          &middot;
          ${typeLabel(property.propertyType)}
        </p>


        <p class="meta">

          ${rooms}

          <span>
            <strong>
              ${escapeHtml(formatArea(property.area))}
            </strong>
          </span>

        </p>


        <a
          class="btn btn--ghost btn--sm property-card__action"
          href="${href}"
        >
          View details
        </a>

      </div>

    </article>
  `;
}


/** Render a list of properties into a container, with an empty state. */
export function renderPropertyCards(
  container,
  properties,
  emptyState,
  options = {}
) {
  if (!container) return;

  if (!properties.length) {
    renderState(container, emptyState);
    return;
  }

  container.innerHTML =
    properties.map(propertyCardHTML).join("");

  wirePhotoFallbacks(container);

  if (typeof options.onRender === "function") {
    options.onRender(container);
  }
}


/** Simple loading block, reusing the .state design. */
export function renderLoading(
  container,
  message = "Loading listings…"
) {
  renderState(container, {
    title: "One moment",
    message,
    tone: "loading"
  });
}


/** Brief confirmation message in the corner of the screen. */
export function showToast(
  message,
  tone = "success"
) {
  const existing = qs(".toast");

  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("output");

  toast.className = `toast toast--${tone}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;

  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4000);
}

export function favoriteButtonMarkup(propertyId, isFavorite = false) {
  const label = isFavorite ? "Remove from favorites" : "Add to favorites";
  return `
    <button type="button" class="favorite-toggle${isFavorite ? " is-active" : ""}"
      data-favorite-toggle="${escapeHtml(propertyId)}"
      aria-label="${escapeHtml(label)}" aria-pressed="${isFavorite ? "true" : "false"}">
      <span class="favorite-toggle__icon" aria-hidden="true">${isFavorite ? "♥" : "♡"}</span>
    </button>
  `;
}
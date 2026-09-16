/**
 * property-details.js — property-details.html
 * Step 1: gallery interaction only. Loading a property by id comes in Step 2.
 */

import { qs, qsa, onReady, getParam } from "./utils.js";
import "./navbar.js";

/** Exchange the contents of two gallery frames. */
function swapContents(a, b) {
  const markup = a.innerHTML;
  a.innerHTML = b.innerHTML;
  b.innerHTML = markup;
}

/** Move a thumbnail into the main frame when it is chosen. */
function setupGallery() {
  const main = qs("[data-gallery-main]");
  const thumbs = qsa("[data-gallery-thumb]");
  if (!main || !thumbs.length) return;

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => swapContents(main, thumb));
  });
}

/**
 * Placeholder for the Firestore document read.
 * Step 2 will fetch the property matching `propertyId` and fill the page.
 */
export function loadProperty(/* propertyId */) {
  // Intentionally empty in Step 1.
}

onReady(() => {
  setupGallery();
  const propertyId = getParam("id");
  if (propertyId) {
    // loadProperty(propertyId) — Step 2
  }
});

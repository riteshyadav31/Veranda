import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db, DB } from "./firebase-config.js";
import { guardPage } from "./auth.js";
import "./navbar.js";
import {
  qs,
  renderLoading,
  renderPropertyCards,
  renderState,
  showToast
} from "./utils.js";

export async function getFavoriteIds(uid = auth.currentUser?.uid) {
  if (!uid) return [];

  const snapshot = await getDocs(collection(db, DB.users, uid, "favorites"));
  return snapshot.docs.map((entry) => entry.id);
}

export async function fetchFavoriteProperties(uid = auth.currentUser?.uid) {
  const ids = await getFavoriteIds(uid);

  if (!ids.length) {
    return [];
  }

  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) {
    chunks.push(ids.slice(i, i + 10));
  }

  const results = [];
  for (const chunk of chunks) {
    const snapshot = await getDocs(
      query(collection(db, DB.properties), where(documentId(), "in", chunk))
    );

    snapshot.docs.forEach((entry) => {
      results.push({ ...entry.data(), id: entry.id });
    });
  }

  return results;
}

export async function toggleFavorite(propertyId) {
  const user = auth.currentUser;

  if (!user) {
    showToast("Please sign in to save favorites.", "error");
    return null;
  }

  const ref = doc(db, DB.users, user.uid, "favorites", propertyId);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    await deleteDoc(ref);
    showToast("Removed from favorites.", "error");
    return false;
  }

  await setDoc(ref, {
    propertyId,
    createdAt: serverTimestamp()
  });

  showToast("Saved to favorites. You can view it in your Favorites page.", "success");
  return true;
}

export function setFavoriteButtonState(button, isFavorite) {
  if (!button) return;

  button.classList.toggle("is-active", isFavorite);

  const icon = button.querySelector(".favorite-toggle__icon");
  if (icon) {
    icon.textContent = isFavorite ? "♥" : "♡";
  } else {
    button.textContent = isFavorite ? "♥" : "♡";
  }

  button.setAttribute("aria-pressed", String(isFavorite));
  button.setAttribute("aria-label", isFavorite ? "Remove from favorites" : "Add to favorites");
}

export function bindFavoriteButtons(scope = document, favoriteIds = new Set()) {
  const buttons = Array.from(scope.querySelectorAll("[data-favorite-toggle]"));

  buttons.forEach((button) => {
    const propertyId = button.dataset.favoriteToggle;
    const isFavorite = favoriteIds.has(propertyId);
    setFavoriteButtonState(button, isFavorite);

    button.onclick = async () => {
      const next = await toggleFavorite(propertyId);
      if (next === null) return;

      const hasFavorite = next === true;
      favoriteIds[hasFavorite ? "add" : "delete"](propertyId);
      setFavoriteButtonState(button, hasFavorite);
      window.dispatchEvent(new CustomEvent("favorites:updated", {
        detail: { propertyId, isFavorite: hasFavorite }
      }));
    };
  });
}

export async function loadFavoritesPage() {
  const container = qs("[data-favorites-list]");
  const count = qs("[data-result-count]");
  if (!container) return;

  renderLoading(container, "Loading your favorite properties.");

  const user = await guardPage();
  if (!user) return;

  const favoriteIds = await getFavoriteIds(user.uid);

  if (count) {
    count.textContent = favoriteIds.length
      ? `${favoriteIds.length} saved property${favoriteIds.length === 1 ? "" : "ies"}`
      : "No saved properties yet";
  }

  if (!favoriteIds.length) {
    renderState(container, {
      title: "No favorites yet.",
      message: "Save homes you like and they will appear here. Tap the heart on any property card to add it to your shortlist."
    });

    const browseButton = document.createElement("a");
    browseButton.href = "properties.html";
    browseButton.className = "btn btn--primary";
    browseButton.textContent = "Browse properties";
    browseButton.style.marginTop = "1rem";
    container.appendChild(browseButton);
    return;
  }

  try {
    const favoriteProperties = await fetchFavoriteProperties(user.uid);
    const ids = new Set(favoriteProperties.map((property) => property.id));
    const visible = favoriteProperties.map((property) => ({ ...property, isFavorite: ids.has(property.id) }));

    renderPropertyCards(container, visible, {
      title: "No favorites yet.",
      message: "Explore listings and save the homes you love."
    }, {
      onRender: (root) => bindFavoriteButtons(root, ids)
    });

    if (count) {
      count.textContent = `${visible.length} favorite${visible.length === 1 ? "" : "s"}`;
    }
  } catch (error) {
    renderState(container, {
      title: "Could not load your favorites",
      message: error?.message || "Please try again in a moment.",
      tone: "error"
    });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("favorites:updated", () => {
    const page = window.location.pathname.split("/").pop();
    if (page === "favorites.html") {
      loadFavoritesPage();
    }
  });
}

if (typeof document !== "undefined") {
  const page = window.location.pathname.split("/").pop();
  if (page === "favorites.html") {
    window.addEventListener("DOMContentLoaded", loadFavoritesPage, { once: true });
  }
}

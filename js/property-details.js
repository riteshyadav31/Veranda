/**
 * property-details.js — property-details.html
 * Fetches a listing by id and renders the gallery and details.
 */

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db, DB } from "./firebase-config.js";
import { getFavoriteIds, toggleFavorite } from "./favorites.js";
import { getUserProfile } from "./auth.js";
import { createEnquiry } from "./enquiries.js";
import "./navbar.js";
import {
  qs,
  qsa,
  onReady,
  getParam,
  renderState,
  formatPrice,
  formatDate,
  formatArea,
  typeLabel,
  listingLabel,
  escapeHtml,
  showToast
} from "./utils.js";

function renderGallery(images) {
  const main = qs("[data-gallery-main]");
  const thumbs = qs("[data-gallery-thumbs]");

  if (!main || !thumbs) return;

  const validImages = (Array.isArray(images) ? images : []).filter((url) => typeof url === "string" && url.trim());

  if (!validImages.length) {
    main.innerHTML = '<div class="ph" aria-hidden="true">No photos</div>';
    thumbs.innerHTML = "";
    return;
  }

  let currentIndex = 0;

  const paintMain = () => {
    const image = validImages[currentIndex];
    main.innerHTML = `
      <img src="${escapeHtml(image)}" alt="Property photo ${currentIndex + 1}" loading="eager" />
      <button class="gallery__nav gallery__nav--prev" type="button" data-gallery-prev aria-label="Previous photo">&#8592;</button>
      <button class="gallery__nav gallery__nav--next" type="button" data-gallery-next aria-label="Next photo">&#8594;</button>
      <span class="gallery__counter" data-gallery-counter>${currentIndex + 1} / ${validImages.length}</span>
    `;

    const prevButton = qs("[data-gallery-prev]", main);
    const nextButton = qs("[data-gallery-next]", main);
    if (prevButton) {
      prevButton.addEventListener("click", () => {
        currentIndex = (currentIndex - 1 + validImages.length) % validImages.length;
        paintMain();
      });
    }
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % validImages.length;
        paintMain();
      });
    }
  };

  thumbs.innerHTML = validImages.map((image, index) => `
    <button class="gallery__thumb ${index === currentIndex ? "is-active" : ""}" type="button" data-gallery-thumb data-index="${index}" aria-label="Show photo ${index + 1}">
      <img src="${escapeHtml(image)}" alt="Thumbnail ${index + 1}" loading="lazy" />
    </button>
  `).join("");

  qsa("[data-gallery-thumb]", thumbs).forEach((thumb) => {
    thumb.addEventListener("click", () => {
      currentIndex = Number(thumb.dataset.index || 0);
      paintMain();
      qsa("[data-gallery-thumb]", thumbs).forEach((node) => {
        node.classList.toggle("is-active", Number(node.dataset.index) === currentIndex);
      });
    });
  });

  paintMain();
}

export async function loadProperty(propertyId) {
  if (!propertyId) return;

  const state = qs("[data-property-state]");
  const content = qs("[data-property-content]");

  try {
    const snapshot = await getDoc(doc(db, DB.properties, propertyId));
    if (!snapshot.exists()) {
      renderState(state, {
        title: "Listing not found",
        message: "This property may have been removed or the link is incomplete.",
        tone: "error"
      });
      return;
    }

    const property = snapshot.data();
    const title = qs("[data-property-title]");
    const location = qs("[data-property-location]");
    const listingTypeBadge = qs("[data-property-listing-type]");
    const listingTypeValue = qs("[data-property-listing]");
    const propertyType = qs("[data-property-type]");
    const description = qs("[data-property-description]");
    const area = qs("[data-property-area]");
    const created = qs("[data-property-created]");
    const beds = qs("[data-property-beds]");
    const baths = qs("[data-property-baths]");
    const price = qs("[data-property-price]");
    const note = qs("[data-property-price-note]");
    const owner = qs("[data-property-owner]");
    const amenitiesList = qs("[data-property-amenities]");
    const contactButton = qs("[data-contact-owner]");
    const contactNote = qs("[data-contact-note]");
    const crumb = qs("[data-property-crumb]");

    if (title) title.textContent = property.title || "Untitled listing";
    if (location) location.textContent = property.location || "Location not provided";
    if (listingTypeBadge) {
      listingTypeBadge.hidden = false;
      listingTypeBadge.textContent = listingLabel(property.listingType);
    }
    if (listingTypeValue) listingTypeValue.textContent = listingLabel(property.listingType);
    if (propertyType) propertyType.textContent = typeLabel(property.propertyType);
    if (description) description.textContent = property.description || "No description added yet.";
    if (area) area.textContent = formatArea(property.area);
    if (created) created.textContent = formatDate(property.createdAt || property.updatedAt);
    if (beds) beds.textContent = Number(property.bedrooms ?? 0) || "—";
    if (baths) baths.textContent = Number(property.bathrooms ?? 0) || "—";
    if (price) price.textContent = formatPrice(property.price);
    if (note) note.textContent = property.listingType === "rent" ? "Per month" : "Total asking price";
    if (owner) owner.textContent = property.ownerName || "Owner";
    if (crumb) crumb.textContent = property.title || "Listing";

    if (amenitiesList) {
      const amenities = Array.isArray(property.amenities) ? property.amenities : [];
      amenitiesList.innerHTML = amenities.length
        ? amenities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : "<li>No amenities listed.</li>";
    }

    if (contactButton) {
      contactButton.href = property.contact ? `tel:${property.contact}` : "#";
      contactButton.textContent = property.contact ? "Call owner" : "Contact unavailable";
      if (!property.contact) {
        contactButton.setAttribute("aria-disabled", "true");
      }
    }
    if (contactNote) {
      contactNote.textContent = property.contact ? `Owner contact: ${property.contact}` : "The owner has not added a contact number yet.";
    }

    renderGallery(property.images);

    const favoriteButton = qs("[data-property-favorite]");
    if (favoriteButton) {
      const favoriteIds = new Set(await getFavoriteIds(auth.currentUser?.uid));
      const isFavorite = favoriteIds.has(propertyId);
      favoriteButton.classList.toggle("is-active", isFavorite);
      favoriteButton.textContent = isFavorite ? "♥ Saved to favorites" : "♡ Save to favorites";
      favoriteButton.setAttribute("aria-pressed", String(isFavorite));
      favoriteButton.onclick = async () => {
        const next = await toggleFavorite(propertyId);
        if (next === null) return;

        const hasFavorite = next === true;
        favoriteButton.classList.toggle("is-active", hasFavorite);
        favoriteButton.textContent = hasFavorite ? "♥ Saved to favorites" : "♡ Save to favorites";
        favoriteButton.setAttribute("aria-pressed", String(hasFavorite));
      };
    }

    const enquiryForm = qs("[data-enquiry-form]");
    const enquiryWarning = qs("[data-enquiry-auth-warning]");
    const buyerNameInput = enquiryForm ? qs("[name='buyerName']", enquiryForm) : null;
    const buyerEmailInput = enquiryForm ? qs("[name='buyerEmail']", enquiryForm) : null;
    const buyerPhoneInput = enquiryForm ? qs("[name='buyerPhone']", enquiryForm) : null;

    if (auth.currentUser) {
      const buyerProfile = await getUserProfile(auth.currentUser.uid);
      if (buyerNameInput) buyerNameInput.value = buyerProfile?.name || auth.currentUser.displayName || "";
      if (buyerEmailInput) buyerEmailInput.value = buyerProfile?.email || auth.currentUser.email || "";
      if (buyerPhoneInput) buyerPhoneInput.value = buyerProfile?.phone || auth.currentUser.phoneNumber || "";
      if (enquiryWarning) enquiryWarning.hidden = true;
      if (enquiryForm) enquiryForm.hidden = false;

      if (enquiryForm) {
        enquiryForm.onsubmit = async (event) => {
          event.preventDefault();
          const submitButton = qs("[data-enquiry-submit]", enquiryForm);
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Sending...";
          }

          try {
            const message = String(qs("[name='message']", enquiryForm)?.value || "").trim();
            const result = await createEnquiry({
              propertyId,
              propertyTitle: property.title || "Property listing",
              sellerId: property.ownerId,
              sellerName: property.ownerName || "Seller",
              message
            });

            if (result) {
              showToast("Your enquiry has been sent successfully.", "success");
              enquiryForm.reset();
              const buyerProfileRefresh = await getUserProfile(auth.currentUser.uid);
              if (buyerNameInput) buyerNameInput.value = buyerProfileRefresh?.name || auth.currentUser.displayName || "";
              if (buyerEmailInput) buyerEmailInput.value = buyerProfileRefresh?.email || auth.currentUser.email || "";
              if (buyerPhoneInput) buyerPhoneInput.value = buyerProfileRefresh?.phone || auth.currentUser.phoneNumber || "";
            }
          } catch (error) {
            showToast(error?.message || "Could not send your enquiry.", "error");
          } finally {
            const submitButton = qs("[data-enquiry-submit]", enquiryForm);
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = "Send Enquiry";
            }
          }
        };
      }
    } else {
      if (enquiryWarning) enquiryWarning.hidden = false;
      if (enquiryForm) enquiryForm.hidden = true;
    }

    if (state) state.hidden = true;
    if (content) content.hidden = false;
  } catch (error) {
    renderState(state, {
      title: "Could not load this property",
      message: "Please try again in a moment.",
      tone: "error"
    });
    console.error(error);
  }
}

onReady(() => {
  const propertyId = getParam("id");
  if (propertyId) {
    loadProperty(propertyId);
  }
});

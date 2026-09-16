/**
 * add-property.js — add-property.html
 * Creates a document in the `properties` collection, and updates an existing
 * one when the page is opened as add-property.html?id=PROPERTY_ID.
 *
 * Ownership always comes from auth.currentUser.uid, never from the form.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db, DB } from "./firebase-config.js";
import { guardPage, getUserProfile, describeError } from "./auth.js";
import "./navbar.js";
import {
  qs,
  qsa,
  onReady,
  getParam,
  escapeHtml,
  renderState,
  showToast,
  AMENITIES
} from "./utils.js";

const MAX_IMAGES = 8;
let editingId = null;

/* -------------------------------------------------------------------------
   Form scaffolding
   ------------------------------------------------------------------------- */

/** Build the amenity checkboxes from the shared list. */
function renderAmenities(selected = []) {
  const host = qs("[data-amenities]");
  if (!host) return;
  host.innerHTML = AMENITIES.map(
    (name) => `
      <label class="checkbox">
        <input type="checkbox" name="amenities" value="${escapeHtml(name)}"${
          selected.includes(name) ? " checked" : ""
        } />
        ${escapeHtml(name)}
      </label>`
  ).join("");
}

/** One image URL row. */
function imageRow(value = "") {
  const row = document.createElement("div");
  row.className = "repeater__row";
  row.innerHTML = `
    <input type="url" name="images" placeholder="https://example.com/photo.jpg" value="${escapeHtml(value)}" />
    <button class="repeater__remove" type="button" data-remove-image aria-label="Remove this image">&times;</button>`;
  return row;
}

function renderImageRows(urls = []) {
  const host = qs("[data-image-rows]");
  if (!host) return;
  host.innerHTML = "";
  const list = urls.length ? urls : [""];
  list.slice(0, MAX_IMAGES).forEach((url) => host.appendChild(imageRow(url)));
}

function setupImageRepeater() {
  const host = qs("[data-image-rows]");
  const addButton = qs("[data-add-image]");
  if (!host || !addButton) return;

  addButton.addEventListener("click", () => {
    if (qsa(".repeater__row", host).length >= MAX_IMAGES) {
      showToast(`You can add up to ${MAX_IMAGES} images.`, "error");
      return;
    }
    host.appendChild(imageRow());
  });

  host.addEventListener("click", (event) => {
    if (!event.target.closest("[data-remove-image]")) return;
    const rows = qsa(".repeater__row", host);
    if (rows.length === 1) {
      qs("input", rows[0]).value = "";
      return;
    }
    event.target.closest(".repeater__row").remove();
  });
}

/** Rent listings quote a monthly figure, sales a total. */
function setupPriceHint(form) {
  const listingType = form.elements.listingType;
  const hint = qs("[data-price-hint]", form);
  if (!listingType || !hint) return;
  const update = () => {
    hint.textContent =
      listingType.value === "rent" ? "Monthly rent." : "Total asking price.";
  };
  listingType.addEventListener("change", update);
  update();
}

/* -------------------------------------------------------------------------
   Reading and validating the form
   ------------------------------------------------------------------------- */

/** Collect the form into the shape stored in Firestore. */
function readForm(form) {
  const data = new FormData(form);
  const number = (key) => {
    const raw = String(data.get(key) ?? "").trim();
    return raw === "" ? null : Number(raw);
  };

  return {
    title: String(data.get("title") || "").trim(),
    description: String(data.get("description") || "").trim(),
    price: number("price"),
    location: String(data.get("location") || "").trim(),
    propertyType: String(data.get("propertyType") || ""),
    listingType: String(data.get("listingType") || ""),
    bedrooms: number("bedrooms") ?? 0,
    bathrooms: number("bathrooms") ?? 0,
    area: number("area"),
    amenities: data.getAll("amenities").map(String),
    images: data
      .getAll("images")
      .map((url) => String(url).trim())
      .filter(Boolean)
      .slice(0, MAX_IMAGES),
    contact: String(data.get("contact") || "").trim()
  };
}

/** Returns the first problem with the submitted values, or null. */
function validateProperty(values) {
  if (values.title.length < 6) return "Give the listing a title of at least 6 characters.";
  if (values.description.length < 20) return "Write a description of at least 20 characters.";
  if (!Number.isFinite(values.price) || values.price <= 0) return "Enter a price above zero.";
  if (!values.location) return "Enter the locality and city.";
  if (!values.propertyType) return "Choose a property type.";
  if (!values.listingType) return "Choose whether this is for sale or for rent.";
  if (!Number.isFinite(values.area) || values.area <= 0) return "Enter the area in square feet.";
  if (!/^[+\d][\d\s-]{7,16}$/.test(values.contact)) return "Enter a valid contact number.";
  if (values.images.some((url) => !/^https?:\/\//i.test(url)))
    return "Image links must start with http:// or https://";
  return null;
}

/* -------------------------------------------------------------------------
   UI feedback
   ------------------------------------------------------------------------- */

function showAlert(form, message, tone = "error") {
  const box = qs("[data-form-alert]", form);
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
  box.classList.toggle("alert--error", tone === "error");
  box.classList.toggle("alert--success", tone === "success");
  box.scrollIntoView({ block: "nearest" });
}

function clearAlert(form) {
  const box = qs("[data-form-alert]", form);
  if (!box) return;
  box.hidden = true;
  box.textContent = "";
}

function setBusy(form, busy) {
  const button = qs("button[type='submit']", form);
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  const label = qs("[data-btn-label]", button);
  if (label) {
    if (busy) {
      label.dataset.idle = label.dataset.idle || label.textContent;
      label.textContent = label.dataset.busy || "Please wait";
    } else if (label.dataset.idle) {
      label.textContent = label.dataset.idle;
    }
  }
}

/* -------------------------------------------------------------------------
   Firestore writes
   ------------------------------------------------------------------------- */

/** Create a new property owned by the signed-in user. */
export async function createProperty(values, user, ownerName) {
  const reference = await addDoc(collection(db, DB.properties), {
    ...values,
    ownerId: user.uid,
    ownerName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  // Mirror the generated id into the document so reads carry it too.
  await updateDoc(reference, { id: reference.id });
  return reference.id;
}

/** Update a property the signed-in user owns. */
export async function updateProperty(propertyId, values) {
  await updateDoc(doc(db, DB.properties, propertyId), {
    ...values,
    updatedAt: serverTimestamp()
  });
  return propertyId;
}

/* -------------------------------------------------------------------------
   Edit mode
   ------------------------------------------------------------------------- */

/** Put an existing property into the form. Owner check happens here too. */
async function loadForEditing(form, propertyId, user) {
  const snapshot = await getDoc(doc(db, DB.properties, propertyId));

  if (!snapshot.exists()) {
    renderState(qs("[data-form-state]"), {
      title: "Listing not found",
      message: "It may have been deleted. Check your dashboard for current listings."
    });
    return false;
  }

  const property = snapshot.data();
  if (property.ownerId !== user.uid) {
    renderState(qs("[data-form-state]"), {
      title: "Not your listing",
      message: "You can only edit properties you published."
    });
    return false;
  }

  form.elements.title.value = property.title || "";
  form.elements.description.value = property.description || "";
  form.elements.price.value = property.price ?? "";
  form.elements.location.value = property.location || "";
  form.elements.propertyType.value = property.propertyType || "house";
  form.elements.listingType.value = property.listingType || "sale";
  form.elements.bedrooms.value = property.bedrooms ?? "";
  form.elements.bathrooms.value = property.bathrooms ?? "";
  form.elements.area.value = property.area ?? "";
  form.elements.contact.value = property.contact || "";

  renderAmenities(Array.isArray(property.amenities) ? property.amenities : []);
  renderImageRows(Array.isArray(property.images) ? property.images : []);

  qs("[data-form-heading]").textContent = "Edit listing";
  qs("[data-form-crumb]").textContent = "Edit listing";
  qs("[data-form-intro]").textContent = "Update the details and save your changes.";
  const label = qs("[data-btn-label]", form);
  if (label) label.textContent = "Save changes";

  return true;
}

/* -------------------------------------------------------------------------
   Submit
   ------------------------------------------------------------------------- */

function setupSubmit(form, ownerName) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(form);

    // Ownership is re-checked at submit time, not just on page load.
    const user = auth.currentUser;
    if (!user) {
      showAlert(form, "Your session ended. Sign in again to publish.");
      window.location.replace("login.html?next=add-property.html");
      return;
    }

    const values = readForm(form);
    const problem = validateProperty(values);
    if (problem) {
      showAlert(form, problem);
      return;
    }

    setBusy(form, true);
    try {
      if (editingId) {
        await updateProperty(editingId, values);
        showToast("Listing updated.");
      } else {
        await createProperty(values, user, ownerName);
        showToast("Listing published.");
      }
      window.location.href = "dashboard.html";
    } catch (error) {
      showAlert(form, describeError(error));
      setBusy(form, false);
    }
  });
}

/* -------------------------------------------------------------------------
   Start
   ------------------------------------------------------------------------- */

onReady(async () => {
  const form = qs("[data-property-form]");
  if (!form) return;

  // Only signed-in owners reach the listing form.
  const user = await guardPage();
  if (!user) return;

  const profile = await getUserProfile();
  const ownerName = profile?.name || user.displayName || user.email || "Owner";

  renderAmenities();
  renderImageRows();
  setupImageRepeater();
  setupPriceHint(form);

  editingId = getParam("id");
  if (editingId) {
    const ready = await loadForEditing(form, editingId, user);
    if (!ready) return;
  }

  form.hidden = false;
  setupSubmit(form, ownerName);
});

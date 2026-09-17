/**
 * add-property.js — add-property.html
 * Creates a document in the `properties` collection, and updates an existing
 * one when the page is opened as add-property.html?id=PROPERTY_ID.
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
import { guardPage, getUserProfile, describeError, normalizeRole } from "./auth.js";
import { cloudinaryConfig, isCloudinaryConfigured } from "./cloudinary-config.js";
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

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
let editingId = null;
let previewItems = [];

function renderAmenities(selected = []) {
  const host = qs("[data-amenities]");
  if (!host) return;

  host.innerHTML = AMENITIES.map((name) => `
    <label class="checkbox">
      <input type="checkbox" name="amenities" value="${escapeHtml(name)}"${selected.includes(name) ? " checked" : ""} />
      ${escapeHtml(name)}
    </label>
  `).join("");
}

function renderPreview() {
  const host = qs("[data-photo-grid]");
  const status = qs("[data-upload-status]");
  const errors = qs("[data-image-errors]");

  if (!host) return;
  host.innerHTML = "";

  if (!previewItems.length) {
    if (status) status.textContent = "No photos selected yet.";
    return;
  }

  previewItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "photo-grid__item";

    const previewUrl = item.type === "upload" ? URL.createObjectURL(item.value) : item.value;
    card.innerHTML = `
      <img src="${escapeHtml(previewUrl)}" alt="Property preview ${index + 1}" loading="lazy" />
      <button type="button" class="btn btn--ghost btn--sm" data-remove-preview="${index}">Remove</button>
    `;
    host.appendChild(card);
  });

  if (status) status.textContent = `${previewItems.length} photo${previewItems.length === 1 ? "" : "s"} selected`;
  if (errors) {
    errors.hidden = true;
    errors.textContent = "";
  }
}

function addPreviewFiles(files) {
  const form = qs("[data-property-form]");
  const fileList = Array.from(files || []);
  if (!fileList.length) return;

  const remainingSlots = MAX_IMAGES - previewItems.length;
  if (remainingSlots <= 0) {
    if (form) showAlert(form, `You can add up to ${MAX_IMAGES} photos.`, "error");
    return;
  }

  const validFiles = [];
  const invalidFiles = [];

  fileList.forEach((file) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      invalidFiles.push(`${file.name} is not a supported image type.`);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      invalidFiles.push(`${file.name} must be 5 MB or smaller.`);
      return;
    }

    validFiles.push(file);
  });

  if (invalidFiles.length) {
    const errorBox = qs("[data-image-errors]");
    if (errorBox) {
      errorBox.textContent = invalidFiles.join(" ");
      errorBox.hidden = false;
    }
  }

  const accepted = validFiles.slice(0, remainingSlots);
  if (accepted.length) {
    accepted.forEach((file) => previewItems.push({ type: "upload", value: file }));
    renderPreview();
  }

  const input = qs("[data-image-input]");
  if (input) input.value = "";
}

function setupImagePicker() {
  const input = qs("[data-image-input]");
  const host = qs("[data-photo-grid]");
  if (!input || !host) return;

  input.addEventListener("change", (event) => {
    addPreviewFiles(event.target.files);
  });

  host.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-preview]");
    if (!button) return;
    const index = Number(button.dataset.removePreview);
    if (Number.isNaN(index)) return;
    previewItems.splice(index, 1);
    renderPreview();
  });
}

function setupPriceHint(form) {
  const listingType = form.elements.listingType;
  const hint = qs("[data-price-hint]", form);
  if (!listingType || !hint) return;

  const update = () => {
    hint.textContent = listingType.value === "rent" ? "Monthly rent." : "Total asking price.";
  };

  listingType.addEventListener("change", update);
  update();
}

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
    contact: String(data.get("contact") || "").trim()
  };
}

function validateProperty(values) {
  if (values.title.length < 6) return "Give the listing a title of at least 6 characters.";
  if (values.description.length < 20) return "Write a description of at least 20 characters.";
  if (!Number.isFinite(values.price) || values.price <= 0) return "Enter a price above zero.";
  if (!values.location) return "Enter the locality and city.";
  if (!values.propertyType) return "Choose a property type.";
  if (!values.listingType) return "Choose whether this is for sale or for rent.";
  if (!Number.isFinite(values.area) || values.area <= 0) return "Enter the area in square feet.";
  if (!/^[+\d][\d\s-]{7,16}$/.test(values.contact)) return "Enter a valid contact number.";
  return null;
}

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

export async function createProperty(values, user, ownerName) {
  const reference = await addDoc(collection(db, DB.properties), {
    ...values,
    images: [],
    ownerId: user.uid,
    ownerName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(reference, { id: reference.id });
  return reference.id;
}

export async function updateProperty(propertyId, values) {
  await updateDoc(doc(db, DB.properties, propertyId), {
    ...values,
    updatedAt: serverTimestamp()
  });
  return propertyId;
}

async function uploadSelectedImages(propertyId, ownerId, files) {
  if (!files.length) return [];

  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Set cloudName and uploadPreset in js/cloudinary-config.js.");
  }

  const urls = [];
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", cloudinaryConfig.uploadPreset);
    formData.append("folder", `veranda/properties/${ownerId}/${propertyId}`);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    });

    const payload = await response.json();
    if (!response.ok || !payload.secure_url) {
      throw new Error(payload?.error?.message || "Image upload failed.");
    }

    urls.push(payload.secure_url);
  }

  return urls;
}

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
  previewItems = (Array.isArray(property.images) ? property.images : []).map((url) => ({ type: "existing", value: url }));
  renderPreview();

  qs("[data-form-heading]").textContent = "Edit listing";
  qs("[data-form-crumb]").textContent = "Edit listing";
  qs("[data-form-intro]").textContent = "Update the details and save your changes.";
  const label = qs("[data-btn-label]", form);
  if (label) label.textContent = "Save changes";

  return true;
}

function setupSubmit(form, ownerName) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(form);

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

    const existingUrls = previewItems.filter((item) => item.type === "existing").map((item) => item.value);
    const newFiles = previewItems.filter((item) => item.type === "upload").map((item) => item.value);

    setBusy(form, true);

    try {
      if (editingId) {
        const uploadedUrls = await uploadSelectedImages(editingId, user.uid, newFiles);
        await updateProperty(editingId, { ...values, images: [...existingUrls, ...uploadedUrls] });
        showToast("Listing updated.");
      } else {
        const propertyId = await createProperty({ ...values, images: [] }, user, ownerName);
        const uploadedUrls = await uploadSelectedImages(propertyId, user.uid, newFiles);
        await updateProperty(propertyId, { images: uploadedUrls });
        showToast("Listing published.");
      }

      window.location.href = "dashboard.html";
    } catch (error) {
      showAlert(form, describeError(error));
      setBusy(form, false);
    }
  });
}

onReady(async () => {
  const form = qs("[data-property-form]");
  if (!form) return;

  const userGuard = await guardPage();
  if (!userGuard) return;

  const profile = await getUserProfile(userGuard.uid);
  const role = normalizeRole(profile?.role);
  if (role !== "seller") {
    window.location.replace("dashboard.html");
    return;
  }

  const ownerName = profile?.name || userGuard.displayName || userGuard.email || "Owner";

  renderAmenities();
  previewItems = [];
  renderPreview();
  setupImagePicker();
  setupPriceHint(form);

  editingId = getParam("id");
  if (editingId) {
    const ready = await loadForEditing(form, editingId, user);
    if (!ready) return;
  }

  form.hidden = false;
  setupSubmit(form, ownerName);
});

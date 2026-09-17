import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db, DB } from "./firebase-config.js";
import {
  getUserProfile,
  guardPage,
  requireRole
} from "./auth.js";
import "./navbar.js";
import {
  qs,
  renderState,
  showToast,
  formatDate,
  escapeHtml
} from "./utils.js";

function statusLabel(status = "new") {
  return String(status || "new").replace(/^\w/, (char) => char.toUpperCase());
}

function statusClass(status = "new") {
  return `status-pill status-pill--${String(status || "new").toLowerCase()}`;
}

function sortByNewest(left, right) {
  const timestamp = (value) => {
    if (value?.toDate) return value.toDate().getTime();
    return Number(value?.seconds || 0) * 1000;
  };

  return timestamp(right.createdAt) - timestamp(left.createdAt);
}

function renderBuyerEmpty(container) {
  renderState(container, {
    title: "No enquiries yet.",
    message: "Your inquiries about properties will appear here once you contact a seller."
  });

  const cta = document.createElement("a");
  cta.href = "properties.html";
  cta.className = "btn btn--primary";
  cta.textContent = "Browse properties";
  cta.style.marginTop = "1rem";
  container.appendChild(cta);
}

function renderSellerEmpty(container) {
  renderState(container, {
    title: "No enquiries received.",
    message: "New buyer enquiries will appear here for your listings."
  });
}

function makeBuyerRow(enquiry) {
  return `
    <div class="dash-item" data-enquiry-id="${escapeHtml(enquiry.id)}">
      <div>
        <p class="dash-item__title">
          <a href="property-details.html?id=${encodeURIComponent(enquiry.propertyId)}">
            ${escapeHtml(enquiry.propertyTitle || "Property listing")}
          </a>
        </p>
        <p class="dash-item__meta">Seller: ${escapeHtml(enquiry.sellerName || "Seller")} &middot; ${escapeHtml(enquiry.status ? statusLabel(enquiry.status) : "New")}</p>
        <p class="dash-item__meta">${escapeHtml(enquiry.message || "No message provided.")}</p>
      </div>
      <div class="dash-item__actions">
        <span class="${statusClass(enquiry.status)}">${escapeHtml(statusLabel(enquiry.status))}</span>
        <small>${escapeHtml(formatDate(enquiry.createdAt))}</small>
      </div>
    </div>
  `;
}

function makeSellerRow(enquiry) {
  const actions = [
    '<button type="button" class="btn btn--ghost btn--sm" data-enquiry-status="contacted" data-enquiry-id="' + escapeHtml(enquiry.id) + '">Mark as Contacted</button>',
    '<button type="button" class="btn btn--ghost btn--sm" data-enquiry-status="closed" data-enquiry-id="' + escapeHtml(enquiry.id) + '">Mark as Closed</button>'
  ].join("");

  return `
    <div class="dash-item" data-enquiry-id="${escapeHtml(enquiry.id)}">
      <div>
        <p class="dash-item__title">
          <a href="property-details.html?id=${encodeURIComponent(enquiry.propertyId)}">
            ${escapeHtml(enquiry.propertyTitle || "Property listing")}
          </a>
        </p>
        <p class="dash-item__meta">Buyer: ${escapeHtml(enquiry.buyerName || "Buyer")} &middot; ${escapeHtml(enquiry.buyerEmail || "No email")} &middot; ${escapeHtml(enquiry.buyerPhone || "No phone")}</p>
        <p class="dash-item__meta">${escapeHtml(enquiry.message || "No message provided.")}</p>
      </div>
      <div class="dash-item__actions enquiry-item__actions">
        <span class="${statusClass(enquiry.status)}">${escapeHtml(statusLabel(enquiry.status))}</span>
        <small>${escapeHtml(formatDate(enquiry.createdAt))}</small>
        <div class="enquiry-item__buttons">${actions}</div>
      </div>
    </div>
  `;
}

export async function createEnquiry({ propertyId, propertyTitle, sellerId, sellerName, message }) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please login to contact the seller.");
  }

  const trimmedMessage = String(message || "").trim();
  if (!trimmedMessage) {
    throw new Error("Message is required.");
  }

  if (trimmedMessage.length < 10) {
    throw new Error("Message must be at least 10 characters long.");
  }

  if (trimmedMessage.length > 1000) {
    throw new Error("Message must be less than 1000 characters.");
  }

  if (!propertyId || !sellerId) {
    throw new Error("This property is not available for enquiry.");
  }

  const propertyRef = doc(db, DB.properties, propertyId);
  const propertySnap = await getDoc(propertyRef);

  if (!propertySnap.exists()) {
    throw new Error("This property is no longer available.");
  }

  const property = propertySnap.data();
  if (!property?.ownerId) {
    throw new Error("This listing has no seller assigned.");
  }

  if (property.ownerId !== sellerId) {
    throw new Error("Seller details do not match this property.");
  }

  const profile = await getUserProfile(user.uid);
  const buyerName = (profile?.name || user.displayName || "Buyer").trim();
  const buyerEmail = (profile?.email || user.email || "").trim();
  const buyerPhone = (profile?.phone || user.phoneNumber || "").trim();

  if (!buyerName || !buyerEmail || !buyerPhone) {
    throw new Error("Please complete your profile name, email and phone before sending an enquiry.");
  }

  const enquiryDoc = {
    propertyId,
    propertyTitle: propertyTitle || property.title || "Property listing",
    buyerId: user.uid,
    buyerName,
    buyerEmail,
    buyerPhone,
    sellerId,
    sellerName: sellerName || property.ownerName || "Seller",
    message: trimmedMessage,
    status: "new",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await addDoc(collection(db, DB.enquiries), enquiryDoc);
  return true;
}

export async function fetchBuyerEnquiries(uid) {
  const q = query(
    collection(db, DB.enquiries),
    where("buyerId", "==", uid),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((entry) => ({ ...entry.data(), id: entry.id }))
    .sort(sortByNewest);
}

export async function fetchSellerEnquiries(uid) {
  const q = query(
    collection(db, DB.enquiries),
    where("sellerId", "==", uid),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((entry) => ({ ...entry.data(), id: entry.id }))
    .sort(sortByNewest);
}

export async function updateEnquiryStatus(enquiryId, status) {
  const allowed = ["new", "contacted", "closed"];
  if (!allowed.includes(status)) {
    throw new Error("Invalid enquiry status.");
  }

  const ref = doc(db, DB.enquiries, enquiryId);
  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp()
  });

  return true;
}

export async function loadBuyerEnquiriesPage() {
  const container = qs("[data-my-enquiries-list]");
  const count = qs("[data-result-count]");
  if (!container) return;

  try {
    const user = await guardPage();
    if (!user) return;

    const { role } = await requireRole(["buyer"], "dashboard.html");
    if (!role) return;

    const enquiries = await fetchBuyerEnquiries(user.uid);

    if (count) {
      count.textContent = enquiries.length
        ? `${enquiries.length} enquiry${enquiries.length === 1 ? "" : "ies"}`
        : "No enquiries yet";
    }

    if (!enquiries.length) {
      renderBuyerEmpty(container);
      return;
    }

    container.innerHTML = enquiries.map(makeBuyerRow).join("");
  } catch (error) {
    renderState(container, {
      title: "Could not load your enquiries",
      message: error?.message || "Please try again in a moment.",
      tone: "error"
    });
  }
}

export async function loadSellerEnquiriesPage() {
  const container = qs("[data-enquiries-list]");
  const count = qs("[data-result-count]");
  if (!container) return;

  try {
    const user = await guardPage();
    if (!user) return;

    const { role } = await requireRole(["seller"], "dashboard.html");
    if (!role) return;

    const enquiries = await fetchSellerEnquiries(user.uid);

    if (count) {
      count.textContent = enquiries.length
        ? `${enquiries.length} enquiry${enquiries.length === 1 ? "" : "ies"}`
        : "No enquiries yet";
    }

    if (!enquiries.length) {
      renderSellerEmpty(container);
      return;
    }

    container.innerHTML = enquiries.map(makeSellerRow).join("");

    document.querySelectorAll("[data-enquiry-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        const status = button.dataset.enquiryStatus;
        const enquiryId = button.dataset.enquiryId;
        if (!status || !enquiryId) return;

        button.disabled = true;
        button.textContent = "Updating...";

        try {
          await updateEnquiryStatus(enquiryId, status);
          showToast(`Enquiry marked as ${statusLabel(status)}.`, "success");
          await loadSellerEnquiriesPage();
        } catch (error) {
          showToast(error?.message || "Could not update enquiry status.", "error");
          button.disabled = false;
          button.textContent = status === "contacted" ? "Mark as Contacted" : "Mark as Closed";
        }
      });
    });
  } catch (error) {
    renderState(container, {
      title: "Could not load enquiries",
      message: error?.message || "Please try again in a moment.",
      tone: "error"
    });
  }
}

if (typeof window !== "undefined") {
  const page = window.location.pathname.split("/").pop();

  if (page === "my-enquiries.html") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadBuyerEnquiriesPage, { once: true });
    } else {
      loadBuyerEnquiriesPage();
    }
  }

  if (page === "enquiries.html") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadSellerEnquiriesPage, { once: true });
    } else {
      loadSellerEnquiriesPage();
    }
  }
}

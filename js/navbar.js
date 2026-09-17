/** Shared, role-aware navbar renderer for every page. */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { auth } from "./firebase-config.js";
import { getUserProfile } from "./auth.js";
import { qs, qsa, onReady, setCurrentYear, escapeHtml } from "./utils.js";

const MOBILE_QUERY = "(max-width: 900px)";

function setupDrawer(nav) {
  const toggle = qs(".nav__toggle", nav);
  const drawer = qs(".nav__drawer", nav);
  if (!toggle || !drawer) return;

  const close = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };

  const open = () => {
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-open");
  };

  toggle.addEventListener("click", () => {
    nav.classList.contains("is-open") ? close() : open();
  });

  drawer.addEventListener("click", (event) => {
    if (event.target.closest("a") || event.target.closest("[data-account-toggle]")) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  document.addEventListener("click", (event) => {
    if (nav.classList.contains("is-open") && !nav.contains(event.target)) close();
  });

  const mq = window.matchMedia(MOBILE_QUERY);
  const onChange = (event) => {
    if (!event.matches) close();
  };
  mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
}

function markActiveLink(nav) {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const params = new URLSearchParams(window.location.search);
  const listingType = params.get("listingType") || params.get("purpose");

  qsa(".nav__link", nav).forEach((link) => {
    const target = (link.getAttribute("href") || "").split(/[?#]/)[0];
    const targetParams = new URL(link.href, window.location.href).searchParams;
    const isBuy = targetParams.get("listingType") === "sale";
    const isRent = targetParams.get("listingType") === "rent";
    const active = target === path || (path === "properties.html" && ((isBuy && listingType === "sale") || (isRent && listingType === "rent")));
    if (active) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });

  qsa(".nav__dashboard-link", nav).forEach((link) => {
    if (path === "dashboard.html") link.classList.add("is-active");
  });
}

function setupScrollState(nav) {
  const update = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function pageName() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function brandMarkup() {
  return `<a class="brand" href="index.html"><span class="brand__mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/></svg></span>Veranda</a>`;
}

function navLink(label, href) {
  return `<li><a class="nav__link" href="${href}">${label}</a></li>`;
}

function accountMarkup(shortName, initials) {
  return `<a class="nav__avatar" href="dashboard.html" aria-label="Open dashboard for ${escapeHtml(shortName)}" title="Open dashboard">${escapeHtml(initials)}</a>`;
}

function setupAccountMenu(nav) {
  const toggle = qs("[data-account-toggle]", nav);
  const menu = qs("[data-account-menu]", nav);
  if (!toggle || !menu) return;

  const close = () => {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    toggle.setAttribute("aria-expanded", String(!menu.hidden));
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a") || event.target.closest("button")) close();
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

function renderAuthActions(nav, user, profile = null) {
  if (pageName() === "login.html") {
    nav.classList.add("nav--auth");
    nav.innerHTML = `<div class="shell nav__inner">${brandMarkup()}<a class="nav__back" href="index.html">Back to Home</a></div>`;
    return;
  }

  if (!qs(".nav__inner", nav)) {
    nav.innerHTML = `<div class="shell nav__inner">${brandMarkup()}
      <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-drawer" aria-label="Open menu"><span aria-hidden="true"></span></button>
      <div class="nav__drawer" id="nav-drawer"><ul class="nav__links"></ul><div class="nav__actions"></div></div>
    </div>`;
    setupDrawer(nav);
  }

  const actions = qs(".nav__actions", nav);
  const links = qs(".nav__links", nav);
  if (!actions) return;

  if (!user) {
    if (links) {
      links.innerHTML = `
        ${navLink("Properties", "properties.html")}
        ${navLink("About", "about.html")}
      `;
    }

    actions.innerHTML = `
      <a class="btn btn--ghost btn--sm" href="login.html">Login</a>
      <a class="btn btn--primary btn--sm" href="login.html#register">Sign Up</a>
    `;
    markActiveLink(nav);
    return;
  }

  const role = profile?.role === "seller" ? "seller" : "buyer";
  const name = profile?.name || user.displayName || user.email || "My account";
  const shortName = String(name).split(" ")[0] || "Account";
  const initials = String(name).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "A";

  if (links) {
    if (role === "seller") {
      links.innerHTML = `
        ${navLink("Properties", "properties.html")}
        ${navLink("My Listings", "dashboard.html#listings")}
        ${navLink("Enquiries", "enquiries.html")}
      `;
    } else {
      links.innerHTML = `
        ${navLink("Properties", "properties.html")}
        ${navLink("Favorites", "favorites.html")}
        ${navLink("My Enquiries", "my-enquiries.html")}
      `;
    }
  }

  if (role === "seller") {
    actions.innerHTML = `
      <a class="btn btn--primary btn--sm" href="add-property.html">+ Post Property</a>
      ${accountMarkup(shortName, initials)}
    `;
  } else {
    actions.innerHTML = `
      ${accountMarkup(shortName, initials)}
    `;
  }

  markActiveLink(nav);
}

export function initNavbar() {
  const nav = qs("[data-nav]");
  if (!nav) return;

  markActiveLink(nav);
  setupScrollState(nav);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      renderAuthActions(nav, null, null);
      return;
    }

    const profile = await getUserProfile(user.uid);
    renderAuthActions(nav, user, profile || { role: "buyer" });
  });
}

export function initShell() {
  onReady(() => {
    initNavbar();
    setCurrentYear();
  });
}

initShell();

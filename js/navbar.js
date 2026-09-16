/**
 * navbar.js
 * Shared header behaviour: mobile drawer, active link highlighting and the
 * subtle border that appears once the page scrolls.
 */

import { qs, qsa, onReady, setCurrentYear } from "./utils.js";

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

  // Close when a link inside the drawer is followed.
  drawer.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });

  // Close on Escape and when tapping outside the header.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  document.addEventListener("click", (event) => {
    if (nav.classList.contains("is-open") && !nav.contains(event.target)) close();
  });

  // Reset state when the viewport grows past the mobile breakpoint.
  const mq = window.matchMedia(MOBILE_QUERY);
  const onChange = (event) => {
    if (!event.matches) close();
  };
  mq.addEventListener ? mq.addEventListener("change", onChange)
                      : mq.addListener(onChange);
}

function markActiveLink(nav) {
  const path = window.location.pathname.split("/").pop() || "index.html";
  qsa(".nav__link", nav).forEach((link) => {
    const target = link.getAttribute("href");
    if (target === path) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });
}

function setupScrollState(nav) {
  const update = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

export function initNavbar() {
  const nav = qs("[data-nav]");
  if (!nav) return;
  setupDrawer(nav);
  markActiveLink(nav);
  setupScrollState(nav);
}

/** Every page calls this once; it wires the header and the footer year. */
export function initShell() {
  onReady(() => {
    initNavbar();
    setCurrentYear();
  });
}

initShell();

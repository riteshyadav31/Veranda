# Veranda — real estate website

A property listing site built with plain HTML5, CSS3 and vanilla JavaScript
modules. No framework, no build step, no dependencies. Firebase is planned as
the backend but is **not connected yet** — this repository is the Step 1
foundation.

## Structure

```text
real-estate/
├── index.html              Home: hero, search, featured properties, locations, CTA
├── properties.html         Listing grid with filters and sorting
├── property-details.html   Gallery, specifications, description, enquiry panel
├── add-property.html       Multi-section listing form
├── login.html              Sign in / create account
├── dashboard.html          Owner dashboard: overview, listings, enquiries, profile
├── about.html              Company and verification approach
├── contact.html            Contact details and message form
│
├── css/
│   ├── style.css           Design tokens + all component styles
│   └── responsive.css      Breakpoints at 1080 / 900 / 640 / 420 px
│
├── js/
│   ├── firebase-config.js  Credentials and collection names (placeholders)
│   ├── auth.js             Sign-in / register panels
│   ├── navbar.js           Mobile drawer, active link, scroll state
│   ├── home.js             Search tabs and search submit
│   ├── properties.js       Filter form ↔ URL parameters
│   ├── property-details.js Gallery interaction
│   ├── add-property.js     Image picker feedback, form validation
│   ├── dashboard.js        Sidebar panel switching
│   └── utils.js            DOM helpers, INR price and area formatting
└── README.md
```

## Running it

The pages use ES modules (`<script type="module">`), which browsers refuse to
load over `file://`. Serve the folder over HTTP:

```bash
cd real-estate
python3 -m http.server 5173
# open http://localhost:5173
```

Any static server works — the VS Code Live Server extension is fine too.

## Design system

All visual decisions live in CSS custom properties at the top of `css/style.css`.

| Token group | Values |
| --- | --- |
| Colour | `--ink` `#0e211b`, `--green` `#1c5142`, `--brass` `#b4813c`, `--paper` `#f5f7f3`, `--card` `#ffffff`, `--line` `#dde4dd` |
| Type | `--font-display` Bricolage Grotesque, `--font-body` Karla, scale `--step--1` → `--step-5` |
| Space | `--sp-1` → `--sp-9` |
| Shape | `--radius-sm`, `--radius`, `--radius-lg`, `--radius-pill` |
| Depth | `--shadow-sm`, `--shadow`, `--shadow-lg` |
| Motion | `--fast` 140ms, `--slow` 420ms, shared `--ease` |

Change a token once and every page follows. Reduced-motion preferences are
respected and focus rings are visible throughout.

## Markup conventions

- Every page: skip link → `<header class="nav">` → `<main id="main">` → `<footer class="footer">`.
- Reusable classes: `.shell`, `.section`, `.btn`, `.field`, `.panel`,
  `.property-card`, `.card-grid`, `.state`.
- JavaScript never selects on styling classes. It uses `data-*` hooks such as
  `data-nav`, `data-property-list`, `data-filter-form`, `data-gallery-main`,
  `data-dash-panel`, `data-auth-tab`.
- `.ph` blocks stand in for photographs until Storage URLs are available.

## What is deliberately not implemented

Step 1 ships structure and interface only:

- No Firebase SDK is loaded and nothing is initialised.
- No authentication, no property CRUD, no image upload.
- No mock API, no fake data layer. The listings visible on the pages are static
  markup that acts as the template Firebase data will replace.

Exported functions such as `loadProperties()`, `loadProperty()`,
`saveProperty()`, `signIn()` and `requireAuth()` exist as empty placeholders so
that Step 2 has a defined place to land.

## Step 2 (not started)

1. Fill in `js/firebase-config.js` from the Firebase console.
2. Load the modular SDK from `gstatic` and initialise app, auth, Firestore and
   Storage.
3. Implement auth, property CRUD, image upload and the dashboard queries in
   their existing module files.

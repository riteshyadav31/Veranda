# Veranda — Real Estate Platform

Veranda is a modern, responsive real-estate web platform designed to make property discovery, listing, and management simple and convenient. The platform allows users to explore homes, apartments, villas, plots, and commercial properties across Uttar Pradesh through a clean and professional interface.

## ✨ Features

- 🏠 Browse property listings
- 🔎 Search properties by title, location, or description
- 🎯 Filter properties by:
  - Listing type
  - Property type
  - Price range
  - Bedrooms
  - Bathrooms
  - Area
- ↕️ Sort properties by price, area, and listing date
- ❤️ Save properties to favorites
- 👤 Buyer and Seller accounts
- 🔐 Email/password authentication
- 🔑 Password reset functionality
- 🏡 Sellers can publish properties
- 📊 Seller dashboard for managing listings
- 📩 Property enquiry functionality
- 🖼️ Cloudinary integration for property images
- 🔥 Firebase Authentication and Firestore
- 📱 Responsive design for desktop, tablet, and mobile
- 🎨 Modern and professional real-estate UI

## 🛠️ Tech Stack

### Frontend

- HTML5
- CSS3
- JavaScript (ES Modules)
- Responsive Web Design

### Backend & Cloud Services

- Firebase Authentication
- Firebase Firestore
- Cloudinary

## 👥 User Roles

### Buyer

Buyers can:

- Browse available properties
- Search and filter listings
- View property details
- Save favorite properties
- Send enquiries to sellers

### Seller

Sellers can:

- Create an account as a seller
- Add property listings
- Upload property images
- Manage their listings
- Manage property enquiries

## 🔐 Authentication

Veranda uses Firebase Authentication for user account management.

The authentication system supports:

- User registration
- User login
- Buyer/Seller role selection
- Logout
- Password reset
- Authentication state management
- Role-based page access

## 🔥 Firebase

Firebase Firestore is used to store application data such as:

- User profiles
- Property listings
- Property information
- Enquiries
- Other application-related data

Firebase Authentication handles user account management and authentication.

## 🖼️ Cloudinary

Cloudinary is used for property image management. Property images can be uploaded through the listing workflow while Firebase handles the application's main data.

## 🔎 Property Search

The Properties page provides a modern search experience.

Users can search using:

- Location
- Property title
- Description
- Listing type
- Property type

Additional filters include:

- Minimum price
- Maximum price
- Bedrooms
- Bathrooms
- Minimum area
- Maximum area

Listings can also be sorted by:

- Newest
- Oldest
- Price: low to high
- Price: high to low
- Area: low to high
- Area: high to low

## 🎨 UI & Design

Veranda focuses on a clean and modern real-estate experience with:

- Professional typography
- Responsive layouts
- Modern property cards
- Clean navigation
- Modern search and filter interface
- Smooth hover effects
- Mobile-friendly layouts
- Dedicated page-level CSS
- Consistent visual design across the platform

Page-specific styling is separated into individual CSS files to keep the project organized and reduce unnecessary styling conflicts between pages.

## 📁 Project Structure

```text
Veranda/
│
├── index.html
├── about.html
├── properties.html
├── login.html
├── forgot-password.html
├── dashboard.html
├── add-property.html
├── contact.html
│
├── css/
│   ├── style.css
│   ├── responsive.css
│   ├── navbar.css
│   ├── login.css
│   ├── forgot-password.css
│   ├── about.css
│   └── properties.css
│
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── navbar.js
│   ├── properties.js
│   ├── home.js
│   └── utils.js
│
└── README.md
```

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/riteshyadav31/Veranda.git
```

### 2. Open the project

Open the project folder in VS Code.

### 3. Configure Firebase

Update the Firebase configuration in:

```text
js/firebase-config.js
```

Use your own Firebase project configuration.

### 4. Configure Cloudinary

Configure the Cloudinary settings required for property image uploads according to your project setup.

### 5. Run the project

Use the **Live Server** extension in VS Code.

Open the local project URL provided by Live Server.

## 🌐 Main Pages

| Page | Purpose |
|---|---|
| Home | Introduction and featured properties |
| Properties | Search, filter, sort, and browse listings |
| Property Details | View detailed property information |
| Login | Sign in and create an account |
| Forgot Password | Secure password recovery |
| Dashboard | Manage seller listings |
| Add Property | Create a new property listing |
| About | Information about Veranda |
| Contact | Contact and office information |

## 📱 Responsive Design

The website is designed to provide a consistent experience across:

- Desktop
- Laptop
- Tablet
- Mobile devices

## 📌 Project Goal

The goal of Veranda is to provide a simple and professional platform where buyers can discover properties and sellers can publish and manage their listings from one place.

The project focuses on combining a clean user experience with practical real-estate functionality and cloud-based services.

## 🔒 Security Note

Firebase configuration and Cloudinary settings should be configured using your own project credentials and appropriate security rules before deploying the application publicly.

Do not commit private secrets, service-account credentials, or sensitive API keys to a public repository.

## 📄 License

This project is developed for educational, learning, and portfolio purposes.

## 👨‍💻 Developer

**Ritesh Yadav**

MCA Graduate — KNIT Sultanpur

Interested in Web Development, Backend Development, JavaScript, Python, Firebase, and modern software development.

---

⭐ If you find this project useful, consider giving the repository a star!

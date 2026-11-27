# Vino Fitness Studio / PulseFit Gym Management System

A production-ready gym management platform featuring a high-performance **React + Vite** frontend, **Node.js + Express** REST API, **MongoDB** database, **Razorpay** payment gateway, and **Mantra MFS500** biometric fingerprint integration.

---

## Table of Contents
1. [Overview & Tech Stack](#overview--tech-stack)
2. [Quick Start & Local Setup](#quick-start--local-setup)
3. [Default Credentials](#default-credentials)
4. [Member Self-Registration & Payments](#member-self-registration--payments)
5. [Mantra Biometric & Attendance Kiosk](#mantra-biometric--attendance-kiosk)
6. [Security & Authentication Architecture](#security--authentication-architecture)
7. [Production Deployment Guide](#production-deployment-guide)
8. [Directory Structure](#directory-structure)

---

## Overview & Tech Stack

- **Frontend:** React 19, Vite, React Router, Recharts, Lucide Icons, Vanilla CSS with Apple/Obsidian luxury theme.
- **Backend:** Express 5, Node.js 22+, MongoDB / Mongoose ODM with multi-document ACID transactions.
- **Security:** In-memory JWT access tokens, HttpOnly refresh cookies, client-side SHA-256 hashing, bcrypt password storage, AES-256-GCM biometric encryption, and strict CORS allowlists.
- **Payments:** Razorpay Standard Checkout with server-side HMAC-SHA256 signature verification and refund reconciliation.
- **Biometrics:** Mantra MFS500 / MorFin Auth SDK with Web Locks hardware concurrency, server-side cooldowns, and anti-replay latches.

---

## Quick Start & Local Setup

### Prerequisites
- **Node.js:** 20.x or 22.x LTS
- **MongoDB:** Transaction-capable MongoDB replica set (MongoDB Atlas or a local replica set).

### Installation & Startup

```powershell
# 1. Install root and client dependencies
npm.cmd install

# 2. Configure environment files (copy examples if not already present)
Copy-Item client/.env.example client/.env.local
Copy-Item server/.env.example server/.env

# 3. Seed development database (plans, slots, demo accounts)
npm.cmd run seed

# 4. Start backend API and Vite frontend concurrently
npm.cmd run dev
```

The application will be accessible at:
- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:5000/api`
- **Interactive API Docs:** `http://localhost:5173/api-docs` or `http://localhost:5000/api/docs`

---

## Default Credentials

Run `npm run seed` against your development database to create initial accounts:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@pulsefit.com` | `admin123` | Full studio operations, finance, staff, settings |
| **Reception** | `reception@pulsefit.com` | `reception123` | Member onboarding, attendance kiosk, check-ins |
| **Trainer** | `trainer@pulsefit.com` | `trainer123` | Client schedules, member attendance, workout tracking |
| **Member** | `member@pulsefit.com` | `member123` | Personal profile, active membership, attendance history |
| **Kiosk** | `kiosk@pulsefit.com` | `kiosk123` | Standalone biometric check-in/out terminal |

> *Note: Seed accounts are restricted to development databases (`NODE_ENV !== 'production'`).*

---

## Member Self-Registration & Payments

The application provides a seamless, self-service member onboarding funnel:

```
[Basic Details] ──> [Health & Consent] ──> [Select Plan] ──> [Select Slot] ──> [Select Trainer] ──> [Razorpay Checkout] ──> [Active Membership]
```

1. **State Preservation:** Registration drafts are stored server-side. Members can close their browser and resume anytime using their email and password.
2. **Razorpay Checkout:** The server creates INR orders via Razorpay Orders API. The client opens Razorpay Standard Checkout.
3. **Verification:** The backend validates the payment signature using `crypto.timingSafeEqual`, queries the captured payment status directly from Razorpay, and atomically allocates gym slot capacity and membership activation within a single database transaction.
4. **Refunds:** Full refunds are executed server-side through Razorpay and logged in the local audit trail.

---

## Mantra Biometric & Attendance Kiosk

### Architecture
- **Hardware Model:** Mantra MFS500 optical fingerprint scanner.
- **Workstation Client:** Runs locally via Mantra MorFin Auth Client Service (`https://localhost:8030/morfinauth`).
- **Encrypted Storage:** Fingerprint templates (FMR_V2005) are encrypted with **AES-256-GCM** using unique 12-byte random nonces and AAD binding before saving to MongoDB. Raw fingerprint images are never stored.

### Attendance Workflow
1. Reception opens the `/kiosk` or `/admin/attendance` scanning terminal.
2. The browser acquires a **Web Lock** (`pulsefit-morfinauth`) ensuring only one active scanner session per workstation.
3. Members scan their finger. The backend matches the decrypted template, enforces operating hours, verifies active paid memberships, applies a 60-second duplicate scan cooldown, and records the session.

---

## Security & Authentication Architecture

1. **Client-Side SHA-256 Hashing:** Plaintext passwords are never visible in browser DevTools Network payloads. They are hashed using the Web Crypto API before network dispatch.
2. **Database Hashing:** Passwords in MongoDB are salted and hashed using **bcrypt (cost factor 10)**.
3. **Token Isolation:** Access tokens exist in-memory only; refresh tokens are stored in `HttpOnly`, `SameSite=None`, `Secure` cookies. Zero JWT tokens are written to `localStorage`.
4. **CORS Whitelist:** Strict domain allowlist (`vinofitnessstudio.vercel.app`, Vercel previews, local development) without wildcard reflection.
5. **Rate Limiting:** Brute-force protection applied across login, token refresh, registration checkout, and biometric endpoints.
6. **Error Sanitization:** Stack traces and internal database errors are suppressed in production mode.

---

## Production Deployment Guide

### Environment Variables Checklist

#### Backend (`server/.env` or Cloud Secret Manager):
```dotenv
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pulsefit?retryWrites=true&w=majority
JWT_SECRET=<64-char-random-hex-secret>
JWT_REFRESH_SECRET=<different-64-char-random-hex-secret>
FRONTEND_URL=https://vinofitnessstudio.vercel.app
PAYMENT_GATEWAY_ENABLED=true
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_live_key_secret
BIOMETRIC_KEY_VERSION=v1
BIOMETRIC_ENCRYPTION_KEYS={"v1":"<32-random-base64-bytes>"}
```

#### Frontend (`client/.env.production` or Vercel Environment Variables):
```dotenv
VITE_API_URL=https://api-vinofitnessstudio.onrender.com/api
```

### Production Initialization Commands
```powershell
# 1. Build optimized client bundle
npm.cmd run build

# 2. Synchronize database indexes safely without dropping data
npm.cmd run db:indexes

# 3. Create your first production administrator (one-time setup)
$env:ADMIN_EMAIL="admin@yourstudio.com"
$env:ADMIN_PASSWORD="StrongSecurePassword123!"
npm.cmd run admin:create
```

---

## Directory Structure

```
Gym-Management-app-new/
├── client/                     # React + Vite Frontend
│   ├── public/                 # Favicons, logos, audio prompts
│   ├── src/
│   │   ├── components/         # Reusable modals, skeletons, receipts, layout
│   │   ├── contexts/           # Authentication state context
│   │   ├── pages/              # Landing, Login, Register, Dashboard, Kiosk, Docs
│   │   ├── services/           # Axios API client, auth, registration, payments
│   │   └── utils/              # Client crypto & audio helpers
│   ├── package.json            # Frontend dependencies
│   ├── vercel.json             # Vercel deployment routes
│   └── vite.config.js          # Optimized Vite bundler configuration
├── server/                     # Node.js + Express API Backend
│   ├── config/                 # DB connection and env schema validation
│   ├── controllers/            # Route controllers (auth, members, payments, biometrics)
│   ├── docs/                   # Swagger OpenAPI specs
│   ├── middleware/             # Auth JWT, rate limiters, error handling
│   ├── models/                 # Mongoose database models
│   ├── routes/                 # Express API endpoints
│   ├── services/               # Biometric encryption, allocation, lifecycle
│   ├── utils/                  # Receipts, date math, circuit breaker
│   ├── bootstrapAdmin.js       # Production admin creation CLI
│   ├── createIndexes.js        # MongoDB index provisioning
│   ├── seed.js                 # Dev database seeder
│   └── index.js                # Express app entrypoint
├── k8s/                        # Kubernetes manifest templates
├── nginx/                      # Nginx reverse proxy configs
├── package.json                # Project scripts & dependencies
└── README.md                   # Unified project documentation
```

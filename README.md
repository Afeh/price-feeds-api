# price-feeds-api

A live price feeds backend built on Express.js + MongoDB. Provides user authentication, token favourites management, and push notifications triggered by Pyth Network confidence level changes.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Push Notifications Setup](#push-notifications-setup)
- [Background Workers](#background-workers)
- [Error Handling](#error-handling)
- [Scripts](#scripts)

---

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB via Mongoose
- **Auth**: JWT (access token) + HttpOnly cookie (refresh token)
- **Push Notifications**: Web Push Protocol (`web-push`)
- **Price Data**: [Pyth Hermes API](https://hermes.pyth.network)
- **Validation**: Zod
- **Scheduling**: node-cron

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Express App                       │
│                                                      │
│  /auth   /favourites   /feeds   /notifications       │
│                                                      │
│  middleware: auth · validate · rateLimiter · errors  │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
    ┌─────▼──────┐    ┌────────▼────────┐
    │  MongoDB   │    │  Pyth Hermes    │
    │            │    │  (external API) │
    │  Users     │    └─────────────────┘
    │  Favourites│             ▲
    │  PriceFeeds│             │
    │  Alerts    │    ┌────────┴────────┐
    │  PushSubs  │    │ Background      │
    └────────────┘    │ Workers         │
                      │                 │
                      │ feedSync (24h)  │
                      │ priceMonitor    │
                      │ (60s)          │
                      └────────────────┘
```

The frontend connects directly to Pyth Hermes for live price streaming and chart data. This backend is responsible only for user data, favourites, and push notification delivery.

---

## Prerequisites

- Node.js >= 18
- MongoDB >= 6 (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A modern browser that supports the Push API (for notifications)

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/price-feeds-api.git
cd price-feeds-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in all required values in `.env` — see [Environment Variables](#environment-variables) below.

### 3. Generate VAPID keys

VAPID keys are required for Web Push. Generate them once and paste the output into your `.env`:

```bash
node -e "const wp = require('web-push'); console.log(wp.generateVAPIDKeys())"
```

### 4. Run in development

```bash
npm run dev
```

On boot the server will:
- Connect to MongoDB
- Run an immediate Pyth feed catalogue sync (populates the `pricefeeds` collection)
- Start the price monitor worker (fires every 60s)

### 5. Verify

```bash
curl http://localhost:5000/health
# → { "status": "ok", "uptime": 3.21 }
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in each value.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port the server listens on |
| `MONGO_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | **Yes** | — | Secret for signing refresh tokens |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `VAPID_PUBLIC_KEY` | **Yes** | — | VAPID public key (generate once, see above) |
| `VAPID_PRIVATE_KEY` | **Yes** | — | VAPID private key |
| `VAPID_EMAIL` | **Yes** | — | Contact email for push service, e.g. `mailto:you@domain.com` |
| `PYTH_BASE_URL` | No | `https://hermes.pyth.network` | Pyth Hermes base URL |
| `FEED_SYNC_INTERVAL_HOURS` | No | `24` | How often to re-sync the Pyth feed catalogue |
| `PRICE_MONITOR_INTERVAL_SECONDS` | No | `60` | How often the monitor worker polls Pyth |
| `CONF_ALERT_COOLDOWN_MINUTES` | No | `10` | Minimum gap between repeated alerts for the same feed/user |
| `CLIENT_URL` | No | `*` | Allowed CORS origin — set to your frontend URL in production |
| `NODE_ENV` | No | `development` | Set to `production` to enable secure cookies |

> **Security note**: Never commit `.env` to version control. Only `.env.example` (with empty values) should be committed.

---

## Project Structure

```
price-feeds-api/
├── .env.example
├── package.json
├── app.js                        # Express app setup, routes, middleware
├── server.js                     # Entry point — DB connect + worker boot
└── src/
    ├── config/
    │   └── db.js                 # Mongoose connection
    ├── models/
    │   ├── User.js
    │   ├── Favourite.js
    │   ├── PriceFeed.js          # Pyth feed catalogue
    │   ├── AlertPreference.js    # Per-user conf thresholds
    │   └── PushSubscription.js   # Browser push subscriptions
    ├── routes/
    │   ├── auth.js
    │   ├── favourites.js
    │   ├── feeds.js
    │   └── notifications.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── favourites.controller.js
    │   ├── feeds.controller.js
    │   └── notifications.controller.js
    ├── services/
    │   ├── pyth.service.js       # Pyth Hermes API wrapper
    │   └── push.service.js       # web-push wrapper + broadcast helper
    ├── workers/
    │   ├── feedSync.worker.js    # Syncs Pyth catalogue to MongoDB
    │   └── priceMonitor.worker.js # Polls prices, fires push alerts
    ├── middleware/
    │   ├── auth.js               # JWT verification
    │   ├── validate.js           # Zod request validation wrapper
    │   ├── rateLimiter.js
    │   └── errorHandler.js       # Central error response handler
    └── utils/
        ├── apiError.js           # Operational error class
        └── asyncHandler.js       # Async route wrapper (no try/catch boilerplate)
```

---

## API Reference

All endpoints return JSON. Errors follow the shape `{ "status": "error", "message": "..." }`.

Protected routes require an `Authorization: Bearer <accessToken>` header.

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account. Body: `{ email, password }` |
| POST | `/api/auth/login` | No | Login. Returns `accessToken` + sets `refreshToken` cookie |
| POST | `/api/auth/refresh` | Cookie | Rotate tokens. Reads `refreshToken` from HttpOnly cookie |
| POST | `/api/auth/logout` | No | Clears refresh token cookie + invalidates in DB |
| GET | `/api/auth/me` | **Yes** | Returns current user `{ id, email }` |

**Register / Login response:**
```json
{
  "status": "success",
  "accessToken": "eyJ...",
  "user": { "id": "64a...", "email": "user@example.com" }
}
```

---

### Feeds (Pyth catalogue)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/feeds` | No | Search + paginate available Pyth price feeds |
| GET | `/api/feeds/asset-types` | No | Distinct list of asset types for filter dropdowns |

**Query params for `GET /api/feeds`:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Filter by symbol or display symbol (case-insensitive) |
| `assetType` | string | Filter by asset type e.g. `Crypto`, `Equity`, `FX` |
| `page` | number | Page number (default: `1`) |
| `limit` | number | Results per page (default: `20`) |

**Example:**
```bash
curl "http://localhost:5000/api/feeds?search=BTC&assetType=Crypto&limit=5"
```

**Response:**
```json
{
  "status": "success",
  "total": 4,
  "page": 1,
  "pages": 1,
  "data": [
    {
      "feedId": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      "symbol": "Crypto.BTC/USD",
      "displaySymbol": "BTC/USD",
      "assetType": "Crypto",
      "lastSyncedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Favourites

All routes require authentication.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/favourites` | **Yes** | List all favourited feeds for the current user |
| POST | `/api/favourites` | **Yes** | Add a feed to favourites |
| GET | `/api/favourites/:feedId` | **Yes** | Check if a specific feed is favourited |
| DELETE | `/api/favourites/:feedId` | **Yes** | Remove a feed from favourites |

**POST body:**
```json
{ "feedId": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" }
```

> Adding a favourite automatically creates a default `AlertPreference` (`enabled: false`, `confThreshold: 0.05`) for that feed. Removing a favourite also deletes its alert preference.

---

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications/vapid-public-key` | No | Returns VAPID public key for browser push subscription |
| POST | `/api/notifications/subscribe` | **Yes** | Save a browser push subscription |
| DELETE | `/api/notifications/unsubscribe` | **Yes** | Remove a push subscription |
| GET | `/api/notifications/preferences` | **Yes** | List all alert preferences for the current user |
| PATCH | `/api/notifications/preferences/:feedId` | **Yes** | Update alert threshold or toggle alerts for a feed |

**POST `/api/notifications/subscribe` body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNg...",
    "auth": "tBn..."
  }
}
```

**PATCH `/api/notifications/preferences/:feedId` body:**
```json
{
  "confThreshold": 0.03,
  "enabled": true
}
```

`confThreshold` is a decimal between `0` and `1`. A value of `0.05` means an alert fires when the confidence interval exceeds 5% of the current price.

---

### System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Server health check |

---

## Push Notifications Setup

Push notifications use the standard [Web Push Protocol](https://web.dev/push-notifications-overview/). No third-party service (FCM, APNs) is required — the browser handles delivery.

### How it works

1. Frontend registers a Service Worker
2. Frontend fetches VAPID public key from `GET /api/notifications/vapid-public-key`
3. Browser creates a push subscription via `pushManager.subscribe()`
4. Frontend posts the subscription to `POST /api/notifications/subscribe`
5. The price monitor worker fires alerts when a feed's `conf/price` ratio exceeds a user's configured threshold

### Minimum Service Worker (`public/sw.js`)

```js
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  self.registration.showNotification(data.title, {
    body:  data.body,
    icon:  '/icon.png',
    data:  data.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const feedId = event.notification.data?.feedId;
  if (feedId) clients.openWindow(`/?feed=${feedId}`);
});
```

### Notification payload shape

```json
{
  "title": "⚠️ Confidence Alert: BTC/USD",
  "body": "Confidence interval hit 6.24% of price — above your 5.00% threshold.",
  "data": {
    "feedId": "e62df6c8...",
    "confRatio": 0.0624,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Background Workers

Two workers run automatically on server boot.

### Feed Sync Worker

- **File**: `src/workers/feedSync.worker.js`
- **Schedule**: Runs immediately on boot, then every 24 hours at midnight
- **What it does**: Fetches all available price feeds from Pyth Hermes (`/v2/price_feeds`) and upserts them into the local `PriceFeed` collection. This powers the feed search endpoint without hitting Pyth on every request.

### Price Monitor Worker

- **File**: `src/workers/priceMonitor.worker.js`
- **Schedule**: Every 60 seconds (configurable via `PRICE_MONITOR_INTERVAL_SECONDS`)
- **What it does**:
  1. Loads all enabled `AlertPreference` documents
  2. Deduplicates feed IDs and batch-fetches latest prices from Pyth in groups of 100
  3. Calculates `conf / |price|` ratio for each feed
  4. For each user whose threshold is breached (and whose cooldown has elapsed), sends a Web Push notification
  5. Auto-deletes expired push subscriptions (HTTP 404/410 responses from push services)

---

## Error Handling

All errors return a consistent JSON shape:

```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

| Status | Meaning |
|---|---|
| `400` | Validation error — check request body |
| `401` | Missing or expired access token |
| `403` | Invalid token or refresh token reuse detected |
| `404` | Resource not found |
| `409` | Conflict — e.g. email already registered, duplicate favourite |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Scripts

```bash
# Development (nodemon, auto-restarts on file changes)
npm run dev

# Production
npm start

# Generate VAPID keys (run once, paste output into .env)
node -e "const wp = require('web-push'); console.log(wp.generateVAPIDKeys())"
```
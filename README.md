# Service Hub

Service Hub is a city-based marketplace for discovering, comparing, and booking trusted local service providers. The repository contains a React/Vite client and a TypeScript/Express/Mongoose API.

## Stack

- React 19, TypeScript, Vite, React Router, Axios, Lucide React
- Node.js, Express, JWT, bcrypt, Helmet, CORS, rate limiting
- MongoDB and Mongoose

## Structure

```text
client/src/       Marketplace UI, routes, reusable provider cards
server/src/       Express API, auth middleware, Mongoose schemas, seed entrypoint
.env.example      Shared local environment reference
```

## Run locally

1. Install MongoDB locally or create a MongoDB Atlas database.
2. Copy `.env.example` to `server/.env` and set `MONGODB_URI` and `JWT_SECRET`.
3. Start the API:

```bash
cd server
npm install
npm run dev
```

4. Start the client in a second terminal:

```bash
cd client
npm install
npm run dev
```

The client runs at `http://localhost:5173`; the API runs at `http://localhost:5000`.

## Production builds

```bash
cd client && npm run build
cd ../server && npm run build && npm start
```

## API starter endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/providers`
- `GET /api/providers/:id`
- `POST /api/bookings`
- `GET /api/bookings/my`
- `PUT /api/bookings/:id/status`

All responses use `{ success, message?, data? }`. Authenticated requests use `Authorization: Bearer <token>`.

## Environment variables

See `.env.example`. Never commit `.env`, MongoDB credentials, JWT secrets, or third-party API keys.

## Product roadmap

The initial vertical covers the responsive discovery experience, provider cards, city-aware search, authentication foundation, and booking API. Next modules are provider onboarding, customer/provider dashboards, reviews, favorites persistence, admin verification, notifications, Cloudinary uploads, and payment adapters.

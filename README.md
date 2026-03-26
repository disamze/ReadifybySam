# ReadifyBySam

Full-stack bookstore + admin dashboard designed for Render deployment with **MongoDB** backend.

## Features
- Animated intro loader: `Reading -> begins -> here`.
- Signup/Login with role selection (user/admin).
- Multi-page user experience: Home, Books, Cart/Checkout, Library.
- Admin dashboard to manage books, testimonials, users, order approvals, and UPI QR.
- Payment approval workflow: user gets PDF in library after admin approves order.
- Contact form stores user messages and shows them in an admin dashboard section: **Messages From User**.

## Local setup
```bash
npm install
cp .env.example .env
npm start
```
Open `http://localhost:10000`.

## Required environment variables
- `MONGODB_URI` (MongoDB Atlas/local connection string)
- `SESSION_SECRET`

## Default admin (seeded)
- Email: from `DEFAULT_ADMIN_EMAIL`
- Password: from `DEFAULT_ADMIN_PASSWORD`

## Deploy on Render
1. Push repository to GitHub.
2. Create a new **Web Service** on Render.
3. Configure Build/Start:
   - Build: `npm install`
   - Start: `npm start`
4. Set env vars from `.env.example` including `MONGODB_URI`.


## Production notes
- App now binds `0.0.0.0:$PORT` immediately so Render detects an open port even while DB is initializing.
- `GET /healthz` returns service status and Mongo readiness.
- In production, set `MONGODB_URI` so sessions use Mongo-backed `connect-mongo` store instead of in-memory fallback.

# ReadifyBySam

Full-stack bookstore + admin dashboard designed for Render deployment.

## Features
- Animated intro loader: `Reading -> begins -> here`.
- Signup/Login with role selection (user/admin).
- User storefront with cart and UPI checkout (QR shown from admin settings).
- Admin dashboard to manage books, testimonials, users, order approvals, and UPI QR.
- Payment approval workflow: user gets PDF in library after admin approves order.
- Contact form stores messages and optionally sends email to `disamaze@gmail.com`.
- Responsive UI with transitions, parallax hero, testimonials, and live purchased-count.

## Local setup
```bash
npm install
cp .env.example .env
npm start
```
Open `http://localhost:10000`.

## Default admin (seeded)
- Email: from `DEFAULT_ADMIN_EMAIL`
- Password: from `DEFAULT_ADMIN_PASSWORD`

## Deploy on Render
1. Push repository to GitHub.
2. Create a new **Web Service** on Render.
3. Render auto-detects `render.yaml` or configure:
   - Build: `npm install`
   - Start: `npm start`
4. Set environment variables from `.env.example`.

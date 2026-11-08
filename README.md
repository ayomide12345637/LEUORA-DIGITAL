# Leuora Digital - FUTA Marketplace PWA

## Project Overview
A student-focused marketplace for FUTA (Federal University of Technology Akure), built as a Progressive Web App (PWA) with a Node.js/Express backend (deployed on Render) and Supabase for database/auth.

## Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL), Render (Node.js for backend logic/webhooks)
- **Payments:** Flutterwave (Split Payments & Subaccounts)
- **Images:** Cloudinary
- **Push Notifications:** Web Push API (VAPID keys)
- **Hosting:** GitHub Pages (Frontend), Render (Backend)

## File Structure
- `index.html` - Landing page with QR code, install button, and SEO.
- `app.html` - Main SPA containing Dashboard, Cart, Checkout, Order Tracking, and Account.
- `product.html` - Dedicated single product page for SEO.
- `signup.html` - User authentication (Email/Password & Google).
- `offline.html` - Fallback page for offline mode.
- `supplier.html`, `supplier-dashboard.html`, `agreement.html` - Supplier portal.
- `admin.html` - Master admin dashboard.
- `manifest.json` & `sw.js` - PWA configuration and service worker.
- `js/` - Application logic.
- `images/` - All static assets.

## Environment Variables (Render)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`
- `FLUTTERWAVE_PUBLIC_KEY` / `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_WEBHOOK_HASH`
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`

## Setup Instructions
1.  **Supabase:** Run the provided SQL to create tables (`profiles`, `suppliers`, `products`, `orders`, `order_items`, `price_change_requests`, `notifications`). Enable RLS and set up Auth providers (Email/Google).
2.  **Storage:** Create a public bucket in Supabase Storage (or use Cloudinary).
3.  **Render:** Deploy the backend. Set environment variables above. Run the server.
4.  **GitHub:** Push the frontend files. Ensure `index.html` is the entry point.
5.  **PWA:** Once deployed, upload the generated APK to GitHub Releases. The "Install Now" button will link to it.
6.  **Flutterwave:** Create subaccounts for suppliers via API on signup. Setup webhook to update order status to "paid".

## Admin Access
-   **Master Admin:** Log in with the email/password you created in Supabase and set their role to `admin` in the `profiles` table. This gives full access to revenue, order management, product approvals, and supplier management.
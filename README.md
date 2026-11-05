# Techmaax EMS

Enterprise Management System for Techmaax. Multi-branch, role-based (Super Admin / Branch Admin / Accountant), built to later support additional client companies without a data-model rewrite.

## Stack

- **Server**: Node.js, TypeScript, Express, Prisma, MySQL, JWT auth
- **Client**: React, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, Zustand

## Data model

- `Company` — a licensed organization (Techmaax today; future clients later). Every other table hangs off `companyId`.
- `Branch` — belongs to a `Company`. Seeded with Techmaax's real 21 centres (`server/prisma/branches.data.ts`).
- `User` — belongs to a `Company`, and to a `Branch` unless the role is `SUPER_ADMIN` (who sees every branch in their company).
- `Course` / `CourseFeeStructure` — company-wide catalog (e.g. "SAP FICO"), with one or more fee rows per mode (Online/Offline/Hybrid). Managed centrally by super admins; every role can view it.
- `Batch` — a scheduled run of a `Course` at a specific `Branch` (timings, capacity). Managed by branch admins for their own branch, or by super admins for any branch.
- `Student` — an enrollment: name, phone, "where from" (`location`), course, optional batch, and a `totalFee` snapshot taken at enrollment time (so later fee-structure edits don't rewrite existing students' fees).
- `Payment` — the revenue ledger. Every rupee collected, whichever channel: `CASH`/`BANK_TRANSFER`/`OTHER` recorded manually, or `RAZORPAY_LINK` created automatically by the payment-link webhook.
- `PaymentLink` — a Razorpay Payment Link shared with a student for a preset amount; the webhook flips it to `PAID` and creates the matching `Payment` row.

Roles:

| Role          | Scope                                             |
| ------------- | -------------------------------------------------- |
| `SUPER_ADMIN` | All branches within their company                  |
| `BRANCH_ADMIN`| Only their assigned branch                          |
| `ACCOUNTANT`  | Only their assigned branch                          |

Data scoping is enforced server-side in `server/src/middleware/rbac.ts` (`branchScopeFilter`) — every list/read endpoint filters by company, and by branch unless the caller is a super admin.

## Prerequisites

- Node.js 20+
- A MySQL/MariaDB database (local or Hostinger-hosted)

## Setup & running (one click)

- **macOS**: double-click `start.command`.
- **Windows**: double-click `start.bat`.

First run: it creates `server/.env` from the example and opens it for editing — fill in `DATABASE_URL` and real JWT secrets, then run it again. From then on it installs dependencies (if needed), runs migrations, seeds the database (safe to repeat — it upserts), and starts both the API (`:4000`) and the web app (`:5173`). Leave the window open; close it (or Ctrl+C) to stop both servers.

### Manual setup

```bash
# 1. Install all workspace dependencies (root, server, client)
npm install

# 2. Configure the server environment
cp server/.env.example server/.env
# edit server/.env: set DATABASE_URL and strong JWT secrets

# 3. Create the database schema
npm run prisma:migrate -- --name init

# 4. Seed the first company, a Head Office branch, and a super admin login
npm run prisma:generate -w server
npx tsx server/prisma/seed.ts

# 5. Run both dev servers
npm run dev
```

The seed script prints the super admin's email/password (defaults in `.env.example`, override with `SEED_*` vars). `npm run dev` runs the API on `http://localhost:4000` and the client on `http://localhost:5173` (Vite proxies `/api` to the server). Both hot-reload.

### Troubleshooting: `Unknown authentication plugin 'sha256_password'`

Prisma's MySQL driver needs the DB user to authenticate with `mysql_native_password` or `caching_sha2_password`, not the older `sha256_password`. If you hit this against a local MySQL install, either create the app user with a supported plugin:

```sql
CREATE USER 'ems_user'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'change_me';
GRANT ALL PRIVILEGES ON tm_ems.* TO 'ems_user'@'localhost';
```

or point `DATABASE_URL` at a MySQL instance that already uses one of those plugins (Hostinger-managed MySQL databases do by default).

## Razorpay setup (payment links)

Payment links are optional — everything else works without them, and creating a link returns a clear 503 error until configured. To enable:

1. In the Razorpay dashboard: **Settings → API Keys** → generate a Key ID/Secret, and add both to `server/.env` as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. **Settings → Webhooks** → add a webhook pointing at `https://<your-domain>/api/webhooks/razorpay`, subscribe to the `payment_link.paid` event, and copy its secret into `RAZORPAY_WEBHOOK_SECRET`.
3. Restart the server. On local dev, Razorpay can't reach `localhost` for webhooks — use a tunnel (e.g. `ngrok http 4000`) and point the webhook at the tunnel URL while testing, or just mark test payments manually via the "Record a cash/bank payment" form.

## New feature areas (courses, students, fee collection, reports)

- **Courses** (`/courses`) — course catalog + fee structures. Create/edit is super-admin only; everyone can view (needed to enroll a student).
- **Batches** (`/batches`) — per-branch batch timings for a course. Branch admins manage their own branch; super admins manage any.
- **Students** (`/students`) — searchable list (name/phone/course/city, filtered client-side for instant results). Each row opens that student's profile in a new tab (`/students/:id`): editable details, photo + ID proof upload, fee summary, a quick "record a payment" form, and full payment history. Enrolling a new student is its own page/tab (`/students/new`), reached via the "+ Enroll student" button — it hands off straight into that student's new profile tab on success. Branch admins and accountants both use all of this.
  - Uploaded photos/ID proofs are stored on disk under `server/uploads/` (gitignored) and served at `/uploads/...`; nothing to configure for local dev, but back this directory up (or move to object storage) once in production, since it isn't part of the database.
- **Payments** (`/payments`) — generate a Razorpay payment link for a student's balance, or record a cash/bank payment directly. Both feed the same `Payment` ledger.
- **Reports** (`/reports`) — revenue collected / outstanding / enrollments, broken down by branch (super admin) and by course. The dashboard surfaces the same totals plus a top-5 branch table.

## Project layout

```
server/
  prisma/schema.prisma       Company / Branch / User / Course / Batch / Student / Payment / PaymentLink models
  prisma/branches.data.ts    Master list of Techmaax's 21 branches (edit here, then re-seed)
  prisma/seed.ts             Bootstraps Techmaax + branches + super admin
  src/app.ts                 Express app: security middleware, routes, raw-body capture for webhooks
  src/index.ts                Entry point
  src/config/razorpay.ts     Razorpay client (null/disabled until keys are set)
  src/middleware/             auth (JWT), rbac (role + branch scoping), errors
  src/modules/                 auth, companies, branches, users, courses, batches, students, payments, reports

client/
  src/store/authStore.ts     Persisted auth session (Zustand)
  src/lib/api.ts              Axios instance with silent access-token refresh
  src/routes/ProtectedRoute.tsx  Login + role gating
  src/layouts/AppLayout.tsx   Sidebar/topbar shell, nav adapts to role
  src/pages/                   Dashboard, Branches, Users, Courses, Batches, Students, Payments, Reports
```

## Deployment (Hostinger Cloud)

1. Provision a MySQL database and point `DATABASE_URL` at it.
2. `npm run build` (builds `server` to `server/dist` and `client` to `client/dist`).
3. Run the server with a process manager (PM2) behind Nginx; serve `client/dist` as static files (or via Nginx directly) and reverse-proxy `/api` to the Node process.
4. Run `npm run prisma:deploy -w server` to apply migrations on the production database, then seed once.

## Next steps

This is the base scaffold — auth, roles, branch scoping, and company/branch/user management are wired end-to-end. Business modules (inventory, invoicing, reporting, etc.) build on top of this same pattern: a Prisma model with `companyId`/`branchId`, a service that applies `branchScopeFilter`, and a route guarded by `requireRole`.
# ems-dashboard

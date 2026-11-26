# CompareX — Smart Product Comparison & Decision Support System

**Tagline:** *Compare Smarter. Choose Better.*

CompareX is a full-stack consumer product comparison and decision-support web platform built with React, TypeScript, Tailwind CSS, Express, Drizzle ORM, Cloud SQL (PostgreSQL), and Firebase Authentication.

## Key Capabilities

- **Universal Product Data Model:** Configurable categories, subcategories, brands, and normalized specification definitions (`numeric`, `text`, `boolean`, `enum` with unit normalization).
- **Side-by-Side Comparison Engine:** Compare 2–4 compatible products simultaneously, highlight differences and matches, flag conflicting records, and explicitly disclose missing specifications without treating them as zero.
- **Explainable Recommendation Engine:** Deterministic multi-criteria scoring (no external AI API required) factoring mandatory constraints, budget fit, usage profiles, priority weights, and transparent criterion breakdowns.
- **Price History & Hidden-Cost Awareness:** Recorded price observation history across sellers paired with separate disclosure of delivery, installation, extended warranty, and required accessory fees.
- **Role-Based Access Control:** Guest browsing, Registered Consumer workspace (Saved Comparisons, Wishlist, Recently Viewed, Profile & Preferences), and Administrator Console (Catalog CRUD, Specification Schema Management, Seller & Offer Management, CSV Batch Import, User/Role Management, Data Quality Auditing, Audit Logs).

## Architecture & Directory Layout

- `shared/` — Shared TypeScript DTOs, Zod validation schemas, and pure comparison/recommendation/cost engines.
- `src/db/` — PostgreSQL Drizzle ORM schema (`schema.ts`), connection pool (`index.ts`), Drizzle Kit config (`drizzle.config.ts`), and idempotent demonstration seed (`seed.ts`).
- `server/` — Express middleware (`auth.ts`), catalog repository (`catalogRepository.ts`), data quality service (`dataQualityService.ts`), and domain API routes (`authRoutes.ts`, `catalogRoutes.ts`, `userWorkspaceRoutes.ts`, `adminRoutes.ts`).
- `server.ts` — Express server entry point integrating Vite middleware in development and static `dist/` serving in production.
- `src/` — React 19 SPA with Tailwind CSS v4, shadcn-style primitives, Recharts visualizations, and Motion transitions.
- `tests/` — Vitest unit and integration suites.
- `docs/` — Software Engineering SDLC documentation, UML/ER diagrams, API documentation, and test report.

## Environment Variables

See `.env.example`:
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD` (runtime Cloud SQL connection via Unix socket / proxy)
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (Drizzle Kit schema migrations)
- `ADMIN_PASSCODE` (optional server-side administrator passcode; when unset, first-run inline admin claim is available)

## Setup & Commands

```bash
# Install dependencies
npm install

# Run type-checking
npm run lint

# Run automated unit & integration tests
npm test

# Start full-stack development server on port 3000
npm run dev

# Build frontend for production
npm run build
```

## Demonstration Data Notice

Seeded products, seller offers, and historical price snapshots are clearly labeled in the database and UI as demonstration data (`isDemoData: true`). No live merchant websites are scraped.

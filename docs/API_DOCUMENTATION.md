# CompareX REST API Documentation

Base URL: `/api`

Authentication header when required or optional:
`Authorization: Bearer <session-or-firebase-token>`

## Public & Discovery Endpoints
- `GET /api/health` — Service health status.
- `GET /api/categories` — All categories with subcategories, specification definitions, and active product counts.
- `GET /api/brands` — All brands with product counts.
- `GET /api/products` — Query parameters: `q`, `category`, `categoryId`, `subcategoryId`, `brandId`, `minPrice`, `maxPrice`, `minRating`, `availability`, `specKey`, `specValue`, `sort` (`popularity` | `price_asc` | `price_desc` | `rating` | `value`), `page`, `limit`.
- `GET /api/products/:idOrSlug` — Full product details, standardized specs, and seller offers with computed hidden costs. Records `recently_viewed` if authenticated.
- `GET /api/products/:id/price-history` — Historical `price_observations` with lowest/highest/latest/delta summary.
- `POST /api/compare/analyze` — Body: `{ productIds: number[] }` (2–4). Rejects mixed categories with HTTP 400.
- `POST /api/recommendations` — Body: `RecommendationCriteriaInput`. Returns ranked recommendations, criterion scores, filtered-out reasons, and disclaimer.

## Authentication & Profile Endpoints (`/api/auth/*`)
- `POST /api/auth/register` — Register consumer account (`name`, `email`, `password`).
- `POST /api/auth/login` — Authenticate with email and password (`scrypt` verified).
- `POST /api/auth/firebase-sync` — Verify Firebase ID token and synchronize PostgreSQL user profile.
- `GET /api/auth/admin-bootstrap-status` — Check whether administrator passcode is configured.
- `POST /api/auth/admin-bootstrap` — Claim first-run admin passcode or verify existing passcode.
- `GET /api/auth/me` — Authenticated user profile and preferences.
- `PUT /api/auth/profile` — Update user display name and preferences.
- `POST /api/auth/change-password` — Change password for email/password accounts.
- `POST /api/auth/logout` — Sign out endpoint.

## Authenticated Consumer Workspace (`/api/workspace/*`)
Requires valid Bearer token (`401` otherwise). All mutations enforce resource ownership (`403` on cross-user access).
- `GET /api/workspace/dashboard` — User's saved comparisons, wishlist, recently viewed, and recent recommendation runs.
- `GET /api/workspace/comparisons` — List user's saved comparisons.
- `POST /api/workspace/comparisons` — Save comparison (`title`, `categoryId`, `productIds`, `notes`).
- `DELETE /api/workspace/comparisons/:id` — Delete comparison owned by user.
- `GET /api/workspace/wishlist` — List wishlist items.
- `POST /api/workspace/wishlist` — Add or update wishlist item (`productId`, `targetPrice`, `notes`).
- `DELETE /api/workspace/wishlist/:productId` — Remove item from user's wishlist.

## Administrator Endpoints (`/api/admin/*`)
Requires `ADMIN` role (`401` unauthenticated, `403` non-admin).
- `GET /api/admin/overview` — Catalog counts, data quality score, and recent audit logs.
- `GET /api/admin/products`, `POST /api/admin/products`, `PUT /api/admin/products/:id`, `DELETE /api/admin/products/:id`
- `POST /api/admin/categories`, `POST /api/admin/categories/:id/subcategories`, `POST /api/admin/spec-definitions`, `DELETE /api/admin/spec-definitions/:id`
- `POST /api/admin/brands`, `DELETE /api/admin/brands/:id`
- `GET /api/admin/sellers`, `POST /api/admin/sellers`, `POST /api/admin/offers`, `POST /api/admin/price-observations`
- `GET /api/admin/csv-template`, `POST /api/admin/csv-import`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`
- `GET /api/admin/data-quality`, `POST /api/admin/data-quality/resolve-conflict/:specId`, `POST /api/admin/data-quality/refresh-offer/:offerId`
- `GET /api/admin/audit-logs`

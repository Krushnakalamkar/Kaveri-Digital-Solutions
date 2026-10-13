# Krushna Kalamkar — Portfolio

A responsive portfolio and secure content-management studio for Krushna Kalamkar, Developer & AI Engineer.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/krushna-portfolio run dev` — run the Next.js portfolio through its managed workflow
- `pnpm --filter @workspace/krushna-portfolio run build` — generate Prisma and validate the production Next.js build
- `pnpm --filter @workspace/krushna-portfolio run db:seed` — initialize content once; preserve later edits and deletions
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- The shared Drizzle template is not the portfolio schema. Do not run its schema-push command against the portfolio database.
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Portfolio: Next.js App Router, Prisma, PostgreSQL, signed App Storage uploads
- Shared API template: Express and Drizzle, independent of the portfolio CMS
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Portfolio routes and CMS: `artifacts/krushna-portfolio/src/app`
- Portfolio server code: `artifacts/krushna-portfolio/src/server`
- Portfolio schema and migrations: `artifacts/krushna-portfolio/prisma`
- Public/admin styling: `artifacts/krushna-portfolio/src/index.css`

## Architecture decisions

- The shared artifact owns `/api`; the portfolio uses `/portfolio-api` to avoid routing conflicts.
- Initial content is truthful: only supplied profile copy and services are seeded. Projects, skills, and résumé await verified content.
- Admin bootstrapping uses workspace secrets, never hardcoded credentials.
- Canonical URLs and the sitemap become available when the real published site URL is set in Admin Settings. Do not invent a production URL.

## Product

Company name: KAVERI DIGITAL SOLUTIONS. The About Me introduction identifies Krushna Kalamkar as Founder of KAVERI DIGITAL SOLUTIONS.

Public portfolio, categorized services, published case studies, contact enquiries, résumé downloads, and an authenticated CMS for editing and publishing content.

## User preferences

- Use the supplied portrait and reference palette: black `#000000`, burgundy `#6D001A`, and white `#FFFFFF` for backgrounds and foregrounds where suitable. Use neutral black/white shades for supporting text and borders, not navy or blue.
- Use the supplied Kaveri Digital Solutions logo with its original proportions and artwork; do not stretch or redraw it.
- Preserve supplied contact/profile copy. Never invent projects, clients, outcomes, education, testimonials, or achievements.
- Add consistently aligned icons and page transitions; respect reduced-motion preferences.

## Gotchas

- Replit Publishing applies the managed production database schema. Do not run Prisma migrations or schema pushes during production startup. Startup initializes content only on first setup; never recreate deleted CMS content.
- Uploads must be finalized and byte-validated before they can be used in CMS content. Enquiry attachments stay private.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

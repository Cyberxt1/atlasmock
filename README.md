# Atlas emergency response demo

A Next.js / TypeScript prototype with three connected experiences: the dispatcher command centre, a mobile-first campus user app, and a mobile-first responder app.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:3000/dashboard. On Windows, `npm.cmd` works even when PowerShell blocks `npm.ps1`.

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd start
```

## Routes

- User mobile app: `/user`
- Responder mobile app: `/responder`
- Platform super-admin: `/admin`
- Dispatcher: `/dashboard`, `/alerts`, `/responders`, `/map`, `/incidents`, `/reports`, `/broadcast`, `/settings`

The user and responder routes intentionally display only on phone-sized viewports (600px and below). Use a real phone or browser device emulation. For the local demo, open all three experiences in tabs in the same browser profile. A user alert is added to dispatch immediately; a responder can accept it, mark arrival, and resolve it; every status is reflected in the other views.

Incidents, responder availability, broadcasts, and notification preferences persist in browser local storage (`atlas-command-v2`). All emergency dispatch, phone calls, and message delivery are simulated; no real messages are sent. Reports support CSV downloads and the browser's Print / Save PDF flow.

## Netlify

The project includes `netlify.toml` and is ready for Netlify's Next.js runtime. Connect the folder to a Git repository and import it in Netlify, or run `npx netlify-cli deploy --build` after authenticating. The build command is `npm run build` and the publish directory is `.next`.

This prototype syncs roles through browser storage, which is ideal for a single-device demonstration. True live sync between separate phones/computers requires a shared backend (for example Supabase/Firebase or a Netlify Function plus database), authentication, and access controls before production use.

## Supabase platform setup

The repository now includes a multi-tenant PostgreSQL/PostGIS migration at `supabase/migrations/202609220001_atlas_platform.sql`. It creates organizations, profiles and roles, hashed access codes, geofences, POIs, responders, incidents, assignments, tenant-aware RLS policies, spatial indexes, and realtime publications.

1. Create a Supabase project and run the migration in its SQL editor or with the Supabase CLI.
2. Copy `.env.example` to `.env.local`.
3. Add the project URL and publishable key from Supabase's Connect dialog.
4. Create the first Auth user and set its `profiles.role` to `super_admin` using the SQL editor.
5. Restart the Next.js development server.

Without credentials, the UI intentionally remains in demo-data mode. Example mobile codes are `ADELEKE-4820` for users and `RESP-AU-001` for responders. Production access codes are represented only by SHA-256 hashes in the database and should be shown once when generated.

The map uses Leaflet and Esri satellite tiles. An internet connection is required for map imagery and the Inter font. The map is centred on the Adeleke University / Ede area; incident, responder and POI coordinates are illustrative and are not operational campus geodata.

## Structure

- `components/atlas.tsx`: application shell, shared mock state, operational views and dialogs
- `components/mobile-experience.tsx`: user and responder mobile flows
- `components/portal-router.tsx`: routes each product surface to the correct shell
- `components/campus-map.tsx`: interactive Leaflet map and accessible markers
- `components/statistics.tsx`: responsive Recharts chart
- `lib/data.ts`: typed mock incidents, responders and chart data
- `app/globals.css`: reference-matched layout and component styles

The earlier static `script.js`, `styles.css`, `fidelity.css`, and generated map in `assets/` are retained as legacy files; the Next.js application does not consume them. `index.html` is a launcher for the local app.

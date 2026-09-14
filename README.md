# Dialed

A personal golf dispersion tracker. Log practice shots against a target, or track a full round by
marking where each shot starts and ends with GPS, then review dispersion patterns per club on a
satellite map.

- **Practice mode** — set a start point and a target, then log shots either by walking to the ball
  (GPS) or tapping where it landed on the map.
- **Round mode** — mark shot start, walk to your ball, mark again. Pin locations are optional and
  editable mid-round; the round never depends on having one.
- **Pins** (pre-round) — optionally set green centers for a course ahead of time, either by tapping
  the map or pulling from OpenStreetMap.
- **Dispersion** — per-club scatter chart of left/right and long/short relative to the target, plus
  average carry and standard deviation.

## Stack

- React + Vite, deployed as a static site on Netlify
- Supabase (Postgres) for storage
- Mapbox GL for the satellite map
- OpenStreetMap's Overpass API for free (best-effort) pin lookups — no key required, but coverage
  depends on whether a course has been mapped with `golf=pin` tags. If it hasn't, use manual mode.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run the contents of `supabase/schema.sql` once. This creates all tables,
   enables row-level security with an open policy for the anon key, and seeds a starter set of clubs.
3. From **Project Settings → API**, grab the **Project URL** and **anon public key**.

> **Security note:** this app is locked with a simple shared passcode, not real user accounts. The
> passcode only gates the UI — the Supabase anon key ships in the deployed JS bundle, so in theory
> anyone who extracted it could hit the database directly. That's a reasonable trade-off for low-stakes
> personal shot data. If you want real protection later, switch to Supabase email auth and rewrite the
> RLS policies to check `auth.uid()`.

## 2. Get a Mapbox token

Create a free account at [mapbox.com](https://mapbox.com) and copy your default public token
(`pk...`). The free tier is generous enough for personal use.

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_MAPBOX_TOKEN=...
VITE_APP_PASSCODE=pick-something
```

## 4. Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. Geolocation works on `localhost` even without HTTPS, so you can test
the flow at your desk (though obviously without real GPS movement).

## 5. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## 6. Deploy on Netlify

1. In Netlify, **Add new site → Import an existing project**, and pick this GitHub repo.
2. Build command `npm run build`, publish directory `dist` (already set in `netlify.toml`).
3. Under **Site settings → Environment variables**, add the same four variables from your `.env` file.
4. Deploy. Netlify gives you HTTPS automatically, which the Geolocation API requires on a real phone.

From then on, every push to `main` redeploys automatically.

## Notes on accuracy

- Phone GPS is typically accurate to somewhere between 3–10 meters. That's fine for full-swing shots
  but means very short shots (chips, putts) will show noisy or unreliable dispersion — treat those
  numbers loosely.
- Dispersion (left/right, long/short) can only be computed for shots that have a target — a target you
  set in practice mode, or a pin in round mode. Shots without one still record carry distance and show
  up in the shot log, just not on the scatter chart.
- OpenStreetMap pin data is community-mapped and coverage varies a lot by course. Treat "Look up on
  OpenStreetMap" as a convenience, not a guarantee — manual tap-to-set always works as a fallback,
  which is why the app never requires it.

## Extending later

- Add more shot detail (lie, wind, notes) by adding columns to `shots` and a small form.
- Swap the passcode gate for Supabase email auth if you ever share this with others.
- If OpenStreetMap coverage is poor at your home course, a paid course/pin API (e.g. GolfAPI.io) could
  slot in as an alternative to `src/lib/overpass.js` without changing the rest of the app.

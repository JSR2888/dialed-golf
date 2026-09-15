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
  average distance and standard deviation. Toggle between **Total** (GPS distance from where you
  started the shot to where you found the ball — this is what start/end GPS marking actually measures)
  and **Carry** (flight distance only, which you enter manually per shot if you know it).
- **Clubs** — manage your bag, reorder clubs, and reset (permanently delete) all logged shots for a
  single club if you want to start its stats over — e.g. after a swing change that makes older data
  misleading.

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
>
> `VITE_APP_PASSCODE`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, and `VITE_MAPBOX_TOKEN` all end up
> in the built JS, because they all need to run in the browser — that's by design, not a leak. Netlify's
> automatic secrets scanner doesn't know that and will fail the build treating them as leaked secrets;
> `netlify.toml` already tells it to ignore these specific keys (`SECRETS_SCAN_OMIT_KEYS`), which is
> expected and safe to leave as is.
>
> One thing worth actually doing: in your Mapbox account, add a URL restriction to your token so it only
> works from your Netlify domain. That's the real protection mechanism for public Mapbox tokens (not
> secrecy) — it stops someone who copies the token out of your bundle from running up usage on it
> elsewhere.

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

## Carry vs. total

GPS/tap marking gives you a distance from where a shot started to wherever you marked it — but what
that marked point *means* depends on where you actually are. On a course or open range you can walk
out and mark where the ball actually stopped (**total**, carry + roll). Somewhere like a simulator bay
or Topgolf, you can't walk anywhere, and the ball's rollout on turf or into a net isn't representative
of a real shot — so there, you'd want to mark where it landed instead (**carry**).

Practice mode has a **Marking: Total / Carry** toggle above the map. Whichever you pick determines
which column that shot's measured distance is saved to, and which one the on-map dispersion math
(left/right, long/short) is computed against. After logging a shot you can also fill in the *other*
number by hand if you happen to know it — e.g. you marked carry at Topgolf but also want to note
roughly where it would've stopped.

Round mode always marks total, since on the course you're meant to walk to your actual ball.

The Dispersion tab's Total/Carry toggle shows whichever numbers you've got: exact when a shot was
marked that way, approximated (same direction, adjusted distance) when it was filled in by hand
afterward.

If you already created your Supabase tables from an earlier version of `schema.sql`, run
`supabase/migration_002_carry_vs_total.sql` and then `supabase/migration_003_dispersion_basis.sql`
once, in that order.

## Skipping or discarding a shot

You don't have to log every shot in a round — just don't press "Mark shot start" for ones you'd rather
skip. If you've already marked a start (or both start and end) and change your mind, use **Cancel**
(after marking start) or **Don't log this shot** (after marking end, next to the club picker) to back
out without saving anything.

## Notes on accuracy

- Phone GPS is typically accurate to somewhere between 3–10 meters. That's fine for full-swing shots
  but means very short shots (chips, putts) will show noisy or unreliable dispersion — treat those
  numbers loosely.
- Dispersion (left/right, long/short) can only be computed for shots that have a target — a target you
  set in practice mode, or a pin in round mode. Shots without one still record distance and show up in
  the shot log, just not on the scatter chart.
- OpenStreetMap pin data is community-mapped and coverage varies a lot by course. Treat "Look up on
  OpenStreetMap" as a convenience, not a guarantee — manual tap-to-set always works as a fallback,
  which is why the app never requires it.

## If your phone never prompts for location

The Geolocation API only works on a **secure context** — a page served over `https://`, or the literal
hostname `localhost`. On an insecure origin (most commonly: testing the Vite dev server on your phone
by visiting your computer's local network IP, like `http://192.168.1.23:5173`) the browser doesn't ask
permission at all — it just fails instantly, which looks exactly like nothing happening. The app now
shows the specific reason in the status line instead of a generic error, which should make this obvious
going forward. Netlify serves everything over HTTPS automatically, so once deployed this isn't an issue.

If it's still not prompting on a real HTTPS deployment, check:

- **Already denied once** — browsers only ask once per site. If you tapped "Block" or "Don't allow" at
  some point, go into the browser's site settings for your Netlify URL and reset the Location
  permission, then reload.
- **iOS** — Settings → Privacy & Security → Location Services must be on globally, and also enabled for
  your specific browser under that same screen. Low Power Mode can also suppress it.
- **Android** — Settings → Location must be on system-wide, and the browser app needs Location
  permission under Settings → Apps → [Browser] → Permissions.

## Extending later

- Add more shot detail (lie, wind, notes) by adding columns to `shots` and a small form.
- Swap the passcode gate for Supabase email auth if you ever share this with others.
- If OpenStreetMap coverage is poor at your home course, a paid course/pin API (e.g. GolfAPI.io) could
  slot in as an alternative to `src/lib/overpass.js` without changing the rest of the app.

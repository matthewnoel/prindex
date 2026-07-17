# prindex

A static index site for my 3D-printable designs on GitHub, built so the models are discoverable by search engines instead of being buried in individual repos.

Every build **scrapes GitHub from scratch** — it fetches all of my public repos, keeps the ones tagged with the `prindex` topic, and regenerates the entire site into `public/`, overwriting whatever was there before. There is no stored state.

## How a repo gets on the site

Add the **`prindex` topic** to any public repo (repo page → gear icon next to *About* → Topics). It will appear on the site after the next build. Remove the topic to delist it. Forked and archived repos are always excluded.

Each listed repo gets:

- a card on the homepage
- its own page at `/repos/<name>/` with the README rendered as HTML, relative images rewritten to `raw.githubusercontent.com`
- SEO plumbing: unique title/meta description, canonical URL, Open Graph/Twitter tags, JSON-LD (`3DModel` per repo, `ItemList` on the index), `sitemap.xml`, and `robots.txt`

## Local build

```sh
npm install
npm run build          # writes the site to public/
npx serve public       # or any static file server, to preview
```

Set `GITHUB_TOKEN` to any GitHub token to avoid the unauthenticated API rate limit (60 requests/hour); unauthenticated works fine for occasional local builds.

Site settings (owner, topic, site URL, title, description) live in [`site.config.json`](site.config.json).

## Deployment

`.github/workflows/deploy.yml` builds and deploys to Firebase Hosting:

- **daily** at 06:00 UTC (picks up new/edited repos)
- on every **push to `main`**
- manually via **Run workflow** in the Actions tab

### One-time Firebase setup

1. Create a Firebase project at <https://console.firebase.google.com> and enable Hosting.
2. Put the project ID in [`.firebaserc`](.firebaserc) (currently a `prindex` placeholder) and update `siteUrl` in `site.config.json` to match (e.g. `https://<project-id>.web.app`).
3. Create a deploy service account and add it as the `FIREBASE_SERVICE_ACCOUNT` repo secret. Easiest way: run `firebase init hosting:github` locally, which creates the service account and secret for you — or create a service account with the *Firebase Hosting Admin* role in the Google Cloud console and paste its JSON key into the secret manually.

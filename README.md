# Capital Machine Tools website

A plain HTML site hosted on Cloudflare Pages, with an Inventory page that Dave
updates from `/admin` without touching any code.

- **Buyers** see the machines at `capitalmachinetools.com/inventory`. Each machine also
  has its own page, e.g. `capitalmachinetools.com/inventory/2008-haas-vf-2`, which Google can list.
- **Dave** signs in at `capitalmachinetools.com/admin` with a code emailed to him,
  and can add, edit, hide, mark sold or delete machines. Changes show on the
  Inventory page right away.

## What's where

| File / folder | What it is | Safe to edit? |
|---|---|---|
| `index.html`, `products.html`, `contact.html` | The main pages | Yes |
| `style.css` | Look of the whole site | Yes |
| `inventory.css` | Look of the Inventory and admin pages | Yes (changes both pages' look) |
| `inventory.html` | Buyers' Inventory page | Yes, but keep `id="app"`, `data-page="inventory"`, the `rail` and `filter-host` parts |
| `admin/index.html` | Dave's page | Wording and layout yes. Keep every `id`, `name` and `data-page` the script uses |
| `inventory.js` | Runs both inventory pages | Phone/email, categories and spec names at the top, yes. Leave the **Store** section alone |
| `functions/` | The backend that saves machines and photos | Only if you mean to change how saving works |
| `functions/inventory/[id].js`, `functions/_lib/page.js` | Builds each machine's own page (`/inventory/2008-haas-vf-2`) for Google and sharing | Its page layout mirrors `renderDetail()` in `inventory.js`; change both together |
| `functions/sitemap.xml.js` | The sitemap Google reads; lists every machine on the website automatically | No need to edit |
| `robots.txt` | Tells search engines to skip `/admin` and the backend | No need to edit |
| `functions/_lib/ebay.js`, `functions/api/admin/ebay/` | The eBay connection: Dave's sign-in, importing listings | Only if you mean to change how eBay works |
| `functions/api/ebay/account-deletion.js` | Answers eBay's required account-deletion notices | No need to edit |
| `migrations/` | Database updates, each run once in the D1 console, in order | No need to edit |
| `privacy.html` | Privacy policy (eBay asks for one) | Yes |
| `schema.sql` | Creates the database table (used once at setup) | No need to edit |
| `logo-fit.js` | Fits the tagline under the logo | Leave alone |
| `cmt-badge.png` | Logo in the header | Replace with a same-named file to change it |
| `cmt-badge-reversed.png` | White logo in the dark footer | Same |
| `cmt-badge-solid.png` | Browser-tab icon ("CMT / CT") | Same |
| `cmt-badge-navy.png` | Navy version of the full badge (not used yet; spare) | Yes |

Machines and photos are stored in Cloudflare (database **D1** and photo
storage **R2**), **not** in these files. Uploading new versions of the files
never deletes or changes Dave's listings.

## After editing inventory.css or inventory.js

Browsers keep old copies of these two files. After changing either one, open
`inventory.html` **and** `admin/index.html` and raise the number at the end of
their links by one (for example `inventory.css?v=2` → `inventory.css?v=3`).
That makes every browser fetch the new version right away.

## Before uploading a redesign

Upload the changes to a branch other than your main one first. Cloudflare
builds a private preview link for it. Click around on the preview, then upload
to the main branch.

---

## One-time setup

Do these in order. **Step 5 must be finished before step 7**, or `/admin`
would be public for a few minutes.

Cloudflare sometimes renames menu items. If a step doesn't match what you see,
look for the closest match.

### 1. Find the production branch
Cloudflare dashboard → **Workers & Pages** → your site → **Settings** →
**Build**. Note the **production branch** (usually `main`).

### 2. Create the database
**Storage & Databases → D1 SQLite Database → Create**. Name: `cmt-inventory`.

### 3. Create the photo storage
**Storage & Databases → R2 Object Storage**. Turn on R2 if asked (a payment
card may be required even on the free tier). **Create bucket**, name: `cmt-photos`.

### 4. Connect both to the site
Your Pages project → **Settings → Bindings → Add**:

| Type | Variable name | Pick |
|---|---|---|
| D1 database | `DB` | `cmt-inventory` |
| R2 bucket | `PHOTOS` | `cmt-photos` |

Use exactly `DB` and `PHOTOS`.

### 5. Set up the login (Cloudflare Access)
1. From the dashboard, open **Zero Trust**. The first time, it asks you to
   pick a **team name** and the **Free** plan (a payment card may be required).
   Your team domain will be `<team name>.cloudflareaccess.com`. Write it down.
2. **Access → Applications → Add an application → Self-hosted**.
   - Application name: `CMT Admin`
   - Session duration: `1 month` (how long Dave stays signed in)
   - Add **two** destinations (public hostnames):
     - Domain `capitalmachinetools.com`, path `admin`
     - Domain `capitalmachinetools.com`, path `api/admin`
3. Add a policy:
   - Name: `Dave and Tyler`, Action: **Allow**
   - Include → **Emails**: Dave's sign-in email and your own
4. Login method: **One-time PIN** (emails a code; no password).
5. Save. On the application's page, copy the **Application Audience (AUD) Tag**.

### 6. Give the site the login details
Pages project → **Settings → Variables and Secrets → Add**
(for **Production**, and **Preview** too):

| Name | Value |
|---|---|
| `ACCESS_TEAM_DOMAIN` | e.g. `capitalmachinetools.cloudflareaccess.com` |
| `ACCESS_AUD` | the AUD tag from step 5 |

The backend checks every sign-in against these. If they are missing or wrong,
saving is refused. It fails safe rather than open.

### 7. Upload the files to GitHub
Upload everything in this folder to the repo's production branch, keeping the
folders (`admin/`, `functions/`). GitHub's **Add file → Upload files** accepts
dragged folders. Cloudflare deploys automatically in a minute or two.

### 8. Create the database table
**D1 → cmt-inventory → Console**: paste the whole of `schema.sql`, then run it.

### 9. Test
1. Open `capitalmachinetools.com/admin`. Cloudflare asks for an email and
   sends a code. Sign in.
2. Add a test machine with a photo. Check it on `/inventory.html`.
3. Mark it sold (it disappears from the public page), then delete it.
4. In a private/incognito window, open `/admin` and confirm it asks for a code.

## Adding or removing people who can sign in
Zero Trust → **Access → Applications → CMT Admin → Policies**, then edit the
email list. No code changes needed.

---

## eBay connection

Dave connects his eBay seller account once from the admin page ("Connect
eBay account"), then can import his live eBay listings onto the website.
Imported machines arrive **hidden** for checking.

### Setup (once)
1. **Database:** run `migrations/002-ebay.sql` in the D1 console
   (cmt-inventory → Console), the same way as `schema.sql`.
2. **Settings** (Pages project → Settings → Variables and Secrets, Production):

| Name | Type | Value |
|---|---|---|
| `EBAY_ENV` | Text | `sandbox` (eBay's practice system) or `production` |
| `EBAY_CLIENT_ID` | Text | App ID from developer.ebay.com, for that environment |
| `EBAY_CLIENT_SECRET` | **Secret** | Cert ID from developer.ebay.com, for that environment |
| `EBAY_RUNAME` | Text | The RuName from developer.ebay.com → User Tokens, for that environment |
| `EBAY_VERIFICATION_TOKEN` | **Secret** | Production only: any 32–80 letters/numbers; enter the same on eBay's Alerts & Notifications page |

3. The RuName's **auth accepted** and **declined** URLs are both
   `https://capitalmachinetools.com/api/admin/ebay/callback`, and its privacy
   policy URL is `https://capitalmachinetools.com/privacy`.

Switching `EBAY_ENV` between `sandbox` and `production` (with that
environment's keys) requires connecting the eBay account again.
eBay also asks for a fresh connection every 18 months; the admin page shows the date.

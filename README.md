# The Filing Cabinet

House document ingestion & index. Scanned or emailed house documents (invoices,
manuals, warranties, permits, receipts) get read and classified by Claude,
reviewed in a one-screen queue, filed into a self-organizing Google Drive
folder tree with standardized names, and indexed in a searchable dashboard —
so "where's the warranty for the pool heater" has a 5-second answer.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + Storage) · Anthropic
API (`claude-sonnet-5`, native PDF/image vision) · Google Drive API
(`drive.file` scope) · Auth.js (Google) · Postmark inbound email · Vercel.

## How it flows

```
upload / email forward
        │
        ▼
  staging (Supabase Storage) ── SHA-256 hash
        │
        ▼
  Claude reads & classifies ── multi-doc scans split into separate entries
        │                    └─ duplicates flagged (hash, or vendor+date+amount)
        ▼
  Review tray (keyboard: ←/→ flip · ↵ file · E edit · D discard)
        │  confirm
        ▼
  Google Drive: /House Docs/<category folder>/Category_YYYY-MM-DD_Vendor.pdf
        + indexed row in Postgres (full-text searchable)
```

Already-filed docs can be re-edited any time; the Drive file is renamed/moved
to match.

## Setup

### 1. Supabase (you have a project)

- Open the SQL editor and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
  (creates tables, FTS index, and the private `staging` bucket).
- Copy **Project URL** and the **service_role key** (Settings → API) into `.env.local`.

### 2. Google Cloud (OAuth + Drive)

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. "filing-cabinet").
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → External → fill in the basics.
   Add the scope `.../auth/drive.file` (non-sensitive). Add yourself as a test
   user, then **PUBLISH the app to Production** — unverified is fine for
   `drive.file`, and testing-mode refresh tokens expire every 7 days.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<your-vercel-domain>/api/auth/callback/google`
5. Copy client ID + secret into `.env.local`.

### 3. Anthropic

Create an API key at [platform.claude.com](https://platform.claude.com) → `ANTHROPIC_API_KEY`.

### 4. Local run

```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev
```

Sign in once with your Google account — that first login stores the Drive
refresh token server-side (required before anything can be filed, and it's
what lets the email webhook file documents with no browser session).

### 5. Vercel

```bash
npx vercel link
npx vercel env pull   # or add the same vars in the dashboard
npx vercel deploy --prod
```

Add all `.env.example` vars in the Vercel project settings. Then add the
production redirect URI to the Google OAuth client (step 2.4).

### 6. Postmark (email forwarding)

1. [postmarkapp.com](https://postmarkapp.com) → create a server (free dev tier
   covers 100 emails/month).
2. **Default Inbound Stream → Settings**: copy your inbound address
   (`something@inbound.postmarkapp.com`) — this is the address you forward
   documents to.
3. Set the webhook URL to:
   `https://<your-vercel-domain>/api/inbound-email?token=<POSTMARK_WEBHOOK_TOKEN>`
   (generate any long random string for the token and put the same value in
   the env var).
4. Only senders in `ALLOWED_SENDERS` are accepted; everything else is logged
   to `activity_log` and dropped.

> Known limit: Vercel caps request bodies at ~4.5 MB, so very large scans
> should go through the upload UI rather than email.

## Drive folder taxonomy

Created lazily on first use, under `DRIVE_ROOT_FOLDER_NAME` (default
`House Docs`):

- `Appliances & Systems/{HVAC, Pool & Hot Tub, Kitchen Appliances, Water Heater, Sump, Plumbing}/Manuals` — manuals for those systems, named simply (e.g. `Hayward AQR-15 Salt Chlorinator Manual.pdf`) rather than the Category_Date_Vendor pattern
- `Appliances & Systems/<System>/Historical (Previous Owner)` — any document flagged **from previous owner** files here instead, regardless of category, so it stays a distinct "drawer section" alongside Manuals
- `Manuals` (everything else — systems with no dedicated Appliances & Systems folder), `Warranties`, `Invoices & Receipts`,
  `Contractor & Renovation Docs`, `Permits & Municipal`, `Insurance`,
  `Tax-Relevant Home Expenses`, `Correspondence`, `Uncategorized`

Claude flags **from previous owner** automatically when a document's text gives clear evidence (e.g. "left by the previous homeowner"); it's also a checkbox in the review/edit form for anything the model misses. The dashboard's house-system drawers split into **Manuals**, **Historical — from the previous owner**, and everything else to match.

Filename convention: `{Category}_{YYYY-MM-DD}_{Vendor}.pdf` — date is the
document date when extractable (flagged when it falls back to upload date),
vendor is normalized (no LLC, no ALL-CAPS), collisions get `_2`, `_3`, never
overwritten.

## Ask the Cabinet

The chat panel answers only from indexed documents: Postgres full-text search
retrieves candidates, the matched docs' extracted text goes to Claude with a
grounding-only prompt, and answers cite/link the source PDFs. Zero retrieval
hits = no model call, just "I don't have a document that answers that."

## Testing the email webhook locally

```bash
curl -X POST "http://localhost:3000/api/inbound-email?token=$POSTMARK_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "you@example.com",
    "FromFull": {"Email": "you@example.com"},
    "Subject": "Pool invoice",
    "Date": "2026-07-16",
    "TextBody": "Invoice from PoolCorp for $450, due Aug 1.",
    "Attachments": []
  }'
```

(Swap in a base64 `Attachments` entry to test the attachment path; use a
non-allowlisted `From` to verify the drop.)

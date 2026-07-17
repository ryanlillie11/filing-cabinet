# Setting Up Your Own Filing Cabinet

Hey! Ryan built a tool called **The Filing Cabinet** — you drop in house documents
(invoices, manuals, warranties, permits) and it reads them, sorts them, and
files them neatly into your own Google Drive with a searchable dashboard. He's
sharing the same code so you can run your own private copy for your own house.
Your copy will be completely separate from his — your documents, your Google
Drive, your login. Nothing you upload is visible to him, and vice versa.

**The easiest way to do this:** open [Claude Code](https://claude.com/claude-code)
(the same AI coding assistant Ryan used to build this) and paste in this
sentence:

> "I have a setup guide called FRIEND-SETUP-GUIDE.md for an app called The
> Filing Cabinet. Please walk me through it step by step — I'm not technical,
> so explain each thing in plain language and tell me exactly what to click."

It'll do the technical parts (writing config, running commands, deploying)
while you just create accounts and click "Allow" when asked. The rest of this
guide explains **what you're actually setting up and why**, so none of it
feels like a mystery — read it either way.

---

## The big picture

This app needs to talk to four other services to work. Each one is free (or
has a generous free tier), and each needs its own account **in your name**,
not Ryan's — that's what makes this "your own copy" instead of sharing his.

| Service | What it's for, in plain English |
|---|---|
| **GitHub** | Where the app's code lives. You'll get your own copy of it. |
| **Google Cloud** | Lets the app sign in with your Google account and save files to *your* Google Drive. |
| **Supabase** | A free online database — it remembers every document you've filed, so you can search later. |
| **Anthropic (Claude)** | The AI that actually reads your documents and figures out what they are. |
| **Vercel** | Puts the finished app on the internet so you can open it from your phone or laptop, like a website. |

You'll create a free account on each, then copy a few codes between them. That's
really it — there's no software to install on your own computer besides a
couple of free tools.

---

## A word or two you'll see a lot

- **API key / secret / token** — think of these as a special password. Instead
  of you typing a password to log into a website, one computer program hands
  another program this password so they're allowed to talk to each other.
  You'll never need to remember these — you just copy them from one website
  and paste them somewhere else, once.
- **Environment variable (`.env` file)** — a plain text file that holds all of
  today's passwords/keys in one place, so the app can find them. You (or
  Claude Code) will fill this in as you go; think of it as a settings sheet.
- **Deploy** — publishing the app to the internet so it has a real web address
  you can visit from anywhere, not just your own computer.

---

## Step 1 — Get the code (GitHub)

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Ask Ryan to add your GitHub username as a **collaborator** on his
   `filing-cabinet` repository (or he can send you a copy/"fork" of it —
   either works).
3. That's it for now — you (or Claude Code) will download this code onto your
   computer in a later step.

## Step 2 — Create your database (Supabase)

This is where all your filed documents get remembered — vendor, date, amount,
which folder it's in — so the app can search and show you a dashboard.

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New
   project**. Name it whatever you want, e.g. "My Filing Cabinet."
2. Once it's created, go to **Settings → API** on the left. You'll see two
   things you'll need later: a **Project URL** and a **service_role** key (a
   long string of letters — this is one of those "special password" API keys).
   Keep this tab open, or jot both down somewhere safe.

## Step 3 — Let the app sign in with Google & use your Drive (Google Cloud)

This step lets the app (a) log you in with your Google account and (b) save
filed documents into *your* Google Drive, not anyone else's.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign
   in with your own Google account (the one you want your house documents
   filed into).
2. Create a new project (top-left, near the Google Cloud logo) — call it
   "Filing Cabinet" or similar.
3. Search for **"Google Drive API"** in the search bar at the top and click
   **Enable**.
4. On the left sidebar, find **Google Auth Platform** → **Branding**. Fill in
   an app name (e.g. "My Filing Cabinet") and your email — this is just the
   name Google shows you when you log in later, nobody else sees it.
5. Still under Google Auth Platform, go to **Audience** and click **Publish
   app** → confirm. (Without this, your login would stop working every 7
   days — this makes it permanent.)
6. Go to **Clients** → **Create client** → choose **Web application**.
   - Under "Authorized redirect URIs," you'll add a web address here — but
     you won't know the exact address until Step 5 (after you've put the app
     online). It's fine to skip this for now and come back to add it later.
7. Click **Create**. You'll be shown a **Client ID** and **Client secret** —
   two more of those "special password" codes. Copy both somewhere safe before
   closing the page (the secret can only be viewed this one time!).

## Step 4 — Get an AI key (Anthropic)

This is the "brain" that actually reads your scanned documents.

1. Go to [platform.claude.com](https://platform.claude.com) → sign up → find
   **API Keys** in the account settings → create a new key.
2. Copy the key somewhere safe (it starts with `sk-ant-...`).
3. You'll need to add a small amount of billing credit (a few dollars covers
   a lot of household documents — this app is cheap to run for one person).

## Step 5 — Put it online (Vercel)

1. Go to [vercel.com](https://vercel.com) → sign up, ideally using the same
   GitHub account from Step 1 (it makes linking the project automatic).
2. Import your `filing-cabinet` project from GitHub.
3. Before it deploys, you'll be able to add all the codes you collected above
   as **Environment Variables** — this is the "settings sheet" mentioned
   earlier. Claude Code can fill these in for you if you paste them in when
   asked, or you can add them by hand in Vercel's dashboard under **Settings →
   Environment Variables**.
4. Click **Deploy**. In a minute or two, Vercel gives you a real web address
   like `https://your-app-name.vercel.app` — that's your app's home on the
   internet.

## Step 6 — Connect the last piece (back to Google)

Now that you have a real web address from Step 5, go back to Google Cloud
(Step 3) → **Clients** → your client → **Authorized redirect URIs** → add:

```
https://your-app-name.vercel.app/api/auth/callback/google
```

(swap in your actual address from Step 5) → **Save**.

## Step 7 — Try it out

Visit your web address, click **Sign in with Google**, choose your account,
and approve access. (Google may show an "unverified app" warning — that's
expected for a brand-new personal app; click **Advanced → Go to [your app]
(unsafe)** to continue. It's safe — it's the app you just built.)

Once you're in, drag in a scanned invoice or a photo of a manual and watch it
get read, sorted, and filed into a new **"House Docs"** folder that appears in
your own Google Drive.

---

## If you get stuck

Every step above has a moment where you copy a code from one website and paste
it somewhere else — that's the part most likely to trip someone up (a stray
space, a half-copied key). If something doesn't work, the error message
usually says which piece is missing or wrong. Claude Code is very good at
reading those error messages and telling you exactly what to fix — that's the
main reason we recommend doing this alongside it rather than totally solo.

# UROps Deployment Guide

**Follow these steps exactly. You do NOT need to write any code.**

## Phase 1: The Database (Supabase)

1. Go to **[supabase.com](https://supabase.com)** and sign up.
2. Click **"New Project"**.
3. Name it `UROps`.
4. Enter a strong database password (SAVE THIS!).
5. Select a region near you (e.g. London, Cape Town, N. Virginia).
6. Click **"Create new project"**.
7. Wait ~2 minutes for it to setup.
8. Once ready, go to **Project Settings** (Cog icon at bottom left).
9. Click **"Database"**.
10. Scroll to **"Connection String"** -> **"URI"**.
11. Copy the string that looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
    * *Note: You will need to replace `[YOUR-PASSWORD]` with the password you created in step 4.*
12. **SAVE THIS STRING.** We call this the `DATABASE_URL`.
13. Also copy the "Direct connection" string (checkbox usually just adds `?pgbouncer=true` or removes port 6543). Usually for Prisma we want the **Transaction Pooler** (Port 6543) for the `DATABASE_URL` and the **Session Pooler** (Port 5432) for `DIRECT_URL`.
    * *Simpler instruction:* Just use the main Connection String for both variable names below if confused, but ideally:
    * `DATABASE_URL`: Port 6543 version.
    * `DIRECT_URL`: Port 5432 version (Mode: Session).

## Phase 2: The Code (GitHub)

1. Go to **[github.com](https://github.com)** and sign up.
2. Click **"New"** (Top left green button) to create a repository.
3. Name it `urops`.
4. Select **"Private"**.
5. Click **"Create repository"**.
6. You will see a screen "Quick setup". Look for the link **"uploading an existing file"**. Click it.
7. Open your computer folder `UROps`.
8. Select ALL files and folders (src, public, package.json, etc.) and DRAG them into the GitHub page.
    * *Note: GitHub web upload has a limit of 100 files. Since this is a fresh project, it might fit. If not, you might need to use the "GitHub Desktop" app.*
    * **Recommended**: Download **[GitHub Desktop](https://desktop.github.com/)**.
    * Log in to GitHub Desktop.
    * File -> "Add Local Repository" -> Select your `UROps` folder.
    * Click "Publish repository" -> Select Private -> Publish.

## Phase 3: The App (Vercel)

1. Go to **[vercel.com](https://vercel.com)** and sign up (Login with GitHub).
2. Click **"Add New..."** -> **"Project"**.
3. You should see your `urops` repository from GitHub. Click **"Import"**.
4. **Configure Project**:
   * Framework Preset: **Next.js** (Should be auto-detected).
   * Root Directory: `./` (Default).
5. **Environment Variables** (CRITICAL STEP):
   * Click to expand "Environment Variables".
   * Copy these from your `.env` file into Vercel:
     * `DATABASE_URL` (Supabase URI)
     * `DIRECT_URL` (Supabase Direct)
     * `NEXT_PUBLIC_SUPABASE_URL`
     * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     * `GEMINI_API_KEY` (Your AI Key)
     * `RESEND_API_KEY` (Your Email Key)
     * `NEXT_PUBLIC_SITE_URL` (Set this to your Vercel URL later)
6. Click **"Deploy"**.

## Phase 4: Going Live (Mobile & Desktop)

1. **Dashboard access**: Once Vercel says "Ready", click the link it provides (e.g., `urops.vercel.app`).
2. **Setup for PM (Mobile)**:
   * Send that link to the PM's phone via WhatsApp/Email.
   * Open the link in **Safari** (iPhone) or **Chrome** (Android).
   * **iPhone**: Tap the "Share" icon -> **"Add to Home Screen"**.
   * **Android**: Tap the menu (three dots) -> **"Install App"**.
   * It will now look and feel like a native app on their phone.
3. **Login**: Both of you can now login with your accounts.

## Troubleshooting

* **Build Failed?** Check the logs. Usually a typo in a database URL.
* **Email not working?** Ensure your `RESEND_API_KEY` is in Vercel and your domain is verified at [resend.com/domains](https://resend.com/domains).
* **AI not working?** Ensure `GEMINI_API_KEY` is added to Vercel.

**Enjoy your new Operating System!**

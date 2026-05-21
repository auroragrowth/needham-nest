# Needham Nest Café — Setup Guide

Step-by-step to get the project from nothing → deployed shell app on Vercel, connected to Supabase, version-controlled on GitHub, ready for Phase 0 development in VS Code.

> Companion to [CAFE_BRIEF_V1.md](./CAFE_BRIEF_V1.md). Target end state: empty Next.js 15 app deployed to Vercel, authed to Supabase, no features yet — pristine foundation for Phase 0.

---

## 0. Prerequisites — check you have these

Run each in a terminal. If any are missing, install before continuing.

```bash
node --version    # need v20 or higher
npm --version     # ships with node
git --version     # any recent version
```

Accounts needed (free tiers fine for v1):
- [ ] [GitHub](https://github.com) account
- [ ] [Supabase](https://supabase.com) account
- [ ] [Vercel](https://vercel.com) account (sign in with GitHub for easiest setup)
- [ ] VS Code installed

VS Code extensions worth installing now:
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **Prisma** (optional, if you end up using Prisma — we won't in v1)
- **GitLens**

---

## 1. Create the GitHub repo

1. Go to https://github.com/new
2. Repository name: `needham-nest` (or `needham-nest-app`)
3. **Private**
4. Do NOT initialise with README, .gitignore, or licence — we'll do that locally
5. Click **Create repository**
6. Leave the page open — you'll need the SSH/HTTPS URL in step 3

---

## 2. Bootstrap the Next.js project

Open a terminal in the folder where your code lives (e.g. `~/code` or `C:\dev`).

```bash
npx create-next-app@latest needham-nest
```

Answer the prompts:
- TypeScript? **Yes**
- ESLint? **Yes**
- Tailwind CSS? **Yes**
- `src/` directory? **Yes**
- App Router? **Yes**
- Turbopack? **Yes**
- Customize the default import alias? **No** (keep `@/*`)

Then:

```bash
cd needham-nest
code .
```

That opens the project in VS Code.

---

## 3. Connect to GitHub

In VS Code's terminal (Ctrl+\` or Cmd+\`):

```bash
git init
git add .
git commit -m "Initial Next.js scaffold"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/needham-nest.git
git push -u origin main
```

(Swap the remote URL for the HTTPS one if you don't have SSH keys set up.)

Refresh the GitHub page — you should see your code there.

---

## 4. Create the Supabase project

1. Go to https://supabase.com/dashboard
2. Click **New project**
3. Organization: pick or create one (e.g. "Needham Nest")
4. Project name: `needham-nest-prod`
5. Database password: generate a strong one and **save it to a password manager immediately**
6. Region: **London (eu-west-2)** for UK-based cafe
7. Plan: **Free** for now (upgrade later when going live)
8. Click **Create new project** and wait ~2 minutes while it provisions

When it's ready, go to **Project Settings → API** and grab three values:
- **Project URL** (e.g. `https://xxxxx.supabase.co`)
- **anon public key**
- **service_role secret key** — treat this like a password, never commit it

---

## 5. Wire Supabase into the app

In the VS Code terminal:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Create `.env.local` in the project root (next to `package.json`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

Verify `.env.local` is in `.gitignore` (it should be by default from `create-next-app`). If not, add it:

```bash
echo ".env.local" >> .gitignore
```

Create the Supabase client helpers. Make these two files:

`src/lib/supabase/client.ts` — for client components:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`src/lib/supabase/server.ts` — for server components and server actions:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* called from a Server Component — ignore */ }
        },
      },
    }
  )
}
```

Commit:

```bash
git add .
git commit -m "Wire up Supabase client + env"
git push
```

---

## 6. Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **Import** next to your `needham-nest` GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Project name: `needham-nest` (this becomes part of the URL)
5. **Environment Variables** — add all three from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Click **Deploy**

Wait ~1 minute. When done, Vercel gives you a URL like `https://needham-nest.vercel.app`. Open it — you should see the default Next.js welcome page.

---

## 7. Sanity check the Supabase connection

Edit `src/app/page.tsx` to actually hit Supabase. Replace the contents with:

```tsx
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').select('*').limit(1)

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Needham Nest Café</h1>
      <p className="mt-4">
        Supabase connection:{' '}
        {error?.code === '42P01'
          ? '✅ Connected (profiles table not yet created — expected)'
          : error
          ? `❌ ${error.message}`
          : '✅ Connected'}
      </p>
    </main>
  )
}
```

Test locally first:

```bash
npm run dev
```

Open http://localhost:3000 — should show the "Connected" message.

Then commit and push:

```bash
git add .
git commit -m "Verify Supabase connection from home page"
git push
```

Vercel will auto-deploy on push. Visit the Vercel URL — same message there.

---

## 8. Project structure to set up (skeleton for Phase 0)

In VS Code, create these empty folders and placeholder files. This mirrors the structure you'll grow into during Phase 0:

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (owner)/
│   │   └── layout.tsx
│   ├── (manager)/
│   │   └── layout.tsx
│   ├── (staff)/
│   │   └── layout.tsx
│   ├── api/
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── ui/
│   └── shared/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils.ts
└── types/
    └── database.ts
```

You don't need to fill these now — they're just the shape you'll grow into.

---

## 9. Set up branch protection on GitHub

Once the main branch is in good shape:

1. GitHub repo → **Settings → Branches**
2. **Add branch protection rule** for `main`
3. Tick: **Require a pull request before merging**
4. Tick: **Require status checks** (Vercel preview will populate here once it runs)
5. Save

Workflow from here: develop on feature branches → push → Vercel builds a preview URL automatically → merge to main → auto-deploys to production.

---

## 10. Final check — you're ready for Phase 0 when:

- [ ] `npm run dev` runs without errors on http://localhost:3000
- [ ] Home page shows "✅ Connected" for Supabase
- [ ] Pushing to `main` auto-deploys to `https://needham-nest.vercel.app`
- [ ] Preview deployments appear on feature branches
- [ ] `.env.local` is gitignored (not in GitHub)
- [ ] Database password and service_role key are saved in a password manager
- [ ] Repo is private

---

## What comes next — Phase 0 (1–2 weeks)

Once setup is done, Phase 0 of the build plan (CAFE_BRIEF_V1.md §11) is the first real work:

1. Create the `user_role` enum + `profiles` table in Supabase (SQL Editor)
2. Write RLS policies for `profiles`
3. Build the login flow (Supabase Auth)
4. Build the three role-gated layouts (`(owner)`, `(manager)`, `(staff)`)
5. Build the profile setup form (first-login flow)
6. Build the `settings` table + onboarding screen

When you're ready for that, ask for the Phase 0 detailed plan and I'll walk you through it task by task.

---

## Quick reference — handy commands

```bash
# Run locally
npm run dev

# Build to check for errors before pushing
npm run build

# Lint
npm run lint

# Create a feature branch
git checkout -b phase-0-profiles

# Push the branch and create a PR
git push -u origin phase-0-profiles
# (Then open the PR in GitHub)

# Update from main
git checkout main
git pull
git checkout phase-0-profiles
git rebase main
```

---

## Troubleshooting

**"Module not found: @/lib/supabase/server"** — your `tsconfig.json` should have `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`. `create-next-app` does this by default; if it's missing, add it.

**Vercel deploy fails with env var error** — go to Vercel project → Settings → Environment Variables and re-check all three are there for the Production environment.

**Supabase queries return "JWT expired" or similar** — your anon key is probably a service key by mistake, or vice versa. Re-grab from Supabase dashboard → Project Settings → API.

**Local dev shows the Vercel deployed version not your code** — Next.js dev server caches aggressively. Stop with Ctrl+C, delete `.next/` folder, restart `npm run dev`.

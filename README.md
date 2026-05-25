# CoinLit

CoinLit is a Next.js learning platform with user accounts, course progress, admin management, achievements, trades, and Postgres persistence.

## Local Development

```bash
npm install
npm run dev
```

Local development can work without `POSTGRES_URL` or `DATABASE_URL`; in that mode the app uses JSON files in `data/` as a fallback database. These files are ignored by git.

## Production On Vercel

Vercel must use a real Postgres database. The easiest option is Neon through Vercel Storage. Serverless deployments cannot rely on local JSON files for users, passwords, bans, courses, progress, or achievements.

Add these Environment Variables in Vercel:

```bash
POSTGRES_URL=postgres://user:password@host:5432/database
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_LOGIN=admin
ADMIN_PASSWORD=admin123321
```

You can generate `JWT_SECRET` locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then deploy the project. The admin panel will be available at:

```text
https://your-domain.vercel.app/admin
```

If your provider gives you `DATABASE_URL` instead of `POSTGRES_URL`, the app supports that too.

## Build Check

```bash
npm run build
```

The build also runs `npm run check:encoding`, which prevents broken Cyrillic text such as `Рљ...` or replacement symbols from being shipped.

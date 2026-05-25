# CoinLit

CoinLit is a Next.js learning platform with user accounts, course progress, admin management, achievements, trades, and MySQL persistence.

## Local Development

```bash
npm install
npm run dev
```

Local development can work without `DATABASE_URL`; in that mode the app uses JSON files in `data/` as a fallback database. These files are ignored by git.

## Production On Vercel

Vercel must use a real MySQL-compatible database. Serverless deployments cannot rely on local JSON files for users, passwords, bans, courses, progress, or achievements.

Add these Environment Variables in Vercel:

```bash
DATABASE_URL=mysql://user:password@host:3306/database
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

## Build Check

```bash
npm run build
```

The build also runs `npm run check:encoding`, which prevents broken Cyrillic text such as `Рљ...` or replacement symbols from being shipped.

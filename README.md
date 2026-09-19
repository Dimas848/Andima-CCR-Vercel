This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## CI/CD workflow

This repository promotes changes through:

```text
feature/* -> development -> staging -> main
```

Each promotion is made with a pull request. Pull requests targeting `development`, `staging`, or `main`, and pushes to those branches, run the GitHub Actions `CI / validate` check. The check installs locked dependencies with `npm ci`, then runs:

```bash
npm run lint
npm run typecheck
npm run build
```

### Promotion flow

1. Create `feature/<short-description>` from `development`.
2. Open a pull request into `development` and wait for review and `CI / validate`.
3. Open a pull request from `development` into `staging` after development verification.
4. Verify the staging deployment, then open a pull request from `staging` into `main`.
5. After approval, merge to `main` and manually promote the protected Vercel production deployment.

Direct pushes, force pushes, and branch deletion should be disabled for `development`, `staging`, and `main`. Configure each GitHub branch rule to require pull requests, at least one approval, the `CI / validate` check, and an up-to-date branch. Enable dismissal of stale approvals after new commits.

### Vercel environments

Configure the Vercel project with Git integration using:

- `development` as the development branch
- `staging` as the staging environment/branch
- `main` as the production branch
- Other branches as preview deployments

Keep environment variables in Vercel's environment settings and never commit `.env` files or secrets. Enable deployment protection or manual production promotion so a merge to `main` requires explicit release approval. If staging fails, fix the issue through a new feature pull request and promote the corrected commit again. If production needs to be rolled back, promote the previous Vercel deployment before preparing a corrective change.

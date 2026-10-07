# Daily practice habit tracker

The implemented slice is Today, saved checkoffs, and daily/weekly streaks. Habit creation and History from SPEC.md remain unfinished. All habit records stay in this browser's localStorage.

Use Node 22.23.3 and pnpm 11.18.0. Install with `pnpm install --frozen-lockfile`. Run the current suite with `npm test`. The commands below are framework commands; Vitest, Playwright, a linter, and a separate type checker are not configured.

Hydration is an optional daily preset. Its completion threshold is the user's personal daily goal, with no prescribed quantity or automatic measurement. It defaults off. Enable the addition button with `NUXT_PUBLIC_HYDRATION_HABIT=true npm run generate`. Disable additions with `NUXT_PUBLIC_HYDRATION_HABIT=false npm run generate`. Publish `.output/public` for static hosting. Rebuild after changing the flag; a static deployment cannot read changed server environment variables at runtime. Existing hydration records remain usable when disabled.

See [launch checklist, deployment, and rollback runbook](docs/launch.md). No production deployment has been performed.

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

# Fly.io deployment

The `10mcj-bot` app runs as one always-on polling worker in Paris (`cdg`), using the
project's `.fly-account3` account. `fly.toml` requests one shared CPU and 512 MB of RAM.
Keep exactly one active Machine per bot token, including local development processes.

## Container and runtime

`Dockerfile` pins Bun 1.4.4, compiles TypeScript, installs production dependencies, and
runs as the `bun` user. Its build generates a thumbnail to verify the native `canvas`
addon, font, and media assets with the production dependencies. `.dockerignore` allows
only source, dependency manifests, and the required checked-in assets into the build context.

After package-manager or lockfile changes, verify a clean installation with an empty
`node_modules`. The initial Bun migration omitted executable metadata that an existing
installation masked; the clean image build caught the missing `prebuild-install` command.
The corrected lockfile preserves all resolved versions and includes the executable metadata.

The worker starts with `bun build/app.js`. The TypeScript compilation preserves the
existing module layout and erases interface imports in decorated services.
`files/temp/` and generated media are disposable; MongoDB stores durable data.

The image server is public at `https://10mcj-bot.fly.dev`. Fly routes HTTP and HTTPS
to port `15000` and redirects HTTP to HTTPS. The `/health` endpoint returns 200 when
MongoDB is connected and 503 otherwise. Traffic-based autostopping is disabled, and
the restart policy keeps the worker running after an exit.

The bot still contains legacy image-gallery links to the previous host and localhost.
The gallery is publicly accessible at `https://10mcj-bot.fly.dev/images`.

## Configuration and secrets

`fly.toml` sets `NODE_ENV=production`, `RUNNING_ENV=production`, `DB_TYPE=mongodb`, and
`PORT=15000`. Store `BOT_TOKEN`, `ADMIN_CHAT_ID`, and `MONGODB_URL` as Fly secrets.
The experimental video flow additionally needs `FILESTACK_API_KEY` and `SHOTSTACK_API_KEY`.

Atlas must permit the Fly worker's outbound IP address. Local Proton VPN connectivity
does not test the Fly Machine's connection; verify the database readiness check after deployment.

## Deploy and verify

Stop local polling processes using this bot token before starting the Fly worker.
The immediate deployment strategy replaces the single worker without a parallel canary.
It skips waiting for health checks, so verify readiness and startup logs after each deploy.

GitHub Actions deploys pushes to `main` after typechecking and offline tests pass. The
workflow builds on the GitHub runner and serializes deployments to avoid overlapping
pollers. It waits for exactly one running worker and a passing readiness check. The
repository secret `FLY_API_TOKEN` must contain a deploy token scoped to `10mcj-bot`;
rotate the token before its expiry. Fly billing must be enabled for the worker to keep
running beyond the trial's five-minute limit.

```sh
bun run typecheck
bun run test
FLY_CONFIG_DIR="$HOME/.fly-account3" fly deploy --app 10mcj-bot --remote-only --depot=false --wg=true --https-failover=false --ha=false --dns-checks=false --yes
FLY_CONFIG_DIR="$HOME/.fly-account3" fly status --app 10mcj-bot
FLY_CONFIG_DIR="$HOME/.fly-account3" fly checks list --app 10mcj-bot
FLY_CONFIG_DIR="$HOME/.fly-account3" fly logs --app 10mcj-bot --no-tail
```

The remote builder uses Fly's encrypted WireGuard transport. Confirm one running `bot` Machine,
a passing readiness check, and successful database and Telegram startup messages.

See Fly's [app configuration](https://fly.io/docs/reference/configuration/) and
[health check documentation](https://fly.io/docs/reference/health-checks/).

# Fly.io deployment

The `10mcj-bot` app runs as one always-on polling worker in Paris (`cdg`), using the
project's `.fly-account3` account. `fly.toml` requests one shared CPU and 512 MB of RAM.
Keep exactly one active Machine per bot token, including local development processes.

## Container and runtime

Fly and local Docker Compose build the same `Dockerfile`. See the [Docker guide](docker.md) for local
Compose and standalone production container instructions. It pins Bun 1.4.4, compiles TypeScript,
installs production dependencies, and runs as the `bun` user. Its build generates a thumbnail to
verify the native `canvas` addon, font, and media assets with the production dependencies.
`.dockerignore` allows only source, dependency manifests, and the required checked-in assets into
the build context.

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

For AI thumbnails, use the default Codex provider as described in the
[Docker guide](docker.md#ai-thumbnail-credentials). The `chatgpt-web` provider currently does not
work in headless Chromium and must not be enabled on Fly.

The following command is retained for staging a ChatGPT web session cookie after the headless
provider limitation has been fixed. Do not deploy this configuration while it remains unsupported.

```sh
(
  read -rs -p 'ChatGPT session cookie: ' thumbnail_cookie || exit 1
  printf '\n' >&2
  printf 'AI_THUMBNAIL_PROVIDER=chatgpt-web\nCHATGPT_SESSION_COOKIE=%s\n' "$thumbnail_cookie" \
    | FLY_CONFIG_DIR="$HOME/.fly-account3" fly secrets import --stage --app 10mcj-bot
)
```

For the default Codex provider, set `CODEX_AUTH_JSON` as a Fly secret.
Stage a ChatGPT login cache from a trusted Codex installation with this Bash command.

```sh
jq -cr '"CODEX_AUTH_JSON=" + tojson' "${CODEX_HOME:-$HOME/.codex}/auth.json" \
  | FLY_CONFIG_DIR="$HOME/.fly-account3" fly secrets import --stage --app 10mcj-bot
```

If the app already has a `CODEX_API_KEY` secret, stage its removal before switching to the ChatGPT
login cache. The next deployment applies the staged changes.

```sh
FLY_CONFIG_DIR="$HOME/.fly-account3" fly secrets unset --stage --app 10mcj-bot CODEX_API_KEY
```

Rotate the ChatGPT login secret before replacing the Machine if the current cache has refreshed.
[AI thumbnail credentials](docker.md#ai-thumbnail-credentials)

To switch a worker back to Codex, stage `AI_THUMBNAIL_PROVIDER=codex` with
`FLY_CONFIG_DIR="$HOME/.fly-account3" fly secrets set --stage --app 10mcj-bot AI_THUMBNAIL_PROVIDER=codex`.
Confirm the Codex login secret is current before deploying.

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

## Migrate existing access lists

1. Review the legacy `white-lists` and `black-lists` MongoDB collections. Collect the IDs from
   approved editors and resolve any legacy blocks that should remain in force before cutover.
   Keep both legacy collections for reference.
2. In `mongosh`, select the database used by the bot. Fill in the two arrays with confirmed
   decimal IDs as strings, then run the snippet. It creates the unique indexes and can be rerun.

   ```javascript
   const editorIds = [];
   const blockedIds = [];
   const lists = [
     ["telegram-whitelist", editorIds],
     ["telegram-blacklist", blockedIds],
   ].map(([name, ids]) => [name, ids.map(value => {
     const id = Number(value);
     if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(id) || id < 1 || id > 2 ** 52 - 1) {
       throw new Error(`Invalid Telegram user ID: ${value}`);
     }
     return id;
   })]);

   for (const [name, ids] of lists) {
     const collection = db.getCollection(name);
     collection.createIndex({ userId: 1 }, { unique: true });
     for (const userId of ids) {
       collection.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });
     }
   }
   ```

3. Stop the old Telegram poller. In the same database, drop the old username index before
   starting the new release. This preserves the existing user records and the unique `id` and
   `domainId` indexes.

   ```javascript
   const users = db.getCollection("simple users");
   if (db.getCollectionNames().includes("simple users") &&
       users.getIndexes().some(index => index.name === "username_1")) {
     users.dropIndex("username_1");
   }
   ```

4. Start the new release. It uses `telegram-whitelist` and `telegram-blacklist`. Use designated
   test accounts to verify an ordinary user can format text and preview a thumbnail, an editor
   can complete an approved workflow, and a blocked user gets denied before activity is recorded.

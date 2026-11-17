# Fly.io deployment

Fly.io is the intended host. This repository does not yet include a Dockerfile or `fly.toml`;
deployment setup is the next step after this dependency and documentation refresh.

## Runtime requirements

- Build with Node.js 26 and the pnpm version pinned in `package.json`:
  `pnpm install --frozen-lockfile`, then `pnpm build`.
- Start with `node build/app.js`. Runtime files include `build/`, production dependencies,
  and the checked-in `files/` assets. Run from the application root.
- Include the native libraries required by `canvas` in the container. A Debian-based image
  supports its Linux glibc prebuilt binaries; source builds need the compiler and Cairo/Pango libraries.
- Use an external MongoDB database and inject `BOT_TOKEN`, `ADMIN_CHAT_ID`, `MONGODB_URL`,
  `DB_TYPE=mongodb`, and `RUNNING_ENV=production`. Store credentials with Fly secrets.
- Run one Machine per bot token. Polling and in-memory conversations assume a single active instance;
  the deployment strategy must also avoid overlapping pollers during releases.
- Keep the Machine running. Telegram polling makes outbound requests, so incoming HTTP traffic
  cannot wake a stopped bot. If an HTTP service is configured, disable automatic stopping.
- Treat `files/temp/` as disposable storage. Durable data belongs in MongoDB.

See Fly's [Node.js guide](https://fly.io/docs/js/the-basics/) and
[autostop/autostart documentation](https://fly.io/docs/launch/autostop-autostart/).

## Before the first deployment

1. Add and verify the container build and Fly configuration.
2. Choose whether to expose the existing image server. If exposed, match Fly's internal port
   to `PORT` (currently `15000` by default) and review access to the image routes.
3. Add health checks and graceful shutdown for the bot, HTTP server, and database connection.
4. Set secrets, confirm MongoDB connectivity, and verify the Telegram commands with a development bot.

Use the project-specific Fly account for all deployment and log commands, for example:

```sh
FLY_CONFIG_DIR="$HOME/.fly-account3" fly status --app <app-name>
FLY_CONFIG_DIR="$HOME/.fly-account3" fly logs --app <app-name>
```

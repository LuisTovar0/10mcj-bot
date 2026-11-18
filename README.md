# 10 McJ bot

A Telegram bot that helps prepare Portuguese [10 Minutes with Jesus](https://10minuteswithjesus.org/)
messages and media for forwarding. The previous production deployment has been retired.
The app is being reworked as a Telegram bot, with Fly.io as the deployment target.

The existing code formats text for Telegram and Signal, handles audio, generates thumbnails,
stores images, and tracks requests and access lists. Video creation is experimental.

## Local development

Requirements: [Bun](https://bun.sh/docs/installation) 1.4.4 (pinned in `.bun-version` and `package.json`),
MongoDB, and a Telegram bot token
from [BotFather](https://t.me/BotFather). Use a separate bot for development.

```sh
bun install --frozen-lockfile
cp .env.example .env
```

Fill in `.env`, then run this command from the repository root:

```sh
bun run dev
```

Development compiles TypeScript and restarts the compiled app with Bun when it changes. The bot polls
Telegram; the accompanying image server listens on `PORT` (default `15000`). Start a chat with
your bot before running it, so it can send startup messages to `ADMIN_CHAT_ID`.

`canvas` needs native libraries. Prebuilt binaries cover common platforms; if installation falls
back to compilation, follow the [node-canvas build instructions](https://github.com/Automattic/node-canvas#compiling).
`trustedDependencies` in `package.json` allows its native install script.

## Configuration

| Variable            | Purpose                                                                                       |
|---------------------|-----------------------------------------------------------------------------------------------|
| `BOT_TOKEN`         | Telegram bot token.                                                                           |
| `ADMIN_CHAT_ID`     | Numeric Telegram chat ID of the administrator.                                                |
| `RUNNING_ENV`       | `development`, `test`, or `production`. Development limits access to the admin and whitelist. |
| `DB_TYPE`           | Use `mongodb`. The legacy `local` repositories do not cover all required services.            |
| `MONGODB_URL`       | MongoDB connection URI.                                                                       |
| `PORT`              | Optional HTTP port; defaults to `15000`.                                                      |
| `FILESTACK_API_KEY` | Only needed for the experimental video upload flow.                                           |
| `SHOTSTACK_API_KEY` | Only needed for the experimental video render flow.                                           |

Runtime configuration can come from `.env` locally or injected environment variables on Fly.io.
Keep real credentials out of Git.

## Checks and production build

```sh
bun run typecheck
bun run test
bun run build
bun run start
```

`bun run test` runs the domain and service tests, including thumbnail generation, without a database
or Telegram credentials. Tests are compiled before Mocha runs them on Bun, preserving TypeDI decorator metadata.
Use `bun run test` for this Mocha suite; `bun test` invokes Bun's separate built-in test runner.
`bun run start` runs the existing build; compile during deployment, before starting the process.
Keep the TypeScript build: it erases interface imports in decorated services before Bun runs them.
Running `src/app.ts` directly currently fails on those imports.

The repository tests require a disposable MongoDB database. Create an ignored `.test.env` with
`RUNNING_ENV=test`, `DB_TYPE=mongodb`, and a `MONGODB_URL` pointing to that database, then run
`bun run test-repos`. The environment loader overrides inherited values with `.test.env` for this command.
These tests write records; never point them at production data.
`bun run test-services` runs only the service tests.

## Project notes

- [Architecture](docs/architecture.md): entry points, storage, and existing integrations.
- [Fly.io deployment](docs/deployment.md): worker configuration, deployment, checks, and private gallery access.

Licensed under the [MIT License](LICENSE.txt).

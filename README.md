# 10 McJ bot

A Telegram bot that helps prepare Portuguese [10 Minutes with Jesus](https://10minuteswithjesus.org/)
messages and media for forwarding. The previous production deployment has been retired.
The app is being reworked as a Telegram bot, with Fly.io as the deployment target.

The existing code formats text for Telegram and Signal, handles audio, generates thumbnails,
stores images, and tracks requests and access lists. Video creation is experimental.

## Run locally with Docker

Install Docker with Compose and create `.env` from the example if needed.

```sh
test -f .env || cp .env.example .env
```

Set `BOT_TOKEN` to a development bot token from [BotFather](https://t.me/BotFather) and
`ADMIN_CHAT_ID` to your Telegram user ID. Send `/start` to the bot before launching the stack.

```sh
docker compose up --build -d --wait
docker compose logs -f bot
```

Compose builds the same image Fly uses and starts a local MongoDB. See the [Docker guide](docs/docker.md)
for configuration, persistence, production runs, and lifecycle commands. Keep one poller per bot token.

## Local development with Bun

For live reload, install Bun 1.4.4 (pinned in `.bun-version` and `package.json`) and provide a MongoDB
instance reachable from your host. Use the same development bot credentials.
[Bun installation](https://bun.sh/docs/installation)

```sh
bun install --frozen-lockfile
test -f .env || cp .env.example .env
```

Set `MONGODB_URL` in `.env` to the host-accessible MongoDB URI, then run this command from the repository root.

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
| `ADMIN_CHAT_ID`     | Positive numeric Telegram user ID of the administrator.                                       |
| `RUNNING_ENV`       | `development`, `test`, or `production`. Development limits access to the admin and whitelist. |
| `DB_TYPE`           | Use `mongodb`. The legacy `local` repositories do not cover all required services.            |
| `MONGODB_URL`       | MongoDB connection URI.                                                                       |
| `PORT`              | Optional HTTP port; defaults to `15000`.                                                      |
| `FILESTACK_API_KEY` | Only needed for the experimental video upload flow.                                           |
| `SHOTSTACK_API_KEY` | Only needed for the experimental video render flow.                                           |

Runtime configuration comes from `.env` locally, `.production.env` for a standalone Docker host, or
injected environment variables on Fly.io. See the [Docker guide](docs/docker.md). Keep real credentials
out of Git.

## Telegram permissions

In production, users can format messages and generate thumbnail previews unless they are
blocked. The admin and allowlisted editors can also use `/img_add` and, when `CHANNEL` is set,
`/pt_enviar`. Development admits only the admin and allowlisted editors. A block takes precedence
over a grant. Editors can get their own Telegram user ID from [@userinfobot](https://t.me/userinfobot)
and send it to the admin. Usernames can change without affecting permissions.

Only the admin can manage lists or run `/report`.

| Command                    | Action                 |
|----------------------------|------------------------|
| `/whitelist_add <user_id>` | Grant editor access    |
| `/whitelist_rm <user_id>`  | Remove editor access   |
| `/whitelist_all`           | Show approved user IDs |
| `/blacklist_add <user_id>` | Block a user           |
| `/blacklist_rm <user_id>`  | Remove a block         |
| `/blacklist_all`           | Show blocked user IDs  |

Add and remove commands accept one positive decimal ID up to `4503599627370495`, the
52-bit limit for [Telegram user IDs](https://core.telegram.org/bots/api#user). Repeating an add
command leaves a single entry.

### Migrate existing access lists

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
- [Docker](docs/docker.md): local Compose setup and production container runs.
- [Fly.io deployment](docs/deployment.md): worker configuration, deployment, checks, and private gallery access.

Licensed under the [MIT License](LICENSE.txt).

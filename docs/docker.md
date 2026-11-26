# Docker

The production image is built from the repository's `Dockerfile`. Docker Compose uses that image
for local development and adds a local MongoDB database. Fly.io uses the same Dockerfile for its
production worker. The bot polls Telegram, so run only one active container per bot token.

## Local development with Docker Compose

Install Docker Engine or Docker Desktop with Docker Compose. Create a local environment file from
the checked-in example if you do not already have one.

```sh
test -f .env || cp .env.example .env
```

Set `BOT_TOKEN` to a development bot token and `ADMIN_CHAT_ID` to your Telegram user ID. Open a chat
with the development bot and send `/start` before starting the stack. Keep a separate bot token for
development and production.

Start the application and wait for MongoDB and the app's health checks to pass.

```sh
docker compose up --build -d --wait
docker compose logs -f bot
```

The app is reachable at `http://127.0.0.1:15000`. Its readiness endpoint is `/health`. The local
MongoDB uses the named `mongo-data` volume, so its records survive container recreation and `docker
compose down`. The Compose configuration selects the bundled database and development permissions
even if `.env` contains a different `MONGODB_URL` or `RUNNING_ENV`.

Set `PORT` in `.env` to choose a different host port. The app still listens on port `15000` inside
the container. The published port is bound to `127.0.0.1` on the host.

For automatic rebuilds during development, run Compose in the foreground with watch enabled:

```sh
docker compose up --build --watch
```

Changes to application source, included media, dependency manifests, TypeScript configuration,
the Dockerfile, or `.dockerignore` rebuild the image and recreate the bot container. Changes to
Compose configuration or `.env` require restarting the command. TypeScript is compiled during the
image build, so build errors are reported before the replacement container starts. Press Ctrl+C to
stop the stack. Without watch mode, rerun `docker compose up --build -d --wait` after changes.

Useful lifecycle commands:

```sh
docker compose ps
docker compose logs -f bot
docker compose stop
docker compose down
```

`docker compose down -v` also deletes the local MongoDB data volume. Run it only when you want to
discard that database.

## Production image on a Docker host

The image defaults to production mode, MongoDB, and port `15000`. Create an ignored `.production.env`
with these settings. Replace the placeholders with production values.

```dotenv
BOT_TOKEN=<production Telegram bot token>
ADMIN_CHAT_ID=<numeric Telegram user ID>
RUNNING_ENV=production
DB_TYPE=mongodb
MONGODB_URL=<MongoDB URI reachable from the container>
PORT=15000
```

Values in an env file override the defaults in the image, so set `RUNNING_ENV` and `DB_TYPE` as shown.
The MongoDB URI must resolve and be reachable from inside the container. Do not use `localhost` for
a database running on the host. On Docker Desktop, use `host.docker.internal`. On Linux, add
`--add-host host.docker.internal:host-gateway` to `docker run` and use that hostname in the URI.
Ensure the database accepts connections from the Docker host interface.

Build and start the production image.

```sh
docker build -t 10mcj-bot .
docker run -d --init --name 10mcj-bot --restart unless-stopped \
  --env-file .production.env \
  -p 127.0.0.1:15000:15000 \
  10mcj-bot
```

Docker's init process forwards stop signals to Bun. The container health check requests `/health`,
which returns success when MongoDB is connected. The port above is available only through host
loopback, so put a reverse proxy in front of it if outside clients need to reach the image server.

```sh
docker ps
docker inspect --format '{{.State.Health.Status}}' 10mcj-bot
docker logs -f 10mcj-bot
docker stop 10mcj-bot
```

To update the image, rebuild it, stop and remove the running container, then start it again with the
same env file and port mapping.

```sh
docker build -t 10mcj-bot .
docker stop 10mcj-bot
docker rm 10mcj-bot
docker run -d --init --name 10mcj-bot --restart unless-stopped \
  --env-file .production.env \
  -p 127.0.0.1:15000:15000 \
  10mcj-bot
```

The bot's MongoDB data remains in the external database.

## Production on Fly.io

The repository's Fly configuration builds the same Dockerfile. GitHub Actions deploys changes to
`main` after typechecking and unit tests pass. Configure `BOT_TOKEN`, `ADMIN_CHAT_ID`, and
`MONGODB_URL` as Fly secrets. The worker listens on port `15000`, and the readiness check uses
`/health`. Deployment and account-specific checks are documented in the [Fly deployment guide](deployment.md).

## Configuration

The bot requires these settings at startup:

| Variable        | Purpose                                                                           |
|-----------------|-----------------------------------------------------------------------------------|
| `BOT_TOKEN`     | Telegram bot token.                                                               |
| `ADMIN_CHAT_ID` | Numeric Telegram ID of the administrator.                                         |
| `MONGODB_URL`   | MongoDB connection string reachable from the container.                           |
| `RUNNING_ENV`   | `development` for local Compose, `production` on Fly or a production Docker host. |
| `DB_TYPE`       | Use `mongodb`.                                                                    |
| `PORT`          | HTTP port inside the container. Defaults to `15000`.                              |

`CHANNEL` enables the optional channel publishing command. `FILESTACK_API_KEY` and
`SHOTSTACK_API_KEY` are only needed for the experimental video workflow. Keep credentials in local
ignored env files or the deployment platform's secret store, never in the image or source control.

## AI thumbnail credentials

Editors and the admin can use `/pt_img_ai` and the **Criar capa com IA** button when the selected
provider has valid credentials. `chatgpt-web` currently does not work in headless Chromium, so do not
select it for the bot. `AI_THUMBNAIL_PROVIDER=codex` uses the Codex CLI and is the default.

| Variable                 | Value                                                                                                                                                                                                     |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CHATGPT_SESSION_COOKIE` | For `chatgpt-web`, the session cookie from a signed-in `chatgpt.com` browser, as `name=value`. If the browser splits the cookie into numbered parts, supply each part as `name=value`, separated by `; `. |
| `CODEX_AUTH_JSON`        | The complete Codex `auth.json` from a ChatGPT login, compacted to one line with `jq -c .`. The CLI reads and refreshes a private copy in the `bun` user's home.                                           |
| `CODEX_API_KEY`          | API-billed Codex credentials. The pinned CLI requires a ChatGPT login for image generation.                                                                                                               |

For **Docker Compose**, set the selector and the corresponding credential in the ignored `.env`
file used by the `bot` service. Wrap the credential value in single quotes so Compose preserves it
literally. Recreate the bot with `docker compose up -d --force-recreate --no-deps bot`.

For **standalone Docker**, set the selector and credential in `.production.env` and use
`docker run --env-file` as shown above. Put the credential directly after the variable's `=` since
Docker's `--env-file` preserves outer quotes. Replace the container after updating the file.

The **ChatGPT web** provider is currently unsupported in the bot because it does not work in
headless Chromium. The cookie and troubleshooting details below are retained for diagnosing that
provider while this limitation is being addressed. Do not deploy it for thumbnail generation.

For **ChatGPT web** diagnostics, sign in normally and use your browser's developer tools to find the
session cookie for `https://chatgpt.com`. Include each numbered part when applicable. Treat the value
like a password. When sign-in fails, use the job's `sign-in-response` log to check its HTTP status and
whether the page asked for verification.

- For `session-expired`, rotate the secret from a fresh signed-in ChatGPT session.
- For `verification-required`, check ChatGPT in a regular browser for an interactive verification step.
- For `access-denied`, the worker received HTTP 403 without a recognized verification prompt.

Use `AI_THUMBNAIL_PROVIDER=codex` with current Codex credentials for thumbnail generation.
[ChatGPT login verification](https://help.openai.com/en/articles/9889414-why-am-i-being-asked-to-verify-my-login)

For **Codex**, use `CODEX_AUTH_JSON` and leave `CODEX_API_KEY` unset. The CLI writes `auth.json` with
owner-only permissions and reuses it across jobs and restarts in the same container. Container
replacement reloads `CODEX_AUTH_JSON` from the supplied secret. Rotate the secret when the cached
credentials refresh and the original login cache expires.
[Codex authentication](https://learn.chatgpt.com/docs/auth) · [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

The image build verifies Chromium, the bundled CLI, and the media assets as the runtime user.
Install the matching headless browser before running the offline browser fixtures directly on Linux.

```sh
bun --bun run playwright install --only-shell chromium
docker build -t 10mcj-bot .
docker run --rm --entrypoint codex 10mcj-bot --version
```

Before enabling `chatgpt-web` on Fly, use a development bot and run its container with
`--memory=512m` to match the worker limit. In Telegram, send `/pt_img_ai Uma vida de oração`
as the admin or an editor, select a recognizable background, and confirm the draft. Verify
that the acknowledgement arrives promptly and the returned image includes the background,
title, and Portuguese date.

For debugging, find the `[thumbnail-ai]` lines in the Compose output or logs (`docker compose logs -f bot`). Follow one
`jobId` from `job-start` to `job-finished`. A `cli-exit`
line shows the selected Codex model (`model`), whether Codex started a turn, its exit code, and a
diagnostic hint when the bot recognizes the error. If Codex reports a model switch, the line also
shows `routedModel`. The built-in image tool in CLI 0.172.0 uses `gpt-image-2` to generate the image.
Review lines give scores and whether the text matched. Share the lines for the affected job.

Put style examples under `files/thumbnail-examples/` with a JPG, JPEG or PNG extension.
The ChatGPT web provider selects **High** effort and attaches the background first, followed by each
style example as a separate file in filename order. Codex also receives every original sample as a
separate attachment during generation and review. It chooses a layout to suit the subject and text,
then uses that choice for review and retries. The pinned image tool accepts five files per call.
With up to four samples, Codex passes the background and every sample directly to the tool.
With a larger library, Codex sees them all and chooses up to four to pass with the background.

The image includes the compiled application, production dependencies, and required checked-in media.
Generated files under `files/temp/` are cleared on startup and are not persistent storage.

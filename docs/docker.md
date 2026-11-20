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

After changing application source, rebuild and recreate the container.

```sh
docker compose up --build -d --wait
```

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

The image includes the compiled application, production dependencies, and required checked-in media.
Generated files under `files/temp/` are cleared on startup and are not persistent storage.

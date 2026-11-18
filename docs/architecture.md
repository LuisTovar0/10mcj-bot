# Architecture

This is a TypeScript application compiled to CommonJS and executed with Bun. TypeDI wires repositories
and services together using decorators and reflection metadata. Keep compilation with `tsc` to preserve
the existing module layout and erase interface imports in decorated services. Bun 1.4.4 supports decorator
metadata, but direct execution of the current source fails on those interface imports.

## Startup and Telegram

- `src/app.ts` loads dependencies, starts the HTTP server, prepares temporary files, and starts the bot.
- `src/config/` reads environment variables and selects repository implementations.
- `src/loaders.ts` registers dependencies with TypeDI and starts the database connection.
- `src/service/telegram-bot/bot.service.ts` registers Botgram middleware, commands, and message handlers.
- `src/service/telegram-bot/commands/` contains the Portuguese text/audio and image workflows and access lists.

Botgram receives updates through long polling. Telegram does not call the HTTP server.
Run a single process per bot token. Conversation state lives in memory and is lost on restart.

## Persistence and media

MongoDB stores users, request history, access lists, image metadata, and file buffers.
The local repository implementations are incomplete, so use MongoDB for the current application.
`src/domain/` contains entities; `src/mappers/` translates domain, database, and DTO representations.

`src/service/canvas.service.ts` generates thumbnails using the font and images in `files/`.
Downloaded media is temporary and kept in `files/temp/`, which is cleared at startup.
The Shotstack service contains an experimental video workflow using Filestack and Shotstack.
Formatting text for Signal does not send messages to Signal.

## HTTP server and tests

`src/server.ts` serves `/`, `/images`, and `/image/:id` (also with a `.png` suffix).
These image routes have no authentication, so the Fly deployment keeps the server private.
`/health` reports whether MongoDB is connected and is used by Fly's readiness check.

`test/unit/domain/` and `test/unit/service/` run offline. Tests under `test/**/repo/` connect
to MongoDB, including files historically labelled as unit tests. Both sets compile using
`tsconfig.test.json` before Mocha executes them on Bun.

The Mocha-only `glob` and `minimatch` overrides in `package.json` preserve security fixes.
Keep them scoped to Mocha because Botgram uses an older minimatch API. Remove the overrides
when Mocha's dependency ranges include the fixes.

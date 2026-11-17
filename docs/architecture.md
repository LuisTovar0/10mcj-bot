# Architecture

This is a TypeScript application compiled to CommonJS for Node.js 26. TypeDI wires repositories
and services together using decorators and reflection metadata.

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
These image routes currently have no authentication. Decide whether to expose them before deploying.

`test/unit/domain/` and `test/unit/service/` run offline. Tests under `test/**/repo/` connect
to MongoDB, including files historically labelled as unit tests. Both sets compile using
`tsconfig.test.json` before execution.

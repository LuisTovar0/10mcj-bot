FROM oven/bun:1.4.4-debian AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates fontconfig \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN bun run build

FROM base AS production-dependencies

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS runtime

ENV NODE_ENV=production

COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/build ./build
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun files ./files

RUN mkdir -p files/temp && chown bun:bun /app && chown -R bun:bun files/temp

USER bun

# Exercise the native addon and media assets with only production dependencies.
RUN bun --no-env-file -e 'require("reflect-metadata"); const fs = require("node:fs"); const CanvasService = require("./build/service/canvas.service").default; const image = await new CanvasService().generate(fs.readFileSync("files/rapaz.jpg"), "17 Novembro 2026", "10 Minutes with Jesus"); if (image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Thumbnail smoke test failed"); console.log("Production thumbnail smoke test passed");'

CMD ["bun", "build/app.js"]

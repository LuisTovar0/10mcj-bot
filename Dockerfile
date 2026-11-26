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

FROM base AS codex-cli

ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && case "$TARGETARCH" in \
        amd64) arch=x86_64; sha=a2342a8f7f68f088be30620ccfe9cb84162c93a6b56177855961cda3ed6be392 ;; \
        arm64) arch=aarch64; sha=0b99526c185a4425fe96a2214fb7b6a6a7f7c1471883b7afbebe97e15e83e79e ;; \
        *) exit 1 ;; \
    esac \
    && curl -fsSL "https://github.com/openai/codex/releases/download/rust-v0.172.0/codex-${arch}-unknown-linux-musl.tar.gz" -o codex.tar.gz \
    && echo "$sha  codex.tar.gz" | sha256sum -c - \
    && tar -xzf codex.tar.gz \
    && install -m 0755 "codex-${arch}-unknown-linux-musl" /usr/local/bin/codex

FROM base AS runtime

ENV NODE_ENV=production \
    RUNNING_ENV=production \
    DB_TYPE=mongodb \
    HOME=/home/bun \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
    PORT=15000

COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && bun --no-env-file node_modules/playwright/cli.js install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=bun:bun /app/build ./build
COPY --from=codex-cli /usr/local/bin/codex /usr/local/bin/codex
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun files ./files

RUN mkdir -p files/temp && chown bun:bun /app && chown -R bun:bun files/temp

USER bun

RUN test "$(id -u)" -ne 0 \
    && test "$(codex --version)" = 'codex-cli 0.172.0' \
    && bun --no-env-file -e 'const fs = require("node:fs"); const dir = "files/thumbnail-examples"; const examples = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && /\.(?:jpe?g|png)$/i.test(entry.name)); if (!examples.length) throw new Error("Missing thumbnail examples"); for (const entry of examples) fs.accessSync(`${dir}/${entry.name}`, fs.constants.R_OK);'

RUN bun --no-env-file -e 'const { chromium } = require("playwright"); const browser = await chromium.launch({ headless: true }); try { await (await browser.newPage()).goto("about:blank"); } finally { await browser.close(); }'

# Exercise the native addon and media assets with only production dependencies.
RUN bun --no-env-file -e 'require("reflect-metadata"); const fs = require("node:fs"); const CanvasService = require("./build/service/canvas.service").default; const image = await new CanvasService().generate(fs.readFileSync("files/rapaz.jpg"), "17 Novembro 2026", "10 Minutes with Jesus"); if (image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Thumbnail smoke test failed"); console.log("Production thumbnail smoke test passed");'

EXPOSE 15000

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s \
    CMD ["bun", "-e", "const response = await fetch(`http://127.0.0.1:${process.env.PORT}/health`); process.exit(response.ok ? 0 : 1);"]

CMD ["bun", "build/app.js"]

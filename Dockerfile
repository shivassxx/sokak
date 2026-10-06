# ---- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/rules/package.json packages/rules/
COPY packages/bots/package.json packages/bots/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# server + production node_modules only
RUN pnpm --filter @sokak/server deploy --legacy --prod /out

# ---- runtime stage ---------------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=2567 \
    CLIENT_DIR=/app/client \
    ANALYTICS_FILE=/app/data/analytics.jsonl
COPY --from=build /out ./server
COPY --from=build /app/apps/server/dist ./server/dist
COPY --from=build /app/apps/client/dist ./client
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:2567/health || exit 1
CMD ["node", "server/dist/index.js"]

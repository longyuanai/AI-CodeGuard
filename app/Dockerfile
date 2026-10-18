# Build from the repository root: docker build -f app/Dockerfile -t ai-codeguard-app:local .
FROM node:22-bookworm-slim AS build
WORKDIR /opt/codeguard
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
COPY app/tsconfig.json app/tsup.config.ts ./app/
COPY app/src ./app/src
RUN npm run build && npm run build -w app
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /opt/codeguard
COPY --from=build --chown=node:node /opt/codeguard/package.json ./package.json
COPY --from=build --chown=node:node /opt/codeguard/app/package.json ./app/package.json
COPY --from=build --chown=node:node /opt/codeguard/node_modules ./node_modules
COPY --from=build --chown=node:node /opt/codeguard/dist ./dist
COPY --from=build --chown=node:node /opt/codeguard/app/dist ./app/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "app/dist/index.js"]

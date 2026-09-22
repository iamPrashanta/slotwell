# Slotwell — production-style image used by the local Podman stack (compose.yml).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN BETTER_AUTH_SECRET=build-only-placeholder-secret-not-for-runtime BETTER_AUTH_URL=http://localhost:3004 npm run build \
 && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/next.config.ts ./
USER node
EXPOSE 3000
# Apply migrations, add demo data when DEV_PASSWORD_LOGIN=true, then start.
CMD ["sh", "-c", "node server/migrate.mjs && { [ \"$DEV_PASSWORD_LOGIN\" = true ] && node scripts/seed.mjs || true; } && exec node node_modules/next/dist/bin/next start"]

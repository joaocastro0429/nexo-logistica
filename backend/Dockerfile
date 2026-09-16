FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd /app/backend && npm install --no-audit --no-fund
COPY backend ./backend
RUN cd /app/backend && npm run build
WORKDIR /app/backend

FROM build AS production-dependencies
RUN cd /app/backend && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app/backend
COPY --from=production-dependencies --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/backend/drizzle ./drizzle
COPY --from=build --chown=node:node /app/backend/package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]

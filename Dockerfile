FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG SITE_CONFIG_VERSION=local
RUN --mount=type=secret,id=site_env,target=/app/.env npm run build

FROM node:24-alpine AS worker
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts
# Release extraction keeps directories private; the unprivileged worker must own its modules.
COPY --chown=node:node server ./server
COPY deploy/hosts.json ./deploy/hosts.json
RUN mkdir -p /logs /data/reader && chown node:node /logs /data/reader && chmod 700 /data/reader
USER node
CMD ["node", "server/index.mjs"]

FROM caddy:2.11.4-alpine AS web
# Local ports are unprivileged; remove the binary capability before cap_drop ALL.
RUN setcap -r /usr/bin/caddy
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/site
COPY --from=build /app/lab-dist /srv/lab

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
COPY database database
RUN npm run build --workspace @forgeflow/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S forgeflow && adduser -S forgeflow -G forgeflow
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @forgeflow/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY database database
COPY samples samples
RUN mkdir -p /app/storage && chown -R forgeflow:forgeflow /app/storage
USER forgeflow
EXPOSE 8080 9092
CMD ["node", "apps/api/dist/server.js"]

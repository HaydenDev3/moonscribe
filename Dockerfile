# Moonscribe — self-host with Docker
# Builds the app, then runs the sync server (node:sqlite + static files).
# All the writers' data lives in the mounted /app/data volume.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run icons && npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/public ./public
VOLUME ["/app/data"]
ENV DATA_DIR=/app/data
EXPOSE 3001
CMD ["node", "server/index.js"]

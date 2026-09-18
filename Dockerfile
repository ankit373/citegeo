FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY assets/brand/citegeo-emblem.svg assets/brand/citegeo-lockup.svg ./assets/brand/
RUN npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8787 PRODUCT_DATA_DIR=/app/data/product-v2
LABEL org.opencontainers.image.title="CiteGEO"
LABEL org.opencontainers.image.description="Open-source AI brand visibility and competitor reports"
LABEL org.opencontainers.image.source="https://github.com/ankit373/citegeo"
LABEL org.opencontainers.image.licenses="MIT"
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist/src ./dist/src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/assets/brand ./assets/brand
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health', { signal: AbortSignal.timeout(3000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/src/product/product-server.js"]

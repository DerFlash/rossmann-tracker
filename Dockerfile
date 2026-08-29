FROM mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e

ARG APP_VERSION
ARG APP_REVISION=development
ARG APP_BUILD_DATE

WORKDIR /app

COPY tracker/package.json tracker/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY tracker/src ./src
COPY tracker/public ./public
COPY tracker/config.example.json /app/config/default.json
COPY products.json /app/config/products.json
COPY LICENSE.md THIRD_PARTY_NOTICES.md /app/
# tracker/package.json verweist relativ von /app/package.json auf ../LICENSE.md.
COPY LICENSE.md /LICENSE.md

ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    APP_REVISION=${APP_REVISION} \
    APP_BUILD_DATE=${APP_BUILD_DATE} \
    CONFIG_PATH=/app/config/default.json \
    DATA_DIR=/app/data \
    BROWSER_DATA_DIR=/app/browser-data \
    WEB_UI_PATH=/app/public/index.html \
    CATALOG_PATH=/app/config/products.json \
    CHROME_DEBUG_PORT=9222 \
    PORT=8787

LABEL org.opencontainers.image.title="Rossmann Store Tracker" \
      org.opencontainers.image.description="Inoffizieller Community-Tracker für Rossmann-Filialbestände" \
      org.opencontainers.image.source="https://github.com/DerFlash/rossmann-tracker" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${APP_REVISION}" \
      org.opencontainers.image.created="${APP_BUILD_DATE}"

EXPOSE 8787
STOPSIGNAL SIGTERM

CMD ["xvfb-run", "-a", "node", "src/app.js"]

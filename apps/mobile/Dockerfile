# Build versi web (React Native Web via Expo) lalu sajikan dengan nginx.
# Android/iOS TIDAK dijalankan di container: dibangun lewat EAS Build (lihat README).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Tahan koneksi putus: ulangi unduhan hingga 5x, dan simpan paket di cache build
# sehingga build berikutnya tidak perlu mengunduh ulang dari nol.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --prefer-offline
COPY . .
ARG EXPO_PUBLIC_API_URL=/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_NO_TELEMETRY=1 \
    CI=1
RUN npx expo export -p web --output-dir dist

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1

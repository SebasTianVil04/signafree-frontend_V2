FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM caddy:2-alpine
COPY --from=build /app/dist/signaFree-frontend-v2/browser /srv
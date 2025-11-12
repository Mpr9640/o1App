# ---------- base builder ----------
FROM node:20-alpine AS base
WORKDIR /app

# If you have native addons (node-sass, sharp, etc.), you may need build tools:
# RUN apk add --no-cache python3 make g++

COPY package*.json ./
# ensure devDependencies are installed (webpack lives here)
RUN npm ci --include=dev
COPY . .

# ---------- build web (React) ----------
FROM base AS web
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
RUN npm run build

# ---------- build extension ----------
FROM base AS ext
# Use npx so the local node_modules/.bin is used
RUN npx webpack --mode production --config webpack.config.js

# ---------- runtime for web ----------
FROM nginx:alpine
COPY --from=web /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]

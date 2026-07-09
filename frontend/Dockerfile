# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# CRA bakes env vars at build time. Default empty => the app calls "/api",
# which nginx proxies to the backend (single-origin deployment).
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# yarn.lock is optional (the * glob won't fail if it's absent).
COPY package.json yarn.lock* ./
RUN yarn install --network-timeout 600000

COPY . .
RUN yarn build

# ---- Runtime stage ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

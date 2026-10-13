FROM node:24.14-alpine AS base
WORKDIR /app
ENV HOME=/tmp \
    YARN_CACHE_FOLDER=/tmp/yarn-cache \
    PORT=8080
EXPOSE 8080

FROM base AS dev
ENV APP_ENV=dev
# git pour Husky (installation des hooks) et lint-staged, lancés dans ce conteneur.
RUN apk add --no-cache git
CMD ["node", "--watch", "src/server.ts"]

FROM base AS prod-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --ignore-scripts --non-interactive \
    && yarn cache clean

FROM base AS prod
ENV APP_ENV=prod \
    NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
CMD ["node", "src/server.ts"]

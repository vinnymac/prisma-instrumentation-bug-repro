FROM node:22.13-alpine3.21 AS base

WORKDIR /app

ENV YARN_VERSION=4.6.0

# install and use yarn 4.x
RUN corepack enable && corepack prepare yarn@${YARN_VERSION}

# Configure Yarn
COPY .yarn .yarn
COPY .yarnrc.yml .yarnrc.yml

FROM base AS builder

# https://github.com/mhart/alpine-node?tab=readme-ov-file#caveats
RUN apk update && apk add --no-cache gcompat

WORKDIR /app
ENV NODE_ENV=production

COPY .gitignore .gitignore
COPY .yarn .yarn
COPY .yarnrc.yml .yarnrc.yml
COPY package.json yarn.lock tsconfig.json nest-cli.json ./
COPY prisma prisma

# Install Dependencies
RUN --mount=type=cache,target=/root/.yarn,id=api-global-cache \
    yarn

COPY src src
RUN yarn prisma generate
RUN yarn run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk update && apk add --no-cache gcompat \
    curl \
    sudo

COPY --from=builder /app .

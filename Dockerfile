FROM node:22.12.0-slim

RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g vite-plus

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN vp install --frozen-lockfile

COPY prisma ./prisma
RUN vp exec prisma generate

COPY . .
RUN vp build
RUN ls -la build/server/ && head -1 build/server/index.js && cat package.json | grep type

ENV NODE_ENV=production
EXPOSE 8080
CMD ["vp", "run", "start"]

FROM node:22.12.0-slim AS build

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

# pnpm のシンボリックリンク構造を実体化して runner にコピーできるようにする
RUN cp -rL node_modules /tmp/node_modules_dereferenced

FROM node:22.12.0-slim AS runner

RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /tmp/node_modules_dereferenced ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]

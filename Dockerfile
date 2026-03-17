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

FROM node:22.12.0-slim AS runner

RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g vite-plus

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml

EXPOSE 8080
CMD ["vp", "start"]

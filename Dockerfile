FROM node:18


WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN curl -fsSL https://get.docker.com | sh
COPY . .
RUN npx prisma generate
RUN npm install supabase@beta

CMD ["sh", "./localdev.sh"]

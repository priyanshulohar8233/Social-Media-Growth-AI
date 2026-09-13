# BrainGrow - production image
# Usage: docker build -t braingrow . && docker run -p 8080:8080 --env-file .env -v braingrow-data:/app/prisma braingrow
# NOTE: for multi-instance scale-out use Postgres (set DATABASE_URL) instead of the bundled SQLite volume.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build needs dev deps (typescript, prisma). Install prisma CLI for migration at runtime.
RUN npm install --no-save prisma@5.22.0

RUN npx prisma generate
RUN npm run build

# Apply migrations at container start, then serve
CMD sh -c "npx prisma migrate deploy && npx next start --port 8080"
EXPOSE 8080
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY prisma ./prisma/
COPY packages ./packages/

# Install dependencies
RUN npm ci

# Copy API source code
COPY apps/api ./apps/api

# Generate Prisma Client
RUN npx prisma generate

# Create directory for uploads
RUN mkdir -p apps/api/uploads/kyc

WORKDIR /app/apps/api

# Build production TypeScript output
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/index.js"]

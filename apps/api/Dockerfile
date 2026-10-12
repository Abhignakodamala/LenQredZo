FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy API source code
COPY apps/api ./apps/api

# Generate Prisma Client
RUN npx prisma generate

# Create directory for uploads
RUN mkdir -p apps/api/uploads/kyc

WORKDIR /app/apps/api

EXPOSE 5000

CMD ["npm", "run", "dev"]

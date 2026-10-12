FROM node:20-alpine

WORKDIR /app

# Install dependencies required by native build tools
RUN apk add --no-cache libc6-compat

# Copy root monorepo files
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy web source code
COPY apps/web ./apps/web

WORKDIR /app/apps/web

# Build Next.js application
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]

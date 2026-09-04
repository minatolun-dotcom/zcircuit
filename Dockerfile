FROM node:22-slim

RUN corepack enable

WORKDIR /app

# Install dependencies first for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile

# Build the app.
COPY . .
RUN corepack pnpm build

EXPOSE 5173

# Serve the production build (vite preview).
CMD ["sh", "-c", "corepack pnpm preview --host 0.0.0.0 --port 5173"]

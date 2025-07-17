ARG NODE_VERSION=24.4.1

FROM node:${NODE_VERSION}-alpine

WORKDIR /app

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY package.json bun.lock* ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "if [ \"$WATCH_FILES\" = \"1\" ]; then npm run dev; else npm run start; fi"]

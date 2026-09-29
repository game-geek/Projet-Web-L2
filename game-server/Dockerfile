FROM oven/bun:1.3.12

LABEL org.opencontainers.image.source=https://github.com/game-geek/Projet-Web-L2

WORKDIR /src

COPY package.json ./
RUN bun install

COPY . .

RUN bun run build

EXPOSE 4433

CMD ["bun", "run", "src/app.ts"]

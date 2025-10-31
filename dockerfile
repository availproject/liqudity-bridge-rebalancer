FROM oven/bun:1

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile

COPY . .

RUN mkdir -p /app/data

EXPOSE 3000 3001

CMD ["bun", "run", "start"]

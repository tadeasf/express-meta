FROM oven/bun AS build

WORKDIR /app

COPY package.json package.json
COPY bun.lockb bun.lockb
COPY .env .env

RUN bun install

COPY ./src ./src

ENV NODE_ENV=production

RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun \
    --outfile server \
    ./src/index.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/server server
COPY --from=build /app/src ./src
COPY --from=build /app/.env .env

ENV NODE_ENV=production

# Add this line to print environment variables
RUN echo "API_KEY: $API_KEY"

CMD ["./server"]

EXPOSE 5555
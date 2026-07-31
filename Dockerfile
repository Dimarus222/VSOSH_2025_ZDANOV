# ---- build stage ----
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /kmkk-server .

# ---- run stage ----
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /kmkk-server ./kmkk-server
COPY --from=build /src/index.html /src/app.js /src/admin.html /src/admin.js ./
COPY --from=build /src/1.doc /src/1.jpg /src/1000067026.jpg /src/1774626280331.jpg /src/1774626579817.jpg \
                   /src/2.doc /src/2.jpg /src/3.doc /src/3.jpg /src/4.doc /src/4.jpg /src/5.doc /src/5.jpg \
                   /src/6.jpg /src/7.doc /src/IMG_20260308_141624_767.jpg /src/image-29.jpg /src/kadetsky.jpg /src/van.jpg ./

# Railway volume should be mounted at /app/data (Persistent Volume -> mount path /app/data)
ENV DATA_DIR=/app/data
ENV WEB_DIR=/app
ENV PORT=8080

EXPOSE 8080
CMD ["./kmkk-server"]

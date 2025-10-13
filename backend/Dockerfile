# ===== Build stage =====
FROM golang:1.23-alpine AS builder
WORKDIR /app

COPY backend/go.mod ./
RUN go mod download

COPY backend/. .

RUN go mod tidy
RUN go build -o main .

# ===== Run stage =====
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .

CMD ["./main"]

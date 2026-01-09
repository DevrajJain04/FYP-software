# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies (required for h3-go CGO)
RUN apk add gcc musl-dev

# Copy go mod files
COPY go.mod ./
COPY go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build -o main ./cmd/server

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add ca-certificates libc6-compat

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

# Run the application
CMD ["./main"]

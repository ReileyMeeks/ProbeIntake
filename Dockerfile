# syntax=docker/dockerfile:1
#
# One image that serves BOTH the SvelteKit SPA and the /api proxy on port 8080.
# Build:  container build -t probe-intake:latest .      (Apple container framework)
#     or: docker build   -t probe-intake:latest .
# Run:    container run --rm -p 8080:8080 --env-file .env probe-intake:latest
# See DOCKER.md for env setup and the password hash.

# ---- Stage 1: build the SvelteKit SPA (static) ----
FROM node:22-slim AS spa
WORKDIR /spa
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build
# → /spa/build  (adapter-static: index.html + assets)

# ---- Stage 2: build the Vapor proxy (static-linked Linux binary) ----
FROM swift:6.1-noble AS build
RUN apt-get -q update \
 && apt-get -q install -y libjemalloc-dev \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build
# Resolve deps first for a cacheable layer.
COPY proxy/Package.* ./
RUN swift package resolve $([ -f ./Package.resolved ] && echo "--force-resolved-versions" || true)
COPY proxy/ ./
RUN swift build -c release --product ProbeProxy --static-swift-stdlib -Xlinker -ljemalloc \
 && mkdir -p /staging \
 && cp "$(swift build -c release --show-bin-path)/ProbeProxy" /staging/ \
 && find -L "$(swift build -c release --show-bin-path)" -regex '.*\.resources$' -exec cp -Ra {} /staging/ \; \
 && cp "/usr/libexec/swift/linux/swift-backtrace-static" /staging/
# The built SPA becomes the Public dir the proxy serves at runtime.
COPY --from=spa /spa/build /staging/Public

# ---- Stage 3: runtime ----
FROM ubuntu:noble
RUN apt-get -q update \
 && apt-get -q install -y libjemalloc2 ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --user-group --create-home --system --skel /dev/null --home-dir /app vapor
WORKDIR /app
COPY --from=build --chown=vapor:vapor /staging /app
ENV SWIFT_BACKTRACE=enable=yes,sanitize=yes,threads=all,images=all,interactive=no,swift-backtrace=./swift-backtrace-static
USER vapor:vapor
EXPOSE 8080
ENTRYPOINT ["./ProbeProxy"]
CMD ["serve", "--env", "production", "--hostname", "0.0.0.0", "--port", "8080"]

FROM nexus.oigit.cn/library/node:22-alpine AS builder
WORKDIR /app

ARG NPM_REGISTRY=http://192.168.186.125:8081/repository/npm
ARG APP_BASE_PATH=/tanstack-start-admin
ARG APP_GATEWAY=/admin-api
ENV HUSKY=0
ENV COREPACK_NPM_REGISTRY=$NPM_REGISTRY \
    npm_config_registry=$NPM_REGISTRY \
    APP_BASE_PATH=$APP_BASE_PATH \
    APP_GATEWAY=$APP_GATEWAY

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm config set registry "$NPM_REGISTRY"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm codegen && pnpm build

ARG VERSION_INFO=""
RUN if [ -n "$VERSION_INFO" ]; then \
      printf "window._version_info='%s';\n" "$VERSION_INFO" > dist/version.js; \
    fi

FROM nexus.oigit.cn/library/nginx:1.21 AS runner

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html/tanstack-start-admin

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

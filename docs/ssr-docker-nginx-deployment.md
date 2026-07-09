# Docker / GitLab CI 部署说明

当前项目是 Vite SPA，生产运行形态为：

- Docker build 阶段使用 Node + pnpm 执行 `pnpm build`
- 最终镜像使用 Nginx 承载 `dist/` 静态文件
- GitLab CI 沿用团队 `oig-cli-shared-utils` 模板构建、推送镜像并更新 K8s 镜像

## 涉及文件

- `.gitlab-ci.yml`
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `nginx.conf.example`
- `deploy/nginx.conf`
- `deploy/<branch>/nginx.conf`
- `deploy/<branch>/source.env`

## CI 模型

流水线包含两个阶段：

```text
build -> deploy
```

`build` 阶段执行：

1. 读取团队远程模板中定义的 `UTILS_URL`
2. 读取 `deploy/$CI_COMMIT_REF_NAME/source.env`
3. 复制分支 Nginx 配置到 `deploy/nginx.conf`
4. 使用项目级 `.npmrc-ci` 配置 npm 私服，避免写入 runner 用户目录
5. 调用 `npx $UTILS_URL build:image`

项目构建不再在 CI 脚本里执行。`pnpm build` 位于 Dockerfile 的 builder stage 中，避免 CI 构建一次、Dockerfile 再构建一次。

`deploy` 阶段沿用团队模板：

```yaml
extends:
  - .include_env
  - .deploy_k8s
```

团队工具会根据 `source.env` 中的 K8s 元数据执行镜像更新。

## 分支约定

当前配置：

- `develop`：构建并部署
- `main`：构建并部署
- `release`：只构建镜像

每个分支都需要存在：

```text
deploy/<branch>/nginx.conf
deploy/<branch>/source.env
```

## source.env

`source.env` 是 shell 文件，会被 CI `source`。

当前默认字段：

```bash
export PROJECT_DIR=front
export K8S_PROJECT=front
export DEPLOYMENT_NAME=tanstack-start-admin-v1
export VITE_ENABLE_WORKSPACE_TABS=1
export VITE_ENABLE_DATA_TABLE_VIRTUALIZATION=1
```

说明：

- `PROJECT_DIR` 影响镜像仓库路径：`nexus.oigit.cn/$PROJECT_DIR/$CI_PROJECT_NAME:<tag>`
- `K8S_PROJECT` 是 K8s namespace
- `DEPLOYMENT_NAME` 是需要更新镜像的工作负载
- `VITE_*` 会在构建期固化到前端静态资源中

如果实际 namespace 或工作负载名称不同，优先修改对应分支的 `source.env`。

## Docker 镜像

Dockerfile 使用 multi-stage：

1. `nexus.oigit.cn/library/node:22-alpine` 安装依赖并执行 `pnpm build`
2. 构建前执行 `pnpm codegen`，生成 `src/lib/api/clients/*/generated/` 和 `openapi/.generated/`
3. 写入可选 `dist/version.js`
4. `nexus.oigit.cn/library/nginx:1.21` 只复制 `dist/` 和 Nginx 配置

`generated/` 目录不提交到仓库，因此 Docker build 必须在 `pnpm build` 前重新生成 API client。

生产镜像默认约定：

- `APP_BASE_PATH=/tanstack-start-admin`：前端公共路径，用于 Vite 静态资源 URL 和 TanStack Router `basepath`
- `APP_GATEWAY=/admin-api`：后端接口网关前缀，用于 OpenAPI codegen 和运行时 API 代理

这两个变量职责不同，不能互相替代。前端页面访问路径是 `/tanstack-start-admin/`，后端接口路径是 `/admin-api/...`。

最终容器监听 `80`。

本地验证：

```bash
docker compose up -d --build
curl -I http://127.0.0.1:3000/tanstack-start-admin/
```

`docker-compose.yml` 将宿主机 `127.0.0.1:3000` 映射到容器 `80`。

## Nginx 配置

当前 Nginx 配置用于子路径 SPA：

```nginx
root /usr/share/nginx/html;
index index.html;

location = / {
    return 302 /tanstack-start-admin/;
}

location /tanstack-start-admin/ {
    try_files $uri $uri/ /tanstack-start-admin/index.html;
}
```

说明：

- Dockerfile 将 `dist/` 复制到 `/usr/share/nginx/html/tanstack-start-admin`，因此 Nginx 使用 `root + /tanstack-start-admin/...` 即可直接命中文件。
- 只有 `/tanstack-start-admin/` 进入 SPA fallback，避免 `/admin-api/...` API 请求被前端 `index.html` 吃掉。
- `index index.html` 放在 `server` 级，对当前 server 的 location 生效，不需要在 `location /` 内重复配置。
- `client_max_body_size`、`absolute_redirect`、gzip 和 proxy timeout 作为团队 Nginx 基线配置保留在 `server` 级。
- 当前容器只承载静态资源，`proxy_*` timeout 只有在后续增加 `proxy_pass` 的 API location 时才会实际生效。

静态资源设置长期缓存，`version.js` 设置 `no-store`。

如果生产环境需要在前端容器内代理后端 API，应在对应分支的 `deploy/<branch>/nginx.conf` 中增加明确的 API location；不要把未知后端地址写进公共默认配置。

## 验收

提交前至少执行：

```bash
APP_BASE_PATH=/tanstack-start-admin APP_GATEWAY=/admin-api pnpm codegen
APP_BASE_PATH=/tanstack-start-admin APP_GATEWAY=/admin-api pnpm build
```

具备 Docker daemon 时继续执行：

```bash
docker build -t tanstack-start-admin:local .
docker run --rm -p 3000:80 tanstack-start-admin:local
curl -I http://127.0.0.1:3000/tanstack-start-admin/
```

CI 首次跑通后，重点检查：

- `build:image` 是否成功 push 到 `nexus.oigit.cn/front/tanstack-start-admin`
- `develop` / `main` 的 `deploy` 阶段是否更新到正确 namespace
- 浏览器访问深层路由是否能回退到 `index.html`
- `/admin-api/...` API 路由是否由 Ingress 或后端服务正确承接，不能落到前端 SPA fallback

# Docker / GitLab CI 部署说明

当前项目是 Vite SPA，生产运行形态为：

- Docker build 阶段使用 Node + pnpm 执行 `pnpm build`
- 最终镜像使用 Nginx 承载 `dist/` 静态文件
- GitLab CI 沿用团队 `oig-cli-shared-utils` 模板构建、推送镜像并更新 K8s 镜像

## 涉及文件

- `.gitlab-ci.yml.example`(模板参考,复制为 `.gitlab-ci.yml` 才会触发 CI)
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `nginx.conf.template`
- `scripts/render-nginx-config.mjs`

## CI 模型

流水线包含两个阶段：

```text
build -> deploy
```

`build` 阶段执行：

1. 读取团队远程模板中定义的 `UTILS_URL`
2. 根据 `workflow.rules.variables` 注入当前分支的镜像仓库和 Kubernetes 元数据
3. 使用项目级 `.npmrc-ci` 配置 npm 私服，避免写入 runner 用户目录
4. 调用 `npx $UTILS_URL build:image`

项目构建不再在 CI 脚本里执行。`pnpm build` 位于 Dockerfile 的 builder stage 中，避免 CI 构建一次、Dockerfile 再构建一次。

`deploy` 阶段沿用团队的 Kubernetes 部署模板：

```yaml
extends: .deploy_k8s
```

GitLab 会将匹配当前分支的变量提供给 build 和 deploy job，团队工具据此执行镜像构建与 Kubernetes 更新。

## 分支约定

分支差异直接维护在 `.gitlab-ci.yml.example` 的 `workflow.rules.variables` 中，不再维护分支级部署文件：

| 分支         | 行为         |
| ------------ | ------------ |
| `main`       | 构建并部署   |
| `features/*` | 只构建镜像   |

公共变量 `PROJECT_NAME=tanstack-start-admin`、`DEPLOYMENT_BASE=''` 在顶层 `variables` 中定义一次。

说明：

- `PROJECT_DIR` 和 `PROJECT_NAME` 共同决定镜像仓库路径：`nexus.oigit.cn/$PROJECT_DIR/$PROJECT_NAME:<tag>`
- `K8S_PROJECT` 是 K8s namespace
- `PROJECT_NAME` 通过 `-p` 显式传给团队工具，同时决定镜像名、容器名和默认工作负载名
- `DEPLOYMENT_BASE` 保留团队工具的默认部署名称解析行为

> 模板示例采用 `PROJECT_DIR=front`、`K8S_PROJECT=front`、`PROJECT_NAME=tanstack-start-admin`。真正启用 CI 时，复制为 `.gitlab-ci.yml` 并按实际 namespace 与镜像名调整。

如果 namespace 或镜像仓库路径变化，修改对应分支的 `workflow.rules.variables`。

## Docker 镜像

Dockerfile 使用 multi-stage：

1. `nexus.oigit.cn/library/node:22-alpine` 安装依赖
2. 使用 `APP_BASE_PATH` 将根目录 `nginx.conf.template` 渲染到 `/tmp/nginx.conf`
3. 执行 `pnpm codegen` 和 `pnpm build`，生成 API client 与 Vite 静态产物
4. 写入可选 `dist/version.js`
5. `nexus.oigit.cn/library/nginx:1.21` 复制 `dist/` 和渲染后的 Nginx 配置

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

根目录 `nginx.conf.template` 是唯一 Nginx 配置源，`${APP_BASE_PATH}` 在 Docker builder 阶段被替换。模板用于子路径 SPA：

```nginx
root /usr/share/nginx/html;
index index.html;

location = / {
    return 302 ${APP_BASE_PATH}/;
}

location ${APP_BASE_PATH}/ {
    try_files $uri $uri/ ${APP_BASE_PATH}/index.html;
}
```

说明：

- Dockerfile 将 `dist/` 复制到 `/usr/share/nginx/html${APP_BASE_PATH}`，因此 Nginx 使用 `root + ${APP_BASE_PATH}/...` 即可直接命中文件。
- 只有 `${APP_BASE_PATH}/` 进入 SPA fallback，避免 `/admin-api/...` API 请求被前端 `index.html` 吃掉。
- `index index.html` 放在 `server` 级，对当前 server 的 location 生效，不需要在 `location /` 内重复配置。
- `client_max_body_size`、`absolute_redirect`、gzip 和 proxy timeout 作为团队 Nginx 基线配置保留在 `server` 级。
- 当前容器只承载静态资源，`proxy_*` timeout 只有在后续增加 `proxy_pass` 的 API location 时才会实际生效。

静态资源设置长期缓存，`version.js` 设置 `no-store`。

如果生产环境需要在前端容器内代理后端 API，应在模板中增加明确的 API location 和独立配置变量；不要把未知后端地址写进公共默认配置。

## 构建期特性开关

旧的 `deploy/<branch>/source.env` 中 `VITE_ENABLE_WORKSPACE_TABS`、`VITE_ENABLE_DATA_TABLE_VIRTUALIZATION` 等字段不再维护。`src/config/env.ts` 集中读取 `VITE_*` 且 `workspaceTabsEnabled` 默认 `true`，未显式传入即启用。如需按环境开关，应在 Dockerfile 增加对应 `ARG` 并通过 CI `build:image` 的 `--build-arg` 传入。

## 验收

提交前至少执行：

```bash
APP_BASE_PATH=/tanstack-start-admin APP_GATEWAY=/admin-api pnpm codegen
APP_BASE_PATH=/tanstack-start-admin APP_GATEWAY=/admin-api pnpm build
APP_BASE_PATH=/tanstack-start-admin node scripts/render-nginx-config.mjs
```

具备 Docker daemon 时继续执行：

```bash
docker build -t tanstack-start-admin:local .
docker run --rm -p 3000:80 tanstack-start-admin:local
curl -I http://127.0.0.1:3000/tanstack-start-admin/
```

CI 首次跑通后，重点检查：

- `build:image` 是否成功 push 到 `nexus.oigit.cn/front/tanstack-start-admin`
- `main` 的 `deploy` 阶段是否更新到正确 namespace
- 浏览器访问深层路由是否能回退到 `index.html`
- `/admin-api/...` API 路由是否由 Ingress 或后端服务正确承接，不能落到前端 SPA fallback

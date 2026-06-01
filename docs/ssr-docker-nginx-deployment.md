# TanStack Start SSR 部署说明

本文档说明如何将当前项目以自建 SSR 方式部署，使用的运行形态为：

- Nitro `node-server`
- Docker / Docker Compose
- Nginx 反向代理

本文档对应当前仓库状态，其中 `vite.config.ts` 已配置为：

```ts
nitro({ preset: 'node-server' });
```

## 涉及文件

- `vite.config.ts`
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `nginx.conf.example`

## 部署模型

当前项目不是传统静态 SPA 的部署方式。

- Nginx 不直接托管 `dist/` 静态文件
- 页面由 Docker 容器中的 Node SSR 服务动态返回
- Nginx 只负责把请求转发给容器

## 前置条件

服务器需要具备以下环境：

- Linux
- Docker
- Docker Compose
- Nginx
- 已解析到该服务器的域名

当前项目在基础启动场景下不要求额外环境变量。

本仓库统一使用 `pnpm` 作为包管理器，锁文件以 `pnpm-lock.yaml` 为准。

## 首次部署

### 1. 上传代码

将项目代码放到服务器，例如：

```bash
mkdir -p /srv/tanstack-start-admin
cd /srv/tanstack-start-admin
```

然后把仓库内容上传到该目录。

### 2. 构建并启动容器

在项目根目录执行：

```bash
docker compose up -d --build
```

这一步会完成：

- 构建 Docker 镜像
- 在构建阶段执行 `pnpm build`
- 生成 `.output/server/index.mjs`
- 启动监听 `3000` 端口的 SSR 服务

### 3. 检查容器状态

```bash
docker compose ps
```

预期结果：

- `tanstack-admin` 容器状态为 `Up`

### 4. 查看应用日志

```bash
docker compose logs -f tanstack-admin
```

先确认没有启动报错。如果进程启动后立即退出，先排查应用问题，再继续配置 Nginx。

### 5. 在宿主机上验证应用响应

在接入 Nginx 前，先确认容器内应用本身可访问：

```bash
curl -I http://127.0.0.1:3000
```

预期结果：

- 返回正常 HTTP 响应，例如 `200`、`301` 或 `404`
- 不应该出现 `connection refused`

## Nginx 配置

以 `nginx.conf.example` 为模板。

Ubuntu 常见放置方式：

```bash
cp nginx.conf.example /etc/nginx/sites-available/tanstack-start-admin
ln -s /etc/nginx/sites-available/tanstack-start-admin /etc/nginx/sites-enabled/tanstack-start-admin
```

需要修改：

- `server_name your-domain.com;`

替换成真实域名。

当前 Nginx 配置会把所有请求转发到：

```nginx
proxy_pass http://127.0.0.1:3000;
```

注意：

- 不要使用 SPA 场景下常见的 `try_files $uri /index.html`
- 当前项目是 SSR，不是静态前端站点

### 校验并重载 Nginx

```bash
nginx -t
systemctl reload nginx
```

### 通过 Nginx 验证

```bash
curl -I http://your-domain.com
```

预期结果：

- 返回正常 HTTP 响应

## HTTPS

如果需要 HTTPS，建议在 Nginx 层做 TLS 终止，容器内应用继续使用 HTTP。

典型结构：

- Nginx 暴露 `80/443`
- 应用容器继续监听 `3000`
- Nginx 保留 `Host` 和 `X-Forwarded-*` 请求头

## 更新发布

如果采用服务器本机构建方式，可按以下流程更新：

```bash
cd /srv/tanstack-start-admin
git pull
docker compose up -d --build
docker image prune -f
```

这会重新构建镜像，并以新代码重启容器。

## 运行时检查

部署完成后，建议执行以下检查：

```bash
docker compose ps
docker compose logs --tail=100 tanstack-admin
curl -I http://127.0.0.1:3000
curl -I http://your-domain.com
```

可选端口检查：

```bash
ss -lntp | grep 3000
```

## 故障排查

### 502 Bad Gateway

先检查：

```bash
docker compose logs -f tanstack-admin
curl -I http://127.0.0.1:3000
```

如果 `127.0.0.1:3000` 无法响应，问题在应用容器，不在 Nginx。

### 容器启动后立即退出

检查：

```bash
docker compose logs -f tanstack-admin
```

常见原因：

- 构建失败
- 运行命令错误
- 运行时缺少必要文件

### 本机可访问，外网不可访问

检查以下项目：

- Nginx 是否加载了正确配置
- 防火墙是否放行 `80/443`
- DNS 是否正确指向当前服务器

### 沿用了静态 SPA 配置

如果 Nginx 中还保留了：

```nginx
try_files $uri /index.html;
```

请删除。这个规则适用于前端静态 SPA，不适用于 SSR Node 应用。

## 环境变量

当前项目在基础启动时不依赖额外环境变量。

如果后续需要增加：

- 服务端敏感变量应通过 Docker 运行时注入
- 不要把敏感信息写进镜像
- 除非变量需要暴露给浏览器，否则不要使用 `VITE_` 前缀

未来可放在 `docker-compose.yml` 中，例如：

```yaml
environment:
  NODE_ENV: production
  PORT: 3000
  HOST: 0.0.0.0
```

## 总结

当前项目的部署链路是：

1. 用 Docker 构建镜像
2. 在容器中运行 TanStack Start SSR 服务
3. 由 Nginx 将请求转发到 `127.0.0.1:3000`
4. 通过容器状态、宿主机响应和域名响应完成验收

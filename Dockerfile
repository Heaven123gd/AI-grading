# === 阶段一：构建阶段 (Build Stage) ===
# 使用一个包含编译工具的 Node.js 镜像
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json (利用 Docker 缓存)
COPY package*.json ./

# 安装依赖，包括开发依赖（如 TypeScript 编译器）
RUN npm install

# 复制所有的 TypeScript 源代码
COPY . .

# 执行编译（这是核心步骤）
# 确保您的 package.json 中有一个 "build" 脚本，例如: "tsc" 或 "babel src -d dist"
RUN npm run build

# === 阶段二：生产阶段 (Production Stage) ===
# 使用一个更小、更安全的 Node.js 镜像来运行最终应用
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json (仅用于安装生产依赖)
COPY package*.json ./

# 仅安装生产环境依赖
RUN npm install --only=production

# 从构建阶段复制编译好的 JavaScript 代码和配置文件
# 假设编译后的 JS 代码在 builder 镜像的 /app/dist 目录下
COPY --from=builder /app/dist ./dist

# 暴露 Cloud Run 要求的端口 (由 $PORT 环境变量提供)
EXPOSE 8080

# 定义容器启动命令
# 确保启动的是编译后的 JS 文件
CMD ["node", "dist/index.js"]

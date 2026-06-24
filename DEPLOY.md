# PayMvp 部署与调试指南

## 目录
1. [本地开发](#本地开发)
2. [Creem 配置](#creem-配置)
3. [Webhook 本地调试](#webhook-本地调试)
4. [Render 部署](#render-部署)
5. [常见问题](#常见问题)

---

## 本地开发

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

将 `backend/.env.example` 复制为 `backend/.env`：

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env` 填入 Creem 密钥。

### 3. 启动服务

```bash
cd backend
npm start
# 或开发模式（文件变更自动重启，Node 18+）
npm run dev
```

访问 `http://localhost:3000` 查看落地页。

---

## Creem 配置

### 注册 & 获取 API 密钥

1. 注册 [Creem](https://creem.io) 账号
2. 进入 Dashboard → Settings → API Keys
3. 创建 API Key（测试模式），复制密钥
4. 填入 `backend/.env` 的 `CREEM_API_KEY`

### 创建产品

1. Dashboard → Products → Create Product
2. 填写产品名称、价格（$0.01）、类型（One-time payment）
3. 创建后复制 Product ID
4. 填入 `backend/.env` 的 `CREEM_PRODUCT_ID`

### 配置 Webhook

1. Dashboard → Developers → Webhooks → Add Endpoint
2. URL: `https://你的域名/api/webhook`（本地调试用 ngrok/stripe-cli 转发）
3. Events: 勾选 `checkout.completed`
4. 创建后复制 Signing Secret
5. 填入 `backend/.env` 的 `CREEM_WEBHOOK_SECRET`

---

## Webhook 本地调试

Webhook 是 Creem 服务器主动 POST 到后端。本地开发时 Creem 无法访问 `localhost`，需要用 **ngrok** 或类似工具转发。

### 使用 ngrok

```bash
# 安装 ngrok (https://ngrok.com)
ngrok http 3000

# 会输出公网 URL 如 https://abc123.ngrok.io
# 在 Creem Dashboard 配置 Webhook: https://abc123.ngrok.io/api/webhook
```

### 测试支付流程

1. 确保后端运行中（`npm start`）
2. 确保 ngrok 转发运行中
3. 浏览器打开 `http://localhost:3000`
4. 点击「立即购买」→ 跳转 Creem 收银台
5. 使用测试卡号完成支付
6. 自动跳转回 success 页面，展示订单信息
7. 检查 `backend/data/orders.json` 是否写入订单

### Creem 测试卡号

| 卡号 | 场景 |
|------|------|
| `4242 4242 4242 4242` | 支付成功（通用测试卡）|
| `4000 0000 0000 0002` | 支付被拒 |

> 具体测试卡号请参考 Creem Dashboard 的测试文档。

---

## Render 部署

### 一键部署

1. 将项目推送到 GitHub
2. 登录 [Render Dashboard](https://dashboard.render.com)
3. 点击 **New** → **Blueprint**
4. 连接 GitHub 仓库
5. Render 自动读取 `render.yaml` 创建服务

### 手动部署

| 配置项 | 值 |
|--------|-----|
| Environment | Node |
| Build Command | `cd backend && npm install` |
| Start Command | `cd backend && node server.js` |

### 环境变量（Render Dashboard → Environment）

| Key | Value |
|-----|-------|
| `CREEM_API_KEY` | Creem API Key（生产环境用 live key）|
| `CREEM_WEBHOOK_SECRET` | Creem Webhook Signing Secret |
| `CREEM_PRODUCT_ID` | Creem 产品 ID |
| `CREEM_TEST_MODE` | `true`（测试）/ `false`（生产）|
| `CLIENT_URL` | Render 域名（如 `https://paymvp.onrender.com`）|

---

## 常见问题

### Q: 点击支付按钮报错「支付初始化失败」

- 确认后端正在运行
- 确认 `.env` 中 `CREEM_API_KEY`、`CREEM_PRODUCT_ID` 正确
- 查看终端日志

### Q: 支付成功后订单未写入 orders.json

- 确认 Webhook URL 可被 Creem 访问（本地需 ngrok）
- 检查 `CREEM_WEBHOOK_SECRET` 配置
- 查看终端是否有「Webhook 签名验证失败」

### Q: success 页订单信息不显示

- URL 必须带 `?order_id=xxx` 参数
- 打开浏览器控制台查看错误

### Q: Render 部署后页面 404

- 确认 Build/Start Command 路径正确
- 确认 Render 上环境变量配置完整

### Q: 如何修改价格？

在 Creem Dashboard → Products 修改产品价格，或在 `backend/routes/payment.js` 中使用 Creem API 创建动态价格。

### Q: CORS 错误

- 本地开发时 CORS 允许所有来源
- 生产环境确保 `CLIENT_URL` 环境变量正确

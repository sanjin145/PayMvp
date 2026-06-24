# PayMvp 部署与调试指南

## 目录
1. [本地开发](#本地开发)
2. [Stripe 配置](#stripe-配置)
3. [Webhook 本地调试](#webhook-本地调试)
4. [Render 部署](#render-部署)
5. [常见问题](#常见问题)

---

## 本地开发

### 1. 克隆项目 & 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

将 `backend/.env.example` 复制为 `backend/.env`：

```bash
cp backend/.env.example backend/.env
```

编辑 `.env` 填入你的 Stripe 测试密钥。

### 3. 启动服务

```bash
cd backend
npm start
# 或开发模式（文件变更自动重启，Node 18+）
npm run dev
```

访问 `http://localhost:3000` 查看落地页。

---

## Stripe 配置

### 获取 API 密钥

1. 注册 [Stripe](https://dashboard.stripe.com/register) 账号
2. 进入 [API Keys](https://dashboard.stripe.com/apikeys) 页面
3. 复制 **Secret key**（以 `sk_test_` 开头的是测试密钥）
4. 填入 `.env` 的 `STRIPE_SECRET_KEY`

### 创建 Product 和 Price（可选）

当前代码使用内联价格（$99 USD），无需手动创建 Price。
如需自定义价格，在 Stripe Dashboard 创建 Product → 获取 Price ID → 修改 `backend/routes/payment.js` 中的 `line_items`。

### 测试卡号

| 卡号 | 场景 |
|------|------|
| `4242 4242 4242 4242` | 支付成功 |
| `4000 0000 0000 3220` | 需要 3D Secure 验证 |
| `4000 0000 0000 9995` | 余额不足 |

> 有效期填未来日期，CVC 填任意 3 位数字。

---

## Webhook 本地调试

Webhook 是 Stripe 服务器主动 POST 到你后端的回调。本地开发时 Stripe 无法直接访问 `localhost`，需要用 **Stripe CLI** 转发。

### 安装 Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows:**
```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

或从 [stripe.com/stripe-cli](https://stripe.com/stripe-cli) 下载安装包。

### 登录 & 转发

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook
```

终端会输出一个 `whsec_xxx` 密钥，复制到 `.env` 的 `STRIPE_WEBHOOK_SECRET`。

> **注意：** 每次运行 `stripe listen` 都会生成新的 webhook secret，需要同步更新 `.env`。

### 测试完整支付流程

1. 确保后端运行中（`npm start`）
2. 确保 Stripe CLI webhook 转发运行中
3. 浏览器打开 `http://localhost:3000`
4. 点击「立即购买」→ 跳转 Stripe 收银台
5. 填入测试卡号 `4242 4242 4242 4242` → 完成支付
6. 自动跳回转 success 页面，展示订单信息
7. 检查 `backend/data/orders.json` 是否写入订单

---

## Render 部署

[Render](https://render.com) 是本项目的推荐部署平台（免费套餐支持 Web Service）。

### 一键部署

1. 将项目推送到 GitHub
2. 登录 [Render Dashboard](https://dashboard.render.com)
3. 点击 **New** → **Blueprint**
4. 连接你的 GitHub 仓库
5. Render 会自动读取 `render.yaml` 并创建服务

### 手动部署

如果不用 Blueprint，手动创建 Web Service：

| 配置项 | 值 |
|--------|-----|
| Environment | Node |
| Build Command | `cd backend && npm install` |
| Start Command | `cd backend && node server.js` |
| Plan | Free |

### 环境变量配置

在 Render Dashboard → 你的服务 → Environment 中添加：

| Key | Value |
|-----|-------|
| `STRIPE_SECRET_KEY` | Stripe Secret Key（生产环境用 `sk_live_xxx`）|
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret |
| `CLIENT_URL` | 你的 Render 域名（如 `https://paymvp.onrender.com`）|

### 生产环境 Webhook

部署到 Render 后，在 Stripe Dashboard 配置真实的 Webhook endpoint：

1. 进入 [Webhooks](https://dashboard.stripe.com/webhooks)
2. 点击 **Add endpoint**
3. Endpoint URL: `https://你的域名.onrender.com/api/webhook`
4. Events to send: 选择 `checkout.session.completed`
5. 创建后复制 **Signing secret** → 填入 Render 的 `STRIPE_WEBHOOK_SECRET` 环境变量

---

## 常见问题

### Q: 点击支付按钮报错「支付初始化失败」

- 确认后端正在运行
- 确认 `.env` 中 `STRIPE_SECRET_KEY` 正确
- 查看终端日志

### Q: 支付成功后订单未写入 orders.json

- 确认 Webhook 配置正确
- 本地开发必须运行 `stripe listen`
- 检查 `.env` 中 `STRIPE_WEBHOOK_SECRET` 与 `stripe listen` 输出一致
- 查看终端是否有「Webhook 签名验证失败」日志

### Q: success 页订单信息不显示

- URL 必须带 `?session_id=cs_xxx` 参数（Stripe 自动携带）
- 如果 Webhook 还没来得及写入，查询接口会从 Stripe 实时拉取
- 打开浏览器控制台查看错误

### Q: Render 部署后页面 404

- 确认 Build Command 和 Start Command 路径正确
- 确认 Render 上 `PORT` 环境变量设置为 `3000`

### Q: 如何修改价格？

编辑 `backend/routes/payment.js` 中的 `unit_amount`（单位：美分）：
```js
unit_amount: 9900, // $99.00
```

### Q: CORS 错误

- 本地开发时 CORS 允许所有来源
- 生产环境确保 `CLIENT_URL` 环境变量设置为 Render 域名

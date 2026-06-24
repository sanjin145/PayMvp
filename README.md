# PayMvp · 极简收费独立站 MVP

> 极简付费闭环：落地页 → Creem 收银台 → Webhook 记录订单 → 成功页

## 目录结构

```
PayMvp/
├── frontend/                  # 纯静态前端
│   ├── index.html             # 落地页（标题·简介·定价·支付按钮）
│   └── success.html           # 支付成功页（展示订单详情）
├── backend/                   # Node.js Express 后端
│   ├── package.json
│   ├── server.js              # Express 入口
│   ├── routes/
│   │   └── payment.js         # 3 个 API 接口（Creem 支付）
│   ├── data/
│   │   └── orders.json        # 本地订单存储（自动创建）
│   └── .env.example           # 环境变量模板
├── .gitignore
├── render.yaml                # Render 一键部署
├── DEPLOY.md                  # 详细部署调试文档
└── README.md
```

## 快速开始

```bash
# 1. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 Creem API Key、Webhook Secret、Product ID

# 2. 安装依赖
cd backend && npm install

# 3. 启动
npm start
# 访问 http://localhost:3000
```

## 支付闭环

```
用户访问 / → 点击「立即购买」
→ POST /api/create-checkout-session → 创建 Creem Checkout
→ 浏览器重定向至 Creem 收银台
→ 完成支付
   ├─ Creem Webhook → POST /api/webhook → 写入 backend/data/orders.json
   └─ 浏览器 → /success.html?order_id=xxx → GET /api/orders/:id → 展示订单
```

## API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/create-checkout-session` | POST | 创建 Creem Checkout 会话，返回支付链接 |
| `/api/webhook` | POST | Creem Webhook 回调，HMAC-SHA256 签名验证并记录订单 |
| `/api/orders/:orderId` | GET | 按 order ID 查询订单 |

## 支付网关

使用 [Creem](https://creem.io) 作为 Merchant of Record，无需 Stripe。

- 测试环境：`https://test-api.creem.io`
- 生产环境：`https://api.creem.io`

## 部署

参考 [DEPLOY.md](DEPLOY.md) — 支持 Render 一键部署。

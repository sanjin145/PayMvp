require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS ────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST'],
}));

// ── Webhook 需要 raw body ───────────────────────────
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// ── 普通 JSON body 解析 ─────────────────────────────
app.use(express.json());

// ── 静态文件（托管前端页面）────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── API 路由 ────────────────────────────────────────
app.use('/api', paymentRoutes);

// ── 启动 ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[PayMvp] Server running at http://localhost:${PORT}`);
});

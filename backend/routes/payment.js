const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Creem API 配置 ───────────────────────────────────
const CREEM_BASE = process.env.CREEM_TEST_MODE === 'true'
  ? 'https://test-api.creem.io'
  : 'https://api.creem.io';

const CREEM_API_KEY = process.env.CREEM_API_KEY;
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET;
const CREEM_PRODUCT_ID = process.env.CREEM_PRODUCT_ID;
const CLIENT_URL = process.env.CLIENT_URL || 'https://paymvp.onrender.com';

// ── orders.json 路径 ─────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// ── 工具：读取订单 ───────────────────────────────────
function readOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ORDERS_FILE, JSON.stringify({ orders: [] }, null, 2));
      return [];
    }
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return data.orders || [];
  } catch (err) {
    console.error('[PayMvp] 读取 orders.json 失败:', err.message);
    return [];
  }
}

// ── 工具：写入/更新订单 ──────────────────────────────
function upsertOrder(order) {
  const orders = readOrders();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = order;
  } else {
    orders.push(order);
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify({ orders }, null, 2));
  console.log('[PayMvp] 订单已保存:', order.id);
}

// ── 1. 创建 Creem Checkout ─────────────────────────
// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const body = {
      product_id: CREEM_PRODUCT_ID,
      success_url: `${CLIENT_URL}/success.html?order_id={ORDER_ID}`,
      cancel_url: `${CLIENT_URL}/index.html`,
    };

    const response = await fetch(`${CREEM_BASE}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'x-api-key': CREEM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[PayMvp] Creem 创建 Checkout 失败:', data);
      return res.status(500).json({ error: data.message || '创建支付会话失败' });
    }

    res.json({ url: data.checkout_url });
  } catch (err) {
    console.error('[PayMvp] 创建 Checkout 失败:', err.message);
    res.status(500).json({ error: '创建支付会话失败' });
  }
});

// ── 2. Creem Webhook 回调 ──────────────────────────
// POST /api/webhook
router.post('/webhook', async (req, res) => {
  const sig = req.headers['creem-signature'];
  const rawBody = req.body; // express.raw() 返回 Buffer

  // 验证签名：HMAC-SHA256
  const computed = crypto
    .createHmac('sha256', CREEM_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (computed !== sig) {
    console.error('[PayMvp] Webhook 签名验证失败');
    return res.status(401).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch (err) {
    return res.status(400).send('Invalid JSON');
  }

  console.log('[PayMvp] Webhook 事件:', event.eventType);

  // 处理支付完成事件
  if (event.eventType === 'checkout.completed') {
    const obj = event.object;
    const orderData = obj.order || {};

    const order = {
      id: obj.id,
      orderId: orderData.id || '',
      amount: orderData.amount || 0,
      currency: orderData.currency || 'usd',
      customerEmail: obj.customer?.email || '',
      customerName: obj.customer?.name || '',
      paymentStatus: orderData.status || 'paid',
      productName: obj.product?.name || '',
      status: 'completed',
      createdAt: new Date(event.created_at || Date.now()).toISOString(),
    };

    upsertOrder(order);
    console.log('[PayMvp] 支付成功:', obj.id, order.customerEmail);
  }

  res.json({ received: true });
});

// ── 3. 订单查询 ──────────────────────────────────────
// GET /api/orders/:orderId
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 从本地文件查（支持 checkout_id 和 order_id 两种查询）
    const orders = readOrders();
    const order = orders.find(
      (o) => o.id === orderId || o.orderId === orderId
    );

    if (order) {
      return res.json(order);
    }

    res.status(404).json({ error: '订单未找到' });
  } catch (err) {
    console.error('[PayMvp] 查询订单失败:', err.message);
    res.status(500).json({ error: '查询订单失败' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ── Stripe 初始化 ────────────────────────────────────
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

// ── 工具：写入订单 ───────────────────────────────────
function saveOrder(order) {
  const orders = readOrders();
  orders.push(order);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify({ orders }, null, 2));
  console.log('[PayMvp] 订单已保存:', order.id);
}

// ── 1. 创建 Checkout Session ─────────────────────────
// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Pro 会员',
              description: '终身授权 · 无限更新 · 优先客服支持',
            },
            unit_amount: 9900, // $99.00
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/index.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[PayMvp] 创建 Checkout Session 失败:', err.message);
    res.status(500).json({ error: '创建支付会话失败' });
  }
});

// ── 2. Webhook 回调 ──────────────────────────────────
// POST /api/webhook
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[PayMvp] Webhook 签名验证失败:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 处理支付成功事件
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const order = {
      id: session.id,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email || '',
      customerName: session.customer_details?.name || '',
      paymentStatus: session.payment_status,
      status: 'completed',
      createdAt: new Date(session.created * 1000).toISOString(),
    };

    saveOrder(order);
    console.log('[PayMvp] 支付成功:', session.id);
  }

  res.json({ received: true });
});

// ── 3. 订单查询 ──────────────────────────────────────
// GET /api/orders/:sessionId
router.get('/orders/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 先从本地文件查
    const orders = readOrders();
    const localOrder = orders.find((o) => o.id === sessionId);
    if (localOrder) {
      return res.json(localOrder);
    }

    // 本地没有，从 Stripe 实时拉取
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ error: '订单未找到' });
    }

    const order = {
      id: session.id,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email || '',
      customerName: session.customer_details?.name || '',
      paymentStatus: session.payment_status,
      status: session.payment_status === 'paid' ? 'completed' : session.payment_status,
      createdAt: new Date(session.created * 1000).toISOString(),
    };

    res.json(order);
  } catch (err) {
    console.error('[PayMvp] 查询订单失败:', err.message);
    res.status(500).json({ error: '查询订单失败' });
  }
});

module.exports = router;

/**
 * 格格的宫殿 - 后端服务器
 * 支持码支付/BufPay等第三方支付平台真实API对接
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CORS配置 - 必须放在最前面 ============
// 处理所有CORS请求
app.use((req, res, next) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
  res.setHeader('Access-Control-Max-Age', '86400'); // 预检请求缓存时间
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    console.log('[CORS] OPTIONS预检请求:', req.url);
    res.status(200).end();
    return;
  }
  
  next();
});

// 使用cors中间件作为备用
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  credentials: false
}));

// 确保正确处理JSON请求
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 添加请求日志中间件（调试用）
app.use('/api/', (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.body) {
    console.log('请求体:', JSON.stringify(req.body).substring(0, 200));
  }
  next();
});

// ============ 用户系统 ============
const USERS_FILE = path.join(__dirname, 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveSessions(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

let users = loadUsers();
let sessions = loadSessions();

// 生成会话令牌
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 验证会话
function verifySession(token) {
  if (!token) return null;
  const session = sessions[token];
  if (!session) return null;
  const user = users[session.username];
  if (!user) return null;
  return user;
}

// ============ 配置管理 ============
const CONFIG_FILE = path.join(__dirname, 'payment_config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    paymentMethod: 'qrcode',
    apiKey: '',
    apiSecret: '',
    qrCodeImage: '',
    callbackUrl: '',
    autoVerify: false,
    notifyUrl: '',
    mpayEndpoint: 'https://api.mpays.cn'
  };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let config = loadConfig();

// ============ HTTP 请求工具 ============
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const method = options.method || 'GET';
    const headers = { ...options.headers };
    const body = options.body ? JSON.stringify(options.body) : null;
    
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    const port = urlObj.protocol === 'https:' ? 443 : (urlObj.port || 80);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: urlObj.hostname,
      port: port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers,
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    if (body) req.write(body);
    req.end();
  });
}

// ============ 订单管理 ============
const orders = new Map();
const ORDER_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(ORDER_FILE)) {
      const data = JSON.parse(fs.readFileSync(ORDER_FILE, 'utf8'));
      data.forEach(o => orders.set(o.orderNo, o));
    }
  } catch (e) {}
}

function saveOrders() {
  const data = Array.from(orders.values());
  fs.writeFileSync(ORDER_FILE, JSON.stringify(data, null, 2));
}

loadOrders();

function generateOrderNo() {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(4).toString('hex');
  return 'GEGE' + timestamp + random.toUpperCase();
}

function createOrder(amount, description) {
  const orderNo = generateOrderNo();
  const order = {
    orderNo,
    amount: parseFloat(amount),
    description: description || '奴才奉献',
    status: 'pending',
    createdAt: new Date().toISOString(),
    paidAt: null,
    expiredAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    paymentMethod: config.paymentMethod,
    notifyData: null,
    apiOrderNo: null
  };
  orders.set(orderNo, order);
  saveOrders();
  return order;
}

// 过期订单检查
setInterval(() => {
  const now = Date.now();
  let changed = false;
  orders.forEach(order => {
    if (order.status === 'pending' && new Date(order.expiredAt).getTime() < now) {
      order.status = 'expired';
      changed = true;
    }
  });
  if (changed) saveOrders();
}, 60 * 1000);

// ============ 码支付 API 对接 ============

/**
 * 码支付 API - 创建支付订单
 * 对接码支付/BufPay等聚合支付平台
 */
async function createMPayOrder(order) {
  try {
    const endpoint = config.mpayEndpoint || 'https://api.mpays.cn';
    const apiKey = config.apiKey;
    const apiSecret = config.apiSecret;
    
    if (!apiKey) {
      console.log('API Key未设置，使用本地模式');
      return null;
    }
    
    // 构造回调URL
    const notifyUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;
    
    // 码支付API参数（根据不同平台调整）
    const params = {
      order_no: order.orderNo,
      amount: Math.round(order.amount * 100), // 分
      subject: order.description,
      notify_url: notifyUrl,
      pay_type: 'wx', // 默认微信支付，可改为 auto 让用户选择
      device: 'pc'
    };
    
    // 生成签名
    const signStr = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&') + `&key=${apiSecret}`;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    params.api_key = apiKey;
    
    console.log('调用码支付API，参数:', { ...params, sign: '***' });
    
    // 真实调用码支付API
    const response = await httpRequest(`${endpoint}/api/order/create`, {
      method: 'POST',
      body: params
    });
    
    console.log('码支付API响应:', typeof response === 'object' ? JSON.stringify(response).substring(0, 200) : response);
    
    // 处理响应
    if (response && (response.code === 0 || response.code === 1 || response.status === 1)) {
      const data = response.data || response;
      return {
        qrCode: data.qr_code || data.qrCode || data.code_url || data.pay_qrcode || data.payCode,
        orderNo: data.order_no || data.orderNo || data.mch_order_no,
        rawData: data
      };
    } else {
      console.error('码支付API返回错误:', response.msg || response.message || response);
      return null;
    }
  } catch (error) {
    console.error('调用码支付API失败:', error.message);
    return null;
  }
}

/**
 * 码支付 API - 查询订单状态
 * 用于轮询机制，在回调失败时兜底验证
 */
async function queryMPayOrder(orderNo) {
  try {
    const endpoint = config.mpayEndpoint || 'https://api.mpays.cn';
    const apiKey = config.apiKey;
    const apiSecret = config.apiSecret;
    
    if (!apiKey) return null;
    
    const params = {
      order_no: orderNo
    };
    
    const signStr = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&') + `&key=${apiSecret}`;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    params.api_key = apiKey;
    
    const response = await httpRequest(`${endpoint}/api/order/query`, {
      method: 'POST',
      body: params
    });
    
    if (response && response.code === 0) {
      return response.data || response;
    }
    return null;
  } catch (error) {
    console.error('查询订单失败:', error.message);
    return null;
  }
}

/**
 * 主动查询第三方订单状态（兜底机制）
 * 如果回调没有触发，可以通过轮询来验证
 */
async function pollAndVerifyOrder(orderNo) {
  const order = orders.get(orderNo);
  if (!order || order.status !== 'pending') return;
  
  // 每5秒查询一次，最多查询6次（30秒）
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const currentOrder = orders.get(orderNo);
    if (!currentOrder || currentOrder.status !== 'pending') return;
    
    const apiOrderNo = currentOrder.apiOrderNo || currentOrder.orderNo;
    const result = await queryMPayOrder(apiOrderNo);
    
    if (result && (result.status === 1 || result.status === 'paid' || result.pay_status === 1)) {
      currentOrder.status = 'paid';
      currentOrder.paidAt = new Date().toISOString();
      currentOrder.notifyData = result;
      orders.set(orderNo, currentOrder);
      saveOrders();
      console.log('轮询发现支付成功:', orderNo);
      return;
    }
  }
}

// ============ API 路由 ============

// 获取当前配置（隐藏敏感信息）
app.get('/api/config', (req, res) => {
  res.json({
    paymentMethod: config.paymentMethod,
    apiKey: config.apiKey ? '***已设置***' : '',
    apiSecret: config.apiSecret ? '***已设置***' : '',
    qrCodeImage: config.qrCodeImage || '',
    hasQRCode: !!config.qrCodeImage,
    autoVerify: config.autoVerify,
    notifyUrl: config.notifyUrl,
    mpayEndpoint: config.mpayEndpoint || 'https://api.mpays.cn'
  });
});

// 更新配置
app.post('/api/config', (req, res) => {
  const updates = req.body;
  
  const allowedFields = ['paymentMethod', 'apiKey', 'apiSecret', 'qrCodeImage', 'autoVerify', 'notifyUrl', 'mpayEndpoint'];
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      config[field] = updates[field];
    }
  });
  
  saveConfig(config);
  res.json({ success: true, message: '配置已更新' });
});

// 创建支付订单
app.post('/api/order/create', async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: '金额无效' });
    }
    
    if (amount < 1) {
      return res.status(400).json({ success: false, message: '最低金额1元' });
    }
    
    const order = createOrder(amount, description);
    
    const response = {
      success: true,
      orderNo: order.orderNo,
      amount: order.amount,
      description: order.description,
      expiresAt: order.expiredAt,
      paymentMethod: config.paymentMethod
    };
    
    // 根据支付模式返回不同内容
    if (config.paymentMethod === 'api' && config.apiKey) {
      // API模式：调用第三方支付
      const apiOrder = await createMPayOrder(order);
      
      if (apiOrder) {
        order.apiOrderNo = apiOrder.orderNo;
        orders.set(order.orderNo, order);
        saveOrders();
        
        response.qrCode = apiOrder.qrCode;
        response.apiOrderNo = apiOrder.orderNo;
        response.isAutoVerify = config.autoVerify;
        
        // 如果开启自动验证，启动轮询兜底
        if (config.autoVerify && apiOrder.orderNo) {
          pollAndVerifyOrder(order.orderNo);
        }
      } else {
        // API调用失败，降级为手动模式
        response.qrCode = config.qrCodeImage;
        response.isAutoVerify = false;
        response.fallbackToManual = true;
        console.log('API调用失败，降级为手动验证模式');
      }
    } else if (config.qrCodeImage) {
      // 收款码模式
      response.qrCode = config.qrCodeImage;
    }
    
    res.json(response);
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ success: false, message: '创建订单失败' });
  }
});

// 查询订单状态
app.get('/api/order/:orderNo', (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  res.json({
    success: true,
    orderNo: order.orderNo,
    amount: order.amount,
    status: order.status,
    description: order.description,
    paidAt: order.paidAt,
    createdAt: order.createdAt
  });
});

// 确认订单已支付
app.post('/api/order/:orderNo/confirm', (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  if (order.status === 'paid') {
    return res.json({ success: true, status: 'paid', message: '订单已支付' });
  }
  
  if (order.status !== 'pending') {
    return res.status(400).json({ success: false, message: '订单状态异常: ' + order.status });
  }
  
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  orders.set(orderNo, order);
  saveOrders();
  
  res.json({ success: true, status: 'paid', message: '支付确认成功' });
});

// 取消订单
app.post('/api/order/:orderNo/cancel', (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  if (order.status === 'pending') {
    order.status = 'cancelled';
    orders.set(orderNo, order);
    saveOrders();
  }
  
  res.json({ success: true });
});

// ============ 支付回调接口 ============

/**
 * 码支付回调通知接口
 * 接收码支付平台的支付结果通知
 */
app.post('/api/payment/notify', async (req, res) => {
  try {
    console.log('收到支付回调通知:', JSON.stringify(req.body).substring(0, 200));
    
    const body = req.body;
    
    // 支持多种订单号字段格式
    const actualOrderNo = body.order_no || body.orderNo || body.mch_order_no || body.mchOrderNo;
    if (!actualOrderNo) {
      console.error('回调缺少订单号');
      return res.json({ code: 0, msg: '缺少订单号' });
    }
    
    // 查找订单（可能是本地订单号或第三方订单号）
    let order = orders.get(actualOrderNo);
    
    // 如果是第三方订单号，查找对应的本地订单
    if (!order) {
      for (const [, o] of orders) {
        if (o.apiOrderNo === actualOrderNo) {
          order = o;
          break;
        }
      }
    }
    
    if (!order) {
      console.error('回调订单不存在:', actualOrderNo);
      return res.json({ code: 0, msg: '订单不存在' });
    }
    
    // 验证签名
    if (body.sign && config.apiSecret) {
      const signParams = {};
      Object.keys(body).forEach(key => {
        if (key !== 'sign') signParams[key] = body[key];
      });
      
      const signStr = Object.keys(signParams)
        .sort()
        .map(k => `${k}=${signParams[k]}`)
        .join('&') + `&key=${config.apiSecret}`;
      const expectedSign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
      
      if (body.sign !== expectedSign) {
        console.error('签名验证失败:', actualOrderNo);
        return res.json({ code: 0, msg: '签名验证失败' });
      }
      console.log('签名验证通过');
    }
    
    // 验证金额
    const payAmount = parseFloat(body.amount || body.pay_amount || body.total_fee);
    if (payAmount) {
      const amountInYuan = payAmount > 100 ? payAmount / 100 : payAmount;
      if (Math.abs(amountInYuan - order.amount) > 0.01) {
        console.error('金额不匹配: 回调=' + amountInYuan + ', 订单=' + order.amount);
        return res.json({ code: 0, msg: '金额不匹配' });
      }
    }
    
    // 判断支付状态
    const payStatus = body.status || body.pay_status || body.trade_state;
    const isPaid = ['paid', 'success', 'SUCCESS', '1', 1, 'completed', 'finish'].includes(payStatus);
    
    if (isPaid) {
      // 更新订单状态
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      order.notifyData = body;
      orders.set(order.orderNo, order);
      saveOrders();
      
      console.log('✅ 支付成功:', order.orderNo, '金额:', order.amount, '元');
      return res.json({ code: 1, msg: 'success' });
    } else {
      console.log('回调状态未成功:', payStatus);
      return res.json({ code: 0, msg: '状态未成功' });
    }
  } catch (error) {
    console.error('回调处理异常:', error);
    res.json({ code: 0, msg: '处理异常' });
  }
});

/**
 * 手动轮询验证接口（用于兜底查询）
 */
app.post('/api/order/:orderNo/poll', async (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  if (order.status === 'paid') {
    return res.json({ success: true, status: 'paid' });
  }
  
  if (config.paymentMethod === 'api' && config.apiKey && order.apiOrderNo) {
    const result = await queryMPayOrder(order.apiOrderNo);
    if (result && (result.status === 1 || result.status === 'paid' || result.pay_status === 1)) {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      orders.set(orderNo, order);
      saveOrders();
      return res.json({ success: true, status: 'paid', data: result });
    }
    return res.json({ success: true, status: order.status, queryResult: result });
  }
  
  res.json({ success: true, status: order.status });
});

// ============ 用户系统 API ============

// 用户注册
app.post('/api/user/register', (req, res) => {
  try {
    const { username, password, servantName } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ success: false, message: '用户名长度需在2-20之间' });
    }
    
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: '密码至少4位' });
    }
    
    if (users[username]) {
      return res.status(400).json({ success: false, message: '此名字已被其他奴才占用' });
    }
    
    // 卑微奴才名字列表
    const servantNames = ['小狗', '奴才', '贱婢', '奴婢', '小厮', '奴仆', '下贱胚', '狗奴才', '可怜虫', '哈巴狗'];
    const finalServantName = servantName || servantNames[Math.floor(Math.random() * servantNames.length)];
    
    // 加密密码
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    const newUser = {
      username: username,
      password: hashedPassword,
      servantName: finalServantName,
      gold: 0,
      totalTributed: 0,
      kneelCount: 0,
      tributes: [],
      createdAt: new Date().toISOString()
    };
    
    users[username] = newUser;
    saveUsers(users);
    
    // 自动登录
    const token = generateToken();
    sessions[token] = { username: username, createdAt: new Date().toISOString() };
    saveSessions(sessions);
    
    res.json({ 
      success: true, 
      message: '奴才注册成功！',
      token: token,
      user: {
        username: username,
        servantName: finalServantName,
        gold: 0,
        totalTributed: 0,
        kneelCount: 0
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ success: false, message: '注册失败' });
  }
});

// 用户登录
app.post('/api/user/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    const user = users[username];
    if (!user) {
      return res.status(400).json({ success: false, message: '此奴才不存在，请先注册' });
    }
    
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedPassword !== user.password) {
      return res.status(400).json({ success: false, message: '密码错误！奴才无礼！' });
    }
    
    const token = generateToken();
    sessions[token] = { username: username, createdAt: new Date().toISOString() };
    saveSessions(sessions);
    
    res.json({ 
      success: true, 
      message: '奴才觐见成功！',
      token: token,
      user: {
        username: user.username,
        servantName: user.servantName,
        gold: user.gold,
        totalTributed: user.totalTributed,
        kneelCount: user.kneelCount
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 获取当前用户信息
app.get('/api/user/info', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    const user = verifySession(token);
    
    if (!user) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    
    res.json({ 
      success: true, 
      user: {
        username: user.username,
        servantName: user.servantName,
        gold: user.gold,
        totalTributed: user.totalTributed,
        kneelCount: user.kneelCount,
        tributes: user.tributes || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

// 更新用户金币
app.post('/api/user/gold', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    const user = verifySession(token);
    
    if (!user) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    
    const { gold, reason } = req.body;
    if (typeof gold !== 'number') {
      return res.status(400).json({ success: false, message: '金币数值无效' });
    }
    
    user.gold = Math.max(0, (user.gold || 0) + gold);
    users[user.username] = user;
    saveUsers(users);
    
    res.json({ 
      success: true, 
      gold: user.gold,
      message: reason || '金币已更新'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新金币失败' });
  }
});

// 叩拜次数+1
app.post('/api/user/kneel', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    const user = verifySession(token);
    
    if (!user) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    
    user.kneelCount = (user.kneelCount || 0) + 1;
    users[user.username] = user;
    saveUsers(users);
    
    res.json({ 
      success: true, 
      kneelCount: user.kneelCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '记录失败' });
  }
});

// 上贡/奉献
app.post('/api/user/tribute', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    const user = verifySession(token);
    
    if (!user) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    
    const { type, cost, name } = req.body;
    if (user.gold < cost) {
      return res.status(400).json({ success: false, message: '金币不足！' });
    }
    
    user.gold -= cost;
    user.totalTributed = (user.totalTributed || 0) + cost;
    user.tributes = user.tributes || [];
    user.tributes.push({
      type: type,
      name: name,
      cost: cost,
      timestamp: new Date().toISOString()
    });
    
    // 只保留最近50条
    if (user.tributes.length > 50) {
      user.tributes = user.tributes.slice(-50);
    }
    
    users[user.username] = user;
    saveUsers(users);
    
    res.json({ 
      success: true, 
      gold: user.gold,
      totalTributed: user.totalTributed,
      message: '奉献成功！奴才叩谢格格恩典！'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '奉献失败' });
  }
});

// 获取排行榜
app.get('/api/user/rank', (req, res) => {
  try {
    const rankList = Object.values(users)
      .sort((a, b) => (b.totalTributed || 0) - (a.totalTributed || 0))
      .slice(0, 50)
      .map(user => ({
        username: user.username,
        servantName: user.servantName,
        totalTributed: user.totalTributed || 0
      }));
    
    res.json({ success: true, rankList });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取排行榜失败' });
  }
});

// 退出登录
app.post('/api/user/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    if (token && sessions[token]) {
      delete sessions[token];
      saveSessions(sessions);
    }
    res.json({ success: true, message: '奴才已退出' });
  } catch (error) {
    res.status(500).json({ success: false, message: '退出失败' });
  }
});

// ============ 辅助接口 ============

// 获取订单列表
app.get('/api/orders', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const ordersList = Array.from(orders.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(offset, offset + limit);
  res.json({ success: true, data: ordersList });
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
  let totalPaid = 0;
  let totalOrders = 0;
  let pendingOrders = 0;
  
  orders.forEach(order => {
    totalOrders++;
    if (order.status === 'paid') {
      totalPaid += order.amount;
    }
    if (order.status === 'pending') {
      pendingOrders++;
    }
  });
  
  res.json({
    success: true,
    totalPaid: totalPaid.toFixed(2),
    totalOrders,
    pendingOrders
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '格格的宫殿服务器运行中',
    version: '3.0.0',
    config: config.paymentMethod,
    hasApiKey: !!config.apiKey,
    autoVerify: config.autoVerify
  });
});

// ============ 静态文件服务（放在所有API路由之后）============
app.use(express.static(__dirname, { 
  maxAge: '1h',
  setHeaders: function(res, filePath) {
    if (filePath.match(/\.(mp3|mp4|wav|ogg|m4a|flac)$/)) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    // 不缓存HTML和JS/CSS文件（确保用户获取最新版本）
    if (filePath.match(/\.(html|js|css)$/)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误: ' + (err.message || '未知错误')
  });
});

// 404处理 - 对API路由返回JSON错误
app.use('/api/', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API接口不存在: ' + req.method + ' ' + req.url
  });
});

// 启动服务器
app.listen(PORT, () => {
  const localIp = getLocalIP();
  const callbackUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;
  
  console.log(`
╔══════════════════════════════════════════════╗
║          格格的宫殿 · 服务器已启动             ║
╠══════════════════════════════════════════════╣
║  访问地址（本机）: http://localhost:${PORT}        ║
║  访问地址（局域网）: http://${localIp}:${PORT}        ║
║                                              ║
║  支付模式: ${config.paymentMethod === 'api' ? '🔗 API自动验证' : '📱 收款码模式'}        ║
║  回调地址: ${callbackUrl}
║                                              ║
║  接口列表:                                   ║
║    GET  /api/health      - 健康检查          ║
║    GET  /api/config      - 获取配置          ║
║    POST /api/config      - 更新配置          ║
║    POST /api/order/create - 创建订单          ║
║    GET  /api/order/:no   - 查询订单          ║
║    POST /api/order/:no/confirm - 确认支付    ║
║    POST /api/payment/notify - 支付回调       ║
╚══════════════════════════════════════════════╝
  `);
  
  if (config.paymentMethod === 'api') {
    console.log('💡 API模式已启用');
    console.log('   请在码支付后台配置回调地址（如使用本地需内网穿透）');
    if (!config.apiKey) {
      console.log('   ⚠️  API Key未设置，请在格格设置页面填写');
    }
  }
});

// 获取本机IP
function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

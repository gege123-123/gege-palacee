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
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      // 环境变量覆盖（云部署时使用）
      if (process.env.MPAY_API_KEY) config.apiKey = process.env.MPAY_API_KEY;
      if (process.env.MPAY_API_SECRET) config.apiSecret = process.env.MPAY_API_SECRET;
      if (process.env.MPAY_ENDPOINT) config.mpayEndpoint = process.env.MPAY_ENDPOINT;
      if (process.env.MPAY_TYPE) config.mpayType = process.env.MPAY_TYPE;
      if (process.env.PUBLIC_URL) config.notifyUrl = process.env.PUBLIC_URL + '/api/payment/notify';
      return config;
    }
  } catch (e) {}
  // 环境变量优先（云部署模式）
  return {
    paymentMethod: process.env.PAYMENT_METHOD || 'api',
    apiKey: process.env.MPAY_API_KEY || '',
    apiSecret: process.env.MPAY_API_SECRET || '',
    qrCodeImage: '',
    callbackUrl: '',
    autoVerify: true,
    notifyUrl: process.env.PUBLIC_URL ? process.env.PUBLIC_URL + '/api/payment/notify' : '',
    mpayEndpoint: process.env.MPAY_ENDPOINT || 'https://mzf.mapay.cc/xpay/epay',
    mpayType: process.env.MPAY_TYPE || 'alipay',
    testMode: false
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
    
    // body如果是字符串则直接使用（form-urlencoded），否则JSON序列化
    let body = null;
    if (options.body) {
      if (typeof options.body === 'string') {
        body = options.body;
      } else {
        body = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
      }
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

function createOrder(amount, description, username, goldAmount) {
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
    apiOrderNo: null,
    username: username || null,
    goldAmount: goldAmount || 0,
    paid: false
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
 * 对接码支付易支付协议(V1)
 * 文档: https://pay.mapay.cn/doc.html
 */
async function createMPayOrder(order) {
  try {
    const endpoint = config.mpayEndpoint || 'https://mzf.mapay.cc/xpay/epay';
    const pid = config.apiKey;       // PID = 12809
    const secret = config.apiSecret;  // SECRET
    
    if (!pid || !secret) {
      console.log('API Key或Secret未设置，使用本地模式');
      return null;
    }
    
    // 构造回调URL
    const notifyUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;
    const returnUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;
    
    // 易支付协议参数
    const params = {
      pid: pid,
      type: config.mpayType || 'wxpay',  // wxpay=微信, alipay=支付宝
      out_trade_no: order.orderNo,
      notify_url: notifyUrl,
      return_url: returnUrl,
      name: order.description || '格格的宫殿-金币充值',
      money: order.amount.toFixed(2)
    };
    
    // 生成MD5签名（易支付V1协议）
    // 规则：排除sign、sign_type、charset，所有参数按参数名字典序排序，
    // 拼接成 key1=val1&key2=val2... 再直接拼接密钥，MD5小写
    const signParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (k !== 'sign' && k !== 'sign_type' && k !== 'charset' && v !== '' && v !== null && v !== undefined) {
        signParams[k] = String(v);
      }
    }
    const signKeys = Object.keys(signParams).sort();
    let signStr = '';
    for (const k of signKeys) {
      signStr += `${k}=${signParams[k]}&`;
    }
    signStr = signStr.replace(/&$/, '');
    const stringSignTemp = signStr + secret;
    const sign = crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex');
    params.sign = sign;
    
    console.log('📱 调用码支付API（易支付V1协议）');
    console.log('  PID:', pid);
    console.log('  金额:', params.money, '元');
    console.log('  订单号:', params.out_trade_no);
    console.log('  支付方式:', params.type);
    console.log('  签名原串:', signStr.substring(0, 50) + '...');
    console.log('  签名:', sign);
    
    // 易支付协议使用POST form-urlencoded
    const queryString = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    
    // 使用mapi.php接口（返回JSON格式，包含payurl/qrcode）
    const mapiUrl = `${endpoint}/mapi.php`;
    
    const response = await httpRequest(mapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(queryString)
      },
      body: queryString
    });
    
    // httpRequest已自动解析JSON，response可能是对象或字符串
    if (!response) {
      console.error('码支付API无响应');
      return null;
    }
    
    let jsonResp;
    if (typeof response === 'object') {
      jsonResp = response;
    } else {
      try {
        jsonResp = JSON.parse(response);
      } catch (e) {
        console.error('JSON解析失败:', e.message);
        console.log('原始响应:', String(response).substring(0, 300));
        return null;
      }
    }
    
    console.log('码支付API响应:', JSON.stringify(jsonResp).substring(0, 300));
    
    if (jsonResp.code === 1) {
      // 成功：返回支付链接/二维码
      const qrcode = jsonResp.qrcode || jsonResp.qrCode || '';
      const payUrl = jsonResp.urlscheme || jsonResp.payurl || '';
      
      // 微信支付(wxpay)不返回qrcode/payurl，需要构造支付页面URL
      const mpayType = config.mpayType || 'alipay';
      let finalQrUrl = qrcode;
      let finalPayUrl = payUrl;
      
      if (!qrcode && !payUrl && jsonResp.trade_no) {
        // 微信支付：使用trade_no构造支付页面URL
        const baseUrl = endpoint.replace('/mapi.php', '');
        finalQrUrl = `${baseUrl}/pay/${jsonResp.trade_no}`;
        finalPayUrl = finalQrUrl;
        console.log('微信支付模式，构造支付页面URL:', finalQrUrl);
      }
      
      // 生成二维码图片URL（使用公共二维码生成服务）
      const qrImageUrl = finalQrUrl 
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(finalQrUrl)}`
        : '';
      
      return {
        qrCode: qrImageUrl,
        qrUrl: finalQrUrl,
        payUrl: finalPayUrl,
        orderNo: jsonResp.trade_no || order.orderNo,
        amount: jsonResp.money || order.amount.toFixed(2),
        rawData: jsonResp
      };
    } else {
      console.error('码支付返回错误:', jsonResp.msg || '未知错误');
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
 * 使用易支付V1协议的mapi.php接口查询
 */
async function queryMPayOrder(orderNo) {
  try {
    const endpoint = config.mpayEndpoint || 'https://mzf.mapay.cc/xpay/epay';
    const pid = config.apiKey;
    const secret = config.apiSecret;
    
    if (!pid || !secret) return null;
    
    // 从本地订单获取金额信息
    const localOrder = orders.get(orderNo);
    const orderAmount = localOrder ? localOrder.amount.toFixed(2) : '0.01';
    const orderDesc = localOrder ? (localOrder.description || '订单查询') : '订单查询';
    
    // 易支付协议 - 查询订单参数（与创建订单相同的签名方式）
    const queryParams = {
      act: 'order',
      pid: pid,
      out_trade_no: orderNo,
      type: config.mpayType || 'alipay',
      name: orderDesc,
      money: orderAmount
    };
    
    // 生成MD5签名（易支付V1协议 - 与创建订单完全一致）
    const signParams = {};
    for (const [k, v] of Object.entries(queryParams)) {
      if (k !== 'sign' && k !== 'sign_type' && k !== 'charset' && v !== '' && v !== null && v !== undefined) {
        signParams[k] = String(v);
      }
    }
    const signKeys = Object.keys(signParams).sort();
    let signStr = '';
    for (const k of signKeys) {
      signStr += `${k}=${signParams[k]}&`;
    }
    signStr = signStr.replace(/&$/, '');
    const stringSignTemp = signStr + secret;
    const sign = crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex');
    
    // 添加签名到查询参数
    queryParams.sign = sign;
    queryParams.sign_type = 'MD5';
    
    // 使用mapi.php接口查询（与创建订单相同的接口）
    const mapiUrl = endpoint.replace(/\/$/, '') + '/mapi.php';
    
    const queryString = Object.keys(queryParams)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');
    
    const result = await httpRequest(mapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(queryString)
      },
      body: queryString
    });
    
    console.log('查询订单响应:', result ? (typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)) : 'null');
    
    if (!result) return null;
    
    // 处理响应
    let jsonResp;
    if (typeof result === 'object') {
      jsonResp = result;
    } else {
      try {
        jsonResp = JSON.parse(result);
      } catch (e) {
        console.log('查询订单JSON解析失败:', result.substring(0, 100));
        return null;
      }
    }
    
    console.log('查询订单JSON:', JSON.stringify(jsonResp).substring(0, 300));
    
    // 码支付返回说明：
    // code=1 表示API请求成功（不是支付成功！）
    // status/pay_status=1 才表示支付成功
    // status/pay_status=0 表示未支付
    
    // 如果API请求失败（code!=1），直接返回
    if (jsonResp.code !== 1 && jsonResp.code !== '1') {
      console.log('查询订单失败，API返回错误:', jsonResp.msg || jsonResp.text);
      return jsonResp;
    }
    
    // API请求成功，返回原始数据（由调用方判断支付状态）
    // 注意：不要在这里设置status=1，让调用方正确判断支付状态
    return jsonResp;
  } catch (error) {
    console.error('查询订单失败:', error.message);
    return null;
  }
}

/**
 * 主动查询第三方订单状态（基础版）
 */
async function pollAndVerifyOrder(orderNo) {
  const order = orders.get(orderNo);
  if (!order || order.status !== 'pending') return;
  
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const currentOrder = orders.get(orderNo);
    if (!currentOrder || currentOrder.status !== 'pending') return;
    
    const apiOrderNo = currentOrder.apiOrderNo || currentOrder.orderNo;
    const result = await queryMPayOrder(apiOrderNo);
    
    if (result && (result.status === 1 || result.status === 'paid' || result.pay_status === 1)) {
      markOrderAsPaid(orderNo, result, '轮询检测');
      return;
    }
  }
}

/**
 * 增强版轮询 - 更长时间、更高频率的支付检测
 * 用于兜底机制，确保支付不会丢失
 */
async function pollAndVerifyOrderEnhanced(orderNo) {
  const order = orders.get(orderNo);
  if (!order || order.status !== 'pending') return;
  
  console.log(`[增强轮询] 开始监控订单: ${orderNo}`);
  
  // 前2分钟：每3秒查一次
  for (let i = 0; i < 40; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const currentOrder = orders.get(orderNo);
    if (!currentOrder || currentOrder.status !== 'pending') {
      console.log(`[增强轮询] 订单状态已变更，停止轮询: ${orderNo}`);
      return;
    }
    
    const apiOrderNo = currentOrder.apiOrderNo || currentOrder.orderNo;
    const result = await queryMPayOrder(apiOrderNo);
    
    if (result && isPaySuccess(result)) {
      markOrderAsPaid(orderNo, result, '增强轮询');
      return;
    }
  }
  
  // 第3-10分钟：每10秒查一次
  for (let i = 0; i < 48; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    const currentOrder = orders.get(orderNo);
    if (!currentOrder || currentOrder.status !== 'pending') return;
    
    const apiOrderNo = currentOrder.apiOrderNo || currentOrder.orderNo;
    const result = await queryMPayOrder(apiOrderNo);
    
    if (result && isPaySuccess(result)) {
      markOrderAsPaid(orderNo, result, '增强轮询(低频)');
      return;
    }
  }
  
  console.log(`[增强轮询] 轮询结束，订单仍未支付: ${orderNo}`);
}

/**
 * 判断支付是否成功
 * 码支付/易支付返回格式：
 *   code=1: API请求成功（不代表支付成功）
 *   status=1 或 pay_status=1: 支付成功
 *   status=0 或 pay_status=0: 未支付
 */
function isPaySuccess(result) {
  if (!result) return false;
  
  // 必须API请求成功（code=1）
  if (result.code !== 1 && result.code !== '1') {
    return false;
  }
  
  // 检查支付状态：status=1 或 pay_status=1 表示支付成功
  if (result.status === 1 || result.status === '1') {
    return true;
  }
  if (result.pay_status === 1 || result.pay_status === '1') {
    return true;
  }
  
  // 检查其他可能的成功标志
  if (result.trade_state === 'SUCCESS' || result.trade_state === 'paid') {
    return true;
  }
  
  return false;
}

/**
 * 通用订单支付成功处理 - 统一入口
 */
function markOrderAsPaid(orderNo, payData, source) {
  const order = orders.get(orderNo);
  if (!order) return false;
  
  // 防止重复处理
  if (order.status === 'paid' && order.paid) {
    console.log(`订单已处理，跳过: ${orderNo}`);
    return true;
  }
  
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  order.notifyData = payData;
  
  // 自动给用户加金币
  if (order.username && order.goldAmount > 0 && !order.paid) {
    const success = addUserGold(order.username, order.goldAmount, `${source}充值`);
    order.paid = success;
    console.log(`✅ ${source}充值成功: 用户=${order.username}, 金币=+${order.goldAmount}, 订单=${orderNo}`);
  } else if (!order.username) {
    console.log(`⚠️ ${source}订单无关联用户: ${orderNo}`);
    order.paid = true;
  }
  
  orders.set(orderNo, order);
  saveOrders();
  return true;
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
    mpayEndpoint: config.mpayEndpoint || 'https://api.mpays.cn',
    testMode: config.testMode || false,
    paymentModes: [
      { value: 'qrcode', label: '收款码模式（手动）' },
      { value: 'api', label: 'API模式（自动到账）' },
      { value: 'test', label: '测试模式（模拟支付）' }
    ]
  });
});

// 更新配置
app.post('/api/config', (req, res) => {
  const updates = req.body;
  
  const allowedFields = ['paymentMethod', 'apiKey', 'apiSecret', 'qrCodeImage', 'autoVerify', 'notifyUrl', 'mpayEndpoint', 'testMode'];
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      config[field] = updates[field];
    }
  });
  
  saveConfig(config);
  console.log('配置已更新:', JSON.stringify({...config, apiKey: config.apiKey ? '***' : '', apiSecret: config.apiSecret ? '***' : ''}));
  res.json({ success: true, message: '配置已更新' });
});

// 生成测试模式的模拟二维码
function generateTestQRCode(orderNo) {
  const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#fff"/>
    <rect x="20" y="20" width="40" height="40" fill="#000"/>
    <rect x="140" y="20" width="40" height="40" fill="#000"/>
    <rect x="20" y="140" width="40" height="40" fill="#000"/>
    <rect x="30" y="30" width="20" height="20" fill="#fff"/>
    <rect x="150" y="30" width="20" height="20" fill="#fff"/>
    <rect x="30" y="150" width="20" height="20" fill="#fff"/>
    <rect x="35" y="35" width="10" height="10" fill="#000"/>
    <rect x="155" y="35" width="10" height="10" fill="#000"/>
    <rect x="35" y="155" width="10" height="10" fill="#000"/>
    <text x="100" y="105" text-anchor="middle" font-size="14" fill="#666">TEST</text>
    <text x="100" y="125" text-anchor="middle" font-size="10" fill="#999">${orderNo.slice(-8)}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(qrSvg)}`;
}

// 金币计算函数 - 1元 = 10金币，大额赠送额外金币
function calculateGoldAmount(priceInYuan) {
  const amount = Math.round(priceInYuan * 10);
  let bonus = 0;
  if (amount >= 50) bonus = 5;
  if (amount >= 100) bonus = 15;
  if (amount >= 500) bonus = 100;
  if (amount >= 1000) bonus = 300;
  if (amount >= 5000) bonus = 2000;
  return amount + bonus;
}

// 创建支付订单
app.post('/api/order/create', async (req, res) => {
  try {
    const { amount, description, token: bodyToken } = req.body;
    const headerToken = req.headers.authorization?.replace('Bearer ', '');
    const token = headerToken || bodyToken;
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: '金额无效' });
    }
    
    if (amount < 1) {
      return res.status(400).json({ success: false, message: '最低金额1元' });
    }
    
    // 验证用户身份 - 支持从header或body传递token
    let username = null;
    if (token) {
      const user = verifySession(token);
      if (user) {
        username = user.username;
        console.log(`订单绑定用户: ${username}`);
      }
    }
    
    // 计算金币数量
    const goldAmount = calculateGoldAmount(amount);
    
    const order = createOrder(amount, description, username, goldAmount);
    
    const response = {
      success: true,
      orderNo: order.orderNo,
      amount: order.amount,
      goldAmount: goldAmount,
      description: order.description,
      expiresAt: order.expiredAt,
      paymentMethod: config.paymentMethod,
      username: username,
      hasUser: !!username
    };
    
    // 根据支付模式返回不同内容
    if (config.paymentMethod === 'test' || config.testMode) {
      // 测试模式：生成模拟二维码，3秒后自动支付成功
      response.qrCode = generateTestQRCode(order.orderNo);
      response.paymentMode = 'test';
      response.isAutoVerify = true;
      response.testMode = true;
      
      // 3秒后自动模拟支付成功
      setTimeout(() => {
        const currentOrder = orders.get(order.orderNo);
        if (currentOrder && currentOrder.status === 'pending') {
          markOrderAsPaid(order.orderNo, { 
            testMode: true, 
            paidAt: new Date().toISOString(),
            amount: order.amount * 100,
            status: 'paid'
          }, '测试模式自动');
          console.log(`🧪 测试模式：订单 ${order.orderNo} 自动支付成功`);
        }
      }, 3000);
      
      console.log(`🧪 测试模式：订单 ${order.orderNo} 创建成功，将在3秒后自动支付`);
    } else if (config.paymentMethod === 'api' && config.apiKey) {
      // API模式：调用第三方支付
      const apiOrder = await createMPayOrder(order);
      
      if (apiOrder) {
        order.apiOrderNo = apiOrder.orderNo;
        orders.set(order.orderNo, order);
        saveOrders();
        
        response.qrCode = apiOrder.qrCode;
        response.qrUrl = apiOrder.qrUrl;
        response.payUrl = apiOrder.payUrl;
        response.apiOrderNo = apiOrder.orderNo;
        response.isAutoVerify = config.autoVerify;
        response.paymentMode = 'api';
        response.paymentType = config.mpayType || 'alipay';
        response.paymentTypeName = (config.mpayType === 'wxpay' || config.mpayType === 'weixin') ? '微信' : '支付宝';
        
        // 如果有支付链接，标记需要前端跳转
        if (apiOrder.qrUrl || apiOrder.payUrl) {
          response.needRedirect = true;
          response.redirectUrl = apiOrder.qrUrl || apiOrder.payUrl;
        }
        
        // 如果开启自动验证，启动轮询兜底
        if (config.autoVerify) {
          pollAndVerifyOrderEnhanced(order.orderNo);
        }
      } else {
        // API调用失败，降级为手动模式
        response.qrCode = config.qrCodeImage;
        response.isAutoVerify = false;
        response.fallbackToManual = true;
        response.paymentMode = 'manual';
        console.log('API调用失败，降级为手动验证模式');
      }
    } else if (config.qrCodeImage) {
      // 收款码模式
      response.qrCode = config.qrCodeImage;
      response.paymentMode = 'qrcode';
      response.isAutoVerify = false;
    } else {
      response.paymentMode = 'none';
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

// 给用户增加金币的函数
function addUserGold(username, amount, reason) {
  if (!username || !users[username]) {
    console.error('用户不存在，无法加金币:', username);
    return false;
  }
  
  const user = users[username];
  user.gold = (user.gold || 0) + amount;
  users[username] = user;
  saveUsers(users);
  console.log(`✅ 用户 ${username} 增加 ${amount} 金币（${reason}），当前金币: ${user.gold}`);
  return true;
}

// 确认订单已支付（手动确认或API验证后确认）
app.post('/api/order/:orderNo/confirm', (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  // 如果已经支付成功，直接返回
  if (order.status === 'paid' && order.paid) {
    return res.json({ 
      success: true, 
      status: 'paid', 
      message: '订单已支付',
      goldAdded: order.goldAmount
    });
  }
  
  // 允许从pending状态确认
  if (order.status === 'pending') {
    // 使用统一入口处理
    markOrderAsPaid(orderNo, { confirmedAt: new Date().toISOString() }, '手动确认');
    
    const updatedOrder = orders.get(orderNo);
    return res.json({ 
      success: true, 
      status: 'paid', 
      message: '支付确认成功',
      goldAdded: updatedOrder ? updatedOrder.goldAmount : 0,
      username: updatedOrder ? updatedOrder.username : null
    });
  }
  
  return res.status(400).json({ success: false, message: '订单状态异常: ' + order.status });
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
 * 接收码支付平台的支付结果通知，自动给用户加金币
 * 支持多种支付平台格式
 */
app.post('/api/payment/notify', async (req, res) => {
  try {
    console.log('收到支付回调通知:', JSON.stringify(req.body).substring(0, 300));
    
    const body = req.body;
    
    // 支持多种订单号字段格式
    const actualOrderNo = body.order_no || body.orderNo || body.mch_order_no || body.mchOrderNo || 
                          body.out_trade_no || body.outTradeNo || body.merchant_order_no;
    if (!actualOrderNo) {
      console.error('回调缺少订单号，所有字段:', Object.keys(body));
      return res.json({ code: 0, msg: '缺少订单号' });
    }
    
    console.log('回调订单号:', actualOrderNo);
    
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
      // 返回成功避免第三方重复通知
      return res.json({ code: 1, msg: 'success', note: '订单不存在但已记录' });
    }
    
    console.log('找到订单:', order.orderNo, '金额:', order.amount, '用户:', order.username);
    
    // 验证签名（如果有）
    if (body.sign && config.apiSecret) {
      try {
        const signParams = {};
        Object.keys(body).forEach(key => {
          if (key !== 'sign' && key !== 'sign_type' && key !== 'charset') signParams[key] = body[key];
        });
        
        const signStr = Object.keys(signParams)
          .sort()
          .map(k => `${k}=${signParams[k]}`)
          .join('&') + `&key=${config.apiSecret}`;
        const expectedSign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
        
        if (body.sign.toUpperCase() !== expectedSign) {
          console.error('签名验证失败:', actualOrderNo);
          console.log('期望签名:', expectedSign, '实际签名:', body.sign);
          // 即使签名失败，如果金额和状态都正确，仍然处理（部分平台签名机制不同）
        } else {
          console.log('签名验证通过');
        }
      } catch (signErr) {
        console.error('签名验证异常:', signErr.message);
      }
    }
    
    // 验证金额（可选，部分平台格式不同）
    const payAmount = parseFloat(body.amount || body.pay_amount || body.total_fee || body.fee);
    if (payAmount && order.amount > 0) {
      const amountInYuan = payAmount > 100 ? payAmount / 100 : payAmount;
      if (Math.abs(amountInYuan - order.amount) > 1.0) { // 允许1元误差（部分平台手续费）
        console.warn('金额不匹配: 回调=' + amountInYuan + ', 订单=' + order.amount + '，继续处理');
      }
    }
    
    // 判断支付状态 - 支持多种状态字段
    // 码支付回调格式：status=1 或 pay_status=1 表示支付成功
    // code=1 只是表示回调请求成功，不代表支付成功
    let isPaid = false;
    
    // 优先检查 status 和 pay_status 字段
    if (body.status === 1 || body.status === '1') {
      isPaid = true;
    } else if (body.pay_status === 1 || body.pay_status === '1') {
      isPaid = true;
    } else if (['paid', 'success', 'SUCCESS', 'completed', 'finish', 'PAYSUCCESS'].includes(body.status)) {
      isPaid = true;
    } else if (['paid', 'success', 'SUCCESS', 'completed', 'finish', 'PAYSUCCESS'].includes(body.pay_status)) {
      isPaid = true;
    }
    
    console.log('支付状态: status=' + body.status + ', pay_status=' + body.pay_status + ', 是否成功=' + isPaid);
    
    if (isPaid) {
      // 使用统一入口处理
      markOrderAsPaid(order.orderNo, body, '支付回调');
      console.log('✅ 支付回调处理成功:', order.orderNo);
      return res.json({ code: 1, msg: 'success' });
    } else {
      console.log('回调状态未成功:', payStatus);
      return res.json({ code: 0, msg: '状态未成功', status: payStatus });
    }
  } catch (error) {
    console.error('回调处理异常:', error);
    // 即使异常也返回成功，避免第三方重复通知
    res.json({ code: 1, msg: 'received' });
  }
});

// ============ 测试模式接口 ============

/**
 * 模拟支付成功回调（用于本地测试）
 * 在测试模式下，可以通过此接口手动触发支付成功
 */
app.post('/api/test/pay/:orderNo', (req, res) => {
  try {
    const orderNo = req.params.orderNo;
    const order = orders.get(orderNo);
    
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    if (order.status === 'paid') {
      return res.json({ success: true, message: '订单已支付', orderNo });
    }
    
    // 模拟支付成功
    markOrderAsPaid(orderNo, { 
      testMode: true, 
      paidAt: new Date().toISOString(),
      amount: order.amount * 100,
      status: 'paid'
    }, '测试模式');
    
    res.json({ 
      success: true, 
      message: '测试支付成功', 
      orderNo,
      goldAmount: order.goldAmount,
      username: order.username
    });
  } catch (error) {
    console.error('测试支付失败:', error);
    res.status(500).json({ success: false, message: '测试支付失败' });
  }
});

/**
 * 获取测试模式状态
 */
app.get('/api/test/mode', (req, res) => {
  res.json({
    testMode: config.testMode || false,
    paymentMethod: config.paymentMethod,
    hasApiKey: !!config.apiKey,
    message: config.testMode ? '测试模式已启用，可使用模拟支付' : '生产模式'
  });
});

/**
 * 切换测试模式
 */
app.post('/api/test/mode', (req, res) => {
  const { enabled } = req.body;
  config.testMode = !!enabled;
  saveConfig(config);
  res.json({ success: true, testMode: config.testMode });
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
    if (result && isPaySuccess(result)) {
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

// 健康检查（增强版）
app.get('/api/health', (req, res) => {
  const activeOrders = Array.from(orders.values()).filter(o => o.status === 'pending').length;
  const paidToday = Array.from(orders.values())
    .filter(o => o.status === 'paid')
    .reduce((sum, o) => sum + o.amount, 0);
  
  res.json({ 
    success: true, 
    message: '格格的宫殿服务器运行中',
    version: '5.0.0',
    config: config.paymentMethod,
    paymentMode: config.paymentMethod,
    testMode: config.testMode || false,
    hasApiKey: !!config.apiKey,
    autoVerify: config.autoVerify,
    hasNotifyUrl: !!config.notifyUrl,
    notifyUrl: config.notifyUrl,
    activeOrders,
    paidToday: parseFloat(paidToday.toFixed(2)),
    totalUsers: Object.keys(users).length,
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

// 实时查询订单支付状态（优化版，用于前端高频轮询）
app.get('/api/order/:orderNo/status', (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  // 如果是pending状态，主动查询第三方
  if (order.status === 'pending' && order.apiOrderNo && config.paymentMethod === 'api') {
    queryMPayOrder(order.apiOrderNo).then(result => {
      if (result && isPaySuccess(result)) {
        markOrderAsPaid(orderNo, result, '实时查询');
        const updatedOrder = orders.get(orderNo);
        return res.json({
          success: true,
          orderNo: orderNo,
          status: 'paid',
          paid: true,
          goldAmount: updatedOrder ? updatedOrder.goldAmount : 0,
          username: updatedOrder ? updatedOrder.username : null,
          justPaid: true
        });
      }
      
      res.json({
        success: true,
        orderNo: orderNo,
        status: 'pending',
        paid: false,
        amount: order.amount,
        goldAmount: order.goldAmount
      });
    }).catch(() => {
      res.json({
        success: true,
        orderNo: orderNo,
        status: 'pending',
        paid: false
      });
    });
  } else {
    res.json({
      success: true,
      orderNo: orderNo,
      status: order.status,
      paid: order.status === 'paid',
      goldAmount: order.goldAmount || 0,
      username: order.username,
      paidAt: order.paidAt
    });
  }
});

// 获取支付配置（包含回调地址等公开信息）
app.get('/api/payment/info', (req, res) => {
  res.json({
    paymentMethod: config.paymentMethod,
    apiMode: config.paymentMethod === 'api' && !!config.apiKey,
    hasQRCode: !!config.qrCodeImage,
    autoVerify: config.autoVerify,
    callbackUrl: config.notifyUrl,
    mpayEndpoint: config.mpayEndpoint
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

// 全局错误处理 - 确保Railway能看到错误日志
process.on('uncaughtException', (err) => {
  console.error('【未捕获异常】', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('【未处理拒绝】', reason);
});

console.log('【启动】正在启动服务器...');
console.log('【环境】NODE_ENV:', process.env.NODE_ENV);
console.log('【环境】PORT:', PORT);
console.log('【环境】MPAY_API_KEY:', process.env.MPAY_API_KEY ? '已设置' : '未设置');

// 启动服务器
const server = app.listen(PORT, () => {
  const localIp = getLocalIP();
  const callbackUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;
  const isTestMode = config.testMode || config.paymentMethod === 'test';
  const paymentModeText = isTestMode ? '🧪 测试模式' : 
                          config.paymentMethod === 'api' ? '🔗 API自动验证' : 
                          config.paymentMethod === 'qrcode' ? '📱 收款码模式' : '📱 收款码模式';
  
  console.log(`
╔══════════════════════════════════════════════╗
║       格格的宫殿 · 服务器已启动 (v5.0)        ║
╠══════════════════════════════════════════════╣
║  访问地址（本机）: http://localhost:${PORT}        ║
║  访问地址（局域网）: http://${localIp}:${PORT}        ║
║                                              ║
║  支付模式: ${paymentModeText}        ║
║  回调地址: ${callbackUrl}
║                                              ║
║  接口列表:                                   ║
║    GET  /api/health      - 健康检查          ║
║    GET  /api/config      - 获取配置          ║
║    POST /api/config      - 更新配置          ║
║    POST /api/order/create - 创建订单          ║
║    GET  /api/order/:no/status - 订单状态      ║
║    POST /api/order/:no/confirm - 确认支付    ║
║    POST /api/payment/notify - 支付回调       ║
║    POST /api/test/pay/:no - 测试支付         ║
╚══════════════════════════════════════════════╝
  `);
  
  if (isTestMode) {
    console.log('🧪 测试模式已启用');
    console.log('   创建订单后3秒自动支付成功，金币自动到账');
    console.log('   可用于本地测试完整的充值流程');
  } else if (config.paymentMethod === 'api') {
    console.log('💡 API模式已启用');
    console.log('   请在码支付后台配置回调地址');
    console.log('   回调地址: ' + callbackUrl);
    if (!config.apiKey) {
      console.log('   ⚠️  API Key未设置，请在格格设置页面填写');
    }
  } else {
    console.log('📱 收款码模式（手动）');
    console.log('   奴才扫码后需手动确认到账');
  }
  
  console.log('【启动】服务器启动成功！监听端口:', PORT);
});

server.on('error', (err) => {
  console.error('【启动失败】服务器启动错误:', err.message);
  console.error(err.stack);
  process.exit(1);
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

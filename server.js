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
// Railway 需要监听 3000 端口（Target port）
// 本地开发时使用环境变量或默认 3000
const PORT = process.env.NODE_ENV === 'production' ? 3000 : (process.env.PORT || 3000);

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

// ============ 强制清除浏览器缓存的重定向 ============
// 访问 /new 或 /v2 时重定向到首页并附带唯一参数，强制浏览器加载最新内容
// /pay 是虎皮椒支付开通后的新永久入口（2026-08-19）
// /forever 是虎皮椒支付正式上线后的永久性网址（2026-08-20）
app.get(['/new', '/v2', '/v3', '/latest', '/pay', '/palace', '/gege', '/forever', '/xunhupay', '/pay2026'], function(req, res) {
  var stamp = Date.now();
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.redirect(302, '/?t=' + stamp);
});

// ============ 支付中转页面 ============
// 统一显示虎皮椒微信支付二维码，明确提示使用另一台手机扫码
// - 不支持微信内长按识别支付
// - 不支持截图/相册识别
// - 必须使用另外一台手机的微信扫码
app.get('/pay-jump', function(req, res) {
  var orderNo = req.query.orderNo || '';
  var payLink = req.query.payLink || '';      // 虎皮椒H5跳转链接
  var qrImgUrl = req.query.qrImgUrl || '';    // 虎皮椒微信支付二维码图片URL
  var amount = req.query.amount || '';        // 金额

  // 安全检查：只允许虎皮椒支付链接
  if (!payLink || payLink.indexOf('xunhupay.com') < 0) {
    return res.status(400).send('支付链接无效');
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // 二维码安全检查：只允许虎皮椒二维码
  var safeQrImgUrl = (qrImgUrl && qrImgUrl.indexOf('xunhupay.com') >= 0) ? qrImgUrl : '';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">';
  html += '<title>格格的宫殿 · 微信支付</title>';
  html += '<style>';
  html += '*{margin:0;padding:0;box-sizing:border-box;}';
  html += 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#1a0f0a,#3d2817);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#FFD700;padding:20px;}';
  html += '.container{text-align:center;max-width:400px;width:100%;}';
  html += '.palace-icon{font-size:50px;margin-bottom:15px;animation:bounce 1s infinite;}';
  html += '@keyframes bounce{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}';
  html += '.title{font-size:20px;font-weight:bold;margin-bottom:12px;color:#FFD700;text-shadow:0 2px 4px rgba(0,0,0,0.5);}';
  html += '.amount{font-size:42px;font-weight:bold;color:#FFD700;margin:10px 0;text-shadow:0 2px 8px rgba(255,215,0,0.5);}';
  html += '.amount span{font-size:20px;opacity:0.7;}';
  html += '.order-info{background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:12px;margin:12px 0;}';
  html += '.order-info p{margin:4px 0;font-size:13px;color:#FFF;}';
  html += '.qr-box{background:#fff;padding:15px;border-radius:16px;margin:15px auto;display:inline-block;box-shadow:0 6px 20px rgba(0,0,0,0.4);}';
  html += '.qr-box img{width:220px;height:220px;display:block;}';
  html += '.pay-btn{display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#5a2d0c;border-radius:30px;text-decoration:none;font-weight:bold;font-size:16px;margin:15px 0;box-shadow:0 4px 15px rgba(255,215,0,0.4);transition:transform 0.2s;}';
  html += '.pay-btn:active{transform:scale(0.95);}';
  html += '.loading{display:inline-block;width:20px;height:20px;border:2px solid rgba(255,215,0,0.3);border-top-color:#FFD700;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;vertical-align:middle;}';
  html += '@keyframes spin{to{transform:rotate(360deg);}}';
  html += '.tip{font-size:13px;color:#FFD700;opacity:0.9;margin-top:12px;line-height:1.6;padding:0 10px;}';
  html += '.warn-box{background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.4);border-radius:12px;padding:16px;margin:16px 0;}';
  html += '.warn-title{font-size:16px;font-weight:bold;color:#ff6b6b;margin-bottom:8px;line-height:1.5;}';
  html += '.warn-detail{font-size:12px;color:#FFD700;opacity:0.85;line-height:1.7;text-align:left;padding-left:4px;}';
  html += '</style></head><body>';
  html += '<div class="container">';
  html += '<div class="palace-icon">🐉</div>';
  html += '<div class="title">格格的宫殿 · 微信支付</div>';
  if (amount) {
    html += '<div class="amount">¥' + amount + '</div>';
  }
  html += '<div class="order-info">';
  html += '<p>订单号：' + orderNo + '</p>';
  html += '</div>';

  if (safeQrImgUrl) {
    html += '<div class="qr-box">';
    html += '<img src="' + safeQrImgUrl + '" alt="微信支付二维码" id="qrImg">';
    html += '</div>';

    // 统一警示：必须使用另一台手机扫码
    html += '<div class="warn-box">';
    html += '<div class="warn-title">⚠️ 请使用另一台手机的微信<br>扫描上方二维码支付</div>';
    html += '<div class="warn-detail">';
    html += '❌ 不支持微信内长按识别支付<br>';
    html += '❌ 不支持截图保存 / 相册识别<br>';
    html += '❌ 不支持同一台手机跳转支付<br>';
    html += '✅ 必须使用另外一台手机扫码';
    html += '</div>';
    html += '</div>';
    
    // 支付完成后自动检测
    html += '<div id="pollingTip" style="margin-top:15px;padding:10px;background:rgba(74,222,128,0.1);border-radius:8px;font-size:12px;color:#4ADE80;">';
    html += '<span class="loading"></span>支付完成后系统将自动检测并增加金币...';
    html += '</div>';
  } else {
    html += '<a href="' + payLink + '" class="pay-btn">📱 打开微信扫码支付</a>';
  }

  html += '</div>';
  html += '<script>';
  html += '(function(){';
  html += 'var orderNo="' + orderNo + '";';
  html += 'var pollingTip=document.getElementById("pollingTip");';
  // 启动轮询：每5秒查询一次订单状态（手机和PC都启用）
  html += 'var pollCount=0;';
  html += 'var pollTimer=setInterval(function(){';
  html += 'pollCount++;';
  html += 'fetch("/api/order/"+orderNo+"/status",{method:"GET"})';
  html += '.then(function(r){return r.json();})';
  html += '.then(function(d){';
  html += 'if(d&&d.paid){';
  html += 'clearInterval(pollTimer);';
  html += 'if(pollingTip){pollingTip.innerHTML="✅ 支付成功！金币已自动到账，3秒后自动返回...";pollingTip.style.background="rgba(74,222,128,0.3)";pollingTip.style.fontSize="16px";pollingTip.style.fontWeight="bold";}';
  html += 'setTimeout(function(){try{window.opener&&window.opener.location.reload();window.close();}catch(e){}try{window.location.href="/forever";}catch(e){}},3000);';
  html += '}';
  html += '}).catch(function(e){});';
  html += 'if(pollCount>=120){clearInterval(pollTimer);if(pollingTip){pollingTip.innerHTML="查询超时，请刷新页面或返回查看金币";pollingTip.style.color="#ff6b6b";}}';
  html += '},5000);';
  html += '})();';
  html += '</script></body></html>';

  res.send(html);
});

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
// Railway持久化存储路径（如果可用）
// 优先级：RAILWAY_PERSISTENT_DIR > PERSISTENT_DIR > /tmp/gege_data > __dirname/data
let PERSISTENT_DIR = process.env.RAILWAY_PERSISTENT_DIR || process.env.PERSISTENT_DIR || '';
// 如果没设置环境变量，尝试 /tmp（Railway/Linux 可写），最后才回退到代码目录
if (!PERSISTENT_DIR) {
  // 测试 /tmp 是否可写（Linux/Railway 环境）
  const tmpDir = '/tmp/gege_data';
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.accessSync(tmpDir, fs.constants.W_OK);
    PERSISTENT_DIR = tmpDir;
    console.log('[存储] 使用 /tmp/gege_data 作为持久化目录');
  } catch (e) {
    // /tmp 不可用，回退到代码目录（本地开发环境）
    PERSISTENT_DIR = path.join(__dirname, 'data');
    console.log('[存储] 使用本地代码目录:', PERSISTENT_DIR);
  }
}
// 确保持久化目录存在
try {
  fs.mkdirSync(PERSISTENT_DIR, { recursive: true });
  fs.accessSync(PERSISTENT_DIR, fs.constants.W_OK);
} catch(e) {
  console.error('[存储] 持久化目录不可写:', PERSISTENT_DIR, e.message);
  // 最后兜底：尝试当前工作目录的 data 子目录
  PERSISTENT_DIR = path.join(process.cwd(), 'data');
  try { fs.mkdirSync(PERSISTENT_DIR, { recursive: true }); } catch(e2) {}
}

const USERS_FILE = path.join(PERSISTENT_DIR, 'users.json');
const SESSIONS_FILE = path.join(PERSISTENT_DIR, 'sessions.json');
const CONFIG_FILE = path.join(PERSISTENT_DIR, 'payment_config.json');
const ORDER_FILE = path.join(PERSISTENT_DIR, 'orders.json');
const BACKUP_DIR = path.join(PERSISTENT_DIR, 'backups');
console.log('[存储] 持久化目录:', PERSISTENT_DIR);

// 自动迁移旧位置数据到持久化目录
function migrateOldData() {
  const migrations = [
    { old: path.join(__dirname, 'users.json'), new: USERS_FILE, name: '用户数据' },
    { old: path.join(__dirname, 'sessions.json'), new: SESSIONS_FILE, name: '会话数据' },
    { old: path.join(__dirname, 'payment_config.json'), new: CONFIG_FILE, name: '配置数据' },
    { old: path.join(__dirname, 'orders.json'), new: ORDER_FILE, name: '订单数据' }
  ];
  
  for (const m of migrations) {
    try {
      if (fs.existsSync(m.old) && !fs.existsSync(m.new)) {
        fs.copyFileSync(m.old, m.new);
        console.log(`[迁移] ${m.name} 从旧位置迁移到持久化目录`);
      }
    } catch(e) {
      console.warn(`[迁移] ${m.name} 迁移失败:`, e.message);
    }
  }
}
migrateOldData();

function loadUsers() {
  // 1. 优先从持久化目录加载
  try {
    if (fs.existsSync(USERS_FILE)) {
      let content = fs.readFileSync(USERS_FILE, 'utf8');
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
      }
      const users = JSON.parse(content);
      const count = Object.keys(users).length;
      console.log(`[存储] 从持久化目录加载 ${count} 个用户`);
      return users;
    }
  } catch (e) {
    console.warn('[存储] 从持久化目录加载失败:', e.message);
  }

  // 2. Fallback: 从代码目录的 data/users.json 加载（随仓库部署的初始数据）
  const codeDirUsers = path.join(__dirname, 'data', 'users.json');
  try {
    if (fs.existsSync(codeDirUsers)) {
      let content = fs.readFileSync(codeDirUsers, 'utf8');
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
      }
      const users = JSON.parse(content);
      const count = Object.keys(users).length;
      console.log(`[存储] 从代码目录加载 ${count} 个用户（初始数据）`);
      // 复制到持久化目录，避免下次再从代码目录加载
      try {
        saveUsers(users);
        console.log('[存储] 初始数据已复制到持久化目录');
      } catch (e) {
        console.warn('[存储] 复制初始数据失败:', e.message);
      }
      return users;
    }
  } catch (e) {
    console.warn('[存储] 从代码目录加载失败:', e.message);
  }

  console.log('[存储] 无用户数据，从空开始');
  return {};
}

function saveUsers(users) {
  // 第一步：创建备份（失败不影响主流程）
  try {
    // 使用 PERSISTENT_DIR 下的 backups 目录（Railway 上 __dirname 是只读的）
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // 检查是否需要备份（保留最近5个）
    const existingFiles = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('users_backup_')).sort();
    if (existingFiles.length >= 5) {
      fs.unlinkSync(path.join(BACKUP_DIR, existingFiles[0]));
    }

    // 每次保存都创建备份
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `users_backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(users, null, 2));

    // 清理超过24小时的备份
    const allBackups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('users_backup_'));
    const now = Date.now();
    allBackups.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    });
  } catch (e) {
    console.warn('[存储] 备份失败（不影响保存）:', e.message);
  }

  // 第二步：写入主文件（失败要返回false让调用方知道）
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (e) {
    console.error('[存储] 保存用户数据失败:', e.message);
    return false;
  }
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

// 虎皮椒支付默认凭证（用户已开通，作为fallback确保支付可用）
const DEFAULT_XUNHUPAY_APPID = '201906186425';
const DEFAULT_XUNHUPAY_SECRET = '8173df15307b65e6f47fb9d359bcb868';
const DEFAULT_PUBLIC_URL = 'https://gege-palacee-production.up.railway.app';
// 旧的码支付凭证（用于检测并自动覆盖）
const LEGACY_EPAY_PID = '12809';
const LEGACY_EPAY_SECRET = 'AR80YAas4AobLsPKdQlW';

/**
 * 强制修复旧的码支付配置，自动切换为虎皮椒凭证
 * 解决Railway环境变量残留旧值导致支付失败的问题
 */
function fixLegacyConfig(config) {
  let changed = false;
  // 0. 强制使用虎皮椒支付平台（最优先）
  if (config.payProvider !== 'xunhupay') {
    console.log('[支付] 强制切换为虎皮椒支付平台');
    config.payProvider = 'xunhupay';
    changed = true;
  }
  // 1. 虎皮椒支付时，无条件强制设置正确的端点（不依赖检测，直接覆盖）
  if (config.payProvider === 'xunhupay') {
    const correctEndpoint = 'https://api.xunhupay.com/payment/do.html';
    if (config.mpayEndpoint !== correctEndpoint) {
      console.log('[支付] 强制设置虎皮椒端点:', config.mpayEndpoint, '->', correctEndpoint);
      config.mpayEndpoint = correctEndpoint;
      changed = true;
    }
    // 2. 虎皮椒默认使用微信支付
    if (config.mpayType !== 'wxpay') {
      console.log('[支付] 虎皮椒强制使用微信支付:', config.mpayType, '-> wxpay');
      config.mpayType = 'wxpay';
      changed = true;
    }
  }
  // 3. 检测旧的码支付PID(12809)，覆盖为虎皮椒appid
  if (config.apiKey === LEGACY_EPAY_PID || (config.apiKey && config.apiKey.length <= 5)) {
    console.log('[支付] 检测到旧凭证(码支付PID)，自动切换为虎皮椒appid');
    config.apiKey = DEFAULT_XUNHUPAY_APPID;
    changed = true;
  }
  // 4. 检测旧的码支付SECRET，覆盖为虎皮椒app_secret
  if (config.apiSecret === LEGACY_EPAY_SECRET || (config.apiSecret && config.apiSecret === 'AR80YAas4AobLsPKdQlW')) {
    console.log('[支付] 检测到旧凭证(码支付SECRET)，自动切换为虎皮椒app_secret');
    config.apiSecret = DEFAULT_XUNHUPAY_SECRET;
    changed = true;
  }
  if (changed) {
    console.log('[支付] 配置已自动修复为虎皮椒支付');
  }
  return config;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      // 环境变量覆盖（云部署时使用）
      if (process.env.MPAY_API_KEY) config.apiKey = process.env.MPAY_API_KEY;
      if (process.env.MPAY_API_SECRET) config.apiSecret = process.env.MPAY_API_SECRET;
      if (process.env.MPAY_ENDPOINT) config.mpayEndpoint = process.env.MPAY_ENDPOINT;
      if (process.env.MPAY_TYPE) config.mpayType = process.env.MPAY_TYPE;
      if (process.env.PAY_PROVIDER) config.payProvider = process.env.PAY_PROVIDER;
      if (process.env.PUBLIC_URL) config.notifyUrl = process.env.PUBLIC_URL + '/api/payment/notify';
      // 应用默认凭证（如果配置文件中没有或为空）
      if (!config.apiKey) config.apiKey = DEFAULT_XUNHUPAY_APPID;
      if (!config.apiSecret) config.apiSecret = DEFAULT_XUNHUPAY_SECRET;
      if (!config.payProvider) config.payProvider = 'xunhupay';
      if (!config.notifyUrl) config.notifyUrl = (process.env.PUBLIC_URL || DEFAULT_PUBLIC_URL) + '/api/payment/notify';
      // 强制修复旧的码支付配置
      config = fixLegacyConfig(config);
      console.log('[支付] 配置已加载: provider=' + config.payProvider + ', app_id=' + config.apiKey + ', notify=' + config.notifyUrl);
      return config;
    }
  } catch (e) {}
  // fallback分支：环境变量优先
  const config = {
    paymentMethod: process.env.PAYMENT_METHOD || 'api',
    apiKey: process.env.MPAY_API_KEY || DEFAULT_XUNHUPAY_APPID,
    apiSecret: process.env.MPAY_API_SECRET || DEFAULT_XUNHUPAY_SECRET,
    qrCodeImage: '',
    callbackUrl: '',
    autoVerify: true,
    notifyUrl: (process.env.PUBLIC_URL || DEFAULT_PUBLIC_URL) + '/api/payment/notify',
    payProvider: process.env.PAY_PROVIDER || 'xunhupay',
    mpayEndpoint: process.env.MPAY_ENDPOINT || 'https://api.xunhupay.com/payment/do.html',
    mpayType: process.env.MPAY_TYPE || 'wxpay',
    testMode: false
  };
  // 强制修复旧的码支付配置
  return fixLegacyConfig(config);
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

// ============ 虎皮椒支付 API 对接 ============
// 官网: https://xunhupay.com   文档: https://www.xunhupay.com/doc/api/page/index.html
// 接口: https://api.xunhupay.com/payment/do.html
// 签名: 参数按字典序拼成 k1=v1&k2=v2，末尾直接拼 app_secret，MD5小写
// 回调: status=OK 表示支付成功，需返回字符串 "success"

/**
 * 生成虎皮椒签名
 * @param {Object} params - 参数对象（不含hash）
 * @param {string} appSecret - 应用密钥
 * @returns {string} MD5小写签名
 */
function xunhupaySign(params, appSecret) {
  const signParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === 'hash' || v === '' || v === null || v === undefined) continue;
    signParams[k] = String(v);
  }
  const signStr = Object.keys(signParams).sort()
    .map(k => `${k}=${signParams[k]}`)
    .join('&');
  return crypto.createHash('md5').update(signStr + appSecret, 'utf8').digest('hex');
}

/**
 * 虎皮椒 API - 创建支付订单
 */
async function createMPayOrder(order) {
  try {
    // 创建订单前强制修复配置（防止Railway环境变量残留旧值）
    config = fixLegacyConfig(config);

    const provider = config.payProvider || 'xunhupay';
    // 强制使用虎皮椒端点（忽略任何旧的码支付端点）
    const endpoint = 'https://api.xunhupay.com/payment/do.html';
    const appId = config.apiKey;        // 虎皮椒 appid
    const appSecret = config.apiSecret; // 虎皮椒 app_secret

    if (!appId || !appSecret) {
      console.log('虎皮椒 appid/app_secret 未设置，使用本地模式');
      return null;
    }

    const notifyUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;
    const returnUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;

    // 虎皮椒API参数（严格按照官方文档：https://www.xunhupay.com/doc/api/pay.html）
    const params = {
      version: '1.1',
      appid: appId,                          // 注意：是appid，不是app_id
      trade_order_id: order.orderNo,          // 注意：是trade_order_id，不是out_trade_no
      total_fee: order.amount.toFixed(2),
      title: order.description || '格格的宫殿-金币充值',
      time: Math.floor(Date.now() / 1000),    // Unix时间戳（秒），不是格式化日期
      notify_url: notifyUrl,
      return_url: returnUrl,
      nonce_str: crypto.randomBytes(8).toString('hex')
    };
    params.hash = xunhupaySign(params, appSecret);

    console.log('📱 调用虎皮椒API');
    console.log('  appid:', appId);
    console.log('  金额:', params.total_fee, '元');
    console.log('  订单号:', params.trade_order_id);
    console.log('  时间戳:', params.time);

    // 虎皮椒官方文档要求使用POST JSON方式传参
    const postBody = JSON.stringify(params);

    const response = await httpRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      },
      body: postBody
    });

    if (!response) {
      console.error('虎皮椒API无响应');
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

    console.log('虎皮椒API响应:', JSON.stringify(jsonResp).substring(0, 400));

    // 虎皮椒返回：有url字段或url_qrcode字段表示成功，errcode存在表示失败
    if (jsonResp.errcode) {
      console.error('虎皮椒返回错误:', jsonResp.errcode, jsonResp.errmsg || '未知错误');
      return null;
    }

    // 成功响应包含：openid(订单id), url(跳转链接), url_qrcode(二维码地址)
    const payUrl = jsonResp.url || '';           // H5支付跳转链接
    const qrImageUrl = jsonResp.url_qrcode || ''; // 二维码图片URL（PC端扫码用）
    const apiOrderNo = jsonResp.openid || '';     // 虎皮椒订单id

    if (!payUrl && !qrImageUrl) {
      console.error('虎皮椒返回无支付链接:', JSON.stringify(jsonResp));
      return null;
    }

    return {
      qrCode: qrImageUrl,
      qrUrl: payUrl,
      payUrl: payUrl,
      orderNo: apiOrderNo || order.orderNo,
      amount: order.amount.toFixed(2),
      rawData: jsonResp
    };
  } catch (error) {
    console.error('调用虎皮椒API失败:', error.message);
    return null;
  }
}

/**
 * 兼容保留：码支付（易支付V1协议）创建订单
 * 当 payProvider=epay 时调用
 */
async function createEPayOrder(order) {
  try {
    const endpoint = config.mpayEndpoint || 'https://mzf.mapay.cc/xpay/epay';
    const pid = config.apiKey;
    const secret = config.apiSecret;

    if (!pid || !secret) {
      console.log('码支付 PID/SECRET 未设置，使用本地模式');
      return null;
    }

    const notifyUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;
    const returnUrl = config.notifyUrl || `http://localhost:${PORT}/api/payment/notify`;

    const params = {
      pid: pid,
      type: config.mpayType || 'wxpay',
      out_trade_no: order.orderNo,
      notify_url: notifyUrl,
      return_url: returnUrl,
      name: order.description || '格格的宫殿-金币充值',
      money: order.amount.toFixed(2)
    };

    const signParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (k !== 'sign' && k !== 'sign_type' && k !== 'charset' && v !== '' && v !== null && v !== undefined) {
        signParams[k] = String(v);
      }
    }
    const signStr = Object.keys(signParams).sort().map(k => `${k}=${signParams[k]}`).join('&');
    const sign = crypto.createHash('md5').update(signStr + secret, 'utf8').digest('hex');
    params.sign = sign;

    const queryString = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    const mapiUrl = `${endpoint}/mapi.php`;
    const response = await httpRequest(mapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(queryString)
      },
      body: queryString
    });

    if (!response) {
      console.error('码支付API无响应');
      return null;
    }

    let jsonResp;
    if (typeof response === 'object') {
      jsonResp = response;
    } else {
      try { jsonResp = JSON.parse(response); }
      catch (e) {
        console.error('JSON解析失败:', e.message);
        return null;
      }
    }

    console.log('码支付API响应:', JSON.stringify(jsonResp).substring(0, 300));

    if (jsonResp.code === 1) {
      const qrcode = jsonResp.qrcode || jsonResp.qrCode || '';
      const payUrl = jsonResp.urlscheme || jsonResp.payurl || '';
      let finalQrUrl = qrcode;
      let finalPayUrl = payUrl;

      if (!qrcode && !payUrl && jsonResp.trade_no) {
        const baseUrl = endpoint.replace('/mapi.php', '');
        finalQrUrl = `${baseUrl}/pay/${jsonResp.trade_no}`;
        finalPayUrl = finalQrUrl;
      }

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
 * 虎皮椒 API - 查询订单状态
 * 用于轮询兜底验证
 * 接口: https://api.xunhupay.com/payment/query.html
 * 返回: {code:0, data:{status:true/false, ...}}
 */
async function queryMPayOrder(orderNo) {
  try {
    const provider = config.payProvider || 'xunhupay';
    // 兼容码支付
    if (provider === 'epay' || (config.mpayEndpoint || '').indexOf('mapay') >= 0) {
      return await queryEPayOrder(orderNo);
    }

    const appId = config.apiKey;
    const appSecret = config.apiSecret;
    if (!appId || !appSecret) return null;

    // 查询接口地址（虎皮椒固定地址）
    const queryEndpoint = 'https://api.xunhupay.com/payment/query.html';

    // 本地订单号优先
    // 先直接查找，找不到就按 apiOrderNo 字段搜索
    let localOrder = orders.get(orderNo);
    if (!localOrder) {
      // 按apiOrderNo搜索（传入的可能是虎皮椒openid）
      for (const [key, o] of orders) {
        if (o.apiOrderNo === orderNo || o.orderNo === orderNo) {
          localOrder = o;
          break;
        }
      }
    }

    // 虎皮椒查询接口参数（根据官方文档）：
    // out_trade_order 和 open_order_id 二选一
    // time 为Unix时间戳（秒）
    const params = {
      version: '1.1',
      appid: appId,
      time: Math.floor(Date.now() / 1000),  // Unix时间戳（秒）
      nonce_str: crypto.randomBytes(8).toString('hex')
    };

    // 优先用 open_order_id（虎皮椒内部订单号），更可靠
    if (localOrder && localOrder.apiOrderNo) {
      params.open_order_id = String(localOrder.apiOrderNo);
    } else if (localOrder && localOrder.orderNo) {
      params.out_trade_order = localOrder.orderNo;
    } else {
      params.out_trade_order = orderNo;
    }

    params.hash = xunhupaySign(params, appSecret);

    // 虎皮椒查询接口用JSON方式传参
    const postBody = JSON.stringify(params);

    const result = await httpRequest(queryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      },
      body: postBody
    });

    if (!result) return null;

    let jsonResp;
    if (typeof result === 'object') {
      jsonResp = result;
    } else {
      try { jsonResp = JSON.parse(result); }
      catch (e) {
        console.log('虎皮椒查询JSON解析失败:', String(result).substring(0, 100));
        return null;
      }
    }

    console.log('虎皮椒查询响应:', JSON.stringify(jsonResp).substring(0, 300));

    // 虎皮椒查询返回 errcode=0 表示请求成功
    // data.status: OD=支付成功, WP=待支付, CD=已取消
    if (jsonResp.errcode === 0 || jsonResp.errcode === '0') {
      const data = jsonResp.data || {};
      const isPaid = data.status === 'OD' || data.status === 'od';
      return {
        code: 1,
        status: isPaid ? 1 : 0,
        pay_status: isPaid ? 1 : 0,
        msg: '查询成功: ' + (data.status || 'unknown'),
        rawData: jsonResp
      };
    } else {
      return {
        code: 0,
        status: 0,
        pay_status: 0,
        msg: jsonResp.errmsg || '查询失败',
        rawData: jsonResp
      };
    }
  } catch (error) {
    console.error('虎皮椒查询订单失败:', error.message);
    return null;
  }
}

/**
 * 兼容保留：码支付（易支付V1协议）查询订单
 */
async function queryEPayOrder(orderNo) {
  try {
    const endpoint = config.mpayEndpoint || 'https://mzf.mapay.cc/xpay/epay';
    const pid = config.apiKey;
    const secret = config.apiSecret;

    if (!pid || !secret) return null;

    const localOrder = orders.get(orderNo);
    const orderAmount = localOrder ? localOrder.amount.toFixed(2) : '0.01';
    const orderDesc = localOrder ? (localOrder.description || '订单查询') : '订单查询';

    const queryParams = {
      act: 'order',
      pid: pid,
      out_trade_no: orderNo,
      type: config.mpayType || 'alipay',
      name: orderDesc,
      money: orderAmount
    };

    const signParams = {};
    for (const [k, v] of Object.entries(queryParams)) {
      if (k !== 'sign' && k !== 'sign_type' && k !== 'charset' && v !== '' && v !== null && v !== undefined) {
        signParams[k] = String(v);
      }
    }
    const signStr = Object.keys(signParams).sort().map(k => `${k}=${signParams[k]}`).join('&');
    const sign = crypto.createHash('md5').update(signStr + secret, 'utf8').digest('hex');

    queryParams.sign = sign;
    queryParams.sign_type = 'MD5';

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

    if (!result) return null;

    let jsonResp;
    if (typeof result === 'object') {
      jsonResp = result;
    } else {
      try { jsonResp = JSON.parse(result); }
      catch (e) {
        console.log('查询订单JSON解析失败:', String(result).substring(0, 100));
        return null;
      }
    }

    console.log('码支付查询响应:', JSON.stringify(jsonResp).substring(0, 300));

    if (jsonResp.code !== 1 && jsonResp.code !== '1') {
      return jsonResp;
    }
    return jsonResp;
  } catch (error) {
    console.error('码支付查询订单失败:', error.message);
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
  // 每次返回配置前，强制修复为虎皮椒配置（防止Railway环境变量残留旧值）
  config = fixLegacyConfig(config);
  res.json({
    paymentMethod: config.paymentMethod,
    apiKey: config.apiKey ? '***已设置***' : '',
    apiSecret: config.apiSecret ? '***已设置***' : '',
    qrCodeImage: config.qrCodeImage || '',
    hasQRCode: !!config.qrCodeImage,
    autoVerify: config.autoVerify,
    notifyUrl: config.notifyUrl,
    payProvider: config.payProvider || 'xunhupay',
    mpayEndpoint: config.mpayEndpoint,
    mpayType: config.mpayType,
    testMode: config.testMode || false,
    paymentModes: [
      { value: 'qrcode', label: '收款码模式（手动）' },
      { value: 'api', label: 'API模式（自动到账）' },
      { value: 'test', label: '测试模式（模拟支付）' }
    ],
    paymentProviders: [
      { value: 'xunhupay', label: '虎皮椒支付（推荐，不被风控）' },
      { value: 'epay', label: '码支付（已被风控，不推荐）' }
    ],
    paymentTypes: [
      { value: 'wxpay', label: '微信支付' },
      { value: 'alipay', label: '支付宝' }
    ]
  });
});

// 更新配置
app.post('/api/config', (req, res) => {
  const updates = req.body;

  const allowedFields = ['paymentMethod', 'apiKey', 'apiSecret', 'qrCodeImage', 'autoVerify', 'notifyUrl', 'payProvider', 'mpayEndpoint', 'mpayType', 'testMode'];
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      config[field] = updates[field];
    }
  });

  // 自动同步端点：选择平台后自动设置正确的端点
  if (updates.payProvider === 'xunhupay') {
    config.mpayEndpoint = 'https://api.xunhupay.com/payment/do.html';
  } else if (updates.payProvider === 'epay') {
    // 码支付保持原端点，不自动覆盖（用户可自定义）
    if (!config.mpayEndpoint || config.mpayEndpoint.indexOf('xunhupay') >= 0) {
      config.mpayEndpoint = 'https://mzf.mapay.cc/xpay/epay';
    }
  }

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

// 确认订单已支付（用户手动点击"充值完成"按钮）
// 必须先查询虎皮椒支付状态，只有真支付了才加金币
app.post('/api/order/:orderNo/confirm', async (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);

  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  // 已支付过，不重复加金币
  if (order.paid) {
    return res.json({ success: true, message: '订单已支付，金币已到账', alreadyPaid: true, goldAdded: order.goldAmount });
  }

  // 先查询虎皮椒，验证是否真的支付了
  const apiOrderNo = order.apiOrderNo || order.orderNo;
  let payResult = null;
  try {
    payResult = await queryMPayOrder(apiOrderNo);
    console.log(`[手动确认] 查询订单 ${orderNo} 支付状态:`, payResult ? JSON.stringify(payResult).substring(0, 200) : 'null');
  } catch (e) {
    console.error('[手动确认] 查询虎皮椒失败:', e.message);
  }

  // 检查是否真的支付成功
  if (!payResult || !isPaySuccess(payResult)) {
    return res.json({ 
      success: false, 
      message: '未检测到支付记录，请确认已用另一台手机扫码完成支付后再点击',
      notPaid: true
    });
  }

  // 虎皮椒确认已支付
  // 如果订单还没绑定用户，尝试从请求头/body拿token绑定用户
  if (!order.username) {
    const headerToken = req.headers.authorization?.replace('Bearer ', '');
    const bodyToken = req.body && req.body.token;
    const token = headerToken || bodyToken;
    if (token) {
      const user = verifySession(token);
      if (user) {
        order.username = user.username;
        orders.set(orderNo, order);
        console.log(`[手动确认] 订单${orderNo}绑定用户: ${user.username}`);
      }
    }
  }

  const success = markOrderAsPaid(orderNo, payResult, '手动确认');
  
  if (success) {
    res.json({ 
      success: true, 
      message: '充值成功，金币已到账', 
      goldAdded: order.goldAmount,
      username: order.username
    });
  } else {
    res.json({ 
      success: false, 
      message: '充值确认失败，请稍后重试或联系格格' 
    });
  }
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
 * 支付回调通知接口
 * 兼容虎皮椒（status=OK=成功，返回success）和码支付（status=1=成功，返回code=1）
 */
app.post('/api/payment/notify', async (req, res) => {
  try {
    console.log('收到支付回调通知:', JSON.stringify(req.body).substring(0, 300));

    const body = req.body || {};
    const provider = config.payProvider || 'xunhupay';

    // 支持多种订单号字段
    // 虎皮椒回调字段：trade_order_id（我们传入的）, openid（虎皮椒返回的）
    // 码支付回调字段：out_trade_no, trade_no
    const actualOrderNo = body.trade_order_id || body.out_trade_no || body.outTradeNo || 
                          body.order_no || body.orderNo || body.mch_order_no || body.mchOrderNo || 
                          body.merchant_order_no || body.trade_no || body.openid;
    if (!actualOrderNo) {
      console.error('回调缺少订单号，所有字段:', Object.keys(body));
      return res.send('fail');
    }

    console.log('回调订单号:', actualOrderNo);

    // 查找订单（本地订单号 or 第三方订单号）
    let order = orders.get(actualOrderNo);
    if (!order) {
      for (const [, o] of orders) {
        if (o.apiOrderNo === actualOrderNo || o.orderNo === actualOrderNo) {
          order = o;
          break;
        }
      }
    }

    if (!order) {
      console.error('回调订单不存在:', actualOrderNo);
      // 返回 success 避免第三方重复通知
      return res.send('success');
    }

    console.log('找到订单:', order.orderNo, '金额:', order.amount, '用户:', order.username);

    // 验证签名
    const isXunhupay = provider === 'xunhupay' && (config.mpayEndpoint || '').indexOf('xunhupay') >= 0;
    if (isXunhupay && body.hash && config.apiSecret) {
      try {
        const expectedHash = xunhupaySign(body, config.apiSecret);
        if (body.hash !== expectedHash) {
          console.error('虎皮椒签名验证失败:', order.orderNo);
          console.log('期望签名:', expectedHash, '实际签名:', body.hash);
          // 签名失败仍处理（部分情况下微信回调参数顺序变化）
        } else {
          console.log('虎皮椒签名验证通过');
        }
      } catch (e) {
        console.error('签名验证异常:', e.message);
      }
    } else if (body.sign && config.apiSecret && !isXunhupay) {
      // 码支付签名验证（兼容）
      try {
        const signParams = {};
        Object.keys(body).forEach(key => {
          if (key !== 'sign' && key !== 'sign_type' && key !== 'charset') signParams[key] = body[key];
        });
        const signStr = Object.keys(signParams).sort().map(k => `${k}=${signParams[k]}`).join('&') + `&key=${config.apiSecret}`;
        const expectedSign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
        if (body.sign.toUpperCase() !== expectedSign) {
          console.error('码支付签名验证失败:', order.orderNo);
        } else {
          console.log('码支付签名验证通过');
        }
      } catch (e) {
        console.error('签名验证异常:', e.message);
      }
    }

    // 验证金额
    const payAmount = parseFloat(body.amount || body.pay_amount || body.total_fee || body.fee);
    if (payAmount && order.amount > 0) {
      const amountInYuan = payAmount > 100 ? payAmount / 100 : payAmount;
      if (Math.abs(amountInYuan - order.amount) > 1.0) {
        console.warn('金额不匹配: 回调=' + amountInYuan + ', 订单=' + order.amount + '，继续处理');
      }
    }

    // 判断支付状态
    // 虎皮椒: status='OK' 表示成功
    // 码支付: status=1 或 pay_status=1 表示成功
    let isPaid = false;
    if (isXunhupay) {
      if (body.status === 'OK' || body.status === 'ok' || body.status === 'success' || body.status === true) {
        isPaid = true;
      }
    } else {
      if (body.status === 1 || body.status === '1') {
        isPaid = true;
      } else if (body.pay_status === 1 || body.pay_status === '1') {
        isPaid = true;
      } else if (['paid', 'success', 'SUCCESS', 'completed', 'finish', 'PAYSUCCESS', 'OK'].includes(body.status)) {
        isPaid = true;
      } else if (['paid', 'success', 'SUCCESS', 'completed', 'finish', 'PAYSUCCESS', 'OK'].includes(body.pay_status)) {
        isPaid = true;
      }
    }

    console.log('支付状态: status=' + body.status + ', pay_status=' + body.pay_status + ', 是否成功=' + isPaid);

    if (isPaid) {
      markOrderAsPaid(order.orderNo, body, '支付回调');
      console.log('✅ 支付回调处理成功:', order.orderNo);
      // 虎皮椒要求返回字符串 "success"，码支付返回 JSON code=1
      if (isXunhupay) {
        return res.send('success');
      } else {
        return res.json({ code: 1, msg: 'success' });
      }
    } else {
      console.log('回调状态未成功:', body.status);
      if (isXunhupay) {
        return res.send('fail');
      } else {
        return res.json({ code: 0, msg: '状态未成功', status: body.status });
      }
    }
  } catch (error) {
    console.error('回调处理异常:', error);
    // 异常也要返回 success 避免重复通知
    res.send('success');
  }
});

// 兼容 GET 方式回调（部分平台用GET）
app.get('/api/payment/notify', async (req, res) => {
  console.log('收到GET回调:', JSON.stringify(req.query).substring(0, 300));
  req.body = req.query;
  // 复用 POST 逻辑：内部已用 req.body
  // 这里手动触发 POST 处理链
  const http = require('http');
  // 直接复用上面的处理逻辑
  try {
    const body = req.query || {};
    const provider = config.payProvider || 'xunhupay';
    const actualOrderNo = body.trade_order_id || body.out_trade_no || body.outTradeNo || 
                          body.order_no || body.orderNo || body.trade_no || body.openid;
    if (!actualOrderNo) return res.send('fail');

    let order = orders.get(actualOrderNo);
    if (!order) {
      for (const [, o] of orders) {
        if (o.apiOrderNo === actualOrderNo || o.orderNo === actualOrderNo) { order = o; break; }
      }
    }
    if (!order) return res.send('success');

    const isXunhupay = provider === 'xunhupay' && (config.mpayEndpoint || '').indexOf('xunhupay') >= 0;
    let isPaid = false;
    if (isXunhupay) {
      if (body.status === 'OK' || body.status === 'ok' || body.status === 'success' || body.status === true) {
        isPaid = true;
      }
    } else {
      if (body.status === 1 || body.status === '1' || body.pay_status === 1 || body.pay_status === '1') {
        isPaid = true;
      }
    }

    if (isPaid) {
      markOrderAsPaid(order.orderNo, body, 'GET回调');
      console.log('✅ GET回调处理成功:', order.orderNo);
    }
    if (isXunhupay) return res.send('success');
    return res.json({ code: 1, msg: 'success' });
  } catch (e) {
    console.error('GET回调异常:', e);
    res.send('success');
  }
});

// ============ 测试模式接口（已禁用） ============
app.post('/api/test/pay/:orderNo', (req, res) => {
  return res.status(403).json({ 
    success: false, 
    message: '测试支付已禁用' 
  });
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
      return res.status(400).json({ success: false, message: '此名字已被占用' });
    }
    
    // 默认使用真实注册名字
    const finalServantName = username;
    
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
      message: '注册成功！欢迎加入',
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
      return res.status(400).json({ success: false, message: '此账号不存在，请先注册' });
    }
    
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedPassword !== user.password) {
      return res.status(400).json({ success: false, message: '密码错误' });
    }
    
    const token = generateToken();
    sessions[token] = { username: username, createdAt: new Date().toISOString() };
    saveSessions(sessions);
    
    res.json({ 
      success: true, 
      message: '登录成功！欢迎回来',
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

// 管理员搜索用户
app.get('/api/admin/users/search', (req, res) => {
  try {
    const { q, adminKey } = req.query;
    
    if (adminKey !== 'gege123') {
      return res.status(401).json({ success: false, message: '格格验证失败' });
    }
    
    const keyword = (q || '').trim().toLowerCase();
    const results = [];
    
    for (const [username, user] of Object.entries(users)) {
      if (!keyword || 
          username.toLowerCase().includes(keyword) || 
          (user.servantName && user.servantName.toLowerCase().includes(keyword))) {
        results.push({
          username: user.username,
          servantName: user.servantName,
          gold: user.gold || 0,
          totalTributed: user.totalTributed || 0,
          kneelCount: user.kneelCount || 0,
          createdAt: user.createdAt
        });
      }
      if (results.length >= 50) break;
    }
    
    res.json({ success: true, users: results, total: results.length });
  } catch (error) {
    res.status(500).json({ success: false, message: '搜索失败' });
  }
});

// 管理员调整指定用户金币
app.post('/api/admin/users/:username/gold', (req, res) => {
  try {
    const { username } = req.params;
    const { gold, reason, adminKey } = req.body;

    if (adminKey !== 'gege123') {
      return res.status(401).json({ success: false, message: '格格验证失败' });
    }

    const user = users[username];
    if (!user) {
      return res.status(404).json({ success: false, message: '奴才不存在' });
    }

    // 兼容 string 和 number 类型（前端可能传字符串）
    const goldNum = typeof gold === 'number' ? gold : parseInt(gold);
    if (isNaN(goldNum)) {
      return res.status(400).json({ success: false, message: '金币数值无效' });
    }

    // 更新内存数据（即使保存失败，内存也是最新的）
    user.gold = Math.max(0, (user.gold || 0) + goldNum);
    if (goldNum > 0) {
      user.totalTributed = (user.totalTributed || 0) + goldNum;
    }
    users[username] = user;

    // 尝试持久化（失败也不影响返回，内存数据已更新）
    const saved = saveUsers(users);
    if (!saved) {
      console.warn('[金币] 持久化失败，但内存已更新:', username, '金币=', user.gold);
    }

    console.log(`[金币] ${username} 金币调整 ${goldNum > 0 ? '+' : ''}${goldNum}，当前=${user.gold}，原因=${reason}`);

    res.json({
      success: true,
      username: username,
      gold: user.gold,
      totalTributed: user.totalTributed || 0,
      message: reason || '金币已更新',
      persisted: saved
    });
  } catch (error) {
    console.error('[金币] 调整失败:', error);
    res.status(500).json({ success: false, message: '调整金币失败: ' + error.message });
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
// 叩拜排行榜（按叩拜次数排序）
app.get('/api/user/kneel-rank', (req, res) => {
  try {
    const rankList = Object.values(users)
      .sort((a, b) => (b.kneelCount || 0) - (a.kneelCount || 0))
      .slice(0, 50)
      .map(user => ({
        username: user.username,
        servantName: user.servantName,
        kneelCount: user.kneelCount || 0
      }));
    
    res.json({ success: true, rankList });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取排行榜失败' });
  }
});

// 奉献排行榜（按奉献金币排序）
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
// Railway 健康检查端点 - 必须返回200纯文本
app.get('/health', (req, res) => {
  console.log('【健康检查】收到 /health 请求');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

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

// 调试接口：直接查询虎皮椒支付状态，返回原始数据
app.get('/api/debug/query/:orderNo', async (req, res) => {
  const orderNo = req.params.orderNo;
  const order = orders.get(orderNo);
  
  if (!order) {
    return res.json({ error: '订单不存在', orderNo: orderNo });
  }
  
  // 用官方文档参数查询
  const appId = config.apiKey;
  const appSecret = config.apiSecret;
  const queryEndpoint = 'https://api.xunhupay.com/payment/query.html';
  
  // 方式1: 用 open_order_id 查询
  const params1 = {
    version: '1.1',
    appid: appId,
    open_order_id: String(order.apiOrderNo),
    time: Math.floor(Date.now() / 1000),
    nonce_str: crypto.randomBytes(8).toString('hex')
  };
  params1.hash = xunhupaySign(params1, appSecret);
  
  // 方式2: 用 out_trade_order 查询
  const params2 = {
    version: '1.1',
    appid: appId,
    out_trade_order: order.orderNo,
    time: Math.floor(Date.now() / 1000),
    nonce_str: crypto.randomBytes(8).toString('hex')
  };
  params2.hash = xunhupaySign(params2, appSecret);
  
  try {
    // 先用 open_order_id 查
    const postBody1 = JSON.stringify(params1);
    const result1 = await httpRequest(queryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody1) },
      body: postBody1
    });
    
    // 再用 out_trade_order 查
    const postBody2 = JSON.stringify(params2);
    const result2 = await httpRequest(queryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody2) },
      body: postBody2
    });
    
    // 同时调用正式的queryMPayOrder函数
    const officialResult = await queryMPayOrder(order.apiOrderNo || order.orderNo);
    
    res.json({
      orderNo: orderNo,
      localOrderNo: order.orderNo,
      apiOrderNo: order.apiOrderNo,
      orderStatus: order.status,
      orderPaid: order.paid,
      queryByOpenOrderId: {
        params: params1,
        rawResponse: result1
      },
      queryByOutTradeOrder: {
        params: params2,
        rawResponse: result2
      },
      queryMPayOrderResult: officialResult
    });
  } catch (e) {
    res.json({ error: e.message, orderNo: orderNo, localOrderNo: order ? order.orderNo : null });
  }
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
  maxAge: 0,
  etag: false,
  setHeaders: function(res, filePath) {
    if (filePath.match(/\.(mp3|mp4|wav|ogg|m4a|flac)$/)) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    // HTML/JS/CSS完全不缓存（确保用户每次获取最新版本）
    if (filePath.match(/\.(html|js|css)$/)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
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
  
  // 启动时自动备份用户数据
  try {
    const users = loadUsers();
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `users_backup_startup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(users, null, 2));
    console.log(`【备份】启动时自动备份已创建: ${backupFile}`);
  } catch (e) {
    console.warn('【备份】启动备份失败:', e.message);
  }
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

// ============ 格格的宫殿 · 应用逻辑 ============

// 状态管理
var state = {
  kneelCount: 0,
  selectedPrice: 18.8,
  qrCode: null,
  gegeMedia: null,
  gegeTitle: '爱新觉罗·格格',
  gegeDesc: '尊贵的格格正在等您觐见',
  isAdmin: false,
  gold: 0,
  selectedRecharge: 50,
  totalTributed: 0,
  verifyPassword: '',
  verifyEnabled: false,
  paymentProof: null,
  isVerified: false,
  bgmData: null,
  isPlaying: false,
  userName: '',
  // 用户系统
  userToken: null,
  currentUser: null,
  // 真实支付相关
  currentOrder: null,
  serverConfig: null,
  paymentPollingTimer: null,
  // 三个格格独立相册
  gegePhotos: {
    1: [],
    2: [],
    3: []
  },
  gegeIndex: { 1: 0, 2: 0, 3: 0 },
  gegeAnimation: { 1: true, 2: true, 3: true },
  gegeScrollTimer: { 1: null, 2: null, 3: null },
  gegeGold: { 1: 0, 2: 0, 3: 0 },
  currentGegeTab: 1
};

// 全局变量（兼容旧代码）
var currentGegeTab = 1;

// ============ 服务器API交互 ============
// 动态获取API基础地址，确保手机端也能正常访问
var API_BASE = '';
if (window.location.protocol === 'file:') {
  // 如果直接打开文件，使用默认服务器地址
  API_BASE = 'http://localhost:3000';
  console.warn('通过file协议访问，API_BASE设置为:', API_BASE);
} else {
  // 使用当前页面的origin作为API基础地址
  API_BASE = window.location.origin;
}
console.log('API_BASE:', API_BASE);

async function apiRequest(endpoint, options) {
  try {
    var headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    };
    // 如果有token则添加认证头
    if (state.userToken) {
      headers['Authorization'] = 'Bearer ' + state.userToken;
    }
    var url = API_BASE + endpoint;
    console.log('API请求:', url, options);
    
    var response = await fetch(url, {
      method: (options && options.method) || 'GET',
      headers: headers,
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });
    
    console.log('API响应状态:', response.status);
    var text = await response.text();
    console.log('API响应文本:', text);
    
    // 尝试解析JSON
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('JSON解析失败:', text);
      return { success: false, message: '服务器响应格式错误' };
    }
    
    return data;
  } catch (error) {
    console.error('API请求失败:', endpoint, error);
    return { success: false, message: '网络请求失败: ' + error.message };
  }
}

// ============ 用户系统函数 ============

// 网络检测函数
var networkChecked = false;
var networkOk = false;

async function testNetwork() {
  var statusEl = document.getElementById('networkStatus');
  var statusIcon = document.getElementById('networkStatusIcon');
  var statusText = document.getElementById('networkStatusText');
  var helpEl = document.getElementById('networkHelp');
  var serverUrlEl = document.getElementById('serverUrl');
  
  if (!statusEl) return;
  
  statusEl.style.display = 'block';
  statusIcon.textContent = '🔍';
  statusText.textContent = '检测网络中...';
  if (helpEl) helpEl.style.display = 'none';
  
  // 显示当前服务器地址
  if (serverUrlEl) {
    serverUrlEl.textContent = API_BASE;
  }
  
  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(() => controller.abort(), 3000);
    
    var response = await fetch(API_BASE + '/api/health', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      var data = await response.json();
      networkOk = true;
      networkChecked = true;
      statusIcon.textContent = '✅';
      statusText.textContent = '连接正常，可以登录';
      statusEl.style.background = '#2d5016';
      statusEl.style.color = '#9effa0';
      if (helpEl) helpEl.style.display = 'none';
      return true;
    } else {
      throw new Error('服务器返回错误状态: ' + response.status);
    }
  } catch (error) {
    console.error('网络检测失败:', error);
    networkOk = false;
    networkChecked = true;
    statusIcon.textContent = '❌';
    statusText.textContent = '无法连接服务器';
    statusEl.style.background = '#5a1a1a';
    statusEl.style.color = '#ff9e9e';
    if (helpEl) helpEl.style.display = 'block';
    return false;
  }
}

function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('userLoginTitle').textContent = '奴才注册';
  if (!networkChecked) testNetwork();
}

function showLoginForm() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('userLoginTitle').textContent = '奴才登录';
  if (!networkChecked) testNetwork();
}

async function userRegister() {
  var username = document.getElementById('registerUsername').value.trim();
  var password = document.getElementById('registerPassword').value;
  var password2 = document.getElementById('registerPassword2').value;
  
  if (!username || !password) {
    showToast('请填写完整信息');
    return;
  }
  if (password !== password2) {
    showToast('两次密码不一致');
    return;
  }
  if (username.length < 2) {
    showToast('名字至少2个字');
    return;
  }
  if (password.length < 4) {
    showToast('密码至少4位');
    return;
  }
  
  showToast('正在登记造册...');
  
  try {
    var data = await apiRequest('/api/user/register', {
      method: 'POST',
      body: { username: username, password: password }
    });
    
    console.log('注册响应:', data);
    
    if (data && data.success) {
      state.userToken = data.token;
      state.currentUser = data.user;
      state.userName = username;
      localStorage.setItem('gege_user_token', data.token);
      localStorage.setItem('gege_user_name', username);
      localStorage.setItem('gege_servant_name', data.user.servantName);
      
      closeUserLoginModal();
      updateUserInfoBar();
      loadGoldFromServer();
      showToast('奴才' + data.user.servantName + ' 注册成功！', 3000);
    } else {
      var msg = (data && data.message) ? data.message : '注册失败，请检查网络';
      showToast(msg, 3000);
    }
  } catch (err) {
    console.error('注册异常:', err);
    showToast('注册异常: ' + err.message, 3000);
  }
}

async function userLogin() {
  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    showToast('请填写用户名和密码');
    return;
  }
  
  showToast('正在觐见格格...');
  
  var data = await apiRequest('/api/user/login', {
    method: 'POST',
    body: { username: username, password: password }
  });
  
  if (data && data.success) {
    state.userToken = data.token;
    state.currentUser = data.user;
    state.userName = username;
    localStorage.setItem('gege_user_token', data.token);
    localStorage.setItem('gege_user_name', username);
    localStorage.setItem('gege_servant_name', data.user.servantName);
    
    closeUserLoginModal();
    updateUserInfoBar();
    syncLocalAccountFromServer();
    showToast('奴才' + data.user.servantName + ' 觐见成功！', 3000);
  } else {
    showToast(data ? data.message : '登录失败');
  }
}

async function userLogout() {
  await apiRequest('/api/user/logout', {
    method: 'POST',
    body: { token: state.userToken }
  });
  
  state.userToken = null;
  state.currentUser = null;
  state.gold = 0;
  state.totalTributed = 0;
  state.kneelCount = 0;
  localStorage.removeItem('gege_user_token');
  localStorage.removeItem('gege_servant_name');
  localStorage.removeItem('gege_local_gold');
  localStorage.removeItem('gege_local_kneel');
  localStorage.removeItem('gege_local_total_tributed');
  
  for (var g = 1; g <= 3; g++) stopGegeScrollAnimation(g);
  updateUserInfoBar();
  updateGoldDisplay();
  updateRankDisplay();
  showUserLoginModal();
  showToast('奴才已退出，期待下次觐见');
}

function closeUserLoginModal() {
  document.getElementById('userLoginModal').style.display = 'none';
}

function showUserLoginModal() {
  // 重置表单
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('registerUsername').value = '';
  document.getElementById('registerPassword').value = '';
  document.getElementById('registerPassword2').value = '';
  showLoginForm();
  document.getElementById('userLoginModal').style.display = 'flex';
  // 自动检测网络
  testNetwork();
}

function updateUserInfoBar() {
  var bar = document.getElementById('userInfoBar');
  if (state.currentUser) {
    bar.style.display = 'flex';
    document.getElementById('userInfoName').textContent = 
      (state.currentUser.servantName || '奴才') + '(' + state.currentUser.username + ')';
    document.getElementById('userInfoGold').textContent = state.gold;
    document.getElementById('userInfoKneel').textContent = state.kneelCount;
  } else {
    bar.style.display = 'none';
  }
}

async function loadGoldFromServer() {
  if (!state.userToken) return;
  
  var data = await apiRequest('/api/user/info');
  if (data && data.success) {
    state.gold = data.user.gold;
    state.totalTributed = data.user.totalTributed;
    state.kneelCount = data.user.kneelCount;
    state.currentUser = {
      username: data.user.username,
      servantName: data.user.servantName
    };
    localStorage.setItem('gege_local_gold', state.gold.toString());
    localStorage.setItem('gege_local_kneel', state.kneelCount.toString());
    localStorage.setItem('gege_local_total_tributed', state.totalTributed.toString());
    updateGoldDisplay();
    updateUserInfoBar();
    updateRankDisplay();
  }
}

async function syncGoldToServer(delta, reason) {
  if (!state.userToken) return false;
  
  var data = await apiRequest('/api/user/gold', {
    method: 'POST',
    body: { gold: delta, reason: reason }
  });
  
  if (data && data.success) {
    state.gold = data.gold;
    localStorage.setItem('gege_local_gold', state.gold.toString());
    updateGoldDisplay();
    updateUserInfoBar();
    return true;
  }
  return false;
}

async function syncKneelToServer() {
  if (!state.userToken) return;
  
  var data = await apiRequest('/api/user/kneel', {
    method: 'POST',
    body: {}
  });
  
  if (data && data.success) {
    state.kneelCount = data.kneelCount;
    localStorage.setItem('gege_local_kneel', state.kneelCount.toString());
    updateUserInfoBar();
  }
}

// 检查登录状态
function checkUserLogin() {
  var token = localStorage.getItem('gege_user_token');
  var username = localStorage.getItem('gege_user_name');
  var servantName = localStorage.getItem('gege_servant_name');
  
  if (token) {
    state.userToken = token;
    
    if (username) {
      state.userName = username;
    }
    if (servantName) {
      state.currentUser = {
        username: username || '',
        servantName: servantName
      };
    }
    
    var savedGold = localStorage.getItem('gege_local_gold');
    if (savedGold !== null) {
      state.gold = parseInt(savedGold) || 0;
    }
    var savedKneel = localStorage.getItem('gege_local_kneel');
    if (savedKneel !== null) {
      state.kneelCount = parseInt(savedKneel) || 0;
    }
    var savedTotal = localStorage.getItem('gege_local_total_tributed');
    if (savedTotal !== null) {
      state.totalTributed = parseInt(savedTotal) || 0;
    }
    
    if (state.currentUser) {
      updateUserInfoBar();
      updateGoldDisplay();
    }
    
    loadGoldFromServer();
  } else {
    showUserLoginModal();
  }
}

async function syncLocalAccountFromServer() {
  if (!state.userToken) return;
  
  var data = await apiRequest('/api/user/info');
  if (data && data.success) {
    state.gold = data.user.gold;
    state.totalTributed = data.user.totalTributed;
    state.kneelCount = data.user.kneelCount;
    state.currentUser = {
      username: data.user.username,
      servantName: data.user.servantName
    };
    state.userName = data.user.username;
    
    localStorage.setItem('gege_user_name', data.user.username);
    localStorage.setItem('gege_servant_name', data.user.servantName);
    localStorage.setItem('gege_local_gold', state.gold.toString());
    localStorage.setItem('gege_local_kneel', state.kneelCount.toString());
    localStorage.setItem('gege_local_total_tributed', state.totalTributed.toString());
    
    updateGoldDisplay();
    updateUserInfoBar();
    updateRankDisplay();
  }
}

async function checkServerConfig() {
  var data = await apiRequest('/api/config');
  if (data) {
    state.serverConfig = data;
    return data;
  }
  return null;
}

// ============ 金币系统 ============
function loadGold() {
  var saved = localStorage.getItem('gege_gold');
  if (saved !== null) {
    state.gold = parseInt(saved) || 0;
  }
  var total = localStorage.getItem('gege_total_tributed');
  if (total !== null) {
    state.totalTributed = parseInt(total) || 0;
  }
  var savedName = localStorage.getItem('gege_user_name');
  if (savedName !== null) {
    state.userName = savedName;
  }
  updateGoldDisplay();
  updateRankDisplay();
}

function setUserName() {
  var currentName = state.userName || '';
  var input = prompt('请输入您的奴才名号（最多8个字）：\n\n（将显示在奉献榜上）', currentName);
  if (!input) return;
  input = input.trim();
  if (input.length === 0 || input.length > 8) {
    showToast('名字长度需在1-8个字之间');
    return;
  }
  state.userName = input;
  localStorage.setItem('gege_user_name', input);
  showToast('奴才 ' + input + ' 叩谢格格赐名！');
  updateRankDisplay();
}

function saveGold() {
  localStorage.setItem('gege_gold', state.gold.toString());
}

function saveTotalTributed() {
  localStorage.setItem('gege_total_tributed', state.totalTributed.toString());
}

function updateGoldDisplay() {
  var el = document.getElementById('goldAmount');
  if (el) el.textContent = state.gold;
}

async function updateRankDisplay() {
  var rankList = document.getElementById('rankList');
  if (!rankList) return;
  
  var displayName = state.userName || '奴才';
  
  var myRank = '';
  if (state.totalTributed > 0) {
    myRank = '<div class="rank-item my-rank">' +
      '<span class="rank-num">我</span>' +
      '<span class="rank-name">' + (state.currentUser ? state.currentUser.servantName : displayName) + '(' + state.totalTributed + '金)</span>' +
      '<span class="rank-value">🪙 ' + state.totalTributed + '</span>' +
      '</div>';
  }
  
  // 更新名字显示
  var myRankName = document.getElementById('myRankName');
  if (myRankName) {
    myRankName.textContent = state.currentUser ? state.currentUser.servantName : displayName;
  }
  
  // 默认排行榜 - 卑微奴才名字
  var defaultRankList = [
    { servantName: '小狗子', totalTributed: 88888 },
    { servantName: '贱婢', totalTributed: 66666 },
    { servantName: '狗奴才', totalTributed: 52000 },
    { servantName: '下贱胚', totalTributed: 38000 },
    { servantName: '可怜虫', totalTributed: 28000 },
    { servantName: '哈巴狗', totalTributed: 18888 },
    { servantName: '小的', totalTributed: 12000 },
    { servantName: '奴才甲', totalTributed: 8888 },
    { servantName: '奴婢', totalTributed: 5200 },
    { servantName: '小厮', totalTributed: 2800 }
  ];
  
  // 尝试从服务器获取真实排行榜
  var serverRank = await apiRequest('/api/user/rank');
  var rankData = defaultRankList;
  
  if (serverRank && serverRank.success && serverRank.rankList && serverRank.rankList.length > 0) {
    rankData = serverRank.rankList.slice(0, 10);
  }
  
  var rankHtml = '';
  for (var i = 0; i < rankData.length; i++) {
    var rankNum = i + 1;
    var rankClass = rankNum <= 3 ? 'rank-item top-rank' : 'rank-item';
    rankHtml += '<div class="' + rankClass + '">' +
      '<span class="rank-num">' + (rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : rankNum) + '</span>' +
      '<span class="rank-name">' + rankData[i].servantName + '</span>' +
      '<span class="rank-value">🪙 ' + rankData[i].totalTributed + '</span>' +
      '</div>';
  }
  
  rankList.innerHTML = myRank + rankHtml;
  
  // 更新我的奉献显示
  var myContribGold = document.getElementById('myContribGold');
  if (myContribGold) {
    myContribGold.textContent = '🪙 ' + state.totalTributed;
  }
}

// ============ 充值功能 ============
function openRecharge() {
  var modal = document.getElementById('rechargeModal');
  if (modal) modal.classList.add('active');
  updateScanPayQR();
}

function closeRecharge() {
  var modal = document.getElementById('rechargeModal');
  if (modal) modal.classList.remove('active');
}

function selectRecharge(amount, element) {
  state.selectedRecharge = amount;
  
  var cards = document.querySelectorAll('.recharge-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove('selected');
  }
  if (element) element.classList.add('selected');
  
  updateRechargeBtnText();
}

function getRechargeGold(amount) {
  var bonus = 0;
  if (amount >= 50) bonus = 5;
  if (amount >= 100) bonus = 15;
  if (amount >= 500) bonus = 100;
  if (amount >= 1000) bonus = 300;
  if (amount >= 5000) bonus = 2000;
  return amount + bonus;
}

function getRechargePrice(amount) {
  return (amount / 10).toFixed(2);
}

function updateRechargeBtnText() {
  var amount = state.selectedRecharge;
  var gold = getRechargeGold(amount);
  var price = getRechargePrice(amount);
  var btnText = document.getElementById('rechargeBtnText');
  if (btnText) {
    btnText.textContent = '奉献 ¥' + price + ' → ' + gold + '金币';
  }
}

function updateScanPayQR() {
  var qrCode = localStorage.getItem('gege_qr_code');
  var scanPayQr = document.getElementById('scanPayQr');
  if (!scanPayQr) return;
  
  if (qrCode) {
    scanPayQr.innerHTML = '<img src="' + qrCode + '" alt="收款码">';
  } else {
    scanPayQr.innerHTML = '<div class="scan-qr-placeholder"><span>格格请先设置<br>收款码</span></div>';
  }
}

// ============ 充值付款功能 ============
var rechargePollingTimer = null;

async function generateRechargeQR() {
  var amount = state.selectedRecharge;
  var price = getRechargePrice(amount);
  var gold = getRechargeGold(amount);
  
  // 检查支付配置
  var config = await checkServerConfig();
  var qrCode = localStorage.getItem('gege_qr_code');
  
  // 显示充值支付弹窗
  var rechargePayModal = document.getElementById('rechargePayModal');
  var rechargePayAmount = document.getElementById('rechargePayAmount');
  var rechargePayGold = document.getElementById('rechargePayGold');
  var rechargePayQr = document.getElementById('rechargePayQr');
  var rechargePayInfo = document.getElementById('rechargePayInfo');
  
  if (rechargePayAmount) rechargePayAmount.textContent = '¥' + price;
  if (rechargePayGold) rechargePayGold.textContent = '获得 ' + gold + ' 金币';
  
  // 显示加载状态
  if (rechargePayQr) {
    rechargePayQr.innerHTML = '<div class="pay-qr-loading"><div class="spinner"></div><p>正在生成付款码...</p></div>';
  }
  
  rechargePayModal.classList.add('active');
  closeRecharge();
  
  // 创建订单（必须传递用户token以便自动到账）
  try {
    var requestBody = {
      amount: price,
      description: '充值' + gold + '金币'
    };
    
    // 如果有用户token，直接在body中也传递一份（双重保险）
    if (state.userToken) {
      requestBody.token = state.userToken;
    }
    
    var result = await apiRequest('/api/order/create', {
      method: 'POST',
      body: requestBody
    });
    
    if (result && result.success) {
      var paymentTypeName = result.paymentTypeName || '支付宝';
      state.currentRechargeOrder = {
        orderNo: result.orderNo,
        amount: result.amount,
        gold: result.goldAmount || gold,
        qrCode: result.qrCode,
        payUrl: result.payUrl || null,
        needRedirect: result.needRedirect || false,
        redirectUrl: result.redirectUrl || null,
        apiOrderNo: result.apiOrderNo || null,
        isAutoVerify: result.isAutoVerify || false,
        username: result.username || null,
        hasUser: result.hasUser || false,
        paymentMode: result.paymentMode || 'manual',
        paymentType: result.paymentType || 'alipay',
        paymentTypeName: paymentTypeName,
        goldAdded: false
      };
      
      console.log('订单创建成功:', result.orderNo, '用户绑定:', result.hasUser ? '是' : '否', '支付模式:', result.paymentMode);
      
      // 如果需要跳转到支付页面
      if (result.needRedirect && result.redirectUrl) {
        var payTypeName = result.paymentTypeName || '支付宝';
        // 检查是否为APP协议链接（如alipay://、alipayqr://）
        var isAppProtocol = result.redirectUrl.indexOf('://') > -1 && 
                           result.redirectUrl.indexOf('http://') !== 0 && 
                           result.redirectUrl.indexOf('https://') !== 0;
        
        if (isAppProtocol && result.qrCode) {
          // APP协议链接：生成二维码图片让用户扫码
          var qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(result.qrCode);
          if (rechargePayQr) {
            rechargePayQr.innerHTML = 
              '<div class="pay-qr-scan-box">' +
                '<img src="' + qrImageUrl + '" alt="支付二维码" style="max-width:220px;max-height:220px;border-radius:12px;border:3px solid #FFD700;background:white;">' +
                '<p class="pay-qr-hint">📱 请使用' + payTypeName + '扫描上方二维码</p>' +
              '</div>';
          }
          
          if (rechargePayInfo) {
            rechargePayInfo.innerHTML = 
              '<p class="pay-info-status">⏳ 请扫码支付 ¥' + price + ' (获得 ' + gold + ' 金币)</p>' +
              '<p class="pay-info-tip">📱 打开手机' + payTypeName + ' → 扫一扫 → 完成支付</p>' +
              '<p class="pay-info-tip">✅ 支付成功后金币将自动到账</p>' +
              '<p class="pay-info-note">💡 提示：支付链接为APP专用，PC端请扫码支付</p>';
          }
          
        } else {
          // 网页链接：同时显示二维码和跳转按钮
          var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          var payLink = result.qrUrl || result.payUrl || result.redirectUrl || '';
          
          if (rechargePayQr) {
            var html = '';
            
            // 显示二维码图片（如果有）
            if (result.qrCode) {
              html += '<img src="' + result.qrCode + '" alt="付款二维码" style="max-width:220px;max-height:220px;border-radius:12px;border:3px solid #FFD700;display:block;margin:0 auto;">';
            }
            
            // 显示跳转按钮
            if (isMobile) {
              html += '<div style="margin-top:15px;"><a href="' + payLink + '" target="_blank" class="pay-redirect-btn" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#5a2d0c;border-radius:25px;text-decoration:none;font-weight:bold;font-size:16px;">📱 点击前往' + payTypeName + '支付 ¥' + price + '</a></div>';
            } else {
              html += '<p style="text-align:center;margin-top:10px;font-size:12px;color:#888;">💡 扫码支付或点击下方按钮跳转</p>';
              html += '<div style="margin-top:10px;"><a href="' + payLink + '" target="_blank" id="payRedirectBtn" style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#5a2d0c;border-radius:20px;text-decoration:none;font-weight:bold;">🔗 前往' + payTypeName + '支付 ¥' + price + '</a></div>';
            }
            
            rechargePayQr.innerHTML = html;
          }
          
          if (rechargePayInfo) {
            var userHintRedirect = result.hasUser 
              ? '<p class="pay-info-tip">✅ 已关联奴才账户，支付成功金币自动到账</p>' 
              : '<p class="pay-info-tip">💡 请先登录以启用自动到账功能</p>';
            
            rechargePayInfo.innerHTML = 
              '<p class="pay-info-status">⏳ ' + (isMobile ? '点击按钮' : '扫码') + '付款 ¥' + price + ' (获得 ' + gold + ' 金币)</p>' +
              userHintRedirect +
              '<p class="pay-info-timer">剩余时间：<span id="rechargePayTimer">30:00</span></p>' +
              '<p class="pay-info-note">📱 支付成功后金币将自动充值到账户</p>';
          }
        }
        
        // 启动轮询检测支付状态
        startRechargePolling();
        
      } else if (result.qrCode) {
        // 显示付款二维码
        if (rechargePayQr) {
          rechargePayQr.innerHTML = '<img src="' + result.qrCode + '" alt="付款二维码" style="max-width:220px;max-height:220px;border-radius:12px;border:3px solid #FFD700;">';
        }
        
        if (rechargePayInfo) {
          var userHint = result.hasUser 
            ? '<p class="pay-info-tip">✅ 已关联奴才账户，支付成功金币自动到账</p>' 
            : '<p class="pay-info-tip">💡 请先登录以启用自动到账功能</p>';
          
          rechargePayInfo.innerHTML = 
            '<p class="pay-info-status">⏳ 请扫码付款 ¥' + price + '</p>' +
            userHint +
            '<p class="pay-info-timer">剩余时间：<span id="rechargePayTimer">30:00</span></p>' +
            '<p class="pay-info-note">📱 支付成功后金币将自动充值到账户</p>';
        }
        
        // 启动高频轮询检测支付状态
        startRechargePolling();
        
      } else {
        // 无二维码也无支付链接
        if (rechargePayQr) {
          rechargePayQr.innerHTML = '<div class="scan-qr-placeholder"><span>无法生成付款码<br>请使用手动模式</span></div>';
        }
        if (rechargePayInfo) {
          rechargePayInfo.innerHTML = '<p class="pay-info-status">❌ 支付方式暂时不可用</p><p class="pay-info-tip">请联系格格客服</p>';
        }
      }
      
    } else {
      console.warn('订单创建失败，降级为手动模式');
      showManualRechargeQR(price, gold, qrCode);
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    showManualRechargeQR(price, gold, qrCode);
    showToast('创建订单失败，请使用手动收款码');
  }
}

function showManualRechargeQR(price, gold, qrCode) {
  var rechargePayQr = document.getElementById('rechargePayQr');
  var rechargePayInfo = document.getElementById('rechargePayInfo');
  
  if (rechargePayQr && qrCode) {
    rechargePayQr.innerHTML = '<img src="' + qrCode + '" alt="收款二维码" style="max-width:220px;max-height:220px;border-radius:12px;border:3px solid #FFD700;">';
  }
  
  if (rechargePayInfo) {
    rechargePayInfo.innerHTML = '<p class="pay-info-status">⏳ 请扫码付款 ¥' + price + '</p>' +
      '<p class="pay-info-tip">支付后点击"已付款"按钮确认到账</p>' +
      '<p class="pay-info-timer">请在24小时内完成付款</p>';
  }
}

function startRechargePolling() {
  if (rechargePollingTimer) {
    clearInterval(rechargePollingTimer);
  }
  
  var remainingSeconds = 30 * 60;
  var pollCount = 0;
  var rechargePayHint = document.getElementById('rechargePayHint');
  
  // 使用新的状态查询接口（更快速、更可靠）
  rechargePollingTimer = setInterval(async function() {
    var timerEl = document.getElementById('rechargePayTimer');
    if (timerEl) {
      var mins = Math.floor(remainingSeconds / 60);
      var secs = remainingSeconds % 60;
      timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    
    remainingSeconds--;
    pollCount++;
    
    if (remainingSeconds <= 0) {
      stopRechargePolling();
      showToast('⏰ 订单已过期，请重新充值');
      closeRechargePay();
      return;
    }
    
    if (state.currentRechargeOrder && state.currentRechargeOrder.orderNo) {
      // 使用优化的状态查询接口（服务器端会主动查询第三方）
      var result = await apiRequest('/api/order/' + state.currentRechargeOrder.orderNo + '/status');
      
      if (result && result.success && result.status === 'paid') {
        console.log('检测到支付成功，金币已到账');
        stopRechargePolling();
        confirmRechargeSuccess();
        return;
      }
      
      // 每20次轮询（约60秒），显示查询提示
      if (pollCount % 20 === 0) {
        if (rechargePayHint) {
          rechargePayHint.textContent = '🔄 正在查询支付状态...';
          rechargePayHint.style.display = 'block';
          setTimeout(function() {
            if (rechargePayHint) rechargePayHint.style.display = 'none';
          }, 2000);
        }
      }
    }
  }, 3000); // 每3秒查询一次
}

function stopRechargePolling() {
  if (rechargePollingTimer) {
    clearInterval(rechargePollingTimer);
    rechargePollingTimer = null;
  }
}

function confirmRechargeSuccess() {
  if (state.currentRechargeOrder && !state.currentRechargeOrder.goldAdded) {
    var gold = state.currentRechargeOrder.gold;
    var orderNo = state.currentRechargeOrder.orderNo;
    
    console.log('确认充值成功：订单', orderNo, '金币', gold);
    
    // 服务器已经通过回调或轮询自动加了金币
    // 这里从服务器同步最新金币（确保不重复计算）
    if (state.userToken) {
      // 从服务器获取最新用户信息
      apiRequest('/api/user/info').then(function(userData) {
        if (userData && userData.success) {
          state.gold = userData.user.gold;
          state.totalTributed = userData.user.totalTributed;
          state.kneelCount = userData.user.kneelCount;
          state.currentUser = {
            username: userData.user.username,
            servantName: userData.user.servantName
          };
          
          // 保存到本地
          localStorage.setItem('gege_local_gold', state.gold.toString());
          localStorage.setItem('gege_local_kneel', state.kneelCount.toString());
          localStorage.setItem('gege_local_total_tributed', state.totalTributed.toString());
          
          updateGoldDisplay();
          updateUserInfoBar();
          updateRankDisplay();
        }
        
        showRechargeSuccessUI(gold);
      }).catch(function() {
        // 如果同步失败，仍然显示成功
        showRechargeSuccessUI(gold);
      });
    } else {
      // 无登录用户，本地加金币（较少使用）
      state.gold += gold;
      saveGold();
      updateGoldDisplay();
      updateUserInfoBar();
      showRechargeSuccessUI(gold);
    }
    
    state.currentRechargeOrder.goldAdded = true;
  }
}

function showRechargeSuccessUI(gold) {
  showToast('🎉 充值成功！获得 ' + gold + ' 金币', 3000);
  
  // 更新金币数字的动画效果
  var goldEl = document.getElementById('goldAmount');
  if (goldEl) {
    goldEl.classList.add('gold-bounce');
    setTimeout(function() {
      goldEl.classList.remove('gold-bounce');
    }, 500);
  }
  
  var rechargePayModal = document.getElementById('rechargePayModal');
  if (rechargePayModal) {
    rechargePayModal.innerHTML = 
      '<div class="recharge-success">' +
        '<div class="success-icon">🎉</div>' +
        '<h2>奉献成功！</h2>' +
        '<p>获得 <span class="success-gold">' + gold + '</span> 金币</p>' +
        '<p class="success-tip">奴才叩谢格格恩典！</p>' +
        '<button class="close-success-btn" onclick="closeRechargePay()">关闭</button>' +
      '</div>';
  }
  
  setTimeout(function() {
    closeRechargePay();
    // 恢复充值弹窗内容
    var modal = document.getElementById('rechargePayModal');
    if (modal) {
      modal.classList.remove('active');
      // 重置内容
      setTimeout(function() {
        var qrEl = document.getElementById('rechargePayQr');
        var infoEl = document.getElementById('rechargePayInfo');
        if (qrEl) qrEl.innerHTML = '';
        if (infoEl) infoEl.innerHTML = '';
      }, 300);
    }
  }, 2000);
}

async function confirmRechargePaid() {
  if (state.currentRechargeOrder && state.currentRechargeOrder.orderNo) {
    // 调用服务器确认支付接口（会自动加金币）
    var result = await apiRequest('/api/order/' + state.currentRechargeOrder.orderNo + '/confirm', {
      method: 'POST'
    });
    
    if (result && result.success) {
      confirmRechargeSuccess();
    } else {
      showToast('确认失败：' + (result ? result.message : '未知错误'));
    }
  } else {
    var amount = state.selectedRecharge;
    var gold = getRechargeGold(amount);
    
    // 手动模式：直接本地加金币
    state.gold += gold;
    saveGold();
    updateGoldDisplay();
    updateUserInfoBar();
    
    // 如果已登录，同步到服务器
    if (state.userToken) {
      syncGoldToServer(gold, '充值获得');
    }
    
    addGegeGold(selectedTributeGege || 1, gold);
    showToast('🎉 奉献成功！获得 ' + gold + ' 金币');
    closeRechargePay();
  }
}

function closeRechargePay() {
  var modal = document.getElementById('rechargePayModal');
  if (modal) modal.classList.remove('active');
  stopRechargePolling();
  state.currentRechargeOrder = null;
}

// 保留旧函数名作为兼容
function confirmRecharge() {
  generateRechargeQR();
}

// ============ 付款验证功能（真实支付版） ============
async function openPaymentVerify() {
  var qrCode = localStorage.getItem('gege_qr_code');
  
  // 检查服务器连接
  var config = await checkServerConfig();
  
  if (!config && !qrCode) {
    showToast('请格格先启动服务器并上传收款码！');
    return;
  }
  
  state.isVerified = false;
  state.paymentProof = null;
  state.currentOrder = null;
  
  // 显示验证弹窗
  var verifyPreview = document.getElementById('verifyPreview');
  var verifyDesc = document.querySelector('.verify-desc');
  var verifyHint = document.querySelector('.verify-hint');
  
  // 根据配置显示不同内容
  if (config && config.paymentMethod === 'api' && config.autoVerify) {
    // API自动验证模式
    if (verifyPreview) {
      verifyPreview.innerHTML = '<div class="verify-auto-checking"><div class="spinner"></div><p>正在创建支付订单...</p></div>';
    }
    if (verifyDesc) verifyDesc.textContent = '🔄 自动验证模式';
    if (verifyHint) verifyHint.textContent = '扫码付款后，系统将自动验证付款状态';
    
    // 创建订单
    await createOrder(config);
  } else {
    // 手动验证模式
    if (verifyPreview) {
      verifyPreview.innerHTML = '<span class="verify-upload-text">📤 点击上传付款截图</span>';
    }
    if (verifyDesc) verifyDesc.textContent = '请上传您的付款凭证截图';
    if (verifyHint) verifyHint.textContent = '奴才为格格奉献，天经地义';
    
    // 显示收款码
    updateVerifyQRCode();
  }
  
  // 重置口令输入
  var verifyPassword = document.getElementById('verifyPassword');
  if (verifyPassword) verifyPassword.value = '';
  
  var modal = document.getElementById('paymentVerifyModal');
  if (modal) modal.classList.add('active');
}

function updateVerifyQRCode() {
  var qrCode = localStorage.getItem('gege_qr_code');
  if (!qrCode) return;
  
  var verifyPreview = document.getElementById('verifyPreview');
  if (!verifyPreview) return;
  
  // 添加收款码显示区域
  var qrArea = document.createElement('div');
  qrArea.className = 'verify-qr-area';
  qrArea.innerHTML = '<div class="verify-qr-title">📱 请扫码付款</div>' +
    '<div class="verify-qr-img"><img src="' + qrCode + '" alt="收款码"></div>' +
    '<p class="verify-qr-hint">扫码后请上传付款截图</p>';
  
  verifyPreview.parentNode.insertBefore(qrArea, verifyPreview);
}

async function createOrder(config) {
  var modal = document.getElementById('paymentVerifyModal');
  var verifyPreview = document.getElementById('verifyPreview');
  
  try {
    var result = await apiRequest('/api/order/create', {
      method: 'POST',
      body: {
        amount: state.selectedPrice,
        description: '觐见奉献'
      }
    });
    
    if (!result || !result.success) {
      showToast('创建订单失败，请使用手动验证模式');
      return;
    }
    
    state.currentOrder = {
      orderNo: result.orderNo,
      amount: result.amount,
      qrCode: result.qrCode,
      apiOrderNo: result.apiOrderNo || null,
      isAutoVerify: result.isAutoVerify || false
    };
    
    // 显示订单信息和收款码
    if (verifyPreview) {
      var qrHtml = result.qrCode 
        ? '<img src="' + result.qrCode + '" alt="收款码" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid var(--gold);">' 
        : '<span class="verify-upload-text">📤 请使用格格提供的收款码扫码</span>';
      
      var autoHint = result.isAutoVerify 
        ? '<p>⏳ 系统正在自动验证付款状态...</p>' 
        : '<p>⏳ 正在等待付款...</p>';
      
      verifyPreview.innerHTML = 
        '<div class="verify-order-info">' +
          '<div class="order-amount">奉献金额：¥' + result.amount.toFixed(2) + '</div>' +
          '<div class="order-no">订单号：' + result.orderNo.substring(-8) + '</div>' +
        '</div>' +
        '<div class="verify-qr-display">' + qrHtml + '</div>' +
        '<div class="verify-auto-hint">' +
          autoHint +
          '<p class="verify-timer" id="verifyTimer">30:00</p>' +
        '</div>' +
        '<div class="verify-polling-hint" id="verifyPollingHint" style="display:none;color:#FFA500;font-size:12px;margin-top:10px;">' +
          '🔄 正在主动查询支付状态...' +
        '</div>';
    }
    
    // 开始轮询订单状态
    startPaymentPolling();
    
  } catch (error) {
    console.error('创建订单失败:', error);
    showToast('网络错误，请使用手动验证模式');
  }
}

function startPaymentPolling() {
  if (state.paymentPollingTimer) {
    clearInterval(state.paymentPollingTimer);
  }
  
  var remainingSeconds = 30 * 60; // 30分钟
  var pollCount = 0;
  
  state.paymentPollingTimer = setInterval(async function() {
    // 更新倒计时
    var timerEl = document.getElementById('verifyTimer');
    if (timerEl) {
      var mins = Math.floor(remainingSeconds / 60);
      var secs = remainingSeconds % 60;
      timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    
    remainingSeconds--;
    pollCount++;
    
    if (remainingSeconds <= 0) {
      stopPaymentPolling();
      showToast('⏰ 订单已过期，请重新创建');
      return;
    }
    
    // 查询订单状态
    if (state.currentOrder && state.currentOrder.orderNo) {
      var result = await apiRequest('/api/order/' + state.currentOrder.orderNo);
      
      if (result && result.success && result.status === 'paid') {
        stopPaymentPolling();
        confirmAutoPayment();
        return;
      }
      
      // 每10次轮询（约30秒），主动调用兜底查询
      if (pollCount % 10 === 0 && state.currentOrder.apiOrderNo) {
        var pollingHint = document.getElementById('verifyPollingHint');
        if (pollingHint) pollingHint.style.display = 'block';
        
        var pollResult = await apiRequest('/api/order/' + state.currentOrder.orderNo + '/poll', {
          method: 'POST'
        });
        
        if (pollingHint) pollingHint.style.display = 'none';
        
        if (pollResult && pollResult.success && pollResult.status === 'paid') {
          stopPaymentPolling();
          confirmAutoPayment();
        }
      }
    }
  }, 3000); // 每3秒查询一次
}

function stopPaymentPolling() {
  if (state.paymentPollingTimer) {
    clearInterval(state.paymentPollingTimer);
    state.paymentPollingTimer = null;
  }
}

function confirmAutoPayment() {
  state.isVerified = true;
  
  // 确认订单
  if (state.currentOrder) {
    apiRequest('/api/order/' + state.currentOrder.orderNo + '/confirm', {
      method: 'POST'
    });
  }
  
  showToast('✅ 付款验证成功！奴才可以觐见格格了！');
  closePaymentVerify();
  
  setTimeout(function() {
    enterPalace();
  }, 500);
}

function closePaymentVerify() {
  stopPaymentPolling();
  
  var modal = document.getElementById('paymentVerifyModal');
  if (modal) modal.classList.remove('active');
  
  // 清理收款码显示
  var qrArea = document.querySelector('.verify-qr-area');
  if (qrArea) qrArea.remove();
  
  var qrDisplay = document.querySelector('.verify-qr-display');
  if (qrDisplay) qrDisplay.remove();
}

var verifyInput = document.getElementById('verifyInput');
if (verifyInput) {
  verifyInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(event) {
      var dataUrl = event.target.result;
      state.paymentProof = dataUrl;
      
      var preview = document.getElementById('verifyPreview');
      if (preview && !preview.querySelector('.verify-qr-area')) {
        preview.innerHTML = '<img src="' + dataUrl + '" alt="付款凭证" style="max-width:100%;max-height:150px;border-radius:8px;">';
      }
      
      showToast('付款截图已上传，请等待验证');
    };
    reader.readAsDataURL(file);
  });
}

async function submitPaymentVerify() {
  var verifyPassword = document.getElementById('verifyPassword');
  var inputPassword = verifyPassword ? verifyPassword.value.trim() : '';
  
  // 如果设置了口令，需要验证
  if (state.verifyEnabled && state.verifyPassword) {
    if (!inputPassword) {
      showToast('请输入奉献口令！');
      return;
    }
    if (inputPassword !== state.verifyPassword) {
      showToast('口令错误！奴才无法觐见！');
      return;
    }
  }
  
  // 如果开启了验证模式，需要上传截图
  if (state.verifyEnabled && !state.paymentProof) {
    showToast('请上传付款凭证截图！');
    return;
  }
  
  // 如果有当前订单，确认支付
  if (state.currentOrder && state.currentOrder.orderNo) {
    var result = await apiRequest('/api/order/' + state.currentOrder.orderNo + '/confirm', {
      method: 'POST'
    });
    if (result && result.success) {
      state.isVerified = true;
      showToast('✅ 奉献验证成功！奴才可以觐见格格了！');
      closePaymentVerify();
      setTimeout(function() {
        enterPalace();
      }, 500);
      return;
    }
  }
  
  // 手动模式：直接通过
  state.isVerified = true;
  showToast('✅ 奉献验证成功！奴才可以觐见格格了！');
  closePaymentVerify();
  
  setTimeout(function() {
    enterPalace();
  }, 500);
}

function toggleVerifyMode() {
  state.verifyEnabled = !state.verifyEnabled;
  if (state.verifyEnabled) {
    showToast('🔒 奉献验证已开启，奴才需验证方可进入');
  } else {
    showToast('🔓 奉献验证已关闭，奴才可自由进入');
  }
}

// ============ 管理员登录/登出 ============
function showAdminLogin() {
  var modal = document.getElementById('adminLoginModal');
  if (modal) modal.classList.add('active');
}

function closeAdminLogin() {
  var modal = document.getElementById('adminLoginModal');
  if (modal) modal.classList.remove('active');
}

function adminLogin() {
  var password = document.getElementById('adminPassword').value;
  if (password === 'gege123') {
    state.isAdmin = true;
    closeAdminLogin();
    
    var adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.style.display = 'flex';
    
    var adminUploadBig = document.getElementById('adminUploadBig');
    if (adminUploadBig) adminUploadBig.style.display = 'block';
    
    showToast('格格驾到！控制殿已开启');
    document.getElementById('adminPassword').value = '';
  } else {
    showToast('口令错误，无法进入！');
  }
}

function logoutAdmin() {
  state.isAdmin = false;
  
  var adminPanel = document.getElementById('adminPanel');
  if (adminPanel) adminPanel.style.display = 'none';
  
  var adminUploadBig = document.getElementById('adminUploadBig');
  if (adminUploadBig) adminUploadBig.style.display = 'none';
  
  showToast('已退出控制殿');
}

// ============ 页面切换 ============
function showPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) {
    pages[i].classList.remove('active');
  }
  document.getElementById(pageId).classList.add('active');
  window.scrollTo(0, 0);
  
  updateTrainingQuickBtn();
  
  // BGM自动播放逻辑
  var bgmPlayer = document.getElementById('bgmPlayer');
  if (bgmPlayer && state.bgmData && pageId === 'page-palace') {
    if (!state.isPlaying) {
      var tryPlay = function() {
        if (bgmPlayer && !state.isPlaying) {
          bgmPlayer.play().then(function() {
            state.isPlaying = true;
            var bgmIcon = document.getElementById('bgmIcon');
            if (bgmIcon) bgmIcon.textContent = '🎶';
          }).catch(function() {
            // 自动播放被阻止，等待用户交互
            var handler = function() {
              if (bgmPlayer && !state.isPlaying) {
                bgmPlayer.play().then(function() {
                  state.isPlaying = true;
                  var bgmIcon = document.getElementById('bgmIcon');
                  if (bgmIcon) bgmIcon.textContent = '🎶';
                }).catch(function() {});
              }
              document.removeEventListener('touchstart', handler);
              document.removeEventListener('click', handler);
            };
            document.addEventListener('touchstart', handler, { once: true, passive: true });
            document.addEventListener('click', handler, { once: true });
          });
        }
      };
      setTimeout(tryPlay, 800);
    }
  }
}

// ============ 宫殿大门交互 ============
var gateLeft = document.getElementById('gateLeft');
var gateRight = document.getElementById('gateRight');
var enterHint = document.getElementById('enterHint');
var gateWrapper = document.querySelector('.gate-wrapper');

function openGate() {
  gateLeft.classList.add('opening');
  gateRight.classList.add('opening');
  enterHint.style.display = 'none';
  
  setTimeout(function() {
    showToast('宫门开启 · 奴才觐见中...');
    showPage('page-palace');
    loadGegeMedia();
    loadGold();
    if (state.isAdmin) {
      var adminPanel = document.getElementById('adminPanel');
      if (adminPanel) adminPanel.style.display = 'flex';
    }
  }, 1500);
}

if (gateLeft) gateLeft.addEventListener('click', openGate);
if (gateRight) gateRight.addEventListener('click', openGate);
if (enterHint) enterHint.addEventListener('click', openGate);
if (gateWrapper) gateWrapper.addEventListener('click', function(e) {
  openGate();
});

// ============ 付款页面 ============
function updatePaymentDisplay() {
  var qrCode = localStorage.getItem('gege_qr_code');
  var qrCodeEl = document.getElementById('qrCode');
  
  if (qrCode && qrCodeEl) {
    qrCodeEl.innerHTML = '<img src="' + qrCode + '" alt="收款码">';
  }
}

var priceCards = document.querySelectorAll('.price-card');
for (var i = 0; i < priceCards.length; i++) {
  priceCards[i].addEventListener('click', function() {
    for (var j = 0; j < priceCards.length; j++) {
      priceCards[j].classList.remove('selected');
    }
    this.classList.add('selected');
    state.selectedPrice = parseFloat(this.getAttribute('data-price'));
  });
}

function goBack() {
  showPage('page-gate');
  gateLeft.classList.remove('opening');
  gateRight.classList.remove('opening');
  enterHint.style.display = 'block';
  
  var adminUploadBig = document.getElementById('adminUploadBig');
  if (adminUploadBig) adminUploadBig.style.display = 'none';
}

function enterPalace() {
  showToast('觐见成功！愿格格千岁千岁千千岁！');
  setTimeout(function() {
    showPage('page-palace');
    loadGegeMedia();
    loadGold();
    if (state.isAdmin) {
      var adminPanel = document.getElementById('adminPanel');
      if (adminPanel) adminPanel.style.display = 'flex';
    }
  }, 500);
}

// ============ 叩拜功能 ============
function kneelToGege() {
  state.kneelCount++;
  var countEl = document.getElementById('kneelCount');
  if (countEl) countEl.textContent = state.kneelCount;
  updateUserInfoBar();
  
  // 同步叩拜次数到服务器
  syncKneelToServer();
  
  var messages = [
    '格格千岁千岁千千岁！',
    '奴才给格格请安了！',
    '格格吉祥！',
    '格格万福金安！',
    '愿格格福寿安康！',
    '奴才对格格忠心耿耿！',
    '格格乃天命所归！',
    '奴才叩见格格！',
    '格格真乃天仙下凡！',
    '爱新觉罗血脉万岁！',
    '奴才愿为格格赴汤蹈火！',
    '格格的恩典奴才铭记于心！',
    '愿格格永葆青春美丽！',
    '格格千岁！奴才来迟！',
    '奴才愿生生世世侍奉格格！'
  ];
  
  var msg = messages[Math.floor(Math.random() * messages.length)];
  showKneelEffect(msg);
  
  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50]);
  }
}

function showKneelEffect(message) {
  var effect = document.getElementById('effectLayer');
  if (!effect) return;
  
  var item = document.createElement('div');
  item.className = 'kneel-effect-item';
  item.textContent = message;
  
  var x = 20 + Math.random() * 60;
  var y = 30 + Math.random() * 20;
  item.style.left = x + '%';
  item.style.top = y + '%';
  
  effect.appendChild(item);
  
  setTimeout(function() {
    if (item.parentNode) item.parentNode.removeChild(item);
  }, 2500);
}

// ============ 奉献系统 ============
var tributeItems = [
  { type: 'gold',         emoji: '💰', name: '血汗',     cost: 100,  msg: '奴才卖命赚的血汗钱，全部献给格格！' },
  { type: 'work',         emoji: '💼', name: '打工费',   cost: 50,   msg: '奴才辛苦打工所得，求格格赏收！' },
  { type: 'ring',         emoji: '💍', name: '钻戒',     cost: 520,  msg: '奴才的订婚戒指，献给格格赎罪！' },
  { type: 'dragon',       emoji: '🐉', name: '月薪',     cost: 1000, msg: '奴才一月俸禄，全数孝敬格格！' },
  { type: 'loan',         emoji: '🏦', name: '贷款',     cost: 2000, msg: '奴才贷款奉上，愿为格格负债！' },
  { type: 'palace',       emoji: '🏯', name: '府邸',     cost: 9999, msg: '奴才献上府邸，求格格收留！' },
  { type: 'dragonThrone', emoji: '🐲', name: '龙椅',     cost: 52000,msg: '奴才献上一切！生为奴，死为鬼！' },
  { type: 'everything',   emoji: '💀', name: '倾家荡产', cost: 99999,msg: '奴才倾家荡产，只求格格垂怜！' }
];

// 当前选中的奉献格格
var selectedTributeGege = 1;

// 选择奉献给哪位格格
function selectTributeGege(gegeId, btn) {
  selectedTributeGege = gegeId;
  
  // 更新旧版选择器按钮
  var oldButtons = document.querySelectorAll('.gege-selector-btn');
  oldButtons.forEach(function(b) { b.classList.remove('active'); });
  
  // 更新新版相册下的上贡按钮
  var newButtons = document.querySelectorAll('.tribute-target-btn');
  newButtons.forEach(function(b) { b.classList.remove('active'); });
  
  // 激活当前按钮
  if (btn) btn.classList.add('active');
  
  // 同步激活对应的所有按钮
  var oldBtn = document.querySelector('.gege-selector-btn[onclick*="' + gegeId + '"]');
  if (oldBtn) oldBtn.classList.add('active');
  var newBtn = document.getElementById('tributeBtn' + gegeId);
  if (newBtn && newBtn !== btn) newBtn.classList.add('active');
  
  // 保存选择
  localStorage.setItem('gege_selected_tribute', gegeId);
  
  var gegeName = GEGE_NAMES[gegeId];
  showToast('将奉献给：' + gegeName);
}

// 恢复上次选择的格格
function restoreTributeGege() {
  var saved = localStorage.getItem('gege_selected_tribute');
  if (saved) {
    var gegeId = parseInt(saved);
    selectedTributeGege = gegeId;
    
    // 更新旧版按钮
    var oldButtons = document.querySelectorAll('.gege-selector-btn');
    if (oldButtons[gegeId - 1]) oldButtons[gegeId - 1].classList.add('active');
    
    // 更新新版按钮
    var newBtn = document.getElementById('tributeBtn' + gegeId);
    if (newBtn) newBtn.classList.add('active');
  }
}

function renderTributeGrid() {
  var grid = document.getElementById('tributeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (var i = 0; i < tributeItems.length; i++) {
    var item = tributeItems[i];
    var card = document.createElement('div');
    card.className = 'tribute-card';
    card.setAttribute('data-cost', item.cost);
    card.setAttribute('data-type', item.type);
    card.onclick = (function(t) { return function() { offerTribute(t.type); }; })(item);
    
    card.innerHTML = '<div class="trib-icon">' + item.emoji + '</div>' +
      '<span class="trib-name">' + item.name + '</span>' +
      '<span class="trib-cost">🪙' + item.cost + '</span>' +
      '<span class="trib-action">献上</span>';
    
    grid.appendChild(card);
  }
}

function offerTribute(type) {
  var item = null;
  for (var i = 0; i < tributeItems.length; i++) {
    if (tributeItems[i].type === type) { item = tributeItems[i]; break; }
  }
  if (!item) return;
  
  var cost = item.cost;
  
  if (cost > 0 && state.gold < cost) {
    showToast('金币不够！奴才还需多多干活献上！');
    var goldDisplay = document.getElementById('goldAmount');
    if (goldDisplay) {
      goldDisplay.parentElement.classList.add('gold-shake');
      setTimeout(function() {
        goldDisplay.parentElement.classList.remove('gold-shake');
      }, 500);
    }
    return;
  }
  
  if (cost > 0) {
    state.gold -= cost;
    saveGold();
    updateGoldDisplay();
    updateUserInfoBar();
    
    state.totalTributed += cost;
    saveTotalTributed();
    updateRankDisplay();
    
    // 给选中的格格增加金币
    addGegeGold(selectedTributeGege, cost);
    
    // 同步到服务器 - 奉献
    syncGoldToServer(-cost, '奉献' + item.name);
  }
  
  // 同步奉献记录到服务器
  if (state.userToken && cost > 0) {
    apiRequest('/api/user/tribute', {
      method: 'POST',
      body: { type: type, cost: cost, name: item.name, gegeId: selectedTributeGege }
    });
  }
  
  var isBig = item.rank >= 3;
  if (isBig) {
    showBigTributeEffect(item.emoji, item.name, cost);
  } else {
    showTributeEffect(item.emoji, cost);
  }
  
  showToast('✅ 奉献给 ' + GEGE_NAMES[selectedTributeGege] + '：' + item.msg, 3000);
}

function showTributeEffect(emoji, cost) {
  var effect = document.getElementById('effectLayer');
  if (!effect) return;
  
  var item = document.createElement('div');
  item.className = 'tribute-float';
  item.textContent = emoji;
  item.style.left = (40 + Math.random() * 20) + '%';
  item.style.bottom = '25%';
  effect.appendChild(item);
  
  var coin = document.createElement('div');
  coin.className = 'kneel-effect-item';
  coin.textContent = '🪙 -' + cost;
  coin.style.color = '#FF4500';
  coin.style.fontSize = '24px';
  coin.style.fontWeight = 'bold';
  coin.style.textShadow = '0 0 15px rgba(255,69,0,0.8)';
  coin.style.left = '50%';
  coin.style.top = '55%';
  effect.appendChild(coin);
  
  var sparkles = ['✨', '🌟', '💫', '⭐', '💎'];
  for (var i = 0; i < 6; i++) {
    (function(idx) {
      setTimeout(function() {
        var sparkle = document.createElement('div');
        sparkle.className = 'kneel-effect-item';
        sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
        sparkle.style.left = (30 + Math.random() * 40) + '%';
        sparkle.style.top = (25 + Math.random() * 25) + '%';
        sparkle.style.fontSize = (18 + Math.random() * 12) + 'px';
        effect.appendChild(sparkle);
        setTimeout(function() {
          if (sparkle.parentNode) sparkle.parentNode.removeChild(sparkle);
        }, 2000);
      }, idx * 80);
    })(i);
  }
  
  setTimeout(function() {
    if (item.parentNode) item.parentNode.removeChild(item);
    if (coin.parentNode) coin.parentNode.removeChild(coin);
  }, 2500);
}

function showBigTributeEffect(emoji, name, cost) {
  var effect = document.getElementById('effectLayer');
  if (!effect) return;
  
  var bigItem = document.createElement('div');
  bigItem.className = 'tribute-big-effect';
  bigItem.textContent = emoji;
  bigItem.style.left = '50%';
  bigItem.style.top = '35%';
  bigItem.style.transform = 'translate(-50%, -50%)';
  effect.appendChild(bigItem);
  
  var label = document.createElement('div');
  label.className = 'kneel-effect-item';
  label.textContent = '奉献 ' + name + '！🪙' + cost;
  label.style.color = '#FF4500';
  label.style.fontSize = '32px';
  label.style.fontWeight = 'bold';
  label.style.textShadow = '0 0 20px rgba(255,69,0,0.8), 0 0 40px rgba(255,215,0,0.5)';
  label.style.left = '50%';
  label.style.top = '50%';
  label.style.transform = 'translate(-50%, -50%)';
  effect.appendChild(label);
  
  var subLabel = document.createElement('div');
  subLabel.className = 'kneel-effect-item';
  subLabel.textContent = '🎉 奴才献上 ' + cost + ' 金币！';
  subLabel.style.color = '#FFD700';
  subLabel.style.fontSize = '20px';
  subLabel.style.textShadow = '0 0 15px rgba(255,215,0,0.8)';
  subLabel.style.left = '50%';
  subLabel.style.top = '62%';
  subLabel.style.transform = 'translate(-50%, -50%)';
  effect.appendChild(subLabel);
  
  var emojis = ['✨', '🌟', '💫', '💎', '👑', '🏆', '⚡', '🎊', '🎉', '💐'];
  for (var i = 0; i < 30; i++) {
    (function(idx) {
      setTimeout(function() {
        var sparkle = document.createElement('div');
        sparkle.className = 'kneel-effect-item';
        sparkle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        sparkle.style.left = (5 + Math.random() * 90) + '%';
        sparkle.style.top = (5 + Math.random() * 70) + '%';
        sparkle.style.fontSize = (15 + Math.random() * 30) + 'px';
        effect.appendChild(sparkle);
        setTimeout(function() {
          if (sparkle.parentNode) sparkle.parentNode.removeChild(sparkle);
        }, 2500);
      }, idx * 50);
    })(i);
  }
  
  setTimeout(function() {
    if (bigItem.parentNode) bigItem.parentNode.removeChild(bigItem);
    if (label.parentNode) label.parentNode.removeChild(label);
    if (subLabel.parentNode) subLabel.parentNode.removeChild(subLabel);
  }, 2500);
}

// ============ 格格影像管理 ============
function loadGegeMedia() {
  var mediaData = localStorage.getItem('gege_media');
  var mediaType = localStorage.getItem('gege_media_type');
  var title = localStorage.getItem('gege_title');
  var qrCode = localStorage.getItem('gege_qr_code');
  
  if (mediaData && mediaType) {
    var display = document.getElementById('gegeDisplay');
    if (display) {
      display.innerHTML = '';
      
      if (mediaType === 'video') {
        var video = document.createElement('video');
        video.src = mediaData;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        display.appendChild(video);
      } else {
        var img = document.createElement('img');
        img.src = mediaData;
        img.alt = '格格';
        display.appendChild(img);
      }
    }
  }
  
  var nameEl = document.querySelector('.gege-name');
  if (title && nameEl) nameEl.textContent = title;
  
  if (qrCode) {
    var qrCodeEl = document.getElementById('qrCode');
    if (qrCodeEl) {
      qrCodeEl.innerHTML = '<img src="' + qrCode + '" alt="微信收款码">';
    }
  }
}

// ============ 上传功能 ============
function uploadMedia() {
  var input = document.getElementById('mediaInput');
  if (input) input.click();
}

function uploadQRCode() {
  var input = document.getElementById('qrInput');
  if (input) input.click();
}

function uploadMediaFromPage() {
  var input = document.getElementById('mediaInput');
  if (input) input.click();
}

// 格格照片配置
var GEGE_NAMES = {
  1: '瓜尔佳格格',
  2: '爱新觉罗璇格格',
  3: '爱新觉罗凌霜格格'
};

// 切换格格Tab（控制殿内）
function switchGegeTab(gegeId, btn) {
  currentGegeTab = gegeId;
  state.currentGegeTab = gegeId;
  
  var tabs = document.querySelectorAll('.gege-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  
  var preview = document.getElementById('gegeUploadPreview');
  var count = state.gegePhotos[gegeId] ? state.gegePhotos[gegeId].length : 0;
  var countEl = document.getElementById('gegeUploadCount');
  if (countEl) countEl.textContent = count;
  
  if (preview && count > 0) {
    var firstPhoto = state.gegePhotos[gegeId][0];
    preview.innerHTML = '<img src="' + firstPhoto.url + '" style="max-width:100%;max-height:150px;">';
  } else if (preview) {
    preview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">🖼</span><span>点击上传圣容（支持多张，最多50张）</span></div>';
  }
  
  // 渲染照片列表
  renderGegePhotoList(gegeId);
}

// 兼容旧函数名 - 打开设置弹窗
function uploadPhotoWall() {
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  openSettings();
}

// 从控制殿菜单上传
function showGegeUploadMenu() {
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  openSettings();
}

// 上传格格照片（支持多张）
function uploadGegePhotos(gegeId) {
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  
  if (gegeId === undefined || gegeId === null) {
    gegeId = currentGegeTab;
  }
  
  var inputId = 'gege' + gegeId + 'Input';
  var input = document.getElementById(inputId);
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.id = inputId;
  }
  input.value = '';
  input.click();
}

// 绑定格格照片上传事件（在初始化时调用）
function bindGegeUploadInputs() {
  for (var g = 1; g <= 3; g++) {
    (function(gegeId) {
      var input = document.getElementById('gege' + gegeId + 'Input');
      if (!input) return;
      
      input.addEventListener('change', function(e) {
        var files = Array.from(e.target.files);
        if (!files || files.length === 0) return;
        
        var remaining = Math.max(0, 50 - state.gegePhotos[gegeId].length);
        var toUpload = files.slice(0, remaining);
        
        if (files.length > remaining) {
          showToast(GEGE_NAMES[gegeId] + '：最多50张，已截取前' + remaining + '张');
        }
        
        // 先预览再确认
        var processed = 0;
        var previews = [];
        
        function processForPreview(file) {
          var reader = new FileReader();
          reader.onload = function(event) {
            previews.push({
              url: event.target.result,
              name: file.name
            });
            processed++;
            if (processed < toUpload.length) {
              processForPreview(toUpload[processed]);
            } else {
              // 所有文件读取完成，显示确认界面
              showUploadConfirmDialog(gegeId, previews);
            }
          };
          reader.readAsDataURL(file);
        }
        
        processForPreview(toUpload[0]);
      });
    })(g);
  }
}

// 显示上传确认对话框
function showUploadConfirmDialog(gegeId, photos) {
  var isMobile = window.innerWidth <= 768;
  var columns = isMobile ? 2 : 4;
  
  var html = '<div style="max-height:' + (isMobile ? '50vh' : '400px') + ';overflow-y:auto;margin:15px 0;">';
  html += '<div style="display:grid;grid-template-columns:repeat(' + columns + ',1fr);gap:10px;">';
  
  for (var i = 0; i < photos.length; i++) {
    html += '<div style="position:relative;aspect-ratio:3/4;border:2px solid #FFD700;border-radius:8px;overflow:hidden;">';
    html += '<img src="' + photos[i].url + '" style="width:100%;height:100%;object-fit:cover;">';
    html += '<span style="position:absolute;bottom:5px;right:5px;background:rgba(139,0,0,0.8);color:#FFD700;font-size:10px;padding:2px 6px;border-radius:10px;">' + (i + 1) + '</span>';
    html += '</div>';
  }
  
  html += '</div></div>';
  html += '<p style="color:#FFD700;text-align:center;margin:15px 0;font-size:' + (isMobile ? '14px' : '16px') + ';">📸 预览 ' + photos.length + ' 张圣容，确认上传？</p>';
  html += '<div style="display:flex;gap:10px;margin-top:15px;">';
  html += '<button class="btn-cancel" onclick="cancelUploadConfirm(this)" style="flex:1;padding:12px;font-size:' + (isMobile ? '14px' : '16px') + ';">取消</button>';
  html += '<button class="save-btn big" onclick="confirmGegeUpload(' + gegeId + ')" style="flex:1;padding:12px;font-size:' + (isMobile ? '14px' : '16px') + ';">✅ 确认上传</button>';
  html += '</div>';
  
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  modal.innerHTML = '<div class="modal-content" style="max-width:' + (isMobile ? '95vw' : '500px') + ';padding:' + (isMobile ? '15px' : '25px') + ';">' +
    '<span style="position:sticky;top:0;float:right;color:#fff;cursor:pointer;font-size:24px;z-index:10;" onclick="this.closest(\'.modal-overlay\').remove()">×</span>' +
    '<h3 style="color:#FFD700;margin:10px 0;text-align:center;font-size:' + (isMobile ? '16px' : '20px') + ';">👑 ' + GEGE_NAMES[gegeId] + ' 圣容上传</h3>' +
    html +
  '</div>';
  
  // 存储待确认的照片数据
  window._pendingUpload = { gegeId: gegeId, photos: photos };
  
  modal.onclick = function(e) { 
    if (e.target === modal) {
      modal.remove();
      window._pendingUpload = null;
    }
  };
  
  document.body.appendChild(modal);
}

// 取消上传确认
function cancelUploadConfirm(btn) {
  var modal = btn.closest('.modal-overlay');
  if (modal) modal.remove();
  window._pendingUpload = null;
  showToast('已取消上传');
}

// 确认上传格格照片
function confirmGegeUpload(gegeId) {
  if (!window._pendingUpload || window._pendingUpload.gegeId !== gegeId) {
    showToast('上传数据已失效，请重新选择');
    return;
  }
  
  var photos = window._pendingUpload.photos;
  state.gegePhotos[gegeId] = state.gegePhotos[gegeId].concat(photos);
  saveGegePhotos(gegeId);
  startGegeScrollAnimation(gegeId);
  renderGegeWall(gegeId);
  renderGegePhotoList(gegeId);
  
  var countEl = document.getElementById('gegeUploadCount');
  if (countEl) countEl.textContent = state.gegePhotos[gegeId].length;
  
  // 关闭确认对话框
  var modals = document.querySelectorAll('.modal-overlay');
  for (var m = 0; m < modals.length; m++) modals[m].remove();
  window._pendingUpload = null;
  
  showToast(GEGE_NAMES[gegeId] + '圣容上传成功！共' + state.gegePhotos[gegeId].length + '张');
}

// ============ 手机端相册Tab切换 ============
var MOBILE_WALL_KEY = 'gege_mobile_wall';

function switchMobileWall(gegeId) {
  // 更新所有wall的active状态
  for (var i = 1; i <= 3; i++) {
    var wall = document.getElementById('gegeWall' + i);
    if (wall) {
      if (i === gegeId) {
        wall.classList.add('active-wall');
      } else {
        wall.classList.remove('active-wall');
      }
    }
  }
  // 更新tab按钮active状态
  var tabs = document.querySelectorAll('.gege-mobile-tab');
  if (tabs) {
    for (var t = 0; t < tabs.length; t++) {
      var tabId = parseInt(tabs[t].getAttribute('data-gege-id') || '0');
      // 检查tab文本对应的格格
      if (tabId === gegeId) {
        tabs[t].classList.add('active');
      } else {
        tabs[t].classList.remove('active');
      }
    }
  }
  // 更可靠的方式：按index更新
  var mobileTabs = document.getElementById('gegeMobileTabs');
  if (mobileTabs) {
    var btns = mobileTabs.querySelectorAll('.gege-mobile-tab');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.remove('active');
    }
    if (btns[gegeId - 1]) {
      btns[gegeId - 1].classList.add('active');
    }
  }
  
  // 同步控制殿中的tab
  if (typeof switchGegeTab === 'function') {
    var adminTabs = document.querySelectorAll('.gege-upload-tabs .gege-tab');
    for (var a = 0; a < adminTabs.length; a++) adminTabs[a].classList.remove('active');
    if (adminTabs[gegeId - 1]) adminTabs[gegeId - 1].classList.add('active');
    currentGegeTab = gegeId;
    if (typeof renderGegePhotoList === 'function') {
      renderGegePhotoList(gegeId);
    }
  }
  
  try { localStorage.setItem(MOBILE_WALL_KEY, gegeId); } catch(e) {}
}

function initMobileWall() {
  var savedId = 1;
  try {
    var v = localStorage.getItem(MOBILE_WALL_KEY);
    if (v) savedId = parseInt(v) || 1;
  } catch(e) {}
  
  // 初始化只有当前wall可见（手机端）
  for (var i = 1; i <= 3; i++) {
    var wall = document.getElementById('gegeWall' + i);
    if (wall) {
      if (i === savedId) wall.classList.add('active-wall');
      else wall.classList.remove('active-wall');
    }
  }
  
  // 更新tab按钮active
  var mobileTabs = document.getElementById('gegeMobileTabs');
  if (mobileTabs) {
    var btns = mobileTabs.querySelectorAll('.gege-mobile-tab');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.remove('active');
      if (b === savedId - 1) btns[b].classList.add('active');
    }
  }
  
  currentGegeTab = savedId;
  // 监听resize，如果从桌面变成手机，重新初始化可见wall
  window.addEventListener('resize', function() {
    var isMobile = window.innerWidth <= 768;
    if (isMobile) {
      // 只保留当前wall可见
      for (var i = 1; i <= 3; i++) {
        var wall = document.getElementById('gegeWall' + i);
        if (!wall) continue;
        if (i === currentGegeTab) wall.classList.add('active-wall');
        else wall.classList.remove('active-wall');
      }
    } else {
      // 桌面端：取消active-wall限制，让所有wall都显示
      for (var j = 1; j <= 3; j++) {
        var w = document.getElementById('gegeWall' + j);
        if (w) w.classList.remove('active-wall');
      }
    }
  });
}

// 保存格格照片到localStorage
function saveGegePhotos(gegeId) {
  localStorage.setItem('gege_photos_' + gegeId, JSON.stringify(state.gegePhotos[gegeId]));
}

// 加载格格照片
function loadGegePhotos(gegeId) {
  var saved = localStorage.getItem('gege_photos_' + gegeId);
  if (saved) {
    try {
      state.gegePhotos[gegeId] = JSON.parse(saved);
    } catch(e) {
      state.gegePhotos[gegeId] = [];
    }
  }
  
  var goldSaved = localStorage.getItem('gege_gold_' + gegeId);
  if (goldSaved) {
    state.gegeGold[gegeId] = parseInt(goldSaved) || 0;
  }
}

// 渲染单个格格的照片墙
function renderGegeWall(gegeId) {
  var photos = state.gegePhotos[gegeId];
  var slots = ['gege' + gegeId + 'Slot1', 'gege' + gegeId + 'Slot2'];
  
  for (var i = 0; i < slots.length; i++) {
    var slot = document.getElementById(slots[i]);
    if (!slot) continue;
    
    if (photos && photos.length > 0) {
      var photoIndex = (state.gegeIndex[gegeId] + i) % photos.length;
      slot.innerHTML = '<img src="' + photos[photoIndex].url + '" style="width:100%;height:100%;object-fit:cover;" onclick="viewGegePhoto(' + gegeId + ',' + photoIndex + ')">';
    } else {
      slot.innerHTML = '<div class="photo-placeholder"><span class="photo-icon">📸</span><span>圣容</span></div>';
    }
  }
  
  var goldEl = document.getElementById('gege' + gegeId + 'Gold');
  if (goldEl) goldEl.textContent = state.gegeGold[gegeId] || 0;
}

// 启动滚动动画
function startGegeScrollAnimation(gegeId) {
  stopGegeScrollAnimation(gegeId);
  
  if (!state.gegePhotos[gegeId] || state.gegePhotos[gegeId].length < 2) return;
  
  state.gegeAnimation[gegeId] = true;
  state.gegeScrollTimer[gegeId] = setInterval(function() {
    if (!state.gegeAnimation[gegeId]) return;
    var total = state.gegePhotos[gegeId].length;
    state.gegeIndex[gegeId] = (state.gegeIndex[gegeId] + 1) % total;
    renderGegeWall(gegeId);
  }, 2500);
}

// 停止滚动动画
function stopGegeScrollAnimation(gegeId) {
  state.gegeAnimation[gegeId] = false;
  if (state.gegeScrollTimer[gegeId]) {
    clearInterval(state.gegeScrollTimer[gegeId]);
    state.gegeScrollTimer[gegeId] = null;
  }
}

// 查看格格大图
function viewGegePhoto(gegeId, index) {
  var photos = state.gegePhotos[gegeId];
  if (!photos || !photos[index]) return;
  
  var viewer = document.getElementById('photoViewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'photoViewer';
    viewer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;';
    viewer.onclick = function() { viewer.style.display = 'none'; };
    document.body.appendChild(viewer);
  }
  viewer.innerHTML = '<img src="' + photos[index].url + '" style="max-width:90%;max-height:90%;object-fit:contain;border:3px solid #FFD700;border-radius:10px;">';
  viewer.style.display = 'flex';
}

// 清空格格照片
function clearGegePhotos(gegeId) {
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  if (!confirm('确定要清空' + GEGE_NAMES[gegeId] + '的所有圣容吗？')) return;
  
  state.gegePhotos[gegeId] = [];
  localStorage.removeItem('gege_photos_' + gegeId);
  stopGegeScrollAnimation(gegeId);
  renderGegeWall(gegeId);
  renderGegePhotoList(gegeId);
  
  var countEl = document.getElementById('gegeUploadCount');
  if (countEl) countEl.textContent = '0';
  
  showToast(GEGE_NAMES[gegeId] + '圣容已清空');
}

// 渲染照片列表（控制殿内显示）
function renderGegePhotoList(gegeId) {
  var listEl = document.getElementById('gegePhotoList');
  if (!listEl) return;
  
  var photos = state.gegePhotos[gegeId] || [];
  
  if (photos.length === 0) {
    listEl.innerHTML = '';
    return;
  }
  
  var html = '';
  for (var i = 0; i < photos.length; i++) {
    html += '<div class="gege-photo-item" onclick="viewGegePhoto(' + gegeId + ',' + i + ')">';
    html += '<img src="' + photos[i].url + '" alt="照片' + (i + 1) + '">';
    html += '<span class="photo-index">' + (i + 1) + '</span>';
    html += '<button class="photo-delete-btn" onclick="removeGegePhoto(' + gegeId + ',' + i + ', event)" title="删除">✕</button>';
    html += '</div>';
  }
  listEl.innerHTML = html;
}

// 删除单个照片
function removeGegePhoto(gegeId, index, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  if (!confirm('确定要删除第 ' + (index + 1) + ' 张圣容吗？')) return;
  
  state.gegePhotos[gegeId].splice(index, 1);
  saveGegePhotos(gegeId);
  
  if (state.gegePhotos[gegeId].length < 2) {
    stopGegeScrollAnimation(gegeId);
  }
  
  renderGegeWall(gegeId);
  renderGegePhotoList(gegeId);
  
  var countEl = document.getElementById('gegeUploadCount');
  if (countEl) countEl.textContent = state.gegePhotos[gegeId].length;
  
  showToast('圣容已删除');
}

// 增加格格金币
function addGegeGold(gegeId, amount) {
  if (!state.gegeGold[gegeId]) state.gegeGold[gegeId] = 0;
  state.gegeGold[gegeId] += amount;
  localStorage.setItem('gege_gold_' + gegeId, state.gegeGold[gegeId]);
  renderGegeWall(gegeId);
}

var qrInput = document.getElementById('qrInput');
if (qrInput) {
  qrInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(event) {
      var dataUrl = event.target.result;
      localStorage.setItem('gege_qr_code', dataUrl);
      
      var preview = document.getElementById('qrPreview');
      if (preview) {
        preview.innerHTML = '<img src="' + dataUrl + '" alt="收款码预览">';
      }
      
      var qrCodeEl = document.getElementById('qrCode');
      if (qrCodeEl) {
        qrCodeEl.innerHTML = '<img src="' + dataUrl + '" alt="微信收款码">';
      }
      
      // 同步到服务器
      apiRequest('/api/config', {
        method: 'POST',
        body: { qrCodeImage: dataUrl }
      });
      
      showToast('收款码上传成功！');
    };
    reader.readAsDataURL(file);
  });
}

var mediaInput = document.getElementById('mediaInput');
if (mediaInput) {
  mediaInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(event) {
      var dataUrl = event.target.result;
      var type = file.type.indexOf('video') === 0 ? 'video' : 'image';
      
      localStorage.setItem('gege_media', dataUrl);
      localStorage.setItem('gege_media_type', type);
      
      var preview = document.getElementById('mediaPreview');
      if (preview) {
        if (type === 'video') {
          preview.innerHTML = '<video src="' + dataUrl + '" controls></video>';
        } else {
          preview.innerHTML = '<img src="' + dataUrl + '" alt="预览">';
        }
      }
      
      var controls = document.getElementById('mediaControls');
      if (controls) controls.style.display = 'block';
      
      loadGegeMedia();
      showToast('格格影像上传成功！');
    };
    reader.readAsDataURL(file);
  });
}

function removeMedia() {
  localStorage.removeItem('gege_media');
  localStorage.removeItem('gege_media_type');
  
  var preview = document.getElementById('mediaPreview');
  if (preview) {
    preview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">🖼</span><span>点击上传格格的照片或视频</span></div>';
  }
  
  var controls = document.getElementById('mediaControls');
  if (controls) controls.style.display = 'none';
  
  loadGegeMedia();
  showToast('已移除格格影像');
}

// ============ 保存设置 ============
function openSettings() {
  var qrCode = localStorage.getItem('gege_qr_code');
  if (qrCode) {
    var qrPreview = document.getElementById('qrPreview');
    if (qrPreview) {
      qrPreview.innerHTML = '<img src="' + qrCode + '" alt="收款码预览" style="max-width:100%;max-height:150px;">';
    }
  } else {
    var qrPreview = document.getElementById('qrPreview');
    if (qrPreview) {
      qrPreview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">📷</span><span>点击上传微信收款码</span></div>';
    }
  }
  
  // 初始化格格Tab
  var tabs = document.querySelectorAll('.gege-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  if (tabs[currentGegeTab - 1]) tabs[currentGegeTab - 1].classList.add('active');
  
  // 更新当前格格的上传预览和数量
  var currentPhotos = state.gegePhotos[currentGegeTab] || [];
  var countEl = document.getElementById('gegeUploadCount');
  if (countEl) countEl.textContent = currentPhotos.length;
  
  var preview = document.getElementById('gegeUploadPreview');
  if (preview) {
    if (currentPhotos.length > 0) {
      preview.innerHTML = '<img src="' + currentPhotos[0].url + '" style="max-width:100%;max-height:150px;">';
    } else {
      preview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">🖼</span><span>点击上传圣容（支持多张，最多50张）</span></div>';
    }
  }
  
  // 渲染照片列表
  renderGegePhotoList(currentGegeTab);
  
  var modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('active');
}

function closeSettings() {
  var modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('active');
}

// 从控制殿按钮直接打开BGM上传
function uploadBgmFromPage() {
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  openSettings();
  var bgmInput = document.getElementById('bgmInput');
  if (bgmInput) bgmInput.click();
}

// 清空照片墙（兼容旧调用，清空当前格格）
function clearPhotoWall() {
  clearGegePhotos(currentGegeTab);
}

// ============ 支付配置功能 ============
var paymentConfig = {
  method: 'qrcode',
  apiKey: '',
  apiSecret: '',
  notifyUrl: '',
  autoVerify: false,
  mpayEndpoint: 'https://api.mpays.cn'
};

function selectPaymentMethod(method, element) {
  paymentConfig.method = method;
  
  // 更新UI
  var options = document.querySelectorAll('.method-option');
  options.forEach(function(opt) {
    opt.classList.remove('active');
  });
  if (element) element.classList.add('active');
  
  // 切换面板
  var qrcodePanel = document.getElementById('qrcodeModePanel');
  var apiPanel = document.getElementById('apiModePanel');
  
  if (method === 'qrcode') {
    if (qrcodePanel) qrcodePanel.style.display = 'block';
    if (apiPanel) apiPanel.style.display = 'none';
  } else {
    if (qrcodePanel) qrcodePanel.style.display = 'none';
    if (apiPanel) apiPanel.style.display = 'block';
  }
}

function toggleAutoVerify() {
  paymentConfig.autoVerify = !paymentConfig.autoVerify;
  var toggle = document.getElementById('autoVerifyToggle');
  if (toggle) {
    if (paymentConfig.autoVerify) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }
}

function loadPaymentConfig() {
  var saved = localStorage.getItem('gege_payment_config');
  if (saved) {
    try {
      var config = JSON.parse(saved);
      paymentConfig = config;
      
      // 恢复UI
      selectPaymentMethod(config.method || 'qrcode', document.querySelector('.method-option.' + config.method));
      
      var mpayEndpointInput = document.getElementById('mpayEndpointInput');
      var apiKeyInput = document.getElementById('apiKeyInput');
      var apiSecretInput = document.getElementById('apiSecretInput');
      var notifyUrlInput = document.getElementById('notifyUrlInput');
      
      if (mpayEndpointInput && config.mpayEndpoint) mpayEndpointInput.value = config.mpayEndpoint;
      if (apiKeyInput && config.apiKey) apiKeyInput.value = config.apiKey;
      if (apiSecretInput && config.apiSecret) apiSecretInput.value = config.apiSecret;
      if (notifyUrlInput && config.notifyUrl) notifyUrlInput.value = config.notifyUrl;
      
      var autoVerifyToggle = document.getElementById('autoVerifyToggle');
      if (autoVerifyToggle && config.autoVerify) autoVerifyToggle.classList.add('active');
      
      paymentConfig.autoVerify = config.autoVerify || false;
    } catch (e) {}
  }
}

async function syncPaymentConfigToServer() {
  try {
    var result = await apiRequest('/api/config', {
      method: 'POST',
      body: {
        paymentMethod: paymentConfig.method,
        apiKey: paymentConfig.apiKey,
        apiSecret: paymentConfig.apiSecret,
        notifyUrl: paymentConfig.notifyUrl,
        autoVerify: paymentConfig.autoVerify,
        mpayEndpoint: paymentConfig.mpayEndpoint
      }
    });
    if (result && result.success) {
      console.log('支付配置已同步到服务器');
    }
  } catch (e) {}
}

function saveSettings() {
  closeSettings();
  showToast('格格设置已保存！');
}

// ============ Toast提示 ============
var toastTimer = null;

function showToast(message, duration) {
  if (!duration) duration = 2000;
  var toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add('show');
  
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(function() {
    toast.classList.remove('show');
  }, duration);
}

// ============ 背景音乐功能 ============
var bgmBlobUrl = null;

function initBgmDB() {
  return new Promise(function(resolve) {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    var req = indexedDB.open('GegeDB', 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('bgm')) {
        db.createObjectStore('bgm', { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function() { resolve(null); };
  });
}

function saveBgmToDB(blob, fileName) {
  return initBgmDB().then(function(db) {
    if (!db) return;
    return new Promise(function(resolve) {
      var tx = db.transaction('bgm', 'readwrite');
      tx.objectStore('bgm').put({ id: 'main', blob: blob, name: fileName, time: Date.now() });
      tx.oncomplete = function() { resolve(true); };
      tx.onerror = function() { resolve(false); };
    });
  });
}

function loadBgmFromDB() {
  return initBgmDB().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve) {
      var tx = db.transaction('bgm', 'readonly');
      var req = tx.objectStore('bgm').get('main');
      req.onsuccess = function() { resolve(req.result || null); };
      req.onerror = function() { resolve(null); };
    });
  });
}

function deleteBgmFromDB() {
  return initBgmDB().then(function(db) {
    if (!db) return;
    var tx = db.transaction('bgm', 'readwrite');
    tx.objectStore('bgm').delete('main');
  });
}

function uploadBgm() {
  var input = document.getElementById('bgmInput');
  if (input) input.click();
}

var bgmInput = document.getElementById('bgmInput');
if (bgmInput) {
  bgmInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 15 * 1024 * 1024) {
      showToast('音乐文件太大，请选择15MB以内的文件');
      return;
    }
    
    showToast('正在上传 ' + (file.size / 1024 / 1024).toFixed(1) + 'MB...');
    
    var reader = new FileReader();
    reader.onload = function(event) {
      var arrayBuffer = event.target.result;
      var blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' });
      
      if (bgmBlobUrl) URL.revokeObjectURL(bgmBlobUrl);
      bgmBlobUrl = URL.createObjectURL(blob);
      state.bgmData = bgmBlobUrl;
      
      saveBgmToDB(blob, file.name).then(function() {
        var bgmPlayer = document.getElementById('bgmPlayer');
        if (bgmPlayer) {
          bgmPlayer.src = bgmBlobUrl;
        }
        
        var bgmPreview = document.getElementById('bgmPreview');
        if (bgmPreview) {
          bgmPreview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">🎵</span><span>' + file.name + '</span></div>';
        }
        
        var bgmControls = document.getElementById('bgmControls');
        if (bgmControls) bgmControls.style.display = 'flex';
        
        showToast('背景音乐上传成功！');
      });
    };
    reader.onerror = function() {
      showToast('读取文件失败，请重试');
    };
    reader.readAsArrayBuffer(file);
  });
}

function toggleBgmPlay() {
  var bgmPlayer = document.getElementById('bgmPlayer');
  var bgmPlayBtn = document.getElementById('bgmPlayBtn');
  if (!bgmPlayer) return;
  
  if (state.isPlaying) {
    bgmPlayer.pause();
    state.isPlaying = false;
    if (bgmPlayBtn) bgmPlayBtn.textContent = '▶ 播放';
  } else {
    bgmPlayer.play().then(function() {
      state.isPlaying = true;
      if (bgmPlayBtn) bgmPlayBtn.textContent = '⏸ 暂停';
    }).catch(function(err) {
      showToast('播放失败，请重新设置');
    });
  }
}

function removeBgm() {
  if (bgmBlobUrl) { URL.revokeObjectURL(bgmBlobUrl); bgmBlobUrl = null; }
  deleteBgmFromDB();
  state.bgmData = null;
  
  var bgmPlayer = document.getElementById('bgmPlayer');
  if (bgmPlayer) {
    bgmPlayer.pause();
    bgmPlayer.src = '';
  }
  state.isPlaying = false;
  
  var bgmPreview = document.getElementById('bgmPreview');
  if (bgmPreview) {
    bgmPreview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">🎵</span><span>点击上传背景音乐</span></div>';
  }
  
  var bgmControls = document.getElementById('bgmControls');
  if (bgmControls) bgmControls.style.display = 'none';
  
  showToast('背景音乐已移除');
}

function loadBgm() {
  loadBgmFromDB().then(function(data) {
    if (!data || !data.blob) return;
    
    if (bgmBlobUrl) URL.revokeObjectURL(bgmBlobUrl);
    bgmBlobUrl = URL.createObjectURL(data.blob);
    state.bgmData = bgmBlobUrl;
    
    var bgmPlayer = document.getElementById('bgmPlayer');
    if (bgmPlayer) {
      bgmPlayer.src = bgmBlobUrl;
    }
    
    var bgmControls = document.getElementById('bgmControls');
    if (bgmControls) bgmControls.style.display = 'flex';
    
    var bgmPreview = document.getElementById('bgmPreview');
    if (bgmPreview && data.name) {
      bgmPreview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">🎵</span><span>' + data.name + '</span></div>';
    }
    
    var tryPlay = function() {
      if (bgmPlayer && !state.isPlaying) {
        bgmPlayer.play().then(function() {
          state.isPlaying = true;
          var bgmPlayBtn = document.getElementById('bgmPlayBtn');
          if (bgmPlayBtn) bgmPlayBtn.textContent = '⏸ 暂停';
        }).catch(function() {
          document.addEventListener('click', function autoPlayOnce() {
            if (bgmPlayer && !state.isPlaying) {
              bgmPlayer.play().then(function() {
                state.isPlaying = true;
                var bgmPlayBtn = document.getElementById('bgmPlayBtn');
                if (bgmPlayBtn) bgmPlayBtn.textContent = '⏸ 暂停';
              }).catch(function() {});
            }
            document.removeEventListener('click', autoPlayOnce);
          }, { once: true });
        });
      }
    };
    setTimeout(tryPlay, 500);
  });
}

// ============ 初始化 ============
function init() {
  console.log('格格的宫殿初始化...');
  
  // 加载验证设置
  var savedPassword = localStorage.getItem('gege_verify_password');
  if (savedPassword) {
    state.verifyPassword = savedPassword;
    state.verifyEnabled = true;
  }
  
  loadGold();
  loadGegeMedia();
  loadBgm();
  loadPaymentConfig();
  updateLocalIPDisplay();
  
  // 检查用户登录状态
  checkUserLogin();
  
  // 检查服务器连接
  checkServerConfig().then(function(config) {
    if (config) {
      console.log('✅ 已连接到支付服务器，支付模式：', config.paymentMethod);
      state.serverConfig = config;
      
      // 同步服务器配置到UI
      if (config.paymentMethod === 'api') {
        selectPaymentMethod('api', document.querySelector('.method-option:nth-child(2)'));
      }
      if (config.apiKey) {
        var apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput && !apiKeyInput.value) apiKeyInput.value = config.apiKey;
      }
      if (config.autoVerify) {
        var toggle = document.getElementById('autoVerifyToggle');
        if (toggle) toggle.classList.add('active');
        paymentConfig.autoVerify = true;
      }
      if (config.qrCodeImage) {
        state.qrCode = config.qrCodeImage;
        localStorage.setItem('gege_qr_code', config.qrCodeImage);
        updateScanPayQR();
        updatePaymentDisplay();
      }
    } else {
      console.log('⚠️ 未连接到支付服务器，使用本地模式');
    }
  });
  
  setTimeout(function() {
    // 如果没有登录，显示登录提示
    if (!state.userToken) {
      showUserLoginModal();
      return;
    }
    
    showToast('欢迎回到格格的宫殿，' + (state.currentUser ? state.currentUser.servantName : '奴才'), 3000);
    
    // 如果没有设置过本地名字，使用服务器的奴才名字
    if (!state.userName && state.currentUser) {
      state.userName = state.currentUser.servantName;
      localStorage.setItem('gege_user_name', state.currentUser.servantName);
    }
    
    updateRankDisplay();
  }, 1500);
  
  updateRechargeBtnText();
}

// 点击弹窗外部关闭
var modals = document.querySelectorAll('.modal');
for (var i = 0; i < modals.length; i++) {
  modals[i].addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('active');
    }
  });
}

// 键盘ESC关闭弹窗
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var activeModals = document.querySelectorAll('.modal.active');
    for (var i = 0; i < activeModals.length; i++) {
      activeModals[i].classList.remove('active');
    }
  }
});

// 滚动时更新按钮显示
window.addEventListener('scroll', function() {
  updateTrainingQuickBtn();
}, { passive: true });

// ============ 设置快捷入口 ============
function openPaymentSettings() {
  openSettings();
  setTimeout(function() {
    var section = document.querySelector('.payment-config-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 300);
}

function openBgmSettings() {
  openSettings();
  setTimeout(function() {
    var section = document.getElementById('bgmSettingSection');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 300);
}

function toggleBgmFromPage() {
  var bgmPlayer = document.getElementById('bgmPlayer');
  var bgmIcon = document.getElementById('bgmIcon');
  if (!bgmPlayer) return;
  
  if (state.isPlaying) {
    bgmPlayer.pause();
    state.isPlaying = false;
    if (bgmIcon) bgmIcon.textContent = '🎵';
  } else {
    bgmPlayer.play().then(function() {
      state.isPlaying = true;
      if (bgmIcon) bgmIcon.textContent = '🎶';
    }).catch(function(err) {
      showToast('请先在设置中上传背景音乐');
    });
  }
}

function updateLocalIPDisplay() {
  var ipDisplay = document.getElementById('localIPDisplay');
  if (!ipDisplay) return;
  
  // 获取本机IP
  ipDisplay.textContent = 'http://localhost:3000';
  
  // 尝试获取局域网IP
  fetch('https://api.ipify.org?format=json').then(function(res) {
    return res.json();
  }).then(function(data) {
    if (data && data.ip) {
      ipDisplay.textContent = 'http://' + data.ip + ':3000';
    }
  }).catch(function() {
    // 忽略错误
  });
}

// ============ 展示位上传 ============
var gallerySlotIndex = 0;

// ============ 御用相册解锁系统 ============
var GALLERY_UNLOCK_COST = 0;

function isGalleryUnlocked() {
  return true;
}

function loadGalleryContent() {
  for (var i = 1; i <= 3; i++) {
    var data = localStorage.getItem('gege_gallery_' + i);
    var type = localStorage.getItem('gege_gallery_type_' + i);
    var slot = document.getElementById('gallerySlot' + i);
    if (slot && data) {
      if (type === 'video') {
        slot.innerHTML = '<video src="' + data + '" controls style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video>';
      } else {
        slot.innerHTML = '<img src="' + data + '" alt="格格' + i + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
      }
    }
  }
}

function checkGalleryLock() {
  var overlay = document.getElementById('galleryLockOverlay');
  var grid = document.getElementById('galleryGrid');
  if (overlay) overlay.style.display = 'none';
  if (grid) grid.style.display = 'grid';
  loadGalleryContent();
}

function openGalleryUnlock() {
  if (state.isAdmin) {
    showToast('格格无需解锁，直接入内');
    checkGalleryLock();
    return;
  }
  
  if (state.gold < GALLERY_UNLOCK_COST) {
    showToast('金币不够！奴才需献上更多孝敬（需🪙' + GALLERY_UNLOCK_COST + '）');
    return;
  }
  
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  modal.innerHTML = '<div class="modal-content" style="max-width:420px;padding:30px;text-align:center;">' +
    '<div style="font-size:48px;margin-bottom:10px;">📱</div>' +
    '<h3 style="color:#FFD700;margin:10px 0 20px;border:none;">扫码上贡 · 解锁御用相册</h3>' +
    '<div style="background:#f8f8f8;border:2px dashed #ccc;border-radius:10px;padding:20px;margin-bottom:20px;">' +
      '<div style="width:180px;height:180px;background:white;border:2px solid #333;margin:0 auto;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:80px;">' +
        '▦' +
      '</div>' +
      '<p style="margin:10px 0;font-size:12px;color:#999;">【模拟扫码区】</p>' +
      '<p style="margin:5px 0;color:#666;font-size:13px;">奴才献上 🪙 ' + GALLERY_UNLOCK_COST + ' 金币</p>' +
    '</div>' +
    '<div style="background:#FFF3E0;border-left:4px solid #FF4500;padding:12px;text-align:left;margin-bottom:15px;border-radius:4px;">' +
      '<p style="margin:0 0 5px;color:#8B0000;font-weight:bold;">⚠ 解锁须知：</p>' +
      '<p style="margin:2px 0;font-size:12px;color:#666;">• 一次解锁，永久可看</p>' +
      '<p style="margin:2px 0;font-size:12px;color:#666;">• 仅供奴才本人观赏，不可外传</p>' +
      '<p style="margin:2px 0;font-size:12px;color:#666;">• 偷看格格圣容乃大不敬</p>' +
    '</div>' +
    '<button class="save-btn big" onclick="confirmGalleryUnlock()" style="width:100%;">✅ 确认上贡，求密码</button>' +
    '<button class="btn-cancel" onclick="this.closest(\'.modal-overlay\').remove()" style="width:100%;margin-top:8px;">奴才再想想</button>' +
  '</div>';
  document.body.appendChild(modal);
}

function confirmGalleryUnlock() {
  if (state.gold < GALLERY_UNLOCK_COST) {
    showToast('金币不够！');
    return;
  }
  
  state.gold -= GALLERY_UNLOCK_COST;
  saveGold();
  updateGoldDisplay();
  
  var code = String(Math.floor(100000 + Math.random() * 900000));
  localStorage.setItem('gege_gallery_unlock_code', code);
  localStorage.setItem('gege_gallery_unlocked', '1');
  
  var modals = document.querySelectorAll('.modal-overlay');
  for (var m = 0; m < modals.length; m++) modals[m].remove();
  
  showToast('上贡成功！密码：' + code, 5000);
  
  checkGalleryLock();
}

// 相册密码系统
var albumPasswords = { '1': '123456', '2': '000000', '3': '000000' };
var unlockedAlbums = {};

// 从localStorage加载已解锁的相册
function loadUnlockedAlbums() {
  for (var i = 1; i <= 3; i++) {
    if (localStorage.getItem('gege_album_unlocked_' + i) === '1') {
      unlockedAlbums[i] = true;
      // 更新UI状态
      var slot = document.querySelector('.gallery-slot[data-album="' + i + '"]');
      if (slot) {
        slot.classList.remove('locked');
        slot.classList.add('unlocked');
      }
    }
  }
}
// 页面加载后再执行，确保DOM已就绪
document.addEventListener('DOMContentLoaded', function() {
  loadUnlockedAlbums();
});
// 如果DOM已经加载完成，立即执行
if (document.readyState !== 'loading') {
  loadUnlockedAlbums();
}

function openAlbumLock(albumId) {
  if (state.isAdmin) { openAlbumAdmin(albumId); return; }
  if (unlockedAlbums[albumId]) { 
    // 更新UI状态
    var slot = document.querySelector('.gallery-slot[data-album="' + albumId + '"]');
    if (slot) {
      slot.classList.remove('locked');
      slot.classList.add('unlocked');
    }
    openAlbumViewer(albumId); 
    return; 
  }
  
  var pwd = albumPasswords[albumId] || localStorage.getItem('gege_album_pwd_' + albumId) || '000000';
  var input = prompt('请输入格格赐予的密码（6位数字）：\n\n奴才跪拜恳求，望格格开恩...');
  if (!input) return;
  
  input = input.trim();
  var storedPwd = localStorage.getItem('gege_album_pwd_' + albumId) || pwd;
  if (input === storedPwd) {
    unlockedAlbums[albumId] = true;
    localStorage.setItem('gege_album_unlocked_' + albumId, '1');
    // 更新UI状态
    var slot = document.querySelector('.gallery-slot[data-album="' + albumId + '"]');
    if (slot) {
      slot.classList.remove('locked');
      slot.classList.add('unlocked');
    }
    showToast('觐见成功！奴才叩谢格格恩典！');
    openAlbumViewer(albumId);
  } else {
    showToast('密码错误！奴才无礼，请格格恕罪！');
  }
}

function openAlbumViewer(albumId) {
  var photos = null;
  try {
    photos = JSON.parse(localStorage.getItem('gege_gallery_photos_' + albumId)) || [];
  } catch(e) {
    photos = [];
  }
  
  if (photos.length === 0) {
    showToast('此相册暂无内容，待格格上传');
    return;
  }
  
  var isVideoAlbum = photos.some(function(p) { return p.type === 'video'; });
  var content = '';
  
  if (isVideoAlbum && photos.length === 1) {
    content = '<video src="' + photos[0].data + '" controls autoplay style="max-width:90vw;max-height:80vh;"></video>';
  } else {
    var gridClass = isVideoAlbum ? 'video-viewer-grid' : 'photo-viewer-grid';
    content = '<div class="' + gridClass + '">';
    for (var i = 0; i < photos.length; i++) {
      if (photos[i].type === 'video') {
        content += '<video src="' + photos[i].data + '" controls style="max-width:90vw;max-height:80vh;margin:10px auto;"></video>';
      } else {
        content += '<img src="' + photos[i].data + '" style="max-width:90vw;max-height:80vh;margin:10px auto;border-radius:10px;cursor:pointer;" onclick="document.getElementById(\'photoItem_' + i + '\').click()">';
      }
    }
    content += '</div>';
  }
  
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  modal.innerHTML = '<div class="modal-content" style="background:rgba(0,0,0,0.95);max-width:95vw;max-height:90vh;padding:15px;overflow-y:auto;">' +
    '<span style="position:sticky;top:0;float:right;color:#fff;cursor:pointer;font-size:24px;z-index:10;" onclick="this.closest(\'.modal-overlay\').remove()">×</span>' +
    '<h3 style="color:#FFD700;margin:10px 0;text-align:center;">📿 格格相册 · 共' + photos.length + '张</h3>' +
    content +
    '<p style="color:#FFD700;text-align:center;margin-top:10px;font-size:12px;">✨ 奴才有幸一睹格格圣容 ✨</p>' +
  '</div>';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function openAlbumAdmin(albumId) {
  var input = prompt('格格请输入6位数字密码（设置此相册的访问密码）：\n\n留空则跳过密码设置');
  if (input === null) return;
  
  if (input.trim() !== '') {
    input = input.trim();
    if (!/^\d{6}$/.test(input)) {
      showToast('密码必须为6位数字');
      return;
    }
    localStorage.setItem('gege_album_pwd_' + albumId, input);
  }
  
  unlockedAlbums[albumId] = true;
  uploadGalleryMedia(albumId);
}

function clearGalleryPhotos(albumId) {
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  if (confirm('确定要清空此相册的所有照片吗？')) {
    localStorage.removeItem('gege_gallery_photos_' + albumId);
    localStorage.removeItem('gege_gallery_cover_' + albumId);
    localStorage.removeItem('gege_gallery_cover_type_' + albumId);
    loadGallerySlots();
    showToast('相册已清空');
  }
}

function gallerySlotClick(slotIndex) {
  openAlbumLock(String(slotIndex));
}

function uploadGalleryMedia(slotIndex) {
  if (!state.isAdmin) {
    showToast('请格格先登录控制殿');
    return;
  }
  gallerySlotIndex = slotIndex;
  var input = document.getElementById('galleryInput');
  if (input) input.click();
}

var galleryInput = document.getElementById('galleryInput');
if (galleryInput) {
  galleryInput.addEventListener('change', function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    
    var albumId = gallerySlotIndex;
    var existingData = null;
    try {
      existingData = JSON.parse(localStorage.getItem('gege_gallery_photos_' + albumId)) || [];
    } catch(e) {
      existingData = [];
    }
    
    var processed = 0;
    var newPhotos = [];
    
    for (var i = 0; i < files.length; i++) {
      (function(file) {
        var reader = new FileReader();
        reader.onload = function(event) {
          var dataUrl = event.target.result;
          var type = file.type.indexOf('video') === 0 ? 'video' : 'image';
          newPhotos.push({ data: dataUrl, type: type, name: file.name });
          processed++;
          if (processed === files.length) {
            var allPhotos = existingData.concat(newPhotos);
            localStorage.setItem('gege_gallery_photos_' + albumId, JSON.stringify(allPhotos));
            localStorage.setItem('gege_gallery_cover_' + albumId, newPhotos[0].data);
            localStorage.setItem('gege_gallery_cover_type_' + albumId, newPhotos[0].type);
            
            var slotId = 'gallerySlot' + albumId;
            var slot = document.getElementById(slotId);
            if (slot && newPhotos.length > 0) {
              var cover = newPhotos[0];
              if (cover.type === 'video') {
                slot.innerHTML = '<video src="' + cover.data + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video>';
              } else {
                slot.innerHTML = '<img src="' + cover.data + '" alt="格格相册' + albumId + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
              }
            }
            
            showToast('上传成功！共' + allPhotos.length + '张');
          }
        };
        reader.readAsDataURL(file);
      })(files[i]);
    }
    
    galleryInput.value = '';
  });
}

function loadGallerySlots() {
  for (var i = 1; i <= 3; i++) {
    var photos = null;
    try {
      photos = JSON.parse(localStorage.getItem('gege_gallery_photos_' + i)) || [];
    } catch(e) {
      photos = [];
    }
    
    var slot = document.getElementById('gallerySlot' + i);
    if (photos.length > 0 && slot) {
      var cover = photos[0];
      if (cover.type === 'video') {
        slot.innerHTML = '<video src="' + cover.data + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video>';
      } else {
        slot.innerHTML = '<img src="' + cover.data + '" alt="格格相册' + i + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
      }
    }
  }
}

// ============ 照片墙功能已迁移至格格独立相册 ============

function scrollToPhotoWall() {
  var photoSection = document.getElementById('gegeDisplay');
  if (photoSection && photoSection.scrollIntoView) {
    photoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  for (var g = 1; g <= 3; g++) {
    if (state.gegePhotos[g] && state.gegePhotos[g].length >= 2) {
      startGegeScrollAnimation(g);
    }
  }
}

function scrollToArchive() {
  openArchivePage();
}

function scrollToTraining() {
  var trainingSection = document.getElementById('trainingSection');
  if (trainingSection && trainingSection.scrollIntoView) {
    trainingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ============ 训练系统 ============
// trainingRewards 定义在 training_data.js 中

// 验证训练数据加载
(function verifyTrainingData() {
  if (typeof trainingRewards !== 'undefined' && trainingRewards) {
    console.log('✅ 训诫数据加载成功', Object.keys(trainingRewards).map(function(k) {
      return '第' + k + '阶: ' + (trainingRewards[k].title || '无标题');
    }));
  } else {
    console.error('❌ 训诫数据未加载！training_data.js 可能未正确加载');
  }
})();

function unlockTier(tier) {
  console.log('unlockTier called, tier=', tier, 'trainingRewards=', typeof trainingRewards);
  if (typeof trainingRewards === 'undefined' || !trainingRewards) {
    showToast('训诫数据加载失败，请刷新页面');
    return;
  }
  var reward = trainingRewards[tier];
  if (!reward) {
    console.error('未找到训诫等级:', tier);
    showToast('未找到该等级的训诫内容');
    return;
  }
  
  var saved = localStorage.getItem('gege_tier_' + tier);
  if (saved === 'unlocked') {
    showTrainingReward(tier);
    return;
  }
  
  if (state.gold < reward.cost) {
    showToast('金币不足！需' + reward.cost + '金币');
    return;
  }
  
  state.gold -= reward.cost;
  saveGold();
  updateGoldDisplay();
  
  localStorage.setItem('gege_tier_' + tier, 'unlocked');
  
  var tierCard = document.querySelector('.tier-card[data-tier="' + tier + '"]');
  if (tierCard) {
    tierCard.classList.add('unlocked');
  }
  
  showTrainingReward(tier);
}

function showTrainingReward(tier) {
  if (typeof trainingRewards === 'undefined' || !trainingRewards) {
    showToast('训诫数据加载失败');
    return;
  }
  var reward = trainingRewards[tier];
  if (!reward) return;
  
  var modal = document.getElementById('trainingRewardModal');
  var title = document.getElementById('trainingModalTitle');
  var content = document.getElementById('trainingRewardContent');
  
  if (title) title.textContent = reward.title;
  if (content) {
    content.innerHTML = reward.content;
    console.log('训诫内容已显示, 长度:', reward.content.length);
  }
  
  if (modal) modal.classList.add('active');
}

function closeTrainingModal() {
  var modal = document.getElementById('trainingRewardModal');
  if (modal) modal.classList.remove('active');
}

// ============ 训诫馆快速跳转 ============
function scrollToTraining() {
  var section = document.querySelector('.training-section');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('🔥 奴才训诫馆 · 必看');
  }
}

function scrollToArchive() {
  openArchivePage();
}

function openArchivePage() {
  var list = document.getElementById('archivePageList');
  var detail = document.getElementById('archivePageDetail');
  if (list) list.style.display = 'block';
  if (detail) detail.style.display = 'none';
  var page = document.getElementById('page-archive');
  var palacePage = document.getElementById('page-palace');
  if (palacePage) palacePage.classList.remove('active');
  if (page) page.classList.add('active');
  window.scrollTo(0, 0);
  if (navigator.vibrate) navigator.vibrate(10);
}

function closeArchivePage() {
  var page = document.getElementById('page-archive');
  var palacePage = document.getElementById('page-palace');
  if (page) page.classList.remove('active');
  if (palacePage) palacePage.classList.add('active');
  if (navigator.vibrate) navigator.vibrate(10);
}

function openArchiveDetail(tabName) {
  var list = document.getElementById('archivePageList');
  var detail = document.getElementById('archivePageDetail');
  var content = document.getElementById('archiveDetailContent');
  var sub = document.getElementById('archivePageSub');
  var archivePage = document.getElementById('page-archive');
  var palacePage = document.getElementById('page-palace');
  
  if (!list || !detail || !content) return;
  
  if (palacePage && palacePage.classList.contains('active')) {
    palacePage.classList.remove('active');
  }
  if (archivePage) archivePage.classList.add('active');
  
  list.style.display = 'none';
  detail.style.display = 'block';
  
  if (typeof archiveData !== 'undefined' && archiveData && archiveData[tabName]) {
    content.innerHTML = '<div class="archive-text-content">' + archiveData[tabName] + '</div>';
    if (sub) {
      var titles = {
        'tuokesuo': '托克索庄园 · 奴才卑微实录',
        'manchu': '满族征服与奴才制度',
        'baoyi': '包衣·阿哈 · 真实历史档案',
        'penalty': '训诫与惩罚 · 奴才之律',
        'xinzuku': '辛者库 · 最卑微之奴隶',
        'taijian': '太监制度 · 清宫阉宦实录',
        'xiunv': '清宫选秀 · 宫女命运录',
        'manggui': '满汉奴才等级 · 阶级悬殊',
        'kuxing': '满清酷刑录 · 残忍之刑',
        'liyi': '奴才礼仪规范 · 跪拜之学',
        'taopa': '逃亡奴 · 追捕与惩戒'
      };
      sub.textContent = titles[tabName] || '清史档案';
    }
  } else {
    content.innerHTML = '<p style="color:#FF6B6B;text-align:center;padding:30px;">档案数据未加载，请刷新页面</p>';
  }
  
  window.scrollTo(0, 0);
  if (navigator.vibrate) navigator.vibrate(10);
}

function showArchiveList() {
  var list = document.getElementById('archivePageList');
  var detail = document.getElementById('archivePageDetail');
  var sub = document.getElementById('archivePageSub');
  if (list) list.style.display = 'block';
  if (detail) detail.style.display = 'none';
  if (sub) sub.textContent = '奴才奉旨查阅档案';
  window.scrollTo(0, 0);
  if (navigator.vibrate) navigator.vibrate(10);
}

function scrollToGallery() {
  var section = document.getElementById('palaceGallery');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('📿 格格寝宫 · 御用相册');
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateTrainingQuickBtn() {
  var topBtn = document.getElementById('backTopBtn');
  
  if (topBtn) {
    var scrolled = window.scrollY > 300;
    topBtn.classList.toggle('show', scrolled);
  }
}

// ============ 训诫馆结束 ============

function loadTrainingTiers() {
  for (var tier = 1; tier <= 4; tier++) {
    var saved = localStorage.getItem('gege_tier_' + tier);
    if (saved === 'unlocked') {
      var tierCard = document.querySelector('.tier-card[data-tier="' + tier + '"]');
      if (tierCard) {
        tierCard.classList.add('unlocked');
        var preview = document.getElementById('tierPreview' + tier);
        if (preview) {
          preview.innerHTML = '<p class="tier-unlocked-text">✅ 已解锁 · 点击查看</p>';
        }
      }
    }
  }
}

// ============ 历史档案馆 ============
// archiveData 定义在 archive_data.js 中
(function verifyArchiveData() {
  if (typeof archiveData !== 'undefined' && archiveData) {
    var keys = Object.keys(archiveData);
    console.log('✅ 档案数据加载成功，共', keys.length, '个档案:', keys);
    for (var i = 0; i < keys.length; i++) {
      console.log('  -', keys[i], ':', (archiveData[keys[i]] || '').length, '字符');
    }
  } else {
    console.error('❌ 档案数据未加载！archive_data.js 可能未正确加载');
  }
})();

function openArchiveModal(tabName) {
  if (tabName) {
    openArchiveDetail(tabName);
  } else {
    openArchivePage();
  }
}

function closeArchiveModal() {
  closeArchivePage();
}

function switchArchiveTab(tabElement, tabName) {
  var tabs = document.querySelectorAll('.archive-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  if (tabElement) {
    tabElement.classList.add('active');
  }
  
  var content = document.getElementById('archiveContent');
  if (!content) {
    console.error('archiveContent element not found');
    return;
  }
  
  if (typeof archiveData === 'undefined' || !archiveData) {
    console.error('archiveData not loaded!');
    content.innerHTML = '<p style="color:red;text-align:center;padding:30px;">档案数据未加载，请刷新页面（F5或Ctrl+R）</p>';
    return;
  }
  
  if (archiveData[tabName]) {
    var html = '<div class="archive-text-content">' + archiveData[tabName] + '</div>';
    content.innerHTML = html;
    content.scrollTop = 0;
    console.log('切换档案:', tabName, '内容长度:', archiveData[tabName].length);
  } else {
    console.error('未找到档案:', tabName, '可用档案:', Object.keys(archiveData));
    content.innerHTML = '<p style="color:red;text-align:center;padding:30px;">未找到该档案内容: ' + tabName + '<br>可用档案: ' + Object.keys(archiveData).join(', ') + '</p>';
  }
}

// ============ 启动时加载 ============
function loadGalleryAndTraining() {
  loadGallerySlots();
  
  for (var i = 1; i <= 3; i++) {
    loadGegePhotos(i);
    renderGegeWall(i);
    if (state.gegePhotos[i].length >= 2) {
      startGegeScrollAnimation(i);
    }
  }
  bindGegeUploadInputs();
  initMobileWall();
  
  loadTrainingTiers();
  renderTributeGrid();
  checkGalleryLock();
}

// ============ 新版支付配置UI处理 ============
function initPaymentConfigUI() {
  var statusEl = document.getElementById('paymentConfigStatus');
  var formEl = document.getElementById('paymentConfigForm');
  if (!statusEl || !formEl) return;
  
  // 从服务器获取配置
  apiRequest('/api/config').then(function(config) {
    if (config) {
      // 填充表单
      var methodEl = document.getElementById('paymentMethod');
      if (methodEl) {
        // 确保有测试模式选项
        var hasTestOption = false;
        for (var i = 0; i < methodEl.options.length; i++) {
          if (methodEl.options[i].value === 'test') hasTestOption = true;
        }
        if (!hasTestOption) {
          var opt = document.createElement('option');
          opt.value = 'test';
          opt.textContent = '🧪 测试模式（模拟支付）';
          methodEl.appendChild(opt);
        }
        methodEl.value = config.paymentMethod || 'qrcode';
      }
      
      var apiKeyEl = document.getElementById('apiKey');
      if (apiKeyEl && config.apiKey && config.apiKey.indexOf('***') === -1) {
        apiKeyEl.value = config.apiKey;
      }
      
      var apiSecretEl = document.getElementById('apiSecret');
      if (apiSecretEl && config.apiSecret && config.apiSecret.indexOf('***') === -1) {
        apiSecretEl.value = config.apiSecret;
      }
      
      var endpointEl = document.getElementById('mpayEndpoint');
      if (endpointEl) endpointEl.value = config.mpayEndpoint || 'https://api.mpays.cn';
      
      var notifyEl = document.getElementById('notifyUrl');
      if (notifyEl) notifyEl.value = config.notifyUrl || '';
      
      var autoVerifyEl = document.getElementById('autoVerify');
      if (autoVerifyEl) autoVerifyEl.checked = config.autoVerify || false;
      
      onPaymentMethodChange();
      
      statusEl.style.display = 'none';
      formEl.style.display = 'block';
      
      // 显示当前状态
      showPaymentStatus(config);
    } else {
      statusEl.innerHTML = '<span class="status-error">❌ 无法连接服务器</span>';
    }
  }).catch(function() {
    statusEl.innerHTML = '<span class="status-error">❌ 无法连接服务器</span>';
  });
}

function showPaymentStatus(config) {
  var statusDiv = document.getElementById('paymentConfigStatus');
  if (!statusDiv || statusDiv.style.display === 'none') return;
  
  var statusText = '';
  if (config.testMode || config.paymentMethod === 'test') {
    statusText = '🧪 <strong>测试模式</strong> - 创建订单后3秒自动支付成功';
  } else if (config.paymentMethod === 'api' && config.hasApiKey) {
    statusText = '✅ <strong>API模式已配置</strong> - 支付自动到账';
  } else if (config.paymentMethod === 'api') {
    statusText = '⚠️ <strong>API模式</strong> - 请填写API Key';
  } else if (config.hasQRCode) {
    statusText = '📱 <strong>收款码模式</strong> - 需手动确认';
  } else {
    statusText = '❌ <strong>未配置</strong> - 请选择支付模式';
  }
  
  var notifyInfo = config.notifyUrl ? '<br>📍 回调地址: ' + config.notifyUrl : '';
  statusDiv.innerHTML = '<div style="padding:10px;background:rgba(255,215,0,0.1);border-radius:8px;">' + statusText + notifyInfo + '</div>';
  statusDiv.style.display = 'block';
}

function onPaymentMethodChange() {
  var methodEl = document.getElementById('paymentMethod');
  if (!methodEl) return;
  
  var method = methodEl.value;
  var apiMode = method === 'api';
  var testMode = method === 'test';
  
  // 显示/隐藏API相关字段
  document.getElementById('apiKeyRow').style.display = apiMode ? 'flex' : 'none';
  document.getElementById('apiSecretRow').style.display = apiMode ? 'flex' : 'none';
  document.getElementById('endpointRow').style.display = apiMode ? 'flex' : 'none';
  document.getElementById('notifyUrlRow').style.display = apiMode ? 'flex' : 'none';
  document.getElementById('autoVerifyRow').style.display = apiMode ? 'flex' : 'none';
  
  // 测试模式提示
  var tipsEl = document.querySelector('.payment-tips');
  if (tipsEl) {
    if (testMode) {
      tipsEl.innerHTML = '<p class="tip-title">🧪 测试模式说明：</p>' +
        '<p>1. 奴才创建订单后，系统将在3秒后自动模拟支付成功</p>' +
        '<p>2. 金币会自动到账，无需真实扫码支付</p>' +
        '<p>3. 用于测试完整的充值流程</p>' +
        '<p class="tip-warn">⚠️ 测试模式下不是真实支付</p>';
    } else if (apiMode) {
      tipsEl.innerHTML = '<p class="tip-title">📖 自动充值说明：</p>' +
        '<p>1. 去码支付/BufPay平台注册账号，获取API Key和Secret</p>' +
        '<p>2. 配置回调地址（需公网访问）</p>' +
        '<p>3. 奴才扫码支付后，金币自动到账，无需手动确认</p>' +
        '<p class="tip-warn">⚠️ 生产环境建议部署到云服务器（Render/Railway）</p>';
    } else {
      tipsEl.innerHTML = '<p class="tip-title">📖 收款码模式说明：</p>' +
        '<p>1. 上传格格的微信/支付宝收款码</p>' +
        '<p>2. 奴才扫码支付后，需要手动点击"确认到账"</p>' +
        '<p class="tip-warn">💡 建议使用API模式实现自动到账</p>';
    }
  }
}

async function savePaymentConfig() {
  var methodEl = document.getElementById('paymentMethod');
  var apiKeyEl = document.getElementById('apiKey');
  var apiSecretEl = document.getElementById('apiSecret');
  var endpointEl = document.getElementById('mpayEndpoint');
  var notifyEl = document.getElementById('notifyUrl');
  var autoVerifyEl = document.getElementById('autoVerify');
  
  var method = methodEl ? methodEl.value : 'qrcode';
  
  var config = {
    paymentMethod: method,
    testMode: method === 'test',
    apiKey: apiKeyEl ? apiKeyEl.value.trim() : '',
    apiSecret: apiSecretEl ? apiSecretEl.value.trim() : '',
    mpayEndpoint: endpointEl ? endpointEl.value.trim() : 'https://api.mpays.cn',
    notifyUrl: notifyEl ? notifyEl.value.trim() : '',
    autoVerify: autoVerifyEl ? autoVerifyEl.checked : false
  };
  
  // 验证
  if (method === 'api' && !config.apiKey) {
    showToast('请填写API Key！');
    return;
  }
  
  try {
    var result = await apiRequest('/api/config', {
      method: 'POST',
      body: config
    });
    
    if (result && result.success) {
      showToast('✅ 支付配置保存成功！');
      
      if (method === 'test') {
        showToast('🧪 测试模式已启用，可前往页面测试充值流程', 5000);
      } else if (method === 'api' && !config.notifyUrl) {
        var localIp = getLocalIP();
        var defaultNotify = 'http://' + localIp + ':3000/api/payment/notify';
        showToast('💡 回调地址：' + defaultNotify, 5000);
      }
    } else {
      showToast('保存失败：' + (result ? result.message : '未知错误'));
    }
  } catch (error) {
    showToast('保存失败，请检查网络连接');
  }
}

function testPaymentConfig() {
  showToast('🧪 正在测试服务器连接...');
  
  apiRequest('/api/health').then(function(result) {
    if (result && result.success) {
      var msg = '✅ 服务器连接成功！\n';
      msg += '版本: ' + result.version + '\n';
      msg += '支付模式: ' + result.paymentMode + '\n';
      msg += '测试模式: ' + (result.testMode ? '✅ 开启' : '❌ 关闭') + '\n';
      msg += '活跃订单: ' + result.activeOrders + '\n';
      msg += '用户数: ' + result.totalUsers;
      showToast(msg, 5000);
    } else {
      showToast('❌ 服务器连接失败');
    }
  }).catch(function() {
    showToast('❌ 无法连接到服务器');
  });
}

function openPaymentDoc() {
  showToast('📖 获取API Key:\n1. 访问码支付/BufPay官网\n2. 注册并登录\n3. 在"API管理"页面获取Key和Secret', 5000);
}

// ============ 启动时加载 ============
init();
loadGalleryAndTraining();
initPaymentConfigUI();
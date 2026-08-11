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
  // 真实支付相关
  currentOrder: null,
  serverConfig: null,
  paymentPollingTimer: null
};

// ============ 服务器API交互 ============
var API_BASE = '';

async function apiRequest(endpoint, options) {
  try {
    var response = await fetch(API_BASE + endpoint, {
      method: (options && options.method) || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });
    var data = await response.json();
    return data;
  } catch (error) {
    console.error('API请求失败:', endpoint, error);
    return null;
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

function updateRankDisplay() {
  var rankList = document.getElementById('rankList');
  if (!rankList) return;
  
  var displayName = state.userName || '奴才';
  
  var myRank = '';
  if (state.totalTributed > 0) {
    myRank = '<div class="rank-item my-rank">' +
      '<span class="rank-num">我</span>' +
      '<span class="rank-name">' + displayName + '(' + state.totalTributed + '金)</span>' +
      '<span class="rank-value">🪙 ' + state.totalTributed + '</span>' +
      '</div>';
  }
  
  // 更新名字显示
  var myRankName = document.getElementById('myRankName');
  if (myRankName) {
    myRankName.textContent = displayName;
  }
  
  var html = myRank +
    '<div class="rank-item">' +
      '<span class="rank-num">1</span>' +
      '<span class="rank-name">恭亲王</span>' +
      '<span class="rank-value">🪙 88888</span>' +
      '</div>' +
    '<div class="rank-item">' +
      '<span class="rank-num">2</span>' +
      '<span class="rank-name">和珅</span>' +
      '<span class="rank-value">🪙 66666</span>' +
      '</div>' +
    '<div class="rank-item">' +
      '<span class="rank-num">3</span>' +
      '<span class="rank-name">纪晓岚</span>' +
      '<span class="rank-value">🪙 52000</span>' +
      '</div>';
  
  rankList.innerHTML = html;
  
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
  
  // 如果配置了API模式
  if (config && config.paymentMethod === 'api' && config.apiKey) {
    // 使用真实API创建订单
    try {
      var result = await apiRequest('/api/order/create', {
        method: 'POST',
        body: {
          amount: price,
          description: '充值' + gold + '金币'
        }
      });
      
      if (result && result.success) {
        state.currentRechargeOrder = {
          orderNo: result.orderNo,
          amount: result.amount,
          gold: gold,
          qrCode: result.qrCode,
          apiOrderNo: result.apiOrderNo || null,
          isAutoVerify: result.isAutoVerify || false
        };
        
        // 显示付款二维码
        if (rechargePayQr) {
          var qrImg = result.qrCode 
            ? '<img src="' + result.qrCode + '" alt="付款二维码" style="max-width:220px;max-height:220px;border-radius:12px;border:3px solid #FFD700;">' 
            : '<div class="scan-qr-placeholder"><span>无法生成二维码<br>请使用手动模式</span></div>';
          rechargePayQr.innerHTML = qrImg;
        }
        
        if (rechargePayInfo) {
          rechargePayInfo.innerHTML = '<p class="pay-info-status">⏳ 请扫码付款 ¥' + price + '</p>' +
            '<p class="pay-info-tip">支付成功后金币自动到账</p>' +
            '<p class="pay-info-timer">剩余时间：<span id="rechargePayTimer">30:00</span></p>';
        }
        
        // 开始轮询验证
        startRechargePolling();
        
      } else {
        showToast('创建订单失败，使用手动模式');
        showManualRechargeQR(price, gold, qrCode);
      }
    } catch (error) {
      console.error('创建订单失败:', error);
      showManualRechargeQR(price, gold, qrCode);
    }
  } else if (qrCode) {
    // 使用收款码模式
    showManualRechargeQR(price, gold, qrCode);
  } else {
    // 没有任何支付方式
    if (rechargePayQr) {
      rechargePayQr.innerHTML = '<div class="scan-qr-placeholder"><span>格格请先设置<br>收款码或API</span></div>';
    }
    if (rechargePayInfo) {
      rechargePayInfo.innerHTML = '<p class="pay-info-status">❌ 未配置支付方式</p>' +
        '<p class="pay-info-tip">请格格先登录控制殿，上传收款码或配置API</p>';
    }
    showToast('请格格先配置支付方式！');
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
      var result = await apiRequest('/api/order/' + state.currentRechargeOrder.orderNo);
      
      if (result && result.success && result.status === 'paid') {
        stopRechargePolling();
        confirmRechargeSuccess();
        return;
      }
      
      // 每10次轮询（约30秒），主动查询第三方
      if (pollCount % 10 === 0 && state.currentRechargeOrder.apiOrderNo) {
        if (rechargePayHint) rechargePayHint.style.display = 'block';
        
        var pollResult = await apiRequest('/api/order/' + state.currentRechargeOrder.orderNo + '/poll', {
          method: 'POST'
        });
        
        if (rechargePayHint) rechargePayHint.style.display = 'none';
        
        if (pollResult && pollResult.success && pollResult.status === 'paid') {
          stopRechargePolling();
          confirmRechargeSuccess();
        }
      }
    }
  }, 3000);
}

function stopRechargePolling() {
  if (rechargePollingTimer) {
    clearInterval(rechargePollingTimer);
    rechargePollingTimer = null;
  }
}

function confirmRechargeSuccess() {
  if (state.currentRechargeOrder) {
    state.gold += state.currentRechargeOrder.gold;
    saveGold();
    updateGoldDisplay();
    
    showToast('🎉 充值成功！获得 ' + state.currentRechargeOrder.gold + ' 金币');
    
    var rechargePayModal = document.getElementById('rechargePayModal');
    if (rechargePayModal) rechargePayModal.classList.remove('active');
    
    state.currentRechargeOrder = null;
  }
}

function confirmRechargePaid() {
  if (state.currentRechargeOrder) {
    // 自动验证已通过或手动确认
    confirmRechargeSuccess();
  } else {
    // 手动模式：直接加金币
    var amount = state.selectedRecharge;
    var gold = getRechargeGold(amount);
    state.gold += gold;
    saveGold();
    updateGoldDisplay();
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
    
    state.totalTributed += cost;
    saveTotalTributed();
    updateRankDisplay();
  }
  
  var isBig = item.rank >= 3;
  if (isBig) {
    showBigTributeEffect(item.emoji, item.name, cost);
  } else {
    showTributeEffect(item.emoji, cost);
  }
  
  showToast(item.msg, 3000);
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
  var title = localStorage.getItem('gege_title');
  var desc = localStorage.getItem('gege_desc');
  var titleInput = document.getElementById('gegeTitle');
  var descInput = document.getElementById('gegeDesc');
  
  if (title && titleInput) titleInput.value = title;
  
  // 加载口令设置
  var savedPassword = localStorage.getItem('gege_verify_password');
  var verifyInput = document.getElementById('verifyPasswordInput');
  if (verifyInput && savedPassword) {
    verifyInput.value = savedPassword;
  }
  
  var qrCode = localStorage.getItem('gege_qr_code');
  if (qrCode) {
    var qrPreview = document.getElementById('qrPreview');
    if (qrPreview) {
      qrPreview.innerHTML = '<img src="' + qrCode + '" alt="收款码预览">';
    }
  } else {
    var qrPreview = document.getElementById('qrPreview');
    if (qrPreview) {
      qrPreview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">📷</span><span>点击上传微信收款码</span></div>';
    }
  }
  
  var mediaData = localStorage.getItem('gege_media');
  var mediaType = localStorage.getItem('gege_media_type');
  if (mediaData) {
    var mediaPreview = document.getElementById('mediaPreview');
    if (mediaPreview) {
      if (mediaType === 'video') {
        mediaPreview.innerHTML = '<video src="' + mediaData + '" controls></video>';
      } else {
        mediaPreview.innerHTML = '<img src="' + mediaData + '" alt="预览">';
      }
    }
    var controls = document.getElementById('mediaControls');
    if (controls) controls.style.display = 'block';
  } else {
    var mediaPreview = document.getElementById('mediaPreview');
    if (mediaPreview) {
      mediaPreview.innerHTML = '<div class="upload-placeholder"><span class="placeholder-icon">🖼</span><span>点击上传格格的照片或视频</span></div>';
    }
    var controls = document.getElementById('mediaControls');
    if (controls) controls.style.display = 'none';
  }
  
  var modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('active');
}

function closeSettings() {
  var modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('active');
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
  var titleInput = document.getElementById('gegeTitle');
  var passwordInput = document.getElementById('verifyPasswordInput');
  
  var title = titleInput ? titleInput.value.trim() : '';
  
  if (title) localStorage.setItem('gege_title', title);
  
  // 保存口令
  var password = passwordInput ? passwordInput.value.trim() : '';
  if (password) {
    localStorage.setItem('gege_verify_password', password);
    state.verifyPassword = password;
    state.verifyEnabled = true;
  } else {
    localStorage.removeItem('gege_verify_password');
    state.verifyPassword = '';
    state.verifyEnabled = false;
  }
  
  // 保存支付配置
  var mpayEndpointInput = document.getElementById('mpayEndpointInput');
  var apiKeyInput = document.getElementById('apiKeyInput');
  var apiSecretInput = document.getElementById('apiSecretInput');
  var notifyUrlInput = document.getElementById('notifyUrlInput');
  
  if (mpayEndpointInput) paymentConfig.mpayEndpoint = mpayEndpointInput.value.trim();
  if (apiKeyInput) paymentConfig.apiKey = apiKeyInput.value.trim();
  if (apiSecretInput) paymentConfig.apiSecret = apiSecretInput.value.trim();
  if (notifyUrlInput) paymentConfig.notifyUrl = notifyUrlInput.value.trim();
  
  localStorage.setItem('gege_payment_config', JSON.stringify(paymentConfig));
  
  // 同步到服务器
  syncPaymentConfigToServer();
  
  closeSettings();
  
  var nameEl = document.querySelector('.gege-name');
  if (nameEl && title) nameEl.textContent = title;
  
  showToast('格格设置保存成功！');
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
    showToast('欢迎来到格格的宫殿', 3000);
    
    // 首次访问提示设置名字
    if (!state.userName) {
      setTimeout(function() {
        var input = prompt('首次觐见，请输入您的奴才名号（最多8个字）：\n\n此名将显示在奉献榜上');
        if (input && input.trim()) {
          input = input.trim();
          if (input.length <= 8) {
            state.userName = input;
            localStorage.setItem('gege_user_name', input);
            updateRankDisplay();
            showToast('奴才 ' + input + ' 叩谢格格赐名！', 2500);
          }
        }
      }, 1500);
    }
  }, 500);
  
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
var albumPasswords = { '1': '000000', '2': '000000', '3': '000000' };
var unlockedAlbums = {};

function openAlbumLock(albumId) {
  if (state.isAdmin) { openAlbumAdmin(albumId); return; }
  if (unlockedAlbums[albumId]) { openAlbumViewer(albumId); return; }
  
  var pwd = albumPasswords[albumId] || localStorage.getItem('gege_album_pwd_' + albumId) || '000000';
  var input = prompt('请输入格格赐予的密码（6位数字）：\n\n奴才跪拜恳求，望格格开恩...');
  if (!input) return;
  
  input = input.trim();
  var storedPwd = localStorage.getItem('gege_album_pwd_' + albumId) || pwd;
  if (input === storedPwd) {
    unlockedAlbums[albumId] = true;
    showToast('觐见成功！奴才叩谢格格恩典！');
    openAlbumViewer(albumId);
  } else {
    showToast('密码错误！奴才无礼，请格格恕罪！');
  }
}

function openAlbumViewer(albumId) {
  var data = localStorage.getItem('gege_gallery_' + albumId);
  if (data) {
    var type = localStorage.getItem('gege_gallery_type_' + albumId) || 'image';
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10000';
    var content = type === 'video'
      ? '<video src="' + data + '" controls autoplay style="max-width:90vw;max-height:80vh;"></video>'
      : '<img src="' + data + '" style="max-width:90vw;max-height:80vh;border-radius:10px;">';
    modal.innerHTML = '<div class="modal-content" style="background:rgba(0,0,0,0.9);max-width:95vw;padding:10px;">' +
      '<span style="position:absolute;top:10px;right:15px;color:#fff;cursor:pointer;font-size:24px;" onclick="this.closest(\'.modal-overlay\').remove()">×</span>' +
      content +
      '<p style="color:#FFD700;text-align:center;margin-top:10px;font-size:12px;">✨ 奴才有幸一睹格格圣容 ✨</p>' +
    '</div>';
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  } else {
    showToast('此相册暂无内容，待格格上传');
  }
}

function openAlbumAdmin(albumId) {
  var input = prompt('格格请输入6位数字密码（设置此相册的访问密码）：');
  if (!input) return;
  input = input.trim();
  if (!/^\d{6}$/.test(input)) {
    showToast('密码必须为6位数字');
    return;
  }
  localStorage.setItem('gege_album_pwd_' + albumId, input);
  unlockedAlbums[albumId] = true;
  uploadGalleryMedia(albumId);
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
    var file = e.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(event) {
      var dataUrl = event.target.result;
      var slotId = 'gallerySlot' + gallerySlotIndex;
      var slot = document.getElementById(slotId);
      var type = file.type.indexOf('video') === 0 ? 'video' : 'image';
      
      if (slot) {
        if (type === 'video') {
          slot.innerHTML = '<video src="' + dataUrl + '" controls style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video>';
        } else {
          slot.innerHTML = '<img src="' + dataUrl + '" alt="格格' + gallerySlotIndex + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
        }
      }
      
      localStorage.setItem('gege_gallery_' + gallerySlotIndex, dataUrl);
      localStorage.setItem('gege_gallery_type_' + gallerySlotIndex, type);
      
      showToast('格格' + gallerySlotIndex + '号展示位更新成功！');
    };
    reader.readAsDataURL(file);
  });
}

function loadGallerySlots() {
  for (var i = 1; i <= 3; i++) {
    var data = localStorage.getItem('gege_gallery_' + i);
    var type = localStorage.getItem('gege_gallery_type_' + i);
    var slot = document.getElementById('gallerySlot' + i);
    if (data && slot) {
      if (type === 'video') {
        slot.innerHTML = '<video src="' + data + '" controls style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video>';
      } else {
        slot.innerHTML = '<img src="' + data + '" alt="格格' + i + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
      }
    }
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
  var btn = document.getElementById('trainingQuickBtn');
  var archiveBtn = document.getElementById('archiveQuickBtn');
  var galleryBtn = document.getElementById('galleryQuickBtn');
  var topBtn = document.getElementById('backTopBtn');
  var palacePage = document.getElementById('page-palace');
  
  var showBtns = palacePage && palacePage.classList.contains('active');
  
  if (btn) btn.classList.toggle('show', showBtns);
  if (archiveBtn) archiveBtn.classList.toggle('show', showBtns);
  if (galleryBtn) galleryBtn.classList.toggle('show', showBtns);
  
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
  loadTrainingTiers();
  renderTributeGrid();
  checkGalleryLock();
}

// 启动
init();
loadGalleryAndTraining();
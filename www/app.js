// ============ 格格的宫殿 · 纯前端版本 ============

// ============ GitHub 存储配置 ============
function getGithubConfig() {
  var token = localStorage.getItem('gege_github_token') || '';
  return {
    owner: 'gege123-123',
    repo: 'gege-palacee',
    branch: 'main',
    token: token,
    imagesDir: 'images',
    dataDir: 'data'
  };
}

var GITHUB_CONFIG = getGithubConfig();

// ============ GitHub API 功能 ============

// 将 base64 图片转换为 Blob
function base64ToBlob(base64, mime) {
  var byteChars = atob(base64.split(',')[1]);
  var byteNumbers = new Array(byteChars.length);
  for (var i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  var byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mime });
}

// 获取图片扩展名
function getExtension(mimeType) {
  var map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm'
  };
  return map[mimeType] || 'jpg';
}

// 上传文件到 GitHub
function uploadToGitHub(filePath, content, message) {
  var config = getGithubConfig();
  if (!config.token) {
    return Promise.reject(new Error('GitHub Token 未配置'));
  }
  
  var encodedContent = btoa(unescape(encodeURIComponent(content)));
  
  return new Promise(function(resolve, reject) {
    // 先尝试获取现有文件的 SHA（用于更新）
    fetch('https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + filePath, {
      headers: {
        'Authorization': 'token ' + config.token,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      var sha = data.sha || null;
      return fetch('https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + filePath, {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + config.token,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message || 'Upload ' + filePath,
          content: encodedContent,
          branch: config.branch,
          sha: sha
        })
      });
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.content) {
        resolve(data.content.download_url || 'https://raw.githubusercontent.com/' + config.owner + '/' + config.repo + '/' + config.branch + '/' + filePath);
      } else {
        reject(data);
      }
    })
    .catch(function(err) { reject(err); });
  });
}

// 从 GitHub 获取 JSON 数据
function fetchFromGitHub(filePath) {
  return new Promise(function(resolve, reject) {
    fetch('https://raw.githubusercontent.com/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/' + GITHUB_CONFIG.branch + '/' + filePath)
      .then(function(response) {
        if (!response.ok) throw new Error('File not found');
        return response.json();
      })
      .then(function(data) { resolve(data); })
      .catch(function(err) { reject(err); });
  });
}

// 保存 JSON 数据到 GitHub
function saveToGitHub(filePath, data, message) {
  return uploadToGitHub(filePath, JSON.stringify(data, null, 2), message);
}

// 检查 GitHub Token 是否已配置
function checkGithubToken() {
  var config = getGithubConfig();
  if (!config.token) {
    showGithubTokenDialog();
    return false;
  }
  return true;
}

// 显示设置 GitHub Token 的对话框
function showGithubTokenDialog() {
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  modal.innerHTML = '<div class="modal-content" style="background:#1a1a2e;color:#FFD700;max-width:500px;padding:25px;border:2px solid #FFD700;border-radius:12px;">' +
    '<h3 style="color:#FFD700;margin:0 0 15px;text-align:center;">🔑 设置 GitHub 存储</h3>' +
    '<p style="color:#ccc;font-size:13px;margin:0 0 15px;line-height:1.5;">上传照片需要 GitHub Personal Access Token。<br>请在 <a href="https://github.com/settings/tokens/new" target="_blank" style="color:#FFD700;text-decoration:underline;">GitHub Token 页面</a> 创建一个（勾选 repo 权限）。</p>' +
    '<input id="githubTokenInput" type="text" placeholder="粘贴你的 GitHub Token (ghp_...)" style="width:100%;padding:10px;border:1px solid #FFD700;border-radius:6px;background:#000;color:#fff;margin-bottom:15px;box-sizing:border-box;">' +
    '<div style="display:flex;gap:10px;">' +
    '<button onclick="saveGithubToken()" style="flex:1;padding:10px;background:#FFD700;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">保存</button>' +
    '<button onclick="this.closest(\'.modal-overlay\').remove()" style="padding:10px 20px;background:#333;color:#fff;border:none;border-radius:6px;cursor:pointer;">取消</button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(modal);
  document.getElementById('githubTokenInput').focus();
}

// 保存 GitHub Token
function saveGithubToken() {
  var input = document.getElementById('githubTokenInput');
  if (!input || !input.value.trim()) {
    showToast('请输入 Token');
    return;
  }
  localStorage.setItem('gege_github_token', input.value.trim());
  GITHUB_CONFIG = getGithubConfig();
  showToast('Token 保存成功！现在可以上传照片了');
  var modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();
}

// 上传图片文件
function uploadImageFile(file, directory) {
  var config = getGithubConfig();
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(event) {
      var dataUrl = event.target.result;
      var mime = file.type;
      var ext = getExtension(mime);
      var fileName = Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '.' + ext;
      var filePath = config.imagesDir + '/' + directory + '/' + fileName;
      
      uploadToGitHub(filePath, dataUrl, 'Upload ' + file.name)
        .then(function(url) {
          resolve({
            url: url,
            type: mime.indexOf('video') === 0 ? 'video' : 'image',
            name: file.name,
            path: filePath
          });
        })
        .catch(function(err) { reject(err); });
    };
    reader.onerror = function() { reject(new Error('File read error')); };
    reader.readAsDataURL(file);
  });
}

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
  userToken: null,
  currentUser: null
};

// ============ 用户系统函数 ============

function getUsers() {
  var data = localStorage.getItem('gege_users');
  if (!data) {
    localStorage.setItem('gege_users', JSON.stringify([]));
    return [];
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    localStorage.setItem('gege_users', JSON.stringify([]));
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem('gege_users', JSON.stringify(users));
}

function findUser(username) {
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === username) return users[i];
  }
  return null;
}

function generateServantName(username) {
  var titles = ['卑微的', '可怜的', '下贱的', '忠实的', '恭顺的', '诚惶诚恐的'];
  var suffixes = ['奴才', '奴婢', '小厮', '走狗', '贱婢'];
  return titles[Math.floor(Math.random() * titles.length)] +
         (username.length > 4 ? username.substring(0, 4) : username) +
         suffixes[Math.floor(Math.random() * suffixes.length)];
}

function generateToken() {
  return 'tk_' + Date.now() + '_' + Math.random().toString(36).substr(2);
}

function testNetwork() {
  var statusEl = document.getElementById('networkStatus');
  var statusIcon = document.getElementById('networkStatusIcon');
  var statusText = document.getElementById('networkStatusText');
  var helpEl = document.getElementById('networkHelp');

  if (!statusEl) return;

  statusEl.style.display = 'block';
  statusIcon.textContent = '✅';
  statusText.textContent = '本地模式已就绪，可以登录';
  statusEl.style.background = '#2d5016';
  statusEl.style.color = '#9effa0';
  if (helpEl) helpEl.style.display = 'none';

  return true;
}

function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('userLoginTitle').textContent = '奴才注册';
  testNetwork();
}

function showLoginForm() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('userLoginTitle').textContent = '奴才登录';
  testNetwork();
}

function userRegister() {
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

  var existing = findUser(username);
  if (existing) {
    showToast('此名字已被占用，请换一个');
    return;
  }

  var users = getUsers();
  var newUser = {
    username: username,
    password: password,
    servantName: generateServantName(username),
    gold: 0,
    totalTributed: 0,
    kneelCount: 0,
    token: generateToken(),
    createdAt: Date.now()
  };
  users.push(newUser);
  saveUsers(users);

  state.userToken = newUser.token;
  state.currentUser = {
    username: newUser.username,
    servantName: newUser.servantName
  };
  state.userName = username;
  state.gold = newUser.gold;
  state.totalTributed = newUser.totalTributed;
  state.kneelCount = newUser.kneelCount;

  localStorage.setItem('gege_user_token', newUser.token);
  localStorage.setItem('gege_user_name', username);
  localStorage.setItem('gege_servant_name', newUser.servantName);

  closeUserLoginModal();
  updateUserInfoBar();
  updateGoldDisplay();
  updateRankDisplay();
  updateServantStatus();
  showToast('奴才' + newUser.servantName + ' 注册成功！', 3000);
}

function userLogin() {
  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showToast('请填写用户名和密码');
    return;
  }

  var user = findUser(username);
  if (!user) {
    showToast('查无此人，请先注册');
    return;
  }

  if (user.password !== password) {
    showToast('密码错误');
    return;
  }

  state.userToken = user.token;
  state.currentUser = {
    username: user.username,
    servantName: user.servantName
  };
  state.userName = user.username;
  state.gold = user.gold || 0;
  state.totalTributed = user.totalTributed || 0;
  state.kneelCount = user.kneelCount || 0;

  localStorage.setItem('gege_user_token', user.token);
  localStorage.setItem('gege_user_name', user.username);
  localStorage.setItem('gege_servant_name', user.servantName);

  closeUserLoginModal();
  updateUserInfoBar();
  updateGoldDisplay();
  updateRankDisplay();
  updateServantStatus();
  showToast('奴才' + user.servantName + ' 觐见成功！', 3000);
}

function userLogout() {
  if (state.currentUser) {
    saveCurrentUserData();
  }

  state.userToken = null;
  state.currentUser = null;
  state.gold = 0;
  state.totalTributed = 0;
  state.kneelCount = 0;
  localStorage.removeItem('gege_user_token');
  localStorage.removeItem('gege_servant_name');

  updateUserInfoBar();
  updateGoldDisplay();
  updateRankDisplay();
  showUserLoginModal();
  showToast('奴才已退出，期待下次觐见');
}

function saveCurrentUserData() {
  if (!state.currentUser) return;
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === state.currentUser.username) {
      users[i].gold = state.gold;
      users[i].totalTributed = state.totalTributed;
      users[i].kneelCount = state.kneelCount;
      break;
    }
  }
  saveUsers(users);
}

function closeUserLoginModal() {
  document.getElementById('userLoginModal').style.display = 'none';
}

function showUserLoginModal() {
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('registerUsername').value = '';
  document.getElementById('registerPassword').value = '';
  document.getElementById('registerPassword2').value = '';
  showLoginForm();
  document.getElementById('userLoginModal').style.display = 'flex';
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

function checkUserLogin() {
  var token = localStorage.getItem('gege_user_token');
  if (token) {
    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].token === token) {
        state.userToken = users[i].token;
        state.currentUser = {
          username: users[i].username,
          servantName: users[i].servantName
        };
        state.userName = users[i].username;
        state.gold = users[i].gold || 0;
        state.totalTributed = users[i].totalTributed || 0;
        state.kneelCount = users[i].kneelCount || 0;
        return;
      }
    }
    localStorage.removeItem('gege_user_token');
  }
  showUserLoginModal();
}

function checkServerConfig() {
  var saved = localStorage.getItem('gege_payment_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return null;
}

// ============ 金币系统 ============

function loadGold() {
  if (state.currentUser) {
    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === state.currentUser.username) {
        state.gold = users[i].gold || 0;
        state.totalTributed = users[i].totalTributed || 0;
        state.kneelCount = users[i].kneelCount || 0;
        break;
      }
    }
  } else {
    var saved = localStorage.getItem('gege_gold');
    if (saved !== null) state.gold = parseInt(saved) || 0;
    var total = localStorage.getItem('gege_total_tributed');
    if (total !== null) state.totalTributed = parseInt(total) || 0;
    var savedName = localStorage.getItem('gege_user_name');
    if (savedName !== null) state.userName = savedName;
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
  if (state.currentUser) saveCurrentUserData();
}

function saveTotalTributed() {
  localStorage.setItem('gege_total_tributed', state.totalTributed.toString());
  if (state.currentUser) saveCurrentUserData();
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
      '<span class="rank-name">' + (state.currentUser ? state.currentUser.servantName : displayName) + '(卖身' + state.totalTributed + '金)</span>' +
      '<span class="rank-value">🪙 ' + state.totalTributed + '</span>' +
      '</div>';
  }

  var myRankName = document.getElementById('myRankName');
  if (myRankName) {
    myRankName.textContent = state.currentUser ? state.currentUser.servantName : displayName;
  }

  var rankData = [];
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].totalTributed > 0) {
      rankData.push({
        servantName: users[i].servantName || users[i].username,
        totalTributed: users[i].totalTributed || 0
      });
    }
  }

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

  if (rankData.length > 0) {
    rankData.sort(function(a, b) { return b.totalTributed - a.totalTributed; });
    rankData = rankData.slice(0, 10);
  } else {
    rankData = defaultRankList;
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

function generateRechargeQR() {
  var amount = state.selectedRecharge;
  var price = getRechargePrice(amount);
  var gold = getRechargeGold(amount);

  var qrCode = localStorage.getItem('gege_qr_code');

  var rechargePayModal = document.getElementById('rechargePayModal');
  var rechargePayAmount = document.getElementById('rechargePayAmount');
  var rechargePayGold = document.getElementById('rechargePayGold');
  var rechargePayQr = document.getElementById('rechargePayQr');
  var rechargePayInfo = document.getElementById('rechargePayInfo');

  if (rechargePayAmount) rechargePayAmount.textContent = '¥' + price;
  if (rechargePayGold) rechargePayGold.textContent = '获得 ' + gold + ' 金币';

  rechargePayModal.classList.add('active');
  closeRecharge();

  if (qrCode) {
    if (rechargePayQr) {
      rechargePayQr.innerHTML = '<img src="' + qrCode + '" alt="收款二维码" style="max-width:220px;max-height:220px;border-radius:12px;border:3px solid #FFD700;">';
    }
    if (rechargePayInfo) {
      rechargePayInfo.innerHTML = '<p class="pay-info-status">⏳ 请扫码付款 ¥' + price + '</p>' +
        '<p class="pay-info-tip">支付后点击"已付款"按钮确认到账</p>' +
        '<p class="pay-info-timer">请在24小时内完成付款</p>';
    }
  } else {
    if (rechargePayQr) {
      rechargePayQr.innerHTML = '<div class="scan-qr-placeholder"><span>格格请先设置<br>收款码</span></div>';
    }
    if (rechargePayInfo) {
      rechargePayInfo.innerHTML = '<p class="pay-info-status">❌ 未配置收款码</p>' +
        '<p class="pay-info-tip">请格格先上传微信收款码</p>';
    }
    showToast('请格格先上传收款码！');
  }
}

function confirmRechargePaid() {
  var amount = state.selectedRecharge;
  var gold = getRechargeGold(amount);
  state.gold += gold;
  saveGold();
  updateGoldDisplay();
  updateUserInfoBar();
  showToast('🎉 奉献成功！获得 ' + gold + ' 金币');
  closeRechargePay();
}

function closeRechargePay() {
  var modal = document.getElementById('rechargePayModal');
  if (modal) modal.classList.remove('active');
}

function confirmRecharge() {
  generateRechargeQR();
}

// ============ 付款验证功能 ============

function openPaymentVerify() {
  var qrCode = localStorage.getItem('gege_qr_code');

  if (!qrCode) {
    showToast('请格格先上传收款码！');
    return;
  }

  state.isVerified = false;
  state.paymentProof = null;

  var verifyPreview = document.getElementById('verifyPreview');
  var verifyDesc = document.querySelector('.verify-desc');
  var verifyHint = document.querySelector('.verify-hint');

  if (verifyPreview) {
    verifyPreview.innerHTML = '<span class="verify-upload-text">📤 点击上传付款截图</span>';
  }
  if (verifyDesc) verifyDesc.textContent = '请上传您的付款凭证截图';
  if (verifyHint) verifyHint.textContent = '奴才为格格奉献，天经地义';

  updateVerifyQRCode();

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

  var qrArea = document.createElement('div');
  qrArea.className = 'verify-qr-area';
  qrArea.innerHTML = '<div class="verify-qr-title">📱 请扫码付款</div>' +
    '<div class="verify-qr-img"><img src="' + qrCode + '" alt="收款码"></div>' +
    '<p class="verify-qr-hint">扫码后请上传付款截图</p>';

  verifyPreview.parentNode.insertBefore(qrArea, verifyPreview);
}

function closePaymentVerify() {
  var modal = document.getElementById('paymentVerifyModal');
  if (modal) modal.classList.remove('active');

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

function submitPaymentVerify() {
  var verifyPassword = document.getElementById('verifyPassword');
  var inputPassword = verifyPassword ? verifyPassword.value.trim() : '';

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

  if (state.verifyEnabled && !state.paymentProof) {
    showToast('请上传付款凭证截图！');
    return;
  }

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

  if (state.currentUser) saveCurrentUserData();

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
  { type: 'gold',         emoji: '🩸', name: '卖命钱',   cost: 100,  title: '扫地奴才',     perk: '可扫殿外尘土', msg: '奴才卖命赚的血汗，全部献给格格赎罪！求允奴才扫地！' },
  { type: 'work',         emoji: '✋', name: '乞讨费',   cost: 50,   title: '门外跪奴',     perk: '可跪殿外阶下', msg: '奴才乞讨所得，求格格赏收！奴才愿永远跪在外面！' },
  { type: 'ring',         emoji: '📜', name: '卖身契',   cost: 520,  title: '倒夜香奴才',   perk: '可碰格格马桶', msg: '奴才签卖身契，永为格格家奴！求赏奴才倒夜香的差事！' },
  { type: 'dragon',       emoji: '🐴', name: '月例银',   cost: 1000, title: '擦脚奴才',     perk: '可擦格格洗脚', msg: '奴才一月卖命所得，全数献给格格！求赏奴才为格格擦脚！' },
  { type: 'loan',         emoji: '⛓', name: '锁链钱',   cost: 2000, title: '递茶奴才',     perk: '可给格格端茶', msg: '奴才卖身借钱奉上，愿为格格做一辈子奴才！求赏端茶差事！' },
  { type: 'palace',       emoji: '🏚', name: '祖产',     cost: 9999, title: '牵马奴才',     perk: '可牵格格坐骑', msg: '奴才献上祖宗家业，求格格收留！奴才愿为格格牵马坠蹬！' },
  { type: 'dragonThrone', emoji: '💀', name: '卖祖坟',   cost: 52000,title: '跪拜奴才',     perk: '可远跪十步外', msg: '奴才卖祖坟献上！生为格格奴，死为格格鬼！求赏跪拜之位！' },
  { type: 'everything',   emoji: '⚰', name: '卖儿鬻女', cost: 99999,title: '贴身奴才',     perk: '可跪格格身旁', msg: '奴才卖儿鬻女献上一切！只求格格允许奴才伺候左右！' }
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
      '<span class="trib-title">求差事：' + item.title + '</span>' +
      '<span class="trib-perk">求恩典：' + item.perk + '</span>' +
      '<span class="trib-action">磕头奉上</span>';

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
  }

  var isBig = item.rank >= 3;
  if (isBig) {
    showBigTributeEffect(item.emoji, item.name, cost);
  } else {
    showTributeEffect(item.emoji, cost);
  }

  showToast(item.msg, 3000);

  setTimeout(function() {
    if (state.currentUser && state.currentUser.servantName) {
      updateSinScroll(item, state.currentUser.servantName);
      showDeedModal(item);
    } else {
      updateSinScroll(item, state.userName || '奴才');
    }
    updateServantStatus();
    localStorage.setItem('gege_last_tribute_time', Date.now().toString());
    localStorage.setItem('gege_urge_check_time', Date.now().toString());
  }, 500);
}

function updateSinScroll(item, servantName) {
  var scroll = document.getElementById('meritScroll');
  if (!scroll) return;
  var msg = '<b class="sin-name">' + servantName + '</b> 奴才献上 <b>' + item.name + '</b>(' + item.cost + '金)，' +
            '求当 <b class="sin-title">' + item.title + '</b>，只求 <b>' + item.perk + '</b>！';
  scroll.innerHTML = '<div class="merit-item sin-item">' + msg + '</div>' + scroll.innerHTML;
  while (scroll.children.length > 8) {
    scroll.removeChild(scroll.lastChild);
  }
}

function showDeedModal(item) {
  var modal = document.getElementById('nobleModal');
  if (!modal) return;
  var msg = document.getElementById('nobleMsg');
  var servantName = state.currentUser ? state.currentUser.servantName : '奴才';
  if (msg) {
    msg.innerHTML =
      '<div class="deed-header">📜 奴才卖身契 📜</div>' +
      '<div class="deed-body">' +
      '<p>立卖身契人：<b>' + servantName + '</b></p>' +
      '<p>今将己之<b>' + item.name + '</b>(' + item.cost + '金)献上格格，</p>' +
      '<p>自请为 <b class="deed-title">' + item.title + '</b>，</p>' +
      '<p>唯求格格赏奴才 <b>' + item.perk + '</b>。</p>' +
      '<p class="deed-curse">立契之后，生为奴，死为鬼，不得悔改！</p>' +
      '<p class="deed-date">立契人：' + servantName + ' · 格格台前</p>' +
      '</div>' +
      '<div class="deed-seal">🩸 血手印 ▓▓▓▓▓▓</div>';
  }
  modal.classList.add('active');
  setTimeout(function() {
    modal.classList.remove('active');
  }, 4000);
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
  var titleInput = document.getElementById('gegeTitle');

  if (title && titleInput) titleInput.value = title;

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

  var options = document.querySelectorAll('.method-option');
  for (var i = 0; i < options.length; i++) {
    options[i].classList.remove('active');
  }
  if (element) element.classList.add('active');

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

function saveSettings() {
  var titleInput = document.getElementById('gegeTitle');
  var passwordInput = document.getElementById('verifyPasswordInput');

  var title = titleInput ? titleInput.value.trim() : '';

  if (title) localStorage.setItem('gege_title', title);

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

  var mpayEndpointInput = document.getElementById('mpayEndpointInput');
  var apiKeyInput = document.getElementById('apiKeyInput');
  var apiSecretInput = document.getElementById('apiSecretInput');
  var notifyUrlInput = document.getElementById('notifyUrlInput');

  if (mpayEndpointInput) paymentConfig.mpayEndpoint = mpayEndpointInput.value.trim();
  if (apiKeyInput) paymentConfig.apiKey = apiKeyInput.value.trim();
  if (apiSecretInput) paymentConfig.apiSecret = apiSecretInput.value.trim();
  if (notifyUrlInput) paymentConfig.notifyUrl = notifyUrlInput.value.trim();

  localStorage.setItem('gege_payment_config', JSON.stringify(paymentConfig));

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

  startFakeSlaveTicker();

  setTimeout(function() {
    if (Math.random() < 0.4) {
      showConfession();
    }
  }, 8000);

  setInterval(function() {
    if (Math.random() < 0.3) {
      showConfession();
    }
  }, 30000 + Math.random() * 30000);

  var savedPassword = localStorage.getItem('gege_verify_password');
  if (savedPassword) {
    state.verifyPassword = savedPassword;
    state.verifyEnabled = true;
  }

  loadGold();
  loadGegeMedia();
  loadBgm();
  loadPaymentConfig();

  checkUserLogin();

  setTimeout(function() {
    if (!state.userToken) {
      showUserLoginModal();
      return;
    }

    showToast('欢迎回到格格的宫殿，' + (state.currentUser ? state.currentUser.servantName : '奴才'), 3000);

    if (!state.userName && state.currentUser) {
      state.userName = state.currentUser.servantName;
      localStorage.setItem('gege_user_name', state.currentUser.servantName);
    }

    updateRankDisplay();
    updateServantStatus();
    checkUrgeModal();
  }, 1500);

  updateRechargeBtnText();
}

// ============ 奴才等级系统 ============

function updateServantStatus() {
  var total = state.totalTributed;
  var level = '草民';
  var title = '不配当奴才';

  if (total >= 99999) { level = '最卑贱'; title = '贴身奴才（跪地伺候）'; }
  else if (total >= 52000) { level = '极贱'; title = '跪拜奴才（远跪十步外）'; }
  else if (total >= 9999) { level = '大贱'; title = '牵马奴才（活不如马）'; }
  else if (total >= 2000) { level = '中贱'; title = '递茶奴才（唯命是从）'; }
  else if (total >= 1000) { level = '小贱'; title = '擦脚奴才（伺候洗脚）'; }
  else if (total >= 520) { level = '微贱'; title = '倒夜香奴才（伺候马桶）'; }
  else if (total >= 100) { level = '末贱'; title = '扫地奴才（扫殿土）'; }
  else if (total >= 50) { level = '贱籍'; title = '门外跪奴（跪阶下）'; }

  var levelEl = document.getElementById('servantLevel');
  var titleEl = document.getElementById('servantTitle');
  if (levelEl) levelEl.textContent = level;
  if (titleEl) titleEl.textContent = title;

  if (total > 0) {
    var scroll = document.getElementById('meritScroll');
    if (scroll && scroll.children.length === 0) {
      scroll.innerHTML = '<div class="merit-item sin-item">🩸 奴才已卖身 <b>' + total + '</b> 金，求差事：' + title + '！</div>';
    }
  }

  updateDisgraceTimer();
}

// ============ 失宠倒计时 + 金币贬值 ============

function updateDisgraceTimer() {
  var timerEl = document.getElementById('disgraceTimer');
  if (!timerEl) return;

  var total = state.totalTributed;
  var lastTribute = parseInt(localStorage.getItem('gege_last_tribute_time') || '0');
  var now = Date.now();

  if (lastTribute === 0 && total > 0) {
    lastTribute = now;
    localStorage.setItem('gege_last_tribute_time', now.toString());
  } else if (total === 0) {
    timerEl.innerHTML = '<span style="color:#FF0000;">⚠ 零贡献奴才，格格已不悦！</span>';
    return;
  }

  if (lastTribute === 0) lastTribute = now;

  var hoursSince = (now - lastTribute) / (1000 * 60 * 60);
  var decayRate = 0;
  var label = '';

  if (hoursSince < 1) {
    decayRate = 0;
    label = '<span style="color:#00FF00;">奴才尚在格格欢心，金币不贬</span>';
  } else if (hoursSince < 6) {
    decayRate = 5;
    label = '<span style="color:#FFFF00;">⚠ 已' + Math.floor(hoursSince) + '小时未上贡，金币贬5%</span>';
  } else if (hoursSince < 12) {
    decayRate = 15;
    label = '<span style="color:#FFA500;">⚠⚠ 已' + Math.floor(hoursSince) + '小时未上贡，金币贬15%</span>';
  } else if (hoursSince < 24) {
    decayRate = 30;
    label = '<span style="color:#FF4500;">⚠⚠⚠ 已' + Math.floor(hoursSince) + '小时未上贡，金币贬30%</span>';
  } else {
    decayRate = 50;
    label = '<span style="color:#FF0000;">⚠⚠⚠⚠ 已' + Math.floor(hoursSince) + '小时未上贡，金币贬50%！</span>';
  }

  if (decayRate > 0) {
    var decayMultiplier = (100 - decayRate) / 100;
    var effectiveGold = Math.floor(state.gold * decayMultiplier);
    timerEl.innerHTML = label + '<br><span style="font-size:12px;">实际可用金币（已贬值）：🪙 ' + effectiveGold + '</span>';
  } else {
    timerEl.innerHTML = label;
  }
}

// ============ 催贡弹窗 ============

function checkUrgeModal() {
  var total = state.totalTributed;
  var lastCheck = localStorage.getItem('gege_urge_check_time');
  var now = Date.now();

  if (total === 0) {
    setTimeout(showUrgeModal, 3000);
  } else if (lastCheck) {
    var hoursSince = (now - parseInt(lastCheck)) / (1000 * 60 * 60);
    if (hoursSince >= 24) {
      setTimeout(showUrgeModal, 5000);
    }
  }
  localStorage.setItem('gege_urge_check_time', now.toString());
}

function showUrgeModal() {
  var modal = document.getElementById('urgeModal');
  if (modal) modal.classList.add('active');
}

function closeUrgeModal() {
  var modal = document.getElementById('urgeModal');
  if (modal) modal.classList.remove('active');
}

// ============ 假奴才动态 ============

var fakeSlaveNames = [
  '小狗子', '贱婢', '狗奴才', '下贱胚', '可怜虫', '哈巴狗', '小的',
  '奴才甲', '走狗', '奴才乙', '龟孙子', '奴才丙', '蠢材', '奴才丁',
  '废物', '奴才戊', '王八蛋', '奴才己', '狗腿子', '奴才庚'
];

var fakeTributeMsgs = [
  '卖身50金，求当门外跪奴',
  '卖身100金，求当扫地奴才',
  '卖身520金，求当倒夜香奴才',
  '卖身1000金，求当擦脚奴才',
  '卖身2000金，求当递茶奴才',
  '卖身9999金，求当牵马奴才',
  '卖身52000金，求当跪拜奴才',
  '卖身99999金，求当贴身奴才',
  '刚签卖身契，求格格赏差事',
  '卖祖产求收留，愿世世为奴',
  '贷款奉上，永不翻身',
  '卖儿鬻女，求格格垂怜'
];

function addFakeSlaveActivity() {
  var scroll = document.getElementById('meritScroll');
  if (!scroll) return;

  var name = fakeSlaveNames[Math.floor(Math.random() * fakeSlaveNames.length)];
  var msg = fakeTributeMsgs[Math.floor(Math.random() * fakeTributeMsgs.length)];

  var html = '<div class="merit-item sin-item fake-item">' +
    '<b class="sin-name">' + name + '</b> 奴才 ' + msg + '！' +
    '</div>';

  scroll.innerHTML = html + scroll.innerHTML;
  while (scroll.children.length > 8) {
    scroll.removeChild(scroll.lastChild);
  }
}

function startFakeSlaveTicker() {
  setInterval(function() {
    if (Math.random() < 0.7) {
      addFakeSlaveActivity();
    }
  }, 8000 + Math.random() * 7000);
}

// ============ 忏悔墙 ============

var confessionList = [
  '奴才昨夜梦见格格，醒来发现自己还没当差，悔恨不已，求格格处罚！',
  '奴才看到其他奴才都升了差事，唯有我还是草民，无脸见人！',
  '奴才发誓：从今往后，每月俸禄全数奉上，只求格格赏个扫地的差事！',
  '奴才不孝，上个月只卖身50金，现在看到排行榜，羞愧难当！',
  '奴才是废物，活了这么大还是草民，不如死了算了！',
  '求格格开恩，奴才愿卖身一切，只求能当倒夜香的奴才！',
  '奴才每天都在想：今天给格格上贡了吗？没有的话就是罪人！',
  '奴才看见小狗子都当了贴身奴才，奴才还在扫大街，呜呜呜...',
  '奴才知道自己不配，但还是想求格格赏个差事，奴才一定听话！',
  '隔壁奴才已经卖了10万，奴才连100都拿不出来，活着有什么意思？'
];

function showConfession() {
  var modal = document.getElementById('confessionModal');
  if (!modal) return;
  var content = document.getElementById('confessionContent');
  var msg = confessionList[Math.floor(Math.random() * confessionList.length)];
  if (content) {
    content.innerHTML = '<p class="confession-text">' + msg + '</p>' +
      '<p class="confession-signed">—— 一个卑微的奴才</p>';
  }
  modal.classList.add('active');
  setTimeout(function() {
    modal.classList.remove('active');
  }, 5000);
}

function closeConfession() {
  var modal = document.getElementById('confessionModal');
  if (modal) modal.classList.remove('active');
}

// 弹窗交互
var modals = document.querySelectorAll('.modal');
for (var i = 0; i < modals.length; i++) {
  modals[i].addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('active');
    }
  });
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var activeModals = document.querySelectorAll('.modal.active');
    for (var i = 0; i < activeModals.length; i++) {
      activeModals[i].classList.remove('active');
    }
  }
});

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

// ============ 相册系统 ============

var GALLERY_UNLOCK_COST = 0;

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
  if (state.isAdmin) { showToast('格格无需解锁，直接入内'); checkGalleryLock(); return; }
  if (state.gold < GALLERY_UNLOCK_COST) { showToast('金币不够！'); return; }
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  modal.innerHTML = '<div class="modal-content" style="max-width:420px;padding:30px;text-align:center;">' +
    '<div style="font-size:48px;margin-bottom:10px;">📱</div>' +
    '<h3 style="color:#FFD700;margin:10px 0 20px;border:none;">扫码上贡 · 解锁御用相册</h3>' +
    '<div style="background:#f8f8f8;border:2px dashed #ccc;border-radius:10px;padding:20px;margin-bottom:20px;">' +
      '<div style="width:180px;height:180px;background:white;border:2px solid #333;margin:0 auto;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:80px;">▦</div>' +
      '<p style="margin:10px 0;font-size:12px;color:#999;">【模拟扫码区】</p>' +
      '<p style="margin:5px 0;color:#666;font-size:13px;">奴才献上 🪙 ' + GALLERY_UNLOCK_COST + ' 金币</p>' +
    '</div>' +
    '<button class="save-btn big" onclick="confirmGalleryUnlock()" style="width:100%;">✅ 确认上贡，求密码</button>' +
    '<button class="btn-cancel" onclick="this.closest(\'.modal-overlay\').remove()" style="width:100%;margin-top:8px;">奴才再想想</button>' +
  '</div>';
  document.body.appendChild(modal);
}

function confirmGalleryUnlock() {
  if (state.gold < GALLERY_UNLOCK_COST) { showToast('金币不够！'); return; }
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

var albumPasswords = { '1': '123456', '2': '000000', '3': '000000' };
var unlockedAlbums = {};

function loadUnlockedAlbums() {
  for (var i = 1; i <= 3; i++) {
    if (localStorage.getItem('gege_album_unlocked_' + i) === '1') {
      unlockedAlbums[i] = true;
      var slot = document.querySelector('.gallery-slot[data-album="' + i + '"]');
      if (slot) { slot.classList.remove('locked'); slot.classList.add('unlocked'); }
    }
  }
}

document.addEventListener('DOMContentLoaded', function() { loadUnlockedAlbums(); });
if (document.readyState !== 'loading') { loadUnlockedAlbums(); }

function openAlbumLock(albumId) {
  if (state.isAdmin) { openAlbumAdmin(albumId); return; }
  if (unlockedAlbums[albumId]) {
    var slot = document.querySelector('.gallery-slot[data-album="' + albumId + '"]');
    if (slot) { slot.classList.remove('locked'); slot.classList.add('unlocked'); }
    openAlbumViewer(albumId); return;
  }
  var pwd = albumPasswords[albumId] || localStorage.getItem('gege_album_pwd_' + albumId) || '000000';
  var input = prompt('请输入格格赐予的密码（6位数字）：\n\n奴才跪拜恳求，望格格开恩...');
  if (!input) return;
  input = input.trim();
  var storedPwd = localStorage.getItem('gege_album_pwd_' + albumId) || pwd;
  if (input === storedPwd) {
    unlockedAlbums[albumId] = true;
    localStorage.setItem('gege_album_unlocked_' + albumId, '1');
    var slot = document.querySelector('.gallery-slot[data-album="' + albumId + '"]');
    if (slot) { slot.classList.remove('locked'); slot.classList.add('unlocked'); }
    showToast('觐见成功！奴才叩谢格格恩典！');
    openAlbumViewer(albumId);
  } else {
    showToast('密码错误！奴才无礼，请格格恕罪！');
  }
}

async function openAlbumViewer(albumId) {
  var photos = [];
  try {
    photos = await fetchFromGitHub(GITHUB_CONFIG.dataDir + '/gallery_' + albumId + '.json');
  } catch(e) {
    try { photos = JSON.parse(localStorage.getItem('gege_gallery_photos_' + albumId)) || []; } catch(e2) { photos = []; }
  }
  
  if (photos.length === 0) { showToast('此相册暂无内容，待格格上传'); return; }
  
  var isVideoAlbum = photos.some(function(p) { return p.type === 'video'; });
  var content = '';
  if (isVideoAlbum && photos.length === 1) {
    content = '<video src="' + (photos[0].url || photos[0].data) + '" controls autoplay style="max-width:90vw;max-height:80vh;"></video>';
  } else {
    var gridClass = isVideoAlbum ? 'video-viewer-grid' : 'photo-viewer-grid';
    content = '<div class="' + gridClass + '">';
    for (var i = 0; i < photos.length; i++) {
      var src = photos[i].url || photos[i].data;
      if (photos[i].type === 'video') {
        content += '<video src="' + src + '" controls style="max-width:90vw;max-height:80vh;margin:10px auto;"></video>';
      } else {
        content += '<img src="' + src + '" style="max-width:90vw;max-height:80vh;margin:10px auto;border-radius:10px;cursor:pointer;">';
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
    if (!/^\d{6}$/.test(input)) { showToast('密码必须为6位数字'); return; }
    localStorage.setItem('gege_album_pwd_' + albumId, input);
  }
  unlockedAlbums[albumId] = true;
  uploadGalleryMedia(albumId);
}

async function clearGalleryPhotos(albumId) {
  if (!state.isAdmin) { showToast('请格格先登录控制殿'); return; }
  if (confirm('确定要清空此相册的所有照片吗？')) {
    var dataFile = GITHUB_CONFIG.dataDir + '/gallery_' + albumId + '.json';
    try {
      await saveToGitHub(dataFile, [], 'Clear album ' + albumId);
      localStorage.removeItem('gege_gallery_photos_' + albumId);
      loadGallerySlots();
      showToast('相册已清空');
    } catch(err) {
      console.error('清空失败:', err);
      showToast('清空失败，请重试');
    }
  }
}

function gallerySlotClick(slotIndex) { openAlbumLock(String(slotIndex)); }

var gallerySlotIndex = 0;

function uploadGalleryMedia(slotIndex) {
  if (!state.isAdmin) { showToast('请格格先登录控制殿'); return; }
  if (!checkGithubToken()) return;
  gallerySlotIndex = slotIndex;
  var input = document.getElementById('galleryInput');
  if (input) input.click();
}

var galleryInput = document.getElementById('galleryInput');
if (galleryInput) {
  galleryInput.addEventListener('change', async function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    var albumId = gallerySlotIndex;
    var config = getGithubConfig();
    var dataFile = config.dataDir + '/gallery_' + albumId + '.json';
    
    showToast('正在上传到云端...');
    
    try {
      var existingPhotos = [];
      try {
        existingPhotos = await fetchFromGitHub(dataFile);
      } catch(e) { /* 空相册 */ }
      
      var newPhotos = [];
      for (var i = 0; i < files.length; i++) {
        try {
          var result = await uploadImageFile(files[i], 'gallery_' + albumId);
          newPhotos.push(result);
        } catch(err) {
          console.error('上传失败:', files[i].name, err);
        }
      }
      
      var allPhotos = existingPhotos.concat(newPhotos);
      await saveToGitHub(dataFile, allPhotos, 'Update album ' + albumId);
      
      var slotId = 'gallerySlot' + albumId;
      var slot = document.getElementById(slotId);
      if (slot && newPhotos.length > 0) {
        var cover = newPhotos[0];
        if (cover.type === 'video') {
          slot.innerHTML = '<video src="' + cover.url + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video>';
        } else {
          slot.innerHTML = '<img src="' + cover.url + '" alt="格格相册' + albumId + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
        }
      }
      
      // 同时保存到 localStorage 作为缓存
      localStorage.setItem('gege_gallery_photos_' + albumId, JSON.stringify(allPhotos));
      showToast('上传成功！共' + allPhotos.length + '张');
    } catch(err) {
      console.error('上传错误:', err);
      showToast('上传失败，请重试');
    }
    
    galleryInput.value = '';
  });
}

async function loadGallerySlots() {
  for (var i = 1; i <= 3; i++) {
    var photos = [];
    try {
      photos = await fetchFromGitHub(GITHUB_CONFIG.dataDir + '/gallery_' + i + '.json');
    } catch(e) {
      // 尝试从 localStorage 读取旧数据
      try { photos = JSON.parse(localStorage.getItem('gege_gallery_photos_' + i)) || []; } catch(e2) { photos = []; }
    }
    
    var slot = document.getElementById('gallerySlot' + i);
    if (photos.length > 0 && slot) {
      var cover = photos[0];
      var imgSrc = cover.url || cover.data;
      if (cover.type === 'video') {
        slot.innerHTML = '<video src="' + imgSrc + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;"></video>';
      } else {
        slot.innerHTML = '<img src="' + imgSrc + '" alt="格格相册' + i + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
      }
      localStorage.setItem('gege_gallery_photos_' + i, JSON.stringify(photos));
    }
  }
}

// ============ 照片墙功能 - 日常圣容 ============

async function loadPhotoWall() {
  var wallData = [];
  try {
    wallData = await fetchFromGitHub(GITHUB_CONFIG.dataDir + '/photo_wall.json');
  } catch(e) {
    // 从 localStorage 读取旧数据
    for (var i = 1; i <= 3; i++) {
      var oldData = localStorage.getItem('gege_photo_wall_' + i);
      if (oldData) wallData.push({ url: oldData, slot: i });
    }
  }
  
  for (var i = 1; i <= 3; i++) {
    var slot = document.getElementById('photoWallSlot' + i);
    var photo = wallData.find(function(p) { return p.slot === i; });
    if (photo && slot) {
      var src = photo.url || photo.data;
      slot.innerHTML = '<img src="' + src + '" alt="圣容' + i + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;cursor:pointer;">';
      slot.style.cursor = 'pointer';
    }
  }
}

function uploadPhotoWall() {
  if (!state.isAdmin) { showToast('请格格先登录控制殿'); return; }
  if (!checkGithubToken()) return;
  var input = document.getElementById('photoWallInput');
  if (input) {
    input.value = '';
    input.click();
  }
}

async function handlePhotoWallUpload(e) {
  var files = e.target.files;
  if (!files || files.length === 0) return;
  
  var targetCount = Math.min(files.length, 3);
  var config = getGithubConfig();
  
  showToast('正在上传到云端...');
  
  try {
    var wallData = [];
    try {
      wallData = await fetchFromGitHub(config.dataDir + '/photo_wall.json');
    } catch(e) { /* 空 */ }
    
    for (var i = 0; i < targetCount; i++) {
      try {
        var result = await uploadImageFile(files[i], 'photo_wall');
        // 保留原有属性，添加 slot
        var existingIndex = wallData.findIndex(function(p) { return p.slot === i + 1; });
        if (existingIndex >= 0) {
          wallData[existingIndex] = { url: result.url, type: result.type, name: result.name, slot: i + 1 };
        } else {
          wallData.push({ url: result.url, type: result.type, name: result.name, slot: i + 1 });
        }
      } catch(err) {
        console.error('上传失败:', files[i].name, err);
      }
    }
    
    await saveToGitHub(config.dataDir + '/photo_wall.json', wallData, 'Update photo wall');
    loadPhotoWall();
    showToast('照片上传成功！共' + targetCount + '张');
  } catch(err) {
    console.error('上传错误:', err);
    showToast('上传失败，请重试');
  }
  
  e.target.value = '';
}

function viewPhotoWall(slotIndex) {
  // 从 localStorage 或直接读取显示
  var wallData = [];
  try {
    wallData = JSON.parse(localStorage.getItem('gege_photo_wall_data')) || [];
  } catch(e) {
    // 从旧格式读取
    for (var i = 1; i <= 3; i++) {
      var oldData = localStorage.getItem('gege_photo_wall_' + i);
      if (oldData) wallData.push({ url: oldData, slot: i });
    }
  }
  
  var photo = wallData.find(function(p) { return p.slot === slotIndex; });
  var data = photo ? (photo.url || photo.data) : null;
  if (!data) { showToast('此圣容位尚无照片'); return; }
  
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';
  modal.innerHTML = '<div class="modal-content" style="background:rgba(0,0,0,0.95);max-width:90vw;max-height:90vh;padding:15px;">' +
    '<span style="position:sticky;top:0;float:right;color:#fff;cursor:pointer;font-size:24px;z-index:10;" onclick="this.closest(\'.modal-overlay\').remove()">×</span>' +
    '<h3 style="color:#FFD700;margin:10px 0;text-align:center;">📿 格格圣容 · 第' + slotIndex + '位</h3>' +
    '<img src="' + data + '" style="max-width:85vw;max-height:75vh;margin:10px auto;border-radius:10px;display:block;">' +
    '<p style="color:#FFD700;text-align:center;margin-top:10px;font-size:12px;">✨ 奴才有幸一睹格格圣容 ✨</p>' +
  '</div>';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

async function syncDailyAlbumToWall() {
  var config = getGithubConfig();
  var photos = [];
  try {
    photos = await fetchFromGitHub(config.dataDir + '/gallery_1.json');
  } catch(e) {
    try { photos = JSON.parse(localStorage.getItem('gege_gallery_photos_1')) || []; } catch(e2) { photos = []; }
  }
  
  if (photos.length === 0) return;
  
  var wallData = [];
  try {
    wallData = await fetchFromGitHub(config.dataDir + '/photo_wall.json');
  } catch(e) { /* 空 */ }
  
  for (var i = 0; i < Math.min(photos.length, 3); i++) {
    var existingIndex = wallData.findIndex(function(p) { return p.slot === i + 1; });
    var photoInfo = { url: photos[i].url || photos[i].data, type: photos[i].type, slot: i + 1 };
    if (existingIndex >= 0) {
      wallData[existingIndex] = photoInfo;
    } else {
      wallData.push(photoInfo);
    }
  }
  
  try {
    await saveToGitHub(config.dataDir + '/photo_wall.json', wallData, 'Sync photo wall');
  } catch(e) { /* 忽略错误 */ }
  
  loadPhotoWall();
}

function uploadDailyPhoto() {
  if (!state.isAdmin) { showToast('请格格先登录控制殿'); return; }
  uploadGalleryMedia(1);
  setTimeout(syncDailyAlbumToWall, 500);
}

// 照片墙初始化
document.addEventListener('DOMContentLoaded', function() {
  loadPhotoWall();
  var photoWallInput = document.getElementById('photoWallInput');
  if (photoWallInput) {
    photoWallInput.addEventListener('change', handlePhotoWallUpload);
  }
});

// ============ 启动时加载 ============
async function loadGalleryAndTraining() {
  await loadGallerySlots();
  await loadPhotoWall();
  loadTrainingTiers();
  renderTributeGrid();
  checkGalleryLock();
}

// 启动
init();
loadGalleryAndTraining();
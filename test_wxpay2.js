const crypto = require('crypto');
const https = require('https');

const pid = '12809';
const secret = 'AR80YAas4AobLsPKdQlW';

function getSign(params, key) {
    const filtered = {};
    for (const [k, v] of Object.entries(params)) {
        if (k !== 'sign' && k !== 'sign_type' && v !== '' && v !== null && v !== undefined) {
            filtered[k] = String(v);
        }
    }
    const keys = Object.keys(filtered).sort();
    let stringA = '';
    for (const k of keys) {
        stringA += k + '=' + filtered[k] + '&';
    }
    stringA = stringA.replace(/&$/, '');
    const stringSignTemp = stringA + key;
    return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex');
}

// 1. 创建订单
async function createOrder() {
    return new Promise((resolve) => {
        const outTradeNo = 'WXTEST_' + Date.now();
        const params = {
            pid: pid,
            type: 'wxpay',
            out_trade_no: outTradeNo,
            notify_url: 'http://localhost:3000/api/payment/notify',
            return_url: 'http://localhost:3000/api/payment/notify',
            name: '微信支付测试',
            money: '0.01'
        };
        const sign = getSign(params, secret);
        const fullParams = { ...params, sign, sign_type: 'MD5' };
        const body = Object.entries(fullParams)
            .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
            .join('&');
        
        const req = https.request({
            hostname: 'mzf.mapay.cc',
            path: '/xpay/epay/mapi.php',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                console.log('创建订单结果:', JSON.stringify(json));
                resolve(json);
            });
        });
        req.on('error', e => resolve({ error: e.message }));
        req.write(body);
        req.end();
    });
}

// 2. 访问支付页面获取QR码
async function getPayPage(tradeNo) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'mzf.mapay.cc',
            path: '/xpay/epay/pay/' + tradeNo,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('\n支付页面状态码:', res.statusCode);
                console.log('Content-Type:', res.headers['content-type']);
                console.log('响应:', data.substring(0, 500));
                
                // 如果返回的是URL，说明需要重定向
                if (data.startsWith('http')) {
                    console.log('重定向URL:', data);
                }
                resolve(data);
            });
        });
        req.on('error', e => resolve('Error: ' + e.message));
        req.end();
    });
}

// 3. 检查订单状态
async function checkOrderStatus(outTradeNo) {
    return new Promise((resolve) => {
        const params = {
            act: 'order',
            pid: pid,
            out_trade_no: outTradeNo,
            type: 'wxpay',
            name: 'test',
            money: '0.01'
        };
        const sign = getSign(params, secret);
        const fullParams = { ...params, sign, sign_type: 'MD5' };
        const body = Object.entries(fullParams)
            .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
            .join('&');
        
        const req = https.request({
            hostname: 'mzf.mapay.cc',
            path: '/xpay/epay/mapi.php',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('\n订单状态:', data);
                resolve(data);
            });
        });
        req.on('error', e => resolve('Error: ' + e.message));
        req.write(body);
        req.end();
    });
}

(async () => {
    console.log('=== 微信支付通道测试 ===\n');
    
    // 步骤1: 创建订单
    console.log('步骤1: 创建微信支付订单...');
    const order = await createOrder();
    
    if (order.code === 1) {
        const tradeNo = order.trade_no;
        const outTradeNo = 'WXTEST_' + Date.now(); // 需要记住原始订单号
        
        console.log('订单创建成功!');
        console.log('  trade_no:', tradeNo);
        console.log('  money:', order.money);
        
        // 步骤2: 获取支付页面
        console.log('\n步骤2: 获取支付页面...');
        await getPayPage(tradeNo);
        
        // 步骤3: 用submit.php试试
        console.log('\n步骤3: 用submit.php创建订单获取支付链接...');
        const params = {
            pid: pid,
            type: 'wxpay',
            out_trade_no: 'WSUB_' + Date.now(),
            notify_url: 'http://localhost:3000/api/payment/notify',
            return_url: 'http://localhost:3000/api/payment/notify',
            name: '微信支付测试',
            money: '0.01'
        };
        const sign = getSign(params, secret);
        const fullParams = { ...params, sign, sign_type: 'MD5' };
        const body = Object.entries(fullParams)
            .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
            .join('&');
        
        const req = https.request({
            hostname: 'mzf.mapay.cc',
            path: '/xpay/epay/submit.php',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
            timeout: 10000,
            maxRedirects: 0
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('submit.php 状态码:', res.statusCode);
                console.log('Location:', res.headers.location);
                if (data) console.log('响应:', data.substring(0, 300));
                
                // 如果有重定向URL，那就是支付页面
                if (res.headers.location) {
                    const payUrl = 'https://mzf.mapay.cc' + res.headers.location;
                    console.log('\n支付页面URL:', payUrl);
                }
            });
        });
        req.on('error', e => console.log('错误:', e.message));
        req.write(body);
        req.end();
        
    } else {
        console.log('订单创建失败:', order.msg);
    }
})();

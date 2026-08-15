const crypto = require('crypto');
const https = require('https');

const pid = '12809';
const secret = 'AR80YAas4AobLsPKdQlW';

// 修正后的签名函数（密钥直接拼接）
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
        stringA += `${k}=${filtered[k]}&`;
    }
    stringA = stringA.replace(/&$/, '');
    const stringSignTemp = stringA + key;
    const sign = crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex');
    return { sign, stringSignTemp };
}

async function sendRequest(path, requestParams) {
    const body = Object.entries(requestParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'mzf.mapay.cc',
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ code: -1, raw: data.substring(0, 500) }); }
            });
        });
        req.on('error', e => resolve({ code: -1, msg: e.message }));
        req.write(body);
        req.end();
    });
}

async function main() {
    const outTradeNo = 'ORDER' + Date.now();
    
    // 使用支付宝（通道配置的是支付宝）
    const params = {
        pid: pid,
        type: 'alipay',  // 改为支付宝
        out_trade_no: outTradeNo,
        notify_url: 'http://localhost:3000/api/payment/notify',
        return_url: 'http://localhost:3000/api/payment/notify',
        name: '金币充值',
        money: '1.00'
    };
    
    const { sign, stringSignTemp } = getSign(params, secret);
    console.log('=== 创建支付宝支付订单 ===');
    console.log('签名原串:', stringSignTemp);
    console.log('签名:', sign);
    
    const result = await sendRequest('/xpay/epay/mapi.php', { ...params, sign, sign_type: 'MD5' });
    console.log('\n响应状态:', result.code);
    console.log('响应消息:', result.msg);
    
    if (result.code === 1) {
        console.log('\n✅ 支付订单创建成功！');
        console.log('订单号:', result.trade_no);
        console.log('支付金额:', result.money);
        console.log('\n--- 完整响应字段 ---');
        for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'string' && value.length > 100) {
                console.log(`${key}: ${value.substring(0, 100)}...`);
            } else {
                console.log(`${key}:`, value);
            }
        }
        console.log('--- 结束 ---\n');
    } else {
        console.log('❌ 创建失败:', result.msg);
        
        // 如果支付宝失败，试试微信
        console.log('\n=== 尝试微信支付 ===');
        const wxParams = { ...params, type: 'wxpay', out_trade_no: 'WX' + Date.now() };
        const { sign: wxSign, stringSignTemp: wxStr } = getSign(wxParams, secret);
        console.log('签名原串:', wxStr);
        const wxResult = await sendRequest('/xpay/epay/mapi.php', { ...wxParams, sign: wxSign, sign_type: 'MD5' });
        console.log('微信响应:', wxResult.code, wxResult.msg);
        if (wxResult.code === 1) {
            console.log('微信支付成功！payurl:', wxResult.payurl);
        }
    }
}

main();

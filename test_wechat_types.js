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

async function testAllTypes() {
    // 测试多种微信支付类型
    const wechatTypes = [
        { type: 'wxpay', name: '微信扫码支付' },
        { type: 'weixin', name: '微信' },
        { type: 'wx', name: '微信(简写)' },
        { type: 'wx2', name: '微信2' },
        { type: 'sqb', name: '扫码吧' },
        { type: 'shouqianba', name: '收钱吧' },
        { type: 'unionpay', name: '银联' },
        { type: 'qqpay', name: 'QQ钱包' },
        { type: 'jdpay', name: '京东支付' },
        { type: 'meituan', name: '美团' },
        { type: 'baidu', name: '百度支付' },
        { type: 'koubei', name: '口碑' }
    ];
    
    console.log('=== 测试码支付支持的通道类型 ===\n');
    
    for (const { type, name } of wechatTypes) {
        const outTradeNo = 'TEST_' + type + '_' + Date.now();
        const params = {
            pid: pid,
            type: type,
            out_trade_no: outTradeNo,
            notify_url: 'http://localhost:3000/api/payment/notify',
            return_url: 'http://localhost:3000/api/payment/notify',
            name: '测试' + type,
            money: '0.01'
        };
        
        const { sign } = getSign(params, secret);
        const result = await sendRequest('/xpay/epay/mapi.php', { ...params, sign, sign_type: 'MD5' });
        
        const status = result.code === 1 ? '✅ 成功' : '❌ 失败';
        console.log(`${status} [${name}] type=${type}: ${result.msg || result.text || '无消息'}`);
        
        if (result.code === 1) {
            console.log(`   -> payurl: ${result.payurl?.substring(0, 80)}...`);
            console.log(`   -> trade_no: ${result.trade_no}`);
            // 测试成功的通道，打印更多信息
            for (const [key, value] of Object.entries(result)) {
                if (value && typeof value === 'string' && value.length > 50) {
                    console.log(`   -> ${key}: ${value.substring(0, 80)}...`);
                }
            }
        }
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('提示：如果所有微信类型都失败，请在码支付后台添加微信通道账号');
}

testAllTypes();

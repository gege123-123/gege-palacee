const https = require('https');

// 访问支付页面
const tradeNo = '20260815142125395081';
const url = '/xpay/epay/pay/' + tradeNo;

const req = https.request({
    hostname: 'mzf.mapay.cc',
    path: url,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('=== 支付页面响应 ===');
        console.log('状态码:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);
        console.log('页面长度:', data.length);
        
        // 检查是否有图片
        const imgMatch = data.match(/<img[^>]*src=["']([^"']*)["'][^>]*>/g);
        if (imgMatch) {
            console.log('\n找到图片:');
            imgMatch.forEach(img => console.log('  ', img.substring(0, 200)));
        }
        
        // 搜索QR码相关字段
        if (data.includes('qrcode') || data.includes('qr_code') || data.includes('code_url')) {
            console.log('\n找到QR相关内容!');
            const lines = data.split('\n').filter(l => l.includes('qr') || l.includes('code_url'));
            lines.forEach(l => console.log('  ', l.trim().substring(0, 200)));
        }
        
        // 输出前1500字符
        console.log('\n页面前1500字符:');
        console.log(data.substring(0, 1500));
    });
});
req.on('error', e => console.log('错误:', e.message));
req.end();

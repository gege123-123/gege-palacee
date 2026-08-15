const https = require('https');

// 访问微信支付页面并提取QR码
const tradeNo = '20260815142219527419';

const req = https.request({
    hostname: 'mzf.mapay.cc',
    path: '/pay/' + tradeNo,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
    timeout: 10000
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('状态码:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);
        console.log('响应长度:', data.length);
        
        // 如果是HTML
        if (data.includes('<html') || data.includes('<!DOCTYPE')) {
            console.log('\n是HTML页面!');
            // 搜索QR码图片
            const qrImgRegex = /<img[^>]*src=["']([^"']*qr[^"']*)["'][^>]*>/i;
            const allImgs = data.match(/<img[^>]*src=["']([^"']*)["'][^>]*>/g) || [];
            console.log('找到图片数量:', allImgs.length);
            allImgs.forEach((img, i) => {
                console.log(`  图片${i}:`, img.substring(0, 200));
            });
            
            // 搜索二维码相关
            const qrRelated = data.match(/(qrcode|qr_code|code_url|QRCode)[^<]*/gi) || [];
            if (qrRelated.length) {
                console.log('\nQR相关内容:');
                qrRelated.forEach(q => console.log('  ', q.substring(0, 200)));
            }
            
            // 输出前2000字符
            console.log('\n页面前2000字符:');
            console.log(data.substring(0, 2000));
        } else if (data.startsWith('http')) {
            // 可能是纯URL重定向
            console.log('重定向URL:', data);
            
            // 跟随重定向
            https.get(data, (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    console.log('\n重定向页面内容:');
                    console.log('状态码:', res2.statusCode);
                    console.log('长度:', data2.length);
                    console.log(data2.substring(0, 1000));
                });
            });
        } else {
            console.log('\n响应内容:');
            console.log(data.substring(0, 1000));
        }
    });
});
req.on('error', e => console.log('错误:', e.message));
req.end();

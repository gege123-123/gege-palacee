const https = require('https');

// 获取完整页面内容并分析
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
        // 搜索所有script标签和API调用
        const scripts = data.match(/<script[^>]*src=["']([^"']*)["'][^>]*>/g) || [];
        console.log('Script文件:');
        scripts.forEach(s => console.log('  ', s));
        
        // 搜索所有内联脚本
        const inlineScripts = data.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
        console.log('\n内联脚本数量:', inlineScripts.length);
        inlineScripts.forEach((s, i) => {
            if (s.length > 50) {
                console.log(`\n内联脚本${i} (${s.length}字符):`);
                console.log(s.substring(0, 500));
            }
        });
        
        // 检查是否有API endpoint信息
        const apiMatches = data.match(/(api|endpoint|url|fetch|ajax|getJSON)[^<"']*[<"']([^<"']*)[<"']/gi) || [];
        if (apiMatches.length) {
            console.log('\nAPI相关:');
            apiMatches.forEach(m => console.log('  ', m.substring(0, 150)));
        }
        
        // 输出完整HTML
        console.log('\n完整HTML:');
        console.log(data);
    });
});
req.on('error', e => console.log('错误:', e.message));
req.end();

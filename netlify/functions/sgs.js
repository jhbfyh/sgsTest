// File: netlify/functions/sgs.js
// (注意：文件夹名必须是 `netlify/functions` 或者在 netlify.toml 中配置的其他名称)
// (文件名 `sgs.js` 可以自定义，它将成为 URL 的一部分)

// --- 配置区 (保持不变) ---
const SIGNS = {
    1: '1b082193f367',
    2: '1b0825bc909d',
};
const TARGET_URL_TEMPLATE = 'https://service.bot.qch86.top/activation/code/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf254032b) XWEB/13655';
const REFERER = 'https://servicewechat.com/wxce5c295934a251e5/8/page-frame.html';
// --- 配置区结束 ---

async function fetchDataForPage(page) {
    // ... (fetchDataForPage 函数与 Vercel 版本中的基本一致，返回 { success, status, data })
    // 我们这里直接复用之前的，它已经返回了包含 status 和 data 的对象
    const currentSign = SIGNS[page];

    if (!currentSign) {
        if (SIGNS && Object.keys(SIGNS).length > 0 && page <= Math.max(...Object.keys(SIGNS).map(Number))) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: `代理配置错误：未找到第 ${page} 页的 Sign 值。`,
                    code: 4001, data: []
                })
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    code: 200,
                    message: `No sign configured for page ${page} or SIGNS empty, assuming no data.`,
                    data: []
                })
            };
        }
    }

    const targetUrl = `${TARGET_URL_TEMPLATE}${page}`;
    const apiRequestHeaders = {
        'Connection': 'keep-alive',
        'xweb_xhr': '1',
        'User-Agent': USER_AGENT,
        'Sign': currentSign,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Referer': REFERER,
        'Accept-Language': 'zh-CN,zh;q=0.9'
    };

    try {
        const apiResponse = await fetch(targetUrl, { headers: apiRequestHeaders });
        const responseBodyText = await apiResponse.text();
        const httpCode = apiResponse.status;

        if (!apiResponse.ok) {
            return {
                statusCode: httpCode, // Or 502 for "Bad Gateway" like behavior
                body: JSON.stringify({
                    error: `目标 API (第 ${page} 页) 返回 HTTP ${httpCode}。`,
                    code: 5020, data: [],
                    raw_response_preview: responseBodyText.substring(0, 200)
                })
            };
        }

        try {
            const jsonData = JSON.parse(responseBodyText);
            return { statusCode: httpCode, body: JSON.stringify(jsonData) };
        } catch (e) {
            return {
                statusCode: httpCode, // Or 502
                body: JSON.stringify({
                    error: `目标 API (第 ${page} 页) 返回 HTTP ${httpCode}，但响应不是 JSON。`,
                    code: 5021, data: [],
                    raw_response_preview: responseBodyText.substring(0, 200)
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: `Netlify 函数内部错误: ${error.message}`,
                code: 5001, data: []
            })
        };
    }
}

// Netlify Function handler
// 它接收 event 和 context 对象
exports.handler = async (event, context) => {
    // CORS Headers - Netlify Functions 需要显式设置
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // 生产环境请指定特定域名
        'Access-Control-Allow-Headers': 'Content-Type, Sign',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };

    // 处理 OPTIONS 预检请求 (CORS)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No Content
            headers: corsHeaders,
            body: '',
        };
    }

    // 从查询参数获取 'page' (Netlify 使用 event.queryStringParameters)
    const pageParam = event.queryStringParameters && event.queryStringParameters.page;
    let pageToFetch = parseInt(pageParam, 10);

    if (isNaN(pageToFetch) || pageToFetch < 1) {
        pageToFetch = 1; // 默认第 1 页
    }

    const result = await fetchDataForPage(pageToFetch); // result 已经是 { statusCode, body }

    return {
        ...result, // 包含 statusCode 和 body (body 已经是 stringified JSON)
        headers: {
            ...corsHeaders, // 添加 CORS headers
            'Content-Type': 'application/json', // 确保响应类型正确
            // 如果 result.headers 存在，可以合并，但这里 fetchDataForPage 直接返回 body
        },
    };
};

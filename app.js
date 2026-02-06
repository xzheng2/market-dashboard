/**
 * Market Dashboard - 市场仪表盘
 * 数据来源: Binance, CoinGecko, Alternative.me, Yahoo Finance (via proxy), CNN
 */

// ===== 配置 =====
const CONFIG = {
    refreshInterval: 60_000, // 60秒自动刷新
    corsProxy: 'https://api.allorigins.win/raw?url=',
    apis: {
        // 比特币价格 - Binance 现货 (CORS友好，无需Key)
        btc: 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT',
        // 备用: CoinGecko
        btcFallback: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
        // 加密恐慌贪婪指数
        cryptoFg: 'https://api.alternative.me/fng/?limit=1',
        // BTC 溢价率 - Binance (CORS友好，无需Key)
        btcFunding: 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT',
        // Yahoo Finance (需要CORS代理)
        yahooNasdaq: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?range=1d&interval=1d',
        yahooSP500: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1d',
        yahooDXY: 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=1d&interval=1d',
        // CNN 恐慌贪婪指数
        cnnFg: 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
    }
};

// ===== DOM 元素缓存 =====
const DOM = {
    lastUpdate: document.getElementById('lastUpdate'),
    refreshBtn: document.getElementById('refreshBtn'),
    btcPrice: document.getElementById('btcPrice'),
    btcChange: document.getElementById('btcChange'),
    cryptoFgValue: document.getElementById('cryptoFgValue'),
    cryptoFgLabel: document.getElementById('cryptoFgLabel'),
    cryptoFgBar: document.getElementById('cryptoFgBar'),
    cardCryptoFg: document.getElementById('card-crypto-fg'),
    fundingValue: document.getElementById('fundingValue'),
    fundingInfo: document.getElementById('fundingInfo'),
    nasdaqPrice: document.getElementById('nasdaqPrice'),
    nasdaqChange: document.getElementById('nasdaqChange'),
    sp500Price: document.getElementById('sp500Price'),
    sp500Change: document.getElementById('sp500Change'),
    stockFgValue: document.getElementById('stockFgValue'),
    stockFgLabel: document.getElementById('stockFgLabel'),
    stockFgBar: document.getElementById('stockFgBar'),
    cardStockFg: document.getElementById('card-stock-fg'),
    dxyPrice: document.getElementById('dxyPrice'),
    dxyChange: document.getElementById('dxyChange'),
};

// ===== 工具函数 =====
function formatPrice(num, decimals = 2) {
    if (num == null || isNaN(num)) return '--';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatChange(change, suffix = '%') {
    if (change == null || isNaN(change)) return '--';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}${suffix}`;
}

function setChangeClass(el, value) {
    el.classList.remove('up', 'down', 'neutral');
    if (value > 0) el.classList.add('up');
    else if (value < 0) el.classList.add('down');
    else el.classList.add('neutral');
}

function getFgClass(value) {
    if (value <= 20) return 'fg-extreme-fear';
    if (value <= 40) return 'fg-fear';
    if (value <= 60) return 'fg-neutral';
    if (value <= 80) return 'fg-greed';
    return 'fg-extreme-greed';
}

function getFgLabelCN(classification) {
    const map = {
        'extreme fear': '极度恐惧',
        'fear': '恐惧',
        'neutral': '中性',
        'greed': '贪婪',
        'extreme greed': '极度贪婪',
    };
    return map[(classification || '').toLowerCase()] || classification || '--';
}

function getCNNFgLabel(value) {
    if (value <= 25) return '极度恐惧';
    if (value <= 45) return '恐惧';
    if (value <= 55) return '中性';
    if (value <= 75) return '贪婪';
    return '极度贪婪';
}

function showSkeleton(el) {
    el.classList.add('skeleton');
}

function hideSkeleton(el) {
    el.classList.remove('skeleton');
}

function showError(valueEl, changeEl, msg = '加载失败') {
    valueEl.textContent = msg;
    valueEl.closest('.card')?.classList.add('card-error');
    if (changeEl) changeEl.textContent = '点击刷新重试';
}

function clearError(card) {
    card?.classList.remove('card-error');
}

// 通用 fetch，带超时和 CORS 代理回退
async function safeFetch(url, useProxy = false, timeout = 10000) {
    const target = useProxy ? CONFIG.corsProxy + encodeURIComponent(url) : url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const resp = await fetch(target, { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (err) {
        clearTimeout(timer);
        // 如果直连失败，尝试代理
        if (!useProxy) {
            return safeFetch(url, true, timeout);
        }
        throw err;
    }
}

// ===== 数据获取函数 =====

// 1. 比特币价格
async function fetchBTC() {
    clearError(document.getElementById('card-btc'));
    showSkeleton(DOM.btcPrice);
    showSkeleton(DOM.btcChange);

    try {
        // 尝试 Binance
        let data;
        try {
            data = await safeFetch(CONFIG.apis.btc);
            const price = parseFloat(data.lastPrice);
            const change24h = parseFloat(data.priceChangePercent);

            hideSkeleton(DOM.btcPrice);
            hideSkeleton(DOM.btcChange);
            DOM.btcPrice.textContent = `$${formatPrice(price)}`;
            DOM.btcChange.textContent = `24h ${formatChange(change24h)}`;
            setChangeClass(DOM.btcChange, change24h);
            return;
        } catch (e) {
            // 回退到 CoinGecko
            console.warn('Binance failed, trying CoinGecko...', e);
        }

        data = await safeFetch(CONFIG.apis.btcFallback);
        const price = data.bitcoin.usd;
        const change24h = data.bitcoin.usd_24h_change;

        hideSkeleton(DOM.btcPrice);
        hideSkeleton(DOM.btcChange);
        DOM.btcPrice.textContent = `$${formatPrice(price)}`;
        DOM.btcChange.textContent = `24h ${formatChange(change24h)}`;
        setChangeClass(DOM.btcChange, change24h);
    } catch (err) {
        hideSkeleton(DOM.btcPrice);
        hideSkeleton(DOM.btcChange);
        showError(DOM.btcPrice, DOM.btcChange);
        console.error('BTC fetch error:', err);
    }
}

// 2. 加密恐慌贪婪指数
async function fetchCryptoFG() {
    clearError(document.getElementById('card-crypto-fg'));
    showSkeleton(DOM.cryptoFgValue);

    try {
        const data = await safeFetch(CONFIG.apis.cryptoFg);
        const item = data.data[0];
        const value = parseInt(item.value);
        const label = item.value_classification;

        hideSkeleton(DOM.cryptoFgValue);
        DOM.cryptoFgValue.textContent = value;
        DOM.cryptoFgLabel.textContent = getFgLabelCN(label);

        // 更新指示条位置
        DOM.cryptoFgBar.style.left = `${value}%`;

        // 更新颜色类
        const card = DOM.cardCryptoFg;
        card.className = card.className.replace(/fg-\S+/g, '');
        card.classList.add('card', getFgClass(value));
    } catch (err) {
        hideSkeleton(DOM.cryptoFgValue);
        showError(DOM.cryptoFgValue, DOM.cryptoFgLabel);
        console.error('Crypto F&G fetch error:', err);
    }
}

// 3. BTC 实时溢价率 (Binance)
async function fetchFunding() {
    clearError(document.getElementById('card-funding'));
    showSkeleton(DOM.fundingValue);

    try {
        const data = await safeFetch(CONFIG.apis.btcFunding);
        const mark = parseFloat(data.markPrice);
        const index = parseFloat(data.indexPrice);
        const premiumPct = ((mark - index) / index) * 100; // 实时溢价率

        hideSkeleton(DOM.fundingValue);
        DOM.fundingValue.textContent = `${premiumPct >= 0 ? '+' : ''}${premiumPct.toFixed(4)}%`;
        setChangeClass(DOM.fundingValue, premiumPct);

        // 副行：上期费率 + 下次结算倒计时
        const lastRate = (parseFloat(data.lastFundingRate) * 100).toFixed(4);
        const diff = new Date(data.nextFundingTime) - Date.now();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const countdown = diff > 0 ? `${h}h${m}m` : '结算中';
        DOM.fundingInfo.textContent = `上期 ${lastRate}% \u00b7 ${countdown}`;
        DOM.fundingInfo.classList.remove('up', 'down');
        DOM.fundingInfo.classList.add('neutral');
    } catch (err) {
        hideSkeleton(DOM.fundingValue);
        showError(DOM.fundingValue, DOM.fundingInfo);
        console.error('Funding rate fetch error:', err);
    }
}

// 4. Yahoo Finance 通用获取
async function fetchYahooQuote(url) {
    const data = await safeFetch(url, true); // Yahoo 需要代理
    const result = data.chart.result[0];
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - prevClose;
    const changePct = (change / prevClose) * 100;
    return { price, prevClose, change, changePct };
}

// 5. 纳斯达克
async function fetchNasdaq() {
    clearError(document.getElementById('card-nasdaq'));
    showSkeleton(DOM.nasdaqPrice);
    showSkeleton(DOM.nasdaqChange);

    try {
        const { price, changePct } = await fetchYahooQuote(CONFIG.apis.yahooNasdaq);
        hideSkeleton(DOM.nasdaqPrice);
        hideSkeleton(DOM.nasdaqChange);
        DOM.nasdaqPrice.textContent = formatPrice(price, 2);
        DOM.nasdaqChange.textContent = formatChange(changePct);
        setChangeClass(DOM.nasdaqChange, changePct);
    } catch (err) {
        hideSkeleton(DOM.nasdaqPrice);
        hideSkeleton(DOM.nasdaqChange);
        showError(DOM.nasdaqPrice, DOM.nasdaqChange);
        console.error('NASDAQ fetch error:', err);
    }
}

// 6. 标普500
async function fetchSP500() {
    clearError(document.getElementById('card-sp500'));
    showSkeleton(DOM.sp500Price);
    showSkeleton(DOM.sp500Change);

    try {
        const { price, changePct } = await fetchYahooQuote(CONFIG.apis.yahooSP500);
        hideSkeleton(DOM.sp500Price);
        hideSkeleton(DOM.sp500Change);
        DOM.sp500Price.textContent = formatPrice(price, 2);
        DOM.sp500Change.textContent = formatChange(changePct);
        setChangeClass(DOM.sp500Change, changePct);
    } catch (err) {
        hideSkeleton(DOM.sp500Price);
        hideSkeleton(DOM.sp500Change);
        showError(DOM.sp500Price, DOM.sp500Change);
        console.error('S&P 500 fetch error:', err);
    }
}

// 7. 美股恐慌贪婪指数 (CNN)
async function fetchStockFG() {
    clearError(document.getElementById('card-stock-fg'));
    showSkeleton(DOM.stockFgValue);

    try {
        const data = await safeFetch(CONFIG.apis.cnnFg, true);
        // CNN 返回格式: { fear_and_greed: { score, rating, ... }, ... }
        const fg = data.fear_and_greed;
        const value = Math.round(fg.score);
        const label = getCNNFgLabel(value);

        hideSkeleton(DOM.stockFgValue);
        DOM.stockFgValue.textContent = value;
        DOM.stockFgLabel.textContent = label;

        DOM.stockFgBar.style.left = `${value}%`;

        const card = DOM.cardStockFg;
        card.className = card.className.replace(/fg-\S+/g, '');
        card.classList.add('card', getFgClass(value));
    } catch (err) {
        hideSkeleton(DOM.stockFgValue);
        showError(DOM.stockFgValue, DOM.stockFgLabel);
        console.error('Stock F&G fetch error:', err);
    }
}

// 8. 美元指数
async function fetchDXY() {
    clearError(document.getElementById('card-dxy'));
    showSkeleton(DOM.dxyPrice);
    showSkeleton(DOM.dxyChange);

    try {
        const { price, changePct } = await fetchYahooQuote(CONFIG.apis.yahooDXY);
        hideSkeleton(DOM.dxyPrice);
        hideSkeleton(DOM.dxyChange);
        DOM.dxyPrice.textContent = formatPrice(price, 3);
        DOM.dxyChange.textContent = formatChange(changePct);
        setChangeClass(DOM.dxyChange, changePct);
    } catch (err) {
        hideSkeleton(DOM.dxyPrice);
        hideSkeleton(DOM.dxyChange);
        showError(DOM.dxyPrice, DOM.dxyChange);
        console.error('DXY fetch error:', err);
    }
}

// ===== 主刷新逻辑 =====
async function refreshAll() {
    // 并行请求所有数据
    await Promise.allSettled([
        fetchBTC(),
        fetchCryptoFG(),
        fetchFunding(),
        fetchNasdaq(),
        fetchSP500(),
        fetchStockFG(),
        fetchDXY(),
    ]);

    // 更新时间
    const now = new Date();
    DOM.lastUpdate.textContent = `更新于 ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

// ===== 初始化 =====
function init() {
    // 刷新按钮
    DOM.refreshBtn.addEventListener('click', () => {
        DOM.refreshBtn.classList.add('spinning');
        setTimeout(() => DOM.refreshBtn.classList.remove('spinning'), 800);
        refreshAll();
    });

    // 初始加载
    refreshAll();

    // 自动刷新
    setInterval(refreshAll, CONFIG.refreshInterval);
}

// 页面就绪后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
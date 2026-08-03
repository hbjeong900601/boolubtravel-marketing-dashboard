const puppeteer = require('puppeteer-core');

// Chrome executable path on macOS
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Shared browser instance for performance
let browserInstance = null;

// Rate limiting: minimum delay between requests (ms)
const MIN_REQUEST_DELAY = 4000;
let lastRequestTime = 0;

/**
 * Get or launch a shared Puppeteer browser instance using local Chrome.
 */
async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  console.log('[Crawler] Launching Chrome browser...');
  browserInstance = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--lang=ko-KR',
    ],
  });
  console.log('[Crawler] ✅ Chrome browser launched!');
  return browserInstance;
}

/**
 * Apply stealth techniques to a page to bypass bot detection.
 */
async function applyStealthToPage(page) {
  // Remove webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });
    // Override platform
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel',
    });
    // Chrome runtime
    window.chrome = { runtime: {} };
  });
}

/**
 * Wait for rate limiting between requests.
 */
async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_DELAY) {
    const waitTime = MIN_REQUEST_DELAY - elapsed;
    console.log(`[Crawler] Rate limiting: waiting ${waitTime}ms...`);
    await new Promise(r => setTimeout(r, waitTime));
  }
  lastRequestTime = Date.now();
}

/**
 * Extract core search keywords from raw ad title.
 * Removes brackets, parentheses, special symbols, and promotional text.
 * Keeps meaningful product/destination keywords for accurate Naver Shopping search.
 * 
 * Examples:
 *   "[후쿠오카 출발] 모지코 &가라토시장 & 고쿠라성 & 사라쿠라산 야경 1일 투어"
 *   → "후쿠오카 출발 모지코 가라토시장 고쿠라성 사라쿠라산 야경 1일 투어"
 *
 *   "[한국어가이드] 교토 & 나라 일일 버스 투어 - 기요미즈데라, 후시미이나리 신사"
 *   → "교토 나라 일일 버스 투어 기요미즈데라 후시미이나리 신사"
 *
 *   "[[즉시발권] 빈원더스 나트랑 놀이공원 입장권 + 타타쇼 포함]"
 *   → "빈원더스 나트랑 놀이공원 입장권 타타쇼"
 */
function extractCoreKeywords(rawTitle) {
  if (!rawTitle) return '';
  
  let clean = rawTitle;
  
  // 1. Remove bracket/parenthesis SYMBOLS but keep content inside
  clean = clean.replace(/[\[\](){}]/g, ' ');
  
  // 2. Remove special symbols: &, |, ·, -, +, /, \, :, ;, !, ?, =, @, #, $, %, ^, *, ~
  clean = clean.replace(/[&|·\-+/\\:;!?=@#$%^*~,."']/g, ' ');
  
  // 3. Remove promotional/noise words that don't help search
  const noiseWords = [
    '한국어가이드', '영어가이드', '즉시발권', '단독', '독점', '할인',
    '최대', '특가', '혜택', '포함', '선택', '가능', '옵션',
    '단독차량', '단독보트', '프라이빗', '럭셔리',
    '특정일', '한정', 'Adult', '성인',
  ];
  noiseWords.forEach(word => {
    clean = clean.replace(new RegExp(word, 'gi'), ' ');
  });
  
  // 4. Collapse multiple spaces into one and trim
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // 5. If cleaned result is too long (>60 chars), keep first meaningful chunk
  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length > 8) {
    clean = words.slice(0, 8).join(' ');
  }
  
  return clean;
}

/**
 * Scrapes REAL Naver Shopping search results using stealth headless Chrome.
 * NO fake data. NO mock fallback. 100% real data or honest empty result.
 */
async function scrapeNaverShopping(keyword, price, catalogId) {
  if (!keyword) {
    return { keyword, success: false, source: 'no_keyword', competitors: [] };
  }

  await waitForRateLimit();

  const searchQuery = extractCoreKeywords(keyword);
  const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(searchQuery)}`;

  console.log(`[Crawler] Original title: "${keyword}"`);
  console.log(`[Crawler] Extracted keywords: "${searchQuery}"`);
  console.log(`[Crawler] Search URL: ${searchUrl}`);

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Apply stealth techniques
    await applyStealthToPage(page);

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Navigate
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 25000 });

    // Check for blocking page
    const isBlocked = await page.evaluate(() => {
      return document.body?.innerText?.includes('접속이 일시적으로 제한') || false;
    });

    if (isBlocked) {
      console.log(`[Crawler] ⛔ IP temporarily blocked by Naver Shopping. Will retry later.`);
      await page.close();
      return { keyword, success: true, source: 'ip_blocked', competitors: [] };
    }

    // Wait for content
    await page.waitForSelector('[class*="product_item"], #__NEXT_DATA__', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    // Extract competitor data
    const competitors = await page.evaluate(() => {
      const results = [];

      // Strategy 1: __NEXT_DATA__ JSON
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        try {
          const json = JSON.parse(nextDataEl.textContent);
          const products =
            json.props?.pageProps?.initialState?.products?.list ||
            json.props?.pageProps?.initialState?.searchResult?.products?.list ||
            [];

          products.forEach((item, idx) => {
            const p = item.item;
            if (!p) return;
            const mallName = p.mallName || p.crMallName || '';
            const productName = p.productName || '';
            const itemPrice = parseInt(p.price || '0', 10);
            const url = p.crUrl || p.adcrUrl || p.pcUrl || '';

            if (mallName && itemPrice > 0) {
              results.push({ rank: idx + 1, name: mallName, productName, price: itemPrice, url });
            }
          });
        } catch (e) { /* ignore */ }
      }

      // Strategy 2: DOM fallback
      if (results.length === 0) {
        document.querySelectorAll('[class*="product_item"]').forEach((el, idx) => {
          const titleEl = el.querySelector('[class*="product_title"] a, [class*="productTitle"] a');
          const priceEl = el.querySelector('[class*="price_num"], [class*="price_info"] em');
          const mallEl = el.querySelector('[class*="product_mall_"] img') || el.querySelector('[class*="product_mall"]');
          const linkEl = el.querySelector('[class*="product_title"] a');

          const productName = titleEl ? titleEl.textContent.trim() : '';
          const priceText = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '0';
          const itemPrice = parseInt(priceText, 10);
          const mallName = mallEl ? (mallEl.getAttribute('alt') || mallEl.textContent.trim()) : '';
          const url = linkEl ? linkEl.getAttribute('href') || '' : '';

          if (mallName && itemPrice > 0) {
            results.push({ rank: idx + 1, name: mallName, productName, price: itemPrice, url });
          }
        });
      }

      return results;
    });

    await page.close();
    page = null;

    if (competitors.length > 0) {
      competitors.sort((a, b) => a.price - b.price);
      console.log(`[Crawler] ✅ Found ${competitors.length} REAL competitors!`);
      competitors.slice(0, 5).forEach(c => {
        console.log(`  [${c.rank}] ${c.name}: ₩${c.price.toLocaleString()} — ${c.productName.substring(0, 50)}`);
      });
      return { keyword, success: true, source: 'puppeteer_real', competitors };
    } else {
      console.log(`[Crawler] ⚠️ No results for "${searchQuery}" — returning empty (NO FAKE DATA).`);
      return { keyword, success: true, source: 'no_results', competitors: [] };
    }
  } catch (error) {
    console.error(`[Crawler] ❌ Scraping failed:`, error.message);
    if (page) { try { await page.close(); } catch (e) {} }
    return { keyword, success: true, source: 'scrape_failed', competitors: [] };
  }
}

async function closeBrowser() {
  if (browserInstance) {
    try { await browserInstance.close(); } catch (e) {}
    browserInstance = null;
    console.log('[Crawler] Browser closed.');
  }
}

process.on('exit', closeBrowser);
process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });

module.exports = { scrapeNaverShopping, closeBrowser };

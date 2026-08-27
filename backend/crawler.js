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
function generateSearchCandidates(rawTitle) {
  if (!rawTitle) return { primary: '', core: '', secondary: null };
  let title = rawTitle.trim();

  // 1. Remove purely promotional/marketing brackets [...]
  title = title.replace(/\[\s*(?:한국어가이드|영어가이드|한국인가이드|즉시발권|즉시확정|당일사용가능|당일사용|무료취소|단독|특가|할인|베스트셀러|얼리유후인|히타유후인|우리일행끼리만|부산|KE|노팁|NO팁|모찌특전|출발확정|참좋은여행|다색골프|프로모션|기차티켓|공항\s*전세밴|QR입장|전자\s*티켓|스냅사진|특정일|추천)\s*\]/gi, ' ');
  // 2. Unwrap location/topic brackets like [아테네], [프랑스 마르세유] -> keep text
  title = title.replace(/\[([^\]]+)\]/g, ' $1 ');

  // 3. Remove options/details parentheses (...)
  title = title.replace(/\(\s*(?:가이드\s*포함|한국어가이드\s*포함|한국인가이드\s*포함|가이드|마사지|짐보관|한국인|한국인가이드|출발|도착|단독|조인|선택|포함|토탈케어|마사지선택가능|짐보관가능|1대기준|야간|추가비용|픽업|무료취소|즉시확정|성인|아동|A코스|B코스|C코스|구시가지|버즈\s*칼리파\s*뷰|일반\/창가\s*좌석|우선입장|워터파크포함|전문포토그래퍼|호텔\s*샌딩|아리마온천|덜\s*붐비는\s*아침시간에\s*둘러보는|오전|오후)[^\)]*\)/gi, ' ');
  title = title.replace(/\([^\)]*\)/g, ' ');

  // 4. Remove number-based duration/spec patterns
  title = title.replace(/\d+박\s*\d+일/g, ' ');
  title = title.replace(/\d+일권/g, ' ');
  title = title.replace(/\d+일/g, ' ');
  title = title.replace(/\d+시간/g, ' ');
  title = title.replace(/\d+분/g, ' ');
  title = title.replace(/\d+대기준/g, ' ');
  title = title.replace(/\d+인/g, ' ');
  title = title.replace(/\d+호선/g, ' ');
  title = title.replace(/\d+개[~]?/g, ' ');

  // 5. Separate Korean connector particles attached to nouns (e.g. "아크로폴리스와" -> "아크로폴리스")
  title = title.replace(/([가-힣]{2,})(와|과|및|의|에서|부터)\s*/g, '$1 ');

  // 6. Remove pure promotional/ad noise words
  const noiseWords = [
    '한국어가이드', '영어가이드', '한국인가이드', '즉시발권', '즉시확정', '단독', '독점', '할인',
    '최대', '특가', '혜택', '포함', '선택', '가능', '옵션', '무료취소',
    '단독차량', '단독보트', '프라이빗', '럭셔리', '프리미엄',
    '특정일', '한정', 'Adult', '성인', '아동',
    '출발', '도착', '일일', '당일', '풀데이', '반일', '반나절', '데이', '종일', '원데이',
    '편도', '왕복', '오전', '오후', '새벽', '야간',
    '바우처', '이용권', '이용', '예약', '확정',
    '무제한', '뷔페', '중식', '석식', '조식',
    '코스', 'A코스', 'B코스', 'C코스',
    '착한가격', '추가비용없는', '추가비용', 'VIP', 'NO팁', 'NO대기비', 'NO지연비',
    '줄서지', '않고', '빠른', '편리하고', '편리한', '편안하게', '가격동일',
    '대기없이', '무료', '인기', '베스트셀러', '추천', '필수', '완벽한',
    '최고의', '특별한', '즐기는', '즐기기', '한국인전용', '한국인 전용',
    '서비스', '기준', '가이드포함', '가이드 포함', '가이드',
    '액티비티', '체험', '투어상품', '현지투어', '자유여행', '일정', '관광',
    '테마파크', '디스커버리', '센터', '고고학', '고고', '유적지',
  ];
  for (const word of noiseWords) {
    title = title.replace(new RegExp(word, 'gi'), ' ');
  }

  // 7. Special delimiter handling for multi-activity products (&, +, /)
  let secondary = null;
  if (title.includes('&') || title.includes('+') || title.includes('/')) {
    const destMatch = title.match(/^(나트랑|다낭|푸꾸옥|호치민|하노이|달랏|판랑|무이네|도쿄|오사카|후쿠오카|교토|삿포로|오키나와|방콕|파타야|푸켓|치앙마이|발리|싱가포르|세부|보라카이|보홀|코타키나발루|타이베이|가오슝|홍콩|마카오|괌|사이판|하와이|스위스|인터라켄|파리|런던|로마|바르셀로나|뉴욕|시드니|멜버른|케언즈|브리즈번|올랜도|라스베가스|두바이|아부다비|아테네|그리스)/);
    const dest = destMatch ? destMatch[1] : '';
    const parts = title.split(/[&+/]/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      let p1 = parts[0].replace(/[&|·\-+/\\:;!?=@#$%^*~,."'•]/g, ' ').replace(/\s+/g, ' ').trim();
      let p2 = parts[1].replace(/[&|·\-+/\\:;!?=@#$%^*~,."'•]/g, ' ').replace(/\s+/g, ' ').trim();
      if (dest && !p2.startsWith(dest)) p2 = `${dest} ${p2}`;
      title = p1;
      secondary = p2;
    }
  }

  // Remove comma-separated extra sub-locations
  title = title.replace(/,\s*[^,]+,\s*[^,]+/g, ' ');

  title = title.replace(/[&|·\-+/\\:;!?=@#$%^*~,."'•]/g, ' ');
  title = title.replace(/\s+/g, ' ').trim();

  let words = title.split(' ').filter(w => w.length > 1 || /[가-힣]/.test(w));
  const seen = new Set();
  const deduped = [];
  for (const w of words) {
    const l = w.toLowerCase();
    if (!seen.has(l)) {
      seen.add(l);
      deduped.push(w);
    }
  }
  const primary = deduped.slice(0, 4).join(' ');
  let core = primary;
  if (deduped.length >= 3) {
    const lastWord = deduped[deduped.length - 1];
    if (['티켓', '입장권', '패스', '투어', '이용권', '박물관', '신전'].includes(lastWord)) {
      core = deduped.slice(0, deduped.length - 1).join(' ');
    } else {
      core = deduped.slice(0, 3).join(' ');
    }
  }

  return { primary, core, secondary };
}

function extractCoreKeywords(rawTitle) {
  if (!rawTitle) return '';
  return generateSearchCandidates(rawTitle).primary;
}

/**
 * Scrapes REAL Naver Shopping search results using stealth headless Chrome.
 * Two-stage strategy:
 *   1. search.shopping.naver.com (direct shopping search)
 *   2. search.naver.com integrated search (fallback - different IP blocking)
 */
async function scrapeNaverShopping(keyword, price, catalogId) {
  if (!keyword) {
    return { keyword, success: false, source: 'no_keyword', competitors: [] };
  }

  await waitForRateLimit();

  const searchQuery = extractCoreKeywords(keyword);

  console.log(`[Crawler] Original title: "${keyword}"`);
  console.log(`[Crawler] Extracted keywords: "${searchQuery}"`);

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await applyStealthToPage(page);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' });

    // ──────────────────────────────────────────────
    // STAGE 1: Direct Naver Shopping Search
    // ──────────────────────────────────────────────
    const shoppingUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(searchQuery)}`;
    console.log(`[Crawler] Stage 1: Direct shopping search...`);
    await page.goto(shoppingUrl, { waitUntil: 'networkidle2', timeout: 25000 });

    const isBlocked = await page.evaluate(() => {
      return document.body?.innerText?.includes('접속이 일시적으로 제한') || false;
    });

    if (!isBlocked) {
      // Try to extract from __NEXT_DATA__
      await page.waitForSelector('#__NEXT_DATA__', { timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));

      const directResults = await page.evaluate(() => {
        const results = [];
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl) {
          try {
            const json = JSON.parse(nextDataEl.textContent);
            const products =
              json.props?.pageProps?.initialState?.products?.list ||
              json.props?.pageProps?.initialState?.searchResult?.products?.list || [];
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
        return results;
      });

      if (directResults.length > 0) {
        await page.close(); page = null;
        directResults.sort((a, b) => a.price - b.price);
        console.log(`[Crawler] ✅ Stage 1 SUCCESS: ${directResults.length} REAL competitors from direct shopping!`);
        directResults.slice(0, 5).forEach(c => {
          console.log(`  [${c.name}] ₩${c.price.toLocaleString()} — ${c.productName.substring(0, 50)}`);
        });
        return { keyword, success: true, source: 'puppeteer_real', competitors: directResults };
      }
      console.log(`[Crawler] Stage 1: No results from direct shopping search, trying Stage 2...`);
    } else {
      console.log(`[Crawler] Stage 1: Shopping search IP blocked, trying Stage 2 fallback...`);
    }

    // ──────────────────────────────────────────────
    // STAGE 2: Naver Integrated Search (search.naver.com)
    // Different IP blocking policy - typically not blocked
    // ──────────────────────────────────────────────
    const integratedUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(searchQuery)}`;
    console.log(`[Crawler] Stage 2: Integrated search fallback...`);
    await page.goto(integratedUrl, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 500));

    const integratedResults = await page.evaluate(() => {
      const results = [];
      // Find the shopping section ("네이버 가격비교")
      const sections = document.querySelectorAll('section');
      let shopSection = null;
      sections.forEach(s => {
        const h = s.querySelector('h2, h3');
        if (h && h.textContent.includes('가격비교')) shopSection = s;
      });
      if (!shopSection) return results;

      // Product title links have class containing 'GBrjh9Fl'
      // Mall name links have class containing 'iMhVFYLc'
      // Price spans have class containing 'lfETsaia'
      const titleLinks = shopSection.querySelectorAll('a[class*="GBrjh9Fl"]');
      titleLinks.forEach((link, idx) => {
        const card = link.closest('li') || link.closest('div')?.parentElement?.closest('div');
        if (!card) return;

        const productName = link.textContent.trim();
        const url = link.href || '';

        // Find mall name
        const mallLink = card.querySelector('a[class*="iMhVFYLc"]');
        const mallName = mallLink ? mallLink.textContent.trim() : '';

        // Find price - get the lowest price in the card
        const priceSpans = card.querySelectorAll('span[class*="lfETsaia"]');
        let itemPrice = 0;
        priceSpans.forEach(ps => {
          const val = parseInt(ps.textContent.replace(/[^0-9]/g, ''), 10);
          if (val > 0 && (itemPrice === 0 || val < itemPrice)) itemPrice = val;
        });

        if (productName && itemPrice > 0) {
          results.push({ rank: idx + 1, name: mallName || '쇼핑몰', productName, price: itemPrice, url });
        }
      });

      // Fallback: if class-based selectors fail, try broader approach
      if (results.length === 0) {
        const allLinks = shopSection.querySelectorAll('a');
        let linkPairs = [];
        allLinks.forEach(a => {
          const text = (a.textContent || '').trim();
          const href = a.href || '';
          if (text.length > 10 && text.length < 120 && !text.includes('광고') && href.includes('shopping')) {
            // Find price near this link
            const parent = a.closest('li') || a.closest('div');
            if (parent) {
              const priceMatch = parent.innerText.match(/([0-9,]+)원?/);
              if (priceMatch) {
                const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
                if (price > 0) linkPairs.push({ productName: text, price, url: href, name: '쇼핑몰' });
              }
            }
          }
        });
        linkPairs.forEach((lp, i) => results.push({ rank: i + 1, ...lp }));
      }

      return results;
    });

    await page.close(); page = null;

    if (integratedResults.length > 0) {
      integratedResults.sort((a, b) => a.price - b.price);
      console.log(`[Crawler] ✅ Stage 2 SUCCESS: ${integratedResults.length} REAL competitors from integrated search!`);
      integratedResults.slice(0, 5).forEach(c => {
        console.log(`  [${c.name}] ₩${c.price.toLocaleString()} — ${c.productName.substring(0, 50)}`);
      });
      return { keyword, success: true, source: 'puppeteer_real', competitors: integratedResults };
    }

    console.log(`[Crawler] ⚠️ Both stages returned no results for "${searchQuery}"`);
    return { keyword, success: true, source: 'no_results', competitors: [] };
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

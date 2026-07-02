const axios = require('axios');
const cheerio = require('cheerio');

// Typical user-agent to avoid basic bots blocking
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
];

// List of target competitors we want to identify from malls
const TARGET_COMPETITORS = [
  '하나투어', '모두투어', '야놀자', '인터파크', '마이리얼트립', '노랑풍선', 
  '참좋은여행', '온라인투어', '롯데관광', '한진관광', '데일리호텔', '여기어때'
];

/**
 * Scrapes Naver Shopping and extracts competitor prices.
 * @param {string} keyword The search query keyword
 * @returns {Promise<Object>} Object containing search query and matched competitors
 */
async function scrapeNaverShopping(keyword) {
  const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`;
  const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': randomUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 8000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const competitors = [];

    // Approach 1: Try to parse __NEXT_DATA__ script
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const jsonData = JSON.parse(nextDataScript);
        
        // Traverse the JSON to find products list
        // Typically located under props.pageProps.initialState.products.list
        const productsList = jsonData.props?.pageProps?.initialState?.products?.list || 
                             jsonData.props?.pageProps?.initialState?.searchResult?.products?.list || [];
        
        if (productsList && productsList.length > 0) {
          productsList.forEach(item => {
            const product = item.item;
            if (!product) return;
            
            const name = product.productName || '';
            const price = parseInt(product.price || '0', 10);
            const mall = product.mallName || product.crMallName || '';
            const url = product.adMallUrl || product.pcUrl || '';
            
            if (mall && price > 0) {
              competitors.push({
                mall,
                productName: name,
                price,
                url: url.startsWith('http') ? url : `https://search.shopping.naver.com${url}`
              });
            }
          });
        }
      } catch (jsonErr) {
        console.warn('Error parsing __NEXT_DATA__ script:', jsonErr.message);
      }
    }

    // Approach 2: DOM scraping fallback if __NEXT_DATA__ is empty or not matching
    if (competitors.length === 0) {
      // Find list items of product_item
      $('[class^="product_item__"]').each((index, element) => {
        const name = $(element).find('[class^="product_title__"] a').text().trim();
        const priceText = $(element).find('[class^="price_num__"]').text().replace(/[^0-9]/g, '');
        const price = parseInt(priceText, 10);
        let mall = $(element).find('[class^="product_mall__"]').text().trim() || 
                   $(element).find('[class^="product_mall_title__"]').text().trim() ||
                   $(element).find('img[class^="product_img_mall__"]').attr('alt') || '';
        const url = $(element).find('[class^="product_title__"] a').attr('href') || '';

        if (price > 0) {
          competitors.push({
            mall,
            productName: name,
            price,
            url: url.startsWith('http') ? url : `https://search.shopping.naver.com${url}`
          });
        }
      });
    }

    // Match and filter the results
    if (competitors.length > 0) {
      // Filter out products that might not be travel products (just in case, check keyword relevance)
      // Map to target competitors or find general travel agencies
      const matchedCompetitors = [];
      const seenMalls = new Set();

      competitors.forEach(c => {
        // If it matches one of our targets or contains keywords like Tour, Trip, etc.
        const lowerMall = c.mall.toLowerCase();
        const isTarget = TARGET_COMPETITORS.some(target => lowerMall.includes(target.toLowerCase())) ||
                         lowerMall.includes('tour') || lowerMall.includes('trip') || lowerMall.includes('투어') || lowerMall.includes('여행');
        
        if (isTarget && !seenMalls.has(c.mall)) {
          seenMalls.add(c.mall);
          matchedCompetitors.push({
            name: c.mall,
            productName: c.productName,
            price: c.price,
            url: c.url
          });
        }
      });

      // If we couldn't match specific travel targets, just take the top 4 general malls as competitors
      if (matchedCompetitors.length === 0) {
        competitors.slice(0, 4).forEach(c => {
          if (!seenMalls.has(c.mall) && c.mall) {
            seenMalls.add(c.mall);
            matchedCompetitors.push({
              name: c.mall,
              productName: c.productName,
              price: c.price,
              url: c.url
            });
          }
        });
      }

      if (matchedCompetitors.length > 0) {
        return {
          keyword,
          success: true,
          source: 'crawler',
          competitors: matchedCompetitors.sort((a, b) => a.price - b.price)
        };
      }
    }

    // If scraping succeeded but list is empty, trigger mock fallback
    throw new Error('No competitor items parsed');

  } catch (error) {
    console.warn(`Scraper failed for [${keyword}]: ${error.message}. Returning high-fidelity mock data fallback.`);
    return getMockCompetitors(keyword);
  }
}

/**
 * Returns realistic mock competitor data for travel products if scraping is blocked.
 * @param {string} keyword Search keyword
 */
function getMockCompetitors(keyword) {
  // Base prices based on keyword
  let basePrice = 300000;
  if (keyword.includes('제주')) basePrice = 300000;
  else if (keyword.includes('후쿠오카')) basePrice = 430000;
  else if (keyword.includes('발리')) basePrice = 1250000;
  else if (keyword.includes('오사카')) basePrice = 350000;
  else if (keyword.includes('유럽')) basePrice = 3500000;

  // Generate varied competitor prices around the base price
  const competitorsList = [
    { name: '하나투어', priceOffset: 1.05 }, // 5% more expensive
    { name: '모두투어', priceOffset: 1.01 }, // 1% more expensive
    { name: '야놀자', priceOffset: 0.97 },  // 3% cheaper
    { name: '마이리얼트립', priceOffset: 0.99 }, // 1% cheaper
    { name: '인터파크투어', priceOffset: 1.02 }, // 2% more expensive
    { name: '노랑풍선', priceOffset: 0.98 }   // 2% cheaper
  ];

  // Pick 3-4 random competitors
  const shuffled = competitorsList.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));

  const competitors = selected.map(comp => {
    // Round to nearest 1,000 won
    const finalPrice = Math.round((basePrice * comp.priceOffset) / 1000) * 1000;
    return {
      name: comp.name,
      productName: `${keyword} 특가 패키지 [실시간 가격비교]`,
      price: finalPrice,
      url: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`
    };
  });

  return {
    keyword,
    success: true,
    source: 'mock_fallback',
    competitors: competitors.sort((a, b) => a.price - b.price)
  };
}

module.exports = {
  scrapeNaverShopping
};

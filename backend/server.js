const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { scrapeNaverShopping } = require('./crawler');
const NaverAdsAPI = require('./naver-ads');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');

// Middleware
app.use(cors());
app.use(express.json());

// DB Helper Functions
function getDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read database.json:', err);
    return { products: [], naverAdsSettings: {} };
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save database.json:', err);
    return false;
  }
}

// Initialize Naver Ad API Helper
const adApi = new NaverAdsAPI(getDB());

// -------------------------------------------------------------
// 1. PRODUCT & COMPETITOR ROUTES
// -------------------------------------------------------------

// Get all products and competitor match status
app.get('/api/products', (req, res) => {
  const db = getDB();
  res.json(db.products || []);
});

// Add new product
app.post('/api/products', (req, res) => {
  const db = getDB();
  const { name, price, marginRate, keywords } = req.body;

  if (!name || !price || !keywords) {
    return res.status(400).json({ error: 'Name, price, and keywords are required.' });
  }

  const newProduct = {
    id: `prod-${Date.now()}`,
    name,
    price: parseInt(price, 10),
    marginRate: parseFloat(marginRate || 0.2),
    keywords: Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim()),
    competitors: [],
    lastCrawled: null
  };

  db.products.push(newProduct);
  saveDB(db);
  
  res.status(201).json(newProduct);
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
  const db = getDB();
  const productIndex = db.products.findIndex(p => p.id === req.params.id);

  if (productIndex === -1) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  db.products.splice(productIndex, 1);
  saveDB(db);

  res.json({ message: 'Product deleted successfully.' });
});

// Trigger crawler and update competitor match prices
app.post('/api/crawler/match', async (req, res) => {
  const { productId, keyword, price, catalogId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required.' });
  }

  const db = getDB();
  const product = db.products.find(p => p.id === productId);

  // Use specified keyword or the first keyword from the product's list
  const searchKeyword = keyword || (product ? product.keywords[0] : null);
  if (!searchKeyword) {
    return res.status(400).json({ error: 'No keyword available for scraping.' });
  }

  const settings = db.naverAdsSettings || {};

  console.log(`Running crawler for product [${product ? product.name : productId}] using keyword [${searchKeyword}] with target base price [${price || 'default'}] and catalogId [${catalogId || 'none'}]...`);
  
  const result = await scrapeNaverShopping(
    searchKeyword, 
    price, 
    catalogId, 
    settings.naverOpenClientId, 
    settings.naverOpenClientSecret
  );

  if (result.success) {
    if (product) {
      // Update product competitors and crawl date if product exists
      product.competitors = result.competitors;
      product.lastCrawled = new Date().toISOString();
      db.naverAdsSettings = getDB().naverAdsSettings; // sync settings just in case
      saveDB(db);
    }

    res.json({
      message: 'Crawler matched competitor prices successfully.',
      source: result.source,
      product: product || {
        id: productId,
        name: searchKeyword,
        price: price || 0,
        keywords: [searchKeyword],
        competitors: result.competitors,
        lastCrawled: new Date().toISOString()
      }
    });
  } else {
    res.status(500).json({ error: 'Competitor matching failed.', details: result });
  }
});

// -------------------------------------------------------------
// 2. NAVER AD API CONFIG & PROXY ROUTES
// -------------------------------------------------------------

// Get Naver Ad settings
app.get('/api/naver-ads/settings', (req, res) => {
  const db = getDB();
  res.json(db.naverAdsSettings || {});
});

// Save Naver Ad settings
app.post('/api/naver-ads/settings', (req, res) => {
  const db = getDB();
  const { customerId, apiKey, apiSecret, licenseKey, naverOpenClientId, naverOpenClientSecret } = req.body;
  const prev = db.naverAdsSettings || {};

  db.naverAdsSettings = {
    customerId: customerId !== undefined ? customerId : (prev.customerId || ''),
    apiKey: apiKey !== undefined ? apiKey : (prev.apiKey || ''),
    apiSecret: apiSecret !== undefined ? apiSecret : (prev.apiSecret || ''),
    licenseKey: licenseKey !== undefined ? licenseKey : (prev.licenseKey || ''),
    naverOpenClientId: naverOpenClientId !== undefined ? naverOpenClientId : (prev.naverOpenClientId || ''),
    naverOpenClientSecret: naverOpenClientSecret !== undefined ? naverOpenClientSecret : (prev.naverOpenClientSecret || ''),
    isConnected: !!((customerId !== undefined ? customerId : prev.customerId) && (apiKey !== undefined ? apiKey : prev.apiKey) && (apiSecret !== undefined ? apiSecret : prev.apiSecret))
  };

  saveDB(db);
  
  // Re-instantiate/update the Naver Ad API configuration helper
  adApi.db = db;

  res.json({
    message: 'Naver Ads configuration saved.',
    settings: db.naverAdsSettings
  });
});

// Fetch active campaigns
app.get('/api/naver-ads/campaigns', async (req, res) => {
  try {
    const campaigns = await adApi.getCampaigns();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch adgroups in a campaign
app.get('/api/naver-ads/adgroups', async (req, res) => {
  const { campaignId } = req.query;
  try {
    const groups = await adApi.getAdGroups(campaignId);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch keywords in an adgroup
app.get('/api/naver-ads/keywords', async (req, res) => {
  const { adgroupId } = req.query;
  try {
    const keywords = await adApi.getKeywords(adgroupId);
    res.json(keywords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch ads (materials) in an adgroup
app.get('/api/naver-ads/ads', async (req, res) => {
  const { adgroupId } = req.query;
  try {
    const ads = await adApi.getAds(adgroupId);
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adjust adgroup bid
app.post('/api/naver-ads/adjust-adgroup-bid', async (req, res) => {
  const { adgroupId, bidAmt } = req.body;
  if (!adgroupId || bidAmt === undefined) {
    return res.status(400).json({ error: 'Adgroup ID and bid amount are required.' });
  }
  try {
    const result = await adApi.adjustAdGroupBid(adgroupId, parseInt(bidAmt, 10));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adjust keyword bid
app.post('/api/naver-ads/adjust-bid', async (req, res) => {
  const { keywordId, bidAmt } = req.body;
  
  if (!keywordId || bidAmt === undefined) {
    return res.status(400).json({ error: 'Keyword ID and bid amount are required.' });
  }

  try {
    const result = await adApi.adjustKeywordBid(keywordId, parseInt(bidAmt, 10));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retrieve monthly search query statistics and average CPC (Naver Keyword Tool)
app.get('/api/naver-ads/keyword-info', async (req, res) => {
  const { keywords } = req.query;
  
  if (!keywords) {
    return res.status(400).json({ error: 'Keywords are required.' });
  }

  const keywordsArray = keywords.split(',').map(kw => kw.trim());
  try {
    const result = await adApi.getKeywordInfo(keywordsArray);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch stats for campaign/adgroup/keyword IDs
app.get('/api/naver-ads/stats', async (req, res) => {
  const { ids, fields } = req.query;
  if (!ids) {
    return res.status(400).json({ error: 'IDs list is required.' });
  }
  const idsArray = ids.split(',').map(id => id.trim());
  try {
    const stats = await adApi.getStats(idsArray, fields);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch auto-bidding configurations
app.get('/api/naver-ads/autobid-settings', (req, res) => {
  const db = getDB();
  res.json(db.autoBidSettings || {});
});

// Save auto-bidding configurations
app.post('/api/naver-ads/autobid-settings', (req, res) => {
  const db = getDB();
  const { keywordId, enabled, targetRank } = req.body;
  if (!keywordId) {
    return res.status(400).json({ error: 'Keyword ID is required.' });
  }
  if (!db.autoBidSettings) db.autoBidSettings = {};
  db.autoBidSettings[keywordId] = {
    enabled: !!enabled,
    targetRank: targetRank || '1-3'
  };
  saveDB(db);
  res.json({ message: 'Auto-bidding configuration updated.', settings: db.autoBidSettings[keywordId] });
});

// Toggle product stock status manually to test Out-of-Stock guard
app.post('/api/naver-ads/toggle-product-stock', (req, res) => {
  const db = getDB();
  const { productId, stockStatus } = req.body; // 'IN_STOCK' or 'OUT_OF_STOCK'
  if (!productId || !stockStatus) {
    return res.status(400).json({ error: 'Product ID and stock status are required.' });
  }
  const product = db.products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  product.stockStatus = stockStatus;
  saveDB(db);
  
  // Instantly trigger out-of-stock guard logic to reflect changes immediately
  runOutOfStockAdGuard().catch(e => console.error('Out of stock trigger failed:', e));
  
  res.json({ message: `Product stock status set to ${stockStatus}.`, product });
});

// =============================================================
// BACKEND DAEMONS: AUTO-BIDDING SCHEDULER & OUT-OF-STOCK GUARD
// =============================================================

function refreshAdApiDB() {
  adApi.db = getDB();
}

async function runAutoBiddingScheduler() {
  console.log('[AUTO-BIDDING SCHEDULER] Running scheduled checks...');
  refreshAdApiDB();
  const db = getDB();
  const autoBidSettings = db.autoBidSettings || {};
  
  const keywordIds = Object.keys(autoBidSettings).filter(id => autoBidSettings[id].enabled);
  if (keywordIds.length === 0) {
    console.log('[AUTO-BIDDING SCHEDULER] No keywords configured for auto-bidding.');
    return;
  }

  try {
    const statsRes = await adApi.getStats(keywordIds);
    const statsData = statsRes.data || [];

    for (const kwStat of statsData) {
      const keywordId = kwStat.id;
      const currentRank = kwStat.avgRnk;
      const settings = autoBidSettings[keywordId];
      const targetRankRange = settings.targetRank;
      
      let targetMin = 1.0;
      let targetMax = 3.0;
      if (targetRankRange === '3-5') {
        targetMin = 3.0;
        targetMax = 5.0;
      } else if (targetRankRange === '5-10') {
        targetMin = 5.0;
        targetMax = 10.0;
      }

      const kwDetails = await adApi.request('GET', `/ncc/keywords/${keywordId}`);
      if (!kwDetails) continue;

      let currentBid = kwDetails.bidAmt || 800;
      let newBid = currentBid;

      if (currentRank > targetMax) {
        newBid = Math.min(10000, currentBid + 100);
        console.log(`[AUTO-BIDDING] Keyword ${kwDetails.keyword} (Rank: ${currentRank}) is below target ${targetRankRange}. Raising bid from ${currentBid} to ${newBid}`);
      } else if (currentRank < targetMin) {
        newBid = Math.max(150, currentBid - 50);
        console.log(`[AUTO-BIDDING] Keyword ${kwDetails.keyword} (Rank: ${currentRank}) is above target ${targetRankRange}. Lowering bid from ${currentBid} to ${newBid}`);
      } else {
        console.log(`[AUTO-BIDDING] Keyword ${kwDetails.keyword} (Rank: ${currentRank}) is within target ${targetRankRange}. Bid maintained at ${currentBid}`);
      }

      if (newBid !== currentBid) {
        await adApi.adjustKeywordBid(keywordId, newBid);
      }
    }
  } catch (err) {
    console.error('[AUTO-BIDDING SCHEDULER] Error during execution:', err.message);
  }
}

async function runOutOfStockAdGuard() {
  console.log('[OUT-OF-STOCK GUARD] Checking product stock statuses...');
  refreshAdApiDB();
  const db = getDB();
  const products = db.products || [];

  const outOfStockProducts = products.filter(p => p.stockStatus === 'OUT_OF_STOCK');
  const inStockProducts = products.filter(p => p.stockStatus !== 'OUT_OF_STOCK');

  try {
    const campaigns = await adApi.getCampaigns();
    for (const campaign of campaigns) {
      if (campaign.campaignTp !== 'SHOPPING') continue;

      const adgroups = await adApi.getAdGroups(campaign.nccCampaignId);
      for (const ag of adgroups) {
        const ads = await adApi.getAds(ag.nccAdgroupId);
        for (const ad of ads) {
          const adName = ad.adAttr?.displayProductName || ad.referenceData?.productTitle || ad.referenceData?.productName || ad.name || '';
          
          const matchedOutOfStock = outOfStockProducts.find(p => adName.includes(p.name) || p.name.includes(adName));
          const matchedInStock = inStockProducts.find(p => adName.includes(p.name) || p.name.includes(adName));

          if (matchedOutOfStock) {
            const isPaused = ad.userLock === true;
            if (!isPaused) {
              console.log(`[OUT-OF-STOCK GUARD] Product [${matchedOutOfStock.name}] is OUT OF STOCK. Pausing active ad [${adName}]...`);
              await adApi.updateAdStatus(ad.nccAdId, false);
            }
          } else if (matchedInStock) {
            const isPaused = ad.userLock === true;
            if (isPaused) {
              console.log(`[OUT-OF-STOCK GUARD] Product [${matchedInStock.name}] is back IN STOCK. Resuming paused ad [${adName}]...`);
              await adApi.updateAdStatus(ad.nccAdId, true);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[OUT-OF-STOCK GUARD] Error during execution:', err.message);
  }
}

// Start daemon timers on server load
setInterval(runAutoBiddingScheduler, 3600000); // 1 hour
setInterval(runOutOfStockAdGuard, 600000); // 10 minutes

// Trigger immediately on startup
setTimeout(() => {
  runAutoBiddingScheduler().catch(e => console.error(e));
  runOutOfStockAdGuard().catch(e => console.error(e));
}, 5000);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Start server
app.listen(PORT, () => {
  console.log(`Boolub Travel Ad Dashboard server is running on http://localhost:${PORT}`);
});

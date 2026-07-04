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

// Adjust individual ad bid (per-product CPC for shopping ads)
app.post('/api/naver-ads/adjust-ad-bid', async (req, res) => {
  const { adId, bidAmt } = req.body;
  if (!adId || bidAmt === undefined) {
    return res.status(400).json({ error: 'Ad ID and bid amount are required.' });
  }
  try {
    const result = await adApi.adjustAdBid(adId, parseInt(bidAmt, 10));
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

// Toggle Ad on/off (userLock)
app.post('/api/naver-ads/toggle-ad', async (req, res) => {
  const { adId, userLock } = req.body;
  if (!adId || userLock === undefined) {
    return res.status(400).json({ error: 'Ad ID and userLock are required.' });
  }
  try {
    const result = await adApi.toggleAd(adId, userLock);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Start server
app.listen(PORT, () => {
  console.log(`Boolub Travel Ad Dashboard server is running on http://localhost:${PORT}`);
});

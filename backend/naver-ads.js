const crypto = require('crypto');
const axios = require('axios');

// Naver Search Ad API base URL
const NAVER_API_BASE_URL = 'https://api.searchad.naver.com';

/**
 * Generates the headers required for Naver Search Ad API.
 * @param {string} method HTTP Method (GET, POST, PUT, DELETE)
 * @param {string} path API Endpoint path (e.g., '/ncc/campaigns')
 * @param {Object} credentials API Credentials (apiKey, apiSecret, customerId)
 */
function generateNaverHeaders(method, path, credentials) {
  const { apiKey, apiSecret, customerId } = credentials;
  
  if (!apiKey || !apiSecret || !customerId) {
    throw new Error('Missing Naver Ads API credentials.');
  }

  const timestamp = Date.now().toString();
  const signatureText = `${timestamp}.${method.toUpperCase()}.${path}`;
  
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureText)
    .digest('base64');

  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': apiKey,
    'X-Customer': customerId,
    'X-Signature': signature
  };
}

/**
 * Proxies requests to Naver Ad API or returns mock data if credentials are not set.
 */
class NaverAdsAPI {
  constructor(db) {
    this.db = db;
    // In-memory simulation database for shopping ads to preserve toggle state across requests
    this.mockAdsStore = {
      'ad-shop-001': { nccAdId: 'ad-shop-001', nccAdgroupId: 'grp-shop-01', name: '발리 풀빌라 5일 허니문 패키지', referenceData: { productName: '발리 풀빌라 5일 허니문 패키지', lowPrice: '1200000' }, inspectStatus: 'APPROVED', userLock: false },
      'ad-shop-002': { nccAdId: 'ad-shop-002', nccAdgroupId: 'grp-shop-01', name: '발리 스냅 촬영 포함 커플 투어 6일', referenceData: { productName: '발리 스냅 촬영 포함 커플 투어 6일', lowPrice: '850000' }, inspectStatus: 'APPROVED', userLock: false },
      'ad-shop-003': { nccAdId: 'ad-shop-003', nccAdgroupId: 'grp-shop-02', name: '후쿠오카 유후인 온천 료칸 3일', referenceData: { productName: '후쿠오카 유후인 온천 료칸 3일', lowPrice: '450000' }, inspectStatus: 'APPROVED', userLock: false },
      'ad-shop-004': { nccAdId: 'ad-shop-004', nccAdgroupId: 'grp-shop-02', name: '후쿠오카 도심 세미더블 패키지', referenceData: { productName: '후쿠오카 도심 세미더블 패키지', lowPrice: '380000' }, inspectStatus: 'APPROVED', userLock: false },
      'ad-shop-005': { nccAdId: 'ad-shop-005', nccAdgroupId: 'grp-shop-03', name: '일본 매일 2GB 로밍 데이터 이심(eSIM)', referenceData: { productName: '일본 매일 2GB 로밍 데이터 이심(eSIM)', lowPrice: '14500' }, inspectStatus: 'APPROVED', userLock: false }
    };
  }

  getCredentials() {
    const settings = this.db.naverAdsSettings || {};
    return {
      apiKey: settings.apiKey || process.env.NAVER_API_KEY,
      apiSecret: settings.apiSecret || process.env.NAVER_API_SECRET,
      customerId: settings.customerId || process.env.NAVER_CUSTOMER_ID,
      licenseKey: settings.licenseKey || process.env.NAVER_LICENSE_KEY
    };
  }

  isConfigured() {
    const creds = this.getCredentials();
    return !!(creds.apiKey && creds.apiSecret && creds.customerId);
  }

  /**
   * General fetch proxy that appends Naver API headers
   */
  async request(method, path, queryParams = {}, data = null) {
    if (!this.isConfigured()) {
      return this.getMockResponse(method, path, queryParams, data);
    }

    const credentials = this.getCredentials();
    const headers = generateNaverHeaders(method, path, credentials);
    
    // Add License Key if it exists (some endpoints require X-API-License)
    if (credentials.licenseKey) {
      headers['X-API-License'] = credentials.licenseKey;
    }

    try {
      const response = await axios({
        method,
        url: `${NAVER_API_BASE_URL}${path}`,
        headers,
        params: queryParams,
        data,
        timeout: 10000
      });
      return response.data;
    } catch (err) {
      console.error(`Naver Ad API Error [${method} ${path}]:`, err.response?.data || err.message);
      if (method === 'GET') {
        console.warn('Falling back to simulated data due to API error.');
        return this.getMockResponse(method, path, queryParams, data);
      } else {
        throw new Error(err.response?.data?.message || err.response?.data?.error || err.message);
      }
    }
  }

  /**
   * Get Campaigns
   */
  async getCampaigns() {
    return this.request('GET', '/ncc/campaigns');
  }

  /**
   * Get Ad Groups
   */
  async getAdGroups(campaignId) {
    return this.request('GET', '/ncc/adgroups', campaignId ? { nccCampaignId: campaignId } : {});
  }

  /**
   * Get Keywords
   */
  async getKeywords(adgroupId) {
    return this.request('GET', '/ncc/keywords', adgroupId ? { nccAdgroupId: adgroupId } : {});
  }

  /**
   * Get Ads (Materials)
   */
  async getAds(adgroupId) {
    return this.request('GET', '/ncc/ads', adgroupId ? { nccAdgroupId: adgroupId } : {});
  }

  /**
   * Adjust Keyword Bid
   */
  async adjustKeywordBid(keywordId, bidAmt) {
    // Naver Ad API requires body updates for keyword bids
    const path = `/ncc/keywords/${keywordId}`;
    return this.request('PUT', path, {}, { bidAmt });
  }

  /**
   * Adjust Ad Group Bid
   * Naver API requires the full adgroup object for PUT updates.
   * We GET the current state first, then modify bidAmt and PUT back.
   */
  async adjustAdGroupBid(adgroupId, bidAmt) {
    const path = `/ncc/adgroups/${adgroupId}`;
    // 1. Get current full adgroup object
    const current = await this.request('GET', path);
    if (!current || !current.nccAdgroupId) {
      throw new Error('Failed to fetch current adgroup data');
    }
    // 2. Modify bidAmt and remove read-only fields
    current.bidAmt = bidAmt;
    delete current.editTm;
    delete current.regTm;
    delete current.targets;
    delete current.targetSummary;
    delete current.expectCost;
    // 3. PUT full updated object
    return this.request('PUT', path, { fields: 'bidAmt' }, current);
  }

  /**
   * Toggle Ad userLock (on/off)
   * userLock: true = paused, false = active
   * Naver API requires the full ad object for PUT updates.
   */
  async toggleAd(adId, userLock) {
    const getPath = `/ncc/ads/${adId}`;
    // 1. Get current full ad object
    const current = await this.request('GET', getPath);
    if (!current || !current.nccAdId) {
      throw new Error('Failed to fetch current ad data');
    }
    
    // 2. Construct clean payload containing ONLY nccAdId and userLock for fields=userLock update
    const payload = {
      nccAdId: current.nccAdId,
      userLock: userLock
    };
    
    // 3. PUT clean updated object - 소재 수정 URL은 '/ncc/ads' 이다! (adId 경로변수 없음)
    const putPath = `/ncc/ads`;
    return this.request('PUT', putPath, { fields: 'userLock' }, payload);
  }

  /**
   * Adjust individual Ad bid (per-product CPC for shopping ads)
   * Uses adAttr.bidAmt to change the individual product's bid.
   * Requires fields=adAttr query parameter and type field in body.
   */
  async adjustAdBid(adId, bidAmt) {
    const path = `/ncc/ads/${adId}`;
    // 1. GET current ad to get type
    const current = await this.request('GET', path);
    if (!current || !current.nccAdId) {
      throw new Error('Failed to fetch current ad data');
    }
    // 2. PUT with adAttr update
    return this.request('PUT', path, { fields: 'adAttr' }, {
      nccAdId: adId,
      type: current.type,
      adAttr: { bidAmt, useGroupBidAmt: false }
    });
  }

  /**
   * Get Keyword Tool Info (search volume, clicks, CTR)
   * Hint keywords is a comma separated string (max 5 keywords)
   */
  async getKeywordInfo(keywordsArray) {
    const hintKeywords = keywordsArray.join(',');
    return this.request('GET', '/keywordstool', { hintKeywords, showDetail: '1' });
  }

  /**
   * Mock data fallback handler
   */
  getMockResponse(method, path, queryParams, data) {
    // Simulate latency
    console.log(`[SIMULATION] Mock response for ${method} ${path}`);
    
    // 1. Keyword Tool
    if (path === '/keywordstool') {
      const keywords = (queryParams.hintKeywords || '').split(',');
      const keywordList = keywords.map(kw => {
        // Generate pseudo-random deterministic stats based on keyword string length
        const charSum = kw.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        let pcVolume = Math.round((charSum * 15) / 100) * 100;
        let mobileVolume = Math.round((charSum * 45) / 100) * 100;
        let pcClicks = Math.round(pcVolume * 0.012);
        let mobileClicks = Math.round(mobileVolume * 0.018);
        
        // Base adjustments for popular keywords
        if (kw.includes('제주')) {
          pcVolume = 12000;
          mobileVolume = 48000;
          pcClicks = 180;
          mobileClicks = 920;
        } else if (kw.includes('발리')) {
          pcVolume = 8500;
          mobileVolume = 28000;
          pcClicks = 140;
          mobileClicks = 680;
        } else if (kw.includes('후쿠오카')) {
          pcVolume = 15000;
          mobileVolume = 55000;
          pcClicks = 250;
          mobileClicks = 1150;
        } else if (kw.includes('유럽')) {
          pcVolume = 22000;
          mobileVolume = 62000;
          pcClicks = 310;
          mobileClicks = 1420;
        } else if (kw.includes('오사카')) {
          pcVolume = 18000;
          mobileVolume = 58000;
          pcClicks = 280;
          mobileClicks = 1220;
        }

        const avgCPC = Math.round((700 + (charSum % 800)) / 10) * 10;

        return {
          relKeyword: kw,
          monthlyPcQcCnt: pcVolume,
          monthlyMobileQcCnt: mobileVolume,
          monthlyPcClicks: pcClicks,
          monthlyMobileClicks: mobileClicks,
          monthlyPcCtr: parseFloat(((pcClicks / pcVolume) * 100).toFixed(2)),
          monthlyMobileCtr: parseFloat(((mobileClicks / mobileVolume) * 100).toFixed(2)),
          plAvgDepth: 15,
          compIdx: charSum % 3 === 0 ? 'HIGH' : (charSum % 3 === 1 ? 'MID' : 'LOW'),
          avgCpc: avgCPC
        };
      });
      return { keywordList };
    }

    // 2. Campaigns
    if (path === '/ncc/campaigns') {
      return [
        { nccCampaignId: 'cam-001', name: '제주도 패키지 검색광고', campaignTp: 'SEARCH', userLimitAmt: 100000, trackingUrl: '', useYn: 'Y' },
        { nccCampaignId: 'cam-002', name: '일본 온천/도시 투어', campaignTp: 'SEARCH', userLimitAmt: 200000, trackingUrl: '', useYn: 'Y' },
        { nccCampaignId: 'cam-003', name: '동남아 허니문 기획전', campaignTp: 'SEARCH', userLimitAmt: 300000, trackingUrl: '', useYn: 'Y' },
        { nccCampaignId: 'cam-004', name: '유럽 일주/패키지 테마', campaignTp: 'SEARCH', userLimitAmt: 500000, trackingUrl: '', useYn: 'N' },
        { nccCampaignId: 'cam-shop-01', name: 'B01.쇼핑검색(동남아/동북아)', campaignTp: 'SHOPPING', userLimitAmt: 150000, trackingUrl: '', useYn: 'Y' },
        { nccCampaignId: 'cam-shop-02', name: 'B02.쇼핑검색(이심/기타)', campaignTp: 'SHOPPING', userLimitAmt: 250000, trackingUrl: '', useYn: 'Y' }
      ];
    }

    // 3. Ad Groups
    if (path === '/ncc/adgroups') {
      const campId = queryParams.nccCampaignId;
      if (campId === 'cam-001') {
        return [
          { nccAdgroupId: 'grp-001', nccCampaignId: campId, name: '제주도 3박4일 그룹', bidAmt: 800, useYn: 'Y' }
        ];
      } else if (campId === 'cam-002') {
        return [
          { nccAdgroupId: 'grp-002', nccCampaignId: campId, name: '후쿠오카 온천 그룹', bidAmt: 1000, useYn: 'Y' },
          { nccAdgroupId: 'grp-003', nccCampaignId: campId, name: '오사카 자유여행 그룹', bidAmt: 700, useYn: 'Y' }
        ];
      } else if (campId === 'cam-003') {
        return [
          { nccAdgroupId: 'grp-004', nccCampaignId: campId, name: '발리 허니문 그룹', bidAmt: 1500, useYn: 'Y' }
        ];
      } else if (campId === 'cam-004') {
        return [
          { nccAdgroupId: 'grp-005', nccCampaignId: campId, name: '유럽 패키지 그룹', bidAmt: 2000, useYn: 'Y' }
        ];
      } else if (campId === 'cam-shop-01') {
        return [
          { nccAdgroupId: 'grp-shop-01', nccCampaignId: campId, name: '발리 패키지 상품군', bidAmt: 850, useYn: 'Y' },
          { nccAdgroupId: 'grp-shop-02', nccCampaignId: campId, name: '후쿠오카 료칸 상품군', bidAmt: 1050, useYn: 'Y' }
        ];
      } else if (campId === 'cam-shop-02') {
        return [
          { nccAdgroupId: 'grp-shop-03', nccCampaignId: campId, name: '일본 로밍 이심 상품군', bidAmt: 600, useYn: 'Y' }
        ];
      }
      return [];
    }

    // 4. Keywords
    if (path === '/ncc/keywords') {
      const grpId = queryParams.nccAdgroupId;
      if (grpId === 'grp-001') {
        return [
          { nccKeywordId: 'kwd-001', nccAdgroupId: grpId, keyword: '제주도 여행', bidAmt: 900, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-002', nccAdgroupId: grpId, keyword: '제주도 패키지', bidAmt: 1200, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-003', nccAdgroupId: grpId, keyword: '제주도 3박4일', bidAmt: 600, useYn: 'Y', status: 'ELIGIBLE' }
        ];
      } else if (grpId === 'grp-002') {
        return [
          { nccKeywordId: 'kwd-004', nccAdgroupId: grpId, keyword: '후쿠오카 여행', bidAmt: 1100, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-005', nccAdgroupId: grpId, keyword: '후쿠오카 온천', bidAmt: 1400, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-006', nccAdgroupId: grpId, keyword: '후쿠오카 패키지', bidAmt: 950, useYn: 'Y', status: 'ELIGIBLE' }
        ];
      } else if (grpId === 'grp-003') {
        return [
          { nccKeywordId: 'kwd-007', nccAdgroupId: grpId, keyword: '오사카 여행', bidAmt: 750, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-008', nccAdgroupId: grpId, keyword: '오사카 패키지', bidAmt: 800, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-009', nccAdgroupId: grpId, keyword: '오사카 자유여행', bidAmt: 600, useYn: 'Y', status: 'ELIGIBLE' }
        ];
      } else if (grpId === 'grp-004') {
        return [
          { nccKeywordId: 'kwd-010', nccAdgroupId: grpId, keyword: '발리 여행', bidAmt: 1200, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-011', nccAdgroupId: grpId, keyword: '발리 신혼여행', bidAmt: 1800, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-012', nccAdgroupId: grpId, keyword: '발리 허니문', bidAmt: 1600, useYn: 'Y', status: 'ELIGIBLE' }
        ];
      } else if (grpId === 'grp-005') {
        return [
          { nccKeywordId: 'kwd-013', nccAdgroupId: grpId, keyword: '유럽 패키지', bidAmt: 2200, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-014', nccAdgroupId: grpId, keyword: '유럽 여행', bidAmt: 1800, useYn: 'Y', status: 'ELIGIBLE' },
          { nccKeywordId: 'kwd-015', nccAdgroupId: grpId, keyword: '유럽 패키지 여행', bidAmt: 2500, useYn: 'Y', status: 'ELIGIBLE' }
        ];
      }
      return [];
    }

    // 4-2. Ads (Shopping Materials)
    if (path === '/ncc/ads') {
      if (method === 'PUT') {
        const payload = data || {};
        const adId = payload.nccAdId;
        console.log(`[SIMULATION] Updating Mock Ad ${adId} userLock to ${payload.userLock}`);
        if (this.mockAdsStore[adId]) {
          this.mockAdsStore[adId].userLock = payload.userLock;
          return this.mockAdsStore[adId];
        }
        return { result: 'SUCCESS_SIMULATED', userLock: payload.userLock };
      }
      
      const grpId = queryParams.nccAdgroupId;
      const allAds = Object.values(this.mockAdsStore);
      return allAds.filter(ad => ad.nccAdgroupId === grpId);
    }

    // 4-3. Single Ad GET/PUT Simulation
    if (path.startsWith('/ncc/ads/')) {
      const adId = path.split('/').pop();
      if (method === 'PUT') {
        const payload = data || {};
        console.log(`[SIMULATION] Updating Mock Ad ${adId} userLock to ${payload.userLock}`);
        if (this.mockAdsStore[adId]) {
          this.mockAdsStore[adId].userLock = payload.userLock;
          return this.mockAdsStore[adId];
        }
        return { result: 'SUCCESS_SIMULATED', userLock: payload.userLock };
      }
      
      console.log(`[SIMULATION] Single Ad ${adId} requested.`);
      const existing = this.mockAdsStore[adId];
      if (existing) {
        return existing;
      }
      return {
        nccAdId: adId,
        nccAdgroupId: 'grp-shop-01',
        userLock: false,
        inspectStatus: 'APPROVED'
      };
    }

    // 5. Adjust Bid
    if (path.startsWith('/ncc/keywords/')) {
      const keywordId = path.split('/').pop();
      console.log(`[SIMULATION] Keyword ${keywordId} bid updated to ${data.bidAmt} KRW`);
      return {
        nccKeywordId: keywordId,
        bidAmt: data.bidAmt,
        result: 'SUCCESS_SIMULATED'
      };
    }

    if (path.startsWith('/ncc/adgroups/')) {
      const adgroupId = path.split('/').pop();
      console.log(`[SIMULATION] Adgroup ${adgroupId} bid updated to ${data.bidAmt} KRW`);
      return {
        nccAdgroupId: adgroupId,
        bidAmt: data.bidAmt,
        result: 'SUCCESS_SIMULATED'
      };
    }

    return {};
  }
}

module.exports = NaverAdsAPI;

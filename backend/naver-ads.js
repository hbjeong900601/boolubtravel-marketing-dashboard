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
      // Fallback to mock if API returns error (e.g. invalid key) to keep dashboard responsive
      console.warn('Falling back to simulated data due to API error.');
      return this.getMockResponse(method, path, queryParams, data);
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
   * Adjust Keyword Bid
   */
  async adjustKeywordBid(keywordId, bidAmt) {
    // Naver Ad API requires body updates for keyword bids
    const path = `/ncc/keywords/${keywordId}`;
    return this.request('PUT', path, {}, { bidAmt });
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
        { nccCampaignId: 'cam-004', name: '유럽 일주/패키지 테마', campaignTp: 'SEARCH', userLimitAmt: 500000, trackingUrl: '', useYn: 'N' }
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

    return {};
  }
}

module.exports = NaverAdsAPI;

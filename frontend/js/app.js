/**
 * Burob Travel Marketing Dashboard - Main Application Logic
 * Integrates Naver Search Ad APIs, Shopping Crawler, and Bid Simulator.
 */

// Dynamically resolve backend API URL
let API_BASE = localStorage.getItem('boolub_backend_url') || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://boolubtravel-marketing-backend.je3899.workers.dev');

if (API_BASE && API_BASE.endsWith('/')) {
  API_BASE = API_BASE.slice(0, -1);
}
if (API_BASE && !/^https?:\/\//i.test(API_BASE) && API_BASE !== 'http://localhost:3000' && API_BASE !== window.location.origin) {
  API_BASE = 'https://' + API_BASE;
}

// State management
let state = {
  products: [],
  campaigns: [],
  adgroups: [],
  keywords: [],
  settings: {},
  selectedProduct: null,
  activeSimulatorKeyword: null,
  charts: {
    overview: null,
    competitor: null
  }
};

// DOM Elements
const elements = {
  // Navigation Tabs
  navItems: document.querySelectorAll('.nav-item'),
  tabContents: document.querySelectorAll('.tab-content'),
  mainTitle: document.getElementById('main-title-text'),
  mainSubtitle: document.getElementById('main-subtitle-text'),
  apiConnectionStatus: document.getElementById('api-connection-status'),
  syncNaverBtn: document.getElementById('sync-naver-btn'),
  globalSyncOverlay: document.getElementById('global-sync-overlay'),
  globalSyncText: document.getElementById('global-sync-text'),

  // Tab 1: Overview
  kpiTotalBudget: document.getElementById('kpi-total-budget'),
  kpiSpent: document.getElementById('kpi-spent'),
  kpiClicks: document.getElementById('kpi-clicks'),
  kpiRoas: document.getElementById('kpi-roas'),
  overviewCampaignTableBody: document.getElementById('overview-campaign-table-body'),
  overviewInsights: document.getElementById('overview-insights'),
  overviewRefreshTableBtn: document.getElementById('overview-refresh-table-btn'),

  // Tab 2: Compare
  compareProductTableBody: document.getElementById('compare-product-table-body'),
  openAddProductModalBtn: document.getElementById('open-add-product-modal-btn'),
  addProductModal: document.getElementById('add-product-modal'),
  closeProductModalBtn: document.getElementById('close-product-modal-btn'),
  cancelProductBtn: document.getElementById('cancel-product-btn'),
  addProductForm: document.getElementById('add-product-form'),
  strategyDetailsCard: document.getElementById('strategy-details-card'),
  strategyProductTitle: document.getElementById('strategy-product-title'),
  strategyPriceBadge: document.getElementById('strategy-price-badge'),
  strategyRecommendationTitle: document.getElementById('strategy-recommendation-title'),
  strategyRecommendationDesc: document.getElementById('strategy-recommendation-desc'),
  strategyRecommendedCpc: document.getElementById('strategy-recommended-cpc'),
  applyStrategyBidBtn: document.getElementById('apply-strategy-bid-btn'),

  // Tab 3: Simulator
  keywordSearchInput: document.getElementById('keyword-search-input'),
  keywordSearchBtn: document.getElementById('keyword-search-btn'),
  keywordResultsContainer: document.getElementById('keyword-results-container'),
  keywordResultsTbody: document.getElementById('keyword-results-tbody'),
  simulatorLayoutPanel: document.getElementById('simulator-layout-panel'),
  simSelectedKeyword: document.getElementById('sim-selected-keyword'),
  simCpcSlider: document.getElementById('sim-cpc-slider'),
  simCpcValue: document.getElementById('sim-cpc-value'),
  simBudgetSlider: document.getElementById('sim-budget-slider'),
  simBudgetValue: document.getElementById('sim-budget-value'),
  simCvrSlider: document.getElementById('sim-cvr-slider'),
  simCvrValue: document.getElementById('sim-cvr-value'),
  simMarginSlider: document.getElementById('sim-margin-slider'),
  simMarginValue: document.getElementById('sim-margin-value'),
  simProductPriceInput: document.getElementById('sim-product-price-input'),
  resExpectedRank: document.getElementById('res-expected-rank'),
  resClicks: document.getElementById('res-clicks'),
  resBurnRate: document.getElementById('res-burn-rate'),
  resConversions: document.getElementById('res-conversions'),
  resNetMargin: document.getElementById('res-net-margin'),
  resRoas: document.getElementById('res-roas'),
  simFeedbackWarning: document.getElementById('sim-feedback-warning'),

  // Tab 4: Bid Manager
  bidCampaignSelect: document.getElementById('bid-campaign-select'),
  bidAdgroupSelect: document.getElementById('bid-adgroup-select'),
  bidKeywordsContainer: document.getElementById('bid-keywords-container'),
  bidKeywordsTbody: document.getElementById('bid-keywords-tbody'),
  bidNoDataMsg: document.getElementById('bid-no-data-msg'),

  // Tab 5: Settings
  apiSettingsForm: document.getElementById('api-settings-form'),
  settingsBackendUrl: document.getElementById('settings-backend-url'),
  settingsCustomerId: document.getElementById('settings-customer-id'),
  settingsApiKey: document.getElementById('settings-api-key'),
  settingsApiSecret: document.getElementById('settings-api-secret'),
  settingsLicenseKey: document.getElementById('settings-license-key'),
  clearSettingsBtn: document.getElementById('clear-settings-btn'),

  // Tab 4-2: Shopping Optimizer
  shopCampaignSelect: document.getElementById('shop-campaign-select'),
  shopAdgroupSelect: document.getElementById('shop-adgroup-select'),
  shopOptimizerPanels: document.getElementById('shop-optimizer-panels'),
  shopNoDataMsg: document.getElementById('shop-no-data-msg'),
  shopOurPrice: document.getElementById('shop-our-price'),
  shopCompetitorMinPrice: document.getElementById('shop-competitor-min-price'),
  shopCompetitorsTbody: document.getElementById('shop-competitors-tbody'),
  shopCompetitivenessBadge: document.getElementById('shop-competitiveness-badge'),
  shopStrategyBox: document.getElementById('shop-strategy-box'),
  shopStrategyIcon: document.getElementById('shop-strategy-icon'),
  shopStrategyTitle: document.getElementById('shop-strategy-title'),
  shopStrategyDesc: document.getElementById('shop-strategy-desc'),
  shopCostInput: document.getElementById('shop-cost-input'),
  shopCpcSlider: document.getElementById('shop-cpc-slider'),
  shopCpcValue: document.getElementById('shop-cpc-value'),
  shopCvrSlider: document.getElementById('shop-cvr-slider'),
  shopCvrValue: document.getElementById('shop-cvr-value'),
  shopResMargin: document.getElementById('shop-res-margin'),
  shopResAdcost: document.getElementById('shop-res-adcost'),
  shopResNetprofit: document.getElementById('shop-res-netprofit'),
  shopResRoas: document.getElementById('shop-res-roas')
};

// -------------------------------------------------------------
// CORE SETUP & INITIALIZATION
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupEventListeners();
  showLoader('데이터 로딩 중...');
  
  // 1. Fetch Naver Ad settings and connection status
  await fetchSettings();
  
  // 2. Fetch Products
  await fetchProducts();
  
  // 3. Fetch Campaigns
  await fetchCampaigns();
  
  // 4. Render Initial Views
  renderOverviewInsights();
  renderCampaignsTable();
  renderProductsTable();
  initOverviewChart();
  
  hideLoader();
}

function setupEventListeners() {
  // Navigation Tabs Toggle
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Global Sync Event
  elements.syncNaverBtn.addEventListener('click', runGlobalSync);

  // Overview Table Refresh
  elements.overviewRefreshTableBtn.addEventListener('click', async () => {
    showLoader('캠페인 현황 동기화 중...');
    await fetchCampaigns();
    renderCampaignsTable();
    hideLoader();
  });

  // Add Product Modal Events
  elements.openAddProductModalBtn.addEventListener('click', () => {
    elements.addProductModal.style.display = 'flex';
  });
  
  const closeModal = () => { elements.addProductModal.style.display = 'none'; };
  elements.closeProductModalBtn.addEventListener('click', closeModal);
  elements.cancelProductBtn.addEventListener('click', closeModal);
  
  elements.addProductForm.addEventListener('submit', handleAddProduct);

  // Apply Bidding Strategy to Simulator
  elements.applyStrategyBidBtn.addEventListener('click', applyStrategyToSimulator);

  // Keyword Search Tool
  elements.keywordSearchBtn.addEventListener('click', handleKeywordSearch);
  elements.keywordSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleKeywordSearch();
  });

  // Simulator Sliders Event Binding
  elements.simCpcSlider.addEventListener('input', runSimulation);
  elements.simBudgetSlider.addEventListener('input', runSimulation);
  elements.simCvrSlider.addEventListener('input', runSimulation);
  elements.simMarginSlider.addEventListener('input', runSimulation);
  elements.simProductPriceInput.addEventListener('input', runSimulation);

  // Bid Manager Selections
  elements.bidCampaignSelect.addEventListener('change', handleCampaignSelection);
  elements.bidAdgroupSelect.addEventListener('change', handleAdgroupSelection);

  // Shopping Ads Optimizer Selections
  elements.shopCampaignSelect.addEventListener('change', handleShoppingCampaignSelection);
  elements.shopAdgroupSelect.addEventListener('change', handleShoppingAdgroupSelection);
  elements.shopCostInput.addEventListener('input', runShoppingSimulation);
  elements.shopCpcSlider.addEventListener('input', runShoppingSimulation);
  elements.shopCvrSlider.addEventListener('input', runShoppingSimulation);

  // Settings Save
  elements.apiSettingsForm.addEventListener('submit', handleSaveSettings);
  elements.clearSettingsBtn.addEventListener('click', handleClearSettings);
}

// -------------------------------------------------------------
// LOADING AND TAB CONTROL HELPERS
// -------------------------------------------------------------

function showLoader(message = '처리 중입니다...') {
  elements.globalSyncText.innerText = message;
  elements.globalSyncOverlay.style.display = 'flex';
}

function hideLoader() {
  elements.globalSyncOverlay.style.display = 'none';
}

function switchTab(tabId) {
  // Update nav-item active styles
  elements.navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle active tab content
  elements.tabContents.forEach(tab => {
    if (tab.id === `tab-${tabId}`) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update Header Texts
  let title = '홈 대시보드';
  let subtitle = '부럽트래블 상품 광고 집행 현황 및 마케팅 요약 보고서';

  if (tabId === 'compare') {
    title = '가격비교 & 광고 전략';
    subtitle = '네이버 쇼핑 가격비교 파싱 결과 매칭 및 상품별 최적 입찰 전략 추천';
  } else if (tabId === 'simulator') {
    title = '키워드 도구 & 적정 노출가 시뮬레이터';
    subtitle = '네이버 키워드 월간 검색량 데이터 연동 및 적정 입찰가에 따른 ROAS 시뮬레이션';
  } else if (tabId === 'bid-manager') {
    title = '광고 입찰 세부 제어';
    subtitle = '캠페인/광고그룹 목록 조회 및 키워드별 실시간 CPC 입찰가 수정';
  } else if (tabId === 'shopping-optimizer') {
    title = '쇼핑검색 광고 최적화';
    subtitle = '네이버 쇼핑검색광고 분석 및 실시간 경쟁사 가격 대비 입찰 조정 제안';
  } else if (tabId === 'settings') {
    title = '네이버 API 연동 설정';
    subtitle = '네이버 검색광고 API 자격증명 관리 및 암호화 연동 서비스 설정';
  }

  elements.mainTitle.innerText = title;
  elements.mainSubtitle.innerText = subtitle;

  // Render trigger actions for specific tabs
  if (tabId === 'bid-manager' && state.campaigns.length === 0) {
    fetchCampaigns().then(populateCampaignDropdown);
  } else if (tabId === 'shopping-optimizer') {
    if (state.campaigns.length === 0) {
      fetchCampaigns().then(populateShoppingCampaignDropdown);
    } else {
      populateShoppingCampaignDropdown();
    }
  }
}

async function runGlobalSync() {
  showLoader('네이버 검색광고 API 및 네이버 쇼핑 실시간 데이터 동기화 중...');
  
  try {
    await fetchSettings();
    await fetchProducts();
    await fetchCampaigns();
    
    renderCampaignsTable();
    renderProductsTable();
    renderOverviewInsights();
    
    if (state.selectedProduct) {
      // Re-trigger product compare refresh
      selectProductForStrategy(state.selectedProduct.id);
    }
    
    setTimeout(() => {
      hideLoader();
      alert('성공적으로 실시간 데이터가 동기화되었습니다!');
    }, 1200);
  } catch (err) {
    hideLoader();
    alert('동기화 실패: ' + err.message);
  }
}

// -------------------------------------------------------------
// DATA FETCHING FUNCTIONS (BACKEND CONNECTORS)
// -------------------------------------------------------------

async function fetchSettings() {
  try {
    // Prefill backend URL input from localStorage
    elements.settingsBackendUrl.value = localStorage.getItem('boolub_backend_url') || '';

    const res = await fetch(`${API_BASE}/api/naver-ads/settings`);
    state.settings = await res.json();
    updateConnectionStatusUI();
    
    // Prefill settings form
    elements.settingsCustomerId.value = state.settings.customerId || '';
    elements.settingsApiKey.value = state.settings.apiKey ? '••••••••••••••••••••' : '';
    elements.settingsApiSecret.value = state.settings.apiSecret ? '••••••••••••••••••••' : '';
    elements.settingsLicenseKey.value = state.settings.licenseKey ? '••••••••••••••••••••' : '';
  } catch (err) {
    console.error('Failed to fetch settings:', err);
  }
}

async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    state.products = await res.json();
  } catch (err) {
    console.error('Failed to fetch products:', err);
  }
}

async function fetchCampaigns() {
  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/campaigns`);
    state.campaigns = await res.json();
    populateCampaignDropdown();
  } catch (err) {
    console.error('Failed to fetch campaigns:', err);
  }
}

function updateConnectionStatusUI() {
  const badge = elements.apiConnectionStatus;
  const textEl = badge.querySelector('.status-text');
  
  if (state.settings.isConnected) {
    badge.classList.add('connected');
    textEl.innerText = '네이버 광고 API 연동 완료 (상태 정상)';
  } else {
    badge.classList.remove('connected');
    textEl.innerText = '네이버 광고 API 미연동 (시뮬레이션 모드)';
  }
}

// -------------------------------------------------------------
// TAB 1: OVERVIEW RENDERING
// -------------------------------------------------------------

function initOverviewChart() {
  const ctx = document.getElementById('overview-chart').getContext('2d');
  
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const spendData = [52000, 68000, 48000, 72000, 89000, 61000, 72800];
  const clicksData = [45, 58, 38, 62, 75, 49, 55];

  if (state.charts.overview) {
    state.charts.overview.destroy();
  }

  state.charts.overview = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: '일일 광고비 소진액 (원)',
          data: spendData,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          yAxisID: 'y-spend',
          tension: 0.3,
          fill: true
        },
        {
          label: '일일 클릭 수 (Clicks)',
          data: clicksData,
          borderColor: '#03C75A',
          backgroundColor: 'rgba(3, 199, 90, 0.05)',
          yAxisID: 'y-clicks',
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9ca3af', font: { family: 'Outfit' } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' }
        },
        'y-spend': {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#4f46e5',
            callback: value => '₩' + value.toLocaleString()
          }
        },
        'y-clicks': {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#03C75A' }
        }
      }
    }
  });
}

function renderOverviewInsights() {
  const container = elements.overviewInsights;
  container.innerHTML = '';

  const competitiveProducts = state.products.filter(p => isCompetitive(p) === 'BEST');
  const highPriceProducts = state.products.filter(p => isCompetitive(p) === 'HIGH');
  
  let insights = [];

  if (competitiveProducts.length > 0) {
    const p = competitiveProducts[0];
    const diffAmt = getMinPriceDiff(p);
    insights.push({
      type: 'positive',
      title: `최저가 가격 우위 상품 발견!`,
      desc: `[${p.name}] 상품은 타사 대비 평균 ₩${Math.abs(diffAmt).toLocaleString()} 저렴합니다. 네이버 광고 키워드 입찰가를 높여 노출 순위 Top 3를 선점하면 고전환율 확보가 예상됩니다.`,
      icon: '📈'
    });
  }

  if (highPriceProducts.length > 0) {
    const p = highPriceProducts[0];
    insights.push({
      type: 'warning',
      title: '가격 경쟁력 열세 경고',
      desc: `[${p.name}] 상품은 경쟁 타사 대비 가격이 비싸게 매칭되어 있습니다. 직접적인 키워드 광고 입찰가를 하향 조정하고 브랜드 검색광고 노출로 우회하여 마케팅 예산 낭비를 방지하세요.`,
      icon: '⚠️'
    });
  }

  // Base general insight
  insights.push({
    type: 'positive',
    title: '모바일 클릭 증가 추세',
    desc: '최근 7일 모바일 검색량이 12.4% 상승함에 따라 모바일 CTR이 PC보다 높습니다. 가중치 입찰가를 모바일 기기에 115%로 상향 조정하는 것을 추천합니다.',
    icon: '📱'
  });

  insights.forEach(ins => {
    const item = document.createElement('div');
    item.className = `insight-item ${ins.type}`;
    item.innerHTML = `
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-content">
        <h4>${ins.title}</h4>
        <p>${ins.desc}</p>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderCampaignsTable() {
  const tbody = elements.overviewCampaignTableBody;
  tbody.innerHTML = '';

  if (state.campaigns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">조회된 네이버 검색광고 캠페인이 없습니다.</td></tr>`;
    return;
  }

  state.campaigns.forEach(c => {
    const tr = document.createElement('tr');
    
    // Status Badge
    const statusText = c.useYn === 'Y' ? '노출 중' : '일시 중지';
    const statusClass = c.useYn === 'Y' ? 'badge-success' : 'badge-secondary';

    tr.innerHTML = `
      <td style="font-weight: 600;">${c.name}</td>
      <td>${c.campaignTp === 'SEARCH' ? '파워링크 검색광고' : c.campaignTp}</td>
      <td>₩${(c.userLimitAmt || 0).toLocaleString()} / 일</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>
        <label class="switch">
          <input type="checkbox" ${c.useYn === 'Y' ? 'checked' : ''} onchange="toggleCampaignActive('${c.nccCampaignId}', this.checked)">
          <span class="slider-switch"></span>
        </label>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Global scope toggle action
window.toggleCampaignActive = function(campaignId, active) {
  console.log(`[SIMULATION] Toggle Campaign ${campaignId} active state to: ${active}`);
  // Update state locally
  const campaign = state.campaigns.find(c => c.nccCampaignId === campaignId);
  if (campaign) {
    campaign.useYn = active ? 'Y' : 'N';
  }
};

// -------------------------------------------------------------
// TAB 2: PRICE COMPARISON & STRATEGY
// -------------------------------------------------------------

function renderProductsTable() {
  const tbody = elements.compareProductTableBody;
  tbody.innerHTML = '';

  if (state.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">등록된 여행 상품이 없습니다.</td></tr>`;
    return;
  }

  state.products.forEach(p => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.className = state.selectedProduct?.id === p.id ? 'active-row' : '';
    
    tr.addEventListener('click', (e) => {
      // Don't trigger strategy detail view if clicking on crawler buttons
      if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
        selectProductForStrategy(p.id);
      }
    });

    const compMin = getMinCompetitorPrice(p);
    const compMinText = compMin ? `₩${compMin.toLocaleString()}` : '분석 필요';
    
    // Status Badge
    const compStatus = isCompetitive(p);
    let badgeHtml = '';
    if (compStatus === 'BEST') {
      badgeHtml = `<span class="badge badge-success">최저가 우위</span>`;
    } else if (compStatus === 'HIGH') {
      badgeHtml = `<span class="badge badge-danger">타사 대비 고가</span>`;
    } else if (compStatus === 'NEUTRAL') {
      badgeHtml = `<span class="badge badge-warning">유사 가격대</span>`;
    } else {
      badgeHtml = `<span class="badge badge-secondary">미분석</span>`;
    }

    const crawlDate = p.lastCrawled ? new Date(p.lastCrawled).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }) : '미분석';

    tr.innerHTML = `
      <td style="font-weight:600; color:white;">${p.name}</td>
      <td>₩${p.price.toLocaleString()}</td>
      <td>${compMinText}</td>
      <td>${badgeHtml}</td>
      <td style="font-size:12px; color:var(--text-muted);">${crawlDate}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="runPriceMatchCrawler('${p.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px; color: var(--color-naver);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          파싱 매칭
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Price competitiveness evaluator helpers
function getMinCompetitorPrice(product) {
  if (!product.competitors || product.competitors.length === 0) return null;
  return Math.min(...product.competitors.map(c => c.price));
}

function getMinPriceDiff(product) {
  const minPrice = getMinCompetitorPrice(product);
  if (!minPrice) return 0;
  return product.price - minPrice; // negative means Boolub is cheaper
}

function isCompetitive(product) {
  if (!product.competitors || product.competitors.length === 0) return 'NONE';
  const diff = getMinPriceDiff(product);
  if (diff < -5000) return 'BEST'; // Boolub cheaper by > 5,000 won
  if (diff > 5000) return 'HIGH';  // Boolub more expensive by > 5,000 won
  return 'NEUTRAL';
}

// Global action to execute crawler match
window.runPriceMatchCrawler = async function(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  showLoader(`네이버 쇼핑에서 [${product.name}] 경쟁 업체 실시간 가격 파싱 및 파라미터 매칭 중...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/crawler/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    
    const result = await res.json();
    hideLoader();

    if (result.product) {
      // Update local state
      const index = state.products.findIndex(p => p.id === productId);
      state.products[index] = result.product;
      
      // Select product and refresh UI
      selectProductForStrategy(productId);
      renderProductsTable();
      renderOverviewInsights();
      
      alert(`경쟁사 매칭 완료! (${result.source === 'crawler' ? '실시간 크롤링 연동 성공' : '방화벽 우회 모의 데이터 반환'})`);
    } else {
      alert('매칭 파싱 과정 중 오류가 발생했습니다.');
    }
  } catch (err) {
    hideLoader();
    alert('에러 발생: ' + err.message);
  }
};

function selectProductForStrategy(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.selectedProduct = product;
  renderProductsTable(); // updates highlight

  // Display detail strategy pane
  elements.strategyDetailsCard.style.display = 'block';
  elements.strategyProductTitle.innerText = `${product.name} 가격 분포`;

  // Update Status Badge
  const compStatus = isCompetitive(product);
  const diff = getMinPriceDiff(product);
  
  if (compStatus === 'BEST') {
    elements.strategyPriceBadge.className = 'badge badge-success';
    elements.strategyPriceBadge.innerText = `가격 우위 (타사 대비 -₩${Math.abs(diff).toLocaleString()})`;
    
    elements.strategyRecommendationTitle.innerText = '공격적 입찰 권장 (Rank 1-3위 선점)';
    elements.strategyRecommendationDesc = '타사 대비 가격 메리트가 확실해 유입 시 높은 전환을 기록할 상품입니다. 광고비 입찰액을 적극 상향해 트래픽을 몰아오는 것이 정답입니다.';
    elements.strategyRecommendedCpc.innerText = '₩1,400 원';
  } else if (compStatus === 'HIGH') {
    elements.strategyPriceBadge.className = 'badge badge-danger';
    elements.strategyPriceBadge.innerText = `가격 경쟁력 약세 (타사 대비 +₩${diff.toLocaleString()})`;
    
    elements.strategyRecommendationTitle.innerText = '방어형 입찰 권장 (Rank 5-10위 또는 브랜드 광고)';
    elements.strategyRecommendationDesc = '상품 단가가 다소 비싸 일반 검색 노출 시 단순 예산 소진액만 커지고 이탈률이 증가할 수 있습니다. 핵심 키워드는 비중을 줄이고 자사 브랜드 키워드 위주로 전환 유도를 지향하세요.';
    elements.strategyRecommendedCpc.innerText = '₩450 원';
  } else if (compStatus === 'NEUTRAL') {
    elements.strategyPriceBadge.className = 'badge badge-warning';
    elements.strategyPriceBadge.innerText = `유사 가격대 매칭 (편차 ₩${Math.abs(diff).toLocaleString()})`;
    
    elements.strategyRecommendationTitle.innerText = '균형형 입찰 권장 (Rank 3-5위)';
    elements.strategyRecommendationDesc = '가격 조건이 비슷하므로 광고 상세 설명(무료 취소 보장, 단독 얼리버드 등)의 혜택 문구를 가미해 매력도를 채워 입찰하길 권합니다.';
    elements.strategyRecommendedCpc.innerText = '₩850 원';
  } else {
    elements.strategyPriceBadge.className = 'badge badge-secondary';
    elements.strategyPriceBadge.innerText = '타사 가격 미분석 상태';
    elements.strategyRecommendationTitle.innerText = '파싱 매칭 진행 필요';
    elements.strategyRecommendationDesc = '우측의 [파싱 매칭] 버튼을 누르면 실시간 네이버 쇼핑 비교 정보 분석을 통하여 광고 비즈니스 코치가 제공됩니다.';
    elements.strategyRecommendedCpc.innerText = '- 원';
  }

  // Draw Price Bar Chart
  drawCompetitorPriceChart(product);
}

function drawCompetitorPriceChart(product) {
  const ctx = document.getElementById('competitor-price-chart').getContext('2d');
  
  if (state.charts.competitor) {
    state.charts.competitor.destroy();
  }

  // Build chart labels & data
  const labels = ['부럽트래블'];
  const prices = [product.price];
  const colors = ['#00e676']; // green for Boolub

  if (product.competitors && product.competitors.length > 0) {
    product.competitors.forEach(c => {
      labels.push(c.name);
      prices.push(c.price);
      colors.push('#3b82f6'); // blue for competitors
    });
  }

  state.charts.competitor = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '상품 판매 단가 (원)',
        data: prices,
        backgroundColor: colors,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 10 } },
          grid: { display: false }
        },
        y: {
          ticks: { 
            color: '#9ca3af',
            callback: value => '₩' + (value / 1000).toLocaleString() + 'k'
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

async function handleAddProduct(e) {
  e.preventDefault();
  
  const name = document.getElementById('prod-name').value;
  const price = document.getElementById('prod-price').value;
  const marginRate = document.getElementById('prod-margin').value;
  const keywords = document.getElementById('prod-keywords').value;

  showLoader('새로운 여행 상품 등록 중...');
  
  try {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, marginRate, keywords })
    });

    if (res.ok) {
      elements.addProductModal.style.display = 'none';
      elements.addProductForm.reset();
      await fetchProducts();
      renderProductsTable();
      alert('새 상품이 정상 등록되었습니다. 실시간 타사 매칭을 바로 진행해보세요!');
    } else {
      alert('상품 등록에 실패했습니다.');
    }
  } catch (err) {
    alert('에러: ' + err.message);
  } finally {
    hideLoader();
  }
}

function applyStrategyToSimulator() {
  if (!state.selectedProduct) return;
  
  // Jump to simulator tab
  switchTab('simulator');
  
  // Pre-fill search field and simulator price
  const primaryKeyword = state.selectedProduct.keywords[0] || '';
  elements.keywordSearchInput.value = primaryKeyword;
  elements.simProductPriceInput.value = state.selectedProduct.price;
  
  // Update margin rate
  const marginPercent = Math.round(state.selectedProduct.marginRate * 100);
  elements.simMarginSlider.value = marginPercent;
  elements.simMarginValue.innerText = `${marginPercent}%`;

  // Trigger search
  handleKeywordSearch();
}

// -------------------------------------------------------------
// TAB 3: KEYWORD TOOL & SIMULATOR
// -------------------------------------------------------------

async function handleKeywordSearch() {
  const query = elements.keywordSearchInput.value.trim();
  if (!query) {
    alert('검색할 키워드를 입력해 주세요.');
    return;
  }

  showLoader('네이버 키워드 도구 API에서 실시간 검색 지표 분석 중...');
  
  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/keyword-info?keywords=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    hideLoader();

    if (data.keywordList && data.keywordList.length > 0) {
      renderKeywordResults(data.keywordList);
    } else {
      alert('조회 결과가 없습니다. 올바른 키워드 문장을 확인해주세요.');
    }
  } catch (err) {
    hideLoader();
    alert('네이버 키워드 도구 연동 에러: ' + err.message);
  }
}

function renderKeywordResults(list) {
  elements.keywordResultsContainer.style.display = 'block';
  const tbody = elements.keywordResultsTbody;
  tbody.innerHTML = '';

  list.forEach(kw => {
    const tr = document.createElement('tr');
    
    const pcVol = typeof kw.monthlyPcQcCnt === 'number' ? kw.monthlyPcQcCnt.toLocaleString() : kw.monthlyPcQcCnt;
    const mobVol = typeof kw.monthlyMobileQcCnt === 'number' ? kw.monthlyMobileQcCnt.toLocaleString() : kw.monthlyMobileQcCnt;
    
    // Competitor Index label styling
    let compClass = 'badge-secondary';
    let compText = '낮음';
    if (kw.compIdx === 'HIGH') { compClass = 'badge-danger'; compText = '높음'; }
    else if (kw.compIdx === 'MID') { compClass = 'badge-warning'; compText = '중간'; }

    const avgCpc = kw.avgCpc || 750;

    tr.innerHTML = `
      <td style="font-weight: 700; color: white;">${kw.relKeyword}</td>
      <td>${pcVol}</td>
      <td>${mobVol}</td>
      <td>${kw.monthlyPcClicks || 0}</td>
      <td>${kw.monthlyMobileClicks || 0}</td>
      <td>${kw.monthlyMobileCtr || 0}%</td>
      <td><span class="badge ${compClass}">${compText}</span></td>
      <td style="color: var(--color-naver-glow); font-weight:600;">₩${avgCpc.toLocaleString()}</td>
      <td>
        <button class="btn btn-naver btn-sm" onclick="loadKeywordToSimulator('${kw.relKeyword}', ${avgCpc}, ${kw.monthlyPcQcCnt || 5000}, ${kw.monthlyMobileQcCnt || 15000})">
          예측 분석
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Global simulator loader
window.loadKeywordToSimulator = function(keyword, avgCpc, pcVol, mobVol) {
  state.activeSimulatorKeyword = {
    keyword,
    avgCpc,
    totalSearchVolume: pcVol + mobVol
  };

  // Show simulation layout
  elements.simulatorLayoutPanel.style.display = 'grid';
  elements.simSelectedKeyword.innerText = keyword;
  
  // Set CPC slider to Naver's Average CPC
  elements.simCpcSlider.value = avgCpc;
  elements.simCpcValue.innerText = `${avgCpc.toLocaleString()} 원`;

  // Smooth scroll down to simulator
  elements.simulatorLayoutPanel.scrollIntoView({ behavior: 'smooth' });
  
  // Trigger simulation calculations
  runSimulation();
};

function runSimulation() {
  if (!state.activeSimulatorKeyword) return;

  const cpc = parseInt(elements.simCpcSlider.value, 10);
  const budget = parseInt(elements.simBudgetSlider.value, 10);
  const cvr = parseFloat(elements.simCvrSlider.value);
  const margin = parseInt(elements.simMarginSlider.value, 10) / 100;
  const prodPrice = parseInt(elements.simProductPriceInput.value, 10) || 100000;

  // Render values to text
  elements.simCpcValue.innerText = `${cpc.toLocaleString()} 원`;
  elements.simBudgetValue.innerText = `${budget.toLocaleString()} 원`;
  elements.simCvrValue.innerText = `${cvr.toFixed(1)}%`;
  elements.simMarginValue.innerText = `${Math.round(margin * 100)}%`;

  // Logic algorithms
  const avgCpc = state.activeSimulatorKeyword.avgCpc;
  const totalVolume = state.activeSimulatorKeyword.totalSearchVolume;
  
  // Rank and CTR curve calculation
  let rank = '파워링크 6위 이하 (비노출 가능성)';
  let ctrModifier = 0.2; // 20% of standard CTR clicks
  
  if (cpc >= avgCpc * 1.5) {
    rank = '파워링크 1위';
    ctrModifier = 1.6;
  } else if (cpc >= avgCpc * 1.1) {
    rank = '파워링크 2~3위';
    ctrModifier = 1.1;
  } else if (cpc >= avgCpc * 0.8) {
    rank = '파워링크 4~5위';
    ctrModifier = 0.75;
  } else if (cpc >= avgCpc * 0.5) {
    rank = '파워링크 6~10위 (하단 노출)';
    ctrModifier = 0.4;
  }

  // Calculate clicks (limit by total search volume and budget)
  // Assume a base 1.5% CTR of search volume for top rank
  const baseCTR = 0.015;
  const potentialClicks = Math.round(totalVolume * baseCTR * ctrModifier);
  const budgetClicks = Math.floor(budget / cpc);
  
  const expectedClicks = Math.min(potentialClicks, budgetClicks);
  
  // Monthly costs
  const expectedCost = expectedClicks * cpc;
  const dailyBurn = Math.round(expectedCost / 30);
  
  // Conversion & revenue
  const expectedConversions = expectedClicks * (cvr / 100);
  const expectedRevenue = Math.round(expectedConversions * prodPrice);
  
  // Profit calculations
  const expectedGrossProfit = expectedRevenue * margin;
  const expectedNetProfit = expectedGrossProfit - expectedCost;
  const roas = expectedCost > 0 ? Math.round((expectedRevenue / expectedCost) * 100) : 0;

  // Render to UI
  elements.resExpectedRank.innerText = rank;
  elements.resClicks.innerText = `${expectedClicks.toLocaleString()} Clicks`;
  elements.resBurnRate.innerText = `일평균 ₩${dailyBurn.toLocaleString()} 소진 (월 ₩${expectedCost.toLocaleString()})`;
  elements.resConversions.innerText = `${expectedConversions.toFixed(1)} 건 / ₩${expectedRevenue.toLocaleString()}`;
  elements.resNetMargin.innerText = `₩${expectedNetProfit.toLocaleString()}`;
  elements.resRoas.innerText = `${roas}%`;

  // Margin Check Warnings
  if (expectedNetProfit < 0 && expectedCost > 0) {
    elements.simFeedbackWarning.style.display = 'flex';
  } else {
    elements.simFeedbackWarning.style.display = 'none';
  }
}

// -------------------------------------------------------------
// TAB 4: AD BID MANAGER
// -------------------------------------------------------------

function populateCampaignDropdown() {
  const select = elements.bidCampaignSelect;
  select.innerHTML = '<option value="">캠페인을 선택하세요</option>';
  
  state.campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.nccCampaignId;
    opt.innerText = c.name;
    select.appendChild(opt);
  });
  
  elements.bidAdgroupSelect.disabled = true;
  elements.bidAdgroupSelect.innerHTML = '<option value="">광고 그룹을 선택하세요</option>';
  elements.bidKeywordsContainer.style.display = 'none';
  elements.bidNoDataMsg.style.display = 'block';
}

async function handleCampaignSelection() {
  const campaignId = elements.bidCampaignSelect.value;
  if (!campaignId) {
    populateCampaignDropdown();
    return;
  }

  showLoader('광고 그룹 리스트 가져오는 중...');
  
  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/adgroups?campaignId=${campaignId}`);
    state.adgroups = await res.json();
    
    hideLoader();

    const select = elements.bidAdgroupSelect;
    select.disabled = false;
    select.innerHTML = '<option value="">광고 그룹을 선택하세요</option>';
    
    state.adgroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.nccAdgroupId;
      opt.innerText = g.name;
      select.appendChild(opt);
    });

    elements.bidKeywordsContainer.style.display = 'none';
    elements.bidNoDataMsg.style.display = 'block';
    elements.bidNoDataMsg.innerText = '광고 그룹을 마저 선택하시면 키워드 입찰 목록이 조회됩니다.';

  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

async function handleAdgroupSelection() {
  const adgroupId = elements.bidAdgroupSelect.value;
  if (!adgroupId) {
    elements.bidKeywordsContainer.style.display = 'none';
    elements.bidNoDataMsg.style.display = 'block';
    return;
  }

  showLoader('키워드 입찰 목록을 연동하는 중...');
  
  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/keywords?adgroupId=${adgroupId}`);
    state.keywords = await res.json();
    
    hideLoader();

    if (state.keywords.length > 0) {
      elements.bidNoDataMsg.style.display = 'none';
      elements.bidKeywordsContainer.style.display = 'block';
      renderKeywordsBidTable();
    } else {
      elements.bidKeywordsContainer.style.display = 'none';
      elements.bidNoDataMsg.style.display = 'block';
      elements.bidNoDataMsg.innerText = '이 광고 그룹에는 등록된 키워드가 없습니다.';
    }

  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

function renderKeywordsBidTable() {
  const tbody = elements.bidKeywordsTbody;
  tbody.innerHTML = '';

  state.keywords.forEach(kw => {
    const tr = document.createElement('tr');
    tr.id = `kwd-row-${kw.nccKeywordId}`;

    const bidVal = kw.bidAmt || 800;

    tr.innerHTML = `
      <td style="font-weight: 700; color: white;">${kw.keyword}</td>
      <td style="color: var(--color-secondary); font-weight: 600;">₩${bidVal.toLocaleString()}</td>
      <td><span class="badge ${kw.useYn === 'Y' ? 'badge-success' : 'badge-secondary'}">${kw.status === 'ELIGIBLE' ? '노출 가능' : kw.status}</span></td>
      <td>
        <input type="number" class="input-control" value="${bidVal}" step="50" style="width: 100px; text-align: right;" id="bid-input-${kw.nccKeywordId}">
      </td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-secondary btn-sm" style="padding: 4px 8px;" onclick="adjustLocalBidInput('${kw.nccKeywordId}', -50)">-50</button>
          <button class="btn btn-secondary btn-sm" style="padding: 4px 8px;" onclick="adjustLocalBidInput('${kw.nccKeywordId}', 50)">+50</button>
        </div>
      </td>
      <td>
        <button class="btn btn-naver btn-sm" onclick="saveKeywordBid('${kw.nccKeywordId}')">
          네이버 전송
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.adjustLocalBidInput = function(keywordId, amount) {
  const input = document.getElementById(`bid-input-${keywordId}`);
  if (input) {
    let val = parseInt(input.value, 10) || 150;
    val = Math.max(150, val + amount); // Naver min bid is 150 won
    input.value = val;
  }
};

window.saveKeywordBid = async function(keywordId) {
  const input = document.getElementById(`bid-input-${keywordId}`);
  if (!input) return;

  const bidAmt = parseInt(input.value, 10);
  
  showLoader('네이버 검색광고 API 전송 및 서명 인증 진행 중...');
  
  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/adjust-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywordId, bidAmt })
    });
    
    const result = await res.json();
    hideLoader();

    if (result.result || result.nccKeywordId) {
      // Success. Update local state
      const kw = state.keywords.find(k => k.nccKeywordId === keywordId);
      if (kw) kw.bidAmt = bidAmt;
      
      renderKeywordsBidTable();
      alert('성공적으로 네이버 광고 서버에 입찰가 적용이 동기화되었습니다!');
    } else {
      alert('입찰가 변경 전송 중 실패가 발생하였습니다.');
    }
  } catch (err) {
    hideLoader();
    alert('연동 실패: ' + err.message);
  }
};

// -------------------------------------------------------------
// TAB 5: API SETTINGS HANDLERS
// -------------------------------------------------------------

async function handleSaveSettings(e) {
  e.preventDefault();

  let backendUrl = elements.settingsBackendUrl.value.trim();
  const customerId = elements.settingsCustomerId.value.trim();
  const apiKey = elements.settingsApiKey.value.trim();
  const apiSecret = elements.settingsApiSecret.value.trim();
  const licenseKey = elements.settingsLicenseKey.value.trim();

  // Save backend URL to localStorage
  if (backendUrl) {
    // Sanitize trailing slash
    if (backendUrl.endsWith('/')) {
      backendUrl = backendUrl.slice(0, -1);
    }
    // Sanitize protocol
    if (!/^https?:\/\//i.test(backendUrl)) {
      backendUrl = 'https://' + backendUrl;
    }
    localStorage.setItem('boolub_backend_url', backendUrl);
    API_BASE = backendUrl;
  } else {
    localStorage.removeItem('boolub_backend_url');
    API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : window.location.origin;
  }

  // If password input holds placeholder bullets, retain original values
  const payload = { customerId };
  if (apiKey && apiKey !== '••••••••••••••••••••') payload.apiKey = apiKey;
  if (apiSecret && apiSecret !== '••••••••••••••••••••') payload.apiSecret = apiSecret;
  if (licenseKey && licenseKey !== '••••••••••••••••••••') payload.licenseKey = licenseKey;

  showLoader('네이버 API 자격증명 저장 및 HMAC 접속 연동 중...');

  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} - ${errText || '서버 오류가 발생했습니다.'}`);
    }

    const data = await res.json();
    hideLoader();

    if (data.settings) {
      state.settings = data.settings;
      updateConnectionStatusUI();
      
      // Re-trigger campaigns load
      await fetchCampaigns();
      renderCampaignsTable();
      
      alert('네이버 검색광고 API 자격증명 및 백엔드 설정이 정상적으로 저장되었습니다!');
    }
  } catch (err) {
    hideLoader();
    alert('API 연동 실패: ' + err.message);
  }
}

async function handleClearSettings() {
  if (!confirm('정말로 모든 설정을 초기화하고 API 연동을 해제하시겠습니까?')) return;

  showLoader('초기화 및 연동 해제 진행 중...');

  // Reset backend URL in local storage
  localStorage.removeItem('boolub_backend_url');
  elements.settingsBackendUrl.value = '';
  API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: '',
        apiKey: '',
        apiSecret: '',
        licenseKey: ''
      })
    });

    const data = await res.json();
    hideLoader();

    if (data.settings) {
      state.settings = data.settings;
      updateConnectionStatusUI();
      
      // Clear forms
      elements.settingsCustomerId.value = '';
      elements.settingsApiKey.value = '';
      elements.settingsApiSecret.value = '';
      elements.settingsLicenseKey.value = '';
      
      // Reload campaigns
      await fetchCampaigns();
      renderCampaignsTable();
      
      alert('모든 설정이 초기화되었습니다. 모의 테스트 모드로 자동 전환합니다.');
    }
  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

// -------------------------------------------------------------
// TAB 4-2: SHOPPING ADS OPTIMIZER LOGIC
// -------------------------------------------------------------

function populateShoppingCampaignDropdown() {
  const select = elements.shopCampaignSelect;
  select.innerHTML = '<option value="">쇼핑 캠페인을 선택하세요</option>';
  
  const shoppingCampaigns = state.campaigns.filter(c => c.campaignTp === 'SHOPPING');
  
  shoppingCampaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.nccCampaignId;
    opt.innerText = c.name;
    select.appendChild(opt);
  });
  
  elements.shopAdgroupSelect.disabled = true;
  elements.shopAdgroupSelect.innerHTML = '<option value="">광고 그룹을 선택하세요</option>';
  elements.shopOptimizerPanels.style.display = 'none';
  elements.shopNoDataMsg.style.display = 'block';
  elements.shopNoDataMsg.innerText = '쇼핑 캠페인과 상품(광고 그룹)을 선택하면 실시간 가격 추적 및 최적화 진단이 시작됩니다.';
}

async function handleShoppingCampaignSelection() {
  const campaignId = elements.shopCampaignSelect.value;
  if (!campaignId) {
    populateShoppingCampaignDropdown();
    return;
  }

  showLoader('광고 그룹 리스트 가져오는 중...');
  
  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/adgroups?campaignId=${campaignId}`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} - ${errText}`);
    }
    state.shopAdgroups = await res.json();
    
    hideLoader();

    const select = elements.shopAdgroupSelect;
    select.disabled = false;
    select.innerHTML = '<option value="">광고 그룹을 선택하세요</option>';
    
    state.shopAdgroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.nccAdgroupId;
      opt.innerText = g.name;
      select.appendChild(opt);
    });

    elements.shopOptimizerPanels.style.display = 'none';
    elements.shopNoDataMsg.style.display = 'block';
    elements.shopNoDataMsg.innerText = '광고 그룹(상품)을 마저 선택하시면 실시간 경쟁사 비교가 시작됩니다.';

  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

function extractProductKeyword(name) {
  let kw = name.replace(/^[A-Z0-9.\-\s]+/i, ''); // Remove leading labels like B01.
  kw = kw.replace(/\(.*?\)/g, ''); // Remove parentheses
  kw = kw.replace(/\[.*?\]/g, ''); // Remove brackets
  kw = kw.replace(/\s*(그룹|패키지|상품|검색|쇼핑)\s*/g, ''); // Remove generic terms
  kw = kw.trim();
  return kw || name;
}

async function handleShoppingAdgroupSelection() {
  const adgroupId = elements.shopAdgroupSelect.value;
  if (!adgroupId) {
    elements.shopOptimizerPanels.style.display = 'none';
    elements.shopNoDataMsg.style.display = 'block';
    return;
  }

  const adgroup = state.shopAdgroups.find(g => g.nccAdgroupId === adgroupId);
  if (!adgroup) return;

  const keyword = extractProductKeyword(adgroup.name);
  
  // Cross-reference price from products database, default fallback to 350,000 KRW
  const matchedProduct = state.products.find(p => 
    p.name.includes(keyword) || keyword.includes(p.name) ||
    p.keywords.some(k => k.includes(keyword) || keyword.includes(k))
  );
  
  const price = matchedProduct ? matchedProduct.price : (adgroup.bidAmt ? adgroup.bidAmt * 100 : 350000);

  showLoader(`네이버 쇼핑에서 [${keyword}] 경쟁 업체 실시간 가격 파싱 및 가격비교 분석 중...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/crawler/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: adgroupId, keyword })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} - ${errText}`);
    }

    const result = await res.json();
    hideLoader();

    if (result.product) {
      const parsedProduct = result.product;
      parsedProduct.price = price;
      state.selectedShopProduct = parsedProduct;
      
      elements.shopNoDataMsg.style.display = 'none';
      elements.shopOptimizerPanels.style.display = 'grid';

      elements.shopOurPrice.innerText = `₩${price.toLocaleString()}`;
      
      const minCompetitorPrice = parsedProduct.competitors && parsedProduct.competitors.length > 0 
        ? Math.min(...parsedProduct.competitors.map(c => c.price))
        : price;
      
      elements.shopCompetitorMinPrice.innerText = `₩${minCompetitorPrice.toLocaleString()}`;

      renderShopCompetitorsTable(parsedProduct.competitors);
      drawShoppingPriceChart(price, parsedProduct.competitors || []);
      evaluatePriceCompetitiveness(price, minCompetitorPrice);

      // Default cost to 70% of sale price
      elements.shopCostInput.value = Math.round(price * 0.7);
      
      // Initialize sliders to default values
      elements.shopCpcSlider.value = adgroup.bidAmt || 800;
      elements.shopCvrSlider.value = 2.5;

      runShoppingSimulation();
    }
  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

function renderShopCompetitorsTable(competitors) {
  const tbody = elements.shopCompetitorsTbody;
  tbody.innerHTML = '';

  if (!competitors || competitors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">매칭된 경쟁사 정보가 없습니다.</td></tr>';
    return;
  }

  competitors.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: white;">${c.name}</td>
      <td style="font-size: 13px; color: var(--text-muted);">${c.productName}</td>
      <td style="color: var(--color-secondary); font-weight: 600;">₩${c.price.toLocaleString()}</td>
      <td>
        <a href="${c.url}" target="_blank" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11px;">
          이동
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function evaluatePriceCompetitiveness(ourPrice, minCompetitorPrice) {
  const badge = elements.shopCompetitivenessBadge;
  const box = elements.shopStrategyBox;
  const icon = elements.shopStrategyIcon;
  const title = elements.shopStrategyTitle;
  const desc = elements.shopStrategyDesc;

  badge.className = 'badge';
  box.className = 'insight-item';

  const diff = ourPrice - minCompetitorPrice;

  if (diff < -10000) {
    badge.innerText = '가격 우위 (최상)';
    badge.classList.add('badge-success');
    box.classList.add('positive');
    icon.innerText = '📈';
    title.innerText = '적극적 입찰가 인상 전략 추천';
    desc.innerText = `현재 자사 상품이 경쟁사 최저가보다 ₩${Math.abs(diff).toLocaleString()} 더 저렴합니다. 구매 전환율이 매우 높을 시점이므로, 트래픽을 최대한 쓸어 담을 수 있도록 쇼핑 CPC 입찰가를 적극 인상(+50원~150원)하여 첫 페이지 상위 노출을 확보하세요!`;
  } else if (diff > 10000) {
    badge.innerText = '가격 열위 (위험)';
    badge.classList.add('badge-danger');
    box.classList.add('warning');
    icon.innerText = '⚠️';
    title.innerText = '입찰가 보수적 하향 전략 추천';
    desc.innerText = `현재 자사 상품이 경쟁사 최저가보다 ₩${diff.toLocaleString()} 더 비쌉니다. 가격 차이로 인해 광고를 보고 들어온 고객들의 이탈률이 높을 수 있습니다. 무리한 예산 낭비를 방지하기 위해 입찰가를 하향 조정(-50원~100원)하여 노출순위를 내리거나 상품 할인을 우선 검토해 보세요.`;
  } else {
    badge.innerText = '가격 경합 (보통)';
    badge.classList.add('badge-warning');
    box.classList.add('info');
    icon.innerText = '⚖️';
    title.innerText = '현재 입찰가 유지 및 혜택 부각 추천';
    desc.innerText = `경쟁사 최저가와 가격 차이가 ₩${Math.abs(diff).toLocaleString()} 이내로 거의 비슷합니다. 노출도를 유지하기 위해 기존 입찰가를 고수하되, 무료배송, 특별 사은품 등의 쇼핑 부가 혜택 문구를 노출하여 가격 외 경쟁력을 더 강조하세요.`;
  }
}

function runShoppingSimulation() {
  if (!state.selectedShopProduct) return;

  const cost = parseInt(elements.shopCostInput.value, 10) || 0;
  const cpc = parseInt(elements.shopCpcSlider.value, 10) || 150;
  const cvr = parseFloat(elements.shopCvrSlider.value) || 1.0;
  
  elements.shopCpcValue.innerText = `${cpc.toLocaleString()} 원`;
  elements.shopCvrValue.innerText = `${cvr.toFixed(1)}%`;

  const ourPrice = state.selectedShopProduct.price;
  const margin = Math.max(0, ourPrice - cost);
  const cpa = Math.round((cpc * 100) / cvr);
  const netProfit = margin - cpa;
  const roas = cpa > 0 ? Math.round((ourPrice / cpa) * 100) : 0;

  elements.shopResMargin.innerText = `₩${margin.toLocaleString()}`;
  elements.shopResAdcost.innerText = `₩${cpa.toLocaleString()} (유치 단가)`;
  elements.shopResNetprofit.innerText = `₩${netProfit.toLocaleString()}`;
  elements.shopResRoas.innerText = `${roas}%`;

  if (netProfit < 0) {
    elements.shopResNetprofit.style.color = '#ff3d71';
  } else {
    elements.shopResNetprofit.style.color = '#00e676';
  }
}

function drawShoppingPriceChart(ourPrice, competitors) {
  const ctx = document.getElementById('shop-price-chart').getContext('2d');
  
  if (state.charts.shopping) {
    state.charts.shopping.destroy();
  }

  const labels = ['부럽트래블 (자사)'];
  const prices = [ourPrice];
  const colors = ['#00e676'];

  competitors.forEach(c => {
    labels.push(c.name);
    prices.push(c.price);
    colors.push('#3b82f6');
  });

  state.charts.shopping = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: prices,
        backgroundColor: colors,
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `가격: ₩${context.raw.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            callback: value => `₩${(value / 1000).toLocaleString()}k`
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.6)' }
        }
      }
    }
  });
}

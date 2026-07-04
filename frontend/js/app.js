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
  competitiveData: [],
  charts: {
    overview: null,
    competitor: null,
    competitive: null
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
  settingsOpenClientId: document.getElementById('settings-open-client-id'),
  settingsOpenClientSecret: document.getElementById('settings-open-client-secret'),
  clearSettingsBtn: document.getElementById('clear-settings-btn'),

  // Tab 4-2: Shopping Optimizer
  shopCampaignSelect: document.getElementById('shop-campaign-select'),
  shopAdgroupSelect: document.getElementById('shop-adgroup-select'),
  shopAdSelect: document.getElementById('shop-ad-select'),
  shopOptimizerPanels: document.getElementById('shop-optimizer-panels'),
  shopApiStatusBadge: document.getElementById('shop-api-status-badge'),
  shopApiWarningBanner: document.getElementById('shop-api-warning-banner'),
  goToSettingsLink: document.getElementById('go-to-settings-link'),
  shopNoDataMsg: document.getElementById('shop-no-data-msg'),
  shopOurPrice: document.getElementById('shop-our-price'),
  shopCurrentRank: document.getElementById('shop-current-rank'),
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
  shopResRoas: document.getElementById('shop-res-roas'),
  shopSyncBidBtn: document.getElementById('shop-sync-bid-btn'),

  // Tab 6: Competitive Analysis
  compScanAllBtn: document.getElementById('comp-scan-all-btn'),
  compLastScanTime: document.getElementById('comp-last-scan-time'),
  compNextScanTime: document.getElementById('comp-next-scan-time'),
  compAutoScanBadge: document.getElementById('comp-auto-scan-badge'),
  compExportCsvBtn: document.getElementById('comp-export-csv-btn'),
  compScanProgressWrapper: document.getElementById('comp-scan-progress-wrapper'),
  compScanProgressFill: document.getElementById('comp-scan-progress-fill'),
  compScanProgressText: document.getElementById('comp-scan-progress-text'),
  compAlertBanner: document.getElementById('comp-alert-banner'),
  compAlertText: document.getElementById('comp-alert-text'),
  compKpiTotal: document.getElementById('comp-kpi-total'),
  compKpiLowest: document.getElementById('comp-kpi-lowest'),
  compKpiAvgRatio: document.getElementById('comp-kpi-avg-ratio'),
  compKpiAdvantage: document.getElementById('comp-kpi-advantage'),
  compKpiDisadvantage: document.getElementById('comp-kpi-disadvantage'),
  compStatusFilter: document.getElementById('comp-status-filter'),
  compSortSelect: document.getElementById('comp-sort-select'),
  compTableTbody: document.getElementById('comp-table-tbody'),
  compStrategySummary: document.getElementById('comp-strategy-summary'),
  compChartLegend: document.getElementById('comp-chart-legend')
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

  // 5. Initialize Competitive Auto-Scan System
  initCompetitiveAutoScan();
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
  elements.shopAdSelect.addEventListener('change', handleShoppingAdSelection);
  elements.shopCostInput.addEventListener('input', runShoppingSimulation);
  elements.shopCpcSlider.addEventListener('input', runShoppingSimulation);
  elements.shopCvrSlider.addEventListener('input', runShoppingSimulation);
  elements.shopSyncBidBtn.addEventListener('click', handleShoppingSyncBid);
  
  if (elements.goToSettingsLink) {
    elements.goToSettingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      const settingsTab = document.querySelector('[data-tab="settings"]');
      if (settingsTab) settingsTab.click();
    });
  }
  // Competitive Analysis Tab
  elements.compScanAllBtn.addEventListener('click', runCompetitiveScan);
  elements.compStatusFilter.addEventListener('change', renderCompetitiveTable);
  elements.compSortSelect.addEventListener('change', renderCompetitiveTable);
  elements.compExportCsvBtn.addEventListener('click', exportCompetitiveCSV);

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
  } else if (tabId === 'competitive') {
    title = '🏆 경쟁력 분석';
    subtitle = '전 상품의 가격 경쟁 포지션 종합 조회 및 마케팅 전략 자동 추천';
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
  } else if (tabId === 'competitive') {
    // If data already scanned, render it
    if (state.competitiveData.length > 0) {
      renderCompetitiveTable();
      renderCompetitiveKPIs();
      drawCompetitiveChart();
    }
    // Ensure campaigns are loaded for scan
    if (state.campaigns.length === 0) {
      fetchCampaigns();
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

    // Load settings from local storage first (local persistence helper)
    const localSettings = {
      customerId: localStorage.getItem('boolub_customer_id') || '',
      apiKey: localStorage.getItem('boolub_api_key') || '',
      apiSecret: localStorage.getItem('boolub_api_secret') || '',
      licenseKey: localStorage.getItem('boolub_license_key') || '',
      naverOpenClientId: localStorage.getItem('boolub_open_client_id') || '',
      naverOpenClientSecret: localStorage.getItem('boolub_open_client_secret') || ''
    };

    const res = await fetch(`${API_BASE}/api/naver-ads/settings`);
    state.settings = await res.json();

    // If live server settings got wiped out due to memory recycle, restore from local storage
    if (!state.settings.customerId && localSettings.customerId) {
      state.settings = { 
        ...state.settings, 
        ...localSettings, 
        isConnected: !!(localSettings.customerId && localSettings.apiKey && localSettings.apiSecret) 
      };
      
      // Auto-sync back to server in background
      fetch(`${API_BASE}/api/naver-ads/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSettings)
      }).catch(e => console.warn('Background settings sync failed:', e));
    } else {
      // Sync server settings to local storage
      if (state.settings.customerId) localStorage.setItem('boolub_customer_id', state.settings.customerId);
      if (state.settings.apiKey) localStorage.setItem('boolub_api_key', state.settings.apiKey);
      if (state.settings.apiSecret) localStorage.setItem('boolub_api_secret', state.settings.apiSecret);
      if (state.settings.licenseKey) localStorage.setItem('boolub_license_key', state.settings.licenseKey);
      if (state.settings.naverOpenClientId) localStorage.setItem('boolub_open_client_id', state.settings.naverOpenClientId);
      if (state.settings.naverOpenClientSecret) localStorage.setItem('boolub_open_client_secret', state.settings.naverOpenClientSecret);
    }

    updateConnectionStatusUI();
    
    // Prefill settings form
    elements.settingsCustomerId.value = state.settings.customerId || '';
    elements.settingsApiKey.value = state.settings.apiKey ? '••••••••••••••••••••' : '';
    elements.settingsApiSecret.value = state.settings.apiSecret ? '••••••••••••••••••••' : '';
    elements.settingsLicenseKey.value = state.settings.licenseKey ? '••••••••••••••••••••' : '';
    elements.settingsOpenClientId.value = state.settings.naverOpenClientId ? '••••••••••••••••••••' : '';
    elements.settingsOpenClientSecret.value = state.settings.naverOpenClientSecret ? '••••••••••••••••••••' : '';
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
  const naverOpenClientId = elements.settingsOpenClientId.value.trim();
  const naverOpenClientSecret = elements.settingsOpenClientSecret.value.trim();

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
  if (naverOpenClientId && naverOpenClientId !== '••••••••••••••••••••') payload.naverOpenClientId = naverOpenClientId;
  if (naverOpenClientSecret && naverOpenClientSecret !== '••••••••••••••••••••') payload.naverOpenClientSecret = naverOpenClientSecret;

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
      
      // Save settings to local storage to persist locally
      localStorage.setItem('boolub_customer_id', customerId);
      if (apiKey && apiKey !== '••••••••••••••••••••') localStorage.setItem('boolub_api_key', apiKey);
      if (apiSecret && apiSecret !== '••••••••••••••••••••') localStorage.setItem('boolub_api_secret', apiSecret);
      if (licenseKey && licenseKey !== '••••••••••••••••••••') localStorage.setItem('boolub_license_key', licenseKey);
      if (naverOpenClientId && naverOpenClientId !== '••••••••••••••••••••') localStorage.setItem('boolub_open_client_id', naverOpenClientId);
      if (naverOpenClientSecret && naverOpenClientSecret !== '••••••••••••••••••••') localStorage.setItem('boolub_open_client_secret', naverOpenClientSecret);
      
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

  // Reset local storage keys
  localStorage.removeItem('boolub_backend_url');
  localStorage.removeItem('boolub_customer_id');
  localStorage.removeItem('boolub_api_key');
  localStorage.removeItem('boolub_api_secret');
  localStorage.removeItem('boolub_license_key');
  localStorage.removeItem('boolub_open_client_id');
  localStorage.removeItem('boolub_open_client_secret');
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
        licenseKey: '',
        naverOpenClientId: '',
        naverOpenClientSecret: ''
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
      elements.settingsOpenClientId.value = '';
      elements.settingsOpenClientSecret.value = '';
      
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
  elements.shopAdSelect.disabled = true;
  elements.shopAdSelect.innerHTML = '<option value="">광고 소재를 선택하세요</option>';
  elements.shopOptimizerPanels.style.display = 'none';
  elements.shopNoDataMsg.style.display = 'block';
  elements.shopNoDataMsg.innerText = '쇼핑 캠페인, 광고 그룹, 그리고 개별 광고 소재(소재/상품)를 선택하면 실시간 가격 추적 및 최적화 진단이 시작됩니다.';
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

    elements.shopAdSelect.disabled = true;
    elements.shopAdSelect.innerHTML = '<option value="">광고 소재를 선택하세요</option>';
    elements.shopOptimizerPanels.style.display = 'none';
    elements.shopNoDataMsg.style.display = 'block';
    elements.shopNoDataMsg.innerText = '광고 그룹을 마저 선택하시면 해당 그룹 내 등록된 상품 소재들을 불러옵니다.';

  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

function extractProductKeyword(name) {
  return name ? name.trim() : '';
}

async function handleShoppingAdgroupSelection() {
  const adgroupId = elements.shopAdgroupSelect.value;
  if (!adgroupId) {
    elements.shopAdSelect.disabled = true;
    elements.shopAdSelect.innerHTML = '<option value="">광고 소재를 선택하세요</option>';
    elements.shopOptimizerPanels.style.display = 'none';
    elements.shopNoDataMsg.style.display = 'block';
    return;
  }

  showLoader('광고 소재(소재/상품) 리스트 가져오는 중...');
  
  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/ads?adgroupId=${adgroupId}`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} - ${errText}`);
    }
    state.shopAds = await res.json();
    
    hideLoader();

    const select = elements.shopAdSelect;
    select.disabled = false;
    select.innerHTML = '<option value="">광고 소재를 선택하세요</option>';
    
    if (state.shopAds.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = '등록된 광고 소재가 없습니다.';
      select.appendChild(opt);
      select.disabled = true;
    } else {
      state.shopAds.forEach(ad => {
        const opt = document.createElement('option');
        opt.value = ad.nccAdId;
        const displayName = ad.referenceData?.productName || 
                            ad.referenceData?.productTitle || 
                            ad.name || 
                            ad.ad?.productName || 
                            ad.adattr?.productName || 
                            '이름 없음';
        opt.innerText = displayName;
        select.appendChild(opt);
      });
    }

    elements.shopOptimizerPanels.style.display = 'none';
    elements.shopNoDataMsg.style.display = 'block';
    elements.shopNoDataMsg.innerText = '3단계 광고 소재(상품)를 선택하시면 실시간 경쟁사 가격 파싱이 실행됩니다.';

  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

async function handleShoppingAdSelection() {
  const adId = elements.shopAdSelect.value;
  if (!adId) {
    elements.shopOptimizerPanels.style.display = 'none';
    elements.shopNoDataMsg.style.display = 'block';
    elements.shopNoDataMsg.innerText = '3단계 광고 소재(상품)를 선택하시면 실시간 경쟁사 가격 파싱이 실행됩니다.';
    return;
  }

  const ad = state.shopAds.find(a => a.nccAdId === adId);
  if (!ad) return;

  const adName = ad.referenceData?.productName || 
                 ad.referenceData?.productTitle || 
                 ad.name || 
                 ad.ad?.productName || 
                 ad.adattr?.productName || 
                 ad.adMsg1 || 
                 ad.adMsg2 || 
                 '';
  let keyword = extractProductKeyword(adName);
  
  const adgroupId = elements.shopAdgroupSelect.value;
  const adgroup = state.shopAdgroups.find(g => g.nccAdgroupId === adgroupId);
  const bidAmt = adgroup ? adgroup.bidAmt : 800;

  if (!keyword && adgroup) {
    keyword = extractProductKeyword(adgroup.name);
  }

  if (!keyword) {
    alert('소재명 및 광고그룹명에서 크롤링할 키워드를 추출할 수 없습니다.');
    return;
  }

  // Pull price directly from Naver API product referenceData!
  let price = 350000;
  if (ad.referenceData?.lowPrice) {
    price = parseInt(ad.referenceData.lowPrice, 10);
  } else {
    // Cross-reference from database.json if not present in referenceData
    const matchedProduct = state.products.find(p => 
      p.name.includes(keyword) || keyword.includes(p.name) ||
      p.keywords.some(k => k.includes(keyword) || keyword.includes(k))
    );
    if (matchedProduct) {
      price = matchedProduct.price;
    }
  }

  showLoader(`네이버 쇼핑에서 [${keyword}] 경쟁 업체 실시간 가격 파싱 및 순위 분석 중...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/crawler/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: adId, keyword, price, catalogId: ad.referenceKey })
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
      
      // Build a robust competitors list that always includes our own store for realistic side-by-side comparison
      const competitors = [...(result.product.competitors || [])];
      
      // Competitor redirect URLs always map to exact search query results of the display product name
      competitors.forEach(c => {
        const isOwn = c.name.includes('부럽') || c.name.includes('자사') || c.name.toLowerCase().includes('boolub');
        if (!isOwn) {
          c.url = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`;
        }
      });

      let ownMallIndex = competitors.findIndex(c => c.name.includes('부럽') || c.name.toLowerCase().includes('boolub'));
      
      if (ownMallIndex === -1) {
        competitors.push({
          name: '부럽트래블 (자사)',
          productName: adName,
          price: price,
          url: ad.referenceData?.mallProductUrl || '#'
        });
        competitors.sort((a, b) => a.price - b.price);
        ownMallIndex = competitors.findIndex(c => c.name.includes('부럽') || c.name.toLowerCase().includes('boolub'));
      }
      
      parsedProduct.competitors = competitors;
      state.selectedShopProduct = parsedProduct;
      
      // Update real API vs mock warning visibility
      const isRealData = result.source === 'naver_open_api';
      if (isRealData) {
        elements.shopApiStatusBadge.className = 'badge badge-success';
        elements.shopApiStatusBadge.innerText = '실시간 API 연동됨';
        elements.shopApiWarningBanner.style.display = 'none';
      } else {
        elements.shopApiStatusBadge.className = 'badge badge-warning';
        elements.shopApiStatusBadge.innerText = '시뮬레이션 모드';
        elements.shopApiWarningBanner.style.display = 'flex';
      }

      elements.shopNoDataMsg.style.display = 'none';
      elements.shopOptimizerPanels.style.display = 'grid';

      elements.shopOurPrice.innerText = `₩${price.toLocaleString()}`;
      
      // Min competitor price excluding our own store to find the market minimum
      const otherCompetitors = competitors.filter(c => !(c.name.includes('부럽') || c.name.includes('자사') || c.name.toLowerCase().includes('boolub')));
      const minCompetitorPrice = otherCompetitors.length > 0 
        ? Math.min(...otherCompetitors.map(c => c.price))
        : null;
      
      if (minCompetitorPrice !== null) {
        elements.shopCompetitorMinPrice.innerText = `₩${minCompetitorPrice.toLocaleString()}`;
      } else {
        elements.shopCompetitorMinPrice.innerText = '경쟁사 없음';
      }

      // Calculate Live Search Rank based on sorted list index
      let searchRankText = '분석 불가';
      if (ownMallIndex !== -1) {
        const pageNum = Math.floor(ownMallIndex / 5) + 1; // 5 listings per page simulation
        const pageRank = (ownMallIndex % 5) + 1;
        searchRankText = `${pageNum}페이지 ${pageRank}위 (${ownMallIndex + 1}위)`;
      }
      
      elements.shopCurrentRank.innerText = searchRankText;

      renderShopCompetitorsTable(competitors);
      drawShoppingPriceChart(price, competitors);
      evaluatePriceCompetitiveness(price, minCompetitorPrice);

      // Default cost to 70% of sale price
      elements.shopCostInput.value = Math.round(price * 0.7);
      
      // Initialize sliders to default values
      elements.shopCpcSlider.value = bidAmt || 800;
      elements.shopCvrSlider.value = 2.5;

      runShoppingSimulation();
    }
  } catch (err) {
    hideLoader();
    alert('에러: ' + err.message);
  }
}

async function handleShoppingSyncBid() {
  if (!state.selectedShopProduct) return;

  const targetCpc = parseInt(elements.shopCpcSlider.value, 10);
  const adgroupId = elements.shopAdgroupSelect.value;
  
  if (!adgroupId) return;

  showLoader(`네이버 광고 서버에 광고그룹 입찰가(CPC: ₩${targetCpc.toLocaleString()}) 동기화 중...`);

  try {
    const res = await fetch(`${API_BASE}/api/naver-ads/adjust-adgroup-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adgroupId, bidAmt: targetCpc })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} - ${errText}`);
    }

    const result = await res.json();
    hideLoader();

    alert(`네이버 광고그룹 입찰 정보가 성공적으로 반영되었습니다!\n• 설정 입찰가: ₩${targetCpc.toLocaleString()}\n• 처리 결과: SUCCESS`);
    
    // Dynamically update the adgroup's bidAmt in state
    const grp = state.shopAdgroups.find(g => g.nccAdgroupId === adgroupId);
    if (grp) {
      grp.bidAmt = targetCpc;
    }
  } catch (err) {
    hideLoader();
    alert('입찰가 동기화 실패: ' + err.message);
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
    const isOwn = c.name.includes('부럽') || c.name.includes('자사') || c.name.toLowerCase().includes('boolub');
    
    if (isOwn) {
      tr.style.backgroundColor = 'rgba(255, 107, 107, 0.15)';
      tr.style.border = '1px solid var(--color-primary)';
    }

    tr.innerHTML = `
      <td style="font-weight: 700; color: ${isOwn ? 'var(--color-primary)' : 'white'};">
        ${isOwn ? '⭐ ' : ''}${c.name}
      </td>
      <td style="font-size: 13px; color: ${isOwn ? 'white' : 'var(--text-muted)'};">${c.productName}</td>
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

  if (minCompetitorPrice === null) {
    badge.innerText = '독점 노출 (우수)';
    badge.classList.add('badge-success');
    box.classList.add('positive');
    icon.innerText = '💎';
    title.innerText = '독점 키워드 확보 및 입찰 효율 유지 추천';
    desc.innerText = `현재 네이버 쇼핑에서 이 키워드로 광고/판매 중인 타사 경쟁사 상품이 확인되지 않습니다. 단독 노출 상태이므로 무리하게 입찰가를 올리거나 판매가를 인하할 필요가 전혀 없으며, 현재 마진과 입찰 단가를 고수하며 최대 수익을 확보해 가세요.`;
    return;
  }

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
    const isOwn = c.name.includes('부럽') || c.name.includes('자사') || c.name.toLowerCase().includes('boolub');
    if (!isOwn) {
      labels.push(c.name);
      prices.push(c.price);
      colors.push('#3b82f6');
    }
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

// -------------------------------------------------------------
// TAB 6: COMPETITIVE ANALYSIS (Auto-Scan + Price Change + CSV)
// -------------------------------------------------------------

const COMP_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const COMP_CACHE_KEY = 'boolub_competitive_data';
const COMP_PREV_KEY = 'boolub_competitive_prev';
const COMP_SCAN_TIME_KEY = 'boolub_competitive_scan_time';
let compCountdownInterval = null;

function initCompetitiveAutoScan() {
  loadCachedCompetitiveData();
  
  const lastScanTime = localStorage.getItem(COMP_SCAN_TIME_KEY);
  if (lastScanTime) {
    const elapsed = Date.now() - parseInt(lastScanTime, 10);
    if (elapsed >= COMP_SCAN_INTERVAL_MS) {
      setTimeout(() => runCompetitiveScan(true), 3000);
    }
  }
  
  setInterval(() => { runCompetitiveScan(true); }, COMP_SCAN_INTERVAL_MS);
  startCompCountdown();
}

function loadCachedCompetitiveData() {
  try {
    const cached = localStorage.getItem(COMP_CACHE_KEY);
    const cachedTime = localStorage.getItem(COMP_SCAN_TIME_KEY);
    if (cached && cachedTime) {
      state.competitiveData = JSON.parse(cached);
      elements.compLastScanTime.innerText = formatScanTime(new Date(parseInt(cachedTime, 10)));
      renderCompetitiveTable();
      renderCompetitiveKPIs();
      drawCompetitiveChart();
      renderStrategySummary();
      elements.compExportCsvBtn.disabled = false;
      const disadvantaged = state.competitiveData.filter(d => d.status === 'disadvantage');
      if (disadvantaged.length > 0) {
        elements.compAlertBanner.style.display = 'flex';
        elements.compAlertText.innerText = `⚠️ ${disadvantaged.length}개 상품에서 자사 가격이 경쟁사보다 높습니다.`;
      }
    }
  } catch (e) { console.warn('Cache load failed:', e); }
}

function saveCompetitiveDataToCache() {
  try {
    const prev = localStorage.getItem(COMP_CACHE_KEY);
    if (prev) localStorage.setItem(COMP_PREV_KEY, prev);
    localStorage.setItem(COMP_CACHE_KEY, JSON.stringify(state.competitiveData));
    localStorage.setItem(COMP_SCAN_TIME_KEY, String(Date.now()));
  } catch (e) { console.warn('Cache save failed:', e); }
}

function getPreviousScanData() {
  try { const p = localStorage.getItem(COMP_PREV_KEY); return p ? JSON.parse(p) : []; }
  catch (e) { return []; }
}

function formatScanTime(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function startCompCountdown() {
  if (compCountdownInterval) clearInterval(compCountdownInterval);
  compCountdownInterval = setInterval(() => {
    const last = localStorage.getItem(COMP_SCAN_TIME_KEY);
    if (!last) { elements.compNextScanTime.innerText = '첫 스캔 대기 중...'; return; }
    const remaining = parseInt(last, 10) + COMP_SCAN_INTERVAL_MS - Date.now();
    if (remaining <= 0) { elements.compNextScanTime.innerText = '스캔 시작 대기 중...'; return; }
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    elements.compNextScanTime.innerText = `${h}시간 ${m}분 ${s}초 후`;
  }, 1000);
}

async function runCompetitiveScan(isAuto = false) {
  if (elements.compScanAllBtn.disabled) return;
  if (state.campaigns.length === 0) await fetchCampaigns();

  const allAds = [];
  elements.compScanAllBtn.disabled = true;
  elements.compScanProgressWrapper.style.display = 'flex';
  elements.compScanProgressFill.style.width = '0%';
  elements.compScanProgressText.innerText = '캠페인 및 광고 그룹 스캔 중...';

  try {
    for (const campaign of state.campaigns) {
      if (campaign.campaignTp !== 'SHOPPING') continue;
      const agRes = await fetch(`${API_BASE}/api/naver-ads/adgroups?campaignId=${campaign.nccCampaignId}`);
      const adgroups = await agRes.json();
      for (const ag of adgroups) {
        const adsRes = await fetch(`${API_BASE}/api/naver-ads/ads?adgroupId=${ag.nccAdgroupId}`);
        const ads = await adsRes.json();
        for (const ad of ads) {
          const adName = ad.adAttr?.displayProductName || ad.referenceData?.productTitle || ad.referenceData?.productName || ad.referenceData?.mallProductName || ad.adName || '';
          const price = parseInt(ad.referenceData?.price, 10) || parseInt(ad.referenceData?.lowPrice, 10) || parseInt(ad.adAttr?.price, 10) || 0;
          if (adName && price > 0) {
            allAds.push({ adId: ad.nccAdId, adName, price, campaignId: campaign.nccCampaignId, campaignName: campaign.name, adgroupId: ag.nccAdgroupId, adgroupName: ag.name, referenceData: ad.referenceData });
          }
        }
      }
    }
  } catch (err) {
    elements.compScanAllBtn.disabled = false;
    elements.compScanProgressWrapper.style.display = 'none';
    if (!isAuto) alert('캠페인 데이터 수집 실패: ' + err.message);
    return;
  }

  if (allAds.length === 0) {
    elements.compScanAllBtn.disabled = false;
    elements.compScanProgressWrapper.style.display = 'none';
    if (!isAuto) alert('스캔할 쇼핑 광고 소재가 없습니다.');
    return;
  }

  state.competitiveData = [];
  const total = allAds.length;
  for (let i = 0; i < total; i++) {
    const ad = allAds[i];
    elements.compScanProgressFill.style.width = `${Math.round(((i+1)/total)*100)}%`;
    elements.compScanProgressText.innerText = `${i+1} / ${total} 상품 스캔 중...`;
    try {
      const res = await fetch(`${API_BASE}/api/crawler/match`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: ad.adId, keyword: ad.adName, price: ad.price, catalogId: '' }) });
      const data = await res.json();
      const competitors = (data.product?.competitors || []).filter(c => { const isOwn = c.name.includes('부럽') || c.name.includes('자사') || c.name.toLowerCase().includes('boolub'); return !isOwn && c.price > 0; });
      const minCompPrice = competitors.length > 0 ? Math.min(...competitors.map(c => c.price)) : null;
      const minCompName = competitors.length > 0 ? competitors.find(c => c.price === minCompPrice)?.name || '-' : '-';
      const gap = minCompPrice !== null ? ad.price - minCompPrice : null;
      state.competitiveData.push({ adId: ad.adId, adName: ad.adName, price: ad.price, minCompPrice, minCompName, gap, status: getCompetitiveStatus(ad.price, minCompPrice, competitors.length), competitorCount: competitors.length, source: data.source || 'unknown', campaignId: ad.campaignId, campaignName: ad.campaignName, adgroupId: ad.adgroupId, adgroupName: ad.adgroupName });
    } catch (err) { console.warn(`Scan failed for ${ad.adName}:`, err.message); }
    if (i < total - 1) await new Promise(r => setTimeout(r, 300));
  }

  elements.compScanProgressWrapper.style.display = 'none';
  elements.compScanAllBtn.disabled = false;
  elements.compLastScanTime.innerText = formatScanTime(new Date());
  saveCompetitiveDataToCache();
  startCompCountdown();

  const disadvantaged = state.competitiveData.filter(d => d.status === 'disadvantage');
  if (disadvantaged.length > 0) {
    elements.compAlertBanner.style.display = 'flex';
    elements.compAlertText.innerText = `⚠️ ${disadvantaged.length}개 상품에서 자사 가격이 경쟁사보다 높습니다. 가격 조정 또는 입찰 전략 검토가 필요합니다.`;
  } else { elements.compAlertBanner.style.display = 'none'; }

  elements.compExportCsvBtn.disabled = false;
  renderCompetitiveTable();
  renderCompetitiveKPIs();
  drawCompetitiveChart();
  renderStrategySummary();
}

function getCompetitiveStatus(ourPrice, minCompPrice, count) {
  if (count === 0 || minCompPrice === null) return 'monopoly';
  const r = ourPrice / minCompPrice;
  if (r <= 1.0) return 'lowest';
  if (r <= 1.05) return 'close';
  return 'disadvantage';
}

function getCompetitiveStrategy(status) {
  const map = { lowest: { emoji: '🟢', label: '공격적 입찰', desc: 'CPC를 올려 상위 노출을 확대하세요' }, close: { emoji: '🟡', label: '현 입찰 유지', desc: '리뷰·배송 등 부가가치 차별화' }, disadvantage: { emoji: '🔴', label: '입찰 하향 검토', desc: '가격 조정이나 프로모션 검토' }, monopoly: { emoji: '⭐', label: '최소 입찰 운영', desc: '독점 키워드, 효율적 운영 가능' } };
  return map[status] || { emoji: '❓', label: '-', desc: '' };
}

function getPriceChangeHtml(item) {
  const prev = getPreviousScanData();
  if (prev.length === 0) return '<span class="price-change price-change-new">신규</span>';
  const p = prev.find(x => x.adId === item.adId);
  if (!p) return '<span class="price-change price-change-new">신규</span>';
  if (p.minCompPrice === null || item.minCompPrice === null) return '<span class="price-change" style="color:rgba(255,255,255,0.3);">—</span>';
  const diff = item.minCompPrice - p.minCompPrice;
  if (diff > 0) return `<span class="price-change price-change-up">▲ +₩${diff.toLocaleString()}</span>`;
  if (diff < 0) return `<span class="price-change price-change-down">▼ -₩${Math.abs(diff).toLocaleString()}</span>`;
  return '<span class="price-change" style="color:rgba(255,255,255,0.3);">—</span>';
}

function renderCompetitiveTable() {
  const filter = elements.compStatusFilter.value;
  const sort = elements.compSortSelect.value;
  let data = [...state.competitiveData];

  if (filter !== 'all') data = data.filter(d => d.status === filter);

  switch (sort) {
    case 'gap-asc': data.sort((a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity)); break;
    case 'gap-desc': data.sort((a, b) => (a.gap ?? Infinity) - (b.gap ?? Infinity)); break;
    case 'competitors-desc': data.sort((a, b) => b.competitorCount - a.competitorCount); break;
    case 'name-asc': data.sort((a, b) => a.adName.localeCompare(b.adName)); break;
  }

  if (data.length === 0) { elements.compTableTbody.innerHTML = `<tr><td colspan="10" style="text-align:center; opacity:0.5; padding:40px;">필터 조건에 맞는 상품이 없습니다.</td></tr>`; return; }

  elements.compTableTbody.innerHTML = data.map(item => {
    const strategy = getCompetitiveStrategy(item.status);
    const badgeLabels = { lowest: '🟢 최저가', close: '🟡 근접', disadvantage: '🔴 열위', monopoly: '⭐ 독점' };
    let gapHtml = item.gap === null ? '<span class="gap-zero">-</span>' : item.gap > 0 ? `<span class="gap-positive">+₩${item.gap.toLocaleString()}</span>` : item.gap < 0 ? `<span class="gap-negative">-₩${Math.abs(item.gap).toLocaleString()}</span>` : '<span class="gap-zero">₩0</span>';
    return `<tr>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.adName}">${item.adName}</td>
      <td>₩${item.price.toLocaleString()}</td>
      <td>${item.minCompPrice !== null ? '₩' + item.minCompPrice.toLocaleString() : '-'}</td>
      <td>${gapHtml}</td>
      <td>${getPriceChangeHtml(item)}</td>
      <td><span class="comp-badge comp-badge-${item.status}">${badgeLabels[item.status] || '-'}</span></td>
      <td>${item.minCompName}</td>
      <td>${item.competitorCount}개</td>
      <td><span class="comp-strategy-mini">${strategy.emoji} ${strategy.label}</span></td>
      <td><button class="btn-detail-action" onclick="navigateToShoppingAd('${item.campaignId}','${item.adgroupId}','${item.adId}')">상세 분석</button></td>
    </tr>`;
  }).join('');
}

async function navigateToShoppingAd(campaignId, adgroupId, adId) {
  const shopTab = document.querySelector('[data-tab="shopping-optimizer"]');
  if (shopTab) shopTab.click();
  await new Promise(r => setTimeout(r, 300));
  if (state.campaigns.length === 0) await fetchCampaigns();
  populateShoppingCampaignDropdown();
  elements.shopCampaignSelect.value = campaignId;
  await handleShoppingCampaignSelection();
  await new Promise(r => setTimeout(r, 200));
  elements.shopAdgroupSelect.value = adgroupId;
  await handleShoppingAdgroupSelection();
  await new Promise(r => setTimeout(r, 200));
  elements.shopAdSelect.value = adId;
  await handleShoppingAdSelection();
}

function renderCompetitiveKPIs() {
  const data = state.competitiveData;
  if (data.length === 0) return;
  const lowestCount = data.filter(d => d.status === 'lowest').length;
  const advantageCount = data.filter(d => d.status === 'lowest' || (d.gap !== null && d.gap < -(d.price * 0.05))).length;
  const disadvantageCount = data.filter(d => d.status === 'disadvantage').length;
  const withComp = data.filter(d => d.minCompPrice !== null && d.minCompPrice > 0);
  const avgRatio = withComp.length > 0 ? withComp.reduce((s, d) => s + (d.price / d.minCompPrice), 0) / withComp.length : null;
  elements.compKpiTotal.innerText = `${data.length}개`;
  elements.compKpiLowest.innerText = `${lowestCount}개`;
  elements.compKpiAdvantage.innerText = `${advantageCount}개`;
  elements.compKpiDisadvantage.innerText = `${disadvantageCount}개`;
  if (avgRatio !== null) { elements.compKpiAvgRatio.innerText = `${(avgRatio * 100).toFixed(1)}%`; elements.compKpiAvgRatio.style.color = avgRatio <= 1.0 ? '#00e676' : avgRatio <= 1.05 ? '#ffc107' : '#ff5252'; }
  else { elements.compKpiAvgRatio.innerText = '-'; }
}

function drawCompetitiveChart() {
  const data = state.competitiveData;
  if (data.length === 0) return;
  const counts = { lowest: data.filter(d => d.status === 'lowest').length, close: data.filter(d => d.status === 'close').length, disadvantage: data.filter(d => d.status === 'disadvantage').length, monopoly: data.filter(d => d.status === 'monopoly').length };
  const ctx = document.getElementById('comp-distribution-chart').getContext('2d');
  if (state.charts.competitive) state.charts.competitive.destroy();
  const colors = ['#00e676', '#ffc107', '#ff5252', '#a78bfa'];
  const labels = ['최저가', '근접', '열위', '독점'];
  const values = [counts.lowest, counts.close, counts.disadvantage, counts.monopoly];
  state.charts.competitive = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const t = ctx.dataset.data.reduce((a,b) => a+b, 0); return `${ctx.label}: ${ctx.raw}개 (${t > 0 ? ((ctx.raw/t)*100).toFixed(1) : 0}%)`; } } } } } });
  elements.compChartLegend.innerHTML = labels.map((l, i) => `<div class="comp-legend-item"><span class="comp-legend-dot" style="background:${colors[i]}"></span><span>${l} ${values[i]}개</span></div>`).join('');
}

function renderStrategySummary() {
  const data = state.competitiveData;
  if (data.length === 0) return;
  const lc = data.filter(d => d.status === 'lowest').length, cc = data.filter(d => d.status === 'close').length, dc = data.filter(d => d.status === 'disadvantage').length, mc = data.filter(d => d.status === 'monopoly').length;
  const items = [];
  if (lc > 0) items.push(`<div class="comp-strategy-item"><span class="emoji">🟢</span><div><strong>최저가 ${lc}개 상품</strong> — CPC를 공격적으로 올려 상위 노출 점유율을 확대하세요. 가격 우위가 있으므로 전환율이 높습니다.</div></div>`);
  if (cc > 0) items.push(`<div class="comp-strategy-item"><span class="emoji">🟡</span><div><strong>근접 ${cc}개 상품</strong> — 현 입찰가를 유지하되, 리뷰 수·배송 속도·부가 서비스 등 비가격 차별화 포인트를 강조하세요.</div></div>`);
  if (dc > 0) { const top = data.filter(d => d.status === 'disadvantage').sort((a,b) => b.gap - a.gap).slice(0,3); items.push(`<div class="comp-strategy-item"><span class="emoji">🔴</span><div><strong>열위 ${dc}개 상품 — 즉각 조치 필요!</strong><br>입찰가를 낮추거나, 가격 인하 프로모션을 검토하세요. 주요: ${top.map(d => `"${d.adName.substring(0,20)}…" (+₩${d.gap.toLocaleString()})`).join(', ')}</div></div>`); }
  if (mc > 0) items.push(`<div class="comp-strategy-item"><span class="emoji">⭐</span><div><strong>독점 ${mc}개 상품</strong> — 경쟁사 없이 독점 노출 중입니다. 최소 입찰가로 효율적 운영이 가능합니다.</div></div>`);
  if (items.length === 0) items.push(`<p style="opacity:0.5;text-align:center;padding:20px;">분석 결과가 없습니다.</p>`);
  elements.compStrategySummary.innerHTML = items.join('');
}

function exportCompetitiveCSV() {
  if (state.competitiveData.length === 0) return;
  const BOM = '\uFEFF';
  const headers = ['상품명','자사 판매가','경쟁사 최저가','가격 차이','경쟁력 상태','최저가 업체','경쟁사 수','전략','캠페인','광고그룹'];
  const statusLabels = { lowest: '최저가', close: '근접', disadvantage: '열위', monopoly: '독점' };
  const rows = state.competitiveData.map(item => {
    const s = getCompetitiveStrategy(item.status);
    return [`"${item.adName.replace(/"/g,'""')}"`, item.price, item.minCompPrice ?? '-', item.gap ?? '-', statusLabels[item.status] || '-', `"${item.minCompName.replace(/"/g,'""')}"`, item.competitorCount, `"${s.label}"`, `"${item.campaignName.replace(/"/g,'""')}"`, `"${item.adgroupName.replace(/"/g,'""')}"`].join(',');
  });
  const csv = BOM + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const a = document.createElement('a');
  a.href = url;
  a.download = `부럽트래블_경쟁력분석_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


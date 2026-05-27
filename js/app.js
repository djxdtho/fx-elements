window.FX = window.FX || {};

(function() {
  var NAV_ITEMS = [
    {
      label: 'Dashboard',
      route: 'dashboard',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
    },
    {
      label: 'Converter',
      route: 'converter',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>'
    },
    {
      label: 'Watchlist',
      route: 'watchlist',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
    },
    {
      label: 'Charts',
      route: 'charts',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>'
    },
    {
      label: 'Trading',
      route: 'trade',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
    }
  ];

  var PAIR_LIST = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/GBP', 'GBP/JPY', 'EUR/JPY'];

  var JPY_PAIRS = ['USD/JPY', 'EUR/JPY', 'GBP/JPY'];

  var ROUTE_MAP = {
    dashboard: 'FX.Dashboard.render',
    converter: 'FX.Converter.render',
    watchlist: 'FX.Watchlist.render',
    charts: 'FX.Charts.render',
    trade: 'FX.TradingUI.render'
  };

  var ROUTE_TITLES = {
    dashboard: 'Market Overview',
    converter: 'Currency Converter',
    watchlist: 'Watchlist',
    charts: 'Charts & Analysis',
    trade: 'Trading Terminal'
  };

  FX.App = {
    pairList: PAIR_LIST,
    topPairs: PAIR_LIST,
    currencies: {},
    rates: {},
    updateTime: null,

    _rateInterval: null,
    _prevRates: {},

    init: function() {
      var self = this;

      FX.API.getCurrencies().then(function(data) {
        if (data) {
          self.currencies = data;
        }
        self._buildLayout();
        self._setupRouting();
        self._setupNavigation();
        self.renderPage();
        if (typeof FX.Dashboard !== 'undefined' && FX.Dashboard.init) {
          FX.Dashboard.init();
        }
        self._startRateRefresh();
        self._updateHeaderBalance();
      });
    },

    _buildLayout: function() {
      if (document.getElementById('page-content')) return;

      var sidebar = document.createElement('aside');
      sidebar.className = 'sidebar';
      sidebar.innerHTML =
        '<div class="logo">' +
          '<svg width="28" height="28" viewBox="0 0 28 28" fill="none">' +
            '<rect x="2" y="2" width="24" height="24" rx="6" stroke="#b8944c" stroke-width="2" fill="rgba(184,148,76,0.12)"/>' +
            '<path d="M9 14l3 3 7-7" stroke="#b8944c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '<div>' +
            '<div class="logo-text">FX Elements</div>' +
            '<div class="logo-sub"><span>FX</span> Broker</div>' +
          '</div>' +
        '</div>' +
        '<div class="nav-list"></div>';

      var navList = sidebar.querySelector('.nav-list');
      var navItems = this.navItems();
      for (var i = 0; i < navItems.length; i++) {
        var item = navItems[i];
        var btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.setAttribute('data-nav', item.route);
        btn.innerHTML = item.icon + '<span class="nav-label">' + item.label + '</span>';
        navList.appendChild(btn);
      }

      var main = document.createElement('main');
      main.className = 'main-area';
      main.innerHTML =
        '<header class="topbar">' +
          '<h1 class="page-title" id="page-title">Market Overview</h1>' +
          '<div class="topbar-right">' +
            '<span class="update-time" id="update-time"></span>' +
            '<span class="balance-badge" id="header-balance">$10,000.00</span>' +
          '</div>' +
        '</header>' +
        '<div class="content" id="page-content"></div>';

      var bottomNav = document.createElement('nav');
      bottomNav.className = 'bottom-nav';
      var bottomInner = document.createElement('div');
      bottomInner.className = 'bottom-nav-inner';
      for (var j = 0; j < navItems.length; j++) {
        var bItem = navItems[j];
        var bBtn = document.createElement('button');
        bBtn.className = 'bnav-item';
        bBtn.setAttribute('data-nav', bItem.route);
        bBtn.innerHTML = bItem.icon + '<span>' + bItem.label + '</span>';
        bottomInner.appendChild(bBtn);
      }
      bottomNav.appendChild(bottomInner);

      var layout = document.createElement('div');
      layout.className = 'app-layout';
      layout.appendChild(sidebar);
      layout.appendChild(main);

      document.body.appendChild(layout);
      document.body.appendChild(bottomNav);
    },

    _setupRouting: function() {
      var self = this;
      window.addEventListener('hashchange', function() {
        self.renderPage();
      });
    },

    _setupNavigation: function() {
      var self = this;
      document.addEventListener('click', function(e) {
        var navEl = e.target.closest('[data-nav]');
        if (navEl) {
          self.navigate(navEl.getAttribute('data-nav'));
        }
      });
    },

    renderPage: function() {
      var route = this.activeRoute();
      var pageTitle = document.getElementById('page-title');
      if (pageTitle) {
        pageTitle.textContent = ROUTE_TITLES[route] || 'FX Elements';
      }

      switch (route) {
        case 'converter':
          if (typeof FX.Converter !== 'undefined' && FX.Converter.render) FX.Converter.render();
          break;
        case 'watchlist':
          if (typeof FX.Watchlist !== 'undefined' && FX.Watchlist.render) FX.Watchlist.render();
          break;
        case 'charts':
          if (typeof FX.Charts !== 'undefined' && FX.Charts.render) FX.Charts.render();
          break;
        case 'trade':
          if (typeof FX.TradingUI !== 'undefined' && FX.TradingUI.render) FX.TradingUI.render();
          break;
        default:
          if (typeof FX.Dashboard !== 'undefined' && FX.Dashboard.render) FX.Dashboard.render();
          break;
      }

      this.updateActiveNav(route);
    },

    navigate: function(route) {
      location.hash = '#' + route;
    },

    activeRoute: function() {
      return location.hash.replace('#', '') || 'dashboard';
    },

    render: function(html) {
      var el = document.getElementById('page-content');
      if (el) {
        el.innerHTML = '<div class="page">' + html + '</div>';
      }
    },

    showLoading: function() {
      this.render('<div class="spinner"></div>');
    },

    navItems: function() {
      return NAV_ITEMS;
    },

    formatRate: function(num, pair) {
      if (num == null || isNaN(num)) return '\u2014';
      var decimals = JPY_PAIRS.indexOf(pair) !== -1 ? 3 : 5;
      return Number(num).toFixed(decimals);
    },

    formatChange: function(num) {
      if (num == null || isNaN(num)) return '\u2014';
      var sign = num >= 0 ? '+' : '';
      var cls = num >= 0 ? 'up' : 'down';
      return '<span class="card-change ' + cls + '">' + sign + Number(num).toFixed(2) + '%</span>';
    },

    formatUSD: function(num) {
      if (num == null || isNaN(num)) return '\u2014';
      return '$' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    getFromPair: function(pair) {
      return pair.split('/')[0];
    },

    getToPair: function(pair) {
      return pair.split('/')[1];
    },

    refreshRates: function() {
      var self = this;
      var promises = [];

      for (var i = 0; i < this.pairList.length; i++) {
        var pair = this.pairList[i];

        promises.push((function(p) {
          var from = p.split('/')[0];
          var to = p.split('/')[1];
          return FX.API.getRates(from, to).then(function(data) {
            if (data && data.rates && data.rates[to] != null) {
              var rate = data.rates[to];
              self._prevRates[p] = self.rates[p] || rate;
              self.rates[p] = rate;
            }
          });
        })(pair));
      }

      Promise.all(promises).then(function() {
        self.updateTime = new Date();
        var timeEl = document.getElementById('update-time');
        if (timeEl) {
          timeEl.textContent = 'Updated ' + self.updateTime.toLocaleTimeString();
        }
        if (typeof FX.Trading !== 'undefined' && FX.Trading.updatePrices) {
          FX.Trading.updatePrices(self.rates);
        }
        self._updateHeaderBalance();
        self._updateTickerDOM();
      });
    },

    _startRateRefresh: function() {
      var self = this;
      this._rateInterval = setInterval(function() {
        self.refreshRates();
      }, 30000);
    },

    _updateTickerDOM: function() {
      var ticker = document.querySelector('.ticker');
      if (!ticker) return;

      var itemsHtml = '';
      var pairs = this.pairList;
      for (var d = 0; d < 2; d++) {
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i];
          var rate = this.rates[pair];
          var prev = this._prevRates[pair];
          var change = 0;
          if (rate != null && prev != null && prev !== 0) {
            change = (rate - prev) / prev * 100;
          }
          var changeCls = change >= 0 ? 'up' : 'down';
          var changeSign = change >= 0 ? '+' : '';
          itemsHtml +=
            '<span class="ticker-item">' +
              '<span class="t-rate">' + pair + ' ' + this.formatRate(rate, pair) + '</span>' +
              '<span class="t-change ' + changeCls + '">' + changeSign + change.toFixed(2) + '%</span>' +
            '</span>';
        }
      }
      ticker.innerHTML = itemsHtml;
    },

    _updateHeaderBalance: function() {
      var badge = document.getElementById('header-balance');
      if (badge && typeof FX.Trading !== 'undefined') {
        var balance = FX.Trading.getBalance();
        badge.textContent = this.formatUSD(balance);
      }
    },

    updateActiveNav: function(route) {
      var navItems = document.querySelectorAll('[data-nav]');
      for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.toggle('active', navItems[i].getAttribute('data-nav') === route);
      }
    }
  };
})();

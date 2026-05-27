window.FX = window.FX || {};

(function() {
  var feedbackTimer = null;
  var miniChartWidget = null;
  var _pendingMsg = null;
  var _pendingType = null;
  var _positionMarkers = [];

  function showMsg(msg, type) {
    _pendingMsg = msg;
    _pendingType = type;
  }

  function flushMsg() {
    if (!_pendingMsg) return;
    var el = document.getElementById('trade-feedback');
    if (el) {
      el.textContent = _pendingMsg;
      el.className = 'trade-feedback';
      if (_pendingType === 'error') el.classList.add('feedback-error');
      else el.classList.add('feedback-ok');
      if (feedbackTimer) clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(function() {
        el.textContent = '';
        el.className = 'trade-feedback';
      }, 4000);
    }
    _pendingMsg = null;
    _pendingType = null;
  }

  function render() {
    FX.Trading.updatePrices(FX.App.rates);

    var state = FX.Trading.getState();
    var balance = state.balance;
    var equity = FX.Trading.getEquity();
    var margin = FX.Trading.getMarginUsed();
    var free = FX.Trading.getFreeMargin();
    var level = FX.Trading.getMarginLevel();
    var positions = state.positions;
    var history = state.history;
    var pairs = FX.App.pairList || [];

    var html = '';

    /* ──  Account Summary  ── */
    html += '<div class="account-stats">';
    html += statCard('Balance', FX.App.formatUSD(balance), '');
    html += statCard('Equity', FX.App.formatUSD(equity), equity >= balance ? 'up' : 'down');
    html += statCard('Margin', FX.App.formatUSD(margin), '');
    html += statCard('Free Margin', FX.App.formatUSD(free), free >= 0 ? 'up' : 'down');
    html += statCard('Margin Level', level.toFixed(2) + '%', level > 100 ? 'up' : 'down');
    html += '</div>';

    /* ──  Demo Account Banner  ── */
    html += '<div class="demo-banner"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> DEMO ACCOUNT — This is a simulated trading environment. No real money involved.</div>';

    /* ──  Main Trading Area (ticket + mini chart)  ── */
    html += '<div class="trade-main">';

    /* ──  Trade Ticket  ── */
    html += '<div class="ticket-card">';
    html += '<div class="ticket-header">New Order</div>';
    html += '<div id="trade-feedback" class="trade-feedback"></div>';

    /* Pair */
    var defaultPair = FX.App._pendingPair || 'EUR/USD';
    FX.App._pendingPair = null;
    html += '<div class="ticket-row">';
    html += '<label class="ticket-label">Symbol</label>';
    html += '<select class="input" id="ticket-pair">';
    for (var i = 0; i < pairs.length; i++) {
      var sel = pairs[i] === defaultPair ? ' selected' : '';
      html += '<option value="' + pairs[i] + '"' + sel + '>' + pairs[i] + '</option>';
    }
    html += '</select>';
    html += '</div>';

    /* Bid / Ask display */
    html += '<div class="ticket-price-row">';
    html += '<div class="ticket-bidask"><span class="bidask-label">Bid</span><span class="bidask-val" id="ticket-bid">—</span></div>';
    html += '<div class="ticket-bidask"><span class="bidask-label">Ask</span><span class="ticket-ask-val" id="ticket-ask">—</span></div>';
    html += '<div class="ticket-spread"><span class="bidask-label">Spread</span><span class="bidask-val" id="ticket-spread">—</span></div>';
    html += '</div>';

    /* Lot size */
    html += '<div class="ticket-row">';
    html += '<label class="ticket-label">Volume (Lots)</label>';
    html += '<div class="lot-group">';
    html +=   '<button class="lot-btn" data-lot="0.01">0.01</button>';
    html +=   '<button class="lot-btn" data-lot="0.10">0.10</button>';
    html +=   '<button class="lot-btn active" data-lot="1.00">1.00</button>';
    html +=   '<button class="lot-btn" data-lot="5.00">5.00</button>';
    html +=   '<button class="lot-btn" data-lot="10.0">10.0</button>';
    html += '</div>';
    html += '<input type="number" class="input input-num lot-input" id="ticket-lots" value="1.00" min="0.01" max="50" step="0.01">';
    html += '</div>';

    /* Leverage */
    html += '<div class="ticket-row">';
    html += '<label class="ticket-label">Leverage</label>';
    html += '<select class="input" id="ticket-leverage">';
    var levs = [1, 10, 20, 30, 50, 100, 200, 500];
    for (var l = 0; l < levs.length; l++) {
      var s = levs[l] === state.leverage ? ' selected' : '';
      html += '<option value="' + levs[l] + '"' + s + '>1:' + levs[l] + '</option>';
    }
    html += '</select>';
    html += '</div>';

    /* TP / SL */
    html += '<div class="ticket-row ticket-tpsl">';
    html += '<div style="flex:1"><label class="ticket-label">Take Profit</label><input type="number" class="input input-num" id="ticket-tp" placeholder="—" step="0.00001"></div>';
    html += '<div style="flex:1"><label class="ticket-label">Stop Loss</label><input type="number" class="input input-num" id="ticket-sl" placeholder="—" step="0.00001"></div>';
    html += '</div>';

    /* Margin estimate */
    html += '<div class="ticket-margin" id="ticket-margin-est">Est. Margin: —</div>';

    /* Buy / Sell buttons */
    html += '<div class="ticket-actions">';
    html += '<button class="btn-buy" id="btn-buy">Buy</button>';
    html += '<button class="btn-sell" id="btn-sell">Sell</button>';
    html += '</div>';

    html += '</div>'; /* end ticket-card */

    /* ──  Mini Chart  ── */
    html += '<div class="mini-chart-wrap">';
    html += '<div class="mini-chart-header">';
    html +=   '<span class="mini-chart-title" id="mini-chart-title">' + defaultPair + '</span>';
    html +=   '<div class="mini-chart-tfs">';
    html +=     '<button class="mini-tab active" data-mini-tf="60">1H</button>';
    html +=     '<button class="mini-tab" data-mini-tf="240">4H</button>';
    html +=     '<button class="mini-tab" data-mini-tf="D">1D</button>';
    html +=     '<button class="mini-tab" data-mini-tf="W">1W</button>';
    html +=   '</div>';
    html += '</div>';
    html += '<div id="tv-mini-chart" class="tv-mini-container"><div class="tv-loading">Loading chart...</div></div>';
    html += '</div>';

    html += '</div>'; /* end trade-main */

    /* ──  Positions / History Tabs  ── */
    html += '<div class="tabs" id="trade-tabs">';
    html +=   '<button class="tab active" data-tab="positions">Open Positions (' + positions.length + ')</button>';
    html +=   '<button class="tab" data-tab="history">History (' + history.length + ')</button>';
    html += '</div>';

    html += '<div id="trade-positions-panel">';
    if (positions.length === 0) {
      html += '<div class="empty-state"><h3>No Open Positions</h3><p>Open a trade to see it here</p></div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>Symbol</th><th>Type</th><th>Lots</th><th>Open</th><th>Price</th><th>S/L</th><th>T/P</th><th>Current</th><th>P&L</th><th></th>' +
      '</tr></thead><tbody>';
      for (var pi = 0; pi < positions.length; pi++) {
        var p = positions[pi];
        var cp = FX.App.rates[p.pair] || p.currentPrice;
        var pnl = FX.Trading.calculatePnL(p, cp);
        var pnlCls = pnl >= 0 ? 'up' : 'down';
        html += '<tr>' +
          '<td><span class="pair-name">' + p.pair + '</span></td>' +
          '<td><span class="trade-side ' + p.side + '">' + p.side.toUpperCase() + '</span></td>' +
          '<td class="num">' + p.lots.toFixed(2) + '</td>' +
          '<td>' + new Date(p.timestamp).toLocaleTimeString() + '</td>' +
          '<td class="num">' + FX.App.formatRate(p.entryPrice, p.pair) + '</td>' +
          '<td class="num">' + (p.stopLoss ? FX.App.formatRate(p.stopLoss, p.pair) : '—') + '</td>' +
          '<td class="num">' + (p.takeProfit ? FX.App.formatRate(p.takeProfit, p.pair) : '—') + '</td>' +
          '<td class="num">' + FX.App.formatRate(cp, p.pair) + '</td>' +
          '<td class="num ' + pnlCls + '">' + (pnl >= 0 ? '+' : '') + FX.App.formatUSD(pnl) + '</td>' +
          '<td><button class="btn btn-sm btn-danger close-pos" data-id="' + p.id + '">X</button></td>' +
        '</tr>';
      }
      html += '</tbody></table></div>';
    }
    html += '</div>';

    html += '<div id="trade-history-panel" style="display:none">';
    if (history.length === 0) {
      html += '<div class="empty-state"><h3>No Trade History</h3><p>Closed trades will appear here</p></div>';
    } else {
      var sorted = history.slice().sort(function(a,b) { return new Date(b.closeTimestamp) - new Date(a.closeTimestamp); });
      var totalPnl = 0;
      for (var hi = 0; hi < sorted.length; hi++) totalPnl += sorted[hi].profit;
      html += '<div style="margin-bottom:16px;display:flex;gap:24px">' +
        '<span>Total Trades: <strong>' + sorted.length + '</strong></span>' +
        '<span>Won: <strong class="up">' + sorted.filter(function(h){return h.profit >= 0;}).length + '</strong></span>' +
        '<span>Lost: <strong class="down">' + sorted.filter(function(h){return h.profit < 0;}).length + '</strong></span>' +
        '<span>Net P&L: <strong class="' + (totalPnl >= 0 ? 'up' : 'down') + '">' + (totalPnl >= 0 ? '+' : '') + FX.App.formatUSD(totalPnl) + '</strong></span>' +
      '</div>';
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>Date</th><th>Symbol</th><th>Type</th><th>Lots</th><th>Entry</th><th>Exit</th><th>Profit</th>' +
      '</tr></thead><tbody>';
      for (var hj = 0; hj < sorted.length; hj++) {
        var h = sorted[hj];
        var pc = h.profit >= 0 ? 'up' : 'down';
        html += '<tr>' +
          '<td>' + new Date(h.closeTimestamp).toLocaleDateString() + '</td>' +
          '<td><span class="pair-name">' + h.pair + '</span></td>' +
          '<td><span class="trade-side ' + h.side + '">' + h.side.toUpperCase() + '</span></td>' +
          '<td class="num">' + h.lots.toFixed(2) + '</td>' +
          '<td class="num">' + FX.App.formatRate(h.entryPrice, h.pair) + '</td>' +
          '<td class="num">' + FX.App.formatRate(h.exitPrice, h.pair) + '</td>' +
          '<td class="num ' + pc + '">' + (h.profit >= 0 ? '+' : '') + FX.App.formatUSD(h.profit) + '</td>' +
        '</tr>';
      }
      html += '</tbody></table></div>';
    }
    html += '</div>';

    FX.App.render(html);
    bindEvents();
    flushMsg();
    updateBidAsk();
    updateMarginEstimate();
    initMiniChart();

    /* Delayed update for rates that load after render */
    setTimeout(function() {
      updateBidAsk();
      updateMarginEstimate();
    }, 3000);
  }

  function statCard(label, value, cls) {
    return '<div class="stat-card"><div class="stat-label">' + label + '</div><div class="stat-value' + (cls ? ' ' + cls : '') + '">' + value + '</div></div>';
  }

  function updateBidAsk() {
    var pair = document.getElementById('ticket-pair');
    if (!pair) return;
    var p = pair.value;
    var rate = FX.App.rates[p];
    var bidEl = document.getElementById('ticket-bid');
    var askEl = document.getElementById('ticket-ask');
    var spreadEl = document.getElementById('ticket-spread');
    if (rate != null) {
      var spread = rate * 0.0002;
      var bid = rate - spread;
      var ask = rate + spread;
      var fmt = FX.App.formatRate(rate, p);
      var pips = (spread / (p.indexOf('JPY') !== -1 ? 0.01 : 0.0001)).toFixed(1);
      bidEl.textContent = FX.App.formatRate(bid, p);
      askEl.textContent = FX.App.formatRate(ask, p);
      spreadEl.textContent = pips + ' pips';
    } else {
      bidEl.textContent = '—';
      askEl.textContent = '—';
      spreadEl.textContent = '—';
    }
  }

  function updateMarginEstimate() {
    var pairEl = document.getElementById('ticket-pair');
    var lotsEl = document.getElementById('ticket-lots');
    var levEl = document.getElementById('ticket-leverage');
    var marginEl = document.getElementById('ticket-margin-est');
    if (!pairEl || !lotsEl || !levEl || !marginEl) return;
    var pair = pairEl.value;
    var lots = parseFloat(lotsEl.value) || 0;
    var lev = parseInt(levEl.value, 10) || 100;
    var margin = FX.Trading.calculateMargin(pair, lots, lev);
    var pip = FX.Trading.calculatePipValue(pair, lots);
    marginEl.innerHTML = 'Est. Margin: <strong>' + FX.App.formatUSD(margin) + '</strong> &middot; Pip Value: <strong>' + FX.App.formatUSD(pip) + '</strong>';
  }

  function clearPositionMarkers() {
    for (var m = 0; m < _positionMarkers.length; m++) {
      try { _positionMarkers[m].remove(); } catch(e) {}
    }
    _positionMarkers = [];
  }

  function drawPositionMarkers(widget) {
    clearPositionMarkers();
    try {
      var chart = widget.chart();
      if (!chart) return;
    } catch(e) { return; }

    var positions = FX.Trading.getPositions();
    var currentPair = document.getElementById('ticket-pair');
    if (!currentPair) return;
    var selectedPair = currentPair.value;

    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      if (pos.pair !== selectedPair) continue;

      var isBuy = pos.side === 'buy';
      var color = isBuy ? '#22c55e' : '#ef4444';
      var text = (isBuy ? 'BUY' : 'SELL') + ' ' + pos.lots.toFixed(2);

      try {
        var line = chart.createPositionLine({
          price: pos.entryPrice,
          text: text,
          quantity: pos.lots.toFixed(2),
          bodyFont: 'bold 11px Inter',
          quantityFont: 'bold 10px Inter',
          bodyBackgroundColor: color,
          bodyBorderColor: color,
          quantityBackgroundColor: color,
          quantityBorderColor: color,
          lineLength: 20,
          lineColor: color,
          bodyTextColor: '#000000',
          quantityTextColor: '#000000'
        });
        _positionMarkers.push(line);
      } catch(e) {}

      /* Stop Loss line */
      if (pos.stopLoss != null) {
        try {
          var slLine = chart.createOrderLine({
            price: pos.stopLoss,
            text: 'SL',
            lineLength: 20,
            lineColor: '#ef4444',
            bodyBackgroundColor: '#ef4444',
            bodyBorderColor: '#ef4444',
            bodyTextColor: '#ffffff',
            quantity: 'SL',
            quantityBackgroundColor: '#ef4444',
            quantityBorderColor: '#ef4444',
            quantityTextColor: '#ffffff'
          });
          _positionMarkers.push(slLine);
        } catch(e) {}
      }

      /* Take Profit line */
      if (pos.takeProfit != null) {
        try {
          var tpLine = chart.createOrderLine({
            price: pos.takeProfit,
            text: 'TP',
            lineLength: 20,
            lineColor: '#22c55e',
            bodyBackgroundColor: '#22c55e',
            bodyBorderColor: '#22c55e',
            bodyTextColor: '#000000',
            quantity: 'TP',
            quantityBackgroundColor: '#22c55e',
            quantityBorderColor: '#22c55e',
            quantityTextColor: '#000000'
          });
          _positionMarkers.push(tpLine);
        } catch(e) {}
      }
    }
  }

  function initMiniChart() {
    if (typeof TradingView === 'undefined') return;
    var pair = document.getElementById('ticket-pair');
    if (!pair) return;
    var symbol = 'FX:' + pair.value.replace('/', '');
    var tf = document.querySelector('.mini-tab.active');
    var interval = tf ? tf.getAttribute('data-mini-tf') : '60';

    var container = document.getElementById('tv-mini-chart');
    if (!container) return;
    container.innerHTML = '';
    clearPositionMarkers();

    if (miniChartWidget) {
      try { miniChartWidget.remove(); } catch(e) {}
      miniChartWidget = null;
    }

    miniChartWidget = new TradingView.widget({
      container_id: 'tv-mini-chart',
      symbol: symbol,
      interval: interval,
      timezone: 'exchange',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#161b24',
      enable_publishing: false,
      hide_side_toolbar: true,
      hide_top_toolbar: true,
      save_image: false,
      allow_symbol_change: false,
      studies: [],
      width: '100%',
      height: '100%',
      backgroundColor: '#161b24',
      gridColor: '#222a38',
      crosshair_color: '#8b95a5'
    });

    miniChartWidget.onChartReady(function() {
      setTimeout(function() { drawPositionMarkers(miniChartWidget); }, 500);
    });
  }

  function destroyMiniChart() {
    if (miniChartWidget) {
      try { miniChartWidget.remove(); } catch(e) {}
      miniChartWidget = null;
    }
  }

  function bindEvents() {
    var pairEl = document.getElementById('ticket-pair');
    var lotsEl = document.getElementById('ticket-lots');
    var levEl = document.getElementById('ticket-leverage');

    /* Pair change → update prices + mini chart */
    if (pairEl) {
      pairEl.addEventListener('change', function() {
        updateBidAsk();
        updateMarginEstimate();
        var titleEl = document.getElementById('mini-chart-title');
        if (titleEl) titleEl.textContent = this.value;
        initMiniChart();
      });
    }

    /* Lot quick buttons */
    var lotBtns = document.querySelectorAll('.lot-btn');
    for (var lb = 0; lb < lotBtns.length; lb++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var all = document.querySelectorAll('.lot-btn');
          for (var a = 0; a < all.length; a++) all[a].classList.remove('active');
          btn.classList.add('active');
          if (lotsEl) {
            lotsEl.value = btn.getAttribute('data-lot');
            updateMarginEstimate();
          }
        });
      })(lotBtns[lb]);
    }

    /* Manual lot input */
    if (lotsEl) {
      lotsEl.addEventListener('input', function() {
        var all = document.querySelectorAll('.lot-btn');
        for (var a = 0; a < all.length; a++) all[a].classList.remove('active');
        updateMarginEstimate();
      });
    }

    /* Leverage change */
    if (levEl) {
      levEl.addEventListener('change', function() {
        FX.Trading.setLeverage(parseInt(this.value, 10));
        updateMarginEstimate();
      });
    }

    /* TP / SL updates */
    var tpEl = document.getElementById('ticket-tp');
    var slEl = document.getElementById('ticket-sl');
    if (tpEl) tpEl.addEventListener('input', updateMarginEstimate);
    if (slEl) slEl.addEventListener('input', updateMarginEstimate);

    /* Buy / Sell */
    var buyBtn = document.getElementById('btn-buy');
    var sellBtn = document.getElementById('btn-sell');

    function openTrade(side) {
      var pair = pairEl ? pairEl.value : 'EUR/USD';
      var lots = parseFloat(lotsEl ? lotsEl.value : 1);
      var leverage = parseInt(levEl ? levEl.value : 100, 10);
      var tp = tpEl ? parseFloat(tpEl.value) || null : null;
      var sl = slEl ? parseFloat(slEl.value) || null : null;

      var result = FX.Trading.openPosition(pair, side, lots, leverage, tp, sl);
      if (result.error) {
        showMsg(result.error, 'error');
      } else {
        showMsg((side === 'buy' ? 'Buy' : 'Sell') + ' ' + lots.toFixed(2) + ' lots ' + pair + ' @ market', 'ok');
        render();
      }
    }

    if (buyBtn) buyBtn.addEventListener('click', function() { openTrade('buy'); });
    if (sellBtn) sellBtn.addEventListener('click', function() { openTrade('sell'); });

    /* Close positions */
    var closeBtns = document.querySelectorAll('.close-pos');
    for (var cb = 0; cb < closeBtns.length; cb++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var id = parseInt(btn.getAttribute('data-id'), 10);
          var result = FX.Trading.closePosition(id);
          if (result.error) { showMsg(result.error, 'error'); }
          else {
            var pnl = result.record.profit;
            showMsg('Closed ' + result.record.pair + ' | P&L: ' + (pnl >= 0 ? '+' : '') + FX.App.formatUSD(pnl), pnl >= 0 ? 'ok' : 'error');
            render();
          }
        });
      })(closeBtns[cb]);
    }

    /* Tabs: Positions / History */
    var tradeTabs = document.querySelectorAll('#trade-tabs .tab');
    for (var tt = 0; tt < tradeTabs.length; tt++) {
      (function(tab) {
        tab.addEventListener('click', function() {
          var all = document.querySelectorAll('#trade-tabs .tab');
          for (var a = 0; a < all.length; a++) all[a].classList.remove('active');
          tab.classList.add('active');
          var target = tab.getAttribute('data-tab');
          var posPanel = document.getElementById('trade-positions-panel');
          var histPanel = document.getElementById('trade-history-panel');
          if (posPanel) posPanel.style.display = target === 'positions' ? 'block' : 'none';
          if (histPanel) histPanel.style.display = target === 'history' ? 'block' : 'none';
        });
      })(tradeTabs[tt]);
    }

    /* Mini chart timeframe tabs */
    var miniTfs = document.querySelectorAll('.mini-tab');
    for (var mt = 0; mt < miniTfs.length; mt++) {
      (function(tab) {
        tab.addEventListener('click', function() {
          var all = document.querySelectorAll('.mini-tab');
          for (var a = 0; a < all.length; a++) all[a].classList.remove('active');
          tab.classList.add('active');
          initMiniChart();
        });
      })(miniTfs[mt]);
    }
  }

  var _pricePoller = null;

    function startPricePolling() {
    if (_pricePoller) clearInterval(_pricePoller);
    var elapsed = 0;
    _pricePoller = setInterval(function() {
      updateBidAsk();
      elapsed += 5;
      if (elapsed <= 15) updateMarginEstimate();
      /* Refresh position markers if widget is ready */
      if (miniChartWidget) {
        try {
          if (miniChartWidget.chart()) drawPositionMarkers(miniChartWidget);
        } catch(e) {}
      }
    }, 5000);
  }

  function stopPricePolling() {
    if (_pricePoller) {
      clearInterval(_pricePoller);
      _pricePoller = null;
    }
  }

  FX.TradingUI = {
    render: function() {
      render();
      startPricePolling();
    },
    destroy: function() {
      destroyMiniChart();
      stopPricePolling();
    }
  };
})();

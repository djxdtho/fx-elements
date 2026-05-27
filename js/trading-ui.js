window.FX = window.FX || {};

(function() {
  function showFeedback(message, type) {
    var existing = document.querySelector('.trade-feedback');
    if (existing) existing.remove();

    var div = document.createElement('div');
    div.className = 'trade-feedback';
    div.style.cssText = 'padding:12px 16px;border-radius:var(--radius);margin-bottom:16px;font-size:14px;font-weight:500;animation:fadeIn 0.3s ease';

    if (type === 'error') {
      div.style.background = 'var(--red-dim)';
      div.style.color = 'var(--red)';
      div.style.border = '1px solid rgba(239,68,68,0.2)';
    } else {
      div.style.background = 'var(--green-dim)';
      div.style.color = 'var(--green)';
      div.style.border = '1px solid rgba(34,197,94,0.2)';
    }

    div.textContent = message;
    var content = document.querySelector('.content');
    if (content) {
      content.insertBefore(div, content.firstChild);
    }

    setTimeout(function() {
      if (div.parentNode) div.remove();
    }, 3000);
  }

  function render() {
    FX.Trading.updatePrices(FX.App.rates);

    var balance = FX.Trading.getBalance();
    var equity = FX.Trading.getEquity();
    var positions = FX.Trading.getPositions();
    var history = FX.Trading.getHistory();
    var marginUsed = FX.Trading.getMarginUsed();
    var freeMargin = FX.Trading.getFreeMargin();
    var defaultPair = FX.App.pairList.length > 0 ? FX.App.pairList[0].symbol : 'EUR/USD';
    var defaultRate = FX.App.rates[defaultPair];

    var html = '';

    html += '<div class="grid-3" style="margin-bottom:24px">' +
      '<div class="card">' +
        '<div class="card-title">Balance</div>' +
        '<div class="card-value">' + FX.App.formatUSD(balance) + '</div>' +
        '<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Margin Used: ' + FX.App.formatUSD(marginUsed) + '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title">Equity</div>' +
        '<div class="card-value">' + FX.App.formatUSD(equity) + '</div>' +
        '<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Free Margin: ' + FX.App.formatUSD(freeMargin) + '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-title">Open Positions</div>' +
        '<div class="card-value">' + positions.length + '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="card" style="margin-bottom:24px">' +
      '<div class="card-title" style="margin-bottom:16px">New Trade</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="modal-field">' +
          '<label>Pair</label>' +
          '<select class="input" id="trade-pair">';

    for (var i = 0; i < FX.App.pairList.length; i++) {
      var p = FX.App.pairList[i];
      html += '<option value="' + p.symbol + '">' + p.symbol + '</option>';
    }

    html += '</select>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Direction</label>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm btn-success" id="trade-buy" style="flex:1">Buy</button>' +
            '<button class="btn btn-sm btn-danger" id="trade-sell" style="flex:1">Sell</button>' +
          '</div>' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Size (units)</label>' +
          '<input type="number" class="input input-num" id="trade-size" value="1000" min="100" step="100">' +
        '</div>' +
        '<div class="modal-field">' +
          '<label>Market Price</label>' +
          '<div class="input input-num" id="trade-price" style="background:var(--surface-hover);cursor:default;display:flex;align-items:center;height:42px">' +
            (defaultRate ? FX.App.formatRate(defaultRate) : 'Loading...') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="card" style="margin-bottom:24px">' +
      '<div class="card-title" style="margin-bottom:16px">Open Positions</div>';

    if (positions.length === 0) {
      html += '<div class="empty-state"><h3>No Open Positions</h3><p>Open a trade to see it here</p></div>';
    } else {
      html += '<div class="position-grid">';

      for (var i = 0; i < positions.length; i++) {
        var pos = positions[i];
        var currentPrice = FX.App.rates[pos.pair] || pos.currentPrice;
        var pnl = FX.Trading.calculatePnL(pos, currentPrice);
        var pnlClass = pnl >= 0 ? 'up' : 'down';
        var sideClass = pos.side;

        html += '<div class="position-card">' +
          '<div class="pos-header">' +
            '<span class="pos-pair">' + pos.pair + '</span>' +
            '<span class="pos-side ' + sideClass + '">' + pos.side.toUpperCase() + '</span>' +
          '</div>' +
          '<div class="pos-details">' +
            '<span><span class="pos-label">Size</span><span class="pos-value">' + pos.size.toLocaleString() + '</span></span>' +
            '<span><span class="pos-label">Entry</span><span class="pos-value">' + FX.App.formatRate(pos.entryPrice) + '</span></span>' +
            '<span><span class="pos-label">Current</span><span class="pos-value">' + FX.App.formatRate(currentPrice) + '</span></span>' +
            '<span><span class="pos-label">P&amp;L</span><span class="pos-value ' + pnlClass + '">' + (pnl >= 0 ? '+' : '') + FX.App.formatUSD(pnl) + '</span></span>' +
          '</div>' +
          '<div class="pos-actions">' +
            '<button class="btn btn-sm btn-danger pos-close" data-id="' + pos.id + '">Close</button>' +
          '</div>' +
        '</div>';
      }

      html += '</div>';
    }

    html += '</div>';

    html += '<div class="card">' +
      '<div class="card-title" style="margin-bottom:16px">Trade History</div>';

    if (history.length === 0) {
      html += '<div class="empty-state"><h3>No Trade History</h3><p>Closed trades will appear here</p></div>';
    } else {
      var sorted = history.slice().sort(function(a, b) {
        return new Date(b.closeTimestamp) - new Date(a.closeTimestamp);
      });

      html += '<div class="table-wrap"><table>' +
        '<thead><tr>' +
          '<th>Date</th><th>Pair</th><th>Side</th><th>Size</th><th>Entry</th><th>Exit</th><th>Profit</th>' +
        '</tr></thead><tbody>';

      for (var i = 0; i < sorted.length; i++) {
        var h = sorted[i];
        var profitClass = h.profit >= 0 ? 'up' : 'down';

        html += '<tr>' +
          '<td>' + new Date(h.closeTimestamp).toLocaleDateString() + '</td>' +
          '<td><span class="pair-name" style="font-size:13px">' + h.pair + '</span></td>' +
          '<td><span class="trade-side ' + h.side + '">' + h.side.toUpperCase() + '</span></td>' +
          '<td class="num">' + h.size.toLocaleString() + '</td>' +
          '<td class="num">' + FX.App.formatRate(h.entryPrice) + '</td>' +
          '<td class="num">' + FX.App.formatRate(h.exitPrice) + '</td>' +
          '<td class="num ' + profitClass + '">' + (h.profit >= 0 ? '+' : '') + FX.App.formatUSD(h.profit) + '</td>' +
        '</tr>';
      }

      html += '</tbody></table></div>';
    }

    html += '</div>';

    FX.App.render(html);
    bindEvents();
  }

  function bindEvents() {
    var pairSelect = document.getElementById('trade-pair');
    var priceDisplay = document.getElementById('trade-price');
    var buyBtn = document.getElementById('trade-buy');
    var sellBtn = document.getElementById('trade-sell');
    var sizeInput = document.getElementById('trade-size');

    if (pairSelect) {
      pairSelect.addEventListener('change', function() {
        var rate = FX.App.rates[this.value];
        if (priceDisplay) {
          priceDisplay.textContent = rate ? FX.App.formatRate(rate) : 'N/A';
        }
      });
    }

    function openTrade(side) {
      var pair = pairSelect ? pairSelect.value : FX.App.pairList[0].symbol;
      var size = sizeInput ? parseInt(sizeInput.value, 10) : 1000;
      var rate = FX.App.rates[pair];

      if (!rate) {
        showFeedback('Market price not available for ' + pair, 'error');
        return;
      }

      if (!size || size < 100) {
        showFeedback('Size must be at least 100 units', 'error');
        return;
      }

      var result = FX.Trading.openPosition(pair, side, size, rate);
      if (result) {
        showFeedback((side === 'buy' ? 'Buy' : 'Sell') + ' order opened: ' + pair, 'success');
        render();
      } else {
        showFeedback('Insufficient balance for this trade', 'error');
      }
    }

    if (buyBtn) {
      buyBtn.addEventListener('click', function() { openTrade('buy'); });
    }

    if (sellBtn) {
      sellBtn.addEventListener('click', function() { openTrade('sell'); });
    }

    var closeButtons = document.querySelectorAll('.pos-close');
    for (var i = 0; i < closeButtons.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var id = parseInt(btn.getAttribute('data-id'), 10);
          var positions = FX.Trading.getPositions();
          var position = null;
          for (var j = 0; j < positions.length; j++) {
            if (positions[j].id === id) {
              position = positions[j];
              break;
            }
          }
          if (!position) return;

          var rate = FX.App.rates[position.pair];
          if (!rate) {
            showFeedback('Market price not available for ' + position.pair, 'error');
            return;
          }

          FX.Trading.closePosition(id, rate);
          showFeedback('Position closed', 'success');
          render();
        });
      })(closeButtons[i]);
    }
  }

  FX.TradingUI = {
    render: render
  };
})();

window.FX = window.FX || {};

(function() {
  var chartWidget = null;
  var currentSymbol = 'FX:EURUSD';

  /* Convert pair string to TradingView symbol */
  function toTvSymbol(pair) {
    return 'FX:' + pair.replace('/', '');
  }

  /* Convert our timeframe label to TradingView interval */
  function toTvInterval(tf) {
    switch (tf) {
      case '1D': return '5';
      case '1W': return '60';
      case '1M': return '240';
      case '3M': return 'D';
      case '1Y': return 'W';
      default: return '60';
    }
  }

  function destroyWidget() {
    if (chartWidget) {
      try { chartWidget.remove(); } catch(e) {}
      chartWidget = null;
    }
  }

  function createWidget(symbol, interval) {
    var container = document.getElementById('tv-chart-container');
    if (!container) return;
    container.innerHTML = '';

    chartWidget = new TradingView.widget({
      container_id: 'tv-chart-container',
      symbol: symbol,
      interval: interval,
      timezone: 'exchange',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#161b24',
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      details: true,
      hotlist: true,
      calendar: true,
      studies: ['STD;MACD'],
      width: '100%',
      height: '100%',
      backgroundColor: '#161b24',
      gridColor: '#222a38',
      crosshair_color: '#8b95a5',
      save_image: false,
      overrides: {
        'paneProperties.background': '#161b24',
        'paneProperties.vertGridProperties.color': '#222a38',
        'paneProperties.horzGridProperties.color': '#222a38',
        'paneProperties.crossHairProperties.color': '#8b95a5',
        'scalesProperties.textColor': '#8b95a5',
        'scalesProperties.lineColor': '#222a38'
      }
    });

    return chartWidget;
  }

  function render() {
    var pairs = FX.App.pairList || [];
    if (pairs.length === 0) {
      FX.App.render('<div class="empty-state"><h3>No data</h3><p>Market data not available</p></div>');
      return;
    }

    var html = '';
    html += '<div class="page">';

    /* Controls row */
    html += '<div class="chart-controls">';
    html += '<div style="display:flex;align-items:center;gap:12px">';
    html +=   '<button class="btn btn-outline" id="chart-fullscreen" style="padding:8px 14px">';
    html +=     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    html +=   '</button>';
    html += '</div>';
    html += '</div>';

    /* Chart container */
    html += '<div class="tv-chart-box">';
    html +=   '<div id="tv-chart-container" class="tv-chart-container"><div class="tv-loading">Loading TradingView chart...</div></div>';
    html += '</div>';

    html += '</div>';

    FX.App.render(html);

    /* Load TradingView widget */
    if (typeof TradingView !== 'undefined') {
      currentSymbol = toTvSymbol(pairs[0]);
      createWidget(currentSymbol, '60');
    }

    /* Fullscreen toggle */
    var fsBtn = document.getElementById('chart-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', function() {
        var box = document.querySelector('.tv-chart-box');
        if (!box) return;
        if (box.classList.contains('tv-fullscreen')) {
          box.classList.remove('tv-fullscreen');
          fsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
        } else {
          box.classList.add('tv-fullscreen');
          fsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m0 0h5M8 21v-3a2 2 0 0 1 2-2h3m-3 3v3m10-10h-5m5 0v3m0-3V8"/></svg>';
        }
        /* Refresh widget to fill new size */
        if (chartWidget) {
          setTimeout(function() {
            try { chartWidget.resize(); } catch(e) {}
          }, 300);
        }
      });
    }
  }

  FX.Charts = {
    render: render,
    destroy: function() {
      destroyWidget();
    }
  };
})();

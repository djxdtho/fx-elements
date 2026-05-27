window.FX = window.FX || {};

(function() {
  var COLORS = {
    bg: '#161b24',
    grid: '#222a38',
    text: '#8b95a5',
    accent: '#b8944c',
    green: '#22c55e',
    red: '#ef4444',
    accentDim: 'rgba(184,148,76,0.3)',
    accentClear: 'rgba(184,148,76,0)'
  };

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  FX.Charts = {
    currentPair: null,
    currentTF: '1W',
    currentType: 'line',
    canvas: null,
    ctx: null,
    container: null,
    resizeObserver: null,
    _cache: {},
    _state: null,

    getDatesRange: function(timeframe) {
      var end = new Date();
      var start = new Date();
      switch (timeframe) {
        case '1D': start.setDate(end.getDate() - 5); break;
        case '1W': start.setDate(end.getDate() - 7); break;
        case '1M': start.setDate(end.getDate() - 30); break;
        case '3M': start.setDate(end.getDate() - 90); break;
        case '1Y': start.setDate(end.getDate() - 365); break;
        default: start.setDate(end.getDate() - 7);
      }
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10)
      };
    },

    handleResize: function() {
      if (!this.currentPair) return;
      var key = this.currentPair + '|' + this.currentTF;
      if (this._cache[key]) {
        this._drawCached(key);
      }
    },

    _cacheKey: function() {
      return this.currentPair + '|' + this.currentTF;
    },

    _drawCached: function(key) {
      var cached = this._cache[key];
      if (!cached) return;
      this.sizeCanvas();
      if (this.currentType === 'candle') {
        this._drawCandleChart(cached.data, cached.pair);
      } else {
        this._drawLineChart(cached.data, cached.pair);
      }
    },

    render: function() {
      var self = this;
      var pairList = FX.App.pairList || [];
      if (pairList.length === 0) return;

      var html = '<div class="page">';

      html += '<div style="display:flex;align-items:baseline;gap:16px;margin-bottom:16px">';
      html += '<span id="chart-price" style="font-family:var(--font-num);font-size:32px;font-weight:700">\u2014</span>';
      html += '<span id="chart-change" style="font-family:var(--font-num);font-size:16px;font-weight:600">\u2014</span>';
      html += '</div>';

      html += '<div class="chart-controls">';
      html += '<select class="input" id="chart-pair" style="width:140px">';
      for (var i = 0; i < pairList.length; i++) {
        var sel = pairList[i] === 'EUR/USD' ? ' selected' : '';
        html += '<option value="' + pairList[i] + '"' + sel + '>' + pairList[i] + '</option>';
      }
      html += '</select>';
      html += '<div class="tabs" id="chart-tf">';
      html += '<button class="tab" data-tf="1D">1D</button>';
      html += '<button class="tab active" data-tf="1W">1W</button>';
      html += '<button class="tab" data-tf="1M">1M</button>';
      html += '<button class="tab" data-tf="3M">3M</button>';
      html += '<button class="tab" data-tf="1Y">1Y</button>';
      html += '</div>';
      html += '<div class="tabs" id="chart-type">';
      html += '<button class="tab active" data-type="line">Line</button>';
      html += '<button class="tab" data-type="candle">Candle</button>';
      html += '</div>';
      html += '</div>';

      html += '<div class="chart-container" id="chart-wrap">';
      html += '<canvas id="chart-canvas"></canvas>';
      html += '</div>';

      html += '</div>';

      FX.App.render(html);

      this.canvas = document.getElementById('chart-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.container = document.getElementById('chart-wrap');

      this.currentPair = pairList[0] || 'EUR/USD';

      var pairSel = document.getElementById('chart-pair');
      if (pairSel) {
        this.currentPair = pairSel.value;
        pairSel.addEventListener('change', function() {
          self.currentPair = pairSel.value;
          self.drawChart(self.currentPair, self.currentTF, self.currentType);
        });
      }

      var tfTabs = document.querySelectorAll('#chart-tf .tab');
      for (var j = 0; j < tfTabs.length; j++) {
        (function(tab) {
          tab.addEventListener('click', function() {
            var all = document.querySelectorAll('#chart-tf .tab');
            for (var t = 0; t < all.length; t++) all[t].classList.remove('active');
            tab.classList.add('active');
            self.currentTF = tab.getAttribute('data-tf');
            self.drawChart(self.currentPair, self.currentTF, self.currentType);
          });
        })(tfTabs[j]);
      }

      var typeTabs = document.querySelectorAll('#chart-type .tab');
      for (var k = 0; k < typeTabs.length; k++) {
        (function(tab) {
          tab.addEventListener('click', function() {
            var all = document.querySelectorAll('#chart-type .tab');
            for (var t = 0; t < all.length; t++) all[t].classList.remove('active');
            tab.classList.add('active');
            self.currentType = tab.getAttribute('data-type');
            self._drawCached(self._cacheKey());
          });
        })(typeTabs[k]);
      }

      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.resizeObserver = new ResizeObserver(function() { self.handleResize(); });
      this.resizeObserver.observe(this.container);

      this.drawChart(this.currentPair, this.currentTF, this.currentType);
    },

    drawChart: function(pair, timeframe, type) {
      var self = this;
      var range = this.getDatesRange(timeframe);
      var parts = pair.split('/');
      var from = parts[0].trim();
      var to = parts[1].trim();

      FX.API.getHistory(from, to, range.startDate, range.endDate).then(function(data) {
        if (!data || !data.rates) return;

        var dates = Object.keys(data.rates).sort();
        var points = [];
        for (var i = 0; i < dates.length; i++) {
          var rate = data.rates[dates[i]][to];
          if (rate != null) {
            points.push({ date: dates[i], close: rate });
          }
        }

        if (points.length === 0) return;

        var last = points[points.length - 1].close;
        var first = points[0].close;
        var pctChange = first !== 0 ? ((last - first) / first) * 100 : 0;

        var priceEl = document.getElementById('chart-price');
        var changeEl = document.getElementById('chart-change');
        if (priceEl) priceEl.textContent = FX.App.formatRate(last);
        if (changeEl) {
          var sign = pctChange >= 0 ? '+' : '';
          changeEl.textContent = sign + FX.App.formatChange(Math.abs(pctChange));
          changeEl.className = pctChange >= 0 ? 'up' : 'down';
        }

        var key = pair + '|' + timeframe;
        self._cache[key] = { data: points, pair: pair };

        self.sizeCanvas();
        if (type === 'candle') {
          self._drawCandleChart(points, pair);
        } else {
          self._drawLineChart(points, pair);
        }
      });
    },

    sizeCanvas: function() {
      var rect = this.container.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    _getCanvasSize: function() {
      var dpr = window.devicePixelRatio || 1;
      return {
        w: this.canvas.width / dpr,
        h: this.canvas.height / dpr
      };
    },

    _drawLineChart: function(data, pair) {
      var self = this;
      var ctx = this.ctx;
      var size = this._getCanvasSize();
      var W = size.w, H = size.h;
      var pad = { top: 30, right: 20, bottom: 40, left: 70 };
      var chartW = W - pad.left - pad.right;
      var chartH = H - pad.top - pad.bottom;

      if (chartW <= 0 || chartH <= 0 || data.length < 2) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = COLORS.text;
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Not enough data', W / 2, H / 2);
        return;
      }

      var min = Infinity, max = -Infinity;
      for (var i = 0; i < data.length; i++) {
        var v = data[i].close;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      var range = max - min;
      if (range === 0) range = min * 0.01 || 0.01;
      var yMin = min - range * 0.1;
      var yMax = max + range * 0.1;
      var yRange = yMax - yMin;
      var stepX = chartW / (data.length - 1);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      var gridCount = 5;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (var g = 0; g <= gridCount; g++) {
        var gy = pad.top + (chartH / gridCount) * g;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(W - pad.right, gy);
        ctx.stroke();

        var val = yMax - (yRange / gridCount) * g;
        ctx.fillStyle = COLORS.text;
        ctx.font = '11px "Space Grotesk", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(5), pad.left - 8, gy + 4);
      }

      // X axis labels
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      var labelCount = Math.min(6, data.length);
      var labelStep = Math.max(1, Math.floor(data.length / labelCount));
      for (var l = 0; l < data.length; l += labelStep) {
        var lx = pad.left + l * stepX;
        var d = new Date(data[l].date);
        ctx.fillText(MONTHS[d.getMonth()] + ' ' + d.getDate(), lx, pad.top + chartH + 20);
      }

      // Precompute coords for crosshair
      var coords = [];
      for (var c = 0; c < data.length; c++) {
        var cx = pad.left + c * stepX;
        var cy = pad.top + chartH - ((data[c].close - yMin) / yRange) * chartH;
        coords.push({ x: cx, y: cy, date: data[c].date, value: data[c].close });
      }

      // Gradient fill
      var gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      gradient.addColorStop(0, COLORS.accentDim);
      gradient.addColorStop(1, COLORS.accentClear);
      ctx.beginPath();
      ctx.moveTo(coords[0].x, pad.top + chartH);
      for (var f = 0; f < coords.length; f++) {
        ctx.lineTo(coords[f].x, coords[f].y);
      }
      ctx.lineTo(coords[coords.length - 1].x, pad.top + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      for (var n = 1; n < coords.length; n++) {
        ctx.lineTo(coords[n].x, coords[n].y);
      }
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Store state for crosshair
      this._state = {
        type: 'line',
        coords: coords,
        pad: pad,
        chartH: chartH,
        chartW: chartW,
        W: W,
        H: H,
        data: data,
        pair: pair
      };

      this._bindCrosshair();
    },

    _drawCandleChart: function(data, pair) {
      var self = this;
      var ctx = this.ctx;
      var size = this._getCanvasSize();
      var W = size.w, H = size.h;
      var pad = { top: 30, right: 20, bottom: 40, left: 70 };
      var chartW = W - pad.left - pad.right;
      var chartH = H - pad.top - pad.bottom;

      if (chartW <= 0 || chartH <= 0 || data.length < 2) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = COLORS.text;
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Not enough data', W / 2, H / 2);
        return;
      }

      // Simulate OHLC
      var candles = [];
      for (var i = 0; i < data.length; i++) {
        var close = data[i].close;
        var open = i === 0 ? close : data[i - 1].close;
        var high = close * (1 + 0.002 * Math.random());
        var low = close * (1 - 0.002 * Math.random());
        if (high < low) { var tmp = high; high = low; low = tmp; }
        if (high < open) high = open;
        if (high < close) high = close;
        if (low > open) low = open;
        if (low > close) low = close;
        candles.push({ open: open, high: high, low: low, close: close, date: data[i].date });
      }

      var min = Infinity, max = -Infinity;
      for (var j = 0; j < candles.length; j++) {
        if (candles[j].high > max) max = candles[j].high;
        if (candles[j].low < min) min = candles[j].low;
      }
      var range = max - min;
      if (range === 0) range = min * 0.01 || 0.01;
      var yMin = min - range * 0.1;
      var yMax = max + range * 0.1;
      var yRange = yMax - yMin;
      var totalW = chartW;
      var candleW = Math.max(2, totalW / candles.length * 0.6);
      var gap = totalW / candles.length;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      var gridCount = 5;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (var g = 0; g <= gridCount; g++) {
        var gy = pad.top + (chartH / gridCount) * g;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(W - pad.right, gy);
        ctx.stroke();

        var val = yMax - (yRange / gridCount) * g;
        ctx.fillStyle = COLORS.text;
        ctx.font = '11px "Space Grotesk", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(5), pad.left - 8, gy + 4);
      }

      // X axis labels
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      var labelCount = Math.min(6, candles.length);
      var labelStep = Math.max(1, Math.floor(candles.length / labelCount));
      for (var l = 0; l < candles.length; l += labelStep) {
        var lx = pad.left + l * gap + gap / 2;
        var d = new Date(candles[l].date);
        ctx.fillText(MONTHS[d.getMonth()] + ' ' + d.getDate(), lx, pad.top + chartH + 20);
      }

      // Precompute coords for crosshair
      var coords = [];
      for (var c = 0; c < candles.length; c++) {
        var candle = candles[c];
        var cx = pad.left + c * gap + gap / 2;
        var openY = pad.top + chartH - ((candle.open - yMin) / yRange) * chartH;
        var closeY = pad.top + chartH - ((candle.close - yMin) / yRange) * chartH;
        var highY = pad.top + chartH - ((candle.high - yMin) / yRange) * chartH;
        var lowY = pad.top + chartH - ((candle.low - yMin) / yRange) * chartH;
        var isUp = candle.close >= candle.open;
        var wickX = cx;
        var bodyTop = Math.min(openY, closeY);
        var bodyBot = Math.max(openY, closeY);
        var bodyH = Math.max(1, bodyBot - bodyTop);
        var halfW = Math.max(1, candleW / 2);

        // Wick
        ctx.strokeStyle = isUp ? COLORS.green : COLORS.red;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wickX, highY);
        ctx.lineTo(wickX, lowY);
        ctx.stroke();

        // Body
        ctx.fillStyle = isUp ? COLORS.green : COLORS.red;
        ctx.fillRect(cx - halfW, bodyTop, candleW, bodyH);

        coords.push({
          x: cx,
          date: candle.date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        });
      }

      this._state = {
        type: 'candle',
        coords: coords,
        pad: pad,
        chartH: chartH,
        chartW: chartW,
        W: W,
        H: H,
        data: candles,
        pair: pair
      };

      this._bindCrosshair();
    },

    _bindCrosshair: function() {
      var self = this;
      var canvas = this.canvas;

      canvas.onmousemove = function(e) {
        if (!self._state) return;
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        self._drawCrosshair(mx, my);
      };

      canvas.onmouseleave = function() {
        if (!self._state) return;
        self._redrawChart();
      };
    },

    _redrawChart: function() {
      if (!this._state) return;
      this.sizeCanvas();
      if (this._state.type === 'candle') {
        this._drawCandleChart(this._state.data, this._state.pair);
      } else {
        this._drawLineChart(this._state.data, this._state.pair);
      }
    },

    _drawCrosshair: function(mx, my) {
      var self = this;
      if (!this._state) return;
      var state = this._state;
      var ctx = this.ctx;
      var size = this._getCanvasSize();
      var W = size.w, H = size.h;

      // Redraw base chart
      this._redrawChart();

      var coords = state.coords;
      var pad = state.pad;
      var chartH = state.chartH;

      // Find nearest point
      var nearest = null;
      var minDist = Infinity;
      for (var i = 0; i < coords.length; i++) {
        var dist = Math.abs(coords[i].x - mx);
        if (dist < minDist) {
          minDist = dist;
          nearest = coords[i];
        }
      }
      if (!nearest) return;

      var cx = nearest.x;
      var cy = nearest.y;

      // Vertical line
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(139,149,165,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + chartH);
      ctx.stroke();

      // Horizontal line
      if (cy != null) {
        ctx.beginPath();
        ctx.moveTo(pad.left, cy);
        ctx.lineTo(W - pad.right, cy);
        ctx.stroke();
      }
      ctx.restore();

      // Dot on the line
      if (cy != null) {
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.accent;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Tooltip
      var tooltipX = cx + 12;
      var tooltipY = cy != null ? cy - 12 : pad.top + chartH / 2;
      if (tooltipX + 140 > W - pad.right) tooltipX = cx - 150;
      if (tooltipY - 10 < pad.top) tooltipY = pad.top + 10;
      if (tooltipY + 10 > pad.top + chartH) tooltipY = pad.top + chartH - 10;

      var tooltipLines = [];
      var d = new Date(nearest.date);
      var dateStr = MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
      tooltipLines.push(dateStr);

      if (state.type === 'line') {
        tooltipLines.push('Rate: ' + FX.App.formatRate(nearest.value));
      } else {
        tooltipLines.push('O: ' + FX.App.formatRate(nearest.open));
        tooltipLines.push('H: ' + FX.App.formatRate(nearest.high));
        tooltipLines.push('L: ' + FX.App.formatRate(nearest.low));
        tooltipLines.push('C: ' + FX.App.formatRate(nearest.close));
      }

      var lineH = 18;
      var tipW = 130;
      var tipH = tooltipLines.length * lineH + 10;
      var tipX = tooltipX;
      var tipY = tooltipY - tipH - 8;

      if (tipX + tipW + 10 > W) tipX = W - tipW - 10;
      if (tipX < 10) tipX = 10;
      if (tipY < pad.top) tipY = tooltipY + 8;

      ctx.fillStyle = 'rgba(22,27,36,0.95)';
      ctx.strokeStyle = COLORS.border || '#222a38';
      ctx.lineWidth = 1;
      roundRect(ctx, tipX, tipY, tipW, tipH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      for (var t = 0; t < tooltipLines.length; t++) {
        var isLabel = tooltipLines[t].indexOf(':') > -1;
        if (isLabel) {
          var parts = tooltipLines[t].split(':');
          ctx.fillStyle = COLORS.textDim || '#8b95a5';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText(parts[0] + ':', tipX + 8, tipY + 14 + t * lineH);
          ctx.fillStyle = COLORS.text;
          ctx.font = '11px "Space Grotesk", monospace';
          ctx.fillText(parts[1], tipX + 40, tipY + 14 + t * lineH);
        } else {
          ctx.fillStyle = COLORS.accent;
          ctx.font = '11px Inter, sans-serif';
          ctx.fillText(tooltipLines[t], tipX + 8, tipY + 14 + t * lineH);
        }
      }
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
})();

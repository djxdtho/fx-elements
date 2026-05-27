window.FX = window.FX || {};

(function() {
  var SPARK_COLORS = {
    up: '34,197,94',
    down: '239,68,68',
    neutral: '184,148,76'
  };

  function generateSparkPoints(seed, count, width, height) {
    var points = [];
    var hCenter = height / 2;
    var amplitude = height * 0.35;
    var val = 0;

    for (var i = 0; i < count; i++) {
      var x = (i / (count - 1)) * width;
      seed = (seed * 9301 + 49297) % 233280;
      var r = seed / 233280;
      val += (r - 0.5) * 0.5;
      val = Math.max(-1, Math.min(1, val));
      var y = hCenter + val * amplitude;
      points.push({ x: x, y: y });
    }

    return points;
  }

  function drawSparkline(canvas, points, rgb) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length - 1; i++) {
      var xc = (points[i].x + points[i + 1].x) / 2;
      var yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    if (points.length > 1) {
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }

    ctx.strokeStyle = 'rgba(' + rgb + ',0.85)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.lineTo(points[points.length - 1].x, h);
    ctx.lineTo(points[0].x, h);
    ctx.closePath();

    var gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(' + rgb + ',0.18)');
    gradient.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function getSparkRGB(change) {
    if (change > 0) return SPARK_COLORS.up;
    if (change < 0) return SPARK_COLORS.down;
    return SPARK_COLORS.neutral;
  }

  function seedFromPair(pair) {
    var hash = 0;
    for (var i = 0; i < pair.length; i++) {
      hash = ((hash << 5) - hash) + pair.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) + 1;
  }

  FX.Dashboard = {
    _initialized: false,
    _tickerHtml: '',

    init: function() {
      if (this._initialized) return;
      this._initialized = true;

      var self = this;
      setTimeout(function() {
        FX.App.refreshRates();
      }, 100);
    },

    render: function() {
      var html = this._buildTicker();
      html += this._buildMarketGrid();
      html += this._buildAccountSummary();
      FX.App.render(html);

      this._renderSparklines();
    },

    _buildTicker: function() {
      var itemsHtml = '';
      var pairs = FX.App.pairList;
      var rates = FX.App.rates;

      for (var d = 0; d < 2; d++) {
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i];
          var rate = rates[pair];
          var change = 0;
          itemsHtml +=
            '<span class="ticker-item">' +
              '<span class="t-rate">' + pair + ' ' + FX.App.formatRate(rate, pair) + '</span>' +
              '<span class="t-change">' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%</span>' +
            '</span>';
        }
      }

      return (
        '<div class="ticker-wrap">' +
          '<div class="ticker">' + itemsHtml + '</div>' +
        '</div>'
      );
    },

    _buildMarketGrid: function() {
      var html = '<h2 style="margin-bottom:16px;font-size:18px;font-weight:600;">Market Overview</h2>';
      html += '<div class="grid-3">';

      var pairs = FX.App.pairList;
      var rates = FX.App.rates;

      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        var rate = rates[pair];
        var prev = FX.App._prevRates ? FX.App._prevRates[pair] : null;
        var change = 0;
        if (rate != null && prev != null && prev !== 0) {
          change = (rate - prev) / prev * 100;
        }
        var changeHtml = FX.App.formatChange(change);
        var formattedRate = FX.App.formatRate(rate, pair);

        html +=
          '<div class="card card-hover" data-pair="' + pair + '">' +
            '<div class="card-header">' +
              '<span class="card-title">' + pair + '</span>' +
              changeHtml +
            '</div>' +
            '<div class="card-value">' + formattedRate + '</div>' +
            '<canvas class="sparkline-el" width="280" height="48" data-pair="' + pair + '" style="width:100%;height:48px;margin-top:10px;border-radius:4px;"></canvas>' +
          '</div>';
      }

      html += '</div>';
      return html;
    },

    _buildAccountSummary: function() {
      var balance = 10000;
      var equity = 10000;
      var openPositions = 0;
      var marginUsed = 0;

      if (typeof FX.Trading !== 'undefined') {
        balance = FX.Trading.getBalance();
        equity = FX.Trading.getEquity();
        var positions = FX.Trading.getPositions();
        openPositions = positions ? positions.length : 0;
        marginUsed = FX.Trading.getMarginUsed();
      }

      var html = '<h2 style="margin:28px 0 16px;font-size:18px;font-weight:600;">Account Summary</h2>';
      html += '<div class="grid-4">';

      html +=
        '<div class="card">' +
          '<div class="card-title">Balance</div>' +
          '<div class="card-value" style="color:var(--accent);">' + FX.App.formatUSD(balance) + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-title">Equity</div>' +
          '<div class="card-value">' + FX.App.formatUSD(equity) + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-title">Open Positions</div>' +
          '<div class="card-value">' + openPositions + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-title">Margin Used</div>' +
          '<div class="card-value">' + FX.App.formatUSD(marginUsed) + '</div>' +
        '</div>';

      html += '</div>';
      return html;
    },

    _renderSparklines: function() {
      var self = this;
      setTimeout(function() {
        var canvases = document.querySelectorAll('.sparkline-el');
        for (var i = 0; i < canvases.length; i++) {
          var canvas = canvases[i];
          var pair = canvas.getAttribute('data-pair');
          var seed = seedFromPair(pair);
          var prev = FX.App._prevRates ? FX.App._prevRates[pair] : null;
          var rate = FX.App.rates[pair];
          var change = 0;
          if (rate != null && prev != null && prev !== 0) {
            change = (rate - prev) / prev * 100;
          }
          var rgb = getSparkRGB(change);
          var w = canvas.width;
          var h = canvas.height;
          var points = generateSparkPoints(seed, 24, w, h);
          drawSparkline(canvas, points, rgb);
        }

        /* Click pair card → open trading page with that pair */
        var cards = document.querySelectorAll('.card[data-pair]');
        for (var c = 0; c < cards.length; c++) {
          (function(card) {
            card.addEventListener('click', function() {
              var pair = card.getAttribute('data-pair');
              FX.App._pendingPair = pair;
              location.hash = '#trade';
            });
          })(cards[c]);
        }
      }, 50);
    }
  };
})();

window.FX = window.FX || {};

(function() {
  var STORAGE_KEY = 'fx_conversions';
  var MAX_HISTORY = 10;

  function getHistory() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveConversion(record) {
    var history = getHistory();
    history.unshift(record);
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {}
    return history;
  }

  function buildCurrencyOptions(selected) {
    var currencies = FX.App.currencies;
    var html = '';
    var codes = Object.keys(currencies);

    var ordered = [];
    var priority = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY', 'HKD', 'SGD', 'SEK', 'NOK', 'MXN', 'ZAR'];
    for (var p = 0; p < priority.length; p++) {
      if (codes.indexOf(priority[p]) !== -1) {
        ordered.push(priority[p]);
      }
    }
    for (var c = 0; c < codes.length; c++) {
      if (ordered.indexOf(codes[c]) === -1) {
        ordered.push(codes[c]);
      }
    }

    for (var i = 0; i < ordered.length; i++) {
      var code = ordered[i];
      var name = currencies[code] || code;
      var sel = code === selected ? ' selected' : '';
      html += '<option value="' + code + '"' + sel + '>' + code + ' - ' + name + '</option>';
    }

    return html;
  }

  function buildHistoryHTML() {
    var history = getHistory();
    if (history.length === 0) {
      return (
        '<div class="empty-state">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
          '<h3>No conversions yet</h3>' +
          '<p>Your recent conversions will appear here.</p>' +
        '</div>'
      );
    }

    var html = '';
    for (var i = 0; i < history.length; i++) {
      var h = history[i];
      html +=
        '<div class="pair-row" style="font-size:13px;">' +
          '<span class="pair-name">' + h.from + ' \u2192 ' + h.to + '</span>' +
          '<span class="pair-rate">' + FX.App.formatUSD(h.result) + '</span>' +
          '<span class="pair-change" style="color:var(--text-dim);font-size:12px;">@ ' + h.rate.toFixed(5) + '</span>' +
        '</div>';
    }

    return (
      '<div class="card" style="overflow:hidden;padding:0;">' +
        '<div style="padding:14px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">History</div>' +
        html +
      '</div>'
    );
  }

  FX.Converter = {
    _fromCurrency: 'USD',
    _toCurrency: 'EUR',
    _amount: 1,

    render: function() {
      var html = this._buildConverterUI();
      FX.App.render(html);

      this._attachEvents();
      this._updateRate();
    },

    _buildConverterUI: function() {
      var fromOpts = buildCurrencyOptions(this._fromCurrency);
      var toOpts = buildCurrencyOptions(this._toCurrency);
      var historyHtml = buildHistoryHTML();

      return (
        '<div class="converter-card">' +
          '<div class="card" style="padding:24px;">' +
            '<div class="card-title" style="margin-bottom:20px;">Currency Converter</div>' +

            '<div class="converter-row">' +
              '<div style="flex:1;">' +
                '<label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:500;">Amount</label>' +
                '<input type="number" id="conv-amount" class="input input-num" value="' + this._amount + '" min="0" step="any" style="width:100%;">' +
              '</div>' +
            '</div>' +

            '<div class="converter-row">' +
              '<div style="flex:1;">' +
                '<label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:500;">From</label>' +
                '<select id="conv-from" class="input">' + fromOpts + '</select>' +
              '</div>' +
              '<div style="display:flex;align-items:center;padding-top:18px;">' +
                '<button id="conv-swap" class="swap-btn" type="button" data-tooltip="Swap currencies">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<polyline points="17 1 21 5 17 9"/>' +
                    '<path d="M3 11V9a4 4 0 0 1 4-4h14"/>' +
                    '<polyline points="7 23 3 19 7 15"/>' +
                    '<path d="M21 13v2a4 4 0 0 1-4 4H3"/>' +
                  '</svg>' +
                '</button>' +
              '</div>' +
              '<div style="flex:1;">' +
                '<label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:500;">To</label>' +
                '<select id="conv-to" class="input">' + toOpts + '</select>' +
              '</div>' +
            '</div>' +

            '<div style="text-align:center;margin-top:16px;">' +
              '<button id="conv-convert" class="btn btn-primary" type="button">Convert</button>' +
            '</div>' +

            '<div id="conv-result" style="display:none;">' +
              '<div class="converter-rate" id="conv-rate-display"></div>' +
              '<div class="converter-result" id="conv-result-display"></div>' +
            '</div>' +
          '</div>' +

          '<div style="margin-top:20px;">' +
            historyHtml +
          '</div>' +
        '</div>'
      );
    },

    _attachEvents: function() {
      var self = this;

      var convertBtn = document.getElementById('conv-convert');
      if (convertBtn) {
        convertBtn.addEventListener('click', function() {
          self._doConvert();
        });
      }

      var swapBtn = document.getElementById('conv-swap');
      if (swapBtn) {
        swapBtn.addEventListener('click', function() {
          self._doSwap();
        });
      }

      var amountInput = document.getElementById('conv-amount');
      if (amountInput) {
        amountInput.addEventListener('input', function() {
          self._amount = parseFloat(this.value) || 1;
        });
        amountInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            self._doConvert();
          }
        });
      }

      var fromSelect = document.getElementById('conv-from');
      var toSelect = document.getElementById('conv-to');
      if (fromSelect) {
        fromSelect.addEventListener('change', function() {
          self._fromCurrency = this.value;
          self._updateRate();
        });
      }
      if (toSelect) {
        toSelect.addEventListener('change', function() {
          self._toCurrency = this.value;
          self._updateRate();
        });
      }
    },

    _doSwap: function() {
      var fromSelect = document.getElementById('conv-from');
      var toSelect = document.getElementById('conv-to');
      if (!fromSelect || !toSelect) return;

      var temp = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = temp;

      this._fromCurrency = fromSelect.value;
      this._toCurrency = toSelect.value;

      this._updateRate();

      var amountInput = document.getElementById('conv-amount');
      if (amountInput && parseFloat(amountInput.value) > 0) {
        this._amount = parseFloat(amountInput.value);
        this._doConvert();
      }
    },

    _updateRate: function() {
      var self = this;
      var rateDisplay = document.getElementById('conv-rate-display');
      var resultDisplay = document.getElementById('conv-result');

      if (rateDisplay) {
        rateDisplay.textContent = 'Fetching rate...';
      }

      FX.API.getRates(self._fromCurrency, self._toCurrency).then(function(data) {
        if (data && data.rates && data.rates[self._toCurrency] != null) {
          var rate = data.rates[self._toCurrency];
          if (rateDisplay) {
            rateDisplay.innerHTML = '1 ' + self._fromCurrency + ' = <strong>' + rate.toFixed(5) + '</strong> ' + self._toCurrency;
          }
        } else {
          if (rateDisplay) {
            rateDisplay.textContent = 'Rate unavailable';
          }
        }
      });
    },

    _doConvert: function() {
      var self = this;

      var fromSelect = document.getElementById('conv-from');
      var toSelect = document.getElementById('conv-to');
      var amountInput = document.getElementById('conv-amount');

      var from = fromSelect ? fromSelect.value : this._fromCurrency;
      var to = toSelect ? toSelect.value : this._toCurrency;
      var amount = amountInput ? (parseFloat(amountInput.value) || 1) : this._amount;

      this._fromCurrency = from;
      this._toCurrency = to;
      this._amount = amount;

      var resultDiv = document.getElementById('conv-result');
      var resultDisplay = document.getElementById('conv-result-display');
      var rateDisplay = document.getElementById('conv-rate-display');

      if (resultDiv) resultDiv.style.display = 'none';
      if (resultDisplay) resultDisplay.textContent = 'Converting...';

      FX.API.convert(amount, from, to).then(function(result) {
        if (result == null) {
          if (resultDisplay) resultDisplay.textContent = 'Conversion failed. Please try again.';
          if (resultDiv) resultDiv.style.display = 'block';
          return;
        }

        var rate = result / amount;

        if (rateDisplay) {
          rateDisplay.innerHTML = '1 ' + from + ' = <strong>' + rate.toFixed(5) + '</strong> ' + to;
        }
        if (resultDisplay) {
          resultDisplay.textContent = FX.App.formatUSD(result);
        }
        if (resultDiv) {
          resultDiv.style.display = 'block';
          resultDiv.style.animation = 'fadeIn 0.3s ease';
        }

        var record = {
          from: from,
          to: to,
          amount: amount,
          rate: rate,
          result: result,
          timestamp: new Date().toISOString()
        };

        saveConversion(record);
        self._refreshHistory();
      });
    },

    _refreshHistory: function() {
      var content = document.getElementById('page-content');
      if (!content) return;

      var existingHistory = content.querySelector('.converter-card > div:last-child');
      if (existingHistory) {
        existingHistory.outerHTML = '<div style="margin-top:20px;">' + buildHistoryHTML() + '</div>';
      }
    }
  };
})();

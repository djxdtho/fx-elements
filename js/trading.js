window.FX = window.FX || {};

(function() {
  var STORAGE_KEY = 'fx_trading';
  var CONTRACT = 100000;
  var DEFAULT = { balance: 10000, positions: [], history: [], nextId: 1, leverage: 100 };

  var JPY_PAIRS = ['USD/JPY', 'EUR/JPY', 'GBP/JPY'];

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || JSON.parse(JSON.stringify(DEFAULT));
    } catch(e) {
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* Parse pair and get from/to currencies */
  function parsePair(pair) {
    var parts = pair.split('/');
    return { from: parts[0], to: parts[1] };
  }

  /* Get the quote currency -> USD conversion rate */
  function quoteToUsd(quote, rates) {
    if (!rates) return 1;
    if (quote === 'USD') return 1;
    var direct = quote + '/USD';
    if (rates[direct]) return rates[direct];
    var inverse = 'USD/' + quote;
    if (rates[inverse]) return 1 / rates[inverse];
    /* Try via EUR cross */
    var eurQuote = 'EUR/' + quote;
    var eurUsd = 'EUR/USD';
    if (rates[eurQuote] && rates[eurUsd]) return rates[eurUsd] / rates[eurQuote];
    return 1;
  }

  /* Calculate pip value in account currency (USD) */
  function pipValue(pair, lots, rates) {
    var pip = JPY_PAIRS.indexOf(pair) !== -1 ? 0.01 : 0.0001;
    var pvQuote = pip * lots * CONTRACT;
    var q = parsePair(pair).to;
    var conv = quoteToUsd(q, rates);
    return pvQuote * conv;
  }

  /* Calculate required margin in USD */
  function requiredMargin(pair, lots, leverage, entryPrice, rates) {
    if (!entryPrice) entryPrice = 1;
    var p = parsePair(pair);
    var notional = lots * CONTRACT * entryPrice;
    var margin = notional / leverage;
    /* Convert margin from base currency to USD if needed */
    if (p.from !== 'USD') {
      var conv = 1 / quoteToUsd(p.from, rates);
      margin = margin * (1 / conv);
    }
    return margin;
  }

  /* Calculate P&L in USD given entry, exit, lots, pair */
  function calculatePnLAmount(entry, exit, lots, pair, side, rates) {
    if (entry == null || exit == null || entry === 0) return 0;
    var diff = side === 'buy' ? exit - entry : entry - exit;
    var pnlQuote = diff * lots * CONTRACT;
    var q = parsePair(pair).to;
    var conv = quoteToUsd(q, rates);
    return pnlQuote * conv;
  }

  FX.Trading = {
    getState: load,

    saveState: save,

    getBalance: function() {
      return load().balance;
    },

    getPositions: function() {
      return load().positions;
    },

    getHistory: function() {
      return load().history;
    },

    getLeverage: function() {
      return load().leverage;
    },

    setLeverage: function(lev) {
      var state = load();
      state.leverage = lev;
      save(state);
    },

    getEquity: function() {
      var state = load();
      var eq = state.balance;
      var rates = FX.App && FX.App.rates ? FX.App.rates : {};
      for (var i = 0; i < state.positions.length; i++) {
        var p = state.positions[i];
        var cp = rates[p.pair] || p.entryPrice;
        eq += calculatePnLAmount(p.entryPrice, cp, p.lots, p.pair, p.side, rates);
      }
      return eq;
    },

    getMarginUsed: function() {
      var state = load();
      var rates = FX.App && FX.App.rates ? FX.App.rates : {};
      var total = 0;
      for (var i = 0; i < state.positions.length; i++) {
        var p = state.positions[i];
        var cp = rates[p.pair] || p.entryPrice;
        total += requiredMargin(p.pair, p.lots, p.leverage, cp, rates);
      }
      return total;
    },

    getFreeMargin: function() {
      var balance = this.getBalance();
      var margin = this.getMarginUsed();
      var equity = this.getEquity();
      return Math.max(0, equity - margin);
    },

    getMarginLevel: function() {
      var margin = this.getMarginUsed();
      if (margin <= 0) return 0;
      return (this.getEquity() / margin) * 100;
    },

    calculateMargin: function(pair, lots, leverage) {
      var rates = FX.App && FX.App.rates ? FX.App.rates : {};
      var entryPrice = rates[pair] || 1;
      return requiredMargin(pair, lots, leverage || 100, entryPrice, rates);
    },

    calculatePipValue: function(pair, lots) {
      var rates = FX.App && FX.App.rates ? FX.App.rates : {};
      return pipValue(pair, lots, rates);
    },

    calculatePnL: function(position, currentPrice) {
      var rates = FX.App && FX.App.rates ? FX.App.rates : {};
      return calculatePnLAmount(position.entryPrice, currentPrice, position.lots, position.pair, position.side, rates);
    },

    openPosition: function(pair, side, lots, leverage, tp, sl) {
      var state = load();
      var rates = FX.App && FX.App.rates ? FX.App.rates : {};
      var entryPrice = rates[pair];
      if (!entryPrice) return { error: 'Price not available for ' + pair };
      if (!lots || lots <= 0) return { error: 'Invalid lot size' };
      if (lots > 50) return { error: 'Maximum 50 lots per trade' };

      leverage = leverage || state.leverage || 100;
      var margin = requiredMargin(pair, lots, leverage, entryPrice, rates);
      var equity = this.getEquity();

      if (margin > equity) return { error: 'Insufficient margin. Required: ' + FX.App.formatUSD(margin) + ', Free: ' + FX.App.formatUSD(equity - this.getMarginUsed()) };

      state.balance = equity - margin;
      var position = {
        id: state.nextId++,
        pair: pair,
        side: side,
        lots: lots,
        leverage: leverage,
        entryPrice: entryPrice,
        currentPrice: entryPrice,
        stopLoss: sl || null,
        takeProfit: tp || null,
        timestamp: new Date().toISOString()
      };
      state.positions.push(position);
      save(state);
      return { position: position };
    },

    closePosition: function(positionId) {
      var state = load();
      var rates = FX.App && FX.App.rates ? FX.App.rates : {};
      var idx = -1;
      for (var i = 0; i < state.positions.length; i++) {
        if (state.positions[i].id === positionId) { idx = i; break; }
      }
      if (idx === -1) return { error: 'Position not found' };
      var pos = state.positions[idx];
      var exitPrice = rates[pos.pair] || pos.currentPrice;
      var pnl = this.calculatePnL(pos, exitPrice);
      var margin = requiredMargin(pos.pair, pos.lots, pos.leverage, pos.entryPrice, rates);
      state.balance += margin + pnl;
      var record = {
        id: pos.id,
        pair: pos.pair,
        side: pos.side,
        lots: pos.lots,
        leverage: pos.leverage,
        entryPrice: pos.entryPrice,
        exitPrice: exitPrice,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        profit: pnl,
        timestamp: pos.timestamp,
        closeTimestamp: new Date().toISOString()
      };
      state.positions.splice(idx, 1);
      state.history.push(record);
      save(state);
      return { record: record };
    },

    modifyPosition: function(positionId, tp, sl) {
      var state = load();
      for (var i = 0; i < state.positions.length; i++) {
        if (state.positions[i].id === positionId) {
          if (tp !== undefined) state.positions[i].takeProfit = tp || null;
          if (sl !== undefined) state.positions[i].stopLoss = sl || null;
          save(state);
          return { position: state.positions[i] };
        }
      }
      return { error: 'Position not found' };
    },

    updatePrices: function(rates) {
      var state = load();
      var changed = false;
      for (var i = 0; i < state.positions.length; i++) {
        var p = state.positions[i];
        if (rates[p.pair] !== undefined) {
          p.currentPrice = rates[p.pair];
          changed = true;
        }
      }
      if (changed) save(state);
      /* Check TP/SL */
      this._checkTPSL(state, rates);
    },

    _checkTPSL: function(state, rates) {
      var toClose = [];
      for (var i = 0; i < state.positions.length; i++) {
        var p = state.positions[i];
        var cp = rates[p.pair];
        if (cp == null) continue;
        if (p.side === 'buy') {
          if (p.takeProfit != null && cp >= p.takeProfit) toClose.push({ id: p.id, reason: 'TP' });
          if (p.stopLoss != null && cp <= p.stopLoss) toClose.push({ id: p.id, reason: 'SL' });
        } else {
          if (p.takeProfit != null && cp <= p.takeProfit) toClose.push({ id: p.id, reason: 'TP' });
          if (p.stopLoss != null && cp >= p.stopLoss) toClose.push({ id: p.id, reason: 'SL' });
        }
      }
      for (var j = 0; j < toClose.length; j++) {
        this.closePosition(toClose[j].id);
      }
    },

    reset: function() {
      localStorage.removeItem(STORAGE_KEY);
    }
  };
})();

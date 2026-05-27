window.FX = window.FX || {};

(function() {
  const STORAGE_KEY = 'fx_trading';
  const DEFAULT = { balance: 10000, positions: [], history: [], nextId: 1 };

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || JSON.parse(JSON.stringify(DEFAULT));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  FX.Trading = {
    getState: load,

    saveState: save,

    openPosition(pair, side, size, entryPrice) {
      const state = load();
      const margin = size * entryPrice * 0.01;
      if (margin > state.balance) return null;
      state.balance -= margin;
      const position = {
        id: state.nextId++,
        pair,
        side,
        size,
        entryPrice,
        currentPrice: entryPrice,
        timestamp: new Date().toISOString()
      };
      state.positions.push(position);
      save(state);
      return position;
    },

    closePosition(positionId, exitPrice) {
      const state = load();
      const idx = state.positions.findIndex(p => p.id === positionId);
      if (idx === -1) return null;
      const position = state.positions[idx];
      const profit = this.calculatePnL(position, exitPrice);
      state.balance += profit + (position.size * position.entryPrice * 0.01);
      const record = {
        id: position.id,
        pair: position.pair,
        side: position.side,
        size: position.size,
        entryPrice: position.entryPrice,
        exitPrice,
        profit,
        timestamp: position.timestamp,
        closeTimestamp: new Date().toISOString()
      };
      state.positions.splice(idx, 1);
      state.history.push(record);
      save(state);
      return record;
    },

    getPositions() {
      return load().positions;
    },

    getHistory() {
      return load().history;
    },

    getBalance() {
      return load().balance;
    },

    getEquity() {
      const state = load();
      let unrealized = 0;
      for (const p of state.positions) {
        unrealized += this.calculatePnL(p, p.currentPrice);
      }
      return state.balance + unrealized;
    },

    updatePrices(rates) {
      const state = load();
      for (const p of state.positions) {
        if (rates[p.pair] !== undefined) {
          p.currentPrice = rates[p.pair];
        }
      }
      save(state);
    },

    calculatePnL(position, currentPrice) {
      if (position.side === 'buy') {
        return (currentPrice - position.entryPrice) * position.size;
      }
      return (position.entryPrice - currentPrice) * position.size;
    },

    reset() {
      localStorage.removeItem(STORAGE_KEY);
    },

    getMarginUsed() {
      const state = load();
      return state.positions.reduce((sum, p) => sum + (p.size * p.entryPrice * 0.01), 0);
    },

    getFreeMargin() {
      const state = load();
      const marginUsed = state.positions.reduce((sum, p) => sum + (p.size * p.entryPrice * 0.01), 0);
      return state.balance - marginUsed;
    }
  };
})();

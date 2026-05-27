window.FX = window.FX || {};

(function() {
  const BASE = 'https://api.frankfurter.app';

  let currencyCache = null;
  let cacheTime = 0;
  const CACHE_TTL = 3600000;

  const pending = {};

  async function fetchJSON(url) {
    if (pending[url]) return pending[url];

    const promise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        delete pending[url];
        return data;
      })
      .catch(err => {
        delete pending[url];
        console.error('[FX.API] fetch failed:', url, err);
        return null;
      });

    pending[url] = promise;
    return promise;
  }

  FX.API = {
    cache: {
      get currencies() { return currencyCache; },
      set currencies(val) { currencyCache = val; },
      get timestamp() { return cacheTime; },
      set timestamp(val) { cacheTime = val; },
      get TTL() { return CACHE_TTL; }
    },

    get pending() { return pending; },

    async getLatest(from) {
      const url = from
        ? `${BASE}/latest?from=${encodeURIComponent(from)}`
        : `${BASE}/latest`;
      return fetchJSON(url);
    },

    async getRates(from, to) {
      let url = `${BASE}/latest?from=${encodeURIComponent(from)}`;
      if (to) {
        url += '&to=' + encodeURIComponent(to);
      }
      return fetchJSON(url);
    },

    async getHistory(from, to, startDate, endDate) {
      let url = `${BASE}/${encodeURIComponent(startDate)}..${encodeURIComponent(endDate)}`;
      url += '?from=' + encodeURIComponent(from);
      if (to) {
        url += '&to=' + encodeURIComponent(to);
      }
      return fetchJSON(url);
    },

    async getCurrencies() {
      const now = Date.now();
      if (currencyCache && (now - cacheTime < CACHE_TTL)) {
        return currencyCache;
      }

      const data = await fetchJSON(`${BASE}/currencies`);
      if (data) {
        currencyCache = data;
        cacheTime = now;
      }
      return data;
    },

    async convert(amount, from, to) {
      const data = await this.getRates(from, to);
      if (!data || !data.rates) return null;

      const rate = data.rates[to];
      if (rate == null) return null;

      return amount * rate;
    }
  };

  function getPair(pair) {
    const parts = pair.split('/');
    return { from: parts[0].trim(), to: parts[1].trim() };
  }
})();

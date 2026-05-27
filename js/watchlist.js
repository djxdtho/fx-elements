window.FX = window.FX || {};

(function() {
  var STORAGE_KEY = 'fx_watchlist';

  FX.Watchlist = {
    init: function() {},

    getList: function() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch (e) {
        return [];
      }
    },

    add: function(pair) {
      var list = this.getList();
      if (list.indexOf(pair) !== -1) return;
      list.push(pair);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    },

    remove: function(pair) {
      var list = this.getList().filter(function(p) { return p !== pair; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    },

    render: function() {
      var self = this;
      var list = this.getList();
      var rates = FX.App.rates || {};
      var pairList = FX.App.pairList || [];

      var html = '<div class="page">';

      html += '<div class="watchlist-controls">';
      html += '<select class="input" id="wl-pair">';
      for (var i = 0; i < pairList.length; i++) {
        html += '<option value="' + pairList[i] + '">' + pairList[i] + '</option>';
      }
      html += '</select>';
      html += '<button class="btn btn-primary btn-sm" id="wl-add">+ Add Pair</button>';
      html += '</div>';

      if (list.length === 0) {
        html += '<div class="empty-state">';
        html += '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
        html += '<h3>No saved pairs</h3>';
        html += '<p>Add currency pairs to your watchlist to track them here.</p>';
        html += '</div>';
      } else {
        html += '<div class="card" style="padding:0">';
        for (var j = 0; j < list.length; j++) {
          var pair = list[j];
          var r = rates[pair];
          var rate, change;
          if (r != null && typeof r === 'object') {
            rate = r.rate;
            change = r.change || 0;
          } else {
            rate = r;
            change = 0;
          }
          var rateStr = rate != null ? FX.App.formatRate(rate) : '\u2014';
          var changeStr = FX.App.formatChange(Math.abs(change));
          var cls = change >= 0 ? 'up' : 'down';
          var sign = change >= 0 ? '+' : '';

          html += '<div class="pair-row" style="display:flex;align-items:center">';
          html += '<span class="pair-name">' + pair + '</span>';
          html += '<span class="pair-rate">' + rateStr + '</span>';
          html += '<span class="pair-change ' + cls + '">' + sign + changeStr + '</span>';
          html += '<button class="btn btn-danger btn-sm wl-remove" data-pair="' + pair + '" style="margin-left:auto">Remove</button>';
          html += '</div>';
        }
        html += '</div>';
      }

      html += '</div>';

      FX.App.render(html);

      var addBtn = document.getElementById('wl-add');
      if (addBtn) {
        addBtn.addEventListener('click', function() {
          var sel = document.getElementById('wl-pair');
          if (sel) {
            self.add(sel.value);
            self.render();
          }
        });
      }

      var removeBtns = document.querySelectorAll('.wl-remove');
      for (var k = 0; k < removeBtns.length; k++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            self.remove(btn.getAttribute('data-pair'));
            self.render();
          });
        })(removeBtns[k]);
      }
    }
  };
})();

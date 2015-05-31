(function($) {

  var DEFAULTS = {
    mode: 'auto',
    container: '<div class="suggest"></div>',
    autoFocus: false,
    align: 'bottom-left',
    disabled: false,
    delay: 300,
    minLength: 1,
    widgetTemplate: function(lifecycle, items, term) {
      var out = '<ul>';

      for (var i = 0; i < items.length; i++) {
        out += this.renderItem(items[i]);
      }

      out += '</ul>';

      return out;
    },
    itemTemplate: function(item, term, focused) {
      return '<li' + (focused ? ' class="focused"' : '') + '>' +
        (item.label || item.value || item) + '</li>';
    }
  };

  var ARRAY_SEARCH_FUNCTION = function(term, response) {
    var items = this.originalSource.filter(function(el) {
      return (el.label || el.value || el).match(new RegExp(term, 'i'));
    });
    response(items);
  };

  // SUGGEST CLASS DEFINITION
  // ========================

  var Suggest = function(element, options) {
    this.$element = $(element);
    this.options = $.extend({}, DEFAULTS, options);

    if ($.isArray(this.options.source)) {
      this.originalSource = this.options.source;
      this.options.source = $.proxy(ARRAY_SEARCH_FUNCTION, this);
    }

    this.items = [];
    this.focused = -1;
    this.shown = false;

    this.$container = $(this.options.container);
    this.$container.addClass(this.options.target ? 'suggest-inline' : 'suggest-popover');

    this.$element.on('keydown', $.proxy(keydown, this));
    this.$container
      .on('mousemove', '[data-item-index]', $.proxy(mousemove, this))
      .on('click', '[data-item-index]', $.proxy(mouseclick, this))
      .on('mousedown', $.proxy(function(e) { e.preventDefault(); }, this));

    // auto mode handlers
    if (this.options.mode === 'auto') {
      this.term = null;

      this.$element
        .on('focus', $.proxy(focusAutoHandler, this))
        .on('blur', $.proxy(blurAutoHandler, this))
        .on('keydown', $.proxy(keydownAutoHandler, this))
        .on('response.suggest', $.proxy(responseAutoHandler, this))
        .on('focusItem.suggest', $.proxy(focusItemAutoHandler, this))
        .on('selectItem.suggest', $.proxy(selectItemAutoHandler, this));
    }
  };

  Suggest.prototype.show = function() {
    if (this.options.disabled) return;
    if (this.shown) return;

    if (triggerEvent.call(this, 'show.suggest')) return;

    this.render('show');
    if (this.options.target) {
      $(this.options.target).append(this.$container);
    } else {
      $(document.body).append(this.$container);
      positionContainer.call(this);
    }

    this.shown = true;
  };

  Suggest.prototype.hide = function() {
    if (this.options.disabled) return;
    if (!this.shown) return;

    if (triggerEvent.call(this, 'hide.suggest')) return;

    this.$container.detach();
    this.shown = false;
  };

  Suggest.prototype.search = function(term) {
    if (this.options.disabled) return;
    if (triggerEvent.call(this, 'search.suggest', {term: term})) return;

    this.term = term;
    this.focused = this.options.autoFocus ? 0 : -1;

    this.render('search');
    if (!this.options.target) positionContainer.call(this);

    if (this.options.source) {
      var bound = $.proxy(function(items) {
        if (triggerEvent.call(this, 'response.suggest', {term: term, items: items})) return;

        this.items = items;

        this.render('response');
        if (!this.options.target) positionContainer.call(this);
      }, this);

      this.options.source(term, bound);
    }
  };

  Suggest.prototype.instance = function() {
    return this;
  };

  Suggest.prototype.render = function(lifecycle) {
    var widget = this.options.widgetTemplate.call(this, lifecycle, this.items, this.term);
    this.$container.html(widget);
  };

  Suggest.prototype.renderItem = function(item) {
    var idx = this.items.indexOf(item);
    var $item = $(this.options.itemTemplate(item, this.term, idx === this.focused));
    $item.attr('data-item-index', idx);

    return $item[0].outerHTML;
  };

  Suggest.prototype.setOptions = function(options) {
    this.options = $.extend({}, this.options, options);
  };

  Suggest.prototype.disable = function() {
    this.setOptions({disabled: true});
  };

  Suggest.prototype.enable = function() {
    this.setOptions({disabled: false});
  };

  // SUGGEST PRIVATE FUNCTIONS DEFINITION
  // ====================================

  var triggerEvent = function(name, params) {
    var e = $.Event(name, params);
    this.$element.trigger(e);
    return e.isDefaultPrevented();
  };

  // available options:
  // bottom-left, bottom-center, bottom-right
  // top-left, top-center, top-right
  // left-top left-bottom left-middle
  // right-top right-bottom right-middle
  var positionContainer = function() {
    var height = this.$element.outerHeight(),
        offset = this.$element.offset();

    var top = offset.top,
        left = offset.left,
        width = this.$element.outerWidth(),
        cWidth = this.$container.outerWidth(),
        cHeight = this.$container.outerHeight();

    var align = this.options.align.split('-');

    if (align[0] === 'bottom') top += height;
    if (align[0] === 'top')    top -= cHeight;
    if (align[0] === 'left')   left -= cWidth;
    if (align[0] === 'right')  left += width;

    if (align[1] === 'center') left += width / 2 - cWidth / 2;
    if (align[1] === 'right')  left += width - cWidth;

    if (align[1] === 'top')    top -= cHeight - height;
    if (align[1] === 'middle') top -= cHeight / 2 - height / 2;

    this.$container.css({left: left, top: top, minWidth: width});
  };

  var adjustScrollPosition = function() {
    var $item = this.$container.find('[data-item-index="' + this.focused + '"]');

    if ($item.length === 0) return;

    var borderTop = parseFloat(this.$container.css('border-top-width'), 10),
        containerTop = this.$container.offset().top + borderTop,
        itemTop = $item.offset().top - containerTop,
        itemHeight = $item.outerHeight(),
        scroll = this.$container.scrollTop();
        containerHeight = this.$container.height();

    if (itemTop < 0) {
      this.$container.scrollTop(scroll + Math.round(itemTop));
    } else if (itemTop + itemHeight > containerHeight) {
      this.$container.scrollTop(Math.round(itemTop + itemHeight - containerHeight + scroll));
    }
  };

  var keydown = function(e) {
    if (this.options.disabled) return;
    if (!this.shown) return;

    var change = null;

    switch (e.which) {
      case 38: // up
        change = -1;
        break;
      case 40: // down
        change = 1;
        break;
      case 13:
        e.preventDefault();
        selectItem.call(this, this.focused);
        break
    }

    if (change) {
      e.preventDefault();

      var focused = this.focused;
      focused += change;

      if (focused < -1) focused = this.items.length - 1;
      if (focused > this.items.length - 1) focused = -1;

      focusItem.call(this, focused);
    }
  };

  var mousemove = function(e) {
    if (this.options.disabled) return;

    var $target = $(e.target);
    var idx = $target.data('item-index');
    if (idx !== this.focused) focusItem.call(this, idx);
  };

  var mouseclick = function(e) {
    if (this.options.disabled) return;

    var $target = $(e.target);
    var idx = $target.data('item-index');
    selectItem.call(this, idx);
  };

  var focusItem = function(idx) {
    var params = {item: this.items[idx], index: idx, prevIndex: this.focused};
    if (triggerEvent.call(this, 'focusItem.suggest', params)) return;
    this.focused = idx;

    this.render('focus');
    adjustScrollPosition.call(this);
  };

  var selectItem = function(idx) {
    if (idx === -1) return;
    if (triggerEvent.call(this, 'selectItem.suggest', {item: this.items[idx], index: idx})) return;
  }

  // AUTO MODE
  // =========

  var focusAutoHandler = function() {
    this.term = null;
  };

  var blurAutoHandler = function() {
    this.hide();
  };

  var keydownAutoHandler = function(e) {
    if (e.which === 13) return;

    if (e.which === 9) {
      e.item = this.items[this.focused];
      e.index = this.focused;
      if (this.shown && this.focused !== -1) selectItemAutoHandler.call(this, e);
      return;
    }

    if (e.which === 27) {
      this.term = null;
      this.hide();
      return;
    }

    if ((e.which === 38 || e.which === 40) && this.term !== null) {
      return;
    }

    var bound = $.proxy(function() {
      var val = this.$element.val();

      if (this.term !== val) {
        if (val.length >= this.options.minLength) {
          this.search(val);
        } else {
          this.hide();
        }

        this.term = val;
      }
    }, this);

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(bound, this.options.delay);
  };

  var responseAutoHandler = function(e) {
    var val = this.$element.val();

    if (val.length >= this.options.minLength && e.items.length > 0 && this.$element.is(':focus')) {
      this.show();
    } else {
      this.hide();
    }
  };

  var focusItemAutoHandler = function(e) {
    var params = {item: e.item, prevIndex: e.prevIndex, index: e.index};
    if (triggerEvent.call(this, 'focusedItem.suggest', params)) return;

    var item = e.item;

    if (item) {
      this.$element.val(item.label || item.value || item);
    } else {
      this.$element.val(this.term);
    }
  };

  var selectItemAutoHandler = function(e) {
    this.term = null;
    this.hide();

    var item = e.item;
    if (triggerEvent.call(this, 'selectedItem.suggest', {item: item, index: e.index})) return;

    this.$element.val(item.label || item.value || item);
  };

  // SUGGEST PLUGIN DEFINITION
  // =========================

  $.fn.suggest = function(option, val) {
    if (option === 'instance') {
      this.suggest();
      var data = this.data('suggest.instance');

      return data[option](val);
    }

    return this.each(function() {
      var $this = $(this),
          data  = $this.data('suggest.instance');

      if (!data) {
        $this
          .data('suggest.instance', (data = new Suggest(this, typeof option === 'object' && option)))
          .attr('data-suggest-instance', '');
      }
      if (typeof option === 'string') data[option](val);
    });
  };

  // expose helper functions
  $.suggest = {
    Constructor: Suggest,
    setDefaults: function(options) {
      $.extend(DEFAULTS, options);
      $('[data-suggest-instance]').suggest('setOptions', options);
    }
  };

})(window.jQuery);

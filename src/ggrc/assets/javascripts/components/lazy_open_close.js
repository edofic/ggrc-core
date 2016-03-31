/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: ivan@reciprocitylabs.com
  Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  'use strict';

  GGRC.Components('lazyOpenClose', {
    tag: 'lazy-openclose',
    scope: {
      show: false
    },
    content: '<content/>',
    init: function () {
      this._control.element.closest('.tree-item').find('.openclose')
      .bind('click', function () {
        this.scope.attr('show', true);
      }.bind(this));
    }
  });
})(window.can, window.can.$);

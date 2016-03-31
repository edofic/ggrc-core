/*!
    Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  'use strict';

  GGRC.Components('dropdown', {
    tag: 'dropdown',
    template: can.view(
      GGRC.mustache_path +
      '/components/dropdown/dropdown.mustache'
    ),
    scope: {
      name: '@'
    }
  });
})(window.can, window.can.$);

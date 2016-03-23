/*!
    Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  'use strict';

  can.Component.extend({
    tag: 'mapper-checkbox',
    template: '<content />',
    scope: {
      instance_id: '@',
      instance_type: '@',
      is_mapped: '@',
      is_allowed_to_map: '@',
      checkbox: can.compute(function (status) {
        if (this.attr('mapper.getList') && !this.attr('appended')) {
          return false;
        }
        return (
          /true/gi.test(this.attr('is_mapped')) ||
          this.attr('select_state') ||
          this.attr('appended')
        );
      })
    },
    events: {
      '{scope} selected': function () {
        this.element
          .find('.object-check-single')
          .prop(
            'checked',
            _.findWhere(this.scope.attr('selected'), {
              id: Number(this.scope.attr('instance_id'))
            })
          );
      },
      '.object-check-single change': function (el, ev) {
        var scope = this.scope;
        var uid = Number(scope.attr('instance_id'));
        var type = scope.attr('instance_type');
        var item = _.find(scope.attr('options'), function (option) {
          return option.instance.id === uid && option.instance.type === type;
        });
        var status = el.prop('checked');
        var selected = this.scope.attr('selected');
        var needle = {id: item.instance.id, type: item.instance.type};
        var index;

        if (el.prop('disabled') || el.hasClass('disabled')) {
          return false;
        }

        if (!status) {
          index = _.findIndex(selected, needle);
          selected.splice(index, 1);
        } else if (!_.findWhere(selected, needle)) {
          selected.push({
            id: item.instance.id,
            type: item.instance.type,
            href: item.instance.href
          });
        }
      }
    },
    helpers: {
      not_allowed_to_map: function (options) {
        if (this.attr('mapper.getList')) {
          return options.inverse();
        }
        if (/false/gi.test(this.attr('is_allowed_to_map'))) {
          return options.fn();
        }
        return options.inverse();
      },
      is_disabled: function (options) {
        if (this.attr('is_saving') ||
            this.attr('is_loading')) {
          return options.fn();
        }
        if (this.attr('mapper.getList')) {
          return options.inverse();
        }
        if (/true/gi.test(this.attr('is_mapped')) ||
          /false/gi.test(this.attr('is_allowed_to_map'))) {
          return options.fn();
        }
        return options.inverse();
      }
    }
  });
})(window.can, window.can.$);

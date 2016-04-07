/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

/**
 * A component that renders an autocomplete text input field.
 */
(function (GGRC, can) {
  'use strict';

  // the component's configuration object (i.e. its constructor's prototype)
  var component = {
    tag: 'autocomplete',

    template: can.view(
      GGRC.mustache_path +
      '/components/autocomplete/autocomplete.mustache'
    ),

    scope: {
      placeholder: '@',
      searchItemsType: '@',

      // disable automatically mapping the picked item from the live search
      // results to the instance object of the current context
      automappingOff: true,

      disable: false
    },

    _EV_ITEM_SELECTED: 'item-selected',

    /**
     * The component's entry point. Invoked when a new component instance has
     * been created.
     *
     * @param {Object} element - the (unwrapped) DOM element that triggered the
     *   creation of the component instance
     * @param {Object} options - the component instantiation options
     */
    init: function (element, options) {
      var $el = $(element);
      var attrVal = $el.attr('disable');
      var disable;
      var scope = this.scope;

      // By default CanJS evaluates the component element's attribute values in
      // the current context, but we want to support passing in literal values
      // as well. We thus inspect some of the directly and override what CanJS
      // initializes in scope.
      if (attrVal === '' || attrVal === 'false') {
        disable = false;
      } else if (attrVal === 'true') {
        disable = true;
      } else {
        disable = Boolean(scope.attr('disable'));
      }

      scope.attr('disable', disable);
    },

    events: {
      /**
       * Event handler when an item is selected from the list of autocomplete's
       * search results.
       *
       * @param {jQuery.Element} $el - the source of the event `ev`
       * @param {jQuery.Event} ev - the event object
       * @param {Object} data - information about the selected item
       */
      'autocomplete:select': function ($el, ev, data) {
        $el.triggerHandler({
          type: component._EV_ITEM_SELECTED,
          selectedItem: data.item
        });
        // If the input still has focus after selecting an item, search results
        // do not appear unless user clicks out and back in the input (or
        // starts typing). Removing the focus spares one unnecessary click.
        $el.find('input').blur();
      }
    }
  };

  GGRC.Components('autocomplete', component);
})(window.GGRC, window.can);

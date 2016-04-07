/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.Components.autocomplete', function () {
  'use strict';

  var Component;  // the component under test

  beforeAll(function () {
    Component = GGRC.Components.get('autocomplete');
  });

  describe('defining default scope values', function () {
    var scope;

    beforeAll(function () {
      scope = Component.prototype.scope;
    });

    it('sets the automappingOff flag to true', function () {
      expect(scope.automappingOff).toBe(true);
    });

    it('sets the disable flag to false', function () {
      expect(scope.disable).toBe(false);
    });
  });

  describe('init() method', function () {
    var componentInst;  // fake component instance
    var element;  // the DOM element passed to the component instance
    var init;  // the method under test
    var options;

    beforeEach(function () {
      element = $('<div></div>')[0];
      options = {};
      componentInst = {};
      componentInst.scope = new can.Map();
      init = Component.prototype.init.bind(componentInst);
    });

    it('sets the disable flag to false if the element\'s disable attribute ' +
      'is empty',
      function () {
        $(element).attr('disable', '');
        componentInst.scope.attr('disable', true);
        init(element, options);
        expect(componentInst.scope.disable).toBe(false);
      }
    );

    it('sets the disable flag to false if the element\'s disable attribute ' +
      'has a value false',
      function () {
        $(element).attr('disable', 'false');
        componentInst.scope.attr('disable', true);
        init(element, options);
        expect(componentInst.scope.attr('disable')).toBe(false);
      }
    );

    it('sets the disable flag to true if the element\'s disable attribute ' +
      'has a value true',
      function () {
        $(element).attr('disable', 'true');
        componentInst.scope.attr('disable', false);
        init(element, options);
        expect(componentInst.scope.attr('disable')).toBe(true);
      }
    );

    it('leaves the disable flag unchanged if the element\'s disable ' +
      'attribute is neither empty nor true/false',
      function () {
        $(element).attr('disable', 'whatever');
        componentInst.scope.attr('disable', true);
        init(element, options);
        expect(componentInst.scope.attr('disable')).toBe(true);
      }
    );
  });

  describe('item selected event handler', function () {
    var eventData;
    var eventObj;
    var handler;  // the event handler under test
    var $childInput;
    var $element;

    beforeAll(function () {
      handler = Component.prototype.events['autocomplete:select'];
    });

    beforeEach(function () {
      eventData = {
        item: {id: 123, type: 'Foo'}
      };
      eventObj = $.Event('autocomplete:select');

      $element = $('<div></div>');
      spyOn($element, 'triggerHandler');

      $childInput = $('<input></input>');
      $element.append($childInput);

      // the $element needs to be added to the DOM to test its focus
      $('body').append($element);
    });

    afterEach(function () {
      $element.remove();
    });

    it('triggers the item-selected event with the selected item object as ' +
      'the event argument',
      function () {
        handler($element, eventObj, eventData);

        expect($element.triggerHandler).toHaveBeenCalledWith({
          type: Component.prototype._EV_ITEM_SELECTED,
          selectedItem: {id: 123, type: 'Foo'}
        });
      }
    );

    it('removes focus from the input element', function () {
      $childInput.focus();
      handler($element, eventObj, eventData);
      expect(document.activeElement).not.toBe($childInput[0]);
    });
  });
});

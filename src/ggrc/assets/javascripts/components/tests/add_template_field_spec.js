/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.Components.addTemplateField', function () {
  'use strict';

  var Component;  // the component under test

  beforeAll(function () {
    Component = GGRC.Components.get('addTemplateField');
  });

  describe('addField() method', function () {
    var addField;  // the method under test
    var $el;
    var ev;
    var scope;

    beforeAll(function () {
      addField = Component.prototype.scope.addField;
    });

    beforeEach(function () {
      $el = $('<div></div>');

      ev = {
        preventDefault: jasmine.createSpy()
      };

      scope = new can.Map({
        fields: new can.List(),
        selected: new can.Map(),
        id: 123
      });
    });

    it('does not require the "values" field to add a field of type Person',
      function () {
        var selectedObj = new can.Map({
          title: 'External Reviewer',
          type: 'Person',
          values: ''
        });
        scope.attr('selected', selectedObj);

        addField.call(scope, scope, $el, ev);

        expect(scope.fields.length).toEqual(1);
      }
    );
  });
});

/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.Components.personItem', function () {
  'use strict';

  var Component;  // the component under test

  beforeAll(function () {
    Component = GGRC.Components.get('personItem');
  });

  describe('defining default scope values', function () {
    var scope;

    beforeAll(function () {
      scope = Component.prototype.scope;
    });

    it('sets the personObj to null', function () {
      expect(scope.personObj).toBeNull();
    });
  });

  describe('init() method', function () {
    var componentInst;  // fake component instance
    var dfdFindOne;
    var element;  // the DOM element passed to the component instance
    var init;  // the method under test
    var options;
    var origPersonCache;

    beforeAll(function () {
      componentInst = {};

      init = Component.prototype.init.bind(componentInst);
    });

    beforeEach(function () {
      element = $('<div></div>')[0];
      options = {};

      dfdFindOne = new can.Deferred();
      spyOn(CMS.Models.Person, 'findOne').and.returnValue(dfdFindOne);

      origPersonCache = CMS.Models.Person.cache;
      CMS.Models.Person.cache = {};

      componentInst.scope = new can.Map({});
    });

    afterEach(function () {
      CMS.Models.Person.cache = origPersonCache;
    });

    it('sets the personObj in scope to the cached Person object ' +
      'if found there',
      function () {
        var person42 = new can.Map({
          id: 42, name: 'John', email: 'john@doe.com'
        });
        CMS.Models.Person.cache[42] = person42;
        $(element).attr('person-id', 42);

        init(element, options);

        expect(componentInst.scope.attr('personObj')).toBe(person42);
      }
    );

    it('sets the personObj in scope to the fetched Person object ' +
      'if not found in cache',
      function () {
        var person123 = new can.Map({
          id: 123, name: 'Mike', email: 'mike@mike.com'
        });

        delete CMS.Models.Person.cache[123];
        $(element).attr('person-id', 123);

        init(element, options);
        dfdFindOne.resolve(person123);

        expect(CMS.Models.Person.findOne).toHaveBeenCalledWith({id: 123});
        expect(componentInst.scope.attr('personObj')).toBe(person123);
      }
    );

    it('sets the personObj in scope to the fetched Person object ' +
      'for partially loaded objects in cache',
      function () {
        var person123 = new can.Map({id: 123, name: '', email: ''});
        var fetchedPerson = new can.Map({
          id: 123, name: 'John', email: 'john@doe.com'
        });

        CMS.Models.Person.cache[123] = person123;
        $(element).attr('person-id', 123);

        init(element, options);
        dfdFindOne.resolve(fetchedPerson);

        expect(CMS.Models.Person.findOne).toHaveBeenCalledWith({id: 123});
        expect(componentInst.scope.attr('personObj')).toBe(fetchedPerson);
      }
    );

    it('displays a toaster error if fetching the Person object fails',
      function () {
        var $fakeElement = $('<div person-id="123"></div>');
        spyOn($fakeElement, 'trigger');
        spyOn(window, '$').and.returnValue($fakeElement);
        delete CMS.Models.Person.cache[123];

        init(element, options);
        dfdFindOne.reject('Server error');

        expect(window.$).toHaveBeenCalledWith(element);
        expect($fakeElement.trigger).toHaveBeenCalledWith(
          'ajax:flash',
          {error: 'Failed to fetch data for person 123.'}
        );
      }
    );
  });

  describe('unmap person click event handler', function () {
    var handler;  // the event handler under test
    var componentInst;  // fake component instance

    beforeAll(function () {
      handler = Component.prototype.events['a.unmap click'];
    });

    beforeEach(function () {
      componentInst = {
        element: {
          triggerHandler: jasmine.createSpy()
        },
        scope: new can.Map()
      };

      handler = handler.bind(componentInst);
    });

    it('triggers the person-remove event with the person object as the ' +
      'event argument',
      function () {
        var call;
        componentInst.scope.attr('personObj', {id: 123, name: 'John'});

        handler();

        expect(componentInst.element.triggerHandler).toHaveBeenCalled();
        call = componentInst.element.triggerHandler.calls.mostRecent();
        expect(call.args[0].type).toEqual(
          Component.prototype._EV_REMOVE_CLICK);
        expect(call.args[0].person.attr()).toEqual({id: 123, name: 'John'});
      }
    );
  });
});

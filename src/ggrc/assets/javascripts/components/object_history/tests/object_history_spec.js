/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.Components.objectHistory', function () {
  'use strict';

  var Component;  // the component under test

  beforeAll(function () {
    Component = GGRC.Components.get('objectHistory');
  });

  describe('defining default scope values', function () {
    var scope;

    beforeAll(function () {
      scope = Component.prototype.scope;
    });

    it('sets the instance to null', function () {
      expect(scope.instance).toBeNull();
    });

    it('sets the change history to an empty array', function () {
      expect(Array.isArray(scope.changeHistory)).toBe(true);
      expect(scope.changeHistory.length).toEqual(0);
    });
  });

  describe('init() method', function () {
    var componentInst;  // fake component instance
    var dfdFetchData;
    var element;  // the DOM element passed to the component instance
    var instance;  // a fake instance the component creates the history of
    var method;  // the method under test

    beforeAll(function () {
      componentInst = {
        _fetchRevisionsData: jasmine.createSpy(),
        _computeMappingChanges: jasmine.createSpy(),
        _computeObjectChanges: jasmine.createSpy()
      };

      method = Component.prototype.init.bind(componentInst);
    });

    beforeEach(function () {
      element = $('<div></div>')[0];

      dfdFetchData = new can.Deferred();
      componentInst._fetchRevisionsData.and.returnValue(dfdFetchData);

      // The instance needs to be a can.Map, because if plain object, the
      // component wraps it into a new can.Map object, and "instance" does not
      // point to the same object anymore.
      instance = new can.Map();

      componentInst.scope = new can.Map({
        instance: instance
      });
    });

    afterEach(function () {
      componentInst._fetchRevisionsData.calls.reset();
      componentInst._computeMappingChanges.calls.reset();
      componentInst._computeObjectChanges.calls.reset();
    });

    it('raises an error if the instance is not passed to the component',
      function () {
        // this can happen if the component's DOM element does not have the
        // instance attribute set, causing the instance to revert to a default
        // scope value
        componentInst.scope.attr('instance', null);
        expect(function () {
          method(element);
        }).toThrow(new Error('Instance not passed through the HTML element.'));
      }
    );

    it('stores the correct instance type', function () {
      instance.attr('type', 'ObjectFoo');
      method(element);
      expect(componentInst._INSTANCE_TYPE).toEqual('ObjectFoo');
    });

    it('fetches history data for the correct object instance', function () {
      method(element);
      expect(componentInst._fetchRevisionsData).toHaveBeenCalledWith(instance);
    });

    it('displays a toaster error if fetching the data fails', function () {
      var $fakeElement = {
        trigger: jasmine.createSpy()
      };

      spyOn(window, '$').and.returnValue($fakeElement);

      method(element);
      dfdFetchData.reject('Server error');

      expect(window.$).toHaveBeenCalledWith(element);
      expect($fakeElement.trigger).toHaveBeenCalledWith(
        'ajax:flash',
        {error: 'Failed to fetch revision history data.'}
      );
    });

    it('on successfully fetching the data it sets the correctly sorted ' +
      'change history in the scope',
      function () {
        var actual;
        var expected;

        var fetchedRevisions = new can.Map({
          object: new can.List([
            {id: 10}
          ]),
          mappings: new can.List([
            {id: 20}
          ])
        });

        var mapChange = {updatedAt: new Date('2015-12-21')};
        var mapChange2 = {updatedAt: new Date('2016-03-17')};

        var objChange = {updatedAt: new Date('2016-04-14')};
        var objChange2 = {updatedAt: new Date('2014-11-18')};
        var objChange3 = {updatedAt: new Date('2016-01-09')};

        componentInst.scope.attr('changeHistory', new can.List());

        componentInst._computeMappingChanges.and.returnValue(
          new can.List([mapChange, mapChange2])
        );
        componentInst._computeObjectChanges.and.returnValue(
          new can.List([objChange, objChange2, objChange3])
        );
        // end fixture

        method(element);
        dfdFetchData.resolve(fetchedRevisions);

        // check that correct data has been used to calculate the history
        expect(componentInst._computeObjectChanges)
          .toHaveBeenCalledWith(fetchedRevisions.object);
        expect(componentInst._computeMappingChanges)
          .toHaveBeenCalledWith(fetchedRevisions.mappings);

        // check the actual outcome
        actual = can.makeArray(componentInst.scope.changeHistory);
        actual = _.map(actual, function (item) {
          return item.attr();
        });
        // sorted by newest to oldest
        expected = [objChange, mapChange2, objChange3, mapChange, objChange2];

        expect(actual).toEqual(expected);
      }
    );
  });

  describe('_computeObjectChanges() method', function () {
    var componentInst;  // fake component instance
    var method;  // the method under test

    beforeAll(function () {
      componentInst = {
        _objectChangeDiff: jasmine.createSpy()
      };

      method = Component.prototype._computeObjectChanges.bind(componentInst);
    });

    afterEach(function () {
      componentInst._objectChangeDiff.calls.reset();
    });

    it('computes an empty list on empty Revision history', function () {
      var result;
      var revisions = new can.List();

      result = method(revisions);

      expect(result.length).toEqual(0);
    });

    it('computes diff objects for all successive Revision pairs', function () {
      var result;

      var revisions = [
        {id: 10}, {id: 20}, {id: 30}
      ];

      var diff = {
        madeBy: 'John',
        changes: [
          {fieldName: 'foo'}
        ]
      };
      var diff2 = {
        madeBy: 'Doe',
        changes: [
          {fieldName: 'bar'}
        ]
      };

      componentInst._objectChangeDiff.and.returnValues(diff, diff2);

      result = method(revisions);

      expect(componentInst._objectChangeDiff.calls.count()).toEqual(2);

      expect(result[0]).toEqual(diff);
      expect(result[1]).toEqual(diff2);
    });

    it('omits the diff objects with an empty changes list from the result',
      function () {
        var result;

        var revisions = new can.List([
          {id: 10}, {id: 20}
        ]);

        var diff = {
          changes: []
        };
        componentInst._objectChangeDiff.and.returnValue(diff);

        result = method(revisions);

        expect(result.length).toEqual(0);
      }
    );
  });

  describe('_objectChangeDiff() method', function () {
    var method;  // the method under test
    var origModelAttrDefs;  // original user-friendly attribute name settings

    beforeAll(function () {
      method = Component.prototype._objectChangeDiff;
    });

    beforeEach(function () {
      // mock global model attribute definitions
      origModelAttrDefs = GGRC.model_attr_defs;
      GGRC.model_attr_defs = {};
    });

    afterEach(function () {
      GGRC.model_attr_defs = origModelAttrDefs;
    });

    it('includes the modification time in the result', function () {
      var rev1 = {
        updated_at: '2016-01-24T10:05:42',
        modified_by: 'User 1',
        content: {}
      };
      var rev2 = {
        updated_at: '2016-01-30T08:15:11',
        modified_by: 'User 1',
        content: {}
      };

      var result = method(rev1, rev2);

      expect(result.updatedAt).toEqual('2016-01-30T08:15:11');
    });

    it('includes the author of the change(s) in the result', function () {
      var rev1 = {
        updated_at: '2016-01-24T10:05:42',
        modified_by: 'User 7',
        content: {}
      };
      var rev2 = {
        updated_at: '2016-01-30T08:15:11',
        modified_by: 'User 7',
        content: {}
      };

      var result = method(rev1, rev2);

      expect(result.madeBy).toEqual('User 7');
    });

    describe('with model attributes definitions defined', function () {
      beforeEach(function () {
        GGRC.model_attr_defs = {
          Audit: [
            {attr_name: 'title', display_name: 'Object Name'}
          ]
        };
      });

      it('uses the fields\' display names in the result', function () {
        var expectedChangeList;

        var rev1 = {
          updated_at: '2016-01-25T16:36:29',
          modified_by: {
            reify: function () {
              return "User 5";
            }
          },
          resource_type: 'Audit',
          content: {
            title: 'Audit 1.0'
          }
        };
        var rev2 = {
          updated_at: '2016-01-30T13:22:59',
          modified_by: {
            reify: function () {
              return "User 5";
            }
          },
          resource_type: 'Audit',
          content: {
            title: 'My Audit 1.0'
          }
        };

        var result = method.call({_DATE_FIELDS: {}}, rev1, rev2);

        expectedChangeList = [{
          fieldName: 'Object Name',
          origVal: 'Audit 1.0',
          newVal: 'My Audit 1.0'
        }];
        expect(result.changes).toEqual(expectedChangeList);
      });

      it('omits object fields that are considered internal from the result',
        function () {
          var rev1 = {
            updated_at: '2016-01-25T16:36:29',
            modified_by: {
              reify: function () {
                return "User 5";
              }
            },
            resource_type: 'Audit',
            content: {
              internalField: 'AUDIT-e34a'
            }
          };
          var rev2 = {
            updated_at: '2016-01-30T13:22:59',
            modified_by: {
              reify: function () {
                return "User 5";
              }
            },
            resource_type: 'Audit',
            content: {
              internalField: 'AUDIT-e34a-v2'
            }
          };

          var result = method(rev1, rev2);

          // the Audit's internalField does not have a display name defined in
          // GGRC.model_attr_defs, and is thus considered internal, meaning
          // that it should be omitted from the resulting diff object
          expect(result.changes.length).toEqual(0);
        }
      );
    });
  });

  describe('_fetchRevisionsData() method', function () {
    var method;  // the method under test
    var Revision;  // the Revision object constructor

    // fake Deferred objects to return from the mocked Revision.findAll()
    var dfdResource;
    var dfdSource;
    var dfdDestination;

    beforeEach(function () {
      // obtain a reference to the method under test, and bind it to a fake
      // instance context
      var componentInst = {
        _INSTANCE_TYPE: 'ObjectFoo',
        scope: new can.Map({
          instance: {
            id: 123,
            type: 'ObjectFoo'
          }
        })
      };

      method = Component.prototype._fetchRevisionsData.bind(componentInst);
    });

    beforeEach(function () {
      // mock the Revision model's findAll() method
      Revision = CMS.Models.Revision;

      dfdResource = new can.Deferred();
      dfdSource = new can.Deferred();
      dfdDestination = new can.Deferred();

      spyOn(Revision, 'findAll').and.callFake(function (options) {
        if (options.resource_type) {
          return dfdResource;
        } else if (options.source_type) {
          return dfdSource;
        } else if (options.destination_type) {
          return dfdDestination;
        }
        throw new Error('Revision.findAll() invoked with unexpected options.');
      });
    });

    it('fetches the Revision history of the correct object', function () {
      method();

      expect(Revision.findAll).toHaveBeenCalledWith({
        resource_type: 'ObjectFoo',
        resource_id: 123
      });
    });

    it('fetches the Revision history of the correct object ' +
      'as a mapping source',
      function () {
        method();

        expect(Revision.findAll).toHaveBeenCalledWith({
          source_type: 'ObjectFoo',
          source_id: 123
        });
      }
    );

    it('fetches the Revision history of the correct object ' +
      'as a mapping destination',
      function () {
        method();

        expect(Revision.findAll).toHaveBeenCalledWith({
          destination_type: 'ObjectFoo',
          destination_id: 123
        });
      }
    );

    it('resolves the returned Deferred with the fetched data', function () {
      var result;
      var successHandler;

      var objRevisions = new can.List([
        {revision: 'objFoo'}, {revision: 'objBar'}
      ]);
      var mappingSrcRevisions = new can.List([
        {revision: 'mappingSrcFoo'}
      ]);
      var mappingDestRevisions = new can.List([
        {revision: 'mappingDestFoo'}
      ]);

      successHandler = jasmine.createSpy().and.callFake(function (revisions) {
        var objRevisions = can.makeArray(revisions.object);
        var mappingsRevisions = can.makeArray(revisions.mappings);

        function canMapToObject(item) {
          return item.attr();
        }
        objRevisions = _.map(objRevisions, canMapToObject);
        mappingsRevisions = _.map(mappingsRevisions, canMapToObject);

        expect(objRevisions).toEqual([
          {revision: 'objFoo'}, {revision: 'objBar'}
        ]);
        expect(mappingsRevisions).toEqual([
          {revision: 'mappingSrcFoo'}, {revision: 'mappingDestFoo'}
        ]);
      });

      result = method();
      result.then(successHandler);

      dfdResource.resolve(objRevisions);
      dfdSource.resolve(mappingSrcRevisions);
      dfdDestination.resolve(mappingDestRevisions);

      // check that the returned Deferred has indeed been resolved
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('_computeMappingChanges() method', function () {
    var componentInst;  // fake component instance
    var method;  // the method under test

    beforeAll(function () {
      componentInst = {
        _mappingChange: jasmine.createSpy()
      };

      method = Component.prototype._computeMappingChanges.bind(componentInst);
    });

    afterEach(function () {
      componentInst._mappingChange.calls.reset();
    });

    it('creates a list of mapping changes from a Revision list', function () {
      var result;
      var revisions = new can.List([
        {id: 10, madeBy: 'John'},
        {id: 20, madeBy: 'Doe'}
      ]);

      componentInst._mappingChange.and.callFake(function (revision) {
        return new can.Map({madeBy: revision.madeBy});
      });

      result = method(revisions);

      // we call attr() to get a plain object needed for the comparison
      expect(result[0].attr()).toEqual({madeBy: 'John'});
      expect(result[1].attr()).toEqual({madeBy: 'Doe'});
      expect(componentInst._mappingChange.calls.count()).toEqual(2);
    });
  });

  describe('_mappingChange() method', function () {
    var componentInst;  // fake component instance
    var method;  // the method under test

    beforeAll(function () {
      componentInst = {
        _INSTANCE_TYPE: 'ObjectFoo'
      };

      method = Component.prototype._mappingChange.bind(componentInst);
    });

    it('returns correct change information when the instance is at the ' +
      '"source" end of the mapping',
      function () {
        var revision = {
          modified_by: 'User 17',
          updated_at: new Date('2015-05-17 17:24:01'),
          action: 'created',
          destination: {
            type: 'Other',
            display_name: function () {
              return 'OtherObject';
            }
          },
          source_id: 99,
          source_type: 'OtherObject'
        };

        var result = method(revision, [revision]);

        expect(result).toEqual({
          madeBy: "User 17",
          updatedAt: new Date('2015-05-17 17:24:01'),
          changes: {
            origVal: '—',
            newVal: 'Created',
            fieldName: 'Mapping to Other: OtherObject'
          }
        });
      }
    );

    it('returns correct change information when the instance is at the ' +
      '"destination" end of the mapping',
      function () {
        var revision = {
          modified_by: 'User 17',
          updated_at: new Date('2015-05-17 17:24:01'),
          action: 'deleted',
          source: {
            type: 'Other',
            display_name: function () {
              return 'OtherObject';
            }
          },
          destination_id: 123,
          destination_type: 'ObjectFoo'
        };

        var result = method(revision, [revision]);

        expect(result).toEqual({
          madeBy: "User 17",
          updatedAt: new Date('2015-05-17 17:24:01'),
          changes: {
            origVal: '—',
            newVal: 'Deleted',
            fieldName: 'Mapping to Other: OtherObject'
          }
        });
      }
    );
  });
});

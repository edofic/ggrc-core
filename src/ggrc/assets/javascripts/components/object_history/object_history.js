/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

(function (GGRC, can) {
  'use strict';

  /**
   * A component that calculates and renders the given Model object's revision
   * history.
   */
  GGRC.Components('objectHistory', {
    tag: 'revision-log',

    template: can.view(
      GGRC.mustache_path +
      '/components/object_history/object_history.mustache'
    ),

    scope: {
      instance: null,
      changeHistory: [],
      isLoading: true
    },

    // the type of the object the component is operating on
    _INSTANCE_TYPE: null,

    _DATE_FIELDS: Object.freeze({
      created_at: 1,
      updated_at: 1,
      start_date: 1,
      end_date: 1,
      requested_on: 1,
      due_on: 1,
      finished_date: 1,
      verified_date: 1
    }),

    /**
     * The component's entry point. Invoked when a new component instance has
     * been created.
     *
     * @param {Object} element - the (unwrapped) DOM element that triggered
     *   creating the component instance
     * @param {Object} options - the component instantiation options
     */
    init: function (element, options) {
      if (this.scope.instance === null) {
        throw new Error('Instance not passed through the HTML element.');
      }

      this._INSTANCE_TYPE = this.scope.instance.type;

      this._fetchRevisionsData(
        this.scope.instance
      ).then(
        function success(revisions) {
          var changeHistory;
          var mappingsChanges = this._computeMappingChanges(revisions.mappings);
          var objChanges = this._computeObjectChanges(revisions.object);

          // combine all the changes and sort them by date descending
          changeHistory = objChanges.concat(mappingsChanges);
          changeHistory = _.sortBy(changeHistory, 'updatedAt').reverse();
          this.scope.attr('changeHistory', changeHistory);
        }.bind(this),

        function error() {
          $(element).trigger(
            'ajax:flash',
            {error: 'Failed to fetch revision history data.'});
        }
      ).always(function () {
        this.scope.attr('isLoading', false);
      }.bind(this));
    },

    /**
     * Fetch the instance's Revisions data from the server, including the
     * Revisions of the instance's mappings.
     *
     * The `instance` here refers to the instance of an object currently being
     * handled by the component.
     *
     * @return {can.Deferred} - an object representing the async operation of
     *   fetching the data from the server. On success it is resolved with an
     *   object containing the following Revision data, order by date from
     *   oldest to newest:
     *   - {Array} object - the list of Revisions of the instance itself,
     *   - {Array} mappings - the list of Revisions of all the instance's
     *      mappings
     */
    _fetchRevisionsData: function () {
      var Revision = CMS.Models.Revision;

      var instance = this.scope.instance;

      var dfd = Revision.findAll({
        resource_type: this._INSTANCE_TYPE,
        resource_id: instance.id,
        __sort: 'updated_at'
      });

      var dfd2 = Revision.findAll({
        source_type: this._INSTANCE_TYPE,
        source_id: instance.id,
        __sort: 'updated_at'
      });

      var dfd3 = Revision.findAll({
        destination_type: this._INSTANCE_TYPE,
        destination_id: instance.id,
        __sort: 'updated_at'
      });

      var dfdResults = can.when(
        dfd, dfd2, dfd3
      ).then(function (objRevisions, mappingsSrc, mappingsDest) {
        // manually include people for modified_by since using __include would
        // result in a lot of duplication
        var rq = new RefreshQueue();
        var enqueue = function (revision) {
          if (revision.modified_by) {
            rq.enqueue(revision.modified_by);
          }
        };
        _.each(objRevisions, enqueue);
        _.each(mappingsSrc, enqueue);
        _.each(mappingsDest, enqueue);
        _.each(mappingsSrc, function (revision) {
          if (revision.destination_type && revision.destination_id) {
            revision.destination = can.Stub.get_or_create({
              id: revision.destination_id,
              type: revision.destination_type
            });
            rq.enqueue(revision.destination);
          }
        });
        _.each(mappingsDest, function (revision) {
          if (revision.source_type && revision.source_id) {
            revision.source = can.Stub.get_or_create({
              id: revision.source_id,
              type: revision.source_type
            });
            rq.enqueue(revision.source);
          }
        });
        return rq.trigger().then(function () {
          var reify = function (revision) {
            if (revision.modified_by && revision.modified_by.reify) {
              revision.attr('modified_by', revision.modified_by.reify());
            }
            if (revision.destination && revision.destination.reify) {
              revision.attr('destination', revision.destination.reify());
            }
            if (revision.source && revision.source.reify()) {
              revision.attr('source', revision.source.reify());
            }
            return revision;
          };
          return {
            object: _.map(objRevisions, reify),
            mappings: _.map(mappingsSrc.concat(mappingsDest), reify)
          };
        });
      });

      return dfdResults;
    },

    /**
     * Compute the the history of object changes from a list of Revisions.
     *
     * The computed list of changes is sorted from oldest to newest (the method
     * assumes that the `revisions` list is also sorted chronologically with
     * the oldest Revision placed first).
     *
     *
     * @param {Array} revisions - the list of revisions of the instance
     *   being handled by the component, sorted from oldest to newest.
     *
     * @return {Array} - the history of changes to the instance. Each
     *   element follows the format returned by the `_objectChangeDiff` method.
     */
    _computeObjectChanges: function (revisions) {
      var diffList = _.map(revisions, function (revision, i) {
        // default to empty revision
        var prev = revisions[i - 1] || {content: {}};
        return this._objectChangeDiff(prev, revision);
      }.bind(this));
      return _.filter(diffList, 'changes.length');
    },

    /**
     * A helper function for computing the difference between the two Revisions
     * of an object.
     *
     * The function assumes that the given revisions are two distinct Revisions
     * of the same object (application entity).
     *
     * NOTE: The object fields that do not have a user-friendly alias defined are
     * considered 'internal', and are thus not included in the resulting diff
     * objects, because they are not meant to be shown to the end user.
     *
     * @param {CMS.Models.Revision} rev1 - the older of the two revisions
     * @param {CMS.Models.Revision} rev2 - the newer of the two revisions
     *
     * @return {Object} - A 'diff' object describing the changes between the
     *   revisions. The object has the following attributes:
     *   - madeBy: the user who made the changes
     *   - updatedAt: the time when the changes have been made
     *   - changes:
     *       A list of objects describing the modified attributes of the
     *       instance`, with each object having the following attributes:
     *         - fieldName: the name of the changed`instance` attribute
     *         - origVal: the attribute's original value
     *         - newVal: the attribute's new (modified) value
     */
    _objectChangeDiff: function (rev1, rev2) {
      var diff = {
        madeBy: null,
        updatedAt: null,
        changes: []
      };
      var attrDefs = GGRC.model_attr_defs[rev2.resource_type];

      diff.madeBy = rev2.modified_by;
      diff.updatedAt = rev2.updated_at;

      can.each(rev2.content, function (value, fieldName) {
        var origVal = rev1.content[fieldName];
        var displayName;
        if (attrDefs) {
          displayName = (_.find(attrDefs, function (attr) {
            return attr.attr_name === fieldName;
          }) || {}).display_name;
        } else {
          displayName = fieldName;
        }

        if (displayName && value !== origVal) {
          // format date fields
          if (this._DATE_FIELDS[fieldName]) {
            if (value) {
              value = GGRC.Utils.formatDate(value, true);
            }
            if (origVal) {
              origVal = GGRC.Utils.formatDate(origVal, true);
            }
          }
          if (origVal || value) {
            diff.changes.push({
              fieldName: displayName,
              origVal: origVal || "—",
              newVal: value || "—"
            });
          }
        }
      }.bind(this));

      return diff;
    },

    /**
     * Compute the instance's object mapping-related changes from the list of
     * mapping revisions.
     *
     * @param {Array} revisions - the list of instance mappings' revision
     *   history, sorted from oldest to newest.
     *
     * @return {Array} - the history of instance mappings' changes. Each
     *   element follows the format returned by the `_mappingChange` helper
     *   method.
     */
    _computeMappingChanges: function (revisions) {
      var chains = _.chain(revisions)
                    .groupBy('resource_id')
                    .mapValues(function (chain) {
                      return _.sortBy(chain, 'updated_at');
                    }).value();
      return _.map(revisions, function (revision) {
        return this._mappingChange(revision, chains[revision.resource_id]);
      }.bind(this));
    },

    /**
     * A helper function for extracting the mapping change information from a
     * Revision object.
     *
     * @param {CMS.Models.Revision} revision - a Revision object describing a
     *   mapping between the object instance the component is handling, and an
     *   external object
     *
     * @param {Array} chain - revisions of the same resource ordered
     *   chronologically
     *
     * @return {Object} - A 'change' object describing a single modification
     *   of a mapping. The object has the following attributes:
     *   - madeBy: the user who made the changes
     *   - updatedAt: the time when the changes have been made
     *   - changes:
     *       A list of objects describing the modified attributes of the
     *       instance`, with each object having the following attributes:
     *         - fieldName: the name of the changed`instance` attribute
     *         - origVal: the attribute's original value
     *         - newVal: the attribute's new (modified) value
     */
    _mappingChange: function (revision, chain) {
      var object = revision.destination_type === this._INSTANCE_TYPE ?
                   revision.source : revision.destination;
      var displayName;
      var fieldName;
      var origVal;
      var newVal;
      var previous;

      if (object instanceof can.Stub) {
        object = object.reify();
      }

      displayName = object.display_name() || object.description;
      fieldName = 'Mapping to ' + object.type + ': ' + displayName;
      origVal = '—';
      newVal = _.capitalize(revision.action);
      previous = chain[_.findIndex(chain, revision) - 1];
      if (revision.action !== 'deleted' &&
          _.exists(revision.content, 'attrs.AssigneeType')) {
        newVal = revision.content.attrs.AssigneeType;
      }
      if (_.exists(previous, 'content.attrs.AssigneeType')) {
        origVal = previous.content.attrs.AssigneeType;
      } else if (revision.action === 'deleted') {
        origVal = 'Created';
      }
      return {
        madeBy: revision.modified_by,
        updatedAt: revision.updated_at,
        changes: {
          origVal: origVal,
          newVal: newVal,
          fieldName: fieldName
        }
      };
    }
  });
})(window.GGRC, window.can);

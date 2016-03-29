/*!
  Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: ivan@reciprocitylabs.com
  Maintained By: ivan@reciprocitylabs.com
*/

(function ($, GGRC, moment, Permission) {
  /**
   * A module containing various utility functions.
   */
  GGRC.Utils = {
    firstWorkingDay: function (date) {
      date = moment(date);
      // 6 is Saturday 0 is Sunday
      while (_.contains([0, 6], date.day())) {
        date.add(1, 'day');
      }
      return date.toDate();
    },
    formatDate: function (date, hideTime) {
      var currentTimezone = moment.tz.guess();
      var m;

      if (date === undefined || date === null) {
        return '';
      }

      m = moment(new Date(date.isComputed ? date() : date));
      if (hideTime === true) {
        return m.format('MM/DD/YYYY');
      }
      return m.tz(currentTimezone).format('MM/DD/YYYY hh:mm:ss A z');
    },
    getPickerElement: function (picker) {
      return _.find(_.values(picker), function (val) {
        if (val instanceof Node) {
          return /picker\-dialog/.test(val.className);
        }
        return false;
      });
    },
    download: function (filename, text) {
      var element = document.createElement('a');
      element.setAttribute(
        'href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },
    export_request: function (request) {
      return $.ajax({
        type: 'POST',
        dataType: 'text',
        headers: $.extend({
          'Content-Type': 'application/json',
          'X-export-view': 'blocks',
          'X-requested-by': 'gGRC'
        }, request.headers || {}),
        url: '/_service/export_csv',
        data: JSON.stringify(request.data || {})
      });
    },
    is_mapped: function (target, destination) {
      var tablePlural = CMS.Models[destination.type].table_plural;
      var bindings = target.get_binding(
        (target.has_binding(tablePlural) ? '' : 'related_') + tablePlural);

      if (bindings && bindings.list && bindings.list.length) {
        return _.find(bindings.list, function (item) {
          return item.instance.id === destination.id;
        });
      }
      if (target.objects && target.objects.length) {
        return _.find(target.objects, function (item) {
          return item.id === destination.id && item.type === destination.type;
        });
      }
    },

  /**
   * Determine if `source` is allowed to be mapped to `target`.
   *
   * By symmetry, this method can be also used to check whether `source` can
   * be unmapped from `target`.
   *
   * @param {Object} source - the source object the mapping
   * @param {Object} target - the target object of the mapping
   * @param {Object} options - the options objects, similar to the one that is
   *   passed as an argument to Mustache helpers
   *
   * @return {Boolean} - true if mapping is allowed, false otherwise
   */
    allowed_to_map: function (source, target, options) {
      var canMap = false;
      var types;
      var targetType;
      var sourceType;
      var targetContext;
      var sourceContext;
      var createContexts;
      var canonical;
      var hasWidget;
      var canonicalMapping;
      var forbidden = {
        'audit program': true,
        'audit request': true
      };

      if (target instanceof can.Model) {
        targetType = target.constructor.shortName;
      } else {
        targetType = target.type || target;
      }
      sourceType = source.constructor.shortName || source;

      // special case check:
      // - mapping an Audit to a Program is not allowed
      // - mapping an Audit to a Request is not allowed
      // (and vice versa)
      types = [sourceType.toLowerCase(), targetType.toLowerCase()].sort();
      if (forbidden[types.join(' ')]) {
        return false;
      }

      canonical = GGRC.Mappings.get_canonical_mapping_name(
        sourceType, targetType);
      canonicalMapping = GGRC.Mappings.get_canonical_mapping(
        sourceType, targetType);

      if (canonical && canonical.indexOf('_') === 0) {
        canonical = null;
      }

      hasWidget = _.contains(
        GGRC.tree_view.base_widgets_by_type[sourceType] || [],
        targetType);

      if (_.exists(options, 'hash.join') && (!canonical || !hasWidget) ||
          (canonical && !canonicalMapping.model_name)) {
        return false;
      }
      targetContext = _.exists(target, 'context.id');
      sourceContext = _.exists(source, 'context.id');
      createContexts = _.exists(
        GGRC, 'permissions.create.Relationship.contexts');

      canMap = Permission.is_allowed_for('update', source) ||
        sourceType === 'Person' ||
        _.contains(createContexts, sourceContext);

      if (target instanceof can.Model) {
        canMap = canMap &&
          (Permission.is_allowed_for('update', target) ||
           targetType === 'Person' ||
           _.contains(createContexts, targetContext));
      }
      return canMap;
    }
  };
})(jQuery, window.GGRC = window.GGRC || {}, window.moment, window.Permission);

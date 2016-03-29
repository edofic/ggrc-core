/*!
    Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  /*
   * Assessment template main component
   *
   * It collects fields data and it transforms them into appropriate
   * format for saving
   */
  can.Component.extend({
    tag: 'assessment-template-attributes',
    template: '<content></content>',
    scope: {
      fields: new can.List()
    }
  });

  /*
   * Template field
   *
   * Represents each `field` passed from assessment-template-attributes `fields`
   */
  can.Component.extend({
    tag: 'template-filed',
    template: can.view(GGRC.mustache_path +
      '/assessment_templates/attribute_field.mustache'),
    scope: {
      pads: {
        COMMENT: 0,
        ATTACHMENT: 1
      },
      /*
       * Removes `field` from `fileds`
       */
      removeField: function (scope, el, ev) {
        ev.preventDefault();
        scope.attr('_pending_delete', true);
      },
      /*
       * Split field values
       *
       * @return {Array} attrs - Returns split values as an array
       */
      attrs: function () {
        if (_.contains(['Person', 'Text'], this.field.attr('type'))) {
          return [this.attr('field.multi_choice_options')];
        }
        return _.splitTrim(this.attr('field.multi_choice_options'), {
          compact: true
        });
      },
      /*
      * Denormalize field.multi_choice_mandatory into field.opts
      * "0, 1, 2" is normalized into
      * { attachment-0: false, comment-0: false,
      *   attachment-1: false, comment-1: true,
      *   attachment-2: true, comment-2: false
      * }
      */
      denormalize_mandatory: function (field, pads) {
        var options = _.splitTrim(field.attr('multi_choice_options'));
        var vals = _.splitTrim(field.attr('multi_choice_mandatory'));
        var mand = new can.Map();
        _.each(_.zip(options, vals), function (zip) {
          var option = zip[0];
          var val = zip[1];
          var attachment = !!(val & 1 << pads.ATTACHMENT);
          var comment = !!(val & 1 << pads.COMMENT);
          mand.attr('attachment-' + option, attachment);
          mand.attr('comment-' + option, comment);
        });
        return mand;
      },
      /*
      * Normalize field.opts into field.multi_choice_mandatory
      * { attachment-0: true, attachment-1: false,
      *   attachment-1: true, comment-1: true }
      * is normalized into "2, 3" (10b, 11b).
      */
      normalize_mandatory: function (field, pads) {
        var options = _.splitTrim(field.attr('multi_choice_options'));
        var opts = field.attr('opts');
        var mand = $.map(options, function (val) {
          var attach = opts['attachment-' + val] << pads.ATTACHMENT;
          var comment = opts['comment-' + val] << pads.COMMENT;
          return attach | comment;
        });
        return mand.join(',');
      }
    },
    events: {
      init: function () {
        var field = this.scope.attr('field');
        var pads = this.scope.attr('pads');
        var denormalized = this.scope.denormalize_mandatory(field, pads);
        this.scope.field.attr('opts', denormalized);
      },
      '{field.opts} change': function (opts) {
        var field = this.scope.attr('field');
        var pads = this.scope.attr('pads');
        var normalized = this.scope.normalize_mandatory(field, pads);
        this.scope.field.attr('multi_choice_mandatory', normalized);
      }
    }
  });
  can.Component.extend({
    tag: 'add-template-filed',
    template: can.view(GGRC.mustache_path +
      '/assessment_templates/attribute_add_field.mustache'),
    scope: {
      selected: new can.Map(),
      types: [{
        type: 'Dropdown',
        text: 'Type values separated by comma'
      }, {
        type: 'Checkbox',
        text: 'Type label'
      }, {
        type: 'Radio',
        text: 'Type values separated by comma'
      }, {
        type: 'Text',
        text: 'Type description'
      }, {
        type: 'Person',
        text: 'Type description'
      }],
      valueAttrs: ['Dropdown', 'Checkbox', 'Radio'],
      /*
       * Create new field
       *
       * Field must contain value title, type, values and opts.
       * Opts are populated, once we start changing checkbox values
       *
       * @param {Object} scope - current (add-template-field) scope
       * @param {jQuery.Object} el - clicked element
       * @param {Object} ev - click event handler
       */
      addField: function (scope, el, ev) {
        var fields = this.attr('fields');
        var selected = this.attr('selected');
        var title = _.trim(selected.title);
        var type = _.trim(selected.type);
        var values = _.splitTrim(selected.values, {
          unique: true
        }).join(',');

        ev.preventDefault();
        if (!type || !title ||
            (_.contains(scope.valueAttrs, type) && !values)) {
          return;
        }

        fields.push({
          id: this.attr('id'),
          title: title,
          attribute_type: type,
          multi_choice_options: values,
          opts: new can.Map()
        });
        _.each(['title', 'values', 'multi_choice_options'], function (type) {
          selected.attr(type, '');
        });
      }
    },
    events: {
      /*
       * Set default dropdown type on init
       */
      inserted: function () {
        var types = this.scope.attr('types');

        if (!this.scope.attr('selected.type')) {
          this.scope.attr('selected.type', _.first(types).attr('type'));
        }
      }
    },
    helpers: {
      /*
       * Get input placeholder value depended on type
       *
       * @param {Object} options - Mustache options
       */
      placeholder: function (options) {
        var types = this.attr('types');
        var item = _.findWhere(types, {
          type: this.attr('selected.type')
        });
        if (item) {
          return item.text;
        }
      }
    }
  });
})(window.can, window.can.$);

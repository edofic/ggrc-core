/*!
    Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  'use strict';

  GGRC.Components('assessmentTemplates', {
    tag: 'assessment-templates',
    template: can.view(
      GGRC.mustache_path +
      '/components/assessment_templates/assessment_templates.mustache'
    ),
    scope: {
      binding: '@',
      responses: [],
      templates: function () {
        var type = this.attr('type');
        var responses = this.attr('responses');
        var noValue = {
          title: 'No template',
          value: ''
        };
        var items = _.compact(_.map(responses, function (response) {
          if (!response.instance) {
            return;
          }
          if (response.instance.template_object_type !== type) {
            return;
          }
          return {
            title: response.instance.title,
            value: response.instance.id
          };
        }));
        return [noValue].concat(items);
      }
    },
    events: {
      '{scope} type': function () {
        this.scope.attr('assessmentTemplate', '');
      }
    },
    init: function () {
      var instance = this.scope.attr('instance');
      var binding = instance.get_binding(this.scope.attr('binding'));

      binding.refresh_instances().done(function (response) {
        this.scope.attr('responses', response);
      }.bind(this));
    }
  });
})(window.can, window.can.$);

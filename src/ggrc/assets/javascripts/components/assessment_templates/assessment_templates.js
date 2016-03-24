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
      templates: []
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
        this.scope.attr('templates', response);
      }.bind(this));
    }
  });
})(window.can, window.can.$);

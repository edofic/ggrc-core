/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: swizec@reciprocitylabs.com
    Maintained By: swizec@reciprocitylabs.com
*/

can.Component.extend({
  tag: 'assessment-generator-button',
  template: '{{{> /static/mustache/base_objects/generate_assessments_button.mustache}}}',
  scope: {
    audit: null
  },
  events: {
    'a click': function (el, ev) {
      var instance = this.scope.attr('audit') || GGRC.page_instance();
      this._results = null;
      GGRC.Controllers.MapperModal.launch(el, {
        object: 'Audit',
        type: 'Control',
        'join-object-id': this.scope.audit.id,
        'join-mapping': 'program_controls',
        getList: true,
        useTemplates: true,
        relevantTo: [{
          type: instance.program.type,
          id: instance.program.id
        }],
        template: {
          title: '/static/mustache/assessments/generator_title.mustache',
          submitButton: 'Generate Assessments',
          count: 'assessment(s) will be generated'
        },
        callback: this.generateAssessments.bind(this)
      });
    },
    generateAssessments: function (list, options) {
      var que = new RefreshQueue();

      que.enqueue(list).trigger().then(function (items) {
        var results = _.map(items, function (item) {
          return this.generateModel(item);
        }.bind(this));
        this._results = results;

        $.when.apply($, results)
          .then(this.generateCustomAttributes(this, options.assessmentTemplate))
          .then(function () {
            options.context.closeModal();
          })
          .done(this.notify.bind(this))
          .fail(this.notify.bind(this));
      }.bind(this));
    },
    generateCustomAttributes: function (context, template) {
      return function (results) {
        var people = _.map(results, function (assessment) {
          var templates = this.getTemplatePeople(template, assessment.object);
          return _.map(templates, function (person, role) {
            return CMS.Models.Relationship.createAssignee({
              role: role,
              source: person,
              destination: assessment,
              context: assessment.context
            }).save();
          });
        }.bind(this));

        return $.when.apply($, people);
      }.bind(context);
    },
    generateModel: function (object, template) {
      var title = object.title + ' assessment for ' + this.scope.audit.title;
      var data = {
        audit: this.scope.audit,
        object: object.stub(),
        context: this.scope.audit.context,
        title: title,
        owners: [CMS.Models.Person.findInCacheById(GGRC.current_user.id)]
      };
      if (object.test_plan) {
        data.test_plan = object.test_plan;
      }
      return new CMS.Models.Assessment(data).save();
    },
    getTemplatePeople: function (id, object) {
      var model = CMS.Models.AssessmentTemplate.findInCacheById(id);
      var people;
      var types = {
        'Object Owners': function () {
          return this.object_owners;
        },
        'Audit Lead': this.scope.audit.contact,
        'Object Contact': function () {
          return this.contact;
        },
        'Primary Assessor': function () {
          return this.principal_assessor;
        },
        'Secondary Assessor': function () {
          return this.secondary_assessor;
        }
      };

      function getTypes(prop) {
        var type;
        if (_.isArray(prop)) {
          return prop;
        }
        type = types[prop];
        if (_.isFunction(type)) {
          return type.call(object);
        }
        return type;
      }

      if (!model) {
        return;
      }
      people = model.default_people;

      return {
        Assessor: getTypes(people.assessors),
        Verifier: getTypes(people.verifiers)
      };
    },
    notify: function () {
      var success;
      var errors;
      var msg;

      if (!this._results) {
        return;
      }
      success = _.filter(this._results, function (assessment) {
        return !_.isNull(assessment) &&
          !(assessment.state && assessment.state() === 'rejected');
      }).length;
      errors = _.filter(this._results, function (assessment) {
        return assessment.state && assessment.state() === 'rejected';
      }).length;

      if (errors < 1) {
        if (success === 0) {
          msg = {
            success: 'Every Control already has an Assessment!'
          };
        } else {
          msg = {
            success: success + ' Assessments successfully created.'
          };
        }
      } else {
        msg = {
          error: 'An error occured when creating Assessments.'
        };
      }

      $(document.body).trigger('ajax:flash', msg);
    }
  }
});

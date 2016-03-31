/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: swizec@reciprocitylabs.com
    Maintained By: swizec@reciprocitylabs.com
*/

(function (can, $) {
  'use strict';

  GGRC.Components('assessmentGeneratorButton', {
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

        this._results = null;
        que.enqueue(list).trigger().then(function (items) {
          var results = _.map(items, function (item) {
            return this.generateModel(item);
          }.bind(this));
          this._results = results;

          $.when.apply($, results)
            .then(this.generateCustomAttributes(this, items, options.assessmentTemplate))
            .then(function () {
              options.context.closeModal();
            })
            .done(this.notify.bind(this))
            .fail(this.notify.bind(this));
        }.bind(this));
      },
      generateCustomAttributes: function (context, results, template) {
        return function () {
          var list = _.toArray(arguments);
          var dfds = [];

          if (!template) {
            return $.Deferred().resolve();
          }
          _.each(list, function (assessment) {
            var templates;
            assessment.reify();
            templates = this.getTemplate(template, assessment.object);

            _.each(templates.people, function (personArr, role) {
              var assignee;
              if (!personArr) {
                return;
              }
              _.each(personArr, function (person) {
                assignee = CMS.Models.Relationship.createAssignee({
                  role: role,
                  source: person,
                  destination: assessment,
                  context: assessment.context
                }).save();
                dfds.push(assignee);
              });
            });
            can.each(templates.customAttributes, function (customAttr) {
              var data;
              var relationship;
              if (!customAttr) {
                return;
              }
              customAttr.reify();
              data = customAttr.serialize();

              delete data.id;
              data.definition_id = assessment.id;
              data.definition_type = assessment.constructor.table_singular;

              relationship = new CMS.Models.CustomAttributeDefinition(data);
              dfds.push(relationship.save());
            });
          }, this);

          return $.when.apply($, dfds);
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
      getTemplate: function (id, object) {
        var model = CMS.Models.AssessmentTemplate.findInCacheById(id);
        var customAttributes;
        var people;
        var types = {
          'Object Owners': function () {
            return [this.object_owners];
          },
          'Audit Lead': this.scope.audit.contact,
          'Object Contact': function () {
            return [this.contact];
          },
          'Primary Contact': function () {
            return [this.contact];
          },
          'Secondary Contact': function () {
            return [this.secondary_contact];
          },
          'Primary Assessor': function () {
            return [this.principal_assessor];
          },
          'Secondary Assessor': function () {
            return [this.secondary_assessor];
          }
        };

        function getTypes(prop) {
          var type;
          if (_.isArray(prop)) {
            return prop;
          }
          type = types[prop];
          if (_.isFunction(type)) {
            return type.call(object.reify ? object.reify() : object);
          }
          return type;
        }

        if (!model) {
          return;
        }

        model.reify();
        object.reify();
        model.load_custom_attribute_definitions();

        people = model.default_people;
        customAttributes = model.custom_attribute_definitions;

        return {
          people: {
            Assessor: getTypes(people.assessors),
            Verifier: getTypes(people.verifiers)
          },
          customAttributes: customAttributes
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
})(window.can, window.can.$);

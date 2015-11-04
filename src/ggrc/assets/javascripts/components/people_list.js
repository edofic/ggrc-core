/*!
  Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: andraz@reciprocitylabs.com
  Maintained By: andraz@reciprocitylabs.com
*/

(function (can) {
  can.Component.extend({
    tag: "people-list",
    template: can.view(GGRC.mustache_path + "/base_templates/people_list.mustache"),
    viewModel: {
      define: {
        editable: {
          type: "boolean"
        },
        deferred: {
          type: "boolean"
        }
      },
      editable: "@",
      deferred: "@",
      groups: {
        "verifier": [],
        "assignee": [],
        "requester": []
      }
    },
    events: {
      inserted: function () {
        this.scope.instance.get_assignees().then(function (assignees) {
          assignees = _.mapKeys(assignees, function (val, key) {
            return key.toLowerCase();
          });
          this.viewModel.attr("groups", assignees);
          this.viewModel.attr("_groups", assignees);
        }.bind(this));
      },
      ".trigger-save-yo click": function () {
        var instance = this.viewModel.attr("instance"),
            destination, relationships = [];

        destination = {
          context_id: instance.context_id,
          href: instance.href,
          type: instance.type,
          id: instance.id
        };
        this.viewModel.attr("groups").each(function (group, type) {
          group.each(function (entry) {
            var person = entry.person;
            var state = person.person_state,
                states = {
                  "added": "save",
                  "deleted": "destroy"
                },
                model;
            if (!_.contains(_.keys(states), state)) {
              return;
            }
            model = new CMS.Models.Relationship({
              attrs: {
                "AssigneeType": can.capitalize(type)
              },
              source: {
                href: person.href,
                type: person.type,
                id: person.id
              },
              context: null,
              destination: destination
            });
            relationships.push(model[states[state]]());
          });
        });

        $.when.apply($, relationships)
            .done(function () {
              console.log("SUCCESS", arguments);
            });
      }
    }
  });

  can.Component.extend({
    tag: "people-group",
    template: can.view(GGRC.mustache_path + "/base_templates/people_group.mustache"),
    viewModel: {
      define: {
        required: {
          type: "boolean"
        },
        limit: {
          type: "number"
        }
      },
      limit: "@",
      required: "@",
      type: "@"
    },
    events: {
      ".js-trigger--person-delete click": function (el, ev) {
        var person = el.data("person");
        if (person.attr("person_state")) {
          return this.viewModel.attr("people").splice(el.data("index"), 1);
        }
        person.attr("person_state", "deleted");
      },
      ".person-selector input autocomplete:select": function (el, ev, ui) {
        if (_.findWhere(this.viewModel.attr("people"), {id: ui.item.id})) {
          return;
        }
        this.viewModel.attr("people").push(_.extend(ui.item, {
          "person_state": "added"
        }));
      }
    },
    helpers: {
      show_add: function (options) {
        if (this.attr("editable")) {
          if (_.isNull(this.attr("limit")) ||
              this.attr("limit") > this.attr("people").filter(function (person) {
                return !(person.attr("person_state") === "deleted");
              }).length) {
            return options.fn();
          }
        }
        return options.inverse();
      }
    }
  });
})(window.can);

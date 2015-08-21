/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: dan@reciprocitylabs.com
    Maintained By: dan@reciprocitylabs.com
*/


(function(can) {

  can.Model.Cacheable("CMS.Models.TaskGroup", {
    root_object: "task_group",
    root_collection: "task_groups",
    category: "workflow",
    findAll: "GET /api/task_groups",
    findOne: "GET /api/task_groups/{id}",
    create: "POST /api/task_groups",
    update: "PUT /api/task_groups/{id}",
    destroy: "DELETE /api/task_groups/{id}",

    mixins: ["contactable"],
    attributes: {
      workflow: "CMS.Models.Workflow.stub",
      task_group_tasks: "CMS.Models.TaskGroupTask.stubs",
      tasks: "CMS.Models.Task.stubs",
      task_group_objects: "CMS.Models.TaskGroupObject.stubs",
      objects: "CMS.Models.get_stubs",
      modified_by: "CMS.Models.Person.stub",
      context: "CMS.Models.Context.stub",
      end_date: "date",
    },

    tree_view_options: {
      sort_property: 'sort_index',
      header_view: GGRC.mustache_path + "/task_groups/tree_header.mustache",
      footer_view: GGRC.mustache_path + "/task_groups/tree_footer.mustache",
      add_item_view: GGRC.mustache_path + "/task_groups/tree_add_item.mustache"
    },

    init: function() {
      var that = this;
      this._super && this._super.apply(this, arguments);
      this.validateNonBlank("title");
      this.validateNonBlank("contact");
      this.validateContact(["_transient.contact", "contact"]);

      // Refresh workflow people:
      this.bind("created", function(ev, instance) {
        if (instance instanceof that) {
          instance.refresh_all_force('workflow', 'context');
        }
      });
      this.bind("updated", function(ev, instance) {
        if (instance instanceof that) {
          instance.refresh_all_force('workflow', 'context');
        }
      });
      this.bind("destroyed", function(ev, inst) {
        if(inst instanceof that) {
          can.each(inst.task_group_tasks, function(tgt) {
            if (!tgt) {
              return;
            }
            tgt = tgt.reify();
            can.trigger(tgt, "destroyed");
            can.trigger(tgt.constructor, "destroyed", tgt);
          });
          inst.refresh_all_force('workflow', 'context');
        }
      });
    }
  }, {});


  can.Model.Cacheable("CMS.Models.TaskGroupTask", {
    root_object: "task_group_task",
    root_collection: "task_group_tasks",
    findAll: "GET /api/task_group_tasks",
    create: "POST /api/task_group_tasks",
    update: "PUT /api/task_group_tasks/{id}",
    destroy: "DELETE /api/task_group_tasks/{id}",

    mixins : ["contactable"],
    attributes: {
      context: "CMS.Models.Context.stub",
      modified_by: "CMS.Models.Person.stub",
      task_group: "CMS.Models.TaskGroup.stub",
    },

    init: function() {
      var that = this;
      this._super && this._super.apply(this, arguments);
      this.validateNonBlank("title");
      this.validateNonBlank("contact");
      this.validateContact(["_transient.contact", "contact"]);

      this.validate(["start_date", "end_date"], function (newVal, prop) {
        var that = this,
         workflow = GGRC.page_instance(),
         dates_are_valid = true;


        if (!(workflow instanceof CMS.Models.Workflow))
          return;

        // Handle cases of a workflow with start and end dates
        if (workflow.frequency === 'one_time') {
            dates_are_valid =
                 that.start_date && 0 < that.start_date.length
              && that.end_date && 0 < that.end_date.length;
        }

        if (!dates_are_valid) {
          return "Start and/or end date is invalid";
        }
      });

      this.bind("created", function(ev, instance) {
        if (instance instanceof that) {
          if (instance.task_group.reify().selfLink) {
            instance.task_group.reify().refresh();
            instance._refresh_workflow_people();
          }
        }
      });

      this.bind("updated", function(ev, instance) {
        if (instance instanceof that) {
          instance._refresh_workflow_people();
        }
      });

      this.bind("destroyed", function(ev, instance) {
        if (instance instanceof that) {
          if (instance.task_group && instance.task_group.reify().selfLink) {
            instance.task_group.reify().refresh();
            instance._refresh_workflow_people();
          }
        }
      });
    }
  }, {
    init : function() {
      this._super && this._super.apply(this, arguments);
      this.bind('task_group', function (ev, newTask) {
        if (!newTask) {
          return;
        }
        newTask = newTask.reify();
        var task,
            taskGroup = newTask.get_mapping('task_group_tasks').slice(0);

        do {
          task = taskGroup.splice(-1)[0];
          task = task && task.instance;
        } while (task === this);

        if (!task) {
          return;
        }
        can.each('relative_start_day relative_start_month relative_end_day relative_end_month start_date end_date'.split(' '),
          function (prop) {
            if (task[prop] && !this[prop]) {
              this.attr(prop, task.attr(prop) instanceof Date ? new Date(task[prop]) : task[prop]);
            }
        }, this);
      });
    },

    _refresh_workflow_people: function() {
      //  TaskGroupTask assignment may add mappings and role assignments in
      //  the backend, so ensure these changes are reflected.
      var task_group, workflow;
      task_group = this.task_group.reify();
      if (task_group.selfLink) {
        workflow = task_group.workflow.reify();
        return workflow.refresh().then(function(workflow) {
          return workflow.context.reify().refresh();
        });
      }
    },

    response_options_csv: can.compute(function(val) {
      if(val != null) {
        this.attr("response_options", $.map(val.split(","), $.proxy("".trim.call, "".trim)));
      } else {
        return (this.attr("response_options") || []).join(", ");
      }
    })
  });


})(window.can);

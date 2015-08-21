/*!
    Copyright (C) 2014 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: dan@reciprocitylabs.com
    Maintained By: dan@reciprocitylabs.com
*/


(function(can) {

  var _mustache_path,
      overdue_compute;

  overdue_compute = can.compute(function(val) {
    if (this.attr("status") === "Verified") {
      return "";
    }
    var date = moment(this.attr("next_due_date") || this.attr("end_date"));
    if(date && date.isBefore(new Date())){
      return "overdue";
    }
    return "";
  });

  function refresh_attr(instance, attr){
    if (instance.attr(attr).reify().selfLink) {
      instance.attr(attr).reify().refresh();
    }
  }

  function refresh_attr_wrap(attr){
    return function(ev, instance) {
      if (instance instanceof this) {
        refresh_attr(instance, attr);
      }
    };
  }

  _mustache_path = GGRC.mustache_path + "/cycles";
  can.Model.Cacheable("CMS.Models.Cycle", {
    root_object: "cycle",
    root_collection: "cycles",
    category: "workflow",
    findAll: "GET /api/cycles",
    findOne: "GET /api/cycles/{id}",
    create: "POST /api/cycles",
    update: "PUT /api/cycles/{id}",
    destroy: "DELETE /api/cycles/{id}",

    attributes: {
      workflow: "CMS.Models.Workflow.stub",
      cycle_task_groups: "CMS.Models.CycleTaskGroup.stubs",
      modified_by: "CMS.Models.Person.stub",
      context: "CMS.Models.Context.stub"
    },

    tree_view_options: {
      show_view: _mustache_path + "/tree.mustache",
      header_view : _mustache_path + "/tree_header.mustache",
      draw_children: true,
      child_options: [
        {
          model: "CycleTaskGroup",
          mapping: "cycle_task_groups",
          allow_creating: false
        }
      ]
    },
    init: function(){
      var that = this;
      this._super.apply(this, arguments);
      this.bind("created", refresh_attr_wrap('workflow').bind(this));
      this.bind("destroyed", function(ev, inst) {
        if(inst instanceof that) {
          can.each(inst.cycle_task_groups, function(cycle_task_group) {
            if (!cycle_task_group) {
              return;
            }
            cycle_task_group = cycle_task_group.reify();
            can.trigger(cycle_task_group, "destroyed");
            can.trigger(cycle_task_group.constructor, "destroyed", cycle_task_group);
          });
        }
      });
    }
  }, {
    init: function() {
      var that = this;
      this._super.apply(this, arguments);
      this.bind("status", function(ev, newVal) {
        if (newVal === 'Verified') {
          new RefreshQueue().enqueue(this.workflow.reify()).trigger().then(function(wfs) {
            return wfs[0].get_binding("owners").refresh_instances();
          }).then(function(wf_owner_bindings) {
            var current_user = CMS.Models.get_instance(GGRC.current_user);
            if(~can.inArray(
              current_user,
              can.map(wf_owner_bindings, function(wf_owner_binding) {
                return wf_owner_binding.instance;
              })
            )) {
              that.refresh().then(function() {
                if(that.attr("is_current")) {
                  that.attr("is_current", false);
                  that.save();
                }
              });
            }
          });
        }
      });
    },
    overdue: overdue_compute,
  });

  _mustache_path = GGRC.mustache_path + "/cycle_task_entries";
  can.Model.Cacheable("CMS.Models.CycleTaskEntry", {
    root_object: "cycle_task_entry",
    root_collection: "cycle_task_entries",
    category: "workflow",
    findAll: "GET /api/cycle_task_entries",
    findOne: "GET /api/cycle_task_entries/{id}",
    create: "POST /api/cycle_task_entries",
    update: "PUT /api/cycle_task_entries/{id}",
    destroy: "DELETE /api/cycle_task_entries/{id}",

    attributes: {
      cycle_task_group_object_task: "CMS.Models.CycleTaskGroupObjectTask.stub",
      modified_by: "CMS.Models.Person.stub",
      context: "CMS.Models.Context.stub",
      object_documents: "CMS.Models.ObjectDocument.stubs",
      documents: "CMS.Models.Document.stubs",
      cycle: "CMS.Models.Cycle.stub"
    },

    tree_view_options: {
      show_view: _mustache_path + "/tree.mustache",
      footer_view: _mustache_path + "/tree_footer.mustache",
      child_options: [{
        //0: Documents
        model: "Document",
        mapping: "documents",
        show_view: _mustache_path + "/documents.mustache",
        footer_view: _mustache_path + "/documents_footer.mustache"
      }],
    },
    init: function(){
      this._super.apply(this, arguments);
      this.bind("created",
        refresh_attr_wrap("cycle_task_group_object_task").bind(this));
      this.validateNonBlank("description");
    }
  }, {
    workflowFolder: function() {
      return this.refresh_all('cycle', 'workflow', 'folders').then(function(folders){
        if (folders.length === 0) {
          // Workflow folder has not been assigned
          return null;
        }
        return folders[0].instance;
      }, function(result) {
        return result;
      });
    }
  });


  _mustache_path = GGRC.mustache_path + "/cycle_task_groups";
  can.Model.Cacheable("CMS.Models.CycleTaskGroup", {
    root_object: "cycle_task_group",
    root_collection: "cycle_task_groups",
    category: "workflow",
    findAll: "GET /api/cycle_task_groups",
    findOne: "GET /api/cycle_task_groups/{id}",
    create: "POST /api/cycle_task_groups",
    update: "PUT /api/cycle_task_groups/{id}",
    destroy: "DELETE /api/cycle_task_groups/{id}",

    attributes: {
      cycle: "CMS.Models.Cycle.stub",
      task_group: "CMS.Models.TaskGroup.stub",
      cycle_task_group_objects: "CMS.Models.CycleTaskGroupObject.stubs",
      cycle_task_group_tasks: "CMS.Models.CycleTaskGroupObjectTask.stubs",
      modified_by: "CMS.Models.Person.stub",
      context: "CMS.Models.Context.stub"
    },

    tree_view_options: {
      sort_property: 'sort_index',
      show_view: _mustache_path + "/tree.mustache",
      //footer_view: _mustache_path + "/tree_footer.mustache",
      draw_children: true,
      child_options: [
        {
          title: 'Tasks',
          model: "CycleTaskGroupObjectTask",
          mapping: "cycle_task_group_tasks",
          allow_creating: false
        }
      ]
    },

    init: function() {
      var that = this;
      this._super.apply(this, arguments);

      this.validateNonBlank("contact");
      this.validateContact(["_transient.contact", "contact"]);
      this.bind("updated", function(ev, instance) {
        if (instance instanceof that) {
          var dfd = instance.refresh_all_force('cycle', 'workflow');
          dfd.then(function(){
            return $.when(
              instance.refresh_all_force('cycle_task_group_objects'),
              instance.refresh_all_force('cycle_task_group_tasks')
            );
          });
        }
      });
      this.bind("destroyed", function(ev, inst) {
        if(inst instanceof that) {
          can.each(inst.cycle_task_group_objects, function(ctgo) {
            if (!ctgo) {
              return;
            }
            ctgo = ctgo.reify();
            can.trigger(ctgo, "destroyed");
            can.trigger(ctgo.constructor, "destroyed", ctgo);
          });
          can.each(inst.cycle_task_group_tasks, function(ctgt) {
            if (!ctgt) {
              return;
            }
            ctgt = ctgt.reify();
            can.trigger(ctgt, "destroyed");
            can.trigger(ctgt.constructor, "destroyed", ctgt);
          });
        }
      });
    }
  }, {
    overdue: overdue_compute,
  });


  _mustache_path = GGRC.mustache_path + "/cycle_task_group_objects";
  can.Model.Cacheable("CMS.Models.CycleTaskGroupObject", {
    root_object: "cycle_task_group_object",
    root_collection: "cycle_task_group_objects",
    category: "workflow",
    findAll: "GET /api/cycle_task_group_objects",
    findOne: "GET /api/cycle_task_group_objects/{id}",
    create: "POST /api/cycle_task_group_objects",
    update: "PUT /api/cycle_task_group_objects/{id}",
    destroy: "DELETE /api/cycle_task_group_objects/{id}",

    attributes: {
      cycle_task_group: "CMS.Models.CycleTaskGroup.stub",
      task_group_object: "CMS.Models.TaskGroupObject.stub",
      cycle_task_group_object_tasks:
        "CMS.Models.CycleTaskGroupObjectTask.stubs",
      modified_by: "CMS.Models.Person.stub",
      context: "CMS.Models.Context.stub",
      cycle: "CMS.Models.Cycle.stub",
      object: "CMS.Models.get_stub",
    },

    tree_view_options: {
      show_view: _mustache_path + "/tree.mustache",
      //footer_view: _mustache_path + "/tree_footer.mustache",
      draw_children: false,
      child_options: [
        {
          model: "CycleTaskGroupObjectTask",
          mapping: "cycle_task_group_object_tasks",
          allow_creating: false
        }
      ]
    },

    init: function() {
      this._super.apply(this, arguments);
      this.bind("updated", refresh_attr_wrap("cycle_task_group").bind(this));
    }
  }, {
    overdue: overdue_compute
  });


  _mustache_path = GGRC.mustache_path + "/cycle_task_group_object_tasks";
  can.Model.Cacheable("CMS.Models.CycleTaskGroupObjectTask", {
    root_object: "cycle_task_group_object_task",
    root_collection: "cycle_task_group_object_tasks",
    category: "workflow",
    findAll: "GET /api/cycle_task_group_object_tasks",
    findOne: "GET /api/cycle_task_group_object_tasks/{id}",
    create: "POST /api/cycle_task_group_object_tasks",
    update: "PUT /api/cycle_task_group_object_tasks/{id}",
    destroy: "DELETE /api/cycle_task_group_object_tasks/{id}",

    attributes: {
      cycle_task_group_object: "CMS.Models.CycleTaskGroupObject.stub",
      cycle_task_group: "CMS.Models.CycleTaskGroup.stub",
      task_group_task: "CMS.Models.TaskGroupTask.stub",
      cycle_task_entries: "CMS.Models.CycleTaskEntry.stubs",
      modified_by: "CMS.Models.Person.stub",
      contact: "CMS.Models.Person.stub",
      context: "CMS.Models.Context.stub",
      cycle: "CMS.Models.Cycle.stub",
    },

    tree_view_options: {
      sort_property: 'sort_index',
      show_view: _mustache_path + "/tree.mustache",
      attr_list : [
        {attr_title: 'Title', attr_name: 'title'},
        {attr_title: 'Mapped Object', attr_name: 'mapped_object', attr_sort_field: 'cycle_task_group_object.title'},
        {attr_title: 'Workflow', attr_name: 'workflow', attr_sort_field: 'cycle.workflow.title'},
        {attr_title: 'State', attr_name: 'status'},
        {attr_title: 'Assignee', attr_name: 'assignee', attr_sort_field: 'contact.name|email'},
        {attr_title: 'Start Date', attr_name: 'start_date'},
        {attr_title: 'End Date', attr_name: 'end_date'},
        {attr_title: 'Last Updated', attr_name: 'updated_at'}
      ],
      display_attr_names : ['title', 'mapped_object', 'workflow'],
      mandatory_attr_name : ['title'],
      draw_children: true,
      child_options: [
        {
          model: "CycleTaskEntry",
          mapping: "cycle_task_entries",
          allow_creating: true
        },
        {
          model: "CycleTaskGroupObject",
          mapping: "cycle_task_group_object",
          allow_creating: true
        }
      ]
    },

    init: function() {
      var that = this;
      this._super.apply(this, arguments);
      this.validateNonBlank("title");
      this.validateNonBlank("contact");
      this.validateContact(["_transient.contact", "contact"]);

      this.validate(['start_date', 'end_date'], function (newVal, prop) {
        if (!(this.start_date && this.end_date)) {
          return "Start and/or end date is invalid";
        }
      });

      this.bind("updated", function(ev, instance) {
        if (instance instanceof that) {
          instance.refresh_all_force('cycle_task_group_object', 'task_group_object', 'object').then(function(object) {
            return instance.refresh_all_force('cycle_task_group', 'cycle', 'workflow');
          });
        }
      });
    }
  }, {
    overdue: overdue_compute,
    workflow: function() {
      return this.refresh_all('cycle', 'workflow').then(function(workflow){
        return workflow;
      });
    },
    object: function() {
      return this.refresh_all('cycle_task_group_object', 'task_group_object', 'object').then(function(object){
        return object;
      });
    },
    response_options_csv: can.compute(function(val) {
      if(val != null) {
        this.attr("response_options", $.map(val.split(","), $.proxy("".trim.call, "".trim)));
      } else {
        return (this.attr("response_options") || []).join(", ");
      }
    }),

    selected_response_options_csv: can.compute(function(val) {
      if(val != null) {
        this.attr("selected_response_options", $.map(val.split(","), $.proxy("".trim.call, "".trim)));
      } else {
        return (this.attr("selected_response_options") || []).join(", ");
      }
    }),

    get_filter_vals: function(){
      var filter_vals = can.Model.Cacheable.prototype.get_filter_vals;
      var mappings = jQuery.extend({}, this.class.filter_mappings, {
        'task title': 'title'
      });

      var vals = filter_vals.apply(this, [this.class.filter_keys, mappings]);

      try {
        vals['workflows'] = this.cycle.reify().workflow.reify().title;
        if (this.cycle_task_group_object){
          vals['mapped objects'] = this.cycle_task_group_object.reify().title;
        }
      } catch (e) {}

      return vals;
    }

  });

})(window.can);

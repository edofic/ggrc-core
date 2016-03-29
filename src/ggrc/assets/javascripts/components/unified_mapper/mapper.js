/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  'use strict';

  var MapperModel = GGRC.Models.MapperModel = can.Map({
    type: 'AllObject', // We set default as All Object
    contact: {},
    deferred: '@',
    deferred_to: '@',
    term: '',
    object: '',
    model: {},
    bindings: {},
    is_loading: false,
    page_loading: false,
    is_saving: false,
    all_selected: false,
    assessmentTemplate: '',
    search_only: false,
    join_object_id: '',
    selected: new can.List(),
    entries: new can.List(),
    options: new can.List(),
    relevant: new can.List(),
    get_instance: can.compute(function () {
      return CMS.Models.get_instance(
        this.attr('object'),
        this.attr('join_object_id')
      );
    }),

    get_binding_name: function (instance, plural) {
      return (instance.has_binding(plural) ? '' : 'related_') + plural;
    },
    model_from_type: function (type) {
      var types = _.reduce(_.values(this.types()), function (memo, val) {
        if (val.items) {
          return memo.concat(val.items);
        }
        return memo;
      }, []);
      return _.findWhere(types, {value: type});
    },
    get_forbidden: function (type) {
      var forbidden = {
        Program: ['Audit'],
        Audit: ['Assessment', 'Program', 'Request'],
        Assessment: [],
        Request: ['Workflow', 'TaskGroup', 'Person']
      };
      if (this.attr('getList')) {
        return ['Workflow', 'Audit', 'AssessmentTemplate',
          'Assessment', 'Request'];
      }
      return forbidden[type] ? forbidden[type] : [];
    },
    get_whitelist: function () {
      var whitelisted = [
        'TaskGroupTask', 'TaskGroup', 'CycleTaskGroupObjectTask'
      ];
      return this.attr('search_only') ? whitelisted : [];
    },
    types: can.compute(function () {
      var selectorList;
      var object = this.attr('getList') ? 'MultitypeSearch' : this.object;
      var canonical = GGRC.Mappings.get_canonical_mappings_for(object);
      var list = GGRC.tree_view.base_widgets_by_type[object];
      var forbidden = this.get_forbidden(object);
      var whitelist = this.get_whitelist();
      var groups = {
        all_objects: {
          name: 'All Objects',
          value: 'AllObject',
          plural: 'allobjects',
          table_plural: 'allobjects',
          singular: 'AllObject',
          models: []
        },
        entities: {
          name: 'People/Groups',
          items: []
        },
        business: {
          name: 'Assets/Business',
          items: []
        },
        governance: {
          name: 'Governance',
          items: []
        }
      };
      selectorList = _.intersection.apply(
        _, _.compact([_.keys(canonical), list]));

      selectorList = _.union(selectorList, whitelist);

      can.each(selectorList, function (modelName) {
        var cmsModel;
        var group;

        if (!modelName ||
            !CMS.Models[modelName] ||
            ~forbidden.indexOf(modelName)) {
          return;
        }

        cmsModel = CMS.Models[modelName];
        group = !groups[cmsModel.category] ? 'governance' : cmsModel.category;

        groups[group].items.push({
          name: cmsModel.title_plural,
          value: cmsModel.shortName,
          singular: cmsModel.shortName,
          plural: cmsModel.title_plural.toLowerCase().replace(/\s+/, '_'),
          table_plural: cmsModel.table_plural,
          title_singular: cmsModel.title_singular,
          isSelected: cmsModel.shortName === this.type
        });
        groups.all_objects.models.push(cmsModel.shortName);
      }, this);
      if (groups.all_objects.models.length < 2) {
        delete groups.all_objects;
      }
      return groups;
    })
  });

  can.Component.extend({
    tag: 'modal-mapper',
    template: can.view(GGRC.mustache_path + '/modals/mapper/base.mustache'),
    scope: function (attrs, parentScope, el) {
      var $el = $(el);
      var data = {};
      var id = Number($el.attr('join-object-id'));
      var object = $el.attr('object');
      var type = $el.attr('type');
      var treeView = GGRC.tree_view.sub_tree_for[object];

      if ($el.attr('search-only')) {
        data.search_only = /true/i.test($el.attr('search-only'));
      }

      if (object) {
        data.object = object;
      }

      type = CMS.Models[type] && type;
      if (!data.search_only) {
        if (type) {
          data.type = type;
        } else if (id === GGRC.page_instance().id || !treeView) {
          data.type = 'AllObject';
        } else {
          data.type = treeView.display_list[0];
        }
      }

      if (id || GGRC.page_instance()) {
        data.join_object_id = id || GGRC.page_instance().id;
      }

      return {
        mapper: new MapperModel(_.extend(data, {
          relevantTo: parentScope.attr('relevantTo'),
          callback: parentScope.attr('callback'),
          getList: parentScope.attr('getList'),
          useTemplates: parentScope.attr('useTemplates')
        })),
        template: parentScope.attr('template')
      };
    },

    events: {
      inserted: function () {
        this.setModel();
        this.setBinding();
      },
      closeModal: function () {
        this.scope.attr('mapper.is_saving', false);
        // there is some kind of a race condition when filling the treview with new elements
        // so many don't get rendered. To solve it, at the end of the loading
        // we refresh the whole tree view. Other solutions could be to batch add the objects.
        $('.cms_controllers_tree_view:visible').each(function () {
          // TODO: This is terrible solution, but it's only way to refresh all tree views on page
          var control = $(this).control();
          if (control) {
            control.reload_list();
          }
        });

        // TODO: Find proper way to dismiss the modal
        this.element.find('.modal-dismiss').trigger('click');
      },
      deferredSave: function () {
        var source = this.scope.attr('deferred_to').instance ||
                     this.scope.attr('mapper.object');

        var data = {
          multi_map: true,
          arr: _.compact(_.map(
            this.scope.attr('mapper.selected'),
            function (desination) {
              var isAllowed = GGRC.Utils.allowed_to_map(source, desination);
              var inst = _.find(
                this.scope.attr('mapper.entries'),
                function (entry) {
                  return (entry.instance.id === desination.id &&
                          entry.instance.type === desination.type);
                }
              );

              if (inst && isAllowed) {
                return inst.instance;
              }
            }.bind(this)
          ))
        };

        this.scope.attr('deferred_to').controller.element.trigger(
          'defer:add', [data, {map_and_save: true}]);
        this.closeModal();
      },
      '.add-button .btn modal:added': 'addNew',
      '.add-button .btn modal:success': 'addNew',
      addNew: function (el, ev, model) {
        var entries = this.scope.attr('mapper.entries');
        var getBindingName = this.scope.attr('mapper').get_binding_name;
        var binding;
        var item;
        var mapping;
        var selected;

        selected = this.scope.attr('mapper.get_instance');
        binding = selected.get_binding(
          getBindingName(selected, model.constructor.table_plural));
        mapping = GGRC.Mappings.get_canonical_mapping_name(
          selected.type, model.type);
        mapping = model.get_mapping(mapping);

        item = new GGRC.ListLoaders.MappingResult(model, mapping, binding);
        item.append = true;
        entries.unshift(item);
      },
      '.modal-footer .btn-map click': function (el, ev) {
        var callback = this.scope.attr('mapper.callback');
        var type = this.scope.attr('mapper.type');
        var object = this.scope.attr('mapper.object');
        var assessmentTemplate = this.scope.attr('mapper.assessmentTemplate');
        var isAllObject = type === 'AllObject';
        var instance = CMS.Models[object].findInCacheById(
          this.scope.attr('mapper.join_object_id'));
        var mapping;
        var Model;
        var data = {};
        var defer = [];
        var que = new RefreshQueue();

        ev.preventDefault();
        if (el.hasClass('disabled')) {
          return;
        }
        if (this.scope.attr('mapper.getList')) {
          this.scope.attr('mapper.is_saving', true);
          return callback(this.scope.attr('mapper.selected'), {
            type: type,
            target: object,
            instance: instance,
            assessmentTemplate: assessmentTemplate,
            context: this
          });
        }

        // TODO: Figure out nicer / proper way to handle deferred save
        if (this.scope.attr('deferred')) {
          return this.deferredSave();
        }
        this.scope.attr('mapper.is_saving', true);

        que.enqueue(instance).trigger().done(function (inst) {
          data.context = instance.context || null;
          _.each(this.scope.attr('mapper.selected'), function (destination) {
            var modelInstance;
            var isMapped = GGRC.Utils.is_mapped(instance, destination);
            var isAllowed = GGRC.Utils.allowed_to_map(instance, destination);

            if (isMapped || !isAllowed) {
              return;
            }
            mapping = GGRC.Mappings.get_canonical_mapping(
              object, isAllObject ? destination.type : type);
            Model = CMS.Models[mapping.model_name];
            data[mapping.object_attr] = {
              href: instance.href,
              type: instance.type,
              id: instance.id
            };
            data[mapping.option_attr] = destination;
            modelInstance = new Model(data);
            defer.push(modelInstance.save());
          }, this);

          $.when.apply($, defer)
            .fail(function (response, message) {
              $('body').trigger('ajax:flash', {error: message});
            })
            .always(function () {
              this.scope.attr('mapper.is_saving', false);
              this.closeModal();
            }.bind(this));
        }.bind(this));
      },

      setBinding: function () {
        var binding;
        var getBindingName = this.scope.attr('mapper').get_binding_name;
        var selected = this.scope.attr('mapper.get_instance');
        var tablePlural = getBindingName(
          selected, this.scope.attr('mapper.model.table_plural'));

        if (this.scope.attr('mapper.search_only')) {
          return;
        }

        if (!selected.has_binding(tablePlural)) {
          return;
        }

        binding = selected.get_binding(tablePlural);
        binding.refresh_list().then(function (mappings) {
          can.each(mappings, function (mapping) {
            this.scope.attr('mapper.bindings')[mapping.instance.id] = mapping;
          }, this);
        }.bind(this));
      },
      setModel: function () {
        var type = this.scope.attr('mapper.type');
        var types = this.scope.attr('mapper.types');

        if (~['All Object', 'AllObject'].indexOf(type)) {
          return this.scope.attr('mapper.model', types.all_objects);
        }
        this.scope.attr(
          'mapper.model', this.scope.mapper.model_from_type(type));
      },
      '{mapper} type': function () {
        this.scope.attr('mapper.term', "");
        this.scope.attr('mapper.contact', {});
        if (!this.scope.attr('mapper.getList')) {
          this.scope.attr('mapper.relevant').replace([]);
        }
        this.setModel();
        this.setBinding();
      },

      '#search-by-owner autocomplete:select': function (el, ev, data) {
        this.scope.attr('mapper.contact', data.item);
      },

      '#search-by-owner keyup': function (el, ev) {
        if (!el.val()) {
          this.scope.attr('mapper.contact', {});
        }
      },

      allSelected: function () {
        var selected = this.scope.attr('mapper.selected');
        var entries = this.scope.attr('mapper.entries');

        if (!entries.length && !selected.length) {
          return;
        }
        this.scope.attr(
          'mapper.all_selected', selected.length === entries.length);
      },
      '{mapper.entries} length': 'allSelected',
      '{mapper.selected} length': 'allSelected'
    },

    helpers: {
      get_title: function (options) {
        var instance = this.attr('mapper.get_instance');
        return (
          (instance && instance.title) ?
          instance.title :
          this.attr('mapper.object')
        );
      },
      get_object: function (options) {
        var type = CMS.Models[this.attr('mapper.type')];
        if (type && type.title_plural) {
          return type.title_plural;
        }
        return 'Objects';
      },
      loading_or_saving: function (options) {
        if (this.attr('mapper.page_loading') || this.attr('mapper.is_saving')) {
          return options.fn();
        }
        return options.inverse();
      }
    }
  });
})(window.can, window.can.$);

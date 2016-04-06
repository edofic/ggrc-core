/*
 * Copyright (C) 2013-2014 Google Inc., authors, and contributors <see AUTHORS file>
 * Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 * Created By: brad@reciprocitylabs.com
 * Maintained By: brad@reciprocitylabs.com
 */
(function (can, $) {
  function attachFiles(files, type, object) {
    return new RefreshQueue().enqueue(files).trigger().then(function (files) {
      can.each(files, function (file) {
        // Since we attach_files can re-use existing file references
        // from the picker, check for that case.
        var link = {link: file.alternateLink};
        CMS.Models.Document.findAll(link).done(function (d) {
          if (d.length) {
            new CMS.Models.ObjectDocument({
              context: object.context || {id: null},
              documentable: object,
              document: d[0]
            }).save();
          } else {
            if (type === 'folders') {
              new CMS.Models.ObjectFolder({
                folderable: object,
                folder: file,
                context: object.context || {id: null}
              }).save();
              return;
            }
            // File not found, make Document object.
            new CMS.Models.Document({
              context: object.context || {id: null},
              title: file.title,
              link: file.alternateLink
            }).save().then(function (doc) {
              return $.when([
                new CMS.Models.ObjectDocument({
                  context: object.context || {id: null},
                  documentable: object,
                  document: doc
                }).save(),
                new CMS.Models.ObjectFile({
                  context: object.context || {id: null},
                  file: file,
                  fileable: doc
                }).save()
              ]);
            });
          }
        });
      });
    });
  }

  can.Component.extend({
    tag: 'ggrc-gdrive-folder-picker',
    template: can.view(GGRC.mustache_path + '/gdrive/gdrive_folder.mustache'),
    scope: {
      no_detach: '@',
      deferred: '@',
      tabindex: '@',
      placeholder: '@',
      readonly: '@',

      /**
       * Helper method for unlinking all object folders currently linked to the
       * given instance.
       *
       * @param {Object} instance - an instance of a model object (e.g Audit) for
       *   which to unlink the object folders from
       * @return {Object} - a deferred object that is resolved when the instance's
       *   object folders have been successfully unlinked from it
       */
      _unlinkObjFolders: function (instance) {
        var deleteDeferred;

        // make sure the object_folders list is up to date, and then delete all
        // existing upload folders currently mapped to the instance
        deleteDeferred = instance.refresh().then(function () {
          var deferredDeletes;
          var objFolders = instance.object_folders;

          // delete folders and collect their deferred delete objects
          deferredDeletes = $.map(objFolders, function (folder) {
            var deferredDestroy = folder
              .reify()
              .refresh()
              .then(function (folderRefreshed) {
                return folderRefreshed.destroy();
              });

            return deferredDestroy;
          });

          return $.when.apply($, deferredDeletes);
        });

        return deleteDeferred;
      }
    },
    events: {
      init: function () {
        var that = this;
        this.element.removeAttr('tabindex');
        this.scope.attr('_folder_change_pending', true);
        this.scope.instance.get_binding('folders').refresh_instances().then(that._ifNotRemoved(function (folders) {
          that.scope.attr('current_folder', folders[0] ? folders[0].instance : null);
          that.options.folder_list = folders;
          that.on();
        }), that._ifNotRemoved(function (error) {
          that.scope.removeAttr('_folder_change_pending');
          that.scope.attr('folder_error', error);
          that.options.instance = that.scope.instance;
          that.on();
        })).then(function () {
          // Try to load extended folders if main folder was not found
          if (!that.scope.instance.get_binding('extended_folders') || that.scope.current_folder || that.scope.folder_error) {
            that.scope.removeAttr('_folder_change_pending');
            return;
          }
          that.scope.instance.get_binding('extended_folders').refresh_instances().then(that._ifNotRemoved(function (folders) {
            that.scope.removeAttr('_folder_change_pending');
            that.scope.attr('current_folder', folders[0] ? folders[0].instance : null);
            that.options.folder_list = folders;
            that.on();
          }), that._ifNotRemoved(function (error) {
            that.scope.removeAttr('_folder_change_pending');
            that.scope.attr('folder_error', error);
            that.options.instance = that.scope.instance;
            that.on();
          }));
        });
      },
      '{instance} change': function (inst, ev, attr) {
        var that = this;
        // Error recovery from previous refresh_instances error when we couldn't set up the binding.
        if (this.scope.folder_error) {
          this.scope.instance.get_binding('folders').refresh_instances().then(function (folders) {
            that.scope.attr('current_folder', folders[0] ? folders[0].instance : null);
            that.scope.removeAttr('_folder_change_pending');
            that.options.folder_list = folders;
            delete that.options.instance;
            that.on();
          }, function (error) {
            that.scope.removeAttr('_folder_change_pending');
            that.scope.attr('folder_error', error);
          }).then(function () {
            // Try to load extended folders if main folder was not found
            if (!that.scope.instance.get_binding('extended_folders') || that.scope.current_folder || that.scope.folder_error) {
              that.scope.removeAttr('_folder_change_pending');
              return;
            }
            that.scope.instance.get_binding('extended_folders').refresh_instances().then(that._ifNotRemoved(function (folders) {
              that.scope.removeAttr('_folder_change_pending');
              that.scope.attr('current_folder', folders[0] ? folders[0].instance : null);
              that.options.folder_list = folders;
              delete that.options.instance;
              that.on();
            }), that._ifNotRemoved(function (error) {
              that.scope.removeAttr('_folder_change_pending');
              that.scope.attr('folder_error', error);
            }));
          });
        }
      },
      '{folder_list} change': function () {
        var pjlength;
        var item = this.scope.instance.get_binding('folders').list[0];
        if (!item && this.scope.instance.get_binding('extended_folders')) {
          item = this.scope.instance.get_binding('extended_folders').list[0];
        }
        this.scope.attr('current_folder', item ? item.instance : null);

        if (this.scope.deferred && this.scope.instance._pending_joins) {
          pjlength = this.scope.instance._pending_joins.length;
          can.each(this.scope.instance._pending_joins.slice(0).reverse(), function (pj, i) {
            if (pj.through === 'folders') {
              this.scope.instance._pending_joins.splice(pjlength - i - 1, 1);
            }
          });
        }
      },

      /**
       * Handle a click on the button for detaching an upload folder from
       * a model instance (e.g. an Audit).
       *
       * @param {Object} el - The jQuery-wrapped DOM element on which the event
       *   has been triggered.
       * @param {Object} ev - The event object.
       */
      'a[data-toggle=gdrive-remover] click' : function (el, ev) {
        var scope = this.scope,
          dfd;

        if (scope.deferred) {
          if (scope.current_folder) {
            scope.instance.mark_for_deletion('folders', scope.current_folder);
          } else if (scope.folder_error && !scope.instance.object_folders) {
            // If object_folders are not defined for this instance the error
            // is from extended_folders, we just need to clear folder_error
            // in this case.
            scope.attr('folder_error', null);
          } else {
            can.each(scope.instance.object_folders.reify(), function (object_folder) {
              object_folder.refresh().then(function (of) {
                scope.instance.mark_for_deletion('object_folders', of);
              });
            });
          }
          dfd = $.when();
        } else {
          dfd = scope._unlinkObjFolders(scope.instance);
        }

        dfd.then(function () {
          if (scope.instance.get_binding('extended_folders')) {
            $.when(
              scope.instance.get_binding('folders').refresh_instances(),
              scope.instance.get_binding('extended_folders').refresh_instances()
            ).then(function (local_bindings, extended_bindings) {
              var self_folders, remote_folders;
              self_folders = can.map(local_bindings, function (folder_binding) {
                return folder_binding.instance;
              });
              remote_folders = can.map(extended_bindings, function (folder_binding) {
                return ~can.inArray(folder_binding.instance, self_folders) ? undefined : folder_binding.instance;
              });

              scope.attr('current_folder', remote_folders[0] || null);
            });
          } else {
            scope.attr('current_folder', null);
          }

          scope.attr('folder_error', null);
        });
      },

      'a[data-toggle=gdrive-picker] click' : function (el, ev) {

        var dfd = GGRC.Controllers.GAPI.authorize(['https://www.googleapis.com/auth/drive.file']),
          folder_id = el.data('folder-id');
        dfd.then(function () {
          gapi.load('picker', {'callback': createPicker});

          // Create and render a Picker object for searching images.
          function createPicker() {
            window.oauth_dfd.done(function (token, oauth_user) {
              var dialog,
                picker = new google.picker.PickerBuilder()
                    .setOAuthToken(gapi.auth.getToken().access_token)
                    .setDeveloperKey(GGRC.config.GAPI_KEY)
                    .setCallback(pickerCallback);

              if (el.data('type') === 'folders') {
                var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                  .setMimeTypes(['application/vnd.google-apps.folder'])
                  .setSelectFolderEnabled(true);
                picker.setTitle('Select folder');
                picker.addView(view);
              }
              else {
                var docsUploadView = new google.picker.DocsUploadView()
                      .setParent(folder_id),
                  docsView = new google.picker.DocsView()
                      .setParent(folder_id);

                picker.addView(docsUploadView)
                  .addView(docsView)
                  .enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
              }
              picker = picker.build();
              picker.setVisible(true);
              // use undocumented fu to make the Picker be "modal" - https://b2.corp.google.com/issues/18628239
              // this is the "mask" displayed behind the dialog box div
              $('div.picker-dialog-bg').css('zIndex', 4000);  // there are multiple divs of that sort
              // and this is the dialog box modal div, which we must display on top of our modal, if any

              dialog = GGRC.Utils.getPickerElement(picker);
              if (dialog) {
                dialog.style.zIndex = 4001; // our modals start with 2050
              }
            });
          }

          function pickerCallback(data) {

            var files, model,
              PICKED = google.picker.Action.PICKED,
              ACTION = google.picker.Response.ACTION,
              DOCUMENTS = google.picker.Response.DOCUMENTS,
              CANCEL = google.picker.Action.CANCEL;

            if (data[ACTION] === PICKED) {
              if (el.data('type') === 'folders') {
                model = CMS.Models.GDriveFolder;
              } else {
                model = CMS.Mdoels.GDriveFile;
              }
              files = model.models(data[DOCUMENTS]);
              el.trigger('picked', {
                files: files
              });
            }
            else if (data[ACTION] === CANCEL) {
              el.trigger('rejected');
            }
          }
        });
      },

      /**
       * Handle an event of the user picking a new GDrive upload folder.
       *
       * @param {Object} el - The jQuery-wrapped DOM element on which the event
       *   has been triggered.
       * @param {Object} ev - The event object.
       * @param {Object} data - Additional event data.
       *   @param {Array} data.files - The list of GDrive folders the user picked
       *     in the GDrive folder picker modal.
       */
      '.entry-attachment picked': function (el, ev, data) {
        var dfd,
          files = data.files || [],
          scope = this.scope,
          refreshDeferred;  // instance's deferred object_folder refresh action

        if (el.data('type') === 'folders'
           && files.length
           && files[0].mimeType !== 'application/vnd.google-apps.folder'
        ) {
          $(document.body).trigger('ajax:flash', {
            error: 'ERROR: Something other than a Drive folder was chosen for a folder slot.  Please choose a folder.'
          });
          return;
        }

        this.scope.attr('_folder_change_pending', true);

        if (!el.data('replace')) {
          dfd = $.when();
        } else {
          if (scope.deferred) {
            if (scope.current_folder) {
              scope.instance.mark_for_deletion('folders', scope.current_folder);
            } else if (scope.folder_error && !scope.instance.object_folders) {
              // If object_folders are not defined for this instance the error
              // is from extended_folders, we just need to clear folder_error
              // in this case.
              scope.attr('folder_error', null);
            } else {
              can.each(scope.instance.object_folders.reify(), function (object_folder) {
                object_folder.refresh().then(function (of) {
                  scope.instance.mark_for_deletion('object_folders', of);
                });
              });
            }
            dfd = $.when();
          } else {
            dfd = scope._unlinkObjFolders(scope.instance);
          }
        }

        return dfd.then(function () {
          if (scope.deferred) {
            return $.when.apply(
              $,
              can.map(files, function (file) {
                scope.instance.mark_for_addition('folders', file);
                return file.refresh();
              })
            );
          } else {
            return attachFiles(
              files,
              el.data('type'),
              scope.instance
              );
          }
        }).then(function () {
          scope.attr('_folder_change_pending', false);
          scope.attr('folder_error', null);
          scope.attr('current_folder', files[0]);
          if (scope.deferred && scope.instance._transient) {
            scope.instance.attr('_transient.folder', files[0]);
          }
        });
      }
    }
  });

  can.Component.extend({
    tag: 'ggrc-gdrive-picker-launcher',
    template: can.view(GGRC.mustache_path + '/gdrive/gdrive_file.mustache'),
    scope: {
      instance: null,
      folder_instance: null,
      deferred: '@',
      icon: '@',
      link_text: '@',
      link_class: '@',
      click_event: '@',
      verify_event: '@',
      modal_description: '@',
      modal_title: '@',
      modal_button: '@',
      trigger_upload: function (scope, el, ev) {
        // upload files without a parent folder (risk assesment)
        var that = this,
          verify_dfd = $.Deferred(),
          folder_id = el.data('folder-id'),
          dfd;

        // Create and render a Picker object for searching images.
        function createPicker() {
          window.oauth_dfd.done(function (token, oauth_user) {
            var dialog,
              picker = new google.picker.PickerBuilder()
                    .setOAuthToken(gapi.auth.getToken().access_token)
                    .setDeveloperKey(GGRC.config.GAPI_KEY)
                    .setCallback(pickerCallback);

            if (el.data('type') === 'folders') {
              var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                  .setIncludeFolders(true)
                  .setSelectFolderEnabled(true);
              picker.addView(view);
            }
            else {
              var docsUploadView = new google.picker.DocsUploadView()
                      .setParent(folder_id),
                docsView = new google.picker.DocsView()
                      .setParent(folder_id);

              picker.addView(docsUploadView)
                  .addView(docsView)
                  .enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
            }
            picker = picker.build();
            picker.setVisible(true);

            dialog = GGRC.Utils.getPickerElement(picker);
            if (dialog) {
              dialog.style.zIndex = 4001; // our modals start with 2050
            }
          });
        }

        function pickerCallback(data) {
          var files, models,
            PICKED = google.picker.Action.PICKED,
            ACTION = google.picker.Response.ACTION,
            DOCUMENTS = google.picker.Response.DOCUMENTS,
            CANCEL = google.picker.Action.CANCEL;

          if (data[ACTION] === PICKED) {
            files = CMS.Models.GDriveFile.models(data[DOCUMENTS]);
            that.attr('pending', true);
            return new RefreshQueue().enqueue(files).trigger().then(function (files) {
              doc_dfds = that.handle_file_upload(files);
              $.when.apply($, doc_dfds).then(function () {
                // Trigger modal:success event on scope
                can.trigger(that, 'modal:success', {arr: can.makeArray(arguments)});
                el.trigger('modal:success', {arr: can.makeArray(arguments)});
                that.attr('pending', false);
              });
            });
          }
          else if (data[ACTION] === CANCEL) {
            //TODO: hadle canceled uplads
            el.trigger('rejected');
          }
        }

        if (scope.attr('verify_event')) {
          GGRC.Controllers.Modals.confirm({
            modal_description: scope.attr('modal_description'),
            modal_confirm: scope.attr('modal_button'),
            modal_title: scope.attr('modal_title'),
            button_view : GGRC.mustache_path + '/gdrive/confirm_buttons.mustache'
          }, verify_dfd.resolve);
        } else {
          verify_dfd.resolve();
        }

        verify_dfd.done(function () {
          dfd = GGRC.Controllers.GAPI.authorize(['https://www.googleapis.com/auth/drive.file']);
          dfd.then(function () {
            gapi.load('picker', {'callback': createPicker});
          });
        });
      },

      trigger_upload_parent: function (scope, el, ev) {
        // upload files with a parent folder (audits and workflows)
        var that = this,
          verify_dfd = $.Deferred(),
          parent_folder_dfd,
          folder_instance;

        folder_instance = this.folder_instance || this.instance;
        function is_own_folder(mapping, instance) {
          if (mapping.binding.instance !== instance)
            return false;
          if (!mapping.mappings || mapping.mappings.length < 1 || mapping.instance === true)
            return true;
          else {
            return can.reduce(mapping.mappings, function (current, mp) {
              return current || is_own_folder(mp, instance);
            }, false);
          }
        }

        if (scope.attr('verify_event')) {
          GGRC.Controllers.Modals.confirm({
            modal_description: scope.attr('modal_description'),
            modal_confirm: scope.attr('modal_button'),
            modal_title: scope.attr('modal_title'),
            button_view : GGRC.mustache_path + '/gdrive/confirm_buttons.mustache'
          }, verify_dfd.resolve);
        } else {
          verify_dfd.resolve();
        }

        verify_dfd.done(function () {
          if (that.instance.attr('_transient.folder')) {
            parent_folder_dfd = $.when([{instance: folder_instance.attr('_transient.folder')}]);
          } else {
            parent_folder_dfd = folder_instance.get_binding('extended_folders').refresh_instances();
          }
          can.Control.prototype.bindXHRToButton(parent_folder_dfd, el);

          parent_folder_dfd.done(function (bindings) {
            var parent_folder;
            if (bindings.length < 1 || !bindings[0].instance.selfLink) {
              //no ObjectFolder or cannot access folder from GAPI
              el.trigger(
                  'ajax:flash'
                  , {
                    warning : 'Can\'t upload: No GDrive folder found'
                  });
              return;
            }

            parent_folder = can.map(bindings, function (binding) {
              return can.reduce(binding.mappings, function (current, mp) {
                return current || is_own_folder(mp, that.instance);
              }, false) ? binding.instance : undefined;
            });
            parent_folder = parent_folder[0] || bindings[0].instance;

            //NB: resources returned from uploadFiles() do not match the properties expected from getting
            // files from GAPI -- "name" <=> "title", "url" <=> "alternateLink".  Of greater annoyance is
            // the "url" field from the picker differs from the "alternateLink" field value from GAPI: the
            // URL has a query parameter difference, "usp=drive_web" vs "usp=drivesdk".  For consistency,
            // when getting file references back from Picker, always put them in a RefreshQueue before
            // using their properties. --BM 11/19/2013
            parent_folder.uploadFiles().then(function (files) {
              that.attr('pending', true);
              return new RefreshQueue().enqueue(files).trigger().then(function (fs) {
                return $.when.apply($, can.map(fs, function (f) {
                  if (!~can.inArray(parent_folder.id, can.map(f.parents, function (p) { return p.id; }))) {
                    return f.copyToParent(parent_folder);
                  } else {
                    return f;
                  }
                }));
              });
            }).done(function () {
              var files = can.map(
                      can.makeArray(arguments),
                      function (file) {
                        return CMS.Models.GDriveFile.model(file);
                      }),
                doc_dfds = that.handle_file_upload(files);
              $.when.apply($, doc_dfds).then(function () {
                can.trigger(that, 'modal:success', {arr: can.makeArray(arguments)});
                el.trigger('modal:success', {arr: can.makeArray(arguments)});
                that.attr('pending', false);
              });
            });
          });
        });
      },

      handle_file_upload: function (files) {
        var that = this,
          doc_dfds = [];

        can.each(files, function (file) {
          //Since we can re-use existing file references from the picker, check for that case.
          var dfd = CMS.Models.Document.findAll({link : file.alternateLink}).then(function (d) {
            var doc_dfd, object_doc, object_file;

            if (d.length < 1) {
              d.push(
                new CMS.Models.Document({
                  context : that.instance.context || {id : null}
                  , title : file.title
                  , link : file.alternateLink
                })
              );
            }
            if (that.deferred || !d[0].isNew()) {
              doc_dfd = $.when(d[0]);
            } else {
              doc_dfd = d[0].save();
            }

            doc_dfd = doc_dfd.then(function (doc) {
              if (that.deferred) {
                that.instance.mark_for_addition('documents', doc, {
                  context : that.instance.context || {id : null}
                });
              } else {
                object_doc = new CMS.Models.ObjectDocument({
                  context : that.instance.context || {id : null}
                    , documentable : that.instance
                    , document : doc
                }).save();
              }

              return $.when(
                CMS.Models.ObjectFile.findAll({file_id : file.id, fileable_id : d[0].id}),
                object_doc
              ).then(function (ofs) {
                if (ofs.length < 1) {
                  if (that.deferred) {
                    doc.mark_for_addition('files', file, {
                      context : that.instance.context || {id : null}
                    });
                  } else {
                    return new CMS.Models.ObjectFile({
                      context : that.instance.context || {id : null}
                      , file : file
                      , fileable : doc
                    }).save();
                  }
                }})
              .then(function () {
                return doc;
              });
            });
            return doc_dfd;
          });
          doc_dfds.push(dfd);
        });
        return doc_dfds;
      }
    },
    events: {
      init: function () {
        if (!this.scope.link_class) {
          this.scope.attr('link_class', 'btn');
        }
      },
      '{scope} modal:success': function (_scope, _event) {
        var instance = this.scope.instance.reify();
        instance.refresh();
      }
    }
  });
})(this.can, this.can.$);

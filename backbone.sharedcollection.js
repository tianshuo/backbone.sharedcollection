(function() {
  var S4, log, optionsCbToNodeCb;
  var __slice = Array.prototype.slice, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  log = function() {
    var msg;
    msg = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    msg.unshift("SharedCollection:");
    return typeof console !== "undefined" && console !== null ? console.log.apply(console, msg) : void 0;
  };

  S4 = function() {
    return (((1 + Math.random()) * 65536) | 0).toString(16).substring(1);
  };

  optionsCbToNodeCb = function(options) {
    return function(err) {
      if (err) {
        return options != null ? typeof options.error === "function" ? options.error() : void 0 : void 0;
      } else {
        return options != null ? typeof options.success === "function" ? options.success() : void 0 : void 0;
      }
    };
  };

  Backbone.sync = function(method, model, options) {
    console.log("METHOD", method);
    if (method === "delete") return options.success();
  };

  Backbone.SharedCollection = (function() {

    __extends(SharedCollection, Backbone.Collection);

    SharedCollection.version = "0.1.0";

    SharedCollection.prototype.model = Backbone.Model;

    SharedCollection.generateGUID = function() {
      return S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4();
    };

    function SharedCollection(models, opts) {
      if (opts == null) opts = {};
      this.captureError = __bind(this.captureError, this);
      this.classMap = {};
      if (opts.modelClasses) this.mapTypes(opts.modelClasses);
      if (opts.sharejsDoc) this._syncDoc = opts.sharejsDoc;
      if (!(this.collectionId = opts.collectionId)) {
        throw new Error("SharedCollection needs a collectionId in options!");
      }
      SharedCollection.__super__.constructor.apply(this, arguments);
    }

    SharedCollection.prototype.mapTypes = function(modelClasses) {
      var Model, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = modelClasses.length; _i < _len; _i++) {
        Model = modelClasses[_i];
        if (!Model.prototype.type) {
          throw new Error("Model class " + Model.prototype.constructor.name + " is missing `type` attribute.");
        }
        _results.push(this.classMap[Model.prototype.type] = Model);
      }
      return _results;
    };

    SharedCollection.prototype.captureError = function(model, method) {
      var _this = this;
      return function(err) {
        if (err) {
          log("Sync error!", err);
          return _this.trigger("syncerror", model, method, err);
        }
      };
    };

    SharedCollection.prototype.create = function(model, options) {
      var Model, attrs;
      if (options == null) options = {};
      if (!(model instanceof Backbone.Model)) {
        attrs = model;
        Model = this.classMap[attrs.__type] || this.model;
        model = new Model(attrs, {
          collection: this
        });
        if (model.validate && !model._performValidation(attrs, options)) {
          return false;
        }
      }
      if (!model.collection) model.collection = this;
      this.add(model, options);
      return model;
    };

    SharedCollection.prototype.fetch = function(options) {
      var cb;
      var _this = this;
      if (options == null) options = {};
      if (options.sharejsDoc) this._syncDoc = options.sharejsDoc;
      if (this._syncDoc.type.name !== "json") {
        throw new Error("The ShareJS document type must be 'json', not '" + this._syncDoc.type.name + "'");
      }
      cb = optionsCbToNodeCb(options);
      if (this._syncDoc.created) {
        this._initSyncDoc(cb);
      } else {
        this._loadModelsFromSyncDoc(cb);
      }
      this._bindSendOperations();
      return this._syncDoc.on("remoteop", function(operations) {
        var op, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = operations.length; _i < _len; _i++) {
          op = operations[_i];
          if (op.p[0] === _this.collectionId) {
            _results.push(_this.parse(op));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
    };

    SharedCollection.prototype._initSyncDoc = function(cb) {
      var ob;
      log("Creating new sync doc with " + this.collectionId);
      ob = {};
      ob[this.collectionId] = {};
      return this._syncDoc.submitOp([
        {
          p: [],
          oi: ob
        }
      ], cb);
    };

    SharedCollection.prototype._loadModelsFromSyncDoc = function(cb) {
      var id, json, modelMap;
      if (cb == null) cb = function() {};
      if (modelMap = this._syncDoc.snapshot[this.collectionId]) {
        for (id in modelMap) {
          json = modelMap[id];
          this.create(json);
        }
        return cb();
      } else {
        log("Creating collection " + this.collectionId);
        return this._syncDoc.submitOp([
          {
            p: [this.collectionId],
            oi: {}
          }
        ], cb);
      }
    };

    SharedCollection.prototype._bindSendOperations = function() {
      var _this = this;
      this.bind("change", function(model, options) {
        if (options != null ? options.local : void 0) console.log("LOCAL change");
        if (!(options != null ? options.local : void 0)) {
          return _this._sendModelChange(model);
        }
      });
      this.bind("add", function(model, collection, options) {
        if (options != null ? options.local : void 0) console.log("LOCAL add");
        if (!(options != null ? options.local : void 0)) {
          return _this._sendModelAdd(model);
        }
      });
      return this.bind("destroy", function(model, collection, options) {
        if (options != null ? options.local : void 0) console.log("LOCAL destroy");
        if (!(options != null ? options.local : void 0)) {
          return _this._sendModelDestroy(model);
        }
      });
    };

    SharedCollection.prototype._sendModelChange = function(model) {
      var attribute, operations, value;
      operations = (function() {
        var _ref, _results;
        _ref = model.changedAttributes();
        _results = [];
        for (attribute in _ref) {
          value = _ref[attribute];
          log("SEND CHANGE: " + model.id + ": " + attribute + ": " + value);
          _results.push({
            p: [this.collectionId, model.id, attribute],
            oi: value
          });
        }
        return _results;
      }).call(this);
      if (!this._syncDoc.snapshot[this.collectionId][model.id]) {
        throw new Error("ERROR: snapshot has no model with id " + model.id);
      }
      if (operations.length !== 0) {
        return this._syncDoc.submitOp(operations, this.captureError(model, "change"));
      }
    };

    SharedCollection.prototype._sendModelAdd = function(model, options) {
      var attrs;
      if (!model.id) {
        model.set({
          id: SharedCollection.generateGUID()
        });
      }
      if (this._syncDoc.snapshot[this.collectionId][model.id]) return;
      log("SEND ADD " + model.id + ": " + (JSON.stringify(model.toJSON())));
      attrs = model.toJSON();
      if (model.type) {
        if (!this.classMap[model.type]) {
          throw new Error("Cannot serialize model. Unkown type: '" + model.type + "'. You must add this model class to `modelClasses` options when creating this collection");
        }
        attrs.__type = model.type;
      }
      return this._syncDoc.submitOp([
        {
          p: [this.collectionId, model.id],
          oi: attrs
        }
      ], this.captureError(model, "add"));
    };

    SharedCollection.prototype._sendModelDestroy = function(model) {
      log("SEND REMOVE " + model.id);
      return this._syncDoc.submitOp([
        {
          p: [this.collectionId, model.id],
          od: true
        }
      ], this.captureError(model, "destroy"));
    };

    SharedCollection.prototype.parse = function(op) {
      if (op.p.length === 2) {
        if (op.oi) return this._receiveModelAdd(op);
        if (op.od) return this._receiveModelDestroy(op);
      }
      if (op.p[2]) return this._receiveModelChange(op);
      return log("Unkown model operation " + (JSON.stringify(op)));
    };

    SharedCollection.prototype._receiveModelAdd = function(op) {
      log("RECEIVE ADD " + op.oi.id + ": " + (JSON.stringify(op.oi)));
      return this.create(op.oi, {
        local: true,
        remote: true
      });
    };

    SharedCollection.prototype._receiveModelDestroy = function(op) {
      var model, modelId;
      modelId = op.p[1];
      model = this.get(modelId);
      if (!model) {
        throw new Error("Remote asked to remove non existing model " + modelId);
      }
      log("RECEIVE REMOVE " + model.id + ": " + (JSON.stringify(modelId)));
      model.destroy({
        local: true,
        remote: true
      });
      if (this._syncDoc.snapshot[this.collectionId][modelId]) {
        return log("ERROR: Model exists after deletion! " + modelId);
      }
    };

    SharedCollection.prototype._receiveModelChange = function(op) {
      var attrName, attrValue, model, modelId, ob;
      modelId = op.p[1];
      attrName = op.p[2];
      attrValue = op.oi;
      model = this.get(modelId);
      if (!model) {
        throw new Error("Remote asked to update non existing model: " + model.id + " " + modelId);
      }
      log("RECEIVE CHANGE " + model.id + ": " + attrName + ": " + attrValue);
      ob = {};
      ob[attrName] = attrValue;
      return model.set(ob, {
        local: true,
        remote: true
      });
    };

    SharedCollection.prototype.add = function(models, options) {
      var m, _i, _len;
      if (models.length === 0) return;
      if (_.isArray(models)) {
        for (_i = 0, _len = models.length; _i < _len; _i++) {
          m = models[_i];
          this._sendModelAdd(m, options);
        }
      } else {
        this._sendModelAdd(models, options);
      }
      SharedCollection.__super__.add.apply(this, arguments);
      return this;
    };

    SharedCollection.prototype.getOrCreate = function(id, Model) {
      var model;
      if (Model == null) Model = Backbone.Model;
      if (model = this.get(id)) {
        log("getOrCreate: Got!");
        return model;
      }
      log("getOrCreate: creating!");
      model = new Model({
        id: id
      });
      this.add(model);
      return model;
    };

    return SharedCollection;

  })();

}).call(this);
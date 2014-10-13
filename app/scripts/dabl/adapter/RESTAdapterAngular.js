var AngularRESTAdapter = dabl.RESTAdapter.extend({

	$http: null,

	init: function(urlBase, $http) {
		this._super(urlBase);
		this.$http = $http;
	},

	_getErrorCallback: function(def) {
		return function(data, status, headers, config){
			var error = 'Request failed.';
			if (data) {
				if (data.error) {
					error = data.error;
				} else if (data.errors) {
					error = data.errors.join('\n');
				}
			}
			def.reject(error, data, config);
		};
	},

	_save: function(instance, method) {
		var fieldName,
			model = instance.constructor,
			value,
			route = this._getRoute(model._url),
			data = {},
			pk = model.getKey(),
			self = this,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		for (fieldName in model._fields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			data[fieldName] = value;
		}

		this.$http({
			url: route.url(data),
			method: method,
			data: data,
			headers: {
				'X-HTTP-Method-Override': method
			}
		})
		.success(function(data, status, headers, config) {
			if (!self._isValidResponseObject(data, model)) {
				error.apply(this, arguments);
				return;
			}
			instance
				.fromJSON(data)
				.resetModified()
				.setNew(false);

			if (pk && typeof instance[pk] !== 'undefined') {
				self.cache(model._table, instance[pk], instance);
			}
			def.resolve(instance);
		})
		.error(error);
		return def.promise();
	},

	remove: function(instance) {
		var model = instance.constructor,
			route = this._getRoute(model._url),
			pk = model.getKey(),
			self = this,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		this.$http({
			url: route.url(instance.toJSON()),
			method: 'DELETE',
			data: {},
			headers: {
				'X-HTTP-Method-Override': 'DELETE'
			}
		})
		.success(function(data, status, headers, config) {
			if (data && (data.error || (data.errors && data.errors.length))) {
				error.apply(this, arguments);
				return;
			}
			if (pk && instance[pk]) {
				self.cache(model._table, instance[pk], null);
			}
			def.resolve(instance);
		})
		.error(error);

		return def.promise();
	},

	find: function(model, id) {
		var route = this._getRoute(model._url),
			data = {},
			instance = null,
			q,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def),
			self = this,
			pk = model.getKey();

		if (pk && arguments.length === 2 && (typeof id === 'number' || typeof id === 'string')) {
			// look for it in the cache
			instance = this.cache(model._table, id);
			if (instance) {
				def.resolve(instance);
				return def.promise();
			}
			data = {};
			data[pk] = id;
		} else {
			q = this.findQuery.apply(this, arguments);
			q.limit(1);
			data = q.getSimpleJSON();
		}

		this.$http
		.get(route.urlGet(data))
		.success(function(data, status, headers, config) {
			if (!self._isValidResponseObject(data, model)) {
				error.apply(this, arguments);
				return;
			}
			if (data instanceof Array) {
				data = data.shift();
			}
			def.resolve(model.inflate(data));
		})
		.error(error);
		return def.promise();
	},

	findAll: function(model) {
		var q = this.findQuery.apply(this, arguments),
			route = this._getRoute(model._url),
			data = q.getSimpleJSON(),
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		this.$http
		.get(route.urlGet(data))
		.success(function(data, status, headers, config) {
			if (typeof data !== 'object' || data.error || (data.errors && data.errors.length)) {
				error.apply(this, arguments);
				return;
			}
			if (!(data instanceof Array)) {
				data = [data];
			}
			def.resolve(model.inflateArray(data));
		})
		.error(error);
		return def.promise();
	},

	countAll: function(model) {
		var q = this.findQuery.apply(this, arguments).setAction(dabl.Query.ACTION_COUNT),
			route = this._getRoute(model._url),
			data = q.getSimpleJSON(),
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		this.$http
		.get(route.urlGet(data))
		.success(function(data, status, headers, config) {
			var count = parseInt(data.total, 10);
			if (isNaN(count) || typeof data !== 'object' || data.error || (data.errors && data.errors.length)) {
				error.apply(this, arguments);
				return;
			}
			def.resolve(count);
		})
		.error(error);
		return def.promise();
	}
});

dabl.AngularRESTAdapter = AngularRESTAdapter;
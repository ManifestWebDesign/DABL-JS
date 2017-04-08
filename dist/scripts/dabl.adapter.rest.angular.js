angular.module('dabl', [])
.factory('dabl', ['$http', '$q', function($http, $q){

	dabl.Deferred = function () {
		var def = $q.defer(),
			promise = def.promise;

		def.promise = function() {
			return promise;
		};
		return def;
	};

	var AngularRESTAdapter = dabl.RESTAdapter.extend({

		$http: null,

		init: function(urlBase) {
			this._super(urlBase);
		},

		_getErrorCallback: function(def) {
			return function(response){
				var error = 'Request failed.';
				var data = response.data;
				if (data) {
					if (data.error) {
						error = data.error;
					} else if (data.errors) {
						error = data.errors.join('\n');
					}
				}
				def.reject(error, data, response.config);
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
				def = $q.defer(),
				error = this._getErrorCallback(def);

			for (fieldName in model._fields) {
				var field = model._fields[fieldName];
				value = instance[fieldName];
				if (model.isTemporalType(field.type)) {
					value = this.formatDate(value, field.type);
				}
				data[fieldName] = value;
			}

			var success = function(response) {
				var data = response.data;
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
			};

			$http({
				url: route.url(data),
				method: 'POST',
				data: data,
				headers: {
					'X-HTTP-Method-Override': method
				}
			})
			.then(success, error);
			return def.promise;
		},

		update: function(instance) {
			if (!instance.isModified()) {
				var def = $q.defer();
				def.resolve(instance);
				return def.promise;
			}

			return this._save(instance, 'PUT');
		},

		remove: function(instance) {
			var model = instance.constructor,
				route = this._getRoute(model._url),
				pk = model.getKey(),
				self = this,
				def = $q.defer(),
				error = this._getErrorCallback(def);

			var success = function(response) {
				var data = response.data;
				if (data && (data.error || (data.errors && data.errors.length))) {
					error.apply(this, arguments);
					return;
				}
				if (pk && instance[pk]) {
					self.cache(model._table, instance[pk], null);
				}
				def.resolve(instance);
			};

			$http({
				url: route.url(instance.toJSON()),
				method: 'POST',
				data: {},
				headers: {
					'X-HTTP-Method-Override': 'DELETE'
				}
			})
			.then(success, error);

			return def.promise;
		},

		find: function(model, id) {
			var route = this._getRoute(model._url),
				data = {},
				instance = null,
				q,
				def = $q.defer(),
				error = this._getErrorCallback(def),
				self = this,
				pk = model.getKey();

			if (pk && arguments.length === 2 && (typeof id === 'number' || typeof id === 'string')) {
				// look for it in the cache
				instance = this.cache(model._table, id);
				if (instance) {
					def.resolve(instance);
					return def.promise;
				}
				data = {};
				data[pk] = id;
			} else {
				q = this.findQuery.apply(this, arguments);
				q.limit(1);
				data = q.getSimpleJSON();
			}

			var success = function(response) {
				var data = response.data;
				if (!self._isValidResponseObject(data, model)) {
					error.apply(this, arguments);
					return;
				}
				if (data instanceof Array) {
					data = data.shift();
				}
				def.resolve(model.inflate(data));
			};

			$http
				.get(route.urlGet(data))
				.then(success, error);
			return def.promise;
		},

		findAll: function(model) {
			var q = this.findQuery.apply(this, arguments),
				route = this._getRoute(model._url),
				data = q.getSimpleJSON(),
				def = $q.defer(),
				error = this._getErrorCallback(def);

			var success = function(response) {
				var data = response.data;

				if (
					data !== null
					&& typeof data === 'object'
					&& (
						data.error
						|| (data.errors && data.errors.length)
					)
				) {
					error.apply(this, arguments);
					return;
				}

				if (!(data instanceof Array)) {
					if (data === null || typeof data === 'undefined') {
						data = [];
					} else {
						data = [data];
					}
				}
				def.resolve(model.inflateArray(data));
			};

			$http
				.get(route.urlGet(data))
				.then(success, error);
			return def.promise;
		},

		countAll: function(model) {
			var q = this.findQuery.apply(this, arguments).setAction(dabl.Query.ACTION_COUNT),
				route = this._getRoute(model._url),
				data = q.getSimpleJSON(),
				def = $q.defer(),
				error = this._getErrorCallback(def);

			var success = function(response) {
				var data = response.data;
				var count = parseInt(data.total, 10);
				if (isNaN(count) || typeof data !== 'object' || data.error || (data.errors && data.errors.length)) {
					error.apply(this, arguments);
					return;
				}
				def.resolve(count);
			};

			$http
				.get(route.urlGet(data))
				.then(success, error);
			return def.promise;
		}
	});

	dabl.AngularRESTAdapter = AngularRESTAdapter;

	return dabl;

}]);

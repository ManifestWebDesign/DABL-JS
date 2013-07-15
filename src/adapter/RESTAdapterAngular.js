(function(){

this.AngularRESTAdapter = this.RESTAdapter.extend({

	$http: null,

	init: function(urlBase, $http) {
		this._super(urlBase);
		this.$http = $http;
	},

	_save: function(instance, method) {
		var fieldName,
			model = instance.constructor,
			value,
			route = this._route(model._url),
			data = {},
			def = Deferred(),
			pk = model.getKey(),
			self = this;

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
			method: 'POST',
			data: data,
			headers: {
				'X-HTTP-Method-Override': method
			}
		})
		.success(function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			instance
				.fromJSON(r)
				.resetModified()
				.setNew(false);

			if (pk && instance[pk]) {
				self.cache(model._table, instance[pk], instance);
			}
			def.resolve(instance);
		})
		.error(function(data, textStatus, errorThrown) {
			def.reject({
				status: textStatus
			});
		});
		return def.promise();
	},

	remove: function(instance) {
		var model = instance.constructor,
			route = this._route(model._url),
			def = Deferred(),
			pk = model.getKey(),
			self = this;

		this.$http({
			url: route.url(instance.toJSON()),
			method: 'POST',
			data: {},
			headers: {
				'X-HTTP-Method-Override': 'DELETE'
			}
		})
		.success(function(r) {
			if (r && r.errors && r.errors.length) {
				def.reject(r);
				return;
			}
			if (pk && instance[pk]) {
				self.cache(model._table, instance[pk], null);
			}
			def.resolve(instance);
		})
		.error(function(jqXHR, textStatus, errorThrown){
			def.reject({
				status: textStatus,
				errors: [errorThrown]
			});
		});

		return def.promise();
	},

	find: function(model, id) {
		var route = this._route(model._url),
			data = {},
			def = Deferred(),
			instance = null,
			q;

		if (arguments.length === 2 && (typeof id === 'number' || typeof id === 'string')) {
			// look for it in the cache
			instance = this.cache(model._table, id);
			if (instance) {
				def.resolve(instance);
				return def.promise();
			}
		}
		q = this.findQuery.apply(this, arguments);
		q.limit(1);
		data = q.getSimpleJSON();

		this.$http
		.get(route.urlGet(data))
		.success(function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			if (r instanceof Array) {
				r = r.shift();
			}
			def.resolve(model.inflate(r));
		})
		.error(function(jqXHR, textStatus, errorThrown){
			def.reject({
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	},

	findAll: function(model) {
		var q = this.findQuery
			.apply(this, arguments);

		var route = this._route(model._url),
			data = q.getSimpleJSON(),
			def = Deferred();
		var url = route.urlGet(data);
		this.$http
		.get(url)
		.success(function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			if (!(r instanceof Array)) {
				r = [r];
			}
			def.resolve(model.inflateArray(r));
		})
		.error(function(jqXHR, textStatus, errorThrown){
			def.reject({
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	}
});

})();
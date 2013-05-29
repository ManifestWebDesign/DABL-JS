(function($){

function _sPad(value) {
	value = value + '';
	return value.length === 2 ? value : '0' + value;
}

function encodeUriSegment(val) {
	return encodeUriQuery(val, true).
	replace(/%26/gi, '&').
	replace(/%3D/gi, '=').
	replace(/%2B/gi, '+');
}

function encodeUriQuery(val, pctEncodeSpaces) {
	return encodeURIComponent(val).
	replace(/%40/gi, '@').
	replace(/%3A/gi, ':').
	replace(/%24/g, '$').
	replace(/%2C/gi, ',').
	replace((pctEncodeSpaces ? null : /%20/g), '+');
}

function Route(template, defaults) {
	this.template = template;
	this.defaults = defaults || {};
	var urlParams = this.urlParams = {},
		parts = template.split(/\W/);
	for (var i = 0, l = parts.length; i < l; ++i) {
		var param = parts[i];
		if (param && template.match(new RegExp("[^\\\\]:" + param + "\\W"))) {
			urlParams[param] = true;
		}
	}
	this.template = template.replace(/\\:/g, ':');
}

Route.prototype = {
	url: function(params) {
		var self = this,
		url = this.template,
		val,
		encodedVal;

		params = params || {};

		for (var urlParam in this.urlParams) {
			val = typeof params[urlParam] !== 'undefined' || params.hasOwnProperty(urlParam) ? params[urlParam] : self.defaults[urlParam];
			if (typeof val !== 'undefined' && val !== null) {
				encodedVal = encodeUriSegment(val);
				url = url.replace(new RegExp(":" + urlParam + "(\\W)", "g"), encodedVal + "$1");
			} else {
				url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W)", "g"), function(match, leadingSlashes, tail) {
					if (tail.charAt(0) === '/') {
						return tail;
					} else {
						return leadingSlashes + tail;
					}
				});
			}
		}
		return url;
	},

	urlGet: function(params) {
		var url = this.url(params);

		params = params || {};

		url = url.replace(/\/?#$/, '');
		var query = [];
		for (var key in params) {
			if (!this.urlParams[key]) {
				query.push(encodeUriQuery(key) + '=' + encodeUriQuery(params[key]));
			}
		}
		query.sort();
		url = url.replace(/\/*$/, '');
		return url + (query.length ? '?' + query.join('&') : '');
	}
};

var RESTAdapter = Adapter.extend({

	init: function RESTAdaper() {
		this._super();
	},

	routes: {},

	route: function(url) {
		if (!url) {
			throw new Error('Cannot create RESTful route for empty url.');
		}
		if (this.routes[url]) {
			return this.routes[url];
		}
		return this.routes[url] = new Route(url);
	},

	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		var offset = -value.getTimezoneOffset() / 60;
		offset = (offset > 0 ? '+' : '-') + _sPad(Math.abs(offset));

		return this.formatDate(value)
			+ ' ' + _sPad(value.getHours())
			+ ':' + _sPad(value.getMinutes())
			+ ':' + _sPad(value.getSeconds())
			+ ' ' + offset + '00';
	},

	insert: function(instance) {
		var fieldName,
			model = instance.constructor,
			value,
			route = this.route(model._url),
			data = {},
			def = new Deferred(),
			pk = model.getPrimaryKey(),
			self = this;

		for (fieldName in model._fields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			if (value === null) {
				value = '';
			}
			data[fieldName] = value;
		}

		$.post(route.url(instance), data, function(r){
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			instance.setValues(r);
			instance.resetModified();
			instance.setNew(false);
			if (pk && instance[pk]) {
				self.cache(model._table, instance[pk], instance);
			}
			def.resolve(r);
		}, 'json')
		.fail(function(jqXHR, textStatus, errorThrown){
			def.reject({
				xhr: jqXHR,
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	},

	update: function(instance) {
		var data = {},
			modFields = instance.getModified(),
			model = instance.constructor,
			route = this.route(model._url),
			fieldName,
			pks = model.getPrimaryKeys(),
			value,
			def = new Deferred();

		if (!instance.isModified()) {
			def.resolve();
			return def.promise();
		}

		if (pks.length === 0) {
			throw new Error('This table has no primary keys');
		}

		if (instance[pks[0]] === null || instance[pks[0]] === 'undefined') {
			def.reject({
				errors: ['No ' + pks[0] + ' provided']
			});
			return def.promise();
		}

		for (fieldName in modFields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			if (value === null) {
				value = '';
			}
			data[fieldName] = value;
		}

		data._method = 'PUT';
		$.post(route.url(instance), data, function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			instance.setValues(r);
			instance.resetModified();
			def.resolve(r);
		}, 'json')
		.fail(function(jqXHR, textStatus, errorThrown){
			def.reject({
				xhr: jqXHR,
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	},

	destroy: function(instance) {
		var model = instance.constructor,
			pks = model.getPrimaryKeys(),
			route = this.route(model._url),
			def = new Deferred(),
			pk = model.getPrimaryKey(),
			self = this;

		if (pks.length === 0) {
			throw new Error('This table has no primary keys');
		}

		if (pks.length > 1) {
			throw new Error('Cannot save using REST if there is more than one primary key!');
		}

		if (instance[pks[0]] === null || instance[pks[0]] === 'undefined') {
			def.reject({
				errors: ['No ' + pks[0] + ' provided']
			});
			return def.promise();
		}

		var data = {};
		data._method = 'DELETE';
		$.post(route.url(instance), data, function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			def.resolve(r);
			if (pk && instance[pk]) {
				self.cache(model._table, instance[pk], null);
			}
		}, 'json')
		.fail(function(jqXHR, textStatus, errorThrown){
			def.reject({
				xhr: jqXHR,
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	},

	find: function(model, id) {
		var pk = model.getPrimaryKey(),
			route = this.route(model._url),
			data = {},
			def = new Deferred(),
			instance = null,
			numericKey = false;

		if (id === null || typeof id === 'undefined') {
			def.reject({
				errors: ['No ' + pk + ' provided']
			});
			return def.promise();
		}

		if (!isNaN(parseInt(id, 10))) {
			numericKey = true;
			// look for it in the cache
			instance = this.cache(model._table, id);
			if (instance) {
				def.resolve(instance);
			}
			return def.promise();
		}

		data[pk] = id;
		$.get(route.urlGet(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			if (r !== null) {
				instance = new model;
				instance.setValues(r);
				instance.setNew(false);
				instance.resetModified();
			}
			if (numericKey) {
				this.cache(model._table, id, instance);
			}
			def.resolve(instance);
		})
		.fail(function(jqXHR, textStatus, errorThrown){
			def.reject({
				xhr: jqXHR,
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	},

	findAll: function(model) {
		var q = this.findQuery
			.apply(this, arguments);

		var route = this.route(model._url),
			data = q.toArray(),
			def = new Deferred(),
			instance,
			pk = model.getPrimaryKey(),
			self = this;
		$.get(route.urlGet(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			var collection = [];
			if (r instanceof Array) {
				for (var x = 0, len = r.length; x < len; ++x) {
					if (pk && r[x][pk]) {
						instance = self.cache(model._table, r[x][pk]);
						if (instance) {
							collection.push(instance);
							continue;
						}
					}
					instance = new model().setValues(r[x]);
					if (pk && instance[pk]) {
						self.cache(model._table, instance[pk], instance);
					}
					collection.push(instance);
				}
			}
			def.resolve(collection);
		})
		.fail(function(jqXHR, textStatus, errorThrown){
			def.reject({
				xhr: jqXHR,
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	}
});

this.RESTAdapter = RESTAdapter;
})(jQuery);
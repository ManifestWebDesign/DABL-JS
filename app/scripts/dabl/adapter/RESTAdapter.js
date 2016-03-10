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
		if (!(new RegExp("^\\d+$").test(param)) && param && (new RegExp("(^|[^\\\\]):" + param + "(\\W|$)").test(template))) {
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
				url = url.replace(new RegExp(":" + urlParam + "(\\W|$)", "g"), encodedVal + "$1");
			} else {
				url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W|$)", "g"), function(match, leadingSlashes, tail) {
					if (tail.charAt(0) === '/') {
						return tail;
					} else {
						return leadingSlashes + tail;
					}
				});

				//Prevent '/.' as an artifact of the :id from dashboards/:id.json and leaving dashboards/.json
				url = (url.charAt(0) === '/' && url.charAt(1) === '.' ? '/' : '') + url.replace('/.', '.');
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

var RESTAdapter = dabl.Adapter.extend({

	_routes: {},

	_urlBase: '',

	init: function RESTAdapter(urlBase) {
		this._super();
		if (urlBase) {
			this._urlBase = urlBase;
		}
	},

	_getRoute: function(url) {
		if (!url) {
			throw new Error('Cannot create RESTful route for empty url.');
		}
		if (this._routes[url]) {
			return this._routes[url];
		}
		return this._routes[url] = new Route(this._urlBase + url);
	},

	_getErrorCallback: function(def) {
		return function(jqXHR, textStatus, errorThrown) {
			var data;
			try {
				if (jqXHR.responseText) {
					data = JSON.parse(jqXHR.responseText);
				} else {
					data = null;
				}
			} catch (e) {
				data = null;
			};
			var error = errorThrown || 'Request failed.';
			if (data) {
				if (data.error) {
					error = data.error;
				} else if (data.errors) {
					error = data.errors.join('\n');
				}
			}
			def.reject(error, data, jqXHR);
		};
	},

	_isValidResponseObject: function(data, model) {
		var pk = model.getKey();
		if (
			typeof data !== 'object'
			|| data.error
			|| (data.errors && data.errors.length !== 0)
			|| (pk && typeof data[pk] === 'undefined')
		) {
			return false;
		}
		return true;
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

		jQuery.ajax({
			url: route.url(data),
			type: 'POST',
			data: JSON.stringify(data),
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			headers: {
				'X-HTTP-Method-Override': method
			},
			success: function(data, textStatus, jqXHR) {
				if (!self._isValidResponseObject(data, model)) {
					error(jqXHR, textStatus, 'Invalid response.');
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
			},
			error: error
		});
		return def.promise();
	},

	formatDateTime: function(value) {
		if (!value) {
			return null;
		}
		if (!(value instanceof Date)) {
			value = dabl.constructDate(value);
		}
		var offset = -value.getTimezoneOffset() / 60;
		offset = (offset > 0 ? '+' : '-') + dabl.sPad(Math.abs(offset));

		return value.getFullYear() + '-' + dabl.sPad(value.getMonth() + 1) + '-' + dabl.sPad(value.getDate())
			+ ' ' + dabl.sPad(value.getHours())
			+ ':' + dabl.sPad(value.getMinutes())
			+ ':' + dabl.sPad(value.getSeconds())
			+ ' ' + offset + '00';
	},

	insert: function(instance) {
		return this._save(instance, 'POST');
	},

	update: function(instance) {
		if (!instance.isModified()) {
			var def = dabl.Deferred();
			def.resolve(instance);
			return def.promise();
		}

		return this._save(instance, 'PUT');
	},

	remove: function(instance) {
		var model = instance.constructor,
			route = this._getRoute(model._url),
			pk = model.getKey(),
			self = this,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		jQuery.ajax({
			url: route.url(instance.toJSON()),
			type: 'POST',
			data: {},
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			headers: {
				'X-HTTP-Method-Override': 'DELETE'
			},
			success: function(data, textStatus, jqXHR) {
				if (data && (data.error || (data.errors && data.errors.length))) {
					error(jqXHR, textStatus, 'Invalid response.');
					return;
				}
				if (pk && instance[pk]) {
					self.cache(model._table, instance[pk], null);
				}
				def.resolve(instance);
			},
			error: error
		});

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

		jQuery.get(route.urlGet(data), function(data, textStatus, jqXHR) {
			if (!self._isValidResponseObject(data, model)) {
				error(jqXHR, textStatus, 'Invalid response.');
				return;
			}
			if (data instanceof Array) {
				data = data.shift();
			}
			def.resolve(model.inflate(data));
		})
		.fail(error);
		return def.promise();
	},

	findAll: function(model) {
		var q = this.findQuery.apply(this, arguments),
			route = this._getRoute(model._url),
			data = q.getSimpleJSON(),
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		jQuery.get(route.urlGet(data), function(data, textStatus, jqXHR) {
			if (typeof data !== 'object' || data.error || (data.errors && data.errors.length)) {
				error(jqXHR, textStatus, 'Invalid response.');
				return;
			}
			if (!(data instanceof Array)) {
				data = [data];
			}
			def.resolve(model.inflateArray(data));
		})
		.fail(error);
		return def.promise();
	},

	countAll: function(model) {
		var q = this.findQuery.apply(this, arguments).setAction(dabl.Query.ACTION_COUNT),
			route = this._getRoute(model._url),
			data = q.getSimpleJSON(),
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		jQuery.get(route.urlGet(data), function(data, textStatus, jqXHR) {
			var count = parseInt(data.total, 10);
			if (isNaN(count) || typeof data !== 'object' || data.error || (data.errors && data.errors.length)) {
				error(jqXHR, textStatus, 'Invalid response.');
				return;
			}
			def.resolve(count);
		})
		.fail(error);
		return def.promise();
	}
});

dabl.RESTAdapter = RESTAdapter;

dabl.RESTAdapter.Route = Route;
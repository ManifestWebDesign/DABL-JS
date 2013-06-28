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

this.RESTAdapter = this.Adapter.extend({

	_routes: null,

	init: function RESTAdaper() {
		this._super();
		this._routes = {};
	},

	_route: function(url) {
		if (!url) {
			throw new Error('Cannot create RESTful route for empty url.');
		}
		if (this._routes[url]) {
			return this._routes[url];
		}
		return this._routes[url] = new Route(url);
	},

	_save: function(instance, method) {
		var fieldName,
			model = instance.constructor,
			value,
			route = this._route(model._url),
			data = {},
			def = new Deferred(),
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

		$.ajax({
			url: route.url(data),
			type: 'POST',
			data: JSON.stringify(data),
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			headers: {
				'X-HTTP-Method-Override': method
			},
			success: function(r) {
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
			},
			error: function(jqXHR, textStatus, errorThrown) {
				def.reject({
					xhr: jqXHR,
					status: textStatus,
					errors: [errorThrown]
				});
			}
		});
		return def.promise();
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
		return this._save(instance, 'POST');
	},

	update: function(instance) {
		if (!instance.isModified()) {
			var def = new Deferred();
			def.resolve();
			return def.promise();
		}

		return this._save(instance, 'PUT');
	},

	remove: function(instance) {
		var model = instance.constructor,
			route = this._route(model._url),
			def = new Deferred(),
			pk = model.getKey(),
			self = this;

		$.ajax({
			url: route.url(instance.toJSON()),
			type: 'POST',
			data: {},
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			headers: {
				'X-HTTP-Method-Override': 'DELETE'
			},
			success: function(r) {
				if (r && r.errors && r.errors.length) {
					def.reject(r);
					return;
				}
				if (pk && instance[pk]) {
					self.cache(model._table, instance[pk], null);
				}
				def.resolve(instance);
			},
			error: function(jqXHR, textStatus, errorThrown){
				def.reject({
					xhr: jqXHR,
					status: textStatus,
					errors: [errorThrown]
				});
			}
		});

		return def.promise();
	},

	find: function(model, id) {
		var pk = model.getKey(),
			route = this._route(model._url),
			data = {},
			def = new Deferred(),
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
		data = q.toArray();

		$.get(route.urlGet(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			if (r instanceof Array) {
				r = r.shift();
			}
			def.resolve(model.inflate(r));
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

		var route = this._route(model._url),
			data = q.toArray(),
			def = new Deferred();
		$.get(route.urlGet(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			if (!(r instanceof Array)) {
				r = [r];
			}
			var collection = [];
			for (var x = 0, len = r.length; x < len; ++x) {
				collection.push(model.inflate(r[x]));
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

})(jQuery);
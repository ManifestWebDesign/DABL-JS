(function($){

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
	this.template = template = template + '#';
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
				url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W)", "g"), function(match,
					leadingSlashes, tail) {
					if (tail.charAt(0) === '/') {
						return tail;
					} else {
						return leadingSlashes + tail;
					}
				});
			}
		}
		return url;
	}
};

var RESTAdapter = Adapter.extend({

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

	insert: function(instance) {
		var field,
			model = instance.constructor,
			value,
			route = this.route(model._url),
			data = {},
			def = new Deferred();

		for (field in model._fields) {
			value = instance[field];
			if (value === null) {
				if (!instance.isModified(field)) {
					continue;
				} else {
					value = '';
				}
			} else if (value instanceof Date) {
				if (value.getSeconds() === 0 && value.getMinutes() === 0 && value.getHours() === 0) {
					value = this.formatDate(value);
				} else {
					value = this.formatDateTime(value);
				}
			}
			data[field] = value;
		}

		$.post(route.url(this), data, function(r){
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			instance.fromJSON(r);
			instance.resetModified();
			instance.setNew(false);
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
			x,
			pks = model.getPrimaryKeys(),
			modCol,
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

		for (x in modFields) {
			modCol = modFields[x];
			value = this[modCol];
			if (value === null) {
				value = '';
			} else if (value instanceof Date) {
				if (value.getSeconds() === 0 && value.getMinutes() === 0 && value.getHours() === 0) {
					value = this.formatDate(value);
				} else {
					value = this.formatDateTime(value);
				}
			}
			data[modCol] = value;
		}

		data._method = 'PUT';
		$.post(route.url(instance), data, function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			instance.fromJSON(r);
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
			def = new Deferred();

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
			def = new Deferred();

		if (id === null || typeof id === 'undefined') {
			def.reject({
				errors: ['No ' + pk + ' provided']
			});
			return def.promise();
		}
		data[pk] = id;
		$.get(route.url(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			var instance = null;
			if (r !== null) {
				instance = new model;
				instance.fromJSON(r);
				instance.setNew(false);
				instance.resetModified();
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
		var route = this.route(model._url),
			data = {},
			def = new Deferred();
		$.get(route.url(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			var collection = [];
			if (r instanceof Array) {
				for (var x = 0, len = r.lenth; x < len; ++x) {
					collection.push(new model().fromJSON(r[x]));
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
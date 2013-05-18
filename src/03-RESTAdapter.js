(function($){
var RESTAdapter = Adapter.extend({

	insert: function(instance) {
		var column,
			model = instance.constructor,
			value,
			route = model._route,
			data = {},
			def = new Deferred();

		for (column in model._columns) {
			value = instance[column];
			if (value === null) {
				if (!instance.isColumnModified(column)) {
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
			data[column] = value;
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
			modColumns = instance.getModifiedColumns(),
			model = instance.constructor,
			route = model._route,
			x,
			pks = model.getPrimaryKeys(),
			modCol,
			value,
			def = new Deferred();

		if (pks.length === 0) {
			throw new Error('This table has no primary keys');
		}

		if (instance[pks[0]] === null || instance[pks[0]] === 'undefined') {
			def.reject({
				errors: ['No ' + pks[0] + ' provided']
			});
			return def.promise();
		}

		for (x in modColumns) {
			modCol = modColumns[x];
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
			route = model._route,
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
			route = model._route,
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
//				console.log(r);
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
		var route = model._route,
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
//				var instance = new model;
//				instance.fromJSON(r[model.getTableName()]);
//				onSuccess.apply(model, [instance]);
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
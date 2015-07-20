var Adapter = dabl.Class.extend({

	_cache: null,

	init: function Adapter() {
		this._cache = {};
	},

	/**
	 * @param {String} table
	 * @param {mixed} key
	 * @param {Model} value
	 * @return {Model|Adapter}
	 */
	cache: function(table, key, value) {
		if (!this._cache[table]) {
			this._cache[table] = {};
		}
		if (arguments.length < 3) {
			if (!this._cache[table][key]) {
				return null;
			}
			return this._cache[table][key];
		}
		this._cache[table][key] = value;
		return this;
	},

	/**
	 * @param {String} table
	 */
	emptyCache: function(table) {
		delete this._cache[table];
	},

	/**
	 * @param {Date|String} value
	 * @return {String}
	 */
	formatDate: function(value, fieldType) {
		if (!value) {
			return null;
		}
		if (fieldType && fieldType === dabl.Model.FIELD_TYPE_TIMESTAMP) {
			return this.formatDateTime(value);
		}
		if (!(value instanceof Date)) {
			value = dabl.constructDate(value);
		}
		return value.getUTCFullYear() + '-' + dabl.sPad(value.getUTCMonth() + 1) + '-' + dabl.sPad(value.getUTCDate());
	},

	/**
	 * @param {Date|String} value
	 * @return {String}
	 */
	formatDateTime: function(value) {
		if (!value) {
			return null;
		}
		if (!(value instanceof Date)) {
			value = dabl.constructDate(value);
		}
		return value.getFullYear() + '-' + dabl.sPad(value.getMonth() + 1) + '-' + dabl.sPad(value.getDate()) + ' ' + dabl.sPad(value.getHours()) + ':' + dabl.sPad(value.getMinutes()) + ':' + dabl.sPad(value.getSeconds());
	},

	/**
	 * @param {Class} model class
	 */
	findQuery: function(model) {
		var a = Array.prototype.slice.call(arguments),
			q = new Query().setTable(model.getTableName()),
			key = model.getKey();
		a.shift();
		var len = a.length;

		if (len === 0) {
			return q;
		}
		if (len === 1) {
			if (typeof a[0] === 'object') {
				if (a[0] instanceof Query) {
					if (!a[0].getTable()) {
						a[0].setTable(model.getTableName());
					}
					return a[0];
				} else {
					q.and(a[0]);
				}
			} else if (key) {
				var idNum = parseInt(a[0], 10);
				if (isNaN(idNum)) {
					q.and(key, a[0]);
				} else {
					q.and(key, idNum);
				}
			}
		} else if ((len === 2 || len === 3 || len === 4) && typeof a[0] === 'string') {
			q.and.apply(q, a);
		} else {
			throw new Error('Unknown arguments for find: (' + a.join(', ') + ')');
		}
		return q;
	},

	/**
	 * @param {Class} model class
	 */
	find: function(model){
		throw new Error('find not implemented for this adapter');
	},

	/**
	 * @param {Class} model class
	 */
	findAll: function(model) {
		throw new Error('findAll not implemented for this adapter');
	},

	/**
	 * @param {Class} model class
	 * @param {Query} q
	 */
	countAll: function(model, q) {
		throw new Error('countAll not implemented for this adapter');
	},

	/**
	 * @param {Class} model class
	 * @param {Query} q
	 */
	removeAll: function(model, q) {
		throw new Error('removeAll not implemented for this adapter');
	},

	/**
	 * @param {Model} instance
	 */
	insert: function(instance) {
		throw new Error('insert not implemented for this adapter');
	},

	/**
	 * @param {Model} instance
	 */
	update: function(instance) {
		throw new Error('update not implemented for this adapter');
	},

	/**
	 * @param {Model} instance
	 */
	remove: function(instance) {
		throw new Error('remove not implemented for this adapter');
	}
});

dabl.Adapter = Adapter;
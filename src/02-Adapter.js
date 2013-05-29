(function(){

function _sPad(value) {
	value = value + '';
	return value.length === 2 ? value : '0' + value;
}

var Adapter = Class.extend({

	_cache: null,

	cache: function(table, key, value) {
		if (!this._cache) {
			this._cache = {};
		}
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

	emptyCache: function(table) {
		if (!this._cache) {
			this._cache = {};
		}
		delete this._cache[table];
	},

	init: function Adapter() {
	},

	formatDate: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		return value.getFullYear() + '-' + _sPad(value.getMonth() + 1) + '-' + _sPad(value.getDate());
	},

	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		return this.formatDate(value) + ' ' + _sPad(value.getHours()) + ':' + _sPad(value.getMinutes()) + ':' + _sPad(value.getSeconds());
	},

	/**
	 * @param {Class} model class
	 */
	findQuery: function(model) {
		var a = Array.prototype.slice.call(arguments),
			q = new Query().setTable(model.getTableName());
		a.shift();
		var len = a.length;

		if (len === 0) {
			return q;
		}
		if (len === 1) {
			if (!isNaN(parseInt(a[0], 10))) {
				q.add(model.getPrimaryKey(), a[0]);
			} else if (typeof a[0] === 'object') {
				if (a[0] instanceof Query) {
					q = a[0];
				} else {
					// hash
				}
			} else if (typeof a[0] === 'string') {
				// where clause string
				if (a[1] instanceof Array) {
					// arguments
				}
			}
		} else if (len === 2 && typeof a[0] === 'string') {
			q.add(a[0], a[1]);
		} else {
			// if arguments list is greater than 1 and the first argument is not a string
			var pks = model.getPrimaryKeys();
			if (len === pks.len) {
				for (var x = 0, pkLen = pks.length; x < pkLen; ++x) {
					var pk = pks[x],
					pkVal = a[x];

					if (pkVal === null || typeof pkVal === 'undefined') {
						return null;
					}
					q.add(pk, pkVal);
				}
			} else {
				throw new Error('Find called with ' + len + ' arguments');
			}
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
	destroyAll: function(model, q) {
		throw new Error('destroyAll not implemented for this adapter');
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
	destroy: function(instance) {
		throw new Error('destroy not implemented for this adapter');
	}
});

this.Adapter = Adapter;

})();
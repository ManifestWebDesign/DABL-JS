function _sPad(value) {
	value = value + '';
	return value.length == 2 ? value : '0' + value;
}

Adapter = Class.extend({

	_db: null,

	init: function Adapter(db) {
		this._db = db;
	},

	lastInsertId: function() {
		return this._db.execute('SELECT last_insert_rowid()').field(0);
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

	quoteIdentifier: function(text) {
		if (text.constructor == Array) {
			for (var x = 0, len = text.length; x < len; x++) {
				text[x] = this.quoteIdentifier(text[x]);
			}
			return text;
		}

		if (text.indexOf('[') != -1 || text.indexOf(' ') != -1 || text.indexOf('(') != -1 || text.indexOf('*') != -1) {
			return text;
		}
		return '[' + text.replace('.', '].[') + ']';
	},

	/**
	 * @see		DABLPDO::applyLimit()
	 */
	applyLimit: function(sql, offset, limit) {
		if ( limit > 0 ) {
			sql = sql + "\nLIMIT " + limit + (offset > 0 ? ' OFFSET ' + offset : '');
		} else if ( offset > 0 ) {
			sql = sql + "\nLIMIT -1 OFFSET " + offset;
		}
		return sql;
	},

	/**
	 * @param mixed $value
	 * @return mixed
	 */
	prepareInput: function(value) {
		if (value.constructor == Array) {
			value = value.slice(0);
			for (var x = 0, len = value.length; x < len; x++) {
				value[x] = this.prepareInput(value[x]);
			}
			return value;
		}

		if (value === true || value === false) {
			return value ? 1 : 0;
		}

		if (value === null || typeof value == 'undefined') {
			return 'NULL';
		}

		if (parseInt(value, 10) === value) {
			return value;
		}

		if (value instanceof Date) {
			if (value.getSeconds() == 0 && value.getMinutes() == 0 && value.getHours() == 0) {
				// just a date
				value = this.formatDate(value);
			} else {
				value = this.formatDateTime(value);
			}
		}

		return this.quote(value);
	},

	quote: function(value) {
		return "'" + value.replace("'", "''") + "'";
	}
});
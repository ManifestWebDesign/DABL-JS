function padDigits(num) {
	num = num + '';
	if (num.length == 1) {
		num = '0' + num;
	}
	return num;
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
		return value.getFullYear() + '-' + padDigits(value.getMonth() + 1) + '-' + padDigits(value.getDate());
	},

	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		return this.formatDate(value) + ' ' + padDigits(value.getHours()) + ':' + padDigits(value.getMinutes()) + ':' + padDigits(value.getSeconds());
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
		return this.quote(value);
	},

	quote: function(value) {
		return "'" + value.replace("'", "''") + "'";
	}
});
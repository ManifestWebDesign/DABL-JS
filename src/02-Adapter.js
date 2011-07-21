function _sPad(value) {
	value = value + '';
	return value.length == 2 ? value : '0' + value;
}

Adapter = Class.extend({

	_db: null,

	_dbFile: null,

	init: function Adapter(dbFile) {
		this._dbFile = dbFile;
		if (typeof Titanium == 'undefined') {
			this._db = {
				execute: function(){
					return null;
				}
			};
			return;
		}
		this._db = Titanium.Database.open(dbFile);
	},

	/**
	 * Executes the SQL and returns an Array of Objects.  The Array has a
	 * rowsAffected property added to it
	 * @returns Array of Objects
	 */
	execute: function(sql, params) {
		if (!params && sql instanceof QueryStatement) {
			sql = sql.setConnection(this);
			return sql.bindAndExecute();
		}

		var rs,
			rows = [],
			row,
			i,
			j,
			field,
			value;

		if (params && (j = params.length) != 0) {
			for (i = 0; i < j; ++i) {
				value = params[i];
				if (value instanceof Date) {
					if (value.getSeconds() == 0 && value.getMinutes() == 0 && value.getHours() == 0) {
						params[i] = this.formatDate(value); // just a date
					} else {
						params[i] = this.formatDateTime(value);
					}
				}
			}
			rs = this._db.execute(sql, params);
		} else {
			rs = this._db.execute(sql);
		}

		console.log(sql);
		console.log(params);

		rows.rowsAffected = this._db.rowsAffected;

		if (null === rs) {
			return rows;
		}

		while(rs.isValidRow()) {
			row = {};
			for(i = 0, j = rs.getFieldCount(); i < j; ++i) {
				field = rs.getFieldName(i);
				row[field] = rs.field(i);
			}
			rows.push(row);
			rs.next();
		}
		rs.close();

		return rows;
	},

	count: function(sql, params) {
		sql = 'SELECT COUNT(0) AS rCount FROM (' + sql + ') AS a';
		var rows = this.execute(sql, params);
		return parseInt(rows[0].rCount, 10);
	},

	transaction: function(inTransactionCallBack){
		// TODO: Titanium has a bug, so transactions don't work!
			// this.execute('BEGIN');
		// try {
			inTransactionCallBack.apply(this);	inTransactionCallBack.apply(this);
			// this.execute('END');
		// } catch(e) {
			// this.execute('ROLLBACK');
			// throw e;
		// }
	},

	lastInsertId: function() {
		return 47;
		return this._db.lastInsertRowId;
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
		// don't do anything right now, but save this code for later if we need it
		return text;
//		if (text instanceof Array) {
//			for (var x = 0, len = text.length; x < len; ++x) {
//				text[x] = this.quoteIdentifier(text[x]);
//			}
//			return text;
//		}
//
//		if (text.indexOf('[') != -1 || text.indexOf(' ') != -1 || text.indexOf('(') != -1 || text.indexOf('*') != -1) {
//			return text;
//		}
//		return '[' + text.replace('.', '].[') + ']';
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
		if (value instanceof Array) {
			value = value.slice(0);
			for (var x = 0, len = value.length; x < len; ++x) {
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

Adapter.connections = {};

Adapter.addConnection = function(name) {
	this.connections[name] = new this(name);
}

Adapter.getConnection = function(name) {

	// if no name is provided, return the first connection, if it exists
	if (!name) {
		for (name in this.connections) {
			return this.connections[name];
		}
	} else {
		if (name in this.connections) {
			return this.connections[name];
		}
	}

	return new this(name);
};

Adapter.execute = function() {
	var con = this.getConnection();
	return con.execute.apply(con, arguments);
}

Adapter.transaction = function() {
	var con = this.getConnection();
	return con.transaction.apply(con, arguments);
}

Adapter.count = function() {
	var con = this.getConnection();
	return con.count.apply(con, arguments);
}
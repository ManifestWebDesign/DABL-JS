(function(){

var SQLAdapter = Adapter.extend({

	_db: null,

	init: function SQLAdapter(db) {
		this._db = db;
	},

	/**
	 * Executes the SQL and returns an Array of Objects.  The Array has a
	 * rowsAffected property added to it
	 * @returns Array of Objects
	 */
	execute: function(sql, params) {
		return [];

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
		return 1;
		return this._db.lastInsertRowId;
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
	 * @param mixed value
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
	},

	findQuery: function(model) {
		var a = arguments,
			q = new Query().setTable(model.getTableName());
		a.shift();
		var len = a.length;

		if (len == 0) {
			return q;
		}
		if (len == 1) {
			if (!isNaN(parseInt(a[0], 10))) {
				q.add(model.getPrimaryKey(), a[0]);
			} else if (typeof a[0] == 'object') {
				if (a[0] instanceof Query) {
					q = a[0];
				} else {
					// hash
				}
			} else if (typeof a[0] == 'string') {
				// where clause string
				if (a[1] instanceof Array) {
					// arguments
				}
			}
		} else if (len == 2 && typeof a[0] == 'string') {
			q.add(a[0], a[1]);
		} else {
			// if arguments list is greater than 1 and the first argument is not a string
			var pks = model.getPrimaryKeys();
			if (len == pks.len) {
				for (var x = 0, pkLen = pks.length; x < pkLen; ++x) {
					var pk = pks[x],
					pkVal = arguments[x];

					if (pkVal === null || typeof pkVal == 'undefined') {
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

	find: function(model){
		var q = this.findQuery
			.apply(this, arguments)
			.setLimit(1);
		return this.select(q).shift();
	},

	findAll: function(model) {
		return this.select(this.findQuery.apply(this, arguments));
	},

	/**
	 * Executes a select query and returns the PDO result
	 * @return PDOStatement
	 */
	selectRS: function(model, q) {
		q = q || new Query;
		if (!q.getTable() || model.getTableName() != q.getTable()) {
			q.setTable(model.getTableName());
		}
		return q.select(this);
	},

	/**
	 * Returns an array of objects of class class from
	 * the rows of a PDOStatement(query result)
	 *
	 * @param result
	 * @return Model[]
	 */
	fromResult: function(model, result) {
		var objects = [],
			i,
			len,
			object,
			row,
			fieldName;
		for (i = 0, len = result.length; i < len; ++i) {
			object = new model,
			row = result[i];

			for (fieldName in row) {
				object[fieldName] = row[fieldName];
			}
			object.setNew(false);
			objects.push(object);
		}
		return objects;
	},

	/**
	 * @param q
	 * @return int
	 */
	countAll: function(model, q) {
		q = q instanceof Query ? q : new Query(q);
		if (!q.getTable() || model.getTableName() != q.getTable()) {
			q.setTable(model.getTableName());
		}
		return q.count(this);
	},

	/**
	 * @param q
	 */
	destroyAll: function(model, q) {
		if (!q.getTable() || model.getTableName() != q.getTable()) {
			q.setTable(model.getTableName());
		}
		var def = new Deferred()
		q.destroy(this);
		def.resolve();
		return def.promise();
	},

	/**
	 * @param q The Query object that creates the SELECT query string
	 * @return Model[]
	 */
	select: function(model, q) {
		q = q instanceof Query ? q : new Query(q);
		return this.fromResult(model, this.selectRS(model, q));
	},

	updateAll: function(model, data, q) {
		var quotedTable = this.quoteIdentifier(model.getTableName()),
			fields = [],
			values = [],
			statement = new QueryStatement(this),
			x,
			queryString,
			whereClause = q.getWhereClause(this),
			def = new Deferred();

		for (x in data) {
			fields.push(this.quoteIdentifier(x) + ' = ?');
			values.push(data[x]);
		}

		//If array is empty there is nothing to update
		if (fields.length == 0) {
			def.resolve();
			return def.promise();
		}

		queryString = 'UPDATE ' + quotedTable + ' SET ' + fields.join(', ') + ' WHERE ' + whereClause.getString();

		statement.setString(queryString);
		statement.setParams(values);
		statement.addParams(whereClause.getParams());
		statement.bindAndExecute();

		def.resolve();
		return def.promise();
	},

	insert: function(instance) {

		var model = instance.constructor,
			pk = model.getPrimaryKey(),
			fields = [],
			values = [],
			placeholders = [],
			statement = new QueryStatement(this),
			queryString,
			column,
			value,
			result,
			id,
			def = new Deferred();

		for (column in model._columns) {
			value = instance[column];
			if (value === null) {
				if (!instance.isColumnModified(column)) {
					continue;
				}
			} else if (value instanceof Date) {
				if (value.getSeconds() == 0 && value.getMinutes() == 0 && value.getHours() == 0) {
					value = this.formatDate(value);
				} else {
					value = this.formatDateTime(value);
				}
			}
			fields.push(column);
			values.push(value);
			placeholders.push('?');
		}

		queryString = 'INSERT INTO ' +
			model.getTableName() + ' (' + fields.join(',') + ') VALUES (' + placeholders.join(',') + ') ';

		statement.setString(queryString);
		statement.setParams(values);

		result = statement.bindAndExecute();
//		count = result.rowsAffected;

		if (pk && model.isAutoIncrement()) {
			id = this.lastInsertId();
			if (null !== id) {
				instance[pk] = id;
			}
		}

		instance.resetModified();
		instance.setNew(false);

		def.resolve();
		return def.promise();
	},

	update: function(instance) {
		var data = {},
			q = new Query,
			model = instance.constructor,
			pks = model._primaryKeys,
			modColumns = instance.getModifiedColumns(),
			x,
			len,
			modCol,
			pk,
			pkVal,
			value;

		if (pks.length == 0) {
			throw new Error('This table has no primary keys');
		}

		for (modCol in modColumns) {
			value = instance[modCol];
			if (value instanceof Date) {
				if (value.getSeconds() == 0 && value.getMinutes() == 0 && value.getHours() == 0) {
					value = this.formatDate(value);
				} else {
					value = this.formatDateTime(value);
				}
			}
			data[modCol] = value;
		}

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			pkVal = instance[pk];
			if (pkVal === null) {
				throw new Error('Cannot delete using NULL primary key.');
			}
			q.addAnd(pk, pkVal);
		}

		var promise = this.updateAll(model, data, q);
		promise.then(function(){
			instance.resetModified();
		})
		return promise;
	},

	destroy: function(instance) {
		var pks = instance.constructor._primaryKeys,
			q = new Query,
			x,
			len,
			pk,
			pkVal;

		if (pks.length == 0) {
			throw new Error('This table has no primary keys');
		}

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			pkVal = instance[pk];
			if (pkVal === null) {
				throw new Error('Cannot delete using NULL primary key.');
			}
			q.addAnd(pk, pkVal);
		}

		return this.destroyAll(instance.constructor, q);
	}
});

this.SQLAdapter = SQLAdapter;
})();
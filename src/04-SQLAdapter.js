(function(){

var SQLAdapter = Adapter.extend({

	_db: null,

	init: function SQLAdapter(db) {
		this._db = db;
		this._super();
	},

	/**
	 * Executes the SQL and returns an Array of Objects.  The Array has a
	 * rowsAffected property added to it
	 * @param {mixed} sql
	 * @param {Array} params
	 * @returns Array of Objects
	 */
	execute: function(sql, params) {
		if (sql instanceof Query) {
			sql = sql.getQuery(this);
		}

		if (sql instanceof QueryStatement) {
			sql.setConnection(this);
			return this.execute(sql.getString(), sql.getParams());
		}

		var rs,
			rows = [],
			row,
			i,
			j,
			field,
			value;

		if (params && (j = params.length) !== 0) {
			for (i = 0; i < j; ++i) {
				value = params[i];
				if (value instanceof Date) {
					if (value.getSeconds() === 0 && value.getMinutes() === 0 && value.getHours() === 0) {
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

		rows.rowsAffected = parseInt(this._db.rowsAffected) || 0;

		if (null === rs) {
			return rows;
		}

		while (rs.isValidRow()) {
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
		return parseInt(rows[0].rCount, 10) || 0;
	},

	transaction: function(inTransactionCallBack) {
//		this.execute('BEGIN');
//		try {
			inTransactionCallBack.apply(this);
//			this.execute('END');
//		} catch (e) {
//			this.execute('ROLLBACK');
//			throw e;
//		}
	},

	/**
	 * @return {Number}
	 */
	lastInsertId: function() {
		return this._db.lastInsertRowId;
	},

	/**
	 * @param {String} text
	 * @return {String}
	 */
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
	 * @param {String} sql
	 * @param {Number} offset
	 * @param {Number} limit
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
	 * @param {mixed} value
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

		if (value === null || typeof value === 'undefined') {
			return 'NULL';
		}

		if (parseInt(value, 10) === value) {
			return value;
		}

		if (value instanceof Date) {
			if (value.getSeconds() === 0 && value.getMinutes() === 0 && value.getHours() === 0) {
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

	find: function(model) {
		var q = this.findQuery
			.apply(this, arguments)
			.setLimit(1);
		return this.select(model, q).shift() || null;
	},

	findAll: function(model) {
		return this.select(model, this.findQuery.apply(this, arguments));
	},

	/**
	 * Executes a select query and returns the PDO result
	 * @return Array
	 */
	selectRS: function(model, q) {
		q = q || new Query;
		if (!q.getTable() || model.getTableName() !== q.getTable()) {
			q.setTable(model.getTableName());
		}
		return this.execute(q.getSelectQuery(this));
	},

	/**
	 * Returns an array of objects of class class from
	 * the rows of a PDOStatement(query result)
	 *
	 * @param {Model} model
	 * @param {Array} result
	 * @return Model[]
	 */
	fromResult: function(model, result) {
		var objects = [],
			i,
			len,
			object,
			row,
			fieldName,
			pk = model.getPrimaryKey();
		for (i = 0, len = result.length; i < len; ++i) {
			object,
			row = result[i];

			if (pk && row[pk]) {
				object = this.cache(model._table, row[pk]);
				if (object) {
					objects.push(object);
					continue;
				}
			}

			object = new model;
			for (fieldName in row) {
				object[fieldName] = row[fieldName];
			}
			object.setNew(false);
			objects.push(object);
		}
		return objects;
	},

	/**
	 * @param {Model} model
	 * @param {Query} q
	 * @return int
	 */
	countAll: function(model, q) {
		q = q instanceof Query ? q : new Query(q);
		if (!q.getTable() || model.getTableName() !== q.getTable()) {
			q.setTable(model.getTableName());
		}
		var rs = this.execute(q.getCountQuery(this));
		return parseInt(rs[0], 10) || 0;
	},

	/**
	 * @param {Model} model
	 * @param {Query} q
	 */
	destroyAll: function(model, q) {
		if (!q.getTable() || model.getTableName() !== q.getTable()) {
			q.setTable(model.getTableName());
		}
		this.emptyCache(model._table);
		return this.execute(q.getDeleteQuery(this)).rowsAffected;
	},

	/**
	 * @param {Model} model
	 * @param {Query} q The Query object that creates the SELECT query string
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
			whereClause = q.getWhereClause(this);

		for (x in data) {
			fields.push(this.quoteIdentifier(x) + ' = ?');
			values.push(data[x]);
		}

		//If array is empty there is nothing to update
		if (fields.length === 0) {
			return 0;
		}

		queryString = 'UPDATE ' + quotedTable + ' SET ' + fields.join(', ') + ' WHERE ' + whereClause.getString();

		statement.setString(queryString);
		statement.setParams(values);
		statement.addParams(whereClause.getParams());

		var result = this.execute(statement);

		this.emptyCache(model._table);

		return result.rowsAffected || 0;
	},

	insert: function(instance) {

		var model = instance.constructor,
			pk = model.getPrimaryKey(),
			fields = [],
			values = [],
			placeholders = [],
			statement = new QueryStatement(this),
			queryString,
			fieldName,
			value,
			result,
			id;

		for (fieldName in model._fields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			if (value === null) {
				if (!instance.isModified(fieldName)) {
					continue;
				}
			}
			fields.push(fieldName);
			values.push(value);
			placeholders.push('?');
		}

		queryString = 'INSERT INTO ' +
			model.getTableName() + ' (' + fields.join(',') + ') VALUES (' + placeholders.join(',') + ') ';

		statement.setString(queryString);
		statement.setParams(values);

		result = this.execute(statement);

		if (pk && model.isAutoIncrement()) {
			id = this.lastInsertId();
			if (null !== id) {
				instance[pk] = id;
			}
		}

		instance.resetModified();
		instance.setNew(false);

		if (pk && instance[pk]) {
			this.cache(model._table, instance[pk], instance);
		}

		return result.rowsAffected;
	},

	update: function(instance) {
		var data = {},
			q = new Query,
			model = instance.constructor,
			pks = model.getPrimaryKeys(),
			modFields = instance.getModified(),
			x,
			len,
			fieldName,
			pk,
			pkVal,
			value;

		if (!instance.isModified()) {
			return 0;
		}

		if (pks.length === 0) {
			throw new Error('This table has no primary keys');
		}

		for (fieldName in modFields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			data[fieldName] = value;
		}

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			pkVal = instance[pk];
			if (pkVal === null) {
				throw new Error('Cannot destroy using NULL primary key.');
			}
			q.addAnd(pk, pkVal);
		}

		var count = this.updateAll(model, data, q);
		instance.resetModified();

		return count;
	},

	destroy: function(instance) {
		var model = instance.constructor,
			pks = model.getPrimaryKeys(),
			q = new Query,
			x,
			len,
			pk,
			pkVal;

		if (pks.length === 0) {
			throw new Error('This table has no primary keys');
		}

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			pkVal = instance[pk];
			if (pkVal === null) {
				throw new Error('Cannot destroy using NULL primary key.');
			}
			q.addAnd(pk, pkVal);
		}

		return this.destroyAll(model, q);
	}
});

this.SQLAdapter = SQLAdapter;
})();
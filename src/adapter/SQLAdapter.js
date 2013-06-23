(function(){

this.SQLAdapter = Adapter.extend({

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

	/**
	 * @param {String} sql
	 * @param {Array} params
	 * @returns {Number}
	 */
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
	 * @param {Model} model
	 * @param {Query} q
	 * @return {Array}
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
			len;
		for (i = 0, len = result.length; i < len; ++i) {
			objects.push(model.inflate(result[i]));
		}
		return objects;
	},

	/**
	 * @param {Model} model
	 * @param {Query} q
	 * @return {Number}
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
			q.and(pk, pkVal);
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
			q.and(pk, pkVal);
		}

		return this.destroyAll(model, q);
	}
});

SQLAdapter.Migration = Class.extend({
	adapter: null,
	schema: null,
	// Primary method for initializing Migration via manual or automigration
	init: function(sqlAdapter) {
		this.adapter = sqlAdapter;
		this.schema = Model.extend('schema_definitions', {
			adapter: sqlAdapter,
			fields: {
				id: { type: Model.FIELD_TYPE_INTEGER, computed: true, key: true },
				table_name: Model.FIELD_TYPE_TEXT,
				column_names: Model.FIELD_TYPE_INTEGER,
				column_types: Model.FIELD_TYPE_INTEGER
			}
		});
	},
	migrate: function(options) {
		if (!options) {
			options = {};
		}

		var tableName,
			migrations = {},
			startVersion,
			targetVersion,
			i;

		// Drop tables
		if (options.refresh) {
			for (tableName in Model.models){
				this.adapter.execute('DROP TABLE IF EXISTS ' + tableName);
	//				Migration.each(model.options.hasAndBelongsToMany, function(assocTable) {
	//					var mappingTable = [model.table, assocTable].sort().toString().replace(',', '_');
	//					var sql = 'DROP TABLE IF EXISTS ' + mappingTable;
	//					this.adapter.execute(sql);
	//				});
			}
			this.setupSchema(true);
		} else {
			this.setupSchema();
		}

		if (this.adapter.migrations) {
			migrations = this.adapter.migrations;
		}

		// test for apparently-valid obj literal based on migration 1 being present
		if (migrations[1] && migrations[1].constructor === Object) {
			startVersion = this.currentSchemaVersion();
			targetVersion = Infinity;

			// did user specify a migration number?
			if (options.number !== null && typeof options.number !== 'undefined') {
				targetVersion = options.number;
			} else if (typeof options === 'number') {
				targetVersion = options;
			}

			// actually handle a migrations object
			i = startVersion;

			do {
				// schema is already up to date
				if (i === targetVersion) {
					// up to date
					return;
				} else if (i < targetVersion) {
					// migrate up
					i += 1;
					if (migrations[i] !== null && typeof migrations[i] !== 'undefined')
						migrations[i].up();
					else
						break;
				} else {
					// migrate down
					migrations[i].down();
					i -= 1;
				}
				this.updateSchemaVersion(i);
			} while(migrations[i]);
		} else {
			// developer can choose to use automigrations while in dev mode
	//		Migration.models.each(function(model) {
	//			var sql = 'CREATE TABLE IF NOT EXISTS ' + model.table + '(id INTEGER PRIMARY KEY AUTOINCREMENT';
	//			for (var colName in model._fields) {
	//				var colType = model._fields[colName];
	//				if (colName !== 'id')
	//					sql += (', ' + colName + ' ' + colType.toUpperCase());
	//			}
	//			sql += ')';
	//			this.adapter.execute(sql);

	//			Migration.each(model.options.hasAndBelongsToMany, function(assocTable, association) {
	//				var mappingTable = [model.table, assocTable].sort().toString().replace(',', '_');
	//				var localKey = model.options.foreignKey;
	//				var foreignKey = Migration.models.get(assocTable).options.foreignKey;
	//				var keys = [localKey, foreignKey].sort();
	//				var sql = 'CREATE TABLE IF NOT EXISTS ' + mappingTable + '(' + keys[0] + ' INTEGER, ' + keys[1] + ' INTEGER)';
	//				this.adapter.execute(sql);
	//			});
	//
	//			model._fields.id = 'INTEGER';
	//		});
		}

		// handle fixture data, if passed in fixtures erase all old data
		if (options && options.refresh)
			this.loadFixtures();
	},
	setupSchema: function(force) {
		var sql;
		this.createTable('schema_migrations', {
			version: Model.FIELD_TYPE_TEXT
		});
		if (this.adapter.count('SELECT * FROM schema_migrations') === 0) {
			sql = 'INSERT INTO schema_migrations (version) VALUES(0)';
			this.adapter.execute(sql);
		}
		if (force && this.adapter.count('SELECT * FROM schema_migrations') === 1) {
			sql = 'UPDATE schema_migrations set version = 0';
			this.adapter.execute(sql);
		}
		this.createTable('schema_definitions', {
			id: Model.FIELD_TYPE_INTEGER,
			table_name: Model.FIELD_TYPE_TEXT,
			column_names: Model.FIELD_TYPE_INTEGER,
			column_types: Model.FIELD_TYPE_INTEGER
		});
	},
	writeSchema: function(tableName, cols) {
		if (tableName === 'schema_definitions' || tableName === 'schema_migrations')
			return;
		var keys = [],
			values = [],
			names,
			types,
			table;
		for (var cName in cols) {
			keys.push(cName);
			values.push(cols[cName]);
		}
		names = keys.join();
		types = keys.join();
		table = this.schema.findBy('table_name', tableName);
		if (table) {
			table.column_names = names;
			table.column_types = types;
			table.save();
		} else {
			table = new this.schema;
			table.setValues({
				table_name: tableName,
				column_names: names,
				column_types: types
			});
			table.save();
		}
	},
	readSchema: function(tableName) {
		if (tableName === 'schema_definitions' || tableName === 'schema_migrations')
			return null;
		var table = this.schema.findBy('table_name', tableName),
			column_names = table.column_names.split(','),
			column_types = table.column_types.split(','),
			cols = {},
			col;
		for (var i = 0, len = column_names.length; i < len; ++i){
			col = column_names[i];
			cols[col] = column_types[i];
		}
		return cols;
	},
	currentSchemaVersion: function() {
		var sql = 'SELECT version FROM schema_migrations LIMIT 1';

		return parseInt(this.adapter.execute(sql)[0].version, 10);
	},
	updateSchemaVersion: function(number) {
		var sql = 'UPDATE schema_migrations SET version = ' + number;
		return this.adapter.execute(sql);
	},
	modifyColumn: function(tableName, columnName, options) {
		if (!options) {
			throw new Error('MIGRATION_EXCEPTION: Not a valid column modification');
		}

		var oldCols = this.readSchema(tableName),
			newCols = {},
			colName,
			colType;

		for (colName in oldCols) {
			colType = oldCols[colName];
			switch(options['modification']) {
				case 'remove':
					if (colName !== columnName)
						newCols[colName] = colType;
					break;

				case 'rename':
					if (colName !== columnName) {
						newCols[colName] = colType;
					}
					else {
						newCols[options.newName] = colType;
					}
					break;

				case 'change':
					if (colName !== columnName) {
						newCols[colName] = colType;
					}
					else {
						newCols[colName] = options.newType;
					}
					break;

				default:
					throw('MIGRATION_EXCEPTION: Not a valid column modification');
			}
		}

		this.adapter.transaction(function() {
			var records = this.adapter.execute('SELECT * FROM ' + tableName);
			if (records.length !== 0) {
				throw new Error('Modify column not quite ready yet...');
			}

			this.dropTable(tableName);
			this.createTable(tableName, newCols);

			for (var i = 0, len = records.length; i < len; ++i) {
				 var record = records[i];
				 switch (options.modification) {
					 case 'remove':
						 delete record[columnName];
						 Model.insert(tableName, record);
						 break;
					 case 'rename':
						 record[options.newName] = record[columnName];
						 delete record[columnName];
						 Model.insert(tableName, record);
						 break;
					 case 'change':
						 Model.insert(tableName, record);
						 break;
					 default:
						 throw('MIGRATION_EXCEPTION: Not a valid column modification');
				 }
			}
		});
	},
	createTable: function(name, columns) {
		if (!name || !columns) {
			return;
		}
		var sql = 'CREATE TABLE IF NOT EXISTS ' + name + "\n",
			colName,
			colType,
			i = 0;

		sql += '(';
		for (colName in columns) {
			colType = columns[colName];
			if (0 !== i) {
				sql += ",\n";
			}
			sql += (colName + ' ' + colType);
			if (colType === Model.FIELD_TYPE_INTEGER && colName === 'id') {
				sql += ' PRIMARY KEY AUTOINCREMENT';
			}
			++i;
		}
		sql += ')';
		this.adapter.execute(sql);

		this.writeSchema(name, columns);
	},
	dropTable: function(name) {
		var sql = 'DROP TABLE IF EXISTS ' + name,
			schemaTable;
		this.adapter.execute(sql);
		schemaTable = this.schema.findBy('table_name', name);
		schemaTable.destroy();
	},
	renameTable: function(oldName, newName) {
		var sql = 'ALTER TABLE ' + oldName + ' RENAME TO ' + newName,
			schemaTable;
		this.adapter.execute(sql);
		schemaTable = this.schema.findBy('table_name', oldName);
		schemaTable.table_name = newName;
		schemaTable.save();
	},
	addColumn: function(tableName, columnName, dataType) {
		var sql = 'ALTER TABLE ' + tableName + ' ADD COLUMN ' + columnName + ' ' + dataType,
			cols;
		this.adapter.execute(sql);
		cols = this.readSchema(tableName);
		cols[columnName] = dataType;
		this.writeSchema(tableName, cols);
	},
	removeColumn: function(tableName, columnName) {
		return this.modifyColumn(tableName, columnName, {
			modification: 'remove'
		});
	},
	renameColumn: function(tableName, columnName, newColumnName) {
		var options = {
			modification: 'rename',
			newName: newColumnName
		};
		return this.modifyColumn(tableName, columnName, options);
	},
	changeColumn: function(tableName, columnName, type) {
		var options = {
			modification: 'change',
			newType: type
		};
		return this.modifyColumn(tableName, columnName, options);
	},
	addIndex: function(tableName, columnName, unique) {
		var sql = 'CREATE' + (unique ? ' UNIQUE ' : ' ') + 'INDEX IF NOT EXISTS ' + tableName + '_' + columnName + '_index ON ' + tableName + ' (' + columnName + ')';
		return this.adapter.execute(sql);
	},
	removeIndex: function(tableName, columnName) {
		var sql = 'DROP INDEX IF EXISTS ' + tableName + '_' + columnName + '_index';
		return this.adapter.execute(sql);
	},
	loadFixtures: function() {
//		var fixtures = Migration.fixtures;
//		Migration.each(fixtures.tables, function(tableData, tableName) {
//			Migration.each(tableData, function(record) {
//				Migration.models.get(tableName).create(record);
//			});
//		});
//
//		if (!fixtures.mappingTables)
//			return;
//
//		Migration.each(fixtures.mappingTables, function(tableData, tableName) {
//			Migration.each(tableData, function(colData) {
//				var dataHash = new Migration.Hash(colData);
//				var sql = 'INSERT INTO ' + tableName + ' (' + dataHash.getKeys().toString() + ') VALUES(' + dataHash.getValues().toString() + ')';
//				this.adapter.execute(sql);
//			});
//		});
	}
});

SQLAdapter.TiDebugDB = Class.extend({
	lastInsertRowId: null,
	rowsAffected: null,
	lastSQL: null,
	lastParams: null,
	execute: function(sql, params) {
		console.log(sql, params);

		this.lastSQL = sql;
		this.lastParams = params;

		if (sql.toUpperCase().indexOf('INSERT') === 0) {
			if (this.lastInsertRowId === null) {
				this.lastInsertRowId = 1;
			} else {
				++this.lastInsertRowId;
			}
			this.rowsAffected = 1;
		}
		if (
			sql.toUpperCase().indexOf('DELETE') === 0
			|| sql.toUpperCase().indexOf('UPDATE') === 0
		) {
			this.rowsAffected = 1;
		}

		return {
			sql: sql,
			params: params,
			isValidRow: function() {
				return false;
			},
			getRowCount: function() {
				return 0;
			},
			getFieldCount: function() {
				return 0;
			},
			getFieldName: function() {
				return '';
			},
			field: function() {
				return '';
			},
			next: function() {
			},
			close: function() {
			}
		};
	}

});

})();
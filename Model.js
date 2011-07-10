Model = Class.extend({

	toString: function() {
		return this.constructor.getName() + implode('-', this.getPrimaryKeyValues());
	},

	/**
	 * Array to contain names of modified columns
	 */
	_modifiedColumns: {},

	/**
	 * Whether or not to save dates as formatted date/time strings
	 */
	_formatDates: true,

	/**
	 * Whether or not this is a new object
	 */
	_isNew: true,

	/**
	 * Errors from the validate() step of saving
	 */
	_validationErrors: [],

	/**
	 * Creates new instance of self and with the same values as this, except
	 * the primary key value is cleared
	 * @return Model
	 */
	copy: function() {
		var newObject = new this.constructor;
		newObject.fromArray(this.toArray());

		var pks = this.constructor.getPrimaryKeys();
		for (var x = 0, len = pks.length; x < len; x++) {
			var pk = pks[x];
			newObject['set' + pk](null);
		}
		return newObject;
	},

	/**
	 * Checks whether any of the columns have been modified from the database values.
	 * @return bool
	 */
	isModified: function() {
		return this.getModifiedColumns().length > 0;
	},

	/**
	 * Checks whether the given column is in the modified array
	 * @return bool
	 */
	isColumnModified: function(columnName) {
		for (var key in this._modifiedColumns) {
			var modifiedColumn = this._modifiedColumns[key];
			if (columnName.toLowerCase() = modifiedColumn.toLowerCase()) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Returns an array of the names of modified columns
	 * @return array
	 */
	getModifiedColumns: function() {
		return this._modifiedColumns;
	},

	/**
	 * Sets the value of a property/column
	 * @param string columnName
	 * @param mixed value
	 * @param string columnType
	 * @return Model
	 */
	setColumnValue: function(columnName, value, columnType) {
		if (null === columnType) {
			columnType = this.constructor.getColumnType(columnName);
		}

		var temporal = Model.isTemporalType(columnType),
			numeric = Model.isNumericType(columnType);

		if (numeric || temporal) {
			if ('' === value) {
				value = null;
			} else if (null !== value) {
				if (numeric) {
					if (Model.isIntegerType(columnType)) {
						// validate and cast
						if (!is_int(value)) {
							var intVal = parseInt(value, 10);
							if (intVal.toString() != value.toString()) {
								throw new Error(value + ' is not a valid integer or it is too large');
							}
							value = intVal;
						}
					} else {
						// only validates, doesn't cast...yet
						var floatVal = parseFloat(value, 10);
						if (floatVal.toString() != value.toString()) {
							throw new Error(value + ' is not a valid float or it is too large');
						}
					}
				}
				if (this._formatDates && temporal) {
					value = Model.coerceTemporalValue(value, columnType, this.constructor.getConnection());
				}
			}
		}

		// TODO: figure out how to access column values
		if (this.columnName !== value) {
			this._modifiedColumns[columnName] = columnName;
			this.column_name = value;
		}
		return this;
	},

	/**
	 * Clears the array of modified column names
	 * @return Model
	 */
	resetModified: function() {
		this._modifiedColumns = {};
		return this;
	},

	/**
	 * Populates this with the values of an associative Array.
	 * Array keys must match column names to be used.
	 * @param array array
	 * @return Model
	 */
	fromArray: function(object) {
		var columns = this.constructor.getColumnNames();
		for (var x = 0, len = columns.length; x < len; x++) {
			var column = columns[x];
			if (!(column in object)) {
				continue;
			}
			this['set' + column](object[column]);
		}
		return this;
	},

	/**
	 * Returns an associative Array with the values of this.
	 * Array keys match column names.
	 * @return array
	 */
	toArray: function() {
		var array = {},
			columns = this.constructor.getColumnNames();
		for (var x = 0, len = columns.length; x < len; x++) {
			var column = columns[x];
			array[column] = this['get' + column]();
		}
		return array;
	},

	/**
	 * Returns true if this table has primary keys and if all of the primary values are not null
	 * @return bool
	 */
	hasPrimaryKeyValues: function() {
		var pks = this.constructor.getPrimaryKeys();
		if (!pks) {
			return false;
		}
		for (var x = 0, len = pks.length; x < len; x++) {
			var pk = pks[x];
			if (this['get' + pk]() === null) {
				return false;
			}
		}
		return true;
	},

	/**
	 * Returns an array of all primary key values.
	 *
	 * @return mixed[]
	 */
	getPrimaryKeyValues: function() {
		var arr = [],
			pks = this.constructor.getPrimaryKeys();

		for (var x = 0, len = pks.length; x < len; x++) {
			var pk = pks[x];
			arr.push(this['get' + pk]());
		}
		return arr;
	},

	/**
	 * Returns true if the column values validate.
	 * @return bool
	 */
	validate: function() {
		this._validationErrors = [];
		return true;
	},

	/**
	 * See this.validate()
	 * @return array Array of errors that occured when validating object
	 */
	getValidationErrors: function() {
		return this._validationErrors;
	},

	/**
	 * Creates and executess DELETE Query for this object
	 * Deletes any database rows with a primary key(s) that match this
	 * NOTE/BUG: If you alter pre-existing primary key(s) before deleting, then you will be
	 * deleting based on the new primary key(s) and not the originals,
	 * leaving the original row unchanged(if it exists).  Also, since NULL isn't an accurate way
	 * to look up a row, I return if one of the primary keys is null.
	 * @return int number of records deleted
	 */
	destroy: function() {
		var pks = this.constructor.getPrimaryKeys(),
			q = new Query;

		if (!pks) {
			throw new Error('This table has no primary keys');
		}

		for (var x = 0, len = pks.length; x < len; x++) {
			var pk = pks[x];
			var pkVal = this['get' + pk]();
			if (pkVal === null) {
				throw new Error('Cannot delete using NULL primary key.');
			}
			q.addAnd(pk, pkVal);
		}

		q.setTable(this.constructor.getTableName());
		var result = this.constructor.doDelete(q, false);
		this.constructor.removeFromPool(this);
		return result;
	},

	/**
	 * Saves the values of this to a row in the database.  If there is an
	 * existing row with a primary key(s) that matches this, the row will
	 * be updated.  Otherwise a new row will be inserted.  If there is only
	 * 1 primary key, it will be set using the last_insert_id() function.
	 * NOTE: If you alter pre-existing primary key(s) before saving, then you will be
	 * updating/inserting based on the new primary key(s) and not the originals,
	 * leaving the original row unchanged(if it exists).
	 * @todo find a way to solve the above issue
	 * @return int number of records inserted or updated
	 */
	save: function() {
		if (!this.validate()) {
			throw new Error('Cannot save ' + this.constructor.getClassName() + ' with validation errors.');
		}

		if (this.constructor.getPrimaryKeys().length == 0) {
			throw new Error('Cannot save without primary keys');
		}

		if (this.isNew() && this.constructor.hasColumn('Created') && !this.isColumnModified('Created')) {
			this.setCreated(CURRENT_TIMESTAMP);
		}

		if ((this.isNew() || this.isModified()) && this.constructor.hasColumn('Updated') && !this.isColumnModified('Updated')) {
			this.setUpdated(CURRENT_TIMESTAMP);
		}

		if (this.isNew()) {
			return this.insert();
		}
		return this.update();
	},

	archive: function() {
		if (!this.constructor.hasColumn('Archived')) {
			throw new Error('Cannot call archive on models without "Archived" column');
		}

		if (null !== this.getArchived()) {
			throw new Error('This ' + this.constructor.getClassName() + ' is already archived.');
		}

		this.setArchived(CURRENT_TIMESTAMP);
		return this.save();
	},

	/**
	 * Returns true if this has not yet been saved to the database
	 * @return bool
	 */
	isNew: function() {
		return this._isNew;
	},

	/**
	 * Indicate whether this object has been saved to the database
	 * @param bool bool
	 * @return Model
	 */
	setNew: function (bool) {
		this._isNew = (bool == true);
		return this;
	},

	/**
	 * Creates and executes INSERT query string for this object
	 * @return int
	 */
	insert: function() {
		var conn = this.constructor.getConnection(),
			pk = this.constructor.getPrimaryKey(),
			fields = [],
			values = [],
			placeholders = [],
			columns = this.constructor.getColumnNames(),
			quotedTable = conn.quoteIdentifier(this.getTableName()),
			statement = new QueryStatement(conn);

		for (var x = 0, len = columns.length; x < len; x++) {
			var column = columns[x],
				value = this['get' + column]();

			if (value === null && !this.isColumnModified(column)) {
				continue;
			}

			fields.push(conn.quoteIdentifier(column));
			values.push(value);
			placeholders.push('?');
		}

		var queryString = 'INSERT INTO ' +
			quotedTable + ' (' + fields.join(', ') + ') VALUES (' +
			placeholders.join(', ') + ') ';

		statement.setString(queryString);
		statement.setParams(values);

		var result = statement.bindAndExecute();
		var count = result.rowCount();

		if (pk && this.isAutoIncrement()) {
			var id = conn.lastInsertId();
			if (null !== id) {
				this['set' + pk](id);
			}
		}

		this.resetModified();
		this.setNew(false);
		this.constructor.insertIntoPool(this);

		return count;
	},

	/**
	 * Creates and executes UPDATE query string for this object.  Returns
	 * the number of affected rows.
	 * @return Int
	 */
	_update: function() {
		if (!this.constructor.getPrimaryKeys()) {
			throw new Error('This table has no primary keys');
		}

		var conn = this.constructor.getConnection(),
			quotedTable = conn.quoteIdentifier(this.constructor.getTableName()),
			fields = [],
			values = [],
			pkWhere = [],
			statement = new QueryStatement(conn),
			pks = this.constructor.getPrimaryKeys(),
			modColumns = this.getModifiedColumns();

		for (var x = 0, len = modColumns.length; x < len; x++) {
			var modCol = modColumns[x];
			fields.push(conn.quoteIdentifier(modCol) + ' = ?');
			values.push(this['get' + modCol]());
		}

		//If array is empty there is nothing to update
		if (!fields) {
			return 0;
		}

		for (x = 0, len = pks.length; x < len; x++) {
			var pk = pks[x],
				pkVal = this['get' + pk]();
			if (pkVal === null)
				throw new Error('Cannot update with NULL primary key.');
			pkWhere.push(conn.quoteIdentifier(pk) + ' = ?');
			values.push(pkVal);
		}

		var queryString = 'UPDATE ' + quotedTable + ' SET ' + fields.join(', ') + ' WHERE ' + pkWhere.join(' AND ');

		statement.setString(queryString);
		statement.setParams(values);
		var result = statement.bindAndExecute();
		this.resetModified();
		this.constructor.removeFromPool(this);
		return result.rowCount();
	}

});

Model.COLUMN_TYPE_CHAR = 'CHAR';
Model.COLUMN_TYPE_VARCHAR = 'VARCHAR';
Model.COLUMN_TYPE_LONGVARCHAR = 'LONGVARCHAR';
Model.COLUMN_TYPE_NUMERIC = 'NUMERIC';
Model.COLUMN_TYPE_DECIMAL = 'DECIMAL';
Model.COLUMN_TYPE_TINYINT = 'TINYINT';
Model.COLUMN_TYPE_SMALLINT = 'SMALLINT';
Model.COLUMN_TYPE_INTEGER = 'INTEGER';
Model.COLUMN_TYPE_BIGINT = 'BIGINT';
Model.COLUMN_TYPE_REAL = 'REAL';
Model.COLUMN_TYPE_FLOAT = 'FLOAT';
Model.COLUMN_TYPE_DOUBLE = 'DOUBLE';
Model.COLUMN_TYPE_BINARY = 'BINARY';
Model.COLUMN_TYPE_VARBINARY = 'VARBINARY';
Model.COLUMN_TYPE_LONGVARBINARY = 'LONGVARBINARY';
Model.COLUMN_TYPE_BLOB = 'BLOB';
Model.COLUMN_TYPE_DATE = 'DATE';
Model.COLUMN_TYPE_TIME = 'TIME';
Model.COLUMN_TYPE_TIMESTAMP = 'TIMESTAMP';
Model.COLUMN_TYPE_BOOLEAN = 'BOOLEAN';

Model.TEXT_TYPES = {
	COLUMN_TYPE_CHAR: Model.COLUMN_TYPE_CHAR,
	COLUMN_TYPE_VARCHAR: Model.COLUMN_TYPE_VARCHAR,
	COLUMN_TYPE_LONGVARCHAR: Model.COLUMN_TYPE_LONGVARCHAR,
	COLUMN_TYPE_DATE: Model.COLUMN_TYPE_DATE,
	COLUMN_TYPE_TIME: Model.COLUMN_TYPE_TIME,
	COLUMN_TYPE_TIMESTAMP: Model.COLUMN_TYPE_TIMESTAMP
};

Model.INTEGER_TYPES = {
	COLUMN_TYPE_SMALLINT: Model.COLUMN_TYPE_SMALLINT,
	COLUMN_TYPE_TINYINT: Model.COLUMN_TYPE_TINYINT,
	COLUMN_TYPE_INTEGER: Model.COLUMN_TYPE_INTEGER,
	COLUMN_TYPE_BIGIN: Model.COLUMN_TYPE_BIGINT
};

Model.LOB_TYPES = {
	COLUMN_TYPE_VARBINARY: Model.COLUMN_TYPE_VARBINARY,
	COLUMN_TYPE_LONGVARBINARY: Model.COLUMN_TYPE_LONGVARBINARY,
	COLUMN_TYPE_BLO: Model.COLUMN_TYPE_BLOB
};

Model.TEMPORAL_TYPES = {
	COLUMN_TYPE_DATE: Model.COLUMN_TYPE_DATE,
//	COLUMN_TYPE_TIME: Model.COLUMN_TYPE_TIME,
	COLUMN_TYPE_TIMESTAMP: Model.COLUMN_TYPE_TIMESTAMP
};

Model.NUMERIC_TYPES = {
	COLUMN_TYPE_SMALLINT: Model.COLUMN_TYPE_SMALLINT,
	COLUMN_TYPE_TINYINT: Model.COLUMN_TYPE_TINYINT,
	COLUMN_TYPE_INTEGER: Model.COLUMN_TYPE_INTEGER,
	COLUMN_TYPE_BIGINT: Model.COLUMN_TYPE_BIGINT,
	COLUMN_TYPE_FLOAT: Model.COLUMN_TYPE_FLOAT,
	COLUMN_TYPE_DOUBLE: Model.COLUMN_TYPE_DOUBLE,
	COLUMN_TYPE_NUMERIC: Model.COLUMN_TYPE_NUMERIC,
	COLUMN_TYPE_DECIMAL: Model.COLUMN_TYPE_DECIMAL,
	COLUMN_TYPE_REA: Model.COLUMN_TYPE_REAL
};

/**
 * Whether passed type is a temporal (date/time/timestamp) type.
 *
 * @param type Propel type
 * @return boolean
 */
Model.isTemporalType = function(type) {
	return (type in this.TEMPORAL_TYPES);
}

/**
 * Returns true if values for the type need to be quoted.
 *
 * @param type The Propel type to check.
 * @return boolean True if values for the type need to be quoted.
 */
Model.isTextType = function(type) {
	return (type in this.TEXT_TYPES);
}

/**
 * Returns true if values for the type are numeric.
 *
 * @param type The Propel type to check.
 * @return boolean True if values for the type need to be quoted.
 */
Model.isNumericType = function(type) {
	return (type in this.NUMERIC_TYPES);
}

/**
 * Returns true if values for the type are integer.
 *
 * @param type
 * @return boolean
 */
Model.isIntegerType = function(type) {
	return (type in this.INTEGER_TYPES);
}

/**
 * Returns an array of objects of class class from
 * the rows of a PDOStatement(query result)
 *
 * @param result
 * @return Model[]
 */
Model.fromResult = function(result) {
	var objects = [],
		fieldCount = result.fieldCount();
	while (result.isValidRow()) {
		var object = new this;
		for (var x = 0; x < fieldCount; x++) {
			var fieldName = result.fieldName(x);
			object['set' + fieldName](result.field(x));
		}
		object.setNew(false);
		objects.push(object);
		result.next();
	}
	return objects;
}

Model.coerceTemporalValue = function(value, columnType) {
	if (value.constructor == Array) {
		for (var x = 0, len = value; x < len; x++) {
			value[x] = this.coerceTemporalValue(value[x], columnType);
		}
		return value;
	}
	return new Date(value);
}

Model._tableName = null;

Model._primaryKeys = [];

Model._primaryKey = null;

Model._isAutoIncrement = true;

Model._columnNames = [];

Model._columnTypes = {};

Model._connectionName = 'default_connection';

Model.getConnection = function(){
	return DBManager.getConnection(this._connectionName);
}

/**
 * Returns string representation of table name
 * @return string
 */
Model.getTableName = function() {
	return this._tableName;
}

/**
 * Access to array of column names
 * @return array
 */
Model.getColumnNames = function() {
	return this._columnNames;
}

/**
 * Access to array of column types, indexed by column name
 * @return array
 */
Model.getColumnTypes = function() {
	return this._columnTypes;
}

/**
 * Get the type of a column
 * @return array
 */
Model.getColumnType = function(columnName) {
	return this._columnTypes[columnName];
}

/**
 * @return bool
 */
Model.hasColumn = function(columnName) {
	for (var x = 0, len = this._columnNames.length; x < len; x++) {
		if (this._columnNames[x].toLowerCase() == columnName.toLowerCase()) {
			return true;
		}
	}
	return false;
}

/**
 * Access to array of primary keys
 * @return array
 */
Model.getPrimaryKeys = function() {
	return this._primaryKeys;
}

/**
 * Access to name of primary key
 * @return array
 */
Model.getPrimaryKey = function() {
	return this._primaryKey;
}

/**
 * Returns true if the primary key column for this table is auto-increment
 * @return bool
 */
Model.isAutoIncrement = function() {
	return this._isAutoIncrement;
}

/**
 * Searches the database for a row with the ID(primary key) that matches
 * the one input.
 * @return Model
 */
Model.retrieveByPK = function(thePK) {
	return this.retrieveByPKs(thePK);
}

/**
 * Searches the database for a row with the primary keys that match
 * the ones input.
 * @return Model
 */
Model.retrieveByPKs = function() {
	var pks = this.getPrimaryKeys(),
		q = new Query;

	for (var x = 0, len = pks.length; x < len; x++) {
		var pk = pks[x],
			pkVal = arguments[x];

		if (pkVal === null || typeof pkVal == 'undefined') {
			return null;
		}
		q.add(pk, pkVal);
	}
	return this.doSelect(q, true).shift();
}

Model.retrieveByColumn = function(field, value) {
	var q = new Query()
		.add(field, value)
		.setLimit(1)
	return this.doSelect(q).shift();
}

/**
 * Populates and returns an instance of Model with the
 * first result of a query.  If the query returns no results,
 * returns null.
 * @return Model
 */
Model.fetchSingle = function(queryString) {
	return this.fetch(queryString).shift();
}

/**
 * Populates and returns an array of Model objects with the
 * results of a query.  If the query returns no results,
 * returns an empty Array.
 * @return Model[]
 */
Model.fetch = function(queryString) {
	var conn = this.getConnection();
	var result = conn.query(queryString);
	return this.fromResult(result);
}

/**
 * Returns an array of all Model objects in the database.
 * extra SQL can be appended to the query to LIMIT, SORT, and/or GROUP results.
 * If there are no results, returns an empty Array.
 * @param extra string
 * @return Model[]
 */
Model.getAll = function(extra) {
	var conn = this.getConnection(),
		tableQuoted = conn.quoteIdentifier(this.getTableName());
	return this.fetch('SELECT * FROM ' + tableQuoted + ' ' + extra);
}

/**
 * @return int
 */
Model.doCount = function(q) {
	q = q || new Query;
	var conn = this.getConnection();
	if (!q.getTable() || this.getTableName() != q.getTable()) {
		q.setTable(this.getTableName());
	}
	return q.doCount(conn);
}

/**
 * @param q
 * @return int
 */
Model.doDelete = function(q) {
	var conn = this.getConnection();
	if (!q.getTable() || this.getTableName() != q.getTable()) {
		q.setTable(this.getTableName());
	}
	var result = q.doDelete(conn);
	return result;
}

/**
 * @param q The Query object that creates the SELECT query string
 * @return Model[]
 */
Model.doSelect = function(q) {
	return this.fromResult(this.doSelectRS(q));
}

/**
 * Executes a select query and returns the PDO result
 * @return PDOStatement
 */
Model.doSelectRS = function(q) {
	q = q || new Query;
	var conn = this.getConnection();
	if (!q.getTable() || this.getTableName() != q.getTable()) {
		q.setTable(this.getTableName());
	}

	return q.doSelect(conn);
}
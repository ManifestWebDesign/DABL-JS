function addGetterAndSetter(object, colName, colType) {
	object.__defineGetter__(colName, function() {
		var value = this['_' +  colName];
		return typeof value == 'undefined' ? null : value;
	});

	object.__defineSetter__(colName, function(value) {
		value = this.coerceColumnValue(colName, value, colType);
		if (this['_' +  colName] === value) {
			return;
		}
		this._modifiedColumns[colName] = colName;
		this['_' +  colName] = value;
	});
}

Model = Class.extend({

	/**
	 * Array to contain names of modified columns
	 */
	_modifiedColumns: {},

	/**
	 * Whether or not this is a new object
	 */
	_isNew: true,

	/**
	 * Errors from the validate() step of saving
	 */
	_validationErrors: [],

	init : function Model() {
		this._modifiedColumns = {};
		this._validationErrors = [];
	},

	toString: function() {
		return this.constructor.name + ':' + this.getPrimaryKeyValues().join('-');
	},

	/**
	 * Creates new instance of self and with the same values as this, except
	 * the primary key value is cleared
	 * @return Model
	 */
	copy: function() {
		var newObject = new this.constructor,
			pks = this.constructor._primaryKeys,
			x,
			len,
			pk;

		newObject.fromArray(this.toArray());

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			newObject[pk] = null;
		}
		return newObject;
	},

	/**
	 * Checks whether any of the columns have been modified from the database values.
	 * @return bool
	 */
	isModified: function() {
		return this.getModifiedColumns().length != 0;
	},

	/**
	 * Checks whether the given column is in the modified array
	 * @return bool
	 */
	isColumnModified: function(columnName) {
		var key, modifiedColumn;
		for (key in this._modifiedColumns) {
			modifiedColumn = this._modifiedColumns[key];
			if (columnName.toLowerCase() == modifiedColumn.toLowerCase()) {
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
	coerceColumnValue: function(columnName, value, columnType) {
		if (null === columnType) {
			columnType = this.constructor.getColumnType(columnName);
		}

		value = typeof value == 'undefined' ? null : value;

		var temporal = Model.isTemporalType(columnType),
			numeric = Model.isNumericType(columnType),
			intVal,
			floatVal;

		if (numeric || temporal) {
			if ('' === value) {
				value = null;
			} else if (null !== value) {
				if (numeric) {
					if (Model.isIntegerType(columnType)) {
						// validate and cast
						intVal = parseInt(value, 10);
						if (intVal.toString() != value.toString()) {
							throw new Error(value + ' is not a valid integer');
						}
						value = intVal;
					} else {
						// only validates, doesn't cast...yet
						floatVal = parseFloat(value, 10);
						if (floatVal.toString() != value.toString()) {
							throw new Error(value + ' is not a valid float');
						}
					}
				} else if (temporal) {
					value = Model.coerceTemporalValue(value, columnType, this.constructor.getConnection());
				}
			}
		}
		return value;
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
		for (var column in this.constructor._columns) {
			if (!(column in object)) {
				continue;
			}
			this[column] = object[column];
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
			column;
		for (column in this.constructor._columns) {
			array[column] = this[column];
		}
		return array;
	},

	/**
	 * Returns true if this table has primary keys and if all of the primary values are not null
	 * @return bool
	 */
	hasPrimaryKeyValues: function() {
		var pks = this.constructor._primaryKeys,
			x,
			len,
			pk;
		if (pks.length == 0) {
			return false;
		}
		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			if (this[pk] === null) {
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
			pks = this.constructor._primaryKeys,
			x,
			len,
			pk;

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			arr.push(this[pk]);
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
		var pks = this.constructor._primaryKeys,
			q = new Query,
			x,
			len,
			pk,
			pkVal,
			result;

		if (pks.length == 0) {
			throw new Error('This table has no primary keys');
		}

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			pkVal = this[pk];
			if (pkVal === null) {
				throw new Error('Cannot delete using NULL primary key.');
			}
			q.addAnd(pk, pkVal);
		}

		q.setTable(this.constructor.getTableName());
		result = this.constructor.doDelete(q, false);
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

		if (this.constructor._primaryKeys.length == 0) {
			throw new Error('Cannot save without primary keys');
		}

		if (this.isNew() && this.constructor.hasColumn('created') && !this.isColumnModified('created')) {
			this.created = CURRENT_TIMESTAMP;
		}

		if ((this.isNew() || this.isModified()) && this.constructor.hasColumn('updated') && !this.isColumnModified('updated')) {
			this.updated = CURRENT_TIMESTAMP;
		}

		if (this.isNew()) {
			return this.insert();
		}
		return this.update();
	},

	archive: function() {
		if (!this.constructor.hasColumn('archived')) {
			throw new Error('Cannot call archive on models without "archived" column');
		}

		if (null !== this.archived && typeof this.archived != 'undefined') {
			throw new Error('This ' + this.constructor.getClassName() + ' is already archived.');
		}

		this.archived = CURRENT_TIMESTAMP;
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
			tableName = this.constructor.getTableName(),
			column,
			value,
			result,
			count,
			data = {},
			id;

		for (column in this.constructor._columns) {
			value = this[column];
			if (value === null && !this.isColumnModified(column)) {
				continue;
			}
			data[column] = value;
		}

		result = this.constructor.insert(tableName, data, conn);
		count = result.rowsAffected;

		if (pk && this.constructor.isAutoIncrement()) {
			id = conn.lastInsertId();
			if (null !== id) {
				this[pk] = id;
			}
		}

		this.resetModified();
		this.setNew(false);
		return count;
	},

	/**
	 * Creates and executes UPDATE query string for this object.  Returns
	 * the number of affected rows.
	 * @return Int
	 */
	update: function(hash) {
		if (typeof hash == 'object') {
			this.fromaArray(hash);
		}

		if (this.constructor._primaryKeys.length == 0) {
			throw new Error('This table has no primary keys');
		}

		var conn = this.constructor.getConnection(),
			quotedTable = conn.quoteIdentifier(this.constructor.getTableName()),
			fields = [],
			values = [],
			pkWhere = [],
			statement = new QueryStatement(conn),
			pks = this.constructor._primaryKeys,
			modColumns = this.getModifiedColumns(),
			x,
			len,
			modCol,
			pk,
			pkVal,
			queryString,
			result;

		for (x = 0, len = modColumns.length; x < len; ++x) {
			modCol = modColumns[x];
			fields.push(conn.quoteIdentifier(modCol) + ' = ?');
			values.push(this[modCol]);
		}

		//If array is empty there is nothing to update
		if (fields.length == 0) {
			return 0;
		}

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x],
				pkVal = this[pk];
			if (pkVal === null)
				throw new Error('Cannot update with NULL primary key.');
			pkWhere.push(conn.quoteIdentifier(pk) + ' = ?');
			values.push(pkVal);
		}

		queryString = 'UPDATE ' + quotedTable + ' SET ' + fields.join(', ') + ' WHERE ' + pkWhere.join(' AND ');

		statement.setString(queryString);
		statement.setParams(values);
		result = statement.bindAndExecute();
		this.resetModified();
		return result.rowsAffected;
	}

});

Model.COLUMN_TYPE_TEXT = 'TEXT';
Model.COLUMN_TYPE_NUMERIC = 'NUMERIC';
Model.COLUMN_TYPE_INTEGER = 'INTEGER';
Model.COLUMN_TYPE_BLOB = 'BLOB';
Model.COLUMN_TYPE_DATE = 'DATE';
Model.COLUMN_TYPE_TIME = 'TIME';
Model.COLUMN_TYPE_TIMESTAMP = 'TIMESTAMP';

Model.COLUMN_TYPES = {
	TEXT: Model.COLUMN_TYPE_TEXT,
	NUMERIC: Model.COLUMN_TYPE_NUMERIC,
	INTEGER: Model.COLUMN_TYPE_INTEGER,
	BLOB: Model.COLUMN_TYPE_BLOB,
	DATE: Model.COLUMN_TYPE_DATE,
	TIME: Model.COLUMN_TYPE_TIME,
	TIMESTAMP: Model.COLUMN_TYPE_TIMESTAMP
};

Model.TEXT_TYPES = {
	TEXT: Model.COLUMN_TYPE_TEXT,
	DATE: Model.COLUMN_TYPE_DATE,
	TIME: Model.COLUMN_TYPE_TIME,
	TIMESTAMP: Model.COLUMN_TYPE_TIMESTAMP
};

Model.INTEGER_TYPES = {
	INTEGER: Model.COLUMN_TYPE_INTEGER
};

Model.BLOB_TYPES = {
	BLOB: Model.COLUMN_TYPE_BLOB
};

Model.TEMPORAL_TYPES = {
	DATE: Model.COLUMN_TYPE_DATE,
	TIME: Model.COLUMN_TYPE_TIME,
	TIMESTAMP: Model.COLUMN_TYPE_TIMESTAMP
};

Model.NUMERIC_TYPES = {
	INTEGER: Model.COLUMN_TYPE_INTEGER,
	NUMERIC: Model.COLUMN_TYPE_NUMERIC
};

Model.isColumnType = function(type) {
	return (type in Model.COLUMN_TYPES);
}

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
 * Returns true if values for the type are blob.
 *
 * @param type
 * @return boolean
 */
Model.isBlobType = function(type) {
	return (type in Model.BLOB_TYPES);
}

Model.insert = function(tableName, data, conn) {
	var fields = [],
		values = [],
		placeholders = [],
		statement = new QueryStatement(conn),
		column,
		value,
		queryString;

	for (column in data) {
		value = data[column];
		fields.push(column);
		values.push(value);
		placeholders.push('?');
	}

	queryString = 'INSERT INTO ' +
		tableName + ' (' + fields.join(',') + ') VALUES (' + placeholders.join(',') + ') ';

	statement.setString(queryString);
	statement.setParams(values);

	return statement.bindAndExecute();
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
		i,
		len,
		object,
		row,
		fieldName;
	for (i = 0, len = result.length; i < len; ++i) {
		object = new this,
		row = result[i];

		for (fieldName in row) {
			object[fieldName] = row[fieldName];
		}
		object.setNew(false);
		objects.push(object);
	}
	return objects;
}

Model.coerceTemporalValue = function(value, columnType) {
	var x, date;
	if (value instanceof Array) {
		for (x = 0, len = value; x < len; ++x) {
			value[x] = this.coerceTemporalValue(value[x], columnType);
		}
		return value;
	}
	date = new Date(value);
	if (isNaN(date.getTime())) {
		throw new Error(value + ' is not a valid date');
	}
	return date;
}

Model._table = null;

Model._primaryKeys = null;

Model._isAutoIncrement = true;

Model._columns = null;

Model._connectionName = 'default_connection';

Model.getConnection = function(){
	return Adapter.getConnection(this._connectionName);
}

/**
 * Returns string representation of table name
 * @return string
 */
Model.getTableName = function() {
	return this._table;
}

/**
 * Access to array of column types, indexed by column name
 * @return array
 */
Model.getColumns = function() {
	return this._columns.slice(0);
}

/**
 * Get the type of a column
 * @return array
 */
Model.getColumnType = function(columnName) {
	return this._columns[columnName];
}

/**
 * @return bool
 */
Model.hasColumn = function(columnName) {
	columnName = columnName.toLowerCase();
	for (var colName in this._columns) {
		if (colName.toLowerCase() == columnName) {
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
	return this._primaryKeys.slice(0);
}

/**
 * Access to name of primary key
 * @return array
 */
Model.getPrimaryKey = function() {
	return this._primaryKeys.length == 1 ? this._primaryKeys[0] : null;
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
	var pks = this._primaryKeys,
		q = new Query,
		x,
		len,
		pk,
		pkVal;

	for (x = 0, len = pks.length; x < len; ++x) {
		pk = pks[x],
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

Model.findBy = Model.retrieveByColumn;

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
	var result = this.getConnection().query(queryString);
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
	if (!q.getTable() || this.getTableName() != q.getTable()) {
		q.setTable(this.getTableName());
	}
	return q.doDelete(this.getConnection());
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
	if (!q.getTable() || this.getTableName() != q.getTable()) {
		q.setTable(this.getTableName());
	}
	return q.doSelect(this.getConnection());
}

Model.models = {};

/**
 * @return Model
 */
Model.create = function(props){
	var conn, newClass, column, type, prop;

	if (typeof props.connectionName == 'undefined') {
		conn = Adapter.getConnection();
		if (!conn) {
			throw new Error('No database specified or found.');
		}
		props.connectionName = conn._dbFile;
	}
	if (typeof props.table == 'undefined') {
		throw new Error('Must provide a table when exending Model');
	}
	if (typeof props.columns == 'undefined') {
		throw new Error('Must provide columns when exending Model');
	}
	if (typeof props.primaryKeys == 'undefined') {
		throw new Error('Must provide primaryKeys when exending Model');
	}

	newClass = this.extend(props.instancePrototype);

	for (column in props.columns) {
		type = props.columns[column] = props.columns[column].toUpperCase();
		if (!Model.isColumnType(type)) {
			throw new Error(type + ' is not a valide DABL/SQLite column type');
		}
		addGetterAndSetter(newClass.prototype, column, type);
	}

	for (prop in props) {
		switch (prop) {
			case 'connectionName': case 'table': case 'columns': case 'primaryKeys':
				newClass['_' + prop] = props[prop];
				break;
			default:
				newClass[prop] = props[prop];
				break;
		}
	}

	Model.models[props.table] = newClass;

	return newClass;
};
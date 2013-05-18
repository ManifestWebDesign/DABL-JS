(function(){

var Model = Class.extend({
	/**
	 * This will contain the column values IF __defineGetter__ and __defineSetter__
	 * are supported by the JavaScript engine, otherwise the properties will be
	 * set and accessed directly on the object
	 */
	_privateValues: null,

	/**
	 * Array to contain names of modified columns
	 */
	_originalValues: null,

	/**
	 * Whether or not this is a new object
	 */
	_isNew: true,

	/**
	 * Errors from the validate() step of saving
	 */
	_validationErrors: null,

	init : function Model(values) {
		this._validationErrors = [];
		this._privateValues = {};
		this.resetModified();
		if (values) {
			this.fromArray(values);
		}
	},

	toString: function() {
		return this.constructor.name + ':' + this.getPrimaryKeyValues().join('-');
	},

	get: function(column) {
		return this[column];
	},

	set: function(column, value) {
		this[column] = value;
		return this;
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
		for (var column in this.constructor._columns) {
			if (this[column] !== this._originalValues[column]) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Checks whether the given column is in the modified array
	 * @return bool
	 */
	isColumnModified: function(columnName) {
		return this[columnName] !== this._originalValues[columnName];
	},

	/**
	 * Returns an array of the names of modified columns
	 * @return object
	 */
	getModifiedColumns: function() {
		var modifiedColumns = {};
		for (var column in this.constructor._columns) {
			if (this[column] !== this._originalValues[column]) {
				modifiedColumns[column] = true;
			}
		}
		return modifiedColumns;
	},

	/**
	 * Clears the array of modified column names
	 * @return Model
	 */
	resetModified: function() {
		this._originalValues = {};
		for (var columnName in this.constructor._columns) {
			this._originalValues[columnName] = this[columnName];
		}
		return this;
	},

	/**
	 * Sets the value of a property/column
	 * @param string columnName
	 * @param mixed value
	 * @param string columnType
	 * @return Model
	 */
	coerceColumnValue: function(columnName, value, columnType) {
		if (!columnType) {
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
					value = Model.coerceTemporalValue(value, columnType, this.constructor.getAdapter());
				}
			}
		}
		return value;
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
		var array = {}, column;
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
			this.created = new Date();
		}

		if ((this.isNew() || this.isModified()) && this.constructor.hasColumn('updated') && !this.isColumnModified('updated')) {
			this.updated = new Date();
		}

		if (this.isNew()) {
			return this.insert();
		} else {
			return this.update();
		}
	},

	archive: function() {
		if (!this.constructor.hasColumn('archived')) {
			throw new Error('Cannot call archive on models without "archived" column');
		}

		if (null !== this.archived && typeof this.archived != 'undefined') {
			throw new Error('This ' + this.constructor.getClassName() + ' is already archived.');
		}

		this.archived = new Date();
		return this.save();
	},

	/**
	 * Stores a new record with that values in this object
	 */
	insert: function() {
		return this.constructor._adapter.insert(this);
	},

	/**
	 * Updates the stored record representing this object.
	 */
	update: function(values) {
		if (typeof onSuccess == 'object') {
			this.fromArray(values);
		}

		if (!this.isModified()) {
			var d = new Deferred();
			d.resolve();
			return d.promise();
		}
		return this.constructor._adapter.update(this);
	},

	/**
	 * Creates and executess DELETE Query for this object
	 * Deletes any database rows with a primary key(s) that match this
	 * NOTE/BUG: If you alter pre-existing primary key(s) before deleting, then you will be
	 * deleting based on the new primary key(s) and not the originals,
	 * leaving the original row unchanged(if it exists).  Also, since NULL isn't an accurate way
	 * to look up a row, I return if one of the primary keys is null.
	 */
	destroy: function(onSuccess, onError) {
		return this.constructor._adapter.destroy(this, onSuccess, onError);
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

Model.coerceTemporalValue = function(value, columnType) {
	var x, date, len;
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

Model.getAdapter = function(){
	return this._adapter;
}

Model.setAdapter = function(adapter){
	this._adapter = adapter;
	return this;
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
	for (var colName in this._columns) {
		if (colName == columnName) {
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

Model.prototype.toJSON = Model.prototype.toArray;
Model.prototype.fromJSON = Model.prototype.fromArray;

var adapterMethods = ['count', 'findAll', 'find'];

for (var i = 0, l = adapterMethods.length; i < l; ++i) {
	var method = adapterMethods[i];
	Model[method] = (function(method){
		return function() {
			var newArgs = [this];
			for (var i = 0; i < arguments.length; i++) {
				newArgs.push(arguments[i]);
			}
			var con = this.getAdapter();
			return con[method].apply(con, newArgs);
		}
	})(method);
}

var findAliases = ['findBy', 'retrieveByColumn', 'retrieveByPK', 'retrieveByPKs', 'findByPKs'];

for (var x = 0, len = findAliases.length; x < len; ++x) {
	Model[findAliases[x]] = Model.find;
}

Model.addGetterAndSetter = function(object, colName, colType) {
	if (!object.__defineGetter__) {
		return;
	}
	object.__defineGetter__(colName, function() {
		var value = this._privateValues[colName];
		return typeof value == 'undefined' ? null : value;
	});

	object.__defineSetter__(colName, function(value) {
		value = this.coerceColumnValue(colName, value, colType);
		if (this._privateValues[colName] === value) {
			return;
		}
		this._privateValues[colName] = value;
	});
}

Model.models = {};

function encodeUriSegment(val) {
	return encodeUriQuery(val, true).
	replace(/%26/gi, '&').
	replace(/%3D/gi, '=').
	replace(/%2B/gi, '+');
}

function encodeUriQuery(val, pctEncodeSpaces) {
	return encodeURIComponent(val).
	replace(/%40/gi, '@').
	replace(/%3A/gi, ':').
	replace(/%24/g, '$').
	replace(/%2C/gi, ',').
	replace((pctEncodeSpaces ? null : /%20/g), '+');
}

function Route(template, defaults) {
	this.template = template = template + '#';
	this.defaults = defaults || {};
	var urlParams = this.urlParams = {},
		parts = template.split(/\W/);
	for (var i = 0, l = parts.length; i < l; ++i) {
		var param = parts[i];
		if (param && template.match(new RegExp("[^\\\\]:" + param + "\\W"))) {
			urlParams[param] = true;
		}
	}
	this.template = template.replace(/\\:/g, ':');
}

Route.prototype = {
	url: function(params) {
		var self = this,
		url = this.template,
		val,
		encodedVal;

		params = params || {};
		for (var urlParam in this.urlParams) {
			val = typeof params[urlParam] != 'undefined' || params.hasOwnProperty(urlParam) ? params[urlParam] : self.defaults[urlParam];
			if (typeof val != 'undefined' && val !== null) {
				encodedVal = encodeUriSegment(val);
				url = url.replace(new RegExp(":" + urlParam + "(\\W)", "g"), encodedVal + "$1");
			} else {
				url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W)", "g"), function(match,
					leadingSlashes, tail) {
					if (tail.charAt(0) == '/') {
						return tail;
					} else {
						return leadingSlashes + tail;
					}
				});
			}
		}
		return url;
	}
};

/**
 * @return Model
 */
Model.create = function(props){
	var newClass, column, type, prop;

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
		Model.addGetterAndSetter(newClass.prototype, column, type);
	}

	for (prop in props) {
		switch (prop) {
			case 'url':
				newClass._route = new Route(props[prop]);
				break;
			case 'adapter': case 'table': case 'columns': case 'primaryKeys': case 'isAutoIncrement':
				newClass['_' + prop] = props[prop];
				break;
			default:
				newClass[prop] = props[prop];
				break;
		}
	}

	Model.models[props.table] = newClass;

	newClass.name = 'Foo';
	return newClass;
};

this.Model = Model;
})();
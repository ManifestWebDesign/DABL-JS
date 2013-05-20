(function(){

var Model = Class.extend({
	/**
	 * This will contain the field values IF __defineGetter__ and __defineSetter__
	 * are supported by the JavaScript engine, otherwise the properties will be
	 * set and accessed directly on the object
	 */
	_values: null,

	/**
	 * Array to contain names of modified fields
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
		this._values = {};
		this.resetModified();
		if (values) {
			this.setValues(values);
		}
	},

	toString: function() {
		return this.constructor.name + ':' + this.getPrimaryKeyValues().join('-');
	},

	get: function(field) {
		return this[field];
	},

	set: function(field, value) {
		this[field] = value;
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

		newObject.setValues(this.getValues());

		for (x = 0, len = pks.length; x < len; ++x) {
			pk = pks[x];
			newObject[pk] = null;
		}
		return newObject;
	},

	/**
	 * If field is provided, checks whether that field has been modified
	 * If no field is provided, checks whether any of the fields have been modified from the database values.
	 *
	 * @param {String} field
	 * @return bool
	 */
	isModified: function(field) {
		if (field) {
			return this[field] !== this._originalValues[field];
		}
		for (var field in this.constructor._fields) {
			if (this[field] !== this._originalValues[field]) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Returns an array of the names of modified fields
	 * @return object
	 */
	getModified: function() {
		var modified = {};
		for (var field in this.constructor._fields) {
			if (this[field] !== this._originalValues[field]) {
				modified[field] = true;
			}
		}
		return modified;
	},

	/**
	 * Clears the array of modified field names
	 * @return Model
	 */
	resetModified: function() {
		this._originalValues = {};
		for (var field in this.constructor._fields) {
			this._originalValues[field] = this[field];
		}
		return this;
	},

	/**
	 * Sets the value of a field
	 * @param String field
	 * @param mixed value
	 * @param string fieldType
	 * @return Model
	 */
	coerceValue: function(field, value, fieldType) {
		if (!fieldType) {
			fieldType = this.constructor.getFieldType(field);
		}

		value = typeof value === 'undefined' ? null : value;

		var temporal = Model.isTemporalType(fieldType),
			numeric = Model.isNumericType(fieldType),
			intVal,
			floatVal;

		if (numeric || temporal) {
			if ('' === value) {
				value = null;
			} else if (null !== value) {
				if (numeric) {
					if (Model.isIntegerType(fieldType)) {
						// validate and cast
						intVal = parseInt(value, 10);
						if (intVal.toString() !== value.toString()) {
							throw new Error(value + ' is not a valid integer');
						}
						value = intVal;
					} else {
						// only validates, doesn't cast...yet
						floatVal = parseFloat(value, 10);
						if (floatVal.toString() !== value.toString()) {
							throw new Error(value + ' is not a valid float');
						}
					}
				} else if (temporal) {
					value = Model.coerceTemporalValue(value, fieldType, this.constructor.getAdapter());
				}
			}
		}
		return value;
	},

	/**
	 * Populates this with the values of an associative Array.
	 * Array keys must match field names to be used.
	 * @param array array
	 * @return Model
	 */
	setValues: function(object) {
		for (var field in this.constructor._fields) {
			if (!(field in object)) {
				continue;
			}
			this[field] = object[field];
		}
		return this;
	},

	/**
	 * Returns an associative Array with the values of this.
	 * Array keys match field names.
	 * @return array
	 */
	getValues: function() {
		var array = {}, field;
		for (field in this.constructor._fields) {
			array[field] = this[field];
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
		if (pks.length === 0) {
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
		this._isNew = (bool === true);
		return this;
	},

	/**
	 * Returns true if the field values validate.
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

		if (this.constructor._primaryKeys.length === 0) {
			throw new Error('Cannot save without primary keys');
		}

		if (this.isNew() && this.constructor.hasField('created') && !this.isModified('created')) {
			this.created = new Date();
		}

		if ((this.isNew() || this.isModified()) && this.constructor.hasField('updated') && !this.isModified('updated')) {
			this.updated = new Date();
		}

		if (this.isNew()) {
			return this.insert();
		} else {
			return this.update();
		}
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
		if (typeof values === 'object') {
			this.setValues(values);
		}
		return this.constructor._adapter.update(this);
	},

	/**
	 * Deletes any records with a primary key(s) that match this
	 * NOTE/BUG: If you alter pre-existing primary key(s) before deleting, then you will be
	 * deleting based on the new primary key(s) and not the originals,
	 * leaving the original row unchanged(if it exists).  Also, since NULL isn't an accurate way
	 * to look up a row, I return if one of the primary keys is null.
	 */
	destroy: function(onSuccess, onError) {
		return this.constructor._adapter.destroy(this, onSuccess, onError);
	},

	archive: function() {
		if (!this.constructor.hasField('archived')) {
			throw new Error('Cannot call archive on models without "archived" field');
		}

		if (null !== this.archived && typeof this.archived !== 'undefined') {
			throw new Error('This ' + this.constructor.getClassName() + ' is already archived.');
		}

		this.archived = new Date();
		return this.save();
	}
});

Model.FIELD_TYPE_TEXT = 'TEXT';
Model.FIELD_TYPE_NUMERIC = 'NUMERIC';
Model.FIELD_TYPE_INTEGER = 'INTEGER';
Model.FIELD_TYPE_DATE = 'DATE';
Model.FIELD_TYPE_TIME = 'TIME';
Model.FIELD_TYPE_TIMESTAMP = 'TIMESTAMP';

Model.FIELD_TYPES = {
	TEXT: Model.FIELD_TYPE_TEXT,
	NUMERIC: Model.FIELD_TYPE_NUMERIC,
	INTEGER: Model.FIELD_TYPE_INTEGER,
	DATE: Model.FIELD_TYPE_DATE,
	TIME: Model.FIELD_TYPE_TIME,
	TIMESTAMP: Model.FIELD_TYPE_TIMESTAMP
};

Model.TEXT_TYPES = {
	TEXT: Model.FIELD_TYPE_TEXT,
	DATE: Model.FIELD_TYPE_DATE,
	TIME: Model.FIELD_TYPE_TIME,
	TIMESTAMP: Model.FIELD_TYPE_TIMESTAMP
};

Model.INTEGER_TYPES = {
	INTEGER: Model.FIELD_TYPE_INTEGER
};

Model.TEMPORAL_TYPES = {
	DATE: Model.FIELD_TYPE_DATE,
	TIME: Model.FIELD_TYPE_TIME,
	TIMESTAMP: Model.FIELD_TYPE_TIMESTAMP
};

Model.NUMERIC_TYPES = {
	INTEGER: Model.FIELD_TYPE_INTEGER,
	NUMERIC: Model.FIELD_TYPE_NUMERIC
};

Model.isFieldType = function(type) {
	return (type in Model.FIELD_TYPES);
};

/**
 * Whether passed type is a temporal (date/time/timestamp) type.
 *
 * @param type Propel type
 * @return boolean
 */
Model.isTemporalType = function(type) {
	return (type in this.TEMPORAL_TYPES);
};

/**
 * Returns true if values for the type need to be quoted.
 *
 * @param type The Propel type to check.
 * @return boolean True if values for the type need to be quoted.
 */
Model.isTextType = function(type) {
	return (type in this.TEXT_TYPES);
};

/**
 * Returns true if values for the type are numeric.
 *
 * @param type The Propel type to check.
 * @return boolean True if values for the type need to be quoted.
 */
Model.isNumericType = function(type) {
	return (type in this.NUMERIC_TYPES);
};

/**
 * Returns true if values for the type are integer.
 *
 * @param type
 * @return boolean
 */
Model.isIntegerType = function(type) {
	return (type in this.INTEGER_TYPES);
};

Model.coerceTemporalValue = function(value, fieldType) {
	var x, date, len;
	if (value instanceof Array) {
		for (x = 0, len = value; x < len; ++x) {
			value[x] = this.coerceTemporalValue(value[x], fieldType);
		}
		return value;
	}
	date = new Date(value);
	if (isNaN(date.getTime())) {
		throw new Error(value + ' is not a valid date');
	}
	return date;
};

Model._fields = Model._primaryKeys = Model._table = null;

Model._autoIncrement = true;

Model.getAdapter = function(){
	return this._adapter;
};

Model.setAdapter = function(adapter){
	this._adapter = adapter;
	return this;
};

/**
 * Returns string representation of table name
 * @return string
 */
Model.getTableName = function() {
	return this._table;
};

/**
 * Access to array of field types, indexed by field name
 * @return array
 */
Model.getFields = function() {
	return this._fields.slice(0);
};

/**
 * Get the type of a field
 * @return array
 */
Model.getFieldType = function(field) {
	return this._fields[field];
};

/**
 * @return bool
 */
Model.hasField = function(field) {
	for (var field in this._fields) {
		if (field === field) {
			return true;
		}
	}
	return false;
};

/**
 * Access to array of primary keys
 * @return array
 */
Model.getPrimaryKeys = function() {
	return this._primaryKeys.slice(0);
};

/**
 * Access to name of primary key
 * @return array
 */
Model.getPrimaryKey = function() {
	return this._primaryKeys.length === 1 ? this._primaryKeys[0] : null;
};

/**
 * Returns true if the primary key field for this table is auto-increment
 * @return bool
 */
Model.isAutoIncrement = function() {
	return this._autoIncrement;
};

Model.prototype.toJSON = Model.prototype.getValues;
Model.prototype.fromJSON = Model.prototype.setValues;
Model.prototype.toArray = Model.prototype.getValues;
Model.prototype.fromArray = Model.prototype.setValues;

var adapterMethods = ['countAll', 'findAll', 'find', 'destroyAll', 'updateAll'];

for (var i = 0, l = adapterMethods.length; i < l; ++i) {
	var method = adapterMethods[i];
	Model[method] = (function(method){
		return function() {
			var args = Array.prototype.slice.call(arguments);
			args.unshift(this);
			var con = this.getAdapter();
			return con[method].apply(con, args);
		};
	})(method);
}

var findAliases = ['findBy', 'retrieveByField', 'retrieveByPK', 'retrieveByPKs', 'findByPKs'];

for (var x = 0, len = findAliases.length; x < len; ++x) {
	Model[findAliases[x]] = Model.find;
}

Model.addField = function(object, field, colType) {
	if (!object.__defineGetter__ && !Object.defineProperty) {
		return;
	}
	var get = function() {
		var value = this._values[field];
		return typeof value === 'undefined' ? null : value;
	};

	var set = function(value) {
		this._values[field] = this.coerceValue(field, value, colType);
	};

	if (Object.defineProperty) {
		Object.defineProperty(object, field, {
			enumerable: true,
			get: get,
			set: set
		});
	} else {
		object.__defineGetter__(field, get);
		object.__defineSetter__(field, set);
	}
};

Model.models = {};

/**
 * @return Model
 */
Model.create = function(opts) {
	var newClass, field, type, prop;

	if (typeof opts.table === 'undefined') {
		throw new Error('Must provide a table when exending Model');
	}
	if (typeof opts.fields === 'undefined') {
		throw new Error('Must provide fields when exending Model');
	}
	if (typeof opts.primaryKeys === 'undefined') {
		throw new Error('Must provide primaryKeys when exending Model');
	}

	newClass = this.extend(opts.prototype);
	delete opts.prototype;

	for (field in opts.fields) {
		type = opts.fields[field] = opts.fields[field].toUpperCase();
		if (!Model.isFieldType(type)) {
			throw new Error(type + ' is not a valide field type');
		}
		Model.addField(newClass.prototype, field, type);
	}

	for (prop in opts) {
		switch (prop) {
			// known static private properties
			case 'url', 'adapter': case 'table': case 'fields': case 'primaryKeys': case 'autoIncrement':
				newClass['_' + prop] = opts[prop];
				break;

			// public static methods and properties
			default:
				newClass[prop] = opts[prop];
				break;
		}
	}

	Model.models[opts.table] = newClass;

	newClass.name = 'Foo';
	return newClass;
};

this.Model = Model;
})();
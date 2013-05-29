(function(){

var Model = Class.extend({
	/**
	 * This will contain the field values IF __defineGetter__ and __defineSetter__
	 * are supported by the JavaScript engine, otherwise the properties will be
	 * set and accessed directly on the object
	 */
	_values: null,

	/**
	 * Object containing names of modified fields
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
		for (var fieldName in this.constructor._fields) {
			var field = this.constructor._fields[fieldName];
			if (typeof field.value !== 'undefined') {
				this[fieldName] = copy(field.value);
			} else if (field.type === Array) {
				this[fieldName] = [];
			}
		}
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
			pks = this.constructor._keys,
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
		for (var fieldName in this.constructor._fields) {
			if (this[fieldName] !== this._originalValues[fieldName]) {
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
		for (var fieldName in this.constructor._fields) {
			if (this[fieldName] !== this._originalValues[fieldName]) {
				modified[fieldName] = true;
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
		for (var fieldName in this.constructor._fields) {
			this._originalValues[fieldName] = this[fieldName];
		}
		return this;
	},

	/**
	 * Populates this with the values of an associative Array.
	 * Array keys must match field names to be used.
	 * @param array array
	 * @return Model
	 */
	setValues: function(object) {
		for (var fieldName in this.constructor._fields) {
			if (!(fieldName in object)) {
				continue;
			}
			this[fieldName] = object[fieldName];
		}
		return this;
	},

	/**
	 * Returns an associative Array with the values of this.
	 * Array keys match field names.
	 * @return array
	 */
	getValues: function() {
		var values = {},
			fieldName,
			value;

		for (fieldName in this.constructor._fields) {
			value = this[fieldName];
			if (!this._inGetValues && value instanceof Model) {
				this._inGetValues = true;
				value = value.getValues();
				delete this._inGetValues;
			}
			if (value instanceof Array) {
				for (var x = 0, l = value.length; x < l; ++x) {
					if (!this._inGetValues && value[x] instanceof Model) {
						this._inGetValues = true;
						value[x] = value[x].getValues();
						delete this._inGetValues;
					}
				}
			}
			values[fieldName] = value;
		}

		return values;
	},

	/**
	 * Returns true if this table has primary keys and if all of the primary values are not null
	 * @return bool
	 */
	hasPrimaryKeyValues: function() {
		var pks = this.constructor._keys,
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
			pks = this.constructor._keys,
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
		var model = this.constructor;

		if (!this.validate()) {
			throw new Error('Cannot save ' + model.getClassName() + ' with validation errors.');
		}

		if (model._keys.length === 0) {
			throw new Error('Cannot save without primary keys');
		}

		if (this.isNew() && model.hasField('created') && !this.isModified('created')) {
			this.created = new Date();
		}

		if ((this.isNew() || this.isModified()) && model.hasField('updated') && !this.isModified('updated')) {
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
	return (type in Model.FIELD_TYPES || this.isObjectType(type));
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

/**
 * Returns true if values for the type are objects or arrays.
 *
 * @param type
 * @return boolean
 */
Model.isObjectType = function(type) {
	return typeof type === 'function';
};

Model.coerceTemporalValue = function(value, fieldType) {
	var x, date, l;
	if (value.constructor === Array) {
		for (x = 0, l = value.length; x < l; ++x) {
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

/**
 * Sets the value of a field
 * @param {String} fieldName
 * @param {mixed} value
 * @param {Object} field
 * @return {mixed}
 */
Model.coerceValue = function(fieldName, value, field) {
	if (!field) {
		field = this.getField(fieldName);
	}
	var fieldType = field.type;

	value = typeof value === 'undefined' ? null : value;

	var temporal = this.isTemporalType(fieldType),
		numeric = this.isNumericType(fieldType),
		intVal,
		floatVal;

	if (numeric || temporal) {
		if ('' === value) {
			value = null;
		} else if (null !== value) {
			if (numeric) {
				if (this.isIntegerType(fieldType)) {
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
				value = this.coerceTemporalValue(value, fieldType);
			}
		}
	} else if (fieldType === Array) {
		if (value === null) {
			value = [];
		} else if (field.elementType && value instanceof Array) {
			for (var x = 0, l = value.length; x < l; ++x) {
				if (value[x] !== null && !(value[x] instanceof field.elementType)) {
					value[x] = cast(value[x], field.elementType);
				}
			}
		}
	} else if (this.isObjectType(fieldType)) {
		if (value !== null && !(value instanceof fieldType)) {
			value = cast(value, fieldType);
		}
	}
	return value;
};

function cast(obj, type) {
	if (type._table && typeof type === 'function') {
		var key = type.getPrimaryKey(),
			instance;
		if (type._adapter && key && obj[key]) {
			instance = type._adapter.cache(type._table, obj[key]);
			if (instance) {
				return instance;
			}
		}
		return new type(obj);
	}
//	if (type.valueOf) {
//		return type.valueOf(obj);
//	}
	return obj;
}

function copy(obj) {
	if (obj === null) {
		return null;
	}

	if (obj instanceof Array) {
		return obj.slice(0);
	}

	switch (typeof obj) {
		case 'string':
		case 'boolean':
		case 'number':
		case 'undefined':
		case 'function':
			return obj;
	}

	var target = {};
	for (var i in obj) {
		if (obj.hasOwnProperty(i)) {
			target[i] = obj[i];
		}
	}
	return target;
}

Model._fields = Model._keys = Model._table = null;

Model._autoIncrement = false;

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
	return copy(this._fields);
};

/**
 * Get the type of a field
 * @return array
 */
Model.getField = function(fieldName) {
	return this._fields[fieldName];
};

/**
 * Get the type of a field
 * @return array
 */
Model.getFieldType = function(fieldName) {
	return this._fields[fieldName].type;
};

/**
 * @return bool
 */
Model.hasField = function(field) {
	for (var fieldName in this._fields) {
		if (fieldName === field) {
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
	return this._keys.slice(0);
};

/**
 * Access to name of primary key
 * @return array
 */
Model.getPrimaryKey = function() {
	return this._keys.length === 1 ? this._keys[0] : null;
};

/**
 * Returns true if the primary key field for this table is auto-increment
 * @return bool
 */
Model.isAutoIncrement = function() {
	return this._autoIncrement;
};

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

Model.addField = function(fieldName, field) {
	var get, set, self = this;

	if (!field.type) {
		field = {
			type: field
		};
	}

	if (typeof field.type === 'string') {
		field.type = field.type.toUpperCase();
	}

	switch (field.type) {
		case String:
			field.type = self.FIELD_TYPE_TEXT;
			break;
		case Number:
			field.type = self.FIELD_TYPE_NUMERIC;
			break;
		case Date:
			field.type = self.FIELD_TYPE_TIMESTAMP;
			break;
		case 'INT':
			field.type = self.FIELD_TYPE_INTEGER;
			break;
	}

	if (field.key) {
		this._keys.push(fieldName);
	}
	if (field.computed) {
		this._autoIncrement = true;
	}

	if (!this.isFieldType(field.type)) {
		throw new Error(field.type + ' is not a valide field type');
	}

	this._fields[fieldName] = field;

	if (!this.prototype.__defineGetter__ && !Object.defineProperty) {
		return;
	}

	get = function() {
		var value = this._values[fieldName];
		return typeof value === 'undefined' ? null : value;
	};

	set = function(value) {
		this._values[fieldName] = self.coerceValue(fieldName, value, field);
	};

	if (Object.defineProperty) {
		Object.defineProperty(this.prototype, fieldName, {
			get: get,
			set: set,
			enumerable: true
		});
	} else {
		this.prototype.__defineGetter__(fieldName, get);
		this.prototype.__defineSetter__(fieldName, set);
	}
};

Model.models = {};

/**
 * @return Model
 */
Model.create = function(table, opts) {
	var newClass,
		fieldName,
		prop;

	if (typeof table === 'undefined') {
		throw new Error('Must provide a table when exending Model');
	}
	if (!opts.fields) {
		throw new Error('Must provide fields when exending Model');
	}

	newClass = this.extend(opts.prototype);
	delete opts.prototype;

	newClass._keys = [];
	newClass._fields = {};
	newClass._table = table;

	for (prop in opts) {
		switch (prop) {
			// private static properties
			case 'url':
			case 'adapter':
			case 'table':
				newClass['_' + prop] = opts[prop];
				break;

			// public static methods and properties
			default:
				newClass[prop] = opts[prop];
				break;
		}
	}

	for (fieldName in opts.fields) {
		newClass.addField(fieldName, opts.fields[fieldName]);
	}

	Model.models[table] = newClass;

	return newClass;
};

this.Model = Model;
})();
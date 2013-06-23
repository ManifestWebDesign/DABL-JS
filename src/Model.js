(function(){

this.Model = Class.extend({
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

	/**
	 * @param {Object} values
	 */
	init : function Model(values) {
		this._validationErrors = [];
		this._values = {};
		for (var fieldName in this.constructor._fields) {
			var field = this.constructor._fields[fieldName];
			if (typeof field.value !== 'undefined') {
				this[fieldName] = copy(field.value);
			} else if (field.type === Array) {
				this[fieldName] = [];
			}
		}
		this.resetModified();
		if (values) {
			this.setValues(values);
		}
	},

	toString: function() {
		return this.constructor._table + ':' + JSON.stringify(this.getValues());
	},

	/**
	 * Creates new instance of self and with the same values as this, except
	 * the primary key value is cleared
	 * @return {Model}
	 */
	copy: function() {
		var model = this.constructor,
			newObject = new model(this),
			pk = model.getPrimaryKey();

		if (pk) {
			newObject[pk] = null;
		}
		return newObject;
	},

	/**
	 * If field is provided, checks whether that field has been modified
	 * If no field is provided, checks whether any of the fields have been modified from the database values.
	 *
	 * @param {String} fieldName Optional
	 * @return bool
	 */
	isModified: function(fieldName) {
		if (fieldName) {
			return !equals(this[fieldName], this._originalValues[fieldName]);
		}
		for (var fieldName in this.constructor._fields) {
			if (this.isModified(fieldName)) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Returns an array of the names of modified fields
	 * @return {Object}
	 */
	getModified: function() {
		var modified = {};
		for (var fieldName in this.constructor._fields) {
			if (this.isModified(fieldName)) {
				modified[fieldName] = true;
			}
		}
		return modified;
	},

	/**
	 * Clears the array of modified field names
	 * @return {Model}
	 */
	resetModified: function() {
		this._originalValues = {};
		for (var fieldName in this.constructor._fields) {
			this._originalValues[fieldName] = this[fieldName];
		}
		return this;
	},

	/**
	 * Resets the object to the state it was in before changes were made
	 */
	revert: function() {
		for (var fieldName in this.constructor._fields) {
			this[fieldName] = this._originalValues[fieldName];
		}
		return this;
	},

	/**
	 * Populates this with the values of an associative Array.
	 * Array keys must match field names to be used.
	 * @param {Object} values
	 * @return {Model}
	 */
	setValues: function(values) {
		for (var fieldName in this.constructor._fields) {
			if (!(fieldName in values)) {
				continue;
			}
			this[fieldName] = values[fieldName];
		}
		return this;
	},

	/**
	 * Returns an associative Array with the values of this.
	 * Array keys match field names.
	 * @return {Object}
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
			} else if (value instanceof Array) {
				var newValue = [];
				for (var x = 0, l = value.length; x < l; ++x) {
					if (!this._inGetValues && value[x] instanceof Model) {
						this._inGetValues = true;
						newValue[x] = value[x].getValues();
						delete this._inGetValues;
					} else {
						newValue[x] = value[x];
					}
				}
				value = newValue;
			} else {
				value = copy(value);
			}
			values[fieldName] = value;
		}

		return values;
	},

	/**
	 * Returns true if this table has primary keys and if all of the primary values are not null
	 * @return {Boolean}
	 */
	hasKeyValues: function() {
		var pks = this.constructor._keys;
		if (pks.length === 0) {
			return false;
		}
		for (var x = 0, len = pks.length; x < len; ++x) {
			var pk = pks[x];
			if (this[pk] === null) {
				return false;
			}
		}
		return true;
	},

	/**
	 * Returns an array of all primary key values.
	 *
	 * @return {Array}
	 */
	getKeyValues: function() {
		var values = {},
			pks = this.constructor._keys;

		for (var x = 0, len = pks.length; x < len; ++x) {
			var pk = pks[x];
			values[pk] = copy(this[pk]);
		}
		return values;
	},

	/**
	 * Returns true if this has not yet been saved to the database
	 * @return {Boolean}
	 */
	isNew: function() {
		return this._isNew;
	},

	/**
	 * Indicate whether this object has been saved to the database
	 * @param {Boolean} bool
	 * @return {Model}
	 */
	setNew: function (bool) {
		this._isNew = (bool === true);
		return this;
	},

	/**
	 * Returns true if the field values validate.
	 * @return {Boolean}
	 */
	validate: function() {
		this._validationErrors = [];

		for (var fieldName in this.constructor._fields) {
			var field = this.constructor._fields[fieldName];
			if (!field.required) {
				continue;
			}
			var value = this[fieldName];
			if (!value || (value instanceof Array && value.length === 0)) {
				this._validationErrors.push(fieldName + ' is required.');
			}
		}

		return this._validationErrors.length === 0;
	},

	/**
	 * See this.validate()
	 * @return {Array} Array of errors that occured when validating object
	 */
	getValidationErrors: function() {
		return this._validationErrors;
	},

	/**
	 * Saves the values of this using either insert or update
	 * @param {function} success Success callback
	 * @param {function} failure callback
	 * @return {Promise}
	 */
	save: function(success, failure) {
		if (this.isNew()) {
			return this.insert(success, failure);
		} else {
			return this.update(success, failure);
		}
	},

	/**
	 * Stores a new record with that values in this object
	 * @param {function} success Success callback
	 * @param {function} failure callback
	 * @return {Promise}
	 */
	insert: function(success, failure) {
		return this.callAsync(function(){
			var model = this.constructor;

			if (!this.validate()) {
				throw new Error('Cannot save ' + model._table + ' with validation errors:\n' + this.getValidationErrors().join('\n'));
			}

			if (this.isNew() && model.hasField('created') && !this.isModified('created')) {
				this.created = new Date();
			}
			if ((this.isNew() || this.isModified()) && model.hasField('updated') && !this.isModified('updated')) {
				this.updated = new Date();
			}

			return this.constructor._adapter.insert(this);
		}, success, failure);
	},

	/**
	 * Updates the stored record representing this object.
	 * @param {Object} values
	 * @param {function} success Success callback
	 * @param {function} failure callback
	 * @return {Promise}
	 */
	update: function(values, success, failure) {
		if (typeof values === 'function') {
			success = values;
			failure = success;
		}

		return this.callAsync(function(){
			var model = this.constructor;

			if (!this.validate()) {
				throw new Error('Cannot save ' + model._table + ' with validation errors:\n' + this.getValidationErrors().join('\n'));
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

			if (typeof values === 'object') {
				this.setValues(values);
			}

			return model._adapter.update(this);
		}, success, failure);
	},

	/**
	 * Deletes any records with a primary key(s) that match this
	 * NOTE/BUG: If you alter pre-existing primary key(s) before deleting, then you will be
	 * deleting based on the new primary key(s) and not the originals,
	 * leaving the original row unchanged(if it exists).  Also, since NULL isn't an accurate way
	 * to look up a row, I return if one of the primary keys is null.
	 * @return {Promise}
	 */
	destroy: function(success, failure) {
		return this.callAsync(function(){
			return this.constructor._adapter.destroy(this);
		}, success, failure);
	}

});

Model.models = {};

Model._fields = Model._keys = Model._table = null;

Model._autoIncrement = false;

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

/**
 * @param {String} type
 * @returns {Boolean}
 */
Model.isFieldType = function(type) {
	return (type in Model.FIELD_TYPES || this.isObjectType(type));
};

/**
 * Whether passed type is a temporal (date/time/timestamp) type.
 * @param {String} type
 * @return {Boolean}
 */
Model.isTemporalType = function(type) {
	return (type in this.TEMPORAL_TYPES);
};

/**
 * Returns true if values for the type need to be quoted.
 * @param {String} type
 * @return {Boolean}
 */
Model.isTextType = function(type) {
	return (type in this.TEXT_TYPES);
};

/**
 * Returns true if values for the type are numeric.
 * @param {String} type
 * @return {Boolean}
 */
Model.isNumericType = function(type) {
	return (type in this.NUMERIC_TYPES);
};

/**
 * Returns true if values for the type are integer.
 * @param {String} type
 * @return {Boolean}
 */
Model.isIntegerType = function(type) {
	return (type in this.INTEGER_TYPES);
};

/**
 * Returns true if values for the type are objects or arrays.
 * @param {String} type
 * @return {Boolean}
 */
Model.isObjectType = function(type) {
	return typeof type === 'function';
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

	if (typeof value === 'undefined' || value === null) {
		if (fieldType === Array) {
			return [];
		}
		return null;
	}

	var temporal = this.isTemporalType(fieldType),
		numeric = this.isNumericType(fieldType),
		intVal,
		floatVal;

	if (numeric || temporal) {
		if ('' === value) {
			return null;
		}
		if (numeric) {
			if (this.isIntegerType(fieldType)) {
				// validate and cast
				intVal = parseInt(value, 10);
				if (isNaN(intVal) || intVal.toString() !== value.toString()) {
					throw new Error(value + ' is not a valid integer');
				}
				value = intVal;
			} else {
				// validate and cast
				floatVal = parseFloat(value, 10);
				if (isNaN(floatVal) || floatVal.toString() !== value.toString()) {
					throw new Error(value + ' is not a valid float');
				}
				value = floatVal;
			}
		} else if (temporal) {
			if (!(value instanceof Date)) {
				value = new Date(value);
				if (isNaN(value.getTime())) {
					throw new Error(value + ' is not a valid date');
				}
			}
		}
	} else if (fieldType === Array) {
		if (field.elementType) {
			for (var x = 0, l = value.length; x < l; ++x) {
				if (value[x] !== null) {
					value[x] = cast(value[x], field.elementType);
				}
			}
		}
	} else if (this.isObjectType(fieldType)) {
		if (value !== null) {
			value = cast(value, fieldType);
		}
	}
	return value;
};

/**
 * @returns {Adapter}
 */
Model.getAdapter = function(){
	return this._adapter;
};

/**
 * @param {Adapter} adapter
 * @returns {Model}
 */
Model.setAdapter = function(adapter){
	this._adapter = adapter;
	return this;
};

/**
 * @param {Object} values
 * @returns {Model}
 */
Model.inflate = function(values) {
	var pk = this.getPrimaryKey(),
		adapter = this.getAdapter(),
		instance;
	if (pk && values[pk]) {
		instance = adapter.cache(this._table, values[pk]);
		if (instance) {
			return instance;
		}
	}
	instance = new this(values)
		.resetModified()
		.setNew(false);

	if (pk && instance[pk]) {
		adapter.cache(this._table, instance[pk], instance);
	}
	return instance;
};

/**
 * Returns string representation of table name
 * @return {String}
 */
Model.getTableName = function() {
	return this._table;
};

/**
 * Access to array of field types, indexed by field name
 * @return {Object}
 */
Model.getFields = function() {
	return copy(this._fields);
};

/**
 * Get the type of a field
 * @param {String} fieldName
 * @return {Object}
 */
Model.getField = function(fieldName) {
	return copy(this._fields[fieldName]);
};

/**
 * Get the type of a field
 * @param {String} fieldName
 * @return {mixed}
 */
Model.getFieldType = function(fieldName) {
	return this._fields[fieldName].type;
};

/**
 * @param {String} fieldName
 * @return {Boolean}
 */
Model.hasField = function(fieldName) {
	return fieldName in this._fields;
};

/**
 * Access to array of primary keys
 * @return {Array}
 */
Model.getPrimaryKeys = function() {
	return this._keys.slice(0);
};

/**
 * Access to name of primary key
 * @return {Array}
 */
Model.getPrimaryKey = function() {
	return this._keys.length === 1 ? this._keys[0] : null;
};

/**
 * Returns true if the primary key field for this table is auto-increment
 * @return {Boolean}
 */
Model.isAutoIncrement = function() {
	return this._autoIncrement;
};

/**
 * @param {String} fieldName
 * @param {mixed} field
 */
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

	try {
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
	} catch (e) {}
};

/**
 * @param {String} table
 * @param {Object} opts
 * @return {Model}
 */
Model.extend = function(table, opts) {
	var newClass,
		fieldName,
		prop;

	if (typeof table === 'undefined') {
		throw new Error('Must provide a table when exending Model');
	}
	if (!opts.fields) {
		throw new Error('Must provide fields when exending Model');
	}

	newClass = Class.extend.call(this, opts.prototype);
	delete opts.prototype;

	if (!this._table && !this._fields) {
		newClass._keys = [];
		newClass._fields = {};
	} else {
		newClass._keys = copy(this._keys);
		newClass._fields = copy(this._fields);
	}

	newClass._table = table;

	for (prop in opts) {
		switch (prop) {
			// private static properties
			case 'url':
			case 'adapter':
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

/**
 * Gives Model classes and their instances the ability to call methods on themselves using
 * a standard asynchronous API
 * @param {function} func A method that can return a Promise or a normal return value
 * @param {function} success Success callback
 * @param {function} failure callback
 */
Model.callAsync = Model.prototype.callAsync = function callAsync(func, success, failure) {
	var deferred = new Deferred(),
		promise = deferred.promise();

	try {
		var result = func.call(this);
		if (result instanceof promise.constructor) {
			promise = result;
		} else {
			deferred.resolve(result);
		}
	} catch (e) {
		deferred.fail({
			errors: [e]
		});
	}

	if (typeof success === 'function' || typeof failure === 'function') {
		promise.then(success, failure);
	}

	return promise;
};

Model.isModel = true;

Model.toString = function() {
	return this._table;
};

/*
 * Adapter lookup methods
 */

var adapterMethods = ['countAll', 'findAll', 'find', 'destroyAll', 'updateAll'];
for (var i = 0, l = adapterMethods.length; i < l; ++i) {
	var method = adapterMethods[i];
	Model[method] = (function(method){
		return function() {
			var args = Array.prototype.slice.call(arguments),
				con = this.getAdapter(),
				success = null,
				failure = null,
				x = args.length - 1;
			while (x > -1 && !(args[x] instanceof Model) && typeof args[x] === 'function') {
				if (!success) {
					success = args.pop();
					--x;
					continue;
				}

				failure = success;
				success = args.pop();
				break;
			}
			args.unshift(this);
			return this.callAsync(function(){
				return con[method].apply(con, args);
			}, success, failure);
		};
	})(method);
}

var findAliases = ['findBy', 'retrieveByField', 'retrieveByPK', 'retrieveByPKs', 'findByPKs'];
for (var x = 0, len = findAliases.length; x < len; ++x) {
	Model[findAliases[x]] = Model.find;
}

/*
 * Helper functions
 */

function cast(obj, type) {
	if (type.isModel) {
		if (obj.constructor === type) {
			return obj;
		}
		return type.inflate(obj);
	}
	return obj;
}

function copy(obj) {
	if (obj === null) {
		return null;
	}

	if (obj instanceof Model) {
		return obj.constructor(obj);
	}

	if (obj instanceof Array) {
		return obj.slice(0);
	}

	if (obj instanceof Date) {
		return new Date(obj);
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

function equals(a, b) {
	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (typeof a === 'object') {
		return JSON.stringify(a) === JSON.stringify(b);
	}
	return a === b;
}

})();
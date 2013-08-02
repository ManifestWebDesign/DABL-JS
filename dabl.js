dabl = typeof dabl === "undefined" ? {} : dabl;

(function(dabl){

/* Class.js */
/**
 * Simple JavaScript Inheritance
 * Initially by John Resig http://ejohn.org/
 * MIT Licensed.
 */

var initializing = false, fnTest = /xyz/.test(function(){
	xyz;
}) ? /\b_super\b/ : /.*/;

function extend(newProps, target, src) {
	var name;

	// Copy the properties over onto the new prototype
	for (name in newProps) {
		// Check if we're overwriting an existing function
		target[name] = typeof newProps[name] === 'function' &&
		typeof src[name] === 'function' && fnTest.test(newProps[name]) ?
		(function(name, fn){
			return function() {
				var tmp = this._super,
					ret;

				// Add a new ._super() method that is the same method
				// but on the super-class
				this._super = src[name];

				// The method only need to be bound temporarily, so we
				// remove it when we're done executing
				ret = fn.apply(this, arguments);
				this._super = tmp;

				return ret;
			};
		})(name, newProps[name]) : newProps[name];
	}
}

// The base Class implementation (does nothing)
var Class = function(){};

function doesDefinePropertyWork(object) {
	try {
		Object.defineProperty(object, "sentinel", {
			value: 'foo'
		});
		return "sentinel" in object;
	} catch (exception) {
		return false;
	}
}

Class.canDefineProperties = doesDefinePropertyWork({});

// Create a new Class that inherits from this class
Class.extend = function(instanceProps, classProps) {
	if (typeof instanceProps === 'undefined') {
		instanceProps = {};
	}
	if (typeof classProps === 'undefined') {
		classProps = {};
	}

	var prototype,
		name;

	// Instantiate a base class (but only create the instance,
	// don't run the init constructor)
	initializing = true;
	prototype = new this();
	initializing = false;

	// The dummy class constructor
	function Class() {
		// All construction is actually done in the init method
		if (!initializing && this.init) {
			this.init.apply(this, arguments);
		}
	}

	for (name in this) {
		if (!(name in classProps) && this.hasOwnProperty(name)) {
			Class[name] = this[name];
		}
	}

	extend(instanceProps, prototype, this.prototype);
	extend(classProps, Class, this);

	// Populate our constructed prototype object
	Class.prototype = prototype;

	// Enforce the constructor to be what we expect
	Class.prototype.constructor = Class;

	return Class;
};

/**
 * Normalizes the return value of async and non-async functions to always use the
 * Deferred/Promise API
 * @param {function} func A method that can return a Promise or a normal return value
 * @param {function} success Success callback
 * @param {function} failure callback
 */
Class.callAsync = Class.prototype.callAsync = function callAsync(func, success, failure) {
	var deferred = dabl.Deferred(),
		promise = deferred.promise();

	try {
		var result = func.call(this);
		if (result && typeof result.then === 'function') {
			promise = result;
		} else {
			deferred.resolve(result);
		}
	} catch (e) {
		deferred.reject(e);
	}

	if (typeof success === 'function' || typeof failure === 'function') {
		promise.then(success, failure);
	}

	return promise;
};

dabl.Class = Class;

/* Deferred.js */
if (typeof jQuery !== 'undefined' && jQuery.Deferred) {
	dabl.Deferred = jQuery.Deferred;
} else {
// https://github.com/warpdesign/Standalone-Deferred

function isArray(arr) {
	return Object.prototype.toString.call(arr) === '[object Array]';
}

function foreach(arr, handler) {
	if (isArray(arr)) {
		for (var i = 0; i < arr.length; i++) {
			handler(arr[i]);
		}
	}
	else
		handler(arr);
}

function D(fn) {
	var status = 'pending',
		doneFuncs = [],
		failFuncs = [],
		progressFuncs = [],
		resultArgs = null,

	promise = {
		done: function() {
			for (var i = 0; i < arguments.length; i++) {
				// skip any undefined or null arguments
				if (!arguments[i]) {
					continue;
				}

				if (isArray(arguments[i])) {
					var arr = arguments[i];
					for (var j = 0; j < arr.length; j++) {
						// immediately call the function if the deferred has been resolved
						if (status === 'resolved') {
							arr[j].apply(this, resultArgs);
						}

						doneFuncs.push(arr[j]);
					}
				}
				else {
					// immediately call the function if the deferred has been resolved
					if (status === 'resolved') {
						arguments[i].apply(this, resultArgs);
					}

					doneFuncs.push(arguments[i]);
				}
			}

			return this;
		},

		fail: function() {
			for (var i = 0; i < arguments.length; i++) {
				// skip any undefined or null arguments
				if (!arguments[i]) {
					continue;
				}

				if (isArray(arguments[i])) {
					var arr = arguments[i];
					for (var j = 0; j < arr.length; j++) {
						// immediately call the function if the deferred has been resolved
						if (status === 'rejected') {
							arr[j].apply(this, resultArgs);
						}

						failFuncs.push(arr[j]);
					}
				}
				else {
					// immediately call the function if the deferred has been resolved
					if (status === 'rejected') {
						arguments[i].apply(this, resultArgs);
					}

					failFuncs.push(arguments[i]);
				}
			}

			return this;
		},

		always: function() {
			return this.done.apply(this, arguments).fail.apply(this, arguments);
		},

		progress: function() {
			for (var i = 0; i < arguments.length; i++) {
				// skip any undefined or null arguments
				if (!arguments[i]) {
					continue;
				}

				if (isArray(arguments[i])) {
					var arr = arguments[i];
					for (var j = 0; j < arr.length; j++) {
						// immediately call the function if the deferred has been resolved
						if (status === 'pending') {
							progressFuncs.push(arr[j]);
						}
					}
				}
				else {
					// immediately call the function if the deferred has been resolved
					if (status === 'pending') {
						progressFuncs.push(arguments[i]);
					}
				}
			}

			return this;
		},

		then: function() {
			// fail callbacks
			if (arguments.length > 1 && arguments[1]) {
				this.fail(arguments[1]);
			}

			// done callbacks
			if (arguments.length > 0 && arguments[0]) {
				this.done(arguments[0]);
			}

			// notify callbacks
			if (arguments.length > 2 && arguments[2]) {
				this.progress(arguments[2]);
			}
			return this;
		},

		promise: function(obj) {
			if (obj == null) {
				return promise;
			} else {
				for (var i in promise) {
					obj[i] = promise[i];
				}
				return obj;
			}
		},

		state: function() {
			return status;
		},

		debug: function() {
			console.log('[debug]', doneFuncs, failFuncs, status);
		},

		isRejected: function() {
			return status === 'rejected';
		},

		isResolved: function() {
			return status === 'resolved';
		},

		pipe: function(done, fail, progress) {
			return D(function(def) {
				foreach(done, function(func) {
					// filter function
					if (typeof func === 'function') {
						deferred.done(function() {
							var returnval = func.apply(this, arguments);
							// if a new deferred/promise is returned, its state is passed to the current deferred/promise
							if (returnval && typeof returnval === 'function') {
								returnval.promise().then(def.resolve, def.reject, def.notify);
							}
							else {	// if new return val is passed, it is passed to the piped done
								def.resolve(returnval);
							}
						});
					}
					else {
						deferred.done(def.resolve);
					}
				});

				foreach(fail, function(func) {
					if (typeof func === 'function') {
						deferred.fail(function() {
							var returnval = func.apply(this, arguments);

							if (returnval && typeof returnval === 'function') {
								returnval.promise().then(def.resolve, def.reject, def.notify);
							} else {
								def.reject(returnval);
							}
						});
					}
					else {
						deferred.fail(def.reject);
					}
				});
			}).promise();
		}
	},

	deferred = {
		resolveWith: function(context) {
			if (status === 'pending') {
				status = 'resolved';
				var args = resultArgs = (arguments.length > 1) ? arguments[1] : [];
				for (var i = 0; i < doneFuncs.length; i++) {
					doneFuncs[i].apply(context, args);
				}
			}
			return this;
		},

		rejectWith: function(context) {
			if (status === 'pending') {
				status = 'rejected';
				var args = resultArgs = (arguments.length > 1) ? arguments[1] : [];
				for (var i = 0; i < failFuncs.length; i++) {
					failFuncs[i].apply(context, args);
				}
			}
			return this;
		},

		notifyWith: function(context) {
			if (status === 'pending') {
				var args = resultArgs = (arguments.length > 1) ? arguments[1] : [];
				for (var i = 0; i < progressFuncs.length; i++) {
					progressFuncs[i].apply(context, args);
				}
			}
			return this;
		},

		resolve: function() {
			return this.resolveWith(this, arguments);
		},

		reject: function() {
			return this.rejectWith(this, arguments);
		},

		notify: function() {
			return this.notifyWith(this, arguments);
		}
	};

	var obj = promise.promise(deferred);

	if (fn) {
		fn.apply(obj, [obj]);
	}

	return obj;
}

D.when = function() {
	if (arguments.length < 2) {
		var obj = arguments.length ? arguments[0] : undefined;
		if (obj && (typeof obj.isResolved === 'function' && typeof obj.isRejected === 'function')) {
			return obj.promise();
		}
		else {
			return D().resolve(obj).promise();
		}
	}
	else {
		return (function(args){
			var df = D(),
				size = args.length,
				done = 0,
				rp = new Array(size);	// resolve params: params of each resolve, we need to track down them to be able to pass them in the correct order if the master needs to be resolved

			for (var i = 0; i < args.length; i++) {
				(function(j) {
					args[j].done(function() { rp[j] = (arguments.length < 2) ? arguments[0] : arguments; if (++done === size) { df.resolve.apply(df, rp); }})
					.fail(function() { df.reject(arguments); });
				})(i);
			}

			return df.promise();
		})(arguments);
	}
};

dabl.Deferred = D;
}

/* Model.js */
var Model = Class.extend({

	/**
	 * Object containing names of modified fields
	 */
	_oldValues: null,

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
		var defaults = {},
			model = this.constructor;
		for (var fieldName in model._fields) {
			var field = model._fields[fieldName];
			if (typeof field.value !== 'undefined') {
				defaults[fieldName] = copy(field.value);
			} else if (field.type === Array) {
				defaults[fieldName] = [];
			} else {
				defaults[fieldName] = null;
			}
		}
		this.fromJSON(defaults);
		this.resetModified();
		if (values) {
			this.fromJSON(values);
		}
	},

	toString: function() {
		return this.constructor._table + ':' + JSON.stringify(this.toJSON());
	},

	/**
	 * Creates new instance of self and with the same values as this, except
	 * the primary key value is cleared
	 * @return {Model}
	 */
	copy: function() {
		var model = this.constructor,
			newObject = new model(this),
			pk = model.getKey();

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
			return !equals(this[fieldName], this._oldValues[fieldName]);
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
		this._oldValues = JSON.parse(JSON.stringify(this));
		return this;
	},

	/**
	 * Resets the object to the state it was in before changes were made
	 */
	revert: function() {
		this.fromJSON(this._oldValues);
		this.resetModified();
		return this;
	},

	/**
	 * Populates this with the values of an associative Array.
	 * Array keys must match field names to be used.
	 * @param {Object} values
	 * @return {Model}
	 */
	fromJSON: function(values) {
		var model = this.constructor;
		for (var fieldName in model._fields) {
			if (!(fieldName in values)) {
				continue;
			}
			this[fieldName] = values[fieldName];
		}
		model.coerceValues(this);
		return this;
	},

	/**
	 * Returns an associative Array with the values of this.
	 * Array keys match field names.
	 * @return {Object}
	 */
	toJSON: function() {
		var values = {},
			fieldName,
			value,
			model = this.constructor,
			fields = model._fields;

		// avoid infinite loops
		if (this._inToJSON) {
			return null;
		}
		this._inToJSON = true;

		model.coerceValues(this);

		for (fieldName in fields) {
			value = this[fieldName];
			if (value instanceof Array) {
				var newValue = [];
				for (var x = 0, l = value.length; x < l; ++x) {
					if (value[x] !== null && typeof value[x].toJSON === 'function') {
						newValue[x] = value[x].toJSON();
					} else {
						newValue[x] = copy(value[x]);
					}
				}
				value = newValue;
			} else if (fields[fieldName].type === Model.FIELD_TYPE_DATE) {
				value = formatDate(value);
			} else if (value !== null && typeof value.toJSON === 'function') {
				value = value.toJSON();
			} else {
				value = copy(value);
			}
			values[fieldName] = value;
		}

		delete this._inToJSON;

		return values;
	},

	/**
	 * Returns true if this table has primary keys and if all of the key values are not null
	 * @return {Boolean}
	 */
	hasKeyValues: function() {
		var model = this.constructor,
			pks = model._keys;
		if (pks.length === 0) {
			return false;
		}

		model.coerceValues(this);
		for (var x = 0, len = pks.length; x < len; ++x) {
			var pk = pks[x];
			if (this[pk] === null) {
				return false;
			}
		}
		return true;
	},

	/**
	 * Returns an object of key values, indexed by field name.
	 *
	 * @return {Object}
	 */
	getKeyValues: function() {
		var values = {},
			model = this.constructor,
			pks = model._keys;

		model.coerceValues(this);
		for (var x = 0, len = pks.length; x < len; ++x) {
			var pk = pks[x];
			values[pk] = this[pk];
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
		var model = this.constructor;

		model.coerceValues(this);
		for (var fieldName in model._fields) {
			var field = model._fields[fieldName];
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
				throw new Error('Cannot update without primary keys');
			}

			if (this.isNew() && model.hasField('created') && !this.isModified('created')) {
				this.created = new Date();
			}
			if ((this.isNew() || this.isModified()) && model.hasField('updated') && !this.isModified('updated')) {
				this.updated = new Date();
			}

			if (typeof values === 'object') {
				this.fromJSON(values);
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
	 * @param {function} success Success callback
	 * @param {function} failure callback
	 * @return {Promise}
	 */
	remove: function(success, failure) {
		return this.callAsync(function(){
			return this.constructor._adapter.remove(this);
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
 * @param {mixed} value
 * @param {Object} field
 * @return {mixed}
 */
Model.coerceValue = function(value, field) {
	var fieldType = field.type;

	if (typeof value === 'undefined' || value === null) {
		if (fieldType === Array) {
			value = [];
		} else {
			return null;
		}
	}

	var temporal = this.isTemporalType(fieldType),
		numeric = this.isNumericType(fieldType);

	if (numeric || temporal) {
		if ('' === value) {
			return null;
		}
	}
	if (numeric) {
		if (this.isIntegerType(fieldType)) {
			// validate and cast
			value = parseInt(value, 10);
			if (isNaN(value)) {
				throw new Error(value + ' is not a valid integer');
			}
		} else {
			// validate and cast
			value = parseFloat(value, 10);
			if (isNaN(value)) {
				throw new Error(value + ' is not a valid float');
			}
		}
	} else if (temporal) {
		if (!(value instanceof Date)) {
			var date = constructDate(value);
			if (isNaN(date.getTime())) {
				throw new Error(value + ' is not a valid date');
			}
			value = date;
		}
	} else if (fieldType === Array) {
		if (field.elementType) {
			this.convertArray(value, field.elementType);
			for (var x = 0, l = value.length; x < l; ++x) {
				value[x] = this.coerceValue(value[x], {type: field.elementType});
			}
		}
	} else if (fieldType === this.FIELD_TYPE_TEXT) {
		if (typeof value !== 'string') {
			value = value + '';
		}
	} else if (
		this.isObjectType(fieldType)
		&& fieldType.isModel
		&& value.constructor !== fieldType
	) {
		value = fieldType.inflate(value);
	}
	return value;
};

Model.coerceValues = function(values) {
	if (null === values || typeof values === 'undefined') {
		return this;
	}
	for (var fieldName in this._fields) {
		if (!(fieldName in values)) {
			continue;
		}
		values[fieldName] = this.coerceValue(values[fieldName], this._fields[fieldName]);
	}
	return this;
};

Model.convertArray = function(array, elementType) {
	if (array.modelCollection) {
		return;
	}

	array.modelCollection = true;

	var model = this;
	array.push = function() {
		return Array.prototype.push.apply(this, model.coerceValue(arguments, {type: Array, elementType: elementType}));
	};
	array.unshift = function() {
		return Array.prototype.unshift.apply(this, model.coerceValue(arguments, {type: Array, elementType: elementType}));
	};
	array.pop = function() {
		return model.coerceValue(Array.prototype.pop.apply(this, arguments), {type: elementType});
	};
	array.shift = function() {
		return model.coerceValue(Array.prototype.shift.apply(this, arguments), {type: elementType});
	};
	array.slice = function() {
		return model.coerceValue(Array.prototype.slice.apply(this, arguments), {type: Array, elementType: elementType});
	};
	array.concat = function() {
		return model.coerceValue(Array.prototype.concat.apply(this, arguments), {type: Array, elementType: elementType});
	};
	array.splice = function() {
		for (var x = 2, l = arguments.length; x < l; ++x) {
			arguments[x] = model.coerceValue(arguments[x], {type: elementType});
		}
		return model.coerceValue(Array.prototype.splice.apply(this, arguments), {type: Array, elementType: elementType});
	};

	var iterationMethods = ['forEach', 'every', 'some', 'filter', 'map'];
	for (var x = 0, l = iterationMethods.length; x < l; ++x) {
		var method = iterationMethods[x];
		array[method] = (function(method) {
			return function(callback, thisArg) {
				return Array.prototype[method].call(this, function() {
					arguments[0] = model.coerceValue(arguments[0], {type: elementType});
					return callback.apply(this, arguments);
				}, thisArg);
			};
		})(method);
	}
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
	var pk = this.getKey(),
		adapter = this.getAdapter(),
		instance;
	if (pk && values[pk]) {
		instance = adapter.cache(this._table, values[pk]);
		if (instance) {
			// if instance is modified, don't alter with values from database
			if (instance.isModified()) {
				return instance;
			}
			// if not modified, update instance with latest db values
			instance.fromJSON(values);
		}
	}
	if (!instance) {
		instance = new this(values);
	}
	instance
		.resetModified()
		.setNew(false);

	if (pk && instance[pk]) {
		adapter.cache(this._table, instance[pk], instance);
	}
	return instance;
};

Model.inflateArray = function(array) {
	var i,
		len,
		result;

	if (array.constructor !== Array) {
		if (typeof result.length === 'undefined') {
			throw new Error('Unknown array type for collection.');
		}
		result = [];
	} else {
		result = array;
	}

	for (i = 0, len = array.length; i < len; ++i) {
		result[i] = this.inflate(array[i]);
	}

	this.convertArray(result, this);
	return result;
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
Model.getKeys = function() {
	return this._keys.slice(0);
};

/**
 * Access to name of primary key
 * @return {Array}
 */
Model.getKey = function() {
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
	if (!field.type) {
		field = {
			type: field
		};
	}

	if (typeof field.type === 'string') {
		field.type = field.type.toUpperCase();
	}

	switch (field.type) {
		case 'STRING':
		case String:
			field.type = this.FIELD_TYPE_TEXT;
			break;
		case Number:
			field.type = this.FIELD_TYPE_NUMERIC;
			break;
		case Date:
			field.type = this.FIELD_TYPE_TIMESTAMP;
			break;
		case 'INT':
			field.type = this.FIELD_TYPE_INTEGER;
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
	if (field.type.isModel) {
		this._relations.push(fieldName);
	}

	this._fields[fieldName] = field;

//	var get, set, self = this;
//	if (!this.prototype.__defineGetter__ && !this.canDefineProperties) {
//		return;
//	}
//
//	get = function() {
//		var value = this._values[fieldName];
//		return typeof value === 'undefined' ? null : value;
//};
//	set = function(value) {
//		this._values[fieldName] = self.coerceValue(value, field);
//	};
//
//	try {
//		if (Object.defineProperty) {
//			Object.defineProperty(this.prototype, fieldName, {
//				get: get,
//				set: set,
//				enumerable: true
//			});
//		} else {
//			this.prototype.__defineGetter__(fieldName, get);
//			this.prototype.__defineSetter__(fieldName, set);
//		}
//	} catch (e) {}
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
		newClass._relations = [];
	} else {
		newClass._keys = copy(this._keys);
		newClass._fields = copy(this._fields);
		newClass._relations = copy(this._relations);
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

Model.isModel = true;

Model.toString = function() {
	return this._table;
};

/*
 * Adapter lookup methods
 */

var adapterMethods = ['countAll', 'findAll', 'find', 'removeAll', 'updateAll'];
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

dabl.Model = Model;


/* dabl.js */
function sPad(value) {
	value = value + '';
	return value.length === 2 ? value : '0' + value;
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
		return new Date(obj.getTime());
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

function formatDate(value) {
	if (!(value instanceof Date)) {
		value = constructDate(value);
	}
	return value.getUTCFullYear() + '-' + sPad(value.getUTCMonth() + 1) + '-' + sPad(value.getUTCDate());
}

function constructDate(string) {
	if (string instanceof Date) {
		return string;
	}
	var date;
	if (typeof moment !== 'undefined') {
		date = moment(string).toDate();
	} else {
		date = new Date(string);
	}
	return date;
}

/* Condition.js */
var Condition = Class.extend({
	_conds : null,

	init: function Condition(left, operator, right, quote) {
		this._conds = [];
		if (arguments.length !== 0) {
			this.and.apply(this, arguments);
		}
	},

	_preprocessCondition: function(left, operator, right, quote) {
		switch (arguments.length) {
			case 0:
				return null;
			case 1:
				if (left instanceof Query.Statement || (left instanceof Condition && left._conds.length !== 0)) {
					return [left];
				} else {
					return null;
				}
			case 2:
				right = operator;
				operator = Condition.EQUAL;
				// pass through...
			case 3:
				quote = Condition.QUOTE_RIGHT;
		}

		var isQuery = right instanceof Query,
			isArray = right instanceof Array;

		if (isArray || isQuery) {
			if (false === isQuery || 1 !== right.getLimit()) {
				// Convert any sort of equality operator to something suitable for arrays
				switch (operator) {
					case Condition.BETWEEN:
						break;
					// Various forms of equal
					case Condition.IN:
					case Condition.EQUAL:
					case 'eq':
						operator = Condition.IN;
						break;
					// Various forms of not equal
					case 'ne':
					case Condition.NOT_IN:
					case Condition.NOT_EQUAL:
					case Condition.ALT_NOT_EQUAL:
						operator = Condition.NOT_IN;
						break;
					default:
						throw new Error(operator + ' unknown for comparing an array.');
				}
			}
			if (isArray) {
				if (0 === right.length && operator === Condition.NOT_IN) {
					return null;
				}
			}
			if (isQuery) {
				if (!right.getTable()) {
					throw new Error('right does not have a table, so it cannot be nested.');
				}

				if (quote !== Condition.QUOTE_LEFT) {
					quote = Condition.QUOTE_NONE;
				}
			}
		} else {
			if (null === right) {
				if (operator === Condition.NOT_EQUAL || operator === Condition.ALT_NOT_EQUAL || operator === 'ne') {
					// IS NOT NULL
					operator = Condition.IS_NOT_NULL;
				} else if (operator === Condition.EQUAL || operator === 'eq') {
					// IS NULL
					operator = Condition.IS_NULL;
				}
			}
			if (operator === Condition.IS_NULL || operator === Condition.IS_NOT_NULL) {
				right = null;
				if (quote !== Condition.QUOTE_LEFT) {
					quote = Condition.QUOTE_NONE;
				}
			}
		}

		return [left, operator, right, quote];
	},

	/**
	 * @param {mixed} left
	 * @param {String} operator
	 * @param {mixed} right
	 * @param {Number} quote
	 * @return {Query.Statement}
	 */
	_processCondition : function(left, operator, right, quote) {

		if (arguments.length === 1) {
			if (left instanceof Query.Statement) {
				return left;
			}
			// Left can be a Condition
			if (left instanceof Condition) {
				clauseStatement = left.getQueryStatement();
				clauseStatement.setString('(' + clauseStatement._qString + ')');
				return clauseStatement;
			}
		}

		var statement = new Query.Statement,
			clauseStatement,
			x,
			isQuery = right instanceof Query,
			isArray = right instanceof Array,
			arrayLen;

		if (!(operator in Condition.SQL.operators)) {
			throw new Error('Unsupported SQL operator: "' + operator + '"');
		}

		if (operator === 'substringof') {
			var tmp = left;
			left = right;
			right = tmp;
		}
		operator = Condition.SQL.operators[operator];

		// Escape left
		if (quote === Condition.QUOTE_LEFT || quote === Condition.QUOTE_BOTH) {
			statement.addParam(left);
			left = '?';
		}

		if (operator === Condition.CONTAINS) {
			operator = Condition.LIKE;
			right = '%' + right + '%';
		} else if (operator === Condition.BEGINS_WITH) {
			operator = Condition.LIKE;
			right += '%';
		} else if (operator === Condition.ENDS_WITH) {
			operator = Condition.LIKE;
			right = '%' + right;
		}

		// right can be an array
		if (isArray || isQuery) {
			// Right can be a Query, if you're trying to nest queries, like "WHERE MyColumn = (SELECT OtherColumn From MyTable LIMIT 1)"
			if (isQuery) {
				clauseStatement = right.getQuery();

				right = '(' + clauseStatement._qString + ')';
				statement.addParams(clauseStatement._params);
			} else if (isArray) {
				arrayLen = right.length;
				// BETWEEN
				if (2 === arrayLen && operator === Condition.BETWEEN) {
					statement.setString(left + ' ' + operator + ' ? AND ?');
					statement.addParams(right);
					return statement;
				} else if (0 === arrayLen) {
					// Handle empty arrays
					if (operator === Condition.IN) {
						statement.setString('(0 = 1)');
						return statement;
					}
				} else if (quote === Condition.QUOTE_RIGHT || quote === Condition.QUOTE_BOTH) {
					statement.addParams(right);
					var rString = '(';
					for (x = 0; x < arrayLen; ++x) {
						if (0 < x) {
							rString += ',';
						}
						rString += '?';
					}
					right = rString + ')';
				}
			}
		} else {
			if (
				operator !== Condition.IS_NULL
				&& operator !== Condition.IS_NOT_NULL
				&& (quote === Condition.QUOTE_RIGHT || quote === Condition.QUOTE_BOTH)
			) {
				statement.addParam(right);
				right = '?';
			}
		}
		statement.setString(left + ' ' + operator + (right === null ? '' : ' ' + right));

		return statement;
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
			return 'null';
		}

		if (parseInt(value, 10) === value) {
			return value;
		}

//		if (value instanceof Date) {
//			if (value.getSeconds() === 0 && value.getMinutes() === 0 && value.getHours() === 0) {
//				// just a date
//				value = this.formatDate(value);
//			} else {
//				value = this.formatDateTime(value);
//			}
//		}

		return this.quote(value);
	},

	quote: function(value) {
		return "'" + value.replace("'", "''") + "'";
	},

	_processODataCondition: function(left, operator, right, quote) {

		if (arguments.length === 1) {
			if (left instanceof Query.Statement) {
				throw new Error('Unable to use Query.Statement within a Condition to build an OData query');
			}
			// Left can be a Condition
			if (left instanceof Condition) {
				return '(' + left.getODataFilter() + ')';
			}
		}

		if (right instanceof Query) {
			throw new Error('Unable to use Query within a Condition to build an OData query');
		}

		var x,
			isArray = right instanceof Array,
			arrayLen;

		// Escape left
		if (quote === Condition.QUOTE_LEFT || quote === Condition.QUOTE_BOTH) {
			left = this.prepareInput(left);
		}

		switch (operator) {
			case 'startswith':
			case 'endswith':
			case 'substringof':
			case Condition.LIKE:
			case Condition.CONTAINS:
			case Condition.BEGINS_WITH:
			case Condition.ENDS_WITH:
				if (right.indexOf('%') !== -1) {
					throw new Error('Cannot use % in OData queries');
				}
				break;
		}

		if (operator === Condition.IS_NULL) {
			operator = Condition.EQUAL;
			right = 'null';
		} else if (operator === Condition.IS_NOT_NULL) {
			operator = Condition.NOT_EQUAL;
			right = 'null';
		} else if (quote === Condition.QUOTE_RIGHT || quote === Condition.QUOTE_BOTH) {
			right = this.prepareInput(right);
		}

		// right can be an array
		if (isArray) {
			arrayLen = right.length;
			// BETWEEN
			if (2 === arrayLen && operator === Condition.BETWEEN) {
				return '(' + left + ' ge ' + right[0] + ' and ' + left + ' le ' + right[1] + ')';
			} else if (0 === arrayLen && operator === Condition.IN) {
				// Handle empty arrays
				return '(0 eq 1)';
			} else {
				var sep;
				if (operator === Condition.IN) {
					operator = ' eq ';
					sep = ' or ';
				} else {
					operator = ' ne ';
					sep = ' and ';
				}
				var str = '(';
				for (x = 0; x < arrayLen; ++x) {
					str += (0 !== x ? sep : '') + left + operator + right[x];
				}
				return str + ')';
			}
		} else {
			if (operator in Condition.OData.operators) {
				operator = Condition.OData.operators[operator];
				return left + ' ' + operator + ' ' + right;
			} else if (operator in Condition.OData.functions) {
				var func = Condition.OData.functions[operator];
				var rightIndex = func.indexOf('@');
				var leftIndex = func.indexOf('?');
				if (rightIndex > leftIndex) {
					func = func.substring(0, rightIndex) + right + func.substr(rightIndex + 1);
					func = func.substring(0, leftIndex) + left + func.substr(leftIndex + 1);
				} else {
					func = func.substring(0, leftIndex) + left + func.substr(leftIndex + 1);
					func = func.substring(0, rightIndex) + right + func.substr(rightIndex + 1);
				}
				return func;
			}
		}

		throw new Error('Unexpected arguments: ' + arguments.join(', '));
	},

	/**
	 * Adds an "AND" condition to the array of conditions.
	 * @param left mixed
	 * @param operator string[optional]
	 * @param right mixed[optional]
	 * @param quote int[optional]
	 * @return {Condition}
	 */
	and : function(left, operator, right, quote) {
		var key;

		if (left.constructor === Object) {
			for (key in left) {
				this.and(key, left[key]);
			}
			return this;
		}

		var args = this._preprocessCondition.apply(this, arguments);
		if (null === args) {
			return this;
		}

		args.type = 'AND';
		this._conds.push(args);

		return this;
	},

	/**
	 * Alias of and
	 * @return {Condition}
	 */
	addAnd : function(left, operator, right, quote) {
		return this.and.apply(this, arguments);
	},

	/**
	 * Alias of and
	 * @return {Condition}
	 */
	add : function(left, operator, right, quote) {
		return this.and.apply(this, arguments);
	},

	/**
	 * Alias of and
	 * @return {Condition}
	 */
	filter : function(left, operator, right, quote) {
		return this.and.apply(this, arguments);
	},

	/**
	 * Alias of and
	 * @return {Condition}
	 */
	where : function(left, operator, right, quote) {
		return this.and.apply(this, arguments);
	},

	/**
	 * Adds an "OR" condition to the array of conditions.
	 * @param left mixed
	 * @param operator string[optional]
	 * @param right mixed[optional]
	 * @param quote int[optional]
	 * @return {Condition}
	 */
	or : function(left, operator, right, quote) {
		var key;

		if (left.constructor === Object) {
			for (key in left) {
				this.or(key, left[key]);
			}
			return this;
		}

		var args = this._preprocessCondition.apply(this, arguments);
		if (null === args) {
			return this;
		}

		args.type = 'OR';
		this._conds.push(args);

		return this;
	},

	/**
	 * Alias of or
	 * @return {Condition}
	 */
	addOr : function(left, operator, right, quote) {
		return this.or.apply(this, arguments);
	},

	/**
	 * Alias of or
	 * @return {Condition}
	 */
	orWhere : function(left, operator, right, quote) {
		return this.or.apply(this, arguments);
	},

	/**
	 * @return {Condition}
	 */
	andNot : function(column, value) {
		return this.and(column, Condition.NOT_EQUAL, value);
	},

	/**
	 * @return {Condition}
	 */
	andLike : function(column, value) {
		return this.and(column, Condition.LIKE, value);
	},

	/**
	 * @return {Condition}
	 */
	andNotLike : function(column, value) {
		return this.and(column, Condition.NOT_LIKE, value);
	},

	/**
	 * @return {Condition}
	 */
	andGreater : function(column, value) {
		return this.and(column, Condition.GREATER_THAN, value);
	},

	/**
	 * @return {Condition}
	 */
	andGreaterEqual : function(column, value) {
		return this.and(column, Condition.GREATER_EQUAL, value);
	},

	/**
	 * @return {Condition}
	 */
	andLess : function(column, value) {
		return this.and(column, Condition.LESS_THAN, value);
	},

	/**
	 * @return {Condition}
	 */
	andLessEqual : function(column, value) {
		return this.and(column, Condition.LESS_EQUAL, value);
	},

	/**
	 * @return {Condition}
	 */
	andNull : function(column) {
		return this.and(column, null);
	},

	/**
	 * @return {Condition}
	 */
	andNotNull : function(column) {
		return this.and(column, Condition.NOT_EQUAL, null);
	},

	/**
	 * @return {Condition}
	 */
	andBetween : function(column, from, to) {
		return this.and(column, Condition.BETWEEN, [from, to]);
	},

	/**
	 * @return {Condition}
	 */
	andBeginsWith : function(column, value) {
		return this.and(column, Condition.BEGINS_WITH, value);
	},

	/**
	 * @return {Condition}
	 */
	andEndsWith : function(column, value) {
		return this.and(column, Condition.ENDS_WITH, value);
	},

	/**
	 * @return {Condition}
	 */
	andContains : function(column, value) {
		return this.and(column, Condition.CONTAINS, value);
	},

	/**
	 * @return {Condition}
	 */
	orNot : function(column, value) {
		return this.or(column, Condition.NOT_EQUAL, value);
	},

	/**
	 * @return {Condition}
	 */
	orLike : function(column, value) {
		return this.or(column, Condition.LIKE, value);
	},

	/**
	 * @return {Condition}
	 */
	orNotLike : function(column, value) {
		return this.or(column, Condition.NOT_LIKE, value);
	},

	/**
	 * @return {Condition}
	 */
	orGreater : function(column, value) {
		return this.or(column, Condition.GREATER_THAN, value);
	},

	/**
	 * @return {Condition}
	 */
	orGreaterEqual : function(column, value) {
		return this.or(column, Condition.GREATER_EQUAL, value);
	},

	/**
	 * @return {Condition}
	 */
	orLess : function(column, value) {
		return this.or(column, Condition.LESS_THAN, value);
	},

	/**
	 * @return {Condition}
	 */
	orLessEqual : function(column, value) {
		return this.or(column, Condition.LESS_EQUAL, value);
	},

	/**
	 * @return {Condition}
	 */
	orNull : function(column) {
		return this.or(column, null);
	},

	/**
	 * @return {Condition}
	 */
	orNotNull : function(column) {
		return this.or(column, Condition.NOT_EQUAL, null);
	},

	/**
	 * @return {Condition}
	 */
	orBetween : function(column, from, to) {
		return this.or(column, Condition.BETWEEN, [from, to]);
	},

	/**
	 * @return {Condition}
	 */
	orBeginsWith : function(column, value) {
		return this.or(column, Condition.BEGINS_WITH, value);
	},

	/**
	 * @return {Condition}
	 */
	orEndsWith : function(column, value) {
		return this.or(column, Condition.ENDS_WITH, value);
	},

	/**
	 * @return {Condition}
	 */
	orContains : function(column, value) {
		return this.or(column, Condition.CONTAINS, value);
	},

	/**
	 * Builds and returns a string representation of this Condition
	 * @param {Adapter} conn
	 * @return {Query.Statement}
	 */
	getQueryStatement : function(conn) {

		if (0 === this._conds.length) {
			return null;
		}

		var statement = new Query.Statement(conn),
			string = '',
			x,
			cond,
			conds = this._conds,
			len = conds.length;

		for (x = 0; x < len; ++x) {
			cond = this._processCondition.apply(this, conds[x]);

			if (null === cond) {
				continue;
			}

			string += "\n\t";
			if (0 !== x) {
				string += ((1 === x && conds[0].type === 'OR') ? 'OR' : conds[x].type) + ' ';
			}
			string += cond._qString;
			statement.addParams(cond._params);
		}
		statement.setString(string);
		return statement;
	},

	getODataFilter: function() {

		if (0 === this._conds.length) {
			return null;
		}

		var str = '',
			x,
			cond,
			conds = this._conds,
			len = conds.length;

		for (x = 0; x < len; ++x) {
			cond = this._processODataCondition.apply(this, conds[x]);

			if (null === cond) {
				continue;
			}

			if (0 !== x) {
				str += ' ' + ((1 === x && conds[0].type === 'or') ? 'or' : (conds[x].type === 'OR' ? 'or' : 'and')) + ' ';
			}
			str += cond;
		}
		return str;
	},

	/**
	 * Builds and returns a string representation of this Condition
	 * @return {String}
	 */
	toString : function() {
		return this.getQueryStatement().toString();
	},

	getSimpleJSON: function() {
		var r = {};

		if (0 === this._conds.length) {
			return {};
		}

		var x,
			cond,
			conds = this._conds,
			len = conds.length;

		for (x = 0; x < len; ++x) {
			var cond = conds[x];
			if ('AND' !== cond.type) {
				throw new Error('OR conditions not supported.');
			}
			if (cond.length === 2) {
				r[cond[0]] = cond[1];
			} else if (cond[1] === Condition.EQUAL) {
				r[cond[0]] = cond[2];
			} else {
				throw new Error('Cannot export complex condition: "' + this._processCondition.apply(this, cond) + '"');
			}
		}
		return r;
	}
});

// Comparison types
Condition.EQUAL = '=';
Condition.NOT_EQUAL = '<>';
Condition.ALT_NOT_EQUAL = '!=';
Condition.GREATER_THAN = '>';
Condition.LESS_THAN = '<';
Condition.GREATER_EQUAL = '>=';
Condition.LESS_EQUAL = '<=';
Condition.LIKE = 'LIKE';
Condition.BEGINS_WITH = 'BEGINS_WITH';
Condition.ENDS_WITH = 'ENDS_WITH';
Condition.CONTAINS = 'CONTAINS';
Condition.NOT_LIKE = 'NOT LIKE';
Condition.IN = 'IN';
Condition.NOT_IN = 'NOT IN';
Condition.IS_NULL = 'IS NULL';
Condition.IS_NOT_NULL = 'IS NOT NULL';
Condition.BETWEEN = 'BETWEEN';
Condition.BINARY_AND = '&';
Condition.BINARY_OR = '|';

Condition.SQL = {
	operators: {
		eq: '=',
		ne: '<>',
		gt: '>',
		lt: '<',
		ge: '>=',
		le: '<=',
		'=': '=',
		'<>': '<>',
		'!=': '<>',
		'>': '>',
		'<': '<',
		'>=': '>=',
		'<=': '<=',
		'&': '&',
		'|': '|',
		startswith: 'BEGINS_WITH',
		BEGINS_WITH: 'BEGINS_WITH',
		endswith: 'ENDS_WITH',
		ENDS_WITH: 'BEGINS_WITH',
		substringof: 'CONTAINS',
		CONTAINS: 'CONTAINS',
		LIKE : 'LIKE',
		'NOT LIKE' : 'NOT LIKE',
		IN: 'IN',
		'NOT IN': 'NOT IN',
		'IS NULL': 'IS NULL',
		'IS NOT NULL': 'IS NOT NULL',
		BETWEEN: 'BETWEEN'
	}
};

Condition.OData = {
	operators: {
		eq: 'eq',
		ne: 'ne',
		gt: 'gt',
		lt: 'lt',
		ge: 'ge',
		le: 'le',
		'=': 'eq',
		'<>': 'ne',
		'!=': 'ne',
		'>': 'gt',
		'<': 'lt',
		'>=': 'ge',
		'<=': 'le',
		'&': '&',
		'|': '|'
	},
	functions: {
		startswith: 'startswith(?, @)',
		endswith: 'endswith(?, @)',
		substringof: 'substringof(@, ?)',
		BEGINS_WITH: 'startswith(?, @)',
		ENDS_WITH: 'endswith(?, @)',
		CONTAINS: 'substringof(@, ?)',
		LIKE: 'tolower(@) eq tolower(?)',
		'NOT LIKE': 'tolower(@) ne tolower(?)'
	}
};

/**
 * escape only the first parameter
 */
Condition.QUOTE_LEFT = 1;

/**
 * escape only the second param
 */
Condition.QUOTE_RIGHT = 2;

/**
 * escape both params
 */
Condition.QUOTE_BOTH = 3;

/**
 * escape no params
 */
Condition.QUOTE_NONE = 4;

dabl.Condition = Condition;

/* Query.js */
/**
 * Used to build query strings using OOP
 */
var Query = Condition.extend({

	_action : 'SELECT',

	/**
	 * @var array
	 */
	_columns : null,

	/**
	 * @var mixed
	 */
	_table : null,

	/**
	 * @var string
	 */
	_tableAlias : null,

	/**
	 * @var array
	 */
	_extraTables: null,

	/**
	 * @var Query.Join[]
	 */
	_joins: null,

	/**
	 * @var array
	 */
	_orders: null,
	/**
	 * @var array
	 */
	_groups: null,
	/**
	 * @var Condition
	 */
	_having : null,
	/**
	 * @var int
	 */
	_limit : null,
	/**
	 * @var int
	 */
	_offset : 0,
	/**
	 * @var bool
	 */
	_distinct : false,

	/**
	 * Creates new instance of Query, parameters will be passed to the
	 * setTable() method.
	 * @return self
	 * @param {String} table
	 * @param {String} alias
	 */
	init: function Query(table, alias) {
		this._super();

		this._columns = [];
		this._joins = [];
		this._orders = [];
		this._groups = [];

		if (!table) {
			return;
		}

		if (table.constructor === Object) {
			this.and(table);
		} else if (table) {
			this.setTable(table, alias);
		}
	},


	//	__clone : function() {
	//		if (this._having instanceof Condition) {
	//			this._having = clone this._having;
	//		}
	//		foreach (this._joins as key => join) {
	//			this._joins[key] = clone join;
	//		}
	//	},

	/**
	 * Specify whether to select only distinct rows
	 * @param {Boolean} bool
	 */
	setDistinct : function(bool) {
		if (typeof bool === 'undefined') {
			bool = true;
		}
		this._distinct = bool === true;
	},

	/**
	 * Sets the action of the query.  Should be SELECT, DELETE, or COUNT.
	 * @return {Query}
	 * @param {String} action
	 */
	setAction : function(action) {
		switch (action) {
			case 'SELECT':
			case 'DELETE':
			case 'COUNT':
				break;
			default:
				throw new Error('"' + action + '" is not an allowed Query action.');
				break;
		}

		this._action = action;
		return this;
	},

	/**
	 * Returns the action of the query.  Should be SELECT, DELETE, or COUNT.
	 * @return {String}
	 */
	getAction : function() {
		return this._action;
	},

	/**
	 * Add a column to the list of columns to select.  If unused, defaults to *.
	 *
	 * {@example libraries/dabl/database/query/Query_addColumn.php}
	 *
	 * @param {String} columnName
	 * @return {Query}
	 */
	addColumn : function(columnName) {
		this._columns.push(columnName);
		return this;
	},

	/**
	 * Set array of strings of columns to be selected
	 * @param columnsArray
	 * @return {Query}
	 */
	setColumns : function(columnsArray) {
		this._columns = columnsArray.slice(0);
		return this;
	},

	/**
	 * Alias of setColumns
	 * Set array of strings of columns to be selected
	 * @param columnsArray
	 * @return {Query}
	 */
	select : function(columnsArray) {
		return this.setColumns.apply(this, arguments);
	},

	/**
	 * Return array of columns to be selected
	 * @return {Array}
	 */
	getColumns : function() {
		return this._columns;
	},

	/**
	 * Set array of strings of groups to be selected
	 * @param groupsArray
	 * @return {Query}
	 */
	setGroups : function(groupsArray) {
		this._groups = groupsArray;
		return this;
	},

	/**
	 * Return array of groups to be selected
	 * @return {Array}
	 */
	getGroups : function() {
		return this._groups;
	},

	/**
	 * Sets the table to be queried. This can be a string table name
	 * or an instance of Query if you would like to nest queries.
	 * This function also supports arbitrary SQL.
	 *
	 * @param {String} table Name of the table to add, or sub-Query
	 * @param {String} alias Alias for the table
	 * @return {Query}
	 */
	setTable : function(table, alias) {
		if (table instanceof Query) {
			if (!alias) {
				throw new Error('The nested query must have an alias.');
			}
		}

		if (alias) {
			this.setAlias(alias);
		}

		this._table = table;
		return this;
	},

	from: function(table, alias) {
		return this.setTable.apply(this, arguments);
	},

	/**
	 * Returns a String representation of the table being queried,
	 * NOT including its alias.
	 *
	 * @return {String}
	 */
	getTable : function() {
		return this._table;
	},

	setAlias : function(alias) {
		this._tableAlias = alias;
		return this;
	},

	/**
	 * Returns a String of the alias of the table being queried,
	 * if present.
	 *
	 * @return {String}
	 */
	getAlias : function() {
		return this._tableAlias;
	},

	/**
	 * @param {String} tableName
	 * @param {String} alias
	 * @return {Query}
	 */
	addTable : function(tableName, alias) {
		if (tableName instanceof Query) {
			if (!alias) {
				throw new Error('The nested query must have an alias.');
			}
		} else if (typeof alias === 'undefined') {
			alias = tableName;
		}

		if (alias === this._tableAlias || alias === this._table) {
			throw new Error('The alias "' + alias + '" is is already in use');
		}

		if (this._extraTables === null) {
			this._extraTables = {};
		}
		this._extraTables[alias] = tableName;
		return this;
	},

	/**
	 * Add a JOIN to the query.
	 *
	 * @todo Support the ON clause being NULL correctly
	 * @param {String} tableOrColumn Table to join on
	 * @param {String} onClauseOrColumn ON clause to join with
	 * @param {String} joinType Type of JOIN to perform
	 * @return {Query}
	 */
	addJoin : function(tableOrColumn, onClauseOrColumn, joinType) {
		if (tableOrColumn instanceof Query.Join) {
			this._joins.push(tableOrColumn);
			return this;
		}

		if (null === onClauseOrColumn) {
			if (joinType === Query.JOIN || joinType === Query.INNER_JOIN) {
				this.addTable(tableOrColumn);
				return this;
			}
			onClauseOrColumn = '1 = 1';
		}

		this._joins.push(new Query.Join(tableOrColumn, onClauseOrColumn, joinType));
		return this;
	},

	/**
	 * Alias of {@link addJoin()}.
	 * @return {Query}
	 */
	join : function(tableOrColumn, onClauseOrColumn, joinType) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, joinType);
	},

	/**
	 * @return {Query}
	 */
	innerJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.INNER_JOIN);
	},

	/**
	 * @return {Query}
	 */
	leftJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.LEFT_JOIN);
	},

	/**
	 * @return {Query}
	 */
	rightJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.RIGHT_JOIN);
	},

	/**
	 * @return {Query}
	 */
	outerJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.OUTER_JOIN);
	},

	/**
	 * @return {Array}
	 */
	getJoins : function() {
		return this._joins;
	},

	/**
	 * @return {Query}
	 */
	setJoins : function(joins) {
		this._joins = joins;
		return this;
	},

	/**
	 * Adds a clolumn to GROUP BY
	 * @return {Query}
	 * @param {String} column
	 */
	groupBy : function(column) {
		this._groups.push(column);
		return this;
	},

	/**
	 * Provide the Condition object to generate the HAVING clause of the query
	 * @return {Query}
	 * @param {Condition} condition
	 */
	setHaving : function(condition) {
		if (null !== condition && !(condition instanceof Condition)) {
			throw new Error('setHaving must be given an instance of Condition');
		}
		this._having = condition;
		return this;
	},

	/**
	 * Returns the Condition object that generates the HAVING clause of the query
	 * @return {Condition}
	 */
	getHaving : function() {
		return this._having;
	},

	/**
	 * Adds a column to ORDER BY in the form of "COLUMN DIRECTION"
	 * @return {Query}
	 * @param {String} column
	 * @param {String} dir
	 */
	orderBy : function(column, dir) {
		this._orders.push(arguments);
		return this;
	},

	/**
	 * Sets the limit of rows that can be returned
	 * @return {Query}
	 * @param {Number} limit
	 * @param {Number} offset
	 */
	limit : function(limit, offset) {
		limit = parseInt(limit);
		if (isNaN(limit)) {
			throw new Error('Not a number');
		}
		this._limit = limit;

		if (arguments.length > 1) {
			this.setOffset(offset);
		}
		return this;
	},

	/**
	 * Convenience function for limit
	 * Sets the limit of rows that can be returned
	 * @return {Query}
	 * @param {Number} limit
	 * @param {Number} offset
	 */
	top : function(limit, offset) {
		return this.limit.apply(this, arguments);
	},

	/**
	 * Returns the LIMIT integer for this Query, if it has one
	 * @return {Number}
	 */
	getLimit : function() {
		return this._limit;
	},

	/**
	 * Sets the offset for the rows returned.
	 * @return {Query}
	 * @param {Number} offset
	 */
	offset : function(offset) {
		offset = parseInt(offset);
		if (isNaN(offset)) {
			throw new Error('Not a number.');
		}
		this._offset = offset;
		return this;
	},

	/**
	 * Convenience function for offset
	 * Sets the offset for the rows returned.
	 * @return {Query}
	 * @param {Number} offset
	 */
	skip : function(offset) {
		return this.offset.apply(this, arguments);
	},

	/**
	 * Sets the offset for the rows returned.  Used to build
	 * the LIMIT part of the query.
	 * @param {Number} page
	 * @return {Query}
	 */
	setPage : function(page) {
		page = parseInt(page);
		if (isNaN(page)) {
			throw new Error('Not a number.');
		}
		if (page < 2) {
			this._offset = null;
			return this;
		}
		if (!this._limit) {
			throw new Error('Cannot set page without first setting limit.');
		}
		this._offset = page * this._limit - this._limit;
		return this;
	},

	/**
	 * Returns true if this Query uses aggregate functions in either a GROUP BY clause or in the
	 * select columns
	 * @return {Boolean}
	 */
	hasAggregates : function() {
		if (this._groups.length !== 0) {
			return true;
		}
		for (var c = 0, clen = this._columns.length; c < clen; ++c) {
			if (this._columns[c].indexOf('(') !== -1) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Returns true if this Query requires a complex count
	 * @return {Boolean}
	 */
	needsComplexCount : function() {
		return this.hasAggregates()
		|| null !== this._having
		|| this._distinct;
	},

	/**
	 * Builds and returns the query string
	 *
	 * @param {SQLAdapter} adapter
	 * @return {Query.Statement}
	 */
	getQuery : function(adapter) {
		if (typeof adapter === 'undefined') {
			adapter = new SQLAdapter;
		}

		// the Query.Statement for the Query
		var statement = new Query.Statement(adapter),
			queryS,
			columnsStatement,
			tableStatement,
			x,
			len,
			join,
			joinStatement,
			whereStatement,
			havingStatement;

		// the string statement will use
		queryS = '';

		switch (this._action) {
			default:
			case Query.ACTION_COUNT:
			case Query.ACTION_SELECT:
				columnsStatement = this.getColumnsClause(adapter);
				statement.addParams(columnsStatement._params);
				queryS += 'SELECT ' + columnsStatement._qString;
				break;
			case Query.ACTION_DELETE:
				queryS += 'DELETE';
				break;
		}

		tableStatement = this.getTablesClause(adapter);
		statement.addParams(tableStatement._params);
		queryS += "\nFROM " + tableStatement._qString;

		if (this._joins.length !== 0) {
			for (x = 0, len = this._joins.length; x < len; ++x) {
				join = this._joins[x],
				joinStatement = join.getQueryStatement(adapter);
				queryS += "\n\t" + joinStatement._qString;
				statement.addParams(joinStatement._params);
			}
		}

		whereStatement = this.getWhereClause();

		if (null !== whereStatement) {
			queryS += "\nWHERE " + whereStatement._qString;
			statement.addParams(whereStatement._params);
		}

		if (this._groups.length !== 0) {
			queryS += "\nGROUP BY " + this._groups.join(', ');
		}

		if (null !== this.getHaving()) {
			havingStatement = this.getHaving().getQueryStatement();
			if (havingStatement) {
				queryS += "\nHAVING " + havingStatement._qString;
				statement.addParams(havingStatement._params);
			}
		}

		if (this._action !== Query.ACTION_COUNT && this._orders.length !== 0) {
			queryS += "\nORDER BY ";

			for (x = 0, len = this._orders.length; x < len; ++x) {
				var column = this._orders[x][0];
				var dir = this._orders[x][1];
				if (null !== dir && typeof dir !== 'undefined') {
					column = column + ' ' + dir;
				}
				if (0 !== x) {
					queryS += ', ';
				}
				queryS += column;
			}
		}

		if (null !== this._limit) {
			if (adapter) {
				queryS = adapter.applyLimit(queryS, this._offset, this._limit);
			} else {
				queryS += "\nLIMIT " + (this._offset ? this._offset + ', ' : '') + this._limit;
			}
		}

		if (this._action === Query.ACTION_COUNT && this.needsComplexCount()) {
			queryS = "SELECT count(0)\nFROM (" + queryS + ") a";
		}

		statement.setString(queryS);
		return statement;
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @param {SQLAdapter} adapter
	 * @return {Query.Statement}
	 */
	getTablesClause : function(adapter) {

		var table = this._table,
			statement,
			alias,
			tableStatement,
			tAlias,
			tableString,
			extraTable,
			extraTableStatement,
			extraTableString;

		if (!table) {
			throw new Error('No table specified.');
		}

		statement = new Query.Statement(adapter);
		alias = this._tableAlias;

		// if table is a Query, get its Query.Statement
		if (table instanceof Query) {
			tableStatement = table.getQuery(adapter),
			tableString = '(' + tableStatement._qString + ')';
		} else {
			tableStatement = null;
			tableString = table;
		}

		switch (this._action) {
			case Query.ACTION_COUNT:
			case Query.ACTION_SELECT:
				// setup identifiers for table_string
				if (null !== tableStatement) {
					statement.addParams(tableStatement._params);
				}

				// append alias, if it's not empty
				if (alias) {
					tableString = tableString + ' AS ' + alias;
				}

				// setup identifiers for any additional tables
				if (this._extraTables !== null) {
					for (tAlias in this._extraTables) {
						extraTable = this._extraTables[tAlias];
						if (extraTable instanceof Query) {
							extraTableStatement = extraTable.getQuery(adapter),
							extraTableString = '(' + extraTableStatement._qString + ') AS ' + tAlias;
							statement.addParams(extraTableStatement._params);
						} else {
							extraTableString = extraTable;
							if (tAlias !== extraTable) {
								extraTableString = extraTableString + ' AS ' + tAlias;
							}
						}
						tableString = tableString + ', ' + extraTableString;
					}
				}
				statement.setString(tableString);
				break;
			case Query.ACTION_DELETE:
				if (null !== tableStatement) {
					statement.addParams(tableStatement._params);
				}

				// append alias, if it's not empty
				if (alias) {
					tableString = tableString + ' AS ' + alias;
				}
				statement.setString(tableString);
				break;
			default:
				break;
		}
		return statement;
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @param {SQLAdapter} adapter
	 * @return {Query.Statement}
	 */
	getColumnsClause : function(adapter) {
		var table = this._table,
			column,
			statement = new Query.Statement(adapter),
			alias = this._tableAlias,
			action = this._action,
			x,
			len,
			columnsToUse,
			columnsString;

		if (action === Query.ACTION_DELETE) {
			return statement;
		}

		if (!table) {
			throw new Error('No table specified.');
		}

		if (action === Query.ACTION_COUNT) {
			if (!this.needsComplexCount()) {
				statement.setString('count(0)');
				return statement;
			}

			if (this._groups.length !== 0) {
				statement.setString(this._groups.join(', '));
				return statement;
			}

			if (!this._distinct && null === this.getHaving() && this._columns.length !== 0) {
				columnsToUse = [];
				for (x = 0, len = this._columns.length; x < len; ++x) {
					column = this._columns[x];
					if (column.indexOf('(') === -1) {
						continue;
					}
					columnsToUse.push(column);
				}
				if (columnsToUse.length !== 0) {
					statement.setString(columnsToUse.join(', '));
					return statement;
				}
			}
		}

		// setup columns_string
		if (this._columns.length !== 0) {
			columnsString = this._columns.join(', ');
		} else if (alias) {
			// default to selecting only columns from the target table
			columnsString = alias + '.*';
		} else {
			// default to selecting only columns from the target table
			columnsString = table + '.*';
		}

		if (this._distinct) {
			columnsString = 'DISTINCT ' + columnsString;
		}

		statement.setString(columnsString);
		return statement;
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @param {SQLAdapter} adapter
	 * @return {Query.Statement}
	 */
	getWhereClause : function(adapter) {
		return this.getQueryStatement(adapter);
	},

	/**
	 * @return {String}
	 */
	toString : function() {
		if (!this._table)
			this.setTable('{UNSPECIFIED-TABLE}');
		return this.getQuery().toString();
	},

	/**
	 * @param {SQLAdapter} adapter
	 * @returns {Query.Statement}
	 */
	getCountQuery : function(adapter) {
		if (!this._table) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_COUNT);
		return this.getQuery(adapter);
	},

	/**
	 * @param {SQLAdapter} adapter
	 * @returns {Query.Statement}
	 */
	getDeleteQuery : function(adapter) {
		if (!this._table) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_DELETE);
		return this.getQuery(adapter);
	},

	/**
	 * @param {SQLAdapter} adapter
	 * @returns {Query.Statement}
	 */
	getSelectQuery : function(adapter) {
		if (!this._table) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_SELECT);
		return this.getQuery(adapter);
	},

	getODataQuery: function() {
		if (this._joins && this._joins.length !== 0) {
			throw new Error('JOINS cannot be exported.');
		}
		if (this._extraTables && this._extraTables.length !== 0) {
			throw new Error('Extra tables cannot be exported.');
		}
		if (this._having && this._having.length !== 0) {
			throw new Error('Having cannot be exported.');
		}
		if (this._groups && this._groups.length !== 0) {
			throw new Error('Grouping cannot be exported.');
		}

		var r = {};

		if (this._columns.length !== 0) {
			r.$select = this._columns.join(',');
		}

		var filter = this.getODataFilter();
		if (filter) {
			r.$filter = filter;
		}

		if (this._limit) {
			r.$top = this._limit;
			if (this._offset) {
				r.$skip = this._offset;
			}
		}

		if (this._orders && this._orders.length !== 0) {
			r.$orderby = this._orders[0][0];
			if (this._orders[0][1] === Query.DESC) {
				r.$orderby += ' desc';
			}
		}

		return r;
	},

	getSimpleJSON: function() {
		if (this._joins && this._joins.length !== 0) {
			throw new Error('JOINS cannot be exported.');
		}
		if (this._extraTables && this._extraTables.length !== 0) {
			throw new Error('Extra tables cannot be exported.');
		}
		if (this._having && this._having.length !== 0) {
			throw new Error('Having cannot be exported.');
		}
		if (this._groups && this._groups.length !== 0) {
			throw new Error('Grouping cannot be exported.');
		}

		var r = this._super();

		if (this._limit) {
			r.limit = this._limit;
			if (this._offset) {
				r.offset = this._offset;
				r.page = Math.floor(this._offset / this._limit) + 1;
			}
		}

		if (this._orders && this._orders.length !== 0) {
			r.order_by = this._orders[0][0];
			if (this._orders[0][1] === Query.DESC) {
				r.dir = Query.DESC;
			}
		}

		return r;
	}
});

Query.ACTION_COUNT = 'COUNT';
Query.ACTION_DELETE = 'DELETE';
Query.ACTION_SELECT = 'SELECT';

// JOIN TYPES
Query.JOIN = 'JOIN';
Query.LEFT_JOIN = 'LEFT JOIN';
Query.RIGHT_JOIN = 'RIGHT JOIN';
Query.INNER_JOIN = 'INNER JOIN';
Query.OUTER_JOIN = 'OUTER JOIN';

// 'Order by' qualifiers
Query.ASC = 'ASC';
Query.DESC = 'DESC';

dabl.Query = Query;

/* QueryJoin.js */
var isIdent = /^\w+\.\w+$/;

var Join = function Join(tableOrColumn, onClauseOrColumn, joinType) {
	if (arguments.length < 3) {
		joinType = Query.JOIN;
	}

	// check for Propel type join: table.column, table.column
	if (
		!(tableOrColumn instanceof Query)
		&& !(onClauseOrColumn instanceof Condition)
		&& isIdent.test(onClauseOrColumn)
		&& isIdent.test(tableOrColumn)
	) {
		this._isLikePropel = true;
		this._leftColumn = tableOrColumn;
		this._rightColumn = onClauseOrColumn;
		this._table = onClauseOrColumn.substring(0, onClauseOrColumn.indexOf('.'));
		this._joinType = joinType;
		return;
	}

	this.setTable(tableOrColumn)
	.setOnClause(onClauseOrColumn)
	.setJoinType(joinType);
};

Join.prototype = {

	/**
	 * @var mixed
	 */
	_table : null,

	/**
	 * @var string
	 */
	_alias : null,

	/**
	 * @var mixed
	 */
	_onClause : null,

	/**
	 * @var bool
	 */
	_isLikePropel : false,

	/**
	 * @var string
	 */
	_leftColumn : null,

	/**
	 * @var string
	 */
	_rightColumn : null,

	/**
	 * @var string
	 */
	_joinType : Query.JOIN,

	/**
	 * @return {String}
	 */
	toString : function() {
		if (!this.getTable()) {
			this.setTable('{UNSPECIFIED-TABLE}');
		}
		return this.getQueryStatement().toString();
	},

	/**
	 * @param {String} tableName
	 * @return {Query.Join}
	 */
	setTable : function(tableName) {
		var space = tableName.lastIndexOf(' '),
			as = space === -1 ? -1 : tableName.toUpperCase().lastIndexOf(' AS ');

		if (as !== space - 3) {
			as = -1;
		}
		if (space !== -1) {
			this.setAlias(tableName.substr(space + 1));
			tableName = tableName.substring(0, as === -1 ? space : as);
		}
		this._table = tableName;
		return this;
	},

	/**
	 * @param {String} alias
	 * @return {Query.Join}
	 */
	setAlias : function(alias) {
		this._alias = alias;
		return this;
	},

	/**
	 * @param {Condition} onClause
	 * @return {Query.Join}
	 */
	setOnClause : function(onClause) {
		this._isLikePropel = false;
		this._onClause = onClause;
		return this;
	},

	/**
	 * @param {String} joinType
	 * @return {Query.Join}
	 */
	setJoinType : function(joinType) {
		this._joinType = joinType;
		return this;
	},

	/**
	 * @param {Adapter} conn
	 * @return {Query.Statement}
	 */
	getQueryStatement : function(conn) {
		var statement,
			table = this._table,
			onClause = this._onClause,
			joinType = this._joinType,
			alias = this._alias,
			onClauseStatement;

		if (table instanceof Query) {
			statement = table.getQuery(conn);
			table = '(' + statement._qString + ')';
			statement.setString('');
		} else {
			statement = new Query.Statement(conn);
		}

		if (alias) {
			table += ' AS ' + alias;
		}

		if (this._isLikePropel) {
			onClause = this._leftColumn + ' = ' + this._rightColumn;
		} else if (null === onClause) {
			onClause = '1 = 1';
		} else if (onClause instanceof Condition) {
			onClauseStatement = onClause.getQueryStatement();
			onClause = onClauseStatement._qString;
			statement.addParams(onClauseStatement.getParams());
		}

		if ('' !== onClause) {
			onClause = 'ON (' + onClause + ')';
		}

		statement.setString(joinType + ' ' + table + ' ' + onClause);
		return statement;
	},

	/**
	 * @return {String|Query}
	 */
	getTable : function() {
		return this._table;
	},

	/**
	 * @return {String}
	 */
	getAlias : function() {
		return this._alias;
	},

	/**
	 * @return {String|Condition}
	 */
	getOnClause : function() {
		if (this._isLikePropel) {
			return this._leftColumn + ' = ' + this._rightColumn;
		}
		return this._onClause;
	},

	/**
	 * @return {String}
	 */
	getJoinType : function() {
		return this._joinType;
	}

};

dabl.Query.Join = Join;

/* QueryStatement.js */
var Statement = function Statement(conn) {
	this._params = [];
	if (conn) {
		this._conn = conn;
	}
};

/**
 * Emulates a prepared statement.  Should only be used as a last resort.
 * @param string
 * @param params
 * @param conn
 * @return {String}
 */
Statement.embedParams = function(string, params, conn) {
	if (conn) {
		params = conn.prepareInput(params);
	}

	var p = '?';

	if (string.split(p).length - 1 !== params.length) {
		throw new Error('The number of occurances of ' + p + ' do not match the number of _params.');
	}

	if (params.length === 0) {
		return string;
	}

	var currentIndex = string.length,
		pLength = p.length,
		x,
		identifier;

	for (x = params.length - 1; x >= 0; --x) {
		identifier = params[x];
		currentIndex = string.lastIndexOf(p, currentIndex);
		if (currentIndex === -1) {
			throw new Error('The number of occurances of ' + p + ' do not match the number of _params.');
		}
		string = string.substring(0, currentIndex) + identifier + string.substr(currentIndex + pLength);
	}

	return string;
};

Statement.prototype = {

	/**
	 * @var string
	 */
	_qString : '',
	/**
	 * @var array
	 */
	_params : null,
	/**
	 * @var Adapter
	 */
	_conn : null,

	/**
	 * Sets the PDO connection to be used for preparing and
	 * executing the query
	 * @param {Adapter} conn
	 */
	setConnection : function(conn) {
		this._conn = conn;
	},

	/**
	 * @return {Adapter}
	 */
	getConnection : function() {
		return this._conn;
	},

	/**
	 * Sets the SQL string to be used in a query
	 * @param {String} string
	 */
	setString : function(string) {
		this._qString = string;
	},

	/**
	 * @return {String}
	 */
	getString : function() {
		return this._qString;
	},

	/**
	 * Merges given array into _params
	 * @param {Array} params
	 */
	addParams : function(params) {
		this._params = this._params.concat(params);
	},

	/**
	 * Replaces params with given array
	 * @param {Array} params
	 */
	setParams : function(params) {
		this._params = params.slice(0);
	},

	/**
	 * Adds given param to param array
	 * @param {mixed} param
	 */
	addParam : function(param) {
		this._params.push(param);
	},

	/**
	 * @return {Array}
	 */
	getParams : function() {
		return this._params.slice(0);
	},

	/**
	 * @return {String}
	 */
	toString : function() {
		return Query.Statement.embedParams(this._qString, this._params.slice(0), this._conn);
	}
};

dabl.Query.Statement = Statement;

/* Adapter.js */
var Adapter = Class.extend({

	_cache: null,

	init: function Adapter() {
		this._cache = {};
	},

	/**
	 * @param {String} table
	 * @param {mixed} key
	 * @param {Model} value
	 * @return {Model|Adapter}
	 */
	cache: function(table, key, value) {
		if (!this._cache[table]) {
			this._cache[table] = {};
		}
		if (arguments.length < 3) {
			if (!this._cache[table][key]) {
				return null;
			}
			return this._cache[table][key];
		}
		this._cache[table][key] = value;
		return this;
	},

	/**
	 * @param {String} table
	 */
	emptyCache: function(table) {
		delete this._cache[table];
	},

	/**
	 * @param {Date|String} value
	 * @return {String}
	 */
	formatDate: function(value, fieldType) {
		if (fieldType && fieldType === Model.FIELD_TYPE_TIMESTAMP) {
			return this.formatDateTime(value);
		}
		if (!(value instanceof Date)) {
			value = constructDate(value);
		}
		return value.getUTCFullYear() + '-' + sPad(value.getUTCMonth() + 1) + '-' + sPad(value.getUTCDate());
	},

	/**
	 * @param {Date|String} value
	 * @return {String}
	 */
	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = constructDate(value);
		}
		return value.getFullYear() + '-' + sPad(value.getMonth() + 1) + '-' + sPad(value.getDate()) + ' ' + sPad(value.getHours()) + ':' + sPad(value.getMinutes()) + ':' + sPad(value.getSeconds());
	},

	/**
	 * @param {Class} model class
	 */
	findQuery: function(model) {
		var a = Array.prototype.slice.call(arguments),
			q = new Query().setTable(model.getTableName()),
			key = model.getKey();
		a.shift();
		var len = a.length;

		if (len === 0) {
			return q;
		}
		if (len === 1) {
			if (typeof a[0] === 'object') {
				if (a[0] instanceof Query) {
					if (!a[0].getTable()) {
						a[0].setTable(model.getTableName());
					}
					return a[0];
				} else {
					q.and(a[0]);
				}
			} else if (key) {
				var idNum = parseInt(a[0], 10);
				if (isNaN(idNum)) {
					q.and(key, a[0]);
				} else {
					q.and(key, idNum);
				}
			}
		} else if ((len === 2 || len === 3 || len === 4) && typeof a[0] === 'string') {
			q.and.apply(q, a);
		} else {
			throw new Error('Unknown arguments for find: (' + a.join(', ') + ')');
		}
		return q;
	},

	/**
	 * @param {Class} model class
	 */
	find: function(model){
		throw new Error('find not implemented for this adapter');
	},

	/**
	 * @param {Class} model class
	 */
	findAll: function(model) {
		throw new Error('findAll not implemented for this adapter');
	},

	/**
	 * @param {Class} model class
	 * @param {Query} q
	 */
	countAll: function(model, q) {
		throw new Error('countAll not implemented for this adapter');
	},

	/**
	 * @param {Class} model class
	 * @param {Query} q
	 */
	removeAll: function(model, q) {
		throw new Error('removeAll not implemented for this adapter');
	},

	/**
	 * @param {Model} instance
	 */
	insert: function(instance) {
		throw new Error('insert not implemented for this adapter');
	},

	/**
	 * @param {Model} instance
	 */
	update: function(instance) {
		throw new Error('update not implemented for this adapter');
	},

	/**
	 * @param {Model} instance
	 */
	remove: function(instance) {
		throw new Error('remove not implemented for this adapter');
	}
});

dabl.Adapter = Adapter;


/* RESTAdapter.js */
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
	this.template = template;
	this.defaults = defaults || {};
	var urlParams = this.urlParams = {},
		parts = template.split(/\W/);
	for (var i = 0, l = parts.length; i < l; ++i) {
		var param = parts[i];
		if (param && template.match(new RegExp("[^\\\\]:" + param + "(\\W|$)"))) {
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
			val = typeof params[urlParam] !== 'undefined' || params.hasOwnProperty(urlParam) ? params[urlParam] : self.defaults[urlParam];
			if (typeof val !== 'undefined' && val !== null) {
				encodedVal = encodeUriSegment(val);
				url = url.replace(new RegExp(":" + urlParam + "(\\W)", "g"), encodedVal + "$1");
			} else {
				url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W)", "g"), function(match, leadingSlashes, tail) {
					if (tail.charAt(0) === '/') {
						return tail;
					} else {
						return leadingSlashes + tail;
					}
				});
			}
		}
		return url;
	},

	urlGet: function(params) {
		var url = this.url(params);

		params = params || {};

		url = url.replace(/\/?#$/, '');
		var query = [];
		for (var key in params) {
			if (!this.urlParams[key]) {
				query.push(encodeUriQuery(key) + '=' + encodeUriQuery(params[key]));
			}
		}
		query.sort();
		url = url.replace(/\/*$/, '');
		return url + (query.length ? '?' + query.join('&') : '');
	}
};

var RESTAdapter = Adapter.extend({

	_routes: {},

	_urlBase: '',

	init: function RESTAdaper(urlBase) {
		this._super();
		if (urlBase) {
			this._urlBase = urlBase;
		}
	},

	_getRoute: function(url) {
		if (!url) {
			throw new Error('Cannot create RESTful route for empty url.');
		}
		if (this._routes[url]) {
			return this._routes[url];
		}
		return this._routes[url] = new Route(this._urlBase + url);
	},

	_getErrorCallback: function(def) {
		return function(jqXHR, textStatus, errorThrown) {
			var data;
			try {
				if (jqXHR.responseText) {
					data = JSON.parse(jqXHR.responseText);
				} else {
					data = null;
				}
			} catch (e) {
				data = null;
			};
			var error = errorThrown || 'Request failed.';
			if (data) {
				if (data.error) {
					error = data.error;
				} else if (data.errors) {
					error = data.errors.join('\n');
				}
			}
			def.reject(error, data, jqXHR);
		};
	},

	_isValidResponseObject: function(data, model) {
		var pk = model.getKey();
		if (
			typeof data !== 'object'
			|| data.error
			|| (data.errors && data.errors.length !== 0)
			|| (pk && typeof data[pk] === 'undefined')
		) {
			return false;
		}
		return true;
	},

	_save: function(instance, method) {
		var fieldName,
			model = instance.constructor,
			value,
			route = this._getRoute(model._url),
			data = {},
			pk = model.getKey(),
			self = this,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		for (fieldName in model._fields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			data[fieldName] = value;
		}

		jQuery.ajax({
			url: route.url(data),
			type: 'POST',
			data: JSON.stringify(data),
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			headers: {
				'X-HTTP-Method-Override': method
			},
			success: function(data, textStatus, jqXHR) {
				if (!self._isValidResponseObject(data, model)) {
					error(jqXHR, textStatus, 'Invalid response.');
					return;
				}
				instance
					.fromJSON(data)
					.resetModified()
					.setNew(false);

				if (pk && typeof instance[pk] !== 'undefined') {
					self.cache(model._table, instance[pk], instance);
				}
				def.resolve(instance);
			},
			error: error
		});
		return def.promise();
	},

	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = constructDate(value);
		}
		var offset = -value.getTimezoneOffset() / 60;
		offset = (offset > 0 ? '+' : '-') + sPad(Math.abs(offset));

		return value.getFullYear() + '-' + sPad(value.getMonth() + 1) + '-' + sPad(value.getDate())
			+ ' ' + sPad(value.getHours())
			+ ':' + sPad(value.getMinutes())
			+ ':' + sPad(value.getSeconds())
			+ ' ' + offset + '00';
	},

	insert: function(instance) {
		return this._save(instance, 'POST');
	},

	update: function(instance) {
		if (!instance.isModified()) {
			var def = dabl.Deferred();
			def.resolve(instance);
			return def.promise();
		}

		return this._save(instance, 'PUT');
	},

	remove: function(instance) {
		var model = instance.constructor,
			route = this._getRoute(model._url),
			pk = model.getKey(),
			self = this,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		jQuery.ajax({
			url: route.url(instance.toJSON()),
			type: 'POST',
			data: {},
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			headers: {
				'X-HTTP-Method-Override': 'DELETE'
			},
			success: function(data, textStatus, jqXHR) {
				if (data && (data.error || (data.errors && data.errors.length))) {
					error(jqXHR, textStatus, 'Invalid response.');
					return;
				}
				if (pk && instance[pk]) {
					self.cache(model._table, instance[pk], null);
				}
				def.resolve(instance);
			},
			error: error
		});

		return def.promise();
	},

	find: function(model, id) {
		var route = this._getRoute(model._url),
			data = {},
			instance = null,
			q,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def),
			self = this,
			pk = model.getKey();

		if (pk && arguments.length === 2 && (typeof id === 'number' || typeof id === 'string')) {
			// look for it in the cache
			instance = this.cache(model._table, id);
			if (instance) {
				def.resolve(instance);
				return def.promise();
			}
			data = {};
			data[pk] = id;
		} else {
			q = this.findQuery.apply(this, arguments);
			q.limit(1);
			data = q.getSimpleJSON();
		}

		jQuery.get(route.urlGet(data), function(data, textStatus, jqXHR) {
			if (!self._isValidResponseObject(data, model)) {
				error(jqXHR, textStatus, 'Invalid response.');
				return;
			}
			if (data instanceof Array) {
				data = data.shift();
			}
			def.resolve(model.inflate(data));
		})
		.fail(error);
		return def.promise();
	},

	findAll: function(model) {
		var q = this.findQuery
			.apply(this, arguments),
			route = this._getRoute(model._url),
			data = q.getSimpleJSON(),
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		jQuery.get(route.urlGet(data), function(data, textStatus, jqXHR) {
			if (typeof data !== 'object' || data.error || (data.errors && data.errors.length)) {
				error(jqXHR, textStatus, 'Invalid response.');
				return;
			}
			if (!(data instanceof Array)) {
				data = [data];
			}
			def.resolve(model.inflateArray(data));
		})
		.fail(error);
		return def.promise();
	}
});

dabl.RESTAdapter = RESTAdapter;


/* RESTAdapterAngular.js */
var AngularRESTAdapter = RESTAdapter.extend({

	$http: null,

	init: function(urlBase, $http) {
		this._super(urlBase);
		this.$http = $http;
	},

	_getErrorCallback: function(def) {
		return function(data, status, headers, config){
			var error = 'Request failed.';
			if (data) {
				if (data.error) {
					error = data.error;
				} else if (data.errors) {
					error = data.errors.join('\n');
				}
			}
			def.reject(error, data, config);
		};
	},

	_save: function(instance, method) {
		var fieldName,
			model = instance.constructor,
			value,
			route = this._getRoute(model._url),
			data = {},
			pk = model.getKey(),
			self = this,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		for (fieldName in model._fields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			data[fieldName] = value;
		}

		this.$http({
			url: route.url(data),
			method: 'POST',
			data: data,
			headers: {
				'X-HTTP-Method-Override': method
			}
		})
		.success(function(data, status, headers, config) {
			if (!self._isValidResponseObject(data, model)) {
				error.apply(this, arguments);
				return;
			}
			instance
				.fromJSON(data)
				.resetModified()
				.setNew(false);

			if (pk && typeof instance[pk] !== 'undefined') {
				self.cache(model._table, instance[pk], instance);
			}
			def.resolve(instance);
		})
		.error(error);
		return def.promise();
	},

	remove: function(instance) {
		var model = instance.constructor,
			route = this._getRoute(model._url),
			pk = model.getKey(),
			self = this,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		this.$http({
			url: route.url(instance.toJSON()),
			method: 'POST',
			data: {},
			headers: {
				'X-HTTP-Method-Override': 'DELETE'
			}
		})
		.success(function(data, status, headers, config) {
			if (data && (data.error || (data.errors && data.errors.length))) {
				error.apply(this, arguments);
				return;
			}
			if (pk && instance[pk]) {
				self.cache(model._table, instance[pk], null);
			}
			def.resolve(instance);
		})
		.error(error);

		return def.promise();
	},

	find: function(model, id) {
		var route = this._getRoute(model._url),
			data = {},
			instance = null,
			q,
			def = dabl.Deferred(),
			error = this._getErrorCallback(def),
			self = this,
			pk = model.getKey();

		if (pk && arguments.length === 2 && (typeof id === 'number' || typeof id === 'string')) {
			// look for it in the cache
			instance = this.cache(model._table, id);
			if (instance) {
				def.resolve(instance);
				return def.promise();
			}
			data = {};
			data[pk] = id;
		} else {
			q = this.findQuery.apply(this, arguments);
			q.limit(1);
			data = q.getSimpleJSON();
		}

		this.$http
		.get(route.urlGet(data))
		.success(function(data, status, headers, config) {
			if (!self._isValidResponseObject(data, model)) {
				error.apply(this, arguments);
				return;
			}
			if (data instanceof Array) {
				data = data.shift();
			}
			def.resolve(model.inflate(data));
		})
		.error(error);
		return def.promise();
	},

	findAll: function(model) {
		var q = this.findQuery
			.apply(this, arguments),
			route = this._getRoute(model._url),
			data = q.getSimpleJSON(),
			def = dabl.Deferred(),
			error = this._getErrorCallback(def);

		this.$http
		.get(route.urlGet(data))
		.success(function(data, status, headers, config) {
			if (typeof data !== 'object' || data.error || (data.errors && data.errors.length)) {
				error.apply(this, arguments);
				return;
			}
			if (!(data instanceof Array)) {
				data = [data];
			}
			def.resolve(model.inflateArray(data));
		})
		.error(error);
		return def.promise();
	}
});

dabl.AngularRESTAdapter = AngularRESTAdapter;

/* SQLAdapter.js */
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

		if (sql instanceof Query.Statement) {
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
		return model.inflatArray(result);
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
	removeAll: function(model, q) {
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
			statement = new Query.Statement(this),
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
			pk = model.getKey(),
			fields = [],
			values = [],
			placeholders = [],
			statement = new Query.Statement(this),
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
			pks = model.getKeys(),
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
				throw new Error('Cannot remove using NULL primary key.');
			}
			q.and(pk, pkVal);
		}

		var count = this.updateAll(model, data, q);
		instance.resetModified();

		return count;
	},

	remove: function(instance) {
		var model = instance.constructor,
			pks = model.getKeys(),
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
				throw new Error('Cannot remove using NULL primary key.');
			}
			q.and(pk, pkVal);
		}

		return this.removeAll(model, q);
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
			table.fromJSON({
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
		schemaTable.remove();
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
//				var sql = 'INSERT INTO ' + tableName + ' (' + dataHash.getKeys().toString() + ') VALUES(' + dataHash.toJSON().toString() + ')';
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
		if (typeof console !== 'undefined'){
			console.log(sql, params);
		}

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

dabl.SQLAdapter = SQLAdapter;
})(dabl);

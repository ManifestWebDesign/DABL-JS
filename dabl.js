
/* 00-Deferred.js */
// https://github.com/warpdesign/Standalone-Deferred
(function(global, $) {
	if ($ && $.Deferred) {
		global.Deferred = jQuery.Deferred;
		return;
	}

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

	global.Deferred = D;
})(window, jQuery);

/* 01-Class.js */
/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
(function(){
	var initializing = false, fnTest = /xyz/.test(function(){
		xyz;
	}) ? /\b_super\b/ : /.*/;

	// The base Class implementation (does nothing)
	this.Class = function(){};

	// Create a new Class that inherits from this class
	Class.extend = function(prop) {
		if (typeof prop === 'undefined') {
			prop = {};
		}

		var prototype,
			_super = this.prototype,
			name,
			staticProp;

		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		initializing = true;
		prototype = new this();
		initializing = false;

		// Copy the properties over onto the new prototype
		for (name in prop) {
			// Check if we're overwriting an existing function
			prototype[name] = typeof prop[name] === 'function' &&
			typeof _super[name] === 'function' && fnTest.test(prop[name]) ?
			(function(name, fn){
				return function() {
					var tmp = this._super,
						ret;

					// Add a new ._super() method that is the same method
					// but on the super-class
					this._super = _super[name];

					// The method only need to be bound temporarily, so we
					// remove it when we're done executing
					ret = fn.apply(this, arguments);
					this._super = tmp;

					return ret;
				};
			})(name, prop[name]) :
			prop[name];
		}

		// The dummy class constructor
		function Class() {
			// All construction is actually done in the init method
			if (!initializing && this.init) {
				this.init.apply(this, arguments);
			}
		}

		for (staticProp in this) {
			if (this.hasOwnProperty(staticProp)) {
				Class[staticProp] = this[staticProp];
			}
		}

		// Populate our constructed prototype object
		Class.prototype = prototype;

		// Enforce the constructor to be what we expect
		Class.prototype.constructor = Class;

		return Class;
	};
})();

/* 02-Adapter.js */
(function(){

function _sPad(value) {
	value = value + '';
	return value.length === 2 ? value : '0' + value;
}

this.Adapter = Class.extend({

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
			value = new Date(value);
		}
		return value.getFullYear() + '-' + _sPad(value.getMonth() + 1) + '-' + _sPad(value.getDate());
	},

	/**
	 * @param {Date|String} value
	 * @return {String}
	 */
	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		return this.formatDate(value) + ' ' + _sPad(value.getHours()) + ':' + _sPad(value.getMinutes()) + ':' + _sPad(value.getSeconds());
	},

	/**
	 * @param {Class} model class
	 */
	findQuery: function(model) {
		var a = Array.prototype.slice.call(arguments),
			q = new Query().setTable(model.getTableName());
		a.shift();
		var len = a.length;

		if (len === 0) {
			return q;
		}
		if (len === 1) {
			if (!isNaN(parseInt(a[0], 10))) {
				q.add(model.getPrimaryKey(), a[0]);
			} else if (typeof a[0] === 'object') {
				if (a[0] instanceof Query) {
					q = a[0];
				} else {
					// hash
				}
			} else if (typeof a[0] === 'string') {
				// where clause string
				if (a[1] instanceof Array) {
					// arguments
				}
			}
		} else if (len === 2 && typeof a[0] === 'string') {
			q.add(a[0], a[1]);
		} else {
			// if arguments list is greater than 1 and the first argument is not a string
			var pks = model.getPrimaryKeys();
			if (len === pks.len) {
				for (var x = 0, pkLen = pks.length; x < pkLen; ++x) {
					var pk = pks[x],
					pkVal = a[x];

					if (pkVal === null || typeof pkVal === 'undefined') {
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
	destroyAll: function(model, q) {
		throw new Error('destroyAll not implemented for this adapter');
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
	destroy: function(instance) {
		throw new Error('destroy not implemented for this adapter');
	}
});

})();

/* 03-Query.js */
(function(){

function Condition(left, right, operator, quote) {
	this._conds = [];
	if (arguments.length !== 0) {
		this.addAnd.apply(this, arguments);
	}
}

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

Condition.prototype = {

	_conds : null,

	/**
	 * @param {mixed} left
	 * @param {mixed} right
	 * @param {String} operator
	 * @param {Number} quote
	 * @return {QueryStatement}
	 */
	_processCondition : function(left, right, operator, quote) {

		switch (arguments.length) {
			case 0:
				return null;
				break;
			case 1:
				if (left instanceof QueryStatement) {
					return left;
				}
			case 2:
				operator = Query.EQUAL;
			case 3:
				quote = Condition.QUOTE_RIGHT;
		}

		var statement = new QueryStatement,
			clauseStatement,
			x,
			isQuery = right instanceof Query,
			isArray = right instanceof Array,
			arrayLen;

		// Left can be a Condition
		if (left instanceof Condition) {
			clauseStatement = left.getQueryStatement();
			if (null === clauseStatement) {
				return null;
			}
			clauseStatement.setString('(' + clauseStatement._qString + ')');
			return clauseStatement;
		}

		// Escape left
		if (quote === Condition.QUOTE_LEFT || quote === Condition.QUOTE_BOTH) {
			statement.addParam(left);
			left = '?';
		}

		// right can be an array
		if (isArray || isQuery) {
			if (false === isQuery || 1 !== right.getLimit()) {
				// Convert any sort of equality operator to something suitable for arrays
				switch (operator) {
					// Various forms of equal
					case Query.IN:
					case Query.EQUAL:
						operator = Query.IN;
						break;
					// Various forms of not equal
					case Query.NOT_IN:
					case Query.NOT_EQUAL:
					case Query.ALT_NOT_EQUAL:
						operator = Query.NOT_IN;
						break;
					default:
						throw new Error(operator + ' unknown for comparing an array.');
				}
			}

			// Right can be a Query, if you're trying to nest queries, like "WHERE MyColumn = (SELECT OtherColumn From MyTable LIMIT 1)"
			if (isQuery) {
				if (!right.getTable()) {
					throw new Error('right does not have a table, so it cannot be nested.');
				}

				clauseStatement = right.getQuery();
				if (null === clauseStatement) {
					return null;
				}

				right = '(' + clauseStatement._qString + ')';
				statement.addParams(clauseStatement._params);
				if (quote !== Condition.QUOTE_LEFT) {
					quote = Condition.QUOTE_NONE;
				}
			} else if (isArray) {
				arrayLen = right.length;
				// BETWEEN
				if (2 === arrayLen && operator === Query.BETWEEN) {
					statement.setString(left + ' ' + operator + ' ? AND ?');
					statement.addParams(right);
					return statement;
				} else if (0 === arrayLen) {
					// Handle empty arrays
					if (operator === Query.IN) {
						statement.setString('(0 = 1)');
						return statement;
					} else if (operator === Query.NOT_IN) {
						return null;
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
			if (null === right) {
				if (operator === Query.NOT_EQUAL || operator === Query.ALT_NOT_EQUAL) {
					// IS NOT NULL
					operator = Query.IS_NOT_NULL;
				} else if (operator === Query.EQUAL) {
					// IS NULL
					operator = Query.IS_NULL;
				}
			}

			if (operator === Query.IS_NULL || operator === Query.IS_NOT_NULL) {
				right = null;
			} else if (quote === Condition.QUOTE_RIGHT || quote === Condition.QUOTE_BOTH) {
				statement.addParam(right);
				right = '?';
			}
		}
		statement.setString(left + ' ' + operator + ' ' + right);

		return statement;
	},

	/**
	 * Alias of addAnd
	 * @return {Condition}
	 */
	add : function(left, right, operator, quote) {
		return this.addAnd.apply(this, arguments);
	},

	/**
	 * Alias of addAnd
	 * @return {Condition}
	 */
	and : function(left, right, operator, quote) {
		return this.addAnd.apply(this, arguments);
	},

	/**
	 * Alias of addAnd, but with operator and right switched
	 * @return {Condition}
	 */
	filter : function(left, operator, right, quote) {
		var a = Array.prototype.slice.call(arguments);
		if (a.length === 2) {
			var right = a[1],
				operator = Query.EQUAL;
		} else {
			var right = a[2],
				operator = a[1];
		}
		a[1] = right;
		a[2] = operator;
		return this.addAnd.apply(this, a);
	},

	/**
	 * Alias of filter
	 * @return {Condition}
	 */
	where : function(left, operator, right, quote) {
		return this.filter.apply(this, arguments);
	},

	/**
	 * Adds an "AND" condition to the array of conditions.
	 * @param left mixed
	 * @param right mixed[optional]
	 * @param operator string[optional]
	 * @param quote int[optional]
	 * @return {Condition}
	 */
	addAnd : function(left, right, operator, quote) {
		var key;

		if (left.constructor === Object) {
			for (key in left) {
				this.addAnd(key, left[key]);
			}
			return this;
		}

		arguments.processed = this._processCondition.apply(this, arguments);

		if (null !== arguments.processed) {
			arguments.type = 'AND';
			this._conds.push(arguments);
		}

		return this;
	},

	/**
	 * Alias of addAnd
	 * @return {Condition}
	 */
	or : function(left, right, operator, quote) {
		return this.addOr.apply(this, arguments);
	},

	/**
	 * Adds an "OR" condition to the array of conditions
	 * @param left mixed
	 * @param right mixed[optional]
	 * @param operator string[optional]
	 * @param quote int[optional]
	 * @return {Condition}
	 */
	addOr : function(left, right, operator, quote) {
		var key;

		if (left.constructor === Object) {
			for (key in left) {
				this.addOr(key, left[key]);
			}
			return this;
		}

		arguments.processed = this._processCondition.apply(this, arguments);

		if (null !== arguments.processed) {
			arguments.type = 'OR';
			this._conds.push(arguments);
		}

		return this;
	},

	/**
	 * @return {Condition}
	 */
	andNot : function(column, value) {
		return this.addAnd(column, value, Query.NOT_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	andLike : function(column, value) {
		return this.addAnd(column, value, Query.LIKE);
	},

	/**
	 * @return {Condition}
	 */
	andNotLike : function(column, value) {
		return this.addAnd(column, value, Query.NOT_LIKE);
	},

	/**
	 * @return {Condition}
	 */
	andGreater : function(column, value) {
		return this.addAnd(column, value, Query.GREATER_THAN);
	},

	/**
	 * @return {Condition}
	 */
	andGreaterEqual : function(column, value) {
		return this.addAnd(column, value, Query.GREATER_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	andLess : function(column, value) {
		return this.addAnd(column, value, Query.LESS_THAN);
	},

	/**
	 * @return {Condition}
	 */
	andLessEqual : function(column, value) {
		return this.addAnd(column, value, Query.LESS_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	andNull : function(column) {
		return this.addAnd(column, null);
	},

	/**
	 * @return {Condition}
	 */
	andNotNull : function(column) {
		return this.addAnd(column, null, Query.NOT_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	andBetween : function(column, from, to) {
		return this.addAnd(column, array(from, to), Query.BETWEEN);
	},

	/**
	 * @return {Condition}
	 */
	andBeginsWith : function(column, value) {
		return this.addAnd(column, value, Query.BEGINS_WITH);
	},

	/**
	 * @return {Condition}
	 */
	andEndsWith : function(column, value) {
		return this.addAnd(column, value, Query.ENDS_WITH);
	},

	/**
	 * @return {Condition}
	 */
	andContains : function(column, value) {
		return this.addAnd(column, value, Query.CONTAINS);
	},

	/**
	 * @return {Condition}
	 */
	orNot : function(column, value) {
		return this.addOr(column, value, Query.NOT_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	orLike : function(column, value) {
		return this.addOr(column, value, Query.LIKE);
	},

	/**
	 * @return {Condition}
	 */
	orNotLike : function(column, value) {
		return this.addOr(column, value, Query.NOT_LIKE);
	},

	/**
	 * @return {Condition}
	 */
	orGreater : function(column, value) {
		return this.addOr(column, value, Query.GREATER_THAN);
	},

	/**
	 * @return {Condition}
	 */
	orGreaterEqual : function(column, value) {
		return this.addOr(column, value, Query.GREATER_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	orLess : function(column, value) {
		return this.addOr(column, value, Query.LESS_THAN);
	},

	/**
	 * @return {Condition}
	 */
	orLessEqual : function(column, value) {
		return this.addOr(column, value, Query.LESS_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	orNull : function(column) {
		return this.addOr(column, null);
	},

	/**
	 * @return {Condition}
	 */
	orNotNull : function(column) {
		return this.addOr(column, null, Query.NOT_EQUAL);
	},

	/**
	 * @return {Condition}
	 */
	orBetween : function(column, from, to) {
		return this.addOr(column, array(from, to), Query.BETWEEN);
	},

	/**
	 * @return {Condition}
	 */
	orBeginsWith : function(column, value) {
		return this.addOr(column, value, Query.BEGINS_WITH);
	},

	/**
	 * @return {Condition}
	 */
	orEndsWith : function(column, value) {
		return this.addOr(column, value, Query.ENDS_WITH);
	},

	/**
	 * @return {Condition}
	 */
	orContains : function(column, value) {
		return this.addOr(column, value, Query.CONTAINS);
	},

	/**
	 * Builds and returns a string representation of this Condition
	 * @return {QueryStatement}
	 */
	getQueryStatement : function(conn) {

		if (0 === this._conds.length) {
			return null;
		}

		var statement = new QueryStatement(conn),
			string = '',
			x,
			cond,
			conds = this._conds,
			len = conds.length;

		for (x = 0; x < len; ++x) {
			cond = conds[x].processed;

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

	/**
	 * Builds and returns a string representation of this Condition
	 * @return {String}
	 */
	toString : function() {
		return this.getQueryStatement().toString();
	},

	toArray: function() {
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
			if (null === cond.processed) {
				continue;
			}
			if ('AND' !== cond.type) {
				throw new Error('OR conditions not supported.');
			}
			if (cond.length !== 2 && !(cond.length === 3 && cond[2] === Query.EQUAL)) {
				console.log(cond);
				throw new Error('Cannot export complex condition: "' + cond.processed + '"');
			}
			r[cond[0]] = cond[1];
		}
		return r;
	}

};

/**
 * Creates new instance of Query, parameters will be passed to the
 * setTable() method.
 * @return self
 * @param {String} table
 * @param {String} alias
 */
function Query (table, alias) {
	this._columns = [];
	this._joins = [];
	this._orders = [];
	this._groups = [];
	this._where = new Condition;

	if (typeof table === 'object' && !(table instanceof Query)) {
		for (var i in table) {
			this.addAnd(i, table[i]);
		}
	}

	if (table) {
		this.setTable(table, alias);
	}
	return this;
}

Query.ACTION_COUNT = 'COUNT';
Query.ACTION_DELETE = 'DELETE';
Query.ACTION_SELECT = 'SELECT';

// Comparison types
Query.EQUAL = '=';
Query.NOT_EQUAL = '<>';
Query.ALT_NOT_EQUAL = '!=';
Query.GREATER_THAN = '>';
Query.LESS_THAN = '<';
Query.GREATER_EQUAL = '>=';
Query.LESS_EQUAL = '<=';
Query.LIKE = 'LIKE';
Query.BEGINS_WITH = 'BEGINS_WITH';
Query.ENDS_WITH = 'ENDS_WITH';
Query.CONTAINS = 'CONTAINS';
Query.NOT_LIKE = 'NOT LIKE';
Query.CUSTOM = 'CUSTOM';
Query.DISTINCT = 'DISTINCT';
Query.IN = 'IN';
Query.NOT_IN = 'NOT IN';
Query.ALL = 'ALL';
Query.IS_NULL = 'IS NULL';
Query.IS_NOT_NULL = 'IS NOT NULL';
Query.BETWEEN = 'BETWEEN';

// Comparison type for update
Query.CUSTOM_EQUAL = 'CUSTOM_EQUAL';

// PostgreSQL comparison types
Query.ILIKE = 'ILIKE';
Query.NOT_ILIKE = 'NOT ILIKE';

// JOIN TYPES
Query.JOIN = 'JOIN';
Query.LEFT_JOIN = 'LEFT JOIN';
Query.RIGHT_JOIN = 'RIGHT JOIN';
Query.INNER_JOIN = 'INNER JOIN';
Query.OUTER_JOIN = 'OUTER JOIN';

// Binary AND
Query.BINARY_AND = '&';

// Binary OR
Query.BINARY_OR = '|';

// 'Order by' qualifiers
Query.ASC = 'ASC';
Query.DESC = 'DESC';

/**
 * Used to build query strings using OOP
 */
Query.prototype = {

	_action : Query.ACTION_SELECT,
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
	 * @var QueryJoin[]
	 */
	_joins: null,
	/**
	 * @var Condition
	 */
	_where : null,
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

	//	__clone : function() {
	//		if (this._where instanceof Condition) {
	//			this._where = clone this._where;
	//		}
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
		this._action = action;
		return this;
	},

	/**
	 * Returns the action of the query.  Should be SELECT, DELETE, or COUNT.
	 * @param {String} action
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

		if (this._extraTables === null) {
			this._extraTables = {};
		}
		this._extraTables[alias] = tableName;
		return this;
	},

	/**
	 * Provide the Condition object to generate the WHERE clause of
	 * the query.
	 *
	 * @param {Condition} w
	 * @return {Query}
	 */
	setWhere : function(w) {
		this._where = w;
		return this;
	},

	/**
	 * Returns the Condition object that generates the WHERE clause
	 * of the query.
	 *
	 * @return {Condition}
	 */
	getWhere : function() {
		return this._where;
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
		if (tableOrColumn instanceof QueryJoin) {
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

		this._joins.push(new QueryJoin(tableOrColumn, onClauseOrColumn, joinType));
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
	 * Shortcut to adding an AND statement to the Query's WHERE Condition.
	 * @return {Query}
	 * @param {mixed} column
	 * @param {mixed} value
	 * @param {String} operator
	 * @param {Number} quote
	 */
	addAnd : function(column, value, operator, quote) {
		this._where.addAnd.apply(this._where, arguments);
		return this;
	},

	/**
	 * Alias of {@link addAnd()}
	 * @return {Query}
	 */
	add : function(column, value, operator, quote) {
		return this.addAnd.apply(this, arguments);
	},

	/**
	 * Alias of addAnd
	 * @return {Condition}
	 */
	and : function(left, right, operator, quote) {
		return this.addAnd.apply(this, arguments);
	},

	/**
	 * Alias of addAnd, but with operator and right switched
	 * @return {Condition}
	 */
	filter : function(left, operator, right, quote) {
		this._where.filter.apply(this._where, arguments);
		return this;
	},

	/**
	 * Alias of filter
	 * @return {Condition}
	 */
	where : function(left, operator, right, quote) {
		return this.filter.apply(this, arguments);
	},

	/**
	 * Alias of addOr
	 * @return {Condition}
	 */
	or : function(left, right, operator, quote) {
		return this.addOr.apply(this, arguments);
	},

	/**
	 * Shortcut to adding an OR statement to the Query's WHERE Condition.
	 * @return {Query}
	 * @param {mixed} column
	 * @param {mixed} value
	 * @param {String} operator
	 * @param {Number} quote
	 */
	addOr : function(column, value, operator, quote) {
		this._where.addOr.apply(this._where, arguments);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andNot : function(column, value) {
		this._where.andNot(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andLike : function(column, value) {
		this._where.andLike(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andNotLike : function(column, value) {
		this._where.andNotLike(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andGreater : function(column, value) {
		this._where.andGreater(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andGreaterEqual : function(column, value) {
		this._where.andGreaterEqual(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andLess : function(column, value) {
		this._where.andLess(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andLessEqual : function(column, value) {
		this._where.andLessEqual(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andNull : function(column) {
		this._where.andNull(column);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andNotNull : function(column) {
		this._where.andNotNull(column);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andBetween : function(column, from, to) {
		this._where.andBetween(column, from, to);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andBeginsWith : function(column, value) {
		this._where.andBeginsWith(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andEndsWith : function(column, value) {
		this._where.andEndsWith(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	andContains : function(column, value) {
		this._where.andContains(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orNot : function(column, value) {
		this._where.orNot(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orLike : function(column, value) {
		this._where.orLike(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orNotLike : function(column, value) {
		this._where.orNotLike(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orGreater : function(column, value) {
		this._where.orGreater(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orGreaterEqual : function(column, value) {
		this._where.orGreaterEqual(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orLess : function(column, value) {
		this._where.orLess(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orLessEqual : function(column, value) {
		this._where.orLessEqual(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orNull : function(column) {
		this._where.orNull(column);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orNotNull : function(column) {
		this._where.orNotNull(column);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orBetween : function(column, from, to) {
		this._where.orBetween(column, from, to);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orBeginsWith : function(column, value) {
		this._where.orBeginsWith(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orEndsWith : function(column, value) {
		this._where.orEndsWith(column, value);
		return this;
	},

	/**
	 * @return {Query}
	 */
	orContains : function(column, value) {
		this._where.orContains(column, value);
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
	 * @param {Condition} where
	 */
	setHaving : function(where) {
		this._having = where;
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
	setLimit : function(limit, offset) {
		limit = parseInt(limit);
		if (isNaN(limit)) {
			throw new Error('Not a number');
		}
		this._limit = limit;

		if (offset) {
			this.setOffset(offset);
		}
		return this;
	},

	/**
	 * Returns the LIMIT integer for this Query, if it has one
	 * @return {Number}
	 */
	getLimit : function() {
		return this._limit;
	},

	/**
	 * Sets the offset for the rows returned.  Used to build
	 * the LIMIT part of the query.
	 * @return {Query}
	 * @param {Number} offset
	 */
	setOffset : function(offset) {
		offset = parseInt(offset);
		if (isNaN(offset)) {
			throw new Error('Not a number.');
		}
		this._offset = offset;
		return this;
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
	 * @param {SQLAdapter} conn
	 * @return {QueryStatement}
	 */
	getQuery : function(conn) {
		if (typeof conn === 'undefined') {
			conn = new SQLAdapter;
		}

		// the QueryStatement for the Query
		var statement = new QueryStatement(conn),
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
				columnsStatement = this.getColumnsClause(conn);
				statement.addParams(columnsStatement._params);
				queryS += 'SELECT ' + columnsStatement._qString;
				break;
			case Query.ACTION_DELETE:
				queryS += 'DELETE';
				break;
		}

		tableStatement = this.getTablesClause(conn);
		statement.addParams(tableStatement._params);
		queryS += "\nFROM " + tableStatement._qString;

		if (this._joins.length !== 0) {
			for (x = 0, len = this._joins.length; x < len; ++x) {
				join = this._joins[x],
				joinStatement = join.getQueryStatement(conn);
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
			if (conn) {
				queryS = conn.applyLimit(queryS, this._offset, this._limit);
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
	 * @param {SQLAdapter} conn
	 * @return {QueryStatement}
	 */
	getTablesClause : function(conn) {

		var table = this.getTable(),
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

		statement = new QueryStatement(conn),
		alias = this.getAlias();

		// if table is a Query, get its QueryStatement
		if (table instanceof Query) {
			tableStatement = table.getQuery(conn),
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
							extraTableStatement = extraTable.getQuery(conn),
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
	 * @param {SQLAdapter} conn
	 * @return {QueryStatement}
	 */
	getColumnsClause : function(conn) {
		var table = this.getTable(),
			column,
			statement = new QueryStatement(conn),
			alias = this.getAlias(),
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
	 * @param {SQLAdapter} conn
	 * @return {QueryStatement}
	 */
	getWhereClause : function(conn) {
		return this._where.getQueryStatement(conn);
	},

	/**
	 * @return {String}
	 */
	toString : function() {
		if (!this.getTable())
			this.setTable('{UNSPECIFIED-TABLE}');
		return this.getQuery().toString();
	},

	/**
	 * @param {SQLAdapter} conn
	 * @returns {QueryStatement}
	 */
	getCountQuery : function(conn) {
		if (!this.getTable()) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_COUNT);
		return this.getQuery(conn);
	},

	/**
	 * @param {SQLAdapter} conn
	 * @returns {QueryStatement}
	 */
	getDeleteQuery : function(conn) {
		if (!this.getTable()) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_DELETE);
		return this.getQuery(conn);
	},

	/**
	 * @param {SQLAdapter} conn
	 * @returns {QueryStatement}
	 */
	getSelectQuery : function(conn) {
		if (!this.getTable()) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_SELECT);
		return this.getQuery(conn);
	},

	toArray: function() {
//		if (this._joins && this._joins.length !== 0) {
//			throw new Error('JOINS cannot be exported.');
//		}
//		if (this._extraTables && this._extraTables.length !== 0) {
//			throw new Error('Extra tables cannot be exported.');
//		}
//		if (this._having && this._having.length !== 0) {
//			throw new Error('Having cannot be exported.');
//		}
//		if (this._groups && this._groups.length !== 0) {
//			throw new Error('Grouping cannot be exported.');
//		}

		var r = this._where.toArray();

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
};


var isIdent = /^\w+\.\w+$/;

function QueryJoin(tableOrColumn, onClauseOrColumn, joinType) {
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

QueryJoin.prototype = {

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
	 * @return {QueryJoin}
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
	 * @return {QueryJoin}
	 */
	setAlias : function(alias) {
		this._alias = alias;
		return this;
	},

	/**
	 * @param {Condition} onClause
	 * @return {QueryJoin}
	 */
	setOnClause : function(onClause) {
		this._isLikePropel = false;
		this._onClause = onClause;
		return this;
	},

	/**
	 * @param {String} joinType
	 * @return {QueryJoin}
	 */
	setJoinType : function(joinType) {
		this._joinType = joinType;
		return this;
	},

	/**
	 * @param {Adapter} conn
	 * @return {QueryStatement}
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
			statement = new QueryStatement(conn);
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

function QueryStatement(conn) {
	this._params = [];
	if (conn) {
		this._conn = conn;
	}
}

/**
 * Emulates a prepared statement.  Should only be used as a last resort.
 * @param string
 * @param params
 * @param conn
 * @return {String}
 */
QueryStatement.embedParams = function(string, params, conn) {
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

QueryStatement.prototype = {

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
		return QueryStatement.embedParams(this._qString, this._params.slice(0), this._conn);
	}
};

this.Condition = Condition;
this.Query = Query;
this.QueryStatement = QueryStatement;
this.QueryJoin = QueryJoin;

})();

/* 04-RESTAdapter.js */
(function($){

function _sPad(value) {
	value = value + '';
	return value.length === 2 ? value : '0' + value;
}

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

this.RESTAdapter = Adapter.extend({

	_routes: null,

	init: function RESTAdaper() {
		this._super();
		this._routes = {};
	},

	_route: function(url) {
		if (!url) {
			throw new Error('Cannot create RESTful route for empty url.');
		}
		if (this._routes[url]) {
			return this._routes[url];
		}
		return this._routes[url] = new Route(url);
	},

	_save: function(instance, method) {
		var fieldName,
			model = instance.constructor,
			value,
			route = this._route(model._url),
			data = {},
			def = new Deferred(),
			pk = model.getPrimaryKey(),
			self = this;

		for (fieldName in model._fields) {
			var field = model._fields[fieldName];
			value = instance[fieldName];
			if (model.isTemporalType(field.type)) {
				value = this.formatDate(value, field.type);
			}
			data[fieldName] = value;
		}

		data._method = method;

		$.ajax({
			url: route.url(data),
			type: 'POST',
			data: JSON.stringify(data),
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			success: function(r) {
				if (!r || (r.errors && r.errors.length)) {
					def.reject(r);
					return;
				}
				instance
					.setValues(r)
					.resetModified()
					.setNew(false);

				if (pk && instance[pk]) {
					self.cache(model._table, instance[pk], instance);
				}
				def.resolve(instance);
			},
			error: function(jqXHR, textStatus, errorThrown) {
				def.reject({
					xhr: jqXHR,
					status: textStatus,
					errors: [errorThrown]
				});
			}
		});
		return def.promise();
	},

	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		var offset = -value.getTimezoneOffset() / 60;
		offset = (offset > 0 ? '+' : '-') + _sPad(Math.abs(offset));

		return this.formatDate(value)
			+ ' ' + _sPad(value.getHours())
			+ ':' + _sPad(value.getMinutes())
			+ ':' + _sPad(value.getSeconds())
			+ ' ' + offset + '00';
	},

	insert: function(instance) {
		return this._save(instance, 'POST');
	},

	update: function(instance) {
		if (!instance.isModified()) {
			var def = new Deferred();
			def.resolve();
			return def.promise();
		}

		return this._save(instance, 'PUT');
	},

	destroy: function(instance) {
		var model = instance.constructor,
			route = this._route(model._url),
			def = new Deferred(),
			pk = model.getPrimaryKey(),
			self = this;

		var data = {
			_method: 'DELETE'
		};

		$.ajax({
			url: route.url(instance.getValues()),
			type: 'POST',
			data: JSON.stringify(data),
			contentType: 'application/json;charset=utf-8',
			dataType: 'json',
			success: function(r) {
				if (r && r.errors && r.errors.length) {
					def.reject(r);
					return;
				}
				if (pk && instance[pk]) {
					self.cache(model._table, instance[pk], null);
				}
				def.resolve(instance);
			},
			error: function(jqXHR, textStatus, errorThrown){
				def.reject({
					xhr: jqXHR,
					status: textStatus,
					errors: [errorThrown]
				});
			}
		});

		return def.promise();
	},

	find: function(model, id) {
		var pk = model.getPrimaryKey(),
			route = this._route(model._url),
			data = {},
			def = new Deferred(),
			instance = null,
			q;

		if (typeof id === 'number' || typeof id === 'string') {
			// look for it in the cache
			instance = this.cache(model._table, id);
			if (instance) {
				def.resolve(instance);
				return def.promise();
			}
			data[pk] = id;
		} else {
			q = this.findQuery.apply(this, arguments);
			data = q.toArray();
		}

		$.get(route.urlGet(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			def.resolve(model.inflate(r));
		})
		.fail(function(jqXHR, textStatus, errorThrown){
			def.reject({
				xhr: jqXHR,
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	},

	findAll: function(model) {
		var q = this.findQuery
			.apply(this, arguments);

		var route = this._route(model._url),
			data = q.toArray(),
			def = new Deferred();
		$.get(route.urlGet(data), function(r) {
			if (!r || (r.errors && r.errors.length)) {
				def.reject(r);
				return;
			}
			var collection = [];
			if (r instanceof Array) {
				for (var x = 0, len = r.length; x < len; ++x) {
					collection.push(model.inflate(r[x]));
				}
			}
			def.resolve(collection);
		})
		.fail(function(jqXHR, textStatus, errorThrown){
			def.reject({
				xhr: jqXHR,
				status: textStatus,
				errors: [errorThrown]
			});
		});
		return def.promise();
	}
});

})(jQuery);

/* 04-SQLAdapter.js */
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
			len;
		for (i = 0, len = result.length; i < len; ++i) {
			objects.push(model.inflate(result[i]));
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

})();

/* 05-AsyncSQLAdapter.js */
(function(){

var asyncMethods = [
	'find',
	'findAll',
	'countAll',
	'destroyAll',
	'updateAll',
	'insert',
	'update',
	'destroy'
];

var props = {
	init: function AsyncSQLAdapter(db) {
		this._super(db);
	}
};

for (var x = 0, l = asyncMethods.length; x < l; ++x) {
	var method = asyncMethods[x];
	props[method] = function() {
		var def = new Deferred();
		try {
			def.resolve(this._super.apply(this, arguments));
		} catch (e) {
			def.reject({
				errors: [e]
			});
		}
		return def.promise();
	};
}

this.AsyncSQLAdapter = SQLAdapter.extend(props);

})();

/* 06-Model.js */
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
	 * @return {Model}
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
	 * @param {String} fieldName
	 * @return bool
	 */
	isModified: function(fieldName) {
		if (fieldName) {
			return this[fieldName] !== this._originalValues[fieldName];
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
	 * @return {Object}
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
		if (this._values) {
			this._values = copy(this._originalValues);
		} else {
			for (var fieldName in this._originalValues) {
				this[fieldName] = this._originalValues[fieldName];
			}
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
	 * @return {Boolean}
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
	 * @return {Array}
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
	 * @return {Promise}
	 */
	save: function() {
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

		if (this.isNew()) {
			return this.insert();
		} else {
			return this.update();
		}
	},

	/**
	 * Stores a new record with that values in this object
	 * @return {Promise}
	 */
	insert: function() {
		return this.constructor._adapter.insert(this);
	},

	/**
	 * Updates the stored record representing this object.
	 * @param {Object} values
	 * @return {Promise}
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
	 * @return {Promise}
	 */
	destroy: function() {
		return this.constructor._adapter.destroy(this);
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
 * @param {mixed} value
 * @param {String} fieldType
 * @returns {Date}
 */
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

function cast(obj, type) {
	if (type._table && typeof type === 'function') {
		if (obj.constructor === type) {
			return obj;
		}
		return type.inflate(obj);
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
	return this._fields[fieldName];
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
	for (var f in this._fields) {
		if (f === fieldName) {
			return true;
		}
	}
	return false;
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

var adapterMethods = ['countAll', 'findAll', 'find', 'destroyAll', 'updateAll'];

for (var i = 0, l = adapterMethods.length; i < l; ++i) {
	var method = adapterMethods[i];
	Model[method] = (function(method){
		return function() {
			var args = Array.prototype.slice.call(arguments),
				con = this.getAdapter();
			args.unshift(this);
			return con[method].apply(con, args);
		};
	})(method);
}

var findAliases = ['findBy', 'retrieveByField', 'retrieveByPK', 'retrieveByPKs', 'findByPKs'];

for (var x = 0, len = findAliases.length; x < len; ++x) {
	Model[findAliases[x]] = Model.find;
}

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

Model.models = {};

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

this.Model = Model;
})();

/* 07-Migration.js */
(function(){

var Migration = {};

Migration.schema = Model.extend('schema_definitions', {
	fields: {
		id: { type: Model.FIELD_TYPE_INTEGER, computed: true, key: true },
		table_name: Model.FIELD_TYPE_TEXT,
		column_names: Model.FIELD_TYPE_INTEGER,
		column_types: Model.FIELD_TYPE_INTEGER
	}
});

// Primary method for initializing Migration via manual or automigration
Migration.migrate = function(options) {
	if (!options) {
		options = {};
	}

	var tableName, migrations = {}, startVersion, targetVersion, i;

	// Drop tables
	if (options.refresh) {
		for (tableName in Model.models){
			SQLAdapter.execute('DROP TABLE IF EXISTS ' + tableName);
//				Migration.each(model.options.hasAndBelongsToMany, function(assocTable) {
//					var mappingTable = [model.table, assocTable].sort().toString().replace(',', '_');
//					var sql = 'DROP TABLE IF EXISTS ' + mappingTable;
//					SQLAdapter.execute(sql);
//				});
		}
		Migration.setupSchema(true);
	} else {
		Migration.setupSchema();
	}

	if (Migration.migrations)
		migrations = Migration.migrations;

	// test for apparently-valid obj literal based on migration 1 being present
	if (migrations[1] && migrations[1].constructor === Object) {
		startVersion = Migration.currentSchemaVersion();
		targetVersion = Infinity;

		// did user specify a migration number?
		if (options.number !== null && typeof options.number !== 'undefined')
			targetVersion = options.number;
		else if (typeof options === 'number')
			targetVersion = options;

		// actually handle a migrations object
		i = startVersion;

		do {
			// schema is already up to date
			if (i === targetVersion) {
				// up to date
				return;
			}
			// migrate up
			else if (i < targetVersion) {
				i += 1;
				if (migrations[i] !== null && typeof migrations[i] !== 'undefined')
					migrations[i].up();
				else
					break;
			}
			// migrate down
			else {
				migrations[i].down();
				i -= 1;
			}
			Migration.updateSchemaVersion(i);
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
//			SQLAdapter.execute(sql);

//			Migration.each(model.options.hasAndBelongsToMany, function(assocTable, association) {
//				var mappingTable = [model.table, assocTable].sort().toString().replace(',', '_');
//				var localKey = model.options.foreignKey;
//				var foreignKey = Migration.models.get(assocTable).options.foreignKey;
//				var keys = [localKey, foreignKey].sort();
//				var sql = 'CREATE TABLE IF NOT EXISTS ' + mappingTable + '(' + keys[0] + ' INTEGER, ' + keys[1] + ' INTEGER)';
//				SQLAdapter.execute(sql);
//			});
//
//			model._fields.id = 'INTEGER';
//		});
	}

	// handle fixture data, if passed in fixtures erase all old data
//	if (options && options.refresh && Migration.fixtures)
//		Migration.loadFixtures();
};

//Migration.loadFixtures = function() {
//	var fixtures = Migration.fixtures;
//	Migration.each(fixtures.tables, function(tableData, tableName) {
//		Migration.each(tableData, function(record) {
//			Migration.models.get(tableName).create(record);
//		});
//	});
//
//	if (!fixtures.mappingTables)
//		return;
//
//	Migration.each(fixtures.mappingTables, function(tableData, tableName) {
//		Migration.each(tableData, function(colData) {
//			var dataHash = new Migration.Hash(colData);
//			var sql = 'INSERT INTO ' + tableName + ' (' + dataHash.getKeys().toString() + ') VALUES(' + dataHash.getValues().toString() + ')';
//			SQLAdapter.execute(sql);
//		});
//	});
//};

// used elsewhere

Migration.setupSchema = function(force) {
	var sql;
	Migration.createTable('schema_migrations', {
		version: Model.FIELD_TYPE_TEXT
	});
	if (SQLAdapter.count('SELECT * FROM schema_migrations') === 0) {
		sql = 'INSERT INTO schema_migrations (version) VALUES(0)';
		SQLAdapter.execute(sql);
	}
	if (force && SQLAdapter.count('SELECT * FROM schema_migrations') === 1) {
		sql = 'UPDATE schema_migrations set version = 0';
		SQLAdapter.execute(sql);
	}
	Migration.createTable('schema_definitions', {
		id: Model.FIELD_TYPE_INTEGER,
		table_name: Model.FIELD_TYPE_TEXT,
		column_names: Model.FIELD_TYPE_INTEGER,
		column_types: Model.FIELD_TYPE_INTEGER
	});
};

Migration.writeSchema = function(tableName, cols) {
	if (tableName === 'schema_definitions' || tableName === 'schema_migrations')
		return;
	var keys = [],
		values = [],
		cName,
		names,
		types,
		table;
	for (cName in cols) {
		keys.push(cName);
		values.push(cols[cName]);
	}
	names = keys.join();
	types = keys.join();
	table = Migration.schema.findBy('table_name', tableName);
	if (table) {
		table.column_names = names;
		table.column_types = types;
		table.save();
	} else {
		table = new Migration.schema;
		table.setValues({
			table_name: tableName,
			column_names: names,
			column_types: types
		});
		table.save();
	}
};

Migration.readSchema = function(tableName) {
	if (tableName === 'schema_definitions' || tableName === 'schema_migrations')
		return null;
	var table = Migration.schema.findBy('table_name', tableName),
		column_names = table.column_names.split(','),
		column_types = table.column_types.split(','),
		cols = {},
		i,
		len = column_names.length,
		col;
	for (i = 0; i < len; ++i){
		col = column_names[i];
		cols[col] = column_types[i];
	}
	return cols;
};

Migration.currentSchemaVersion = function() {
	var sql = 'SELECT version FROM schema_migrations LIMIT 1';

	return parseInt(SQLAdapter.execute(sql)[0].version, 10);
};

Migration.updateSchemaVersion = function(number) {
	var sql = 'UPDATE schema_migrations SET version = ' + number;
	SQLAdapter.execute(sql);
};

Migration.modifyColumn = function(tableName, columnName, options) {

	if (!options) {
		throw new Error('MIGRATION_EXCEPTION: Not a valid column modification');
	}

	var oldCols = Migration.readSchema(tableName),
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

	SQLAdapter.transaction(function() {
		var records = SQLAdapter.execute('SELECT * FROM ' + tableName);
		if (records.length !== 0) {
			throw new Error('Modify column not quite ready yet...');
		}

		Migration.dropTable(tableName);
		Migration.createTable(tableName, newCols);

		for (var i = 0, len = records.length; i < len; ++i) {
			 var record = records[i];
			 switch (options.modification) {
				 case 'remove':
					 delete record[columnName];
					 Model.insert(tableName, record, SQLAdapter.getConnection());
					 break;
				 case 'rename':
					 record[options.newName] = record[columnName];
					 delete record[columnName];
					 Model.insert(tableName, record, SQLAdapter.getConnection());
					 break;
				 case 'change':
					 Model.insert(tableName, record, SQLAdapter.getConnection());
					 break;
				 default:
					 throw('MIGRATION_EXCEPTION: Not a valid column modification');
			 }
		}
	});
};


// used in actual migrations

Migration.createTable = function(name, columns) {
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
	SQLAdapter.execute(sql);

	Migration.writeSchema(name, columns);
};

Migration.dropTable = function(name) {
	var sql = 'DROP TABLE IF EXISTS ' + name,
		schemaTable;
	SQLAdapter.execute(sql);
	schemaTable = Migration.schema.findBy('table_name', name);
	schemaTable.destroy();
};

Migration.renameTable = function(oldName, newName) {
	var sql = 'ALTER TABLE ' + oldName + ' RENAME TO ' + newName,
		schemaTable;
	SQLAdapter.execute(sql);
	schemaTable = Migration.schema.findBy('table_name', oldName);
	schemaTable.table_name = newName;
	schemaTable.save();
};

Migration.addColumn = function(tableName, columnName, dataType) {
	var sql = 'ALTER TABLE ' + tableName + ' ADD COLUMN ' + columnName + ' ' + dataType,
		cols;
	SQLAdapter.execute(sql);
	cols = Migration.readSchema(tableName);
	cols[columnName] = dataType;
	Migration.writeSchema(tableName, cols);
};

Migration.removeColumn = function(tableName, columnName) {
	Migration.modifyColumn(tableName, columnName, {
		modification: 'remove'
	});
};

Migration.renameColumn = function(tableName, columnName, newColumnName) {
	var options = {
		modification: 'rename',
		newName: newColumnName
	};
	Migration.modifyColumn(tableName, columnName, options);
};

Migration.changeColumn = function(tableName, columnName, type) {
	var options = {
		modification: 'change',
		newType: type
	};
	Migration.modifyColumn(tableName, columnName, options);
};

Migration.addIndex = function(tableName, columnName, unique) {
	var sql = 'CREATE' + (unique ? ' UNIQUE ' : ' ') + 'INDEX IF NOT EXISTS ' + tableName + '_' + columnName + '_index ON ' + tableName + ' (' + columnName + ')';
	SQLAdapter.execute(sql);
};

Migration.removeIndex = function(tableName, columnName) {
	var sql = 'DROP INDEX IF EXISTS ' + tableName + '_' + columnName + '_index';
	SQLAdapter.execute(sql);
};

this.Migration = Migration;
})();

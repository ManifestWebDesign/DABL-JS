var Condition = dabl.Class.extend({
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
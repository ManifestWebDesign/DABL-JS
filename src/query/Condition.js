(function(){

this.Condition = Class.extend({
	_conds : null,

	init: function Condition(left, operator, right, quote) {
		this._conds = [];
		if (arguments.length !== 0) {
			this.and.apply(this, arguments);
		}
	},

	/**
	 * @param {mixed} left
	 * @param {String} operator
	 * @param {mixed} right
	 * @param {Number} quote
	 * @return {QueryStatement}
	 */
	_processCondition : function(left, operator, right, quote) {

		switch (arguments.length) {
			case 0:
				return null;
				break;
			case 1:
				if (left instanceof QueryStatement) {
					return left;
				}
				// Left can be a Condition
				if (left instanceof Condition) {
					clauseStatement = left.getQueryStatement();
					if (null === clauseStatement) {
						return null;
					}
					clauseStatement.setString('(' + clauseStatement._qString + ')');
					return clauseStatement;
				}
				return null;
			case 2:
				right = operator;
				operator = Condition.EQUAL;
				// pass through...
			case 3:
				quote = Condition.QUOTE_RIGHT;
		}

		var statement = new QueryStatement,
			clauseStatement,
			x,
			isQuery = right instanceof Query,
			isArray = right instanceof Array,
			arrayLen;

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
			if (false === isQuery || 1 !== right.getLimit()) {
				// Convert any sort of equality operator to something suitable for arrays
				switch (operator) {
					case Condition.BETWEEN:
						break;
					// Various forms of equal
					case Condition.IN:
					case Condition.EQUAL:
						operator = Condition.IN;
						break;
					// Various forms of not equal
					case Condition.NOT_IN:
					case Condition.NOT_EQUAL:
					case Condition.ALT_NOT_EQUAL:
						operator = Condition.NOT_IN;
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
				if (2 === arrayLen && operator === Condition.BETWEEN) {
					statement.setString(left + ' ' + operator + ' ? AND ?');
					statement.addParams(right);
					return statement;
				} else if (0 === arrayLen) {
					// Handle empty arrays
					if (operator === Condition.IN) {
						statement.setString('(0 = 1)');
						return statement;
					} else if (operator === Condition.NOT_IN) {
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
				if (operator === Condition.NOT_EQUAL || operator === Condition.ALT_NOT_EQUAL) {
					// IS NOT NULL
					operator = Condition.IS_NOT_NULL;
				} else if (operator === Condition.EQUAL) {
					// IS NULL
					operator = Condition.IS_NULL;
				}
			}

			if (operator === Condition.IS_NULL || operator === Condition.IS_NOT_NULL) {
				right = null;
			} else if (quote === Condition.QUOTE_RIGHT || quote === Condition.QUOTE_BOTH) {
				statement.addParam(right);
				right = '?';
			}
		}
		statement.setString(left + ' ' + operator + (right === null ? '' : ' ' + right));

		return statement;
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

		arguments.processed = this._processCondition.apply(this, arguments);

		if (null !== arguments.processed) {
			arguments.type = 'AND';
			this._conds.push(arguments);
		}

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

		arguments.processed = this._processCondition.apply(this, arguments);

		if (null !== arguments.processed) {
			arguments.type = 'OR';
			this._conds.push(arguments);
		}

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
			if (cond.length === 2) {
				r[cond[0]] = cond[1];
			} else if (cond.length === 3 && cond[1] === Condition.EQUAL) {
				r[cond[0]] = cond[2];
			} else {
				throw new Error('Cannot export complex condition: "' + cond.processed + '"');
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
Condition.CUSTOM = 'CUSTOM';
Condition.DISTINCT = 'DISTINCT';
Condition.IN = 'IN';
Condition.NOT_IN = 'NOT IN';
Condition.ALL = 'ALL';
Condition.IS_NULL = 'IS NULL';
Condition.IS_NOT_NULL = 'IS NOT NULL';
Condition.BETWEEN = 'BETWEEN';
Condition.BINARY_AND = '&';
Condition.BINARY_OR = '|';

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

})();
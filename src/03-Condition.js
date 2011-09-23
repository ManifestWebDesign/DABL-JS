function Condition(left, right, operator, quote) {
	this._conds = [];
	if (arguments.length != 0) {
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
	 * @return string
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
		if (quote == Condition.QUOTE_LEFT || quote == Condition.QUOTE_BOTH) {
			statement.addParam(left);
			left = '?';
		}

		// right can be an array
		if (isArray || isQuery) {
			if (false == isQuery || 1 !== right.getLimit()) {
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
				if (quote != Condition.QUOTE_LEFT) {
					quote = Condition.QUOTE_NONE;
				}
			} else if (isArray) {
				arrayLen = right.length;
				// BETWEEN
				if (2 == arrayLen && operator == Query.BETWEEN) {
					statement.setString(left + ' ' + operator + ' ? AND ?');
					statement.addParams(right);
					return statement;
				} else if (0 == arrayLen) {
					// Handle empty arrays
					if (operator == Query.IN) {
						statement.setString('(0 = 1)');
						return statement;
					} else if (operator == Query.NOT_IN) {
						return null;
					}
				} else if (quote == Condition.QUOTE_RIGHT || quote == Condition.QUOTE_BOTH) {
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
				if (operator == Query.NOT_EQUAL || operator == Query.ALT_NOT_EQUAL) {
					// IS NOT NULL
					operator = Query.IS_NOT_NULL;
				} else if (operator == Query.EQUAL) {
					// IS NULL
					operator = Query.IS_NULL;
				}
			}

			if (operator == Query.IS_NULL || operator == Query.IS_NOT_NULL) {
				right = null;
			} else if (quote == Condition.QUOTE_RIGHT || quote == Condition.QUOTE_BOTH) {
				statement.addParam(right);
				right = '?';
			}
		}
		statement.setString(left + ' ' + operator + ' ' + right);

		return statement;
	},

	/**
	 * Alias of addAnd
	 * @return Condition
	 */
	add : function(left, right, operator, quote) {
		return this.addAnd.apply(this, arguments);
	},

	/**
	 * Adds an "AND" condition to the array of conditions.
	 * @param left mixed
	 * @param right mixed[optional]
	 * @param operator string[optional]
	 * @param quote int[optional]
	 * @return Condition
	 */
	addAnd : function(left, right, operator, quote) {
		var key, condition;

		if (left.constructor === Object) {
			for (key in left) {
				this.addAnd(key, left[key]);
			}
			return this;
		}

		condition = this._processCondition.apply(this, arguments);

		if (null !== condition) {
			condition.sep = 'AND';
			this._conds.push(condition);
		}
		return this;
	},

	/**
	 * Adds an "OR" condition to the array of conditions
	 * @param left mixed
	 * @param right mixed[optional]
	 * @param operator string[optional]
	 * @param quote int[optional]
	 * @return Condition
	 */
	addOr : function(left, right, operator, quote) {
		var key, condition;

		if (left.constructor === Object) {
			for (key in left) {
				this.addOr(key, left[key]);
			}
			return this;
		}

		condition = this._processCondition.apply(this, arguments);

		if (null !== condition) {
			condition.sep = 'OR';
			this._conds.push(condition);
		}
		return this;
	},

	/**
	 * @return Condition
	 */
	andNot : function(column, value) {
		return this.addAnd(column, value, Query.NOT_EQUAL);
	},

	/**
	 * @return Condition
	 */
	andLike : function(column, value) {
		return this.addAnd(column, value, Query.LIKE);
	},

	/**
	 * @return Condition
	 */
	andNotLike : function(column, value) {
		return this.addAnd(column, value, Query.NOT_LIKE);
	},

	/**
	 * @return Condition
	 */
	andGreater : function(column, value) {
		return this.addAnd(column, value, Query.GREATER_THAN);
	},

	/**
	 * @return Condition
	 */
	andGreaterEqual : function(column, value) {
		return this.addAnd(column, value, Query.GREATER_EQUAL);
	},

	/**
	 * @return Condition
	 */
	andLess : function(column, value) {
		return this.addAnd(column, value, Query.LESS_THAN);
	},

	/**
	 * @return Condition
	 */
	andLessEqual : function(column, value) {
		return this.addAnd(column, value, Query.LESS_EQUAL);
	},

	/**
	 * @return Condition
	 */
	andNull : function(column) {
		return this.addAnd(column, null);
	},

	/**
	 * @return Condition
	 */
	andNotNull : function(column) {
		return this.addAnd(column, null, Query.NOT_EQUAL);
	},

	/**
	 * @return Condition
	 */
	andBetween : function(column, from, to) {
		return this.addAnd(column, array(from, to), Query.BETWEEN);
	},

	/**
	 * @return Condition
	 */
	andBeginsWith : function(column, value) {
		return this.addAnd(column, value, Query.BEGINS_WITH);
	},

	/**
	 * @return Condition
	 */
	andEndsWith : function(column, value) {
		return this.addAnd(column, value, Query.ENDS_WITH);
	},

	/**
	 * @return Condition
	 */
	andContains : function(column, value) {
		return this.addAnd(column, value, Query.CONTAINS);
	},

	/**
	 * @return Condition
	 */
	orNot : function(column, value) {
		return this.addOr(column, value, Query.NOT_EQUAL);
	},

	/**
	 * @return Condition
	 */
	orLike : function(column, value) {
		return this.addOr(column, value, Query.LIKE);
	},

	/**
	 * @return Condition
	 */
	orNotLike : function(column, value) {
		return this.addOr(column, value, Query.NOT_LIKE);
	},

	/**
	 * @return Condition
	 */
	orGreater : function(column, value) {
		return this.addOr(column, value, Query.GREATER_THAN);
	},

	/**
	 * @return Condition
	 */
	orGreaterEqual : function(column, value) {
		return this.addOr(column, value, Query.GREATER_EQUAL);
	},

	/**
	 * @return Condition
	 */
	orLess : function(column, value) {
		return this.addOr(column, value, Query.LESS_THAN);
	},

	/**
	 * @return Condition
	 */
	orLessEqual : function(column, value) {
		return this.addOr(column, value, Query.LESS_EQUAL);
	},

	/**
	 * @return Condition
	 */
	orNull : function(column) {
		return this.addOr(column, null);
	},

	/**
	 * @return Condition
	 */
	orNotNull : function(column) {
		return this.addOr(column, null, Query.NOT_EQUAL);
	},

	/**
	 * @return Condition
	 */
	orBetween : function(column, from, to) {
		return this.addOr(column, array(from, to), Query.BETWEEN);
	},

	/**
	 * @return Condition
	 */
	orBeginsWith : function(column, value) {
		return this.addOr(column, value, Query.BEGINS_WITH);
	},

	/**
	 * @return Condition
	 */
	orEndsWith : function(column, value) {
		return this.addOr(column, value, Query.ENDS_WITH);
	},

	/**
	 * @return Condition
	 */
	orContains : function(column, value) {
		return this.addOr(column, value, Query.CONTAINS);
	},

	/**
	 * Builds and returns a string representation of this Condition
	 * @return QueryStatement
	 */
	getQueryStatement : function(conn) {

		if (0 == this._conds.length) {
			return null;
		}

		var statement = new QueryStatement(conn),
			string = '',
			x,
			cond,
			conds = this._conds,
			len = conds.length;

		for (x = 0; x < len; ++x) {
			cond = conds[x];

			if (null === cond) {
				continue;
			}

			string += "\n\t";
			if (0 != x) {
				string += ((1 == x && conds[0].sep == 'OR') ? 'OR' : cond.sep) + ' ';
			}
			string += cond._qString;
			statement.addParams(cond._params);
		}
		statement.setString(string);
		return statement;
	},

	/**
	 * Builds and returns a string representation of this Condition
	 * @return string
	 */
	toString : function() {
		return this.getQueryStatement().toString();
	}

}
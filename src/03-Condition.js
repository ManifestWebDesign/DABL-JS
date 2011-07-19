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
			isArray,
			placeholders,
			x,
			len;

		// Left can be a Condition
		if (left instanceof Condition) {
			clauseStatement = left.getQueryStatement();
			if (!clauseStatement) {
				return null;
			}
			clauseStatement.setString('(' + clauseStatement.getString() + ')');
			return clauseStatement;
		}

		// Escape left
		if (quote == Condition.QUOTE_LEFT || quote == Condition.QUOTE_BOTH) {
			statement.addParam(left);
			left = '?';
		}

		isArray = right instanceof Array || (right instanceof Query && 1 !== right.getLimit());

		// Right can be a Query, if you're trying to nest queries, like "WHERE MyColumn = (SELECT OtherColumn From MyTable LIMIT 1)"
		if (right instanceof Query) {
			if (!right.getTable()) {
				throw new Error('right does not have a table, so it cannot be nested.');
			}

			clauseStatement = right.getQuery();
			if (!clauseStatement) {
				return null;
			}

			right = '(' + clauseStatement.getString() + ')';
			statement.addParams(clauseStatement._params);
			if (quote != Condition.QUOTE_LEFT) {
				quote = Condition.QUOTE_NONE;
			}
		}

		// right can be an array
		if (isArray) {
			// BETWEEN
			if (right instanceof Array && 2 == right.length && operator == Query.BETWEEN) {
				statement.setString(left + ' ' + operator + ' ? AND ?');
				statement.addParams(right);
				return statement;
			}

			// Convert any sort of equal operator to something suitable
			// for arrays
			switch (operator) {
				//Various forms of equal
				case Query.IN:
				case Query.EQUAL:
					operator = Query.IN;
					break;
				//Various forms of not equal
				case Query.NOT_IN:
				case Query.NOT_EQUAL:
				case Query.ALT_NOT_EQUAL:
					operator = Query.NOT_IN;
					break;
				default:
					throw new Error(operator + ' unknown for comparing an array.');
			}

			// Handle empty arrays
			if (right instanceof Array && 0 == right.length) {
				if (operator == Query.IN) {
					statement.setString('(0 = 1)');
					return statement;
				} else if (operator == Query.NOT_IN) {
					return null;
				}
			} else if (quote == Condition.QUOTE_RIGHT || quote == Condition.QUOTE_BOTH) {
				statement.addParams(right);
				var rString = '(';
				for (x = 0, len = right.length; x < len; ++x) {
					if (0 < x) {
						rString += ',';
					}
					rString += '?';
				}
				right = rString + ')';
			}
		} else {
			// IS NOT NULL
			if (null === right && (operator == Query.NOT_EQUAL || operator == Query.ALT_NOT_EQUAL)) {
				operator = Query.IS_NOT_NULL;
			}

			// IS NULL
			else if (null === right && operator == Query.EQUAL) {
				operator = Query.IS_NULL;
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
	 * Builds and returns a string representation of this Condition
	 * @return QueryStatement
	 */
	getQueryStatement : function() {

		if (0 == this._conds.length) {
			return null;
		}

		var statement = new QueryStatement,
			string = '',
			x,
			cond,
			conds = this._conds,
			len = conds.length;

		for (x = 0; x < len; ++x) {
			cond = conds[x];
			string += "\n\t";
			if (0 != x) {
				string += ((1 == x && conds[0].sep == 'OR') ? 'OR' : cond.sep) + ' ';
			}
			string += cond.getString();
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
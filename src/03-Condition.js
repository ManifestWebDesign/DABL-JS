function Condition(left, right, operator, quote) {
	this._ands = [];
	this._ors = [];
	if (typeof left != 'undefined') {
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

	_ands : null,
	_ors : null,

	/**
	 * @return string
	 */
	_processCondition : function(left, right, operator, quote) {

		if (typeof operator === 'undefined') {
			operator = Query.EQUAL;
		}

		if (typeof left === 'undefined') {
			return null;
		}

		if (typeof quote === 'undefined') {
			quote = Condition.QUOTE_RIGHT;
		}

		if (arguments.length === 1 && left instanceof QueryStatement) {
			return left;
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
		if (quote === Condition.QUOTE_LEFT || quote === Condition.QUOTE_BOTH) {
			statement.addParam(left);
			left = '?';
		}

		isArray = false;
		if (right instanceof Array || (right instanceof Query && right.getLimit() !== 1)) {
			isArray = true;
		}

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
			statement.addParams(clauseStatement.getParams());
			if (quote != Condition.QUOTE_LEFT) {
				quote = Condition.QUOTE_NONE;
			}
		}

		// right can be an array
		if (isArray) {
			// BETWEEN
			if (right instanceof Array && right.length == 2 && operator == Query.BETWEEN) {
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
			if (right instanceof Array && !right) {
				if (operator == Query.IN) {
					statement.setString('(0 = 1)');
					statement.setParams([]);
					return statement;
				} else if (operator == Query.NOT_IN) {
					return null;
				}
			}

			// IN or NOT_IN
			if (quote == Condition.QUOTE_RIGHT || quote == Condition.QUOTE_BOTH) {
				statement.addParams(right);
				placeholders = [];
				for (x = 0, len = right.length; x < len; ++x) {
					placeholders.push('?');
				}
				right = '(' + placeholders.join(',') + ')';
			}
		} else {
			// IS NOT NULL
			if (right === null && (operator == Query.NOT_EQUAL || operator == Query.ALT_NOT_EQUAL)) {
				operator = Query.IS_NOT_NULL;
			}

			// IS NULL
			else if (right === null && operator == Query.EQUAL) {
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

		if (typeof left == 'object') {
			for (key in left) {
				this.addAnd(key, left[key]);
			}
			return this;
		}

		condition = this._processCondition.apply(this, arguments);

		if (condition) {
			this._ands.push(condition);
		}
		return this;
	},

	/**
	 * @return QueryStatement[]
	 */
	getAnds : function() {
		return this._ands.slice(0);
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

		if (typeof left == 'object') {
			for (key in left) {
				this.addOr(key, left[key]);
			}
			return this;
		}

		condition = this._processCondition.apply(this, arguments);

		if (condition) {
			this._ors.push(condition);
		}
		return this;
	},

	/**
	 * @return QueryStatement[]
	 */
	getOrs : function() {
		return this._ors.slice();
	},

	/**
	 * Builds and returns a string representation of this Condition
	 * @return QueryStatement
	 */
	getQueryStatement : function() {
		var statement = new QueryStatement,
			string = '',
			andStrings = [],
			orStrings = [],
			x, len,
			andStatement,
			orStatement;

		for (x = 0, len = this._ands.length; x < len; ++x) {
			andStatement = this._ands[x];
			andStrings.push(andStatement.getString());
			statement.addParams(andStatement.getParams());
		}

		if (andStrings.length > 0) {
			AND = andStrings.join("\n\tAND ");
		}

		for (x = 0, len = this._ors.length; x < len; ++x) {
			orStatement = this._ors[x];
			orStrings.push(orStatement.getString());
			statement.addParams(orStatement.getParams());
		}
		if (orStrings.length > 0) {
			OR = orStrings.join("\n\tOR ");
		}

		if (andStrings.length > 0 || orStrings.length > 0) {
			if (andStrings.length > 0  && orStrings.length > 0 ) {
				string += "\n\t" + AND + "\n\tOR " + OR;
			} else if (andStrings.length > 0 ) {
				string += "\n\t" + AND;
			} else {
				string += "\n\t" + OR;
			}
			statement.setString(string);
			return statement;
		}
		return null;
	},

	/**
	 * Builds and returns a string representation of this Condition
	 * @return string
	 */
	toString : function() {
		return this.getQueryStatement().toString();
	}

}
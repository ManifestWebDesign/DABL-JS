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
		if (arguments.length === 2) {
			var right = arguments[1],
				operator = Query.EQUAL;
		} else {
			var right = arguments[2],
				operator = arguments[1];
		}
		arguments[1] = right;
		arguments[2] = operator;
		return this.addAnd.apply(this, arguments);
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
			if (cond.length !== 2) {
				throw new Error('Only simple equals Conditions can be exported.');
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
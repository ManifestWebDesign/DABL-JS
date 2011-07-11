/**
 * Creates new instance of Query, parameters will be passed to the
 * setTable() method.
 * @return self
 * @param tableName Mixed[optional]
 * @param alias String[optional]
 */
function Query (tableName, alias) {
	this._columns = [];
	this._joins = [];
	this._orders = [];
	this._groups = [];
	this._where = new Condition;
	this.setTable(tableName, alias);
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
	_columns : [],
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
	_extraTables : {},
	/**
	 * @var QueryJoin[]
	 */
	_joins : [],
	/**
	 * @var Condition
	 */
	_where : null,
	/**
	 * @var array
	 */
	_orders : [],
	/**
	 * @var array
	 */
	_groups : [],
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
	 * @param Bool bool
	 */
	setDistinct : function(bool) {
		if (typeof bool == 'undefined') {
			bool = true;
		}
		this._distinct = bool == true;
	},

	/**
	 * Sets the action of the query.  Should be SELECT, DELETE, or COUNT.
	 * @return Query
	 * @param action String
	 */
	setAction : function(action) {
		this._action = action;
		return this;
	},

	/**
	 * Returns the action of the query.  Should be SELECT, DELETE, or COUNT.
	 * @return String
	 */
	getAction : function() {
		return this._action;
	},

	/**
	 * Add a column to the list of columns to select.  If unused, defaults to *.
	 *
	 * {@example libraries/dabl/database/query/Query_addColumn.php}
	 *
	 * @param String column_name
	 * @return Query
	 */
	addColumn : function(columnName) {
		this._columns.push(columnName);
		return this;
	},

	/**
	 * Set array of strings of columns to be selected
	 * @param array columns_array
	 * @return Query
	 */
	setColumns : function(columnsArray) {
		this._columns = columnsArray.slice(0);
		return this;
	},

	/**
	 * Return array of columns to be selected
	 * @return array
	 */
	getColumns : function() {
		return this._columns;
	},

	/**
	 * Set array of strings of groups to be selected
	 * @param array groups_array
	 * @return Query
	 */
	setGroups : function(groupsArray) {
		this._groups = groupsArray;
		return this;
	},

	/**
	 * Return array of groups to be selected
	 * @return array
	 */
	getGroups : function() {
		return this._groups;
	},

	/**
	 * Sets the table to be queried. This can be a string table name
	 * or an instance of Query if you would like to nest queries.
	 * This function also supports arbitrary SQL.
	 *
	 * @param String|Query table_name Name of the table to add, or sub-Query
	 * @param String[optional] alias Alias for the table
	 * @return Query
	 */
	setTable : function(table, alias) {
		if (table instanceof Query) {
			if (!alias) {
				throw new Error('The nested query must have an alias.');
			}
		} else if (typeof alias == 'undefined') {
			var spacePos = table.lastIndexOf(' '), // 11
				asPos = table.toUpperCase().lastIndexOf(' AS '); // 8

			if (asPos !== spacePos - 3) {
				asPos = -1;
			}
			if (spacePos !== -1) {
				alias = table.substr(spacePos + 1);
				table = table.substr(0, asPos === -1 ? spacePos : asPos);
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
	 * @return String
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
	 * @return String
	 */
	getAlias : function() {
		return this._tableAlias;
	},

	/**
	 * @param type table_name
	 * @param type alias
	 * @return Query
	 */
	addTable : function(tableName, alias) {
		if (tableName instanceof Query) {
			if (!alias) {
				throw new Error('The nested query must have an alias.');
			}
		} else if (typeof alias == 'undefined') {
			// find the last space in the string
			var spacePos = tableName.lastIndexOf(' ');
			if (spacePos !== -1) {
				tableName = tableName.substring(0, spacePos);
				alias = tableName.substr(spacePos);
			}
			alias = tableName;
		}

		if (this._extraTables == null) {
			this._extraTables = {};
		}
		this._extraTables[alias] = tableName;
		return this;
	},

	/**
	 * Provide the Condition object to generate the WHERE clause of
	 * the query.
	 *
	 * @param Condition w
	 * @return Query
	 */
	setWhere : function(w) {
		this._where = w;
		return this;
	},

	/**
	 * Returns the Condition object that generates the WHERE clause
	 * of the query.
	 *
	 * @return Condition
	 */
	getWhere : function() {
		return this._where;
	},

	/**
	 * Add a JOIN to the query.
	 *
	 * @todo Support the ON clause being NULL correctly
	 * @param string|Query tableOrColumn Table to join on
	 * @param string|Condition onClauseOrColumn ON clause to join with
	 * @param string joinType Type of JOIN to perform
	 * @return Query
	 */
	addJoin : function(tableOrColumn, onClauseOrColumn, joinType) {
		if (tableOrColumn instanceof QueryJoin) {
			this._joins.push(tableOrColumn);
			return this;
		}

		if (null === onClauseOrColumn) {
			if (joinType == Query.JOIN || joinType == Query.INNER_JOIN) {
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
	 */
	join : function(tableOrColumn, onClauseOrColumn, joinType) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, joinType);
	},

	innerJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.INNER_JOIN);
	},

	leftJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.LEFT_JOIN);
	},

	rightJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.RIGHT_JOIN);
	},

	outerJoin : function(tableOrColumn, onClauseOrColumn) {
		return this.addJoin(tableOrColumn, onClauseOrColumn, Query.OUTER_JOIN);
	},

	getJoins : function() {
		return this._joins;
	},

	setJoins : function(joins) {
		this._joins = joins;
	},

	/**
	 * Shortcut to adding an AND statement to the Query's WHERE Condition.
	 * @return Query
	 * @param column Mixed
	 * @param value Mixed[optional]
	 * @param operator String[optional]
	 * @param quote Int[optional]
	 */
	addAnd : function(column, value, operator, quote) {
		this._where.addAnd.apply(this._where, arguments);
		return this;
	},

	/**
	 * Alias of {@link addAnd()}
	 * @return Query
	 */
	add : function(column, value, operator, quote) {
		return this.addAnd.apply(this, arguments);
	},

	andNot : function(column, value) {
		return this.addAnd(column, value, Query.NOT_EQUAL);
	},

	andLike : function(column, value) {
		return this.addAnd(column, value, Query.LIKE);
	},

	andNotLike : function(column, value) {
		return this.addAnd(column, value, Query.NOT_LIKE);
	},

	andGreater : function(column, value) {
		return this.addAnd(column, value, Query.GREATER_THAN);
	},

	andGreaterEqual : function(column, value) {
		return this.addAnd(column, value, Query.GREATER_EQUAL);
	},

	andLess : function(column, value) {
		return this.addAnd(column, value, Query.LESS_THAN);
	},

	andLessEqual : function(column, value) {
		return this.addAnd(column, value, Query.LESS_EQUAL);
	},

	andNull : function(column) {
		return this.addAnd(column, null);
	},

	andNotNull : function(column) {
		return this.addAnd(column, null, Query.NOT_EQUAL);
	},

	andBetween : function(column, from, to) {
		return this.addAnd(column, array(from, to), Query.BETWEEN);
	},

	/**
	 * Shortcut to adding an OR statement to the Query's WHERE Condition.
	 * @return Query
	 * @param column Mixed
	 * @param value Mixed[optional]
	 * @param operator String[optional]
	 * @param quote Int[optional]
	 */
	addOr : function(column, value, operator, quote) {
		this._where.addOr.apply(this._where, arguments);
		return this;
	},

	orNot : function(column, value) {
		return this.addOr(column, value, Query.NOT_EQUAL);
	},

	orLike : function(column, value) {
		return this.addOr(column, value, Query.LIKE);
	},

	orNotLike : function(column, value) {
		return this.addOr(column, value, Query.NOT_LIKE);
	},

	orGreater : function(column, value) {
		return this.addOr(column, value, Query.GREATER_THAN);
	},

	orGreaterEqual : function(column, value) {
		return this.addOr(column, value, Query.GREATER_EQUAL);
	},

	orLess : function(column, value) {
		return this.addOr(column, value, Query.LESS_THAN);
	},

	orLessEqual : function(column, value) {
		return this.addOr(column, value, Query.LESS_EQUAL);
	},

	orNull : function(column) {
		return this.addOr(column, null);
	},

	orNotNull : function(column) {
		return this.addOr(column, null, Query.NOT_EQUAL);
	},

	orBetween : function(column, from, to) {
		return this.addOr(column, array(from, to), Query.BETWEEN);
	},

	/**
	 * Adds a clolumn to GROUP BY
	 * @return Query
	 * @param column String
	 */
	groupBy : function(column) {
		this._groups.push(column);
		return this;
	},

	/**
	 * Provide the Condition object to generate the HAVING clause of the query
	 * @return Query
	 * @param w Condition
	 */
	setHaving : function(where) {
		this._having = where;
		return this;
	},

	/**
	 * Returns the Condition object that generates the HAVING clause of the query
	 * @return Condition
	 */
	getHaving : function() {
		return this._having;
	},

	/**
	 * Adds a column to ORDER BY in the form of "COLUMN DIRECTION"
	 * @return Query
	 * @param column String
	 */
	orderBy : function(column, dir) {
		if (null !== dir && typeof dir != 'undefined') {
			dir = dir.toUpperCase();
			if (dir != Query.ASC && dir != Query.DESC) {
				throw new Error(dir + ' is not a valid sorting direction.');
			}
			column = column + ' ' + dir;
		}
		this._orders.push(column);
		return this;
	},

	/**
	 * Sets the limit of rows that can be returned
	 * @return Query
	 * @param limit Int
	 */
	setLimit : function(limit) {
		limit = parseInt(limit);
		if (isNaN(limit)) {
			throw new Error('Not a number');
		}
		this._limit = limit;
		return this;
	},

	/**
	 * Returns the LIMIT integer for this Query, if it has one
	 * @return int
	 */
	getLimit : function() {
		return this._limit;
	},

	/**
	 * Sets the offset for the rows returned.  Used to build
	 * the LIMIT part of the query.
	 * @return Query
	 * @param offset Int
	 */
	setOffset : function(offset) {
		offset = parseInt(offset);
		if (isNaN(offset)) {
			throw new Error('Not a number');
		}
		this._offset = offset;
		return this;
	},

	/**
	 * Builds and returns the query string
	 *
	 * @param mixed conn Database connection to use
	 * @return QueryStatement
	 */
	getQuery : function(conn) {
		if (!conn) {
			conn = new Adapter;
		}

		// the QueryStatement for the Query
		var statement = new QueryStatement(conn);

		// the string statement will use
		var queryS = '';

		switch (this._action.toUpperCase()) {
			default:
			case Query.ACTION_COUNT:
			case Query.ACTION_SELECT:
				var columnsStatement = this.getColumnsClause(conn);
				statement.addIdentifiers(columnsStatement.getIdentifiers());
				statement.addParams(columnsStatement.getParams());
				queryS = queryS + 'SELECT ' + columnsStatement.getString();
				break;
			case Query.ACTION_DELETE:
				queryS = queryS + 'DELETE';
				break;
		}

		var tableStatement = this.getTablesClause(conn);
		statement.addIdentifiers(tableStatement.getIdentifiers());
		statement.addParams(tableStatement.getParams());
		queryS = queryS + "\nFROM " + tableStatement.getString();

		if (this._joins.length > 0) {
			for (var j = 0, jlen = this._joins.length; j < jlen; j++) {
				var join = this._joins[j],
					join_statement = join.getQueryStatement(conn);
				queryS = queryS + "\n\t" + join_statement.getString();
				statement.addParams(join_statement.getParams());
				statement.addIdentifiers(join_statement.getIdentifiers());
			}
		}

		var where_statement = this.getWhereClause();

		if (where_statement) {
			queryS = queryS + "\nWHERE " + where_statement.getString();
			statement.addParams(where_statement.getParams());
			statement.addIdentifiers(where_statement.getIdentifiers());
		}

		if (this._groups.length > 0) {
			var clause = this.getGroupByClause();
			statement.addIdentifiers(clause.getIdentifiers());
			statement.addParams(clause.getParams());
			queryS = queryS + clause.getString();
		}

		if (null !== this.getHaving()) {
			var having_statement = this.getHaving().getQueryStatement();
			if (having_statement) {
				queryS = queryS + "\nHAVING " + having_statement.getString();
				statement.addParams(having_statement.getParams());
				statement.addIdentifiers(having_statement.getIdentifiers());
			}
		}

		if (this._action != Query.ACTION_COUNT && this._orders.length > 0) {
			clause = this.getOrderByClause();
			statement.addIdentifiers(clause.getIdentifiers());
			statement.addParams(clause.getParams());
			queryS = queryS + clause.getString();
		}

		if (this._limit) {
			if (conn) {
				queryS = conn.applyLimit(queryS, this._offset, this._limit);
			} else {
				queryS = queryS + "\nLIMIT " + (this._offset ? this._offset + ', ' : '') + this._limit;
			}
		}

		if (this.needsComplexCount() && this._action == Query.ACTION_COUNT) {
			queryS = "SELECT count(0)\nFROM (" + queryS + ") a";
		}

		statement.setString(queryS);
		return statement;
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @return QueryStatement
	 */
	getTablesClause : function(conn) {

		var table = this.getTable();

		if (!table) {
			throw new Error('No table specified.');
		}

		var statement = new QueryStatement(conn),
		alias = this.getAlias();

		// if table is a Query, get its QueryStatement
		if (table instanceof Query) {
			var tableStatement = table.getQuery(conn),
				tableString = '(' + tableStatement.getString() + ')';
		} else {
			tableStatement = null;
		}

		switch (this._action.toUpperCase()) {
			case Query.ACTION_COUNT:
			case Query.ACTION_SELECT:
				// setup identifiers for table_string
				if (null !== tableStatement) {
					statement.addIdentifiers(tableStatement.getIdentifiers());
					statement.addParams(tableStatement.getParams());
				} else {
					// if table has no spaces, assume it is an identifier
					if (table.indexOf(' ') === -1) {
						statement.addIdentifier(table);
						tableString = QueryStatement.IDENTIFIER;
					} else {
						tableString = table;
					}
				}

				// append alias, if it's not empty
				if (alias) {
					tableString = tableString + ' AS ' + alias;
				}

				// setup identifiers for any additional tables
				if (this._extraTables != null) {
					for (var tAlias in this._extraTables) {
						var extraTable = this._extraTables[tAlias];
						if (extraTable instanceof Query) {
							var extra_table_statement = extraTable.getQuery(conn),
								extraTableString = '(' + extra_table_statement.getString() + ') AS ' + tAlias;
							statement.addParams(extra_table_statement.getParams());
							statement.addIdentifiers(extra_table_statement.getIdentifiers());
						} else {
							extraTableString = extraTable;
							if (extraTableString.indexOf(' ') == -1) {
								extraTableString = QueryStatement.IDENTIFIER;
								statement.addIdentifier(extraTable);
							}
							if (tAlias != extraTable) {
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
					statement.addIdentifiers(tableStatement.getIdentifiers());
					statement.addParams(tableStatement.getParams());
				} else {
					// if table has no spaces, assume it is an identifier
					if (table.indexOf(' ') == -1) {
						statement.addIdentifier(table);
						tableString = QueryStatement.IDENTIFIER;
					} else {
						tableString = table;
					}
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
	 * Returns true if this Query uses aggregate functions in either a GROUP BY clause or in the
	 * select columns
	 * @return bool
	 */
	hasAggregates : function() {
		if (this._groups.length > 0) {
			return true;
		}
		for (var c = 0, clen = this._columns.length; c < clen; c++) {
			if (this._columns[c].indexOf('(') != -1) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Returns true if this Query requires a complex count
	 * @return bool
	 */
	needsComplexCount : function() {
		return this.hasAggregates()
		|| null !== this._having
		|| this._distinct;
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @return QueryStatement
	 */
	getColumnsClause : function(conn) {
		var table = this.getTable(), column;

		if (!table) {
			throw new Error('No table specified.');
		}

		var statement = new QueryStatement(conn),
			alias = this.getAlias(),
			action = this._action.toUpperCase();

		if (action == Query.ACTION_DELETE) {
			return statement;
		}

		if (action == Query.ACTION_COUNT) {
			if (!this.needsComplexCount()) {
				statement.setString('count(0)');
				return statement;
			}

			if (this._groups.length > 0) {
				var groups = this._groups.slice(0);
				for (var x = 0, length = groups.length; x < length; x ++) {
					statement.addIdentifier(groups[x]);
					groups[x] = QueryStatement.IDENTIFIER;
				}
				statement.setString(groups.join(', '));
				return statement;
			}

			if (!this._distinct && null === this.getHaving() && this._columns.length > 0) {
				var columnsToUse = [];
				for (var c = 0, clen = this._columns.length; c < clen; c++) {
					column = this._columns[c];
					if (column.indexOf('(') == -1) {
						continue;
					}
					statement.addIdentifier(column);
					columnsToUse.push(QueryStatement.IDENTIFIER);
				}
				if (columnsToUse) {
					statement.setString(columnsToUse.join(', '));
					return statement;
				}
			}
		}

		var columns_string;

		// setup columns_string
		if (this._columns.length > 0) {
			for (var c = 0, clen = this._columns.length; c < clen; c++) {
				column = this._columns[c];
				statement.addIdentifier(column);
				column = QueryStatement.IDENTIFIER;
			}
			columns_string = this._columns.join(', ');
		} else if (alias) {
			// default to selecting only columns from the target table
			columns_string = alias + '.*';
		} else {
			// default to selecting only columns from the target table
			columns_string = QueryStatement.IDENTIFIER + '.*';
			statement.addIdentifier(table);
		}

		if (this._distinct) {
			columns_string = 'DISTINCT ' + columns_string;
		}

		statement.setString(columns_string);
		return statement;
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @return QueryStatement
	 */
	getWhereClause : function(conn) {
		return this.getWhere().getQueryStatement();
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @return QueryStatement
	 */
	getOrderByClause : function(conn) {
		var statement = new QueryStatement(conn),
		orders = this._orders.slice(0);

		for (var x = 0, len = orders.length; x < len; x++) {
			var order = orders[x],
				order_parts = order.split(' ');
			if (order_parts.length > 1) {
				statement.addIdentifier(order_parts[0]);
				order_parts[0] = QueryStatement.IDENTIFIER;
			}
			orders[x] = order_parts.join(' ');
		}
		statement.setString("\nORDER BY " + orders.join(', '));
		return statement;
	},

	/**
	 * Protected for now.  Likely to be public in the future.
	 * @return QueryStatement
	 */
	getGroupByClause : function(conn) {
		var statement = new QueryStatement(conn);
		if (this._groups.length > 0) {
			var groups = this._groups.slice(0);
			for (var x = 0, len = groups.length; x < len; x++) {
				statement.addIdentifier(groups[x]);
				groups[x] = QueryStatement.IDENTIFIER;
			}
			statement.setString("\nGROUP BY " + groups.join(', '));
		}
		return statement;
	},

	/**
	 * @return string
	 */
	toString : function() {
		if (!this.getTable())
			this.setTable('{UNSPECIFIED-TABLE}');
		return this.getQuery().toString();
	},

	/**
	 * Returns a count of rows for result
	 * @return int
	 * @param conn PDO[optional]
	 */
	doCount : function(conn) {
		if (!this.getTable()) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_COUNT);
		return parseInt(this.getQuery(conn).bindAndExecute().fetchColumn(), 10);
	},

	/**
	 * Executes DELETE query and returns count of
	 * rows deleted.
	 * @return int
	 * @param conn PDO[optional]
	 */
	doDelete : function(conn) {
		if (!this.getTable()) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_DELETE);
		return this.getQuery(conn).bindAndExecute().rowCount();
	},

	/**
	 * Executes SELECT query and returns a result set.
	 * @return PDOStatement
	 * @param conn PDO[optional]
	 */
	doSelect : function(conn) {
		if (!this.getTable()) {
			throw new Error('No table specified.');
		}

		this.setAction(Query.ACTION_SELECT);
		return this.getQuery(conn).bindAndExecute();
	}
};
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

		if (this._action === Query.ACTION_COUNT) {
			r.count_only = 1;
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
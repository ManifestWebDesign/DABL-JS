
function QueryJoin(tableOrColumn, onClauseOrColumn, joinType) {
	if (typeof joinType == 'undefined') {
		joinType = Query.JOIN;
	}

	// check for Propel type join: table.column, table.column
	if (
		!(tableOrColumn instanceof Query)
		&& !(onClauseOrColumn instanceof Condition)
		&& onClauseOrColumn.indexOf('=') === -1
		&& onClauseOrColumn.indexOf(' ') === -1
		&& onClauseOrColumn.indexOf('(') === -1
		&& onClauseOrColumn.indexOf('.') !== -1 && onClauseOrColumn.indexOf('.') == onClauseOrColumn.lastIndexOf('.')
		&& tableOrColumn.indexOf(' ') === -1
		&& tableOrColumn.indexOf('=') === -1
		&& tableOrColumn.indexOf('(') === -1
		&& tableOrColumn.indexOf('.') !== -1 && tableOrColumn.indexOf('.') == tableOrColumn.lastIndexOf('.')
		) {
		this._isLikePropel = true;
		this._leftColumn = tableOrColumn;
		this._rightColumn = onClauseOrColumn;
		this.setTable(this._rightColumn.split('.').shift());
		this.setJoinType(joinType);
		return;
	}

	this.setTable(tableOrColumn)
	.setOnClause(onClauseOrColumn)
	.setJoinType(joinType);
}

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
	 * @return string
	 */
	toString : function() {
		if (!this.getTable()) {
			this.setTable('{UNSPECIFIED-TABLE}');
		}
		return this.getQueryStatement().toString();
	},

	/**
	 * @param mixed table_name
	 * @return QueryJoin
	 */
	setTable : function(tableName) {
		var space = tableName.lastIndexOf(' '),
			as = tableName.toUpperCase().lastIndexOf(' AS ');
		if (as != space - 3) {
			as = -1;
		}
		if (space != -1) {
			this.setAlias(tableName.substr(space + 1));
			tableName = tableName.substring(0, as === -1 ? space : as);
		}
		this._table = tableName;
		return this;
	},

	/**
	 * @param string alias
	 * @return QueryJoin
	 */
	setAlias : function(alias) {
		this._alias = alias;
		return this;
	},

	/**
	 * @param Condition on_clause
	 * @return QueryJoin
	 */
	setOnClause : function(onClause) {
		this._isLikePropel = false;
		this._onClause = onClause;
		return this;
	},

	/**
	 * @param string join_type
	 * @return QueryJoin
	 */
	setJoinType : function(joinType) {
		this._joinType = joinType;
		return this;
	},

	/**
	 * @param DABLPDO conn
	 * @return QueryStatement
	 */
	getQueryStatement : function(conn) {
		var statement = new QueryStatement(conn),
			table = this._table,
			onClause = this._onClause,
			joinType = this._joinType,
			alias = this._alias;

		if (table instanceof Query) {
			var tableStatement = table.getQuery(conn);
			table = '(' + tableStatement.getString() + ')';
			statement.addParams(tableStatement.getParams());
			statement.addIdentifiers(tableStatement.getIdentifiers());
		} else {
			statement.addIdentifier(table);
			table = QueryStatement.IDENTIFIER;
		}

		if (alias) {
			table += ' AS ' + alias;
		}

		if (this._isLikePropel) {
			statement.addIdentifiers([this._leftColumn, this._rightColumn]);
			onClause = QueryStatement.IDENTIFIER + ' = ' + QueryStatement.IDENTIFIER;
		} else if (null === onClause) {
			onClause = '1 = 1';
		} else if (onClause instanceof Condition) {
			var onClauseStatement = onClause.getQueryStatement();
			onClause = onClauseStatement.getString();
			statement.addParams(onClauseStatement.getParams());
			statement.addIdentifiers(onClauseStatement.getIdentifiers());
		}

		if ('' !== onClause) {
			onClause = 'ON (' + onClause + ')';
		}

		statement.setString(joinType + ' ' + table + ' ' + onClause);
		return statement;
	},

	/**
	 * @return mixed
	 */
	getTable : function() {
		return this._table;
	},

	/**
	 * @return string
	 */
	getAlias : function() {
		return this._alias;
	},

	/**
	 * @return mixed
	 */
	getOnClause : function() {
		if (this._isLikePropel) {
			return this._leftColumn + ' = ' + this._rightColumn;
		}
		return this._onClause;
	},

	/**
	 * @return string
	 */
	getJoinType : function() {
		return this._joinType;
	}

};
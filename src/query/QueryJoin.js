(function(){

var isIdent = /^\w+\.\w+$/;

this.QueryJoin = function QueryJoin(tableOrColumn, onClauseOrColumn, joinType) {
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

})();
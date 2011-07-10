function QueryStatement(conn) {
	if (conn) {
		this.setConnection(conn);
	}
}

/**
 * character to use as a placeholder for a quoted identifier
 */
QueryStatement.IDENTIFIER = '[?]';

/**
 * character to use as a placeholder for an escaped parameter
 */
QueryStatement.PARAM = '?';

QueryStatement.embed = function(string, array, placeholder) {
	if (string.split(placeholder).length - 1 != array.length) {
		throw new Error('The number of occurances of ' + placeholder + ' do not match the number of _identifiers.');
	}

	if (array.length == 0) {
		return string;
	}

	var currentIndex = string.length;
	var pLength = placeholder.length;
	for (var x = array.length - 1; x >= 0; x--) {
		var identifier = array[x];
		currentIndex = string.lastIndexOf(placeholder, currentIndex);
		if (currentIndex == -1) {
			throw new Error('The number of occurances of ' + placeholder + ' do not match the number of _identifiers.');
		}
		string = string.substring(0, currentIndex) + identifier + string.substr(currentIndex + pLength);
	}

	return string;
}

QueryStatement.embedIdentifiers = function(string, _identifiers, conn) {
	if (conn) {
		_identifiers = conn.quoteIdentifier(_identifiers);
	}
	return this.embed(string, _identifiers, this.IDENTIFIER);
};

/**
 * Emulates a prepared statement.  Should only be used as a last resort.
 * @param string
 * @param _params
 * @param conn
 * @return string
 */
QueryStatement.embedParams = function(string, _params, conn) {
	if (conn) {
		_params = conn.prepareInput(_params);
	}
	return this.embed(string, _params, this.PARAM);
};

QueryStatement.prototype = {

	/**
	 * @var string
	 */
	_queryString : '',
	/**
	 * @var array
	 */
	_params : [],
	/**
	 * @var DABLPDO
	 */
	connection : null,
	/**
	 * @var array
	 */
	_identifiers : [],

	/**
	 * Sets the PDO connection to be used for preparing and
	 * executing the query
	 * @param DABLPDO conn
	 */
	setConnection : function(conn) {
		this.connection = conn;
	},

	/**
	 * @return DABLPDO
	 */
	getConnection : function() {
		return this.connection;
	},

	/**
	 * Sets the SQL string to be used in a query
	 * @param string string
	 */
	setString : function(string) {
		this._queryString = string;
	},

	/**
	 * @return string
	 */
	getString : function() {
		return this._queryString;
	},

	/**
	 * Merges given array into _params
	 * @param array _params
	 */
	addParams : function(params) {
		this._params = this._params.concat(params);
	},

	/**
	 * Replaces params with given array
	 * @param array
	 */
	setParams : function(params) {
		this._params = params.slice(0);
	},

	/**
	 * Adds given param to param array
	 * @param mixed param
	 */
	addParam : function(param) {
		this._params.push(param);
	},

	/**
	 * @return array
	 */
	getParams : function() {
		return this._params.slice(0);;
	},

	/**
	 * Merges given array into idents
	 * @param array identifiers
	 */
	addIdentifiers : function(identifiers) {
		this._identifiers = this._identifiers.concat(identifiers);
	},

	/**
	 * Replaces idents with given array
	 * @param array identifiers
	 */
	setIdentifiers : function(identifiers) {
		this._identifiers = identifiers.slice(0);;
	},

	/**
	 * Adds given param to param array
	 * @param mixed identifier
	 */
	addIdentifier : function(identifier) {
		this._identifiers.push(identifier);
	},

	/**
	 * @return array
	 */
	getIdentifiers : function() {
		return this._identifiers.slice(0);
	},

	/**
	 * @return string
	 */
	toString : function() {
		var string = QueryStatement.embedIdentifiers(this._queryString, this._identifiers.slice(0), this.connection);
		return QueryStatement.embedParams(string, this._params.slice(0), this.connection);
	},

	/**
	 * Creates a PDOStatment using the string. Loops through param array, and binds each value.
	 * Executes and returns the prepared statement.
	 * @return PDOStatement
	 */
	bindAndExecute : function() {
		var conn = this.getConnection(),
			string = QueryStatement.embedIdentifiers(this._queryString, this._identifiers, conn),
			result;

//		var result = conn.prepare(string);
//		foreach (this.getParams() as key => value) {
//			pdo_type = PDO::PARAM_STR;
//			if (is_int(value)) {
//				pdo_type = PDO::PARAM_INT;
//			} elseif (is_null(value)) {
//				pdo_type = PDO::PARAM_NULL;
//			} elseif (is_bool(value)) {
//				value = value ? 1 : 0;
//				pdo_type = PDO::PARAM_INT;
//			}
//			result.bindValue(key + 1, value, pdo_type);
//		}
//		result.execute();
		return result;
	}
};
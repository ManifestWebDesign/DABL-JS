(function(){

this.QueryStatement = function QueryStatement(conn) {
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

})();
function ResultSet(sql) {
	this.sql = sql;
	console.log('Executing SQL: ' + sql);
}

ResultSet.prototype = {
	sql : "",
	constructor: ResultSet,
	rowCount: function() {
		return 1;
	},
	close : function() {},
	field : function() {
		return 1;
	},
	fieldByName	: function(fieldName) {
		return 1;
	},
	fieldCount	: function() {
		return 1;
	},
	fieldName : function(index) {
		return 'fieldName';
	},
	isValidRow : function() {
		return false;
	},
	next : function() {}
};
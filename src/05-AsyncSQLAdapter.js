(function(){

var asyncMethods = [
	'find',
	'findAll',
	'countAll',
	'destroyAll',
	'updateAll',
	'insert',
	'update',
	'destroy'
];

var props = {
	init: function AsyncSQLAdapter(db) {
		this._super(db);
	}
};

for (var x = 0, l = asyncMethods.length; x < l; ++x) {
	var method = asyncMethods[x];
	props[method] = function() {
		var def = new Deferred();
		try {
			def.resolve(this._super.apply(this, arguments));
		} catch (e) {
			def.reject({
				errors: [e]
			});
		}
		return def.promise();
	};
}

this.AsyncSQLAdapter = SQLAdapter.extend(props);

})();
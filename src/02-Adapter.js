(function(){

function _sPad(value) {
	value = value + '';
	return value.length == 2 ? value : '0' + value;
}

var Adapter = Class.extend({

	init: function Adapter() {
	},

	formatDate: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		return value.getFullYear() + '-' + _sPad(value.getMonth() + 1) + '-' + _sPad(value.getDate());
	},

	formatDateTime: function(value) {
		if (!(value instanceof Date)) {
			value = new Date(value);
		}
		return this.formatDate(value) + ' ' + _sPad(value.getHours()) + ':' + _sPad(value.getMinutes()) + ':' + _sPad(value.getSeconds());
	},

	find: function(model){
		throw new Error('find not implemented for this adapter');
	},

	findAll: function(model) {
		throw new Error('findAll not implemented for this adapter');
	},

	/**
	 * @param q
	 * @return int
	 */
	countAll: function(model, q) {
		throw new Error('countAll not implemented for this adapter');
	},

	/**
	 * @param q
	 * @return int
	 */
	destroyAll: function(model, q) {
		throw new Error('destroyAll not implemented for this adapter');
	},

	insert: function(instance, onSuccess, onError) {
		throw new Error('insert not implemented for this adapter');
	},

	update: function(instance, onSuccess, onError) {
		throw new Error('update not implemented for this adapter');
	},

	destroy: function(instance, onSuccess, onError) {
		throw new Error('destroy not implemented for this adapter');
	}
});

Adapter.adapters = [];

Adapter.getAdapter = function() {
	if (0 === this.adapters.length) {
		this.adapters.push(new this);
	}
	return this.adapters[0];
};

this.Adapter = Adapter;

})();
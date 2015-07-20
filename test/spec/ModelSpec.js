describe('Model', function() {
	var foo,
		a = new dabl.SQLAdapter(new dabl.SQLAdapter.TiDebugDB),
		now = new Date(Date.now()),
		Model = dabl.Model,
		Deferred = dabl.Deferred,
		Foo = Model.extend('foo', {
			adapter: a,
			fields: {
				id: { type: 'int', key: true, computed: true },
				name: { type: String, value: 'default name for entity', required: true },
				list: Array,
				opts: JSON,
				created: { type: Date, value: now},
				updated: Date
			}
		}),
		Bar = Model.extend('bar', {
			adapter: a,
			fields: {
				id: { type: 'int', key: true, computed: true }
			}
		}),
		asyncSpy;

	Foo.addField('bar', {
		type: Bar
	});
	Foo.addField('bars', {
		type: Array, elementType: Bar
	});

	beforeEach(function() {
		foo = new Foo;
		asyncSpy = jasmine.createSpy('asyncCallback');
	});

	describe('init', function(){
		it ('should set default values', function() {
			expect(foo.name).toBe('default name for entity');
			expect(foo.created).not.toBe(now);
			expect(foo.created.getTime()).toBe(now.getTime());
			expect(foo.list.constructor).toBe(Array);
		});
		it ('should make copies of default values that are objects', function() {
			expect(foo.created).not.toBe(now);
		});
		it ('should not consider default values to be modifications', function() {
			expect(foo.isModified()).toBe(false);
		});
		it ('should accept a hash of values', function() {
			var myList = ['a', 'b', 'c'];
			foo = new Foo({
				name: 'bar',
				list: myList,
				bar: {
					id: 7
				}
			});
			expect(foo.name).toBe('bar');
			expect(foo.list).toBe(myList);
			expect(foo.bar.constructor).toBe(Bar);
		});
	});

	describe('fromJSON', function(){
		it ('should convert a JSON string to an object if type is JSON', function(){
			foo.fromJSON({
				opts: '{"x":"123","y":[{"z":[1]}],"z":true}'
			});
			expect(foo.opts).toEqual({"x":"123","y":[{"z":[1]}],"z":true});
		});
	});

	describe('toString', function(){
		it ('should return the object\'s table name and a string hash of values', function(){
			foo.fromJSON({
				name: 'bar',
				list: ['1'],
				bar: {},
				bars: [],
				created: null,
				updated: null
			});
			expect(foo.toString()).toEqual('foo:{"id":null,"name":"bar","list":["1"],"opts":"null","created":null,"updated":null,"bar":{"id":null},"bars":[]}');
		});
	});

	describe('copy', function() {
		it ('should copy all values to a new object and clear the PK if there is only 1 PK', function(){
			foo.id = 7;
			var foo2 = foo.copy();
			expect(foo2).not.toBe(foo);
			expect(foo2.id).toBe(null);
		});
	});

	describe('isModified', function() {
		it ('should return true if no column is specified and the instance is modified', function(){
			expect(foo.isModified()).toBe(false);
			foo.created = new Date(Date.now());
			expect(foo.isModified()).toBe(true);
		});
		it ('should return true if a column is specified and that column is modified', function(){
			expect(foo.isModified()).toBe(false);
			foo.created = new Date(Date.now());
			expect(foo.isModified('id')).toBe(false);
			expect(foo.isModified('created')).toBe(true);
		});
		it ('should return true if a complex (Object) property is modified', function(){
			expect(foo.isModified()).toBe(false);
			foo.bar = new Bar;
			expect(foo.isModified()).toBe(true);
			foo.resetModified();
			expect(foo.isModified()).toBe(false);
			foo.bar.id = 27;
			expect(foo.isModified()).toBe(true);
		});

		it ('should return false for unmodified JSON type', function(){
			expect(foo.isModified()).toBe(false);
			foo.opts = {foobar: true};
			expect(foo.isModified()).toBe(true);
			foo.resetModified();
			expect(foo.isModified()).toBe(false);
			foo.opts = {foobar: false};
			expect(foo.isModified()).toBe(true);

			foo.fromJSON({
				opts: '{"x":"123","y":[{"z":[1]}],"z":true}'
			});
			foo.resetModified();
			foo.opts = {"x":"123","y":[{"z":[1]}],"z":true};
			expect(foo.isModified()).toBe(false);
		});
	});

	describe('getModified', function() {
		it ('should return a hash, with indexes for modified field names and values set to true', function(){
			foo.created = new Date(Date.now());
			expect(foo.getModified()).toEqual({
				created: true
			});
		});
	});

	describe('resetModified', function() {
		it ('should reset the internal hash of previous values so that isModified returns false', function(){
			foo.created = new Date(Date.now());
			expect(foo.isModified()).toBe(true);
			foo.resetModified();
			expect(foo.isModified()).toBe(false);
			foo.revert();
			expect(foo.created).not.toBe(null);
		});
	});

	describe('revert', function() {
		it ('should reset values to the last known unmodified state', function(){
			expect(foo.updated).toBe(null);
			foo.updated = new Date(Date.now());
			expect(foo.isModified()).toBe(true);
			foo.revert();
			expect(foo.updated).toBe(null);
		});
	});

	describe('toJSON', function() {
		it ('should return a JSON object', function(){
			expect(foo.toJSON().constructor).toBe(Object);
		});
		it ('should convert nested objects and arrays to JSON as well', function(){
			var bar = foo.bar = {
				id: 1
			};
			var bar2 = new Bar({
				id: 2
			});
			foo.list = ['a', 'b'];
			foo.bars.push(bar);
			foo.bars.push(bar2);
			expect(foo.bar.constructor).not.toBe(Bar);
			expect(foo.bars[0].constructor).toBe(Bar);
			expect(foo.bars[1]).toBe(bar2);
			var json = foo.toJSON();
			expect(foo.bar.constructor).toBe(Bar);
			expect(json.bar.constructor).not.toBe(Bar);
			expect(json.bar.constructor).toBe(Object);
			expect(json.bar).not.toBe(bar);
			expect(json.bar.id).toBe(1);
			expect(json.list).not.toBe(foo.list);
			expect(json.bars[0]).not.toBe(bar);
			expect(json.bars[1]).not.toBe(bar2);
		});
	});

	describe('hasKeyValues', function() {
		it ('should return true if the instance has values for the key column', function(){
			expect(foo.hasKeyValues()).toBe(false);
			foo.id = 10;
			foo.id = 0;
			expect(foo.hasKeyValues()).toBe(true);
		});
	});

	describe('getKeyValues', function() {
		it ('should return an Object hash with the instance\'s key values', function(){
			foo.id = 10;
			expect(foo.getKeyValues()).toEqual({
				id: 10
			});
		});
	});

	describe('isNew', function() {
		it ('should return true if the object has not yet been saved', function(){
			expect(foo.isNew()).toBe(true);
			foo.save(function(){
				expect(foo.isNew()).toBe(false);
			}, function(e){
				console.log(e.stack);
				expect(foo.isNew()).toBe(false);
			});
		});
	});

	describe('validate', function() {
		it ('should false if the instance has required fields that are empty', function(){
			expect(foo.validate()).toBe(true);
			foo.name = null;
			expect(foo.validate()).toBe(false);
		});
		it ('should populate an internal list of validation errors if validation fails', function(){
			expect(foo.validate()).toBe(true);
			expect(foo.getValidationErrors().length).toBe(0);

			foo.name = null;
			expect(foo.getValidationErrors().length).toBe(0);

			expect(foo.validate()).toBe(false);
			expect(foo.getValidationErrors().length).toBe(1);
		});
	});

	describe('save', function() {
		it ('should return a Promise and accept success and error callbacks', function(){
			var result = foo.save(asyncSpy, asyncSpy);
			expect(result.constructor).toBe(Deferred().promise().constructor);
			expect(asyncSpy).toHaveBeenCalled();
			expect(asyncSpy.calls.length).toBe(1);
		});
	});

	describe('insert', function() {
		it ('should return a Promise and accept success and error callbacks', function(){
			var result = foo.insert(asyncSpy, asyncSpy);
			expect(result.constructor).toBe(Deferred().promise().constructor);
			expect(asyncSpy).toHaveBeenCalled();
			expect(asyncSpy.calls.length).toBe(1);
		});
	});

	describe('update', function() {
		it ('should return a Promise and accept success and error callbacks', function(){
			var result = foo.update(asyncSpy, asyncSpy);
			expect(result.constructor).toBe(Deferred().promise().constructor);
			expect(asyncSpy).toHaveBeenCalled();
			expect(asyncSpy.calls.length).toBe(1);
		});
	});

	describe('remove', function() {
		it ('should return a Promise and accept success and error callbacks', function(){
			var result = foo.remove(asyncSpy, asyncSpy);
			expect(result.constructor).toBe(Deferred().promise().constructor);
			expect(asyncSpy).toHaveBeenCalled();
			expect(asyncSpy.calls.length).toBe(1);
		});
	});

	describe('inflate', function() {
		it ('should return an instance of the model', function(){
			expect(Foo.inflate({}) instanceof Foo).toBe(true);
		});
		it ('should return an instance with isNew and isModified false', function(){
			foo = Foo.inflate({
				id: 23,
				name: 'joe',
				created: new Date()
			});
			expect(foo.isNew()).toBe(false);
			expect(foo.isModified()).toBe(false);
		});
		it ('should use the model\'s adapter cache to avoid duplicate instances for the same key', function(){
			foo = Foo.inflate({
				id: 1
			});
			Foo.getAdapter().cache(Foo.getTableName(), 1, foo);
			var foo2 = Foo.inflate({
				id: 1
			});
			expect(foo).toBe(foo2);
		});
	});

	describe('inflateArray', function(){
		it ('should convert an array to an array of instances', function(){
			var array = [{
				id: 1
			}];
			Foo.inflateArray(array);
			expect(array[0] instanceof Foo).toBe(true);
			expect(array);
		});
	});

	describe('convertArray', function(){
		var array = [];
		Bar.convertArray(array, Bar);

		it ('should convert array inputs and outputs to be instances of the proper class', function(){
			// push
			array.push({});
			expect(array[0] instanceof Bar).toBe(true);
			array.pop();

			expect(array.length).toBe(0);

			// pop
			array[0] = {};
			expect(array.pop() instanceof Bar).toBe(true);

			expect(array.length).toBe(0);

			// shift
			array[0] = {};
			expect(array.shift() instanceof Bar).toBe(true);

			expect(array.length).toBe(0);

			// unshift
			array.unshift({});
			expect(array[0] instanceof Bar).toBe(true);
			array.shift();

			expect(array.length).toBe(0);

			// slice
			array[0] = {};
			expect(array.slice(0)[0] instanceof Bar).toBe(true);
			array.shift();

			expect(array.length).toBe(0);

			// concat
			expect(array.concat([{}])[0] instanceof Bar).toBe(true);

			expect(array.length).toBe(0);

			// splice
			array[0] = {};
			array[1] = {};
			expect(array.length).toBe(2);
			var removed = array.splice(1, 1, {});
			expect(removed[0] instanceof Bar).toBe(true);
			expect(array[1] instanceof Bar).toBe(true);
			expect(array.length).toBe(2);
			array.shift();
			array.shift();

			expect(array.length).toBe(0);

			array[0] = {};
			array[0] = {};
			array.forEach(function(value){
				expect(value instanceof Bar).toBe(true);
			});

			array.every(function(value){
				expect(value instanceof Bar).toBe(true);
			});

			array.map(function(value){
				expect(value instanceof Bar).toBe(true);
			});

			array.some(function(value){
				expect(value instanceof Bar).toBe(true);
			});

			expect(array[0] instanceof Bar).toBe(false);
		});
	});

	describe ('coerceValue', function() {
		it ('should cast strings', function(){
			expect(Model.coerceValue(1, { type: Model.FIELD_TYPE_TEXT })).toBe('1');
			expect(Model.coerceValue(1, { type: Model.FIELD_TYPE_TEXT })).not.toBe(1);

			expect(Model.coerceValue({toString: function(){
				return 1;
			}}, { type: Model.FIELD_TYPE_TEXT })).toBe('1');
		});

		it ('should cast integers', function(){
			expect(Model.coerceValue(1.1, { type: Model.FIELD_TYPE_INTEGER })).toBe(1);
			expect(Model.coerceValue('1', { type: Model.FIELD_TYPE_INTEGER })).toBe(1);
		});

		it ('should cast floats', function(){
			expect(Model.coerceValue(1.1, { type: Model.FIELD_TYPE_NUMERIC })).toBe(1.1);
			expect(Model.coerceValue('1', { type: Model.FIELD_TYPE_NUMERIC })).toBe(1);
			expect(Model.coerceValue('1.5', { type: Model.FIELD_TYPE_NUMERIC })).toBe(1.5);
		});

		it ('should cast Dates', function(){
			var date = Model.coerceValue('2012-05-14', { type: Model.FIELD_TYPE_TIMESTAMP });
			expect(date.getTime()).toBe(new Date('2012-05-14').getTime());

			date = Model.coerceValue('2012-05-14 12:47:01', { type: Model.FIELD_TYPE_TIMESTAMP });
			expect(date.getTime()).toBe(new Date('2012-05-14 12:47:01').getTime());

			date = Model.coerceValue('5/14/2012', { type: Model.FIELD_TYPE_TIMESTAMP });
			expect(date.getTime()).toBe(new Date('5/14/2012').getTime());
		});

		it ('should cast Models', function(){
			expect(Model.coerceValue({}, { type: Bar }) instanceof Bar).toBe(true);
		});

		it ('should cast arrays of simple types', function(){
			expect(Model.coerceValue([1], { type: Array, elementType: Model.FIELD_TYPE_TEXT })[0]).toBe(['1'][0]);
		});

		it ('should cast arrays of Models', function(){
			expect(Model.coerceValue([{}], { type: Array, elementType: Bar })[0] instanceof Bar).toBe(true);
		});
	});
});
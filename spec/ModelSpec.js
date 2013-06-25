describe('Model', function() {
	var foo,
		now = new Date(Date.now()),
		Foo = Model.extend('foo', {
			adapter: new SQLAdapter(new SQLAdapter.TiDebugDB),
			fields: {
				id: { type: 'int', key: true, computed: true },
				name: { type: String, value: 'default name for entity', required: true },
				list: Array,
				created: { type: Date, value: now},
				updated: Date
			}
		}),
		Bar = Model.extend('bar', {
			adapter: new SQLAdapter(new SQLAdapter.TiDebugDB),
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
			expect(foo.toString()).toEqual('foo:{"id":null,"name":"bar","list":["1"],"created":null,"updated":null,"bar":{"id":null},"bars":[]}');
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
			expect(foo.bar.constructor).toBe(Bar);
			expect(foo.bars[0].constructor).toBe(Bar);
			expect(foo.bars[1]).toBe(bar2);
			expect(foo.toJSON().bar.constructor).not.toBe(Bar);
			expect(foo.toJSON().bar.constructor).toBe(Object);
			expect(foo.toJSON().bar).not.toBe(bar);
			expect(foo.toJSON().bar.id).toBe(1);
			expect(foo.toJSON().list).not.toBe(foo.list);
			expect(foo.toJSON().bars[0]).not.toBe(bar);
			expect(foo.toJSON().bars[1]).not.toBe(bar2);
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
			foo.save();
			expect(foo.isNew()).toBe(false);
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

	describe('destroy', function() {
		it ('should return a Promise and accept success and error callbacks', function(){
			var result = foo.destroy(asyncSpy, asyncSpy);
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
});
describe('Adapter', function() {
	var a,
		Foo = Model.extend('foo', {
			adapter: new SQLAdapter(new SQLAdapter.TiDebugDB),
			fields: {
				id: { type: 'int', key: true, computed: true },
				name: { type: String, value: 'default name for entity', required: true },
				foo: String,
				list: Array
			}
		});

	beforeEach(function() {
		a = new SQLAdapter(new SQLAdapter.TiDebugDB);
	});

	function norm(str) {
		if (!str) {
			return '';
		}
		return str.toString().replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
	}

	describe('findQuery', function() {
		it ('should accept a hash of field names and values', function() {
			var q = a.findQuery(Foo, {
				'name': 'foo',
				'foo': 'bar'
			});
			expect(norm(q.getQuery(a)))
				.toBe("SELECT foo.* FROM foo WHERE name = 'foo' AND foo = 'bar'");
		});

		it ('should accept a Query', function() {
			var q = new Query;
			q.and('name', 'eq', 'foo');
			q.and('foo', 'bar');

			q = a.findQuery(Foo, q);
			expect(norm(q.getQuery(a)))
				.toBe("SELECT foo.* FROM foo WHERE name = 'foo' AND foo = 'bar'");
		});

		it ('should accept an integer key', function() {
			var q = a.findQuery(Foo, 1);
			expect(norm(q.getQuery(a)))
				.toBe("SELECT foo.* FROM foo WHERE id = 1");

			q = a.findQuery(Foo, '1');
			expect(norm(q.getQuery(a)))
				.toBe("SELECT foo.* FROM foo WHERE id = 1");
		});

		it ('should accept a Condition', function() {
			var q = a.findQuery(Foo, new Condition('name', 'eq', 'dan'));
			expect(norm(q.getQuery(a)))
				.toBe("SELECT foo.* FROM foo WHERE ( name = 'dan')");
		});

		it ('should accept Condition arguments', function() {
			var q = a.findQuery(Foo, 'name', 'eq', 'dan');
			expect(norm(q.getQuery(a)))
				.toBe("SELECT foo.* FROM foo WHERE name = 'dan'");

			q = a.findQuery(Foo, 'name', 'eq', 'dan', Condition.QUOTE_LEFT);
			expect(norm(q.getQuery(a)))
				.toBe("SELECT foo.* FROM foo WHERE 'name' = dan");
		});
	});

});
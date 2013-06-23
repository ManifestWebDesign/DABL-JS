describe('Model', function() {
	var foo,
		Foo = Model.extend('foo', {
			adapter: new SQLAdapter,
			fields: {
				id: { type: 'int', key: true, computed: true },
				name: { type: String, value: 'default name for entity' },
				created: Date,
				updated: Date
			}
		});

	beforeEach(function() {
		foo = new Foo;
	});
});
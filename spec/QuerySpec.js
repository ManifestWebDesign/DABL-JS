describe('Query', function() {
	var q,
		a = new SQLAdapter;

	beforeEach(function() {
		q = new Query('table', 'a');
	});

	function norm(str) {
		if (!str) {
			return '';
		}
		return str.toString().replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
	}

	describe('init', function() {
		it ('should accept a hash of conditions', function() {
			q = new Query({
				'foo': 'bar'
			});
			expect(norm(q.getWhereClause(a))).toBe("foo = 'bar'");
			expect(function() {
				q.getTablesClause(a);
			}).toThrow();
		});

		it ('should accept a table and alias', function() {
			expect(norm(q.getTablesClause(a))).toBe('table AS a');
			expect(norm(q.getWhereClause(a))).toBe('');
		});
	});

	describe('setDistinct', function(){
		it ('should make the query distinct', function(){
			q.setDistinct(true);
			expect(norm(q.getQuery(a))).toBe('SELECT DISTINCT a.* FROM table AS a');

			q.setDistinct(false);
			expect(norm(q.getQuery(a))).toBe('SELECT a.* FROM table AS a');
		});
	});

	describe('setAction', function(){
		it ('should change the query to SELECT, DELETE, or SELECT count()', function(){
			q.setAction(Query.ACTION_SELECT);
			expect(norm(q.getQuery(a))).toBe('SELECT a.* FROM table AS a');

			q.setAction(Query.ACTION_DELETE);
			expect(norm(q.getQuery(a))).toBe('DELETE FROM table AS a');
		});

		it ('should not allow invalid actions', function(){
			expect(function(){
				q.setAction('foo');
			}).toThrow();
		});
	});

	describe('addColumn', function(){
		it ('should add to and not subtract from the column selection', function(){
			q.addColumn('a');
			expect(norm(q.getQuery(a))).toBe('SELECT a FROM table AS a');

			q.addColumn('b');
			expect(norm(q.getQuery(a))).toBe('SELECT a, b FROM table AS a');
		});

		xit ('should accept a column alias as a second argument', function(){
			q.addColumn('foo', 'bar');
			expect(norm(q.getQuery(a))).toBe('SELECT foo AS bar FROM table AS a');
		});
	});

	describe('setColumns', function(){
		it ('should change the column selection', function(){
			q.setColumns(['a', 'b', 'c']);
			expect(norm(q.getQuery(a))).toBe('SELECT a, b, c FROM table AS a');
		});
	});

	describe('addTable', function(){
		it ('should add and not subtract from the table list', function(){
			q.addTable('another');
			expect(norm(q.getQuery(a))).toBe('SELECT a.* FROM table AS a, another');
		});

		it ('should accept a Query instance', function(){
			q.addTable(new Query('foo'), 'bar');
			expect(norm(q.getQuery(a))).toBe('SELECT a.* FROM table AS a, (SELECT foo.* FROM foo) AS bar');
		});

		it ('should not allow an alias that is already in use', function(){
			expect(function(){
				q.addTable(new Query('foo'), 'a');
				norm(q.getQuery(a));
			}).toThrow();
		});
	});

	describe('whereClause', function(){
		it ('should support all Condition methods', function(){
			q.add('foo', 'bar')
				.where('foo', '=', 'bar')
				.filter('foo', 'IN', [1, 2, 3])
				.filter('bar', [1, 2, 3])
				.or('fun', 'good')
				.andBetween('range', 1, 10)
				.andNull('foo')
				.orContains('string', 'text');
			expect(norm(q.getQuery(a))).toBe(norm("\
SELECT a.*\n\
FROM table AS a\n\
WHERE foo = 'bar'\n\
AND foo = 'bar'\n\
AND foo IN (1,2,3)\n\
AND bar IN (1,2,3)\n\
OR fun = 'good'\n\
AND range BETWEEN 1 AND 10\n\
AND foo IS NULL\n\
OR string LIKE '%text%'"));
		});
	});

	describe('orderBy', function(){
		it ('should add an order by clause to the query', function() {
			q.orderBy('foo', Query.DESC);
			expect(norm(q.getQuery(a))).toBe('SELECT a.* FROM table AS a ORDER BY foo DESC');
		});
	});

	describe('limit', function(){
		it ('should add a limit clause to the query', function() {
			q.limit(10);
			expect(norm(q.getQuery(a))).toBe('SELECT a.* FROM table AS a LIMIT 10');
		});
	});

	describe('offset', function(){
		it ('should add an offset clause to the query', function() {
			q.limit(10);
			q.offset(20);
			expect(norm(q.getQuery(a))).toBe('SELECT a.* FROM table AS a LIMIT 10 OFFSET 20');
		});
	});

});
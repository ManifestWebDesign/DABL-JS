describe('Condition', function() {
	var c,
		a = new dabl.SQLAdapter,
		Condition = dabl.Condition;

	beforeEach(function() {
		c = new Condition;
	});

	function norm(str) {
		if (!str) {
			return '';
		}
		return str.toString().replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
	}

	describe('init', function() {
		it ('should accept a hash of conditions', function() {
			c = new Condition({
				'foo': 'bar',
				'good': 'great'
			});
			expect(norm(c.getQueryStatement(a)))
				.toBe("foo = 'bar' AND good = 'great'");
		});
	});

	describe('_preprocessCondition', function(){
		it ('should return null if given no arguments or an empty condition', function() {
			var c2 = new Condition;
			expect(c._preprocessCondition(c2)).toBe(null);

			expect(c._preprocessCondition()).toBe(null);
		});

		it ('should set right to 2nd argument and operator to ' + Condition.EQUAL + ' if only two arguments given', function() {
			expect(c._preprocessCondition('foo', 'bar'))
				.toEqual(['foo', Condition.EQUAL, 'bar', Condition.QUOTE_RIGHT]);
		});

		it ('should set operator to IS NULL and right to NULL if only two arguments given and 2nd argument is NULL', function() {
			expect(c._preprocessCondition('foo', null))
				.toEqual(['foo', Condition.IS_NULL, null, Condition.QUOTE_NONE]);
		});

		it ('should set operator to something IN or NOT IN if array given for right', function() {
			expect(c._preprocessCondition('foo', ['1', '2']))
				.toEqual(['foo', Condition.IN, ['1', '2'], Condition.QUOTE_RIGHT]);
			expect(c._preprocessCondition('foo', Condition.EQUAL, ['1', '2']))
				.toEqual(['foo', Condition.IN, ['1', '2'], Condition.QUOTE_RIGHT]);
			expect(c._preprocessCondition('foo', Condition.NOT_EQUAL, ['1', '2']))
				.toEqual(['foo', Condition.NOT_IN, ['1', '2'], Condition.QUOTE_RIGHT]);
		});

		it ('should allow BETWEEN with an array with a length of two', function() {
			expect(c._preprocessCondition('foo', Condition.BETWEEN, ['1', '2']))
				.toEqual(['foo', Condition.BETWEEN, ['1', '2'], Condition.QUOTE_RIGHT]);
		});

		it ('should return null if operator is NOT IN or NOT EQUALS and an right is an empty array', function() {
			expect(c._preprocessCondition('foo', Condition.NOT_EQUAL, [])).toBe(null);
			expect(c._preprocessCondition('foo', Condition.NOT_IN, [])).toBe(null);
		});
	});

	describe('and/or', function() {
		it ('should support field eq value', function() {
			c.and('field', 'eq', 'value');
			expect(norm(c.getQueryStatement(a)))
				.toBe("field = 'value'");
		});
		it ('should support field = value', function() {
			c.and('field', 'eq', 'value');
			expect(norm(c.getQueryStatement(a)))
				.toBe("field = 'value'");
		});
		it ('should interpret field, value as field = value', function() {
			c.and('field', 'value');
			expect(norm(c.getQueryStatement(a)))
				.toBe("field = 'value'");
		});
		it ('should support field IN array', function() {
			c.and('field', [1, 2, 3]);
			expect(norm(c.getQueryStatement(a)))
				.toBe("field IN (1,2,3)");
		});
		it ('should support field between array', function() {
			c.and('field', Condition.BETWEEN, [1, 2]);
			expect(norm(c.getQueryStatement(a)))
				.toBe("field BETWEEN 1 AND 2");
		});
		it ('should accept a Condition', function() {
			c.and(new Condition('field', 'value'));
			expect(norm(c.getQueryStatement(a)))
				.toBe("( field = 'value')");
		});
		it ('should accept OData operators', function() {
			c.and('field', 'eq', 'value');
			expect(norm(c.getQueryStatement(a)))
				.toBe("field = 'value'");

			c = new Condition;
			c.and('field', 'startswith', 'value');
			expect(norm(c.getQueryStatement(a)))
				.toBe("field LIKE 'value%'");

			c = new Condition;
			c.and('field', 'endswith', 'value');
			expect(norm(c.getQueryStatement(a)))
				.toBe("field LIKE '%value'");

			c = new Condition;
			c.and('value', 'substringof', 'field');
			expect(norm(c.getQueryStatement(a)))
				.toBe("field LIKE '%value%'");
		});
	});

	describe('getODataFilter', function() {
		it ('should support SQL or OData operators', function() {
			for (var oper in Condition.OData.operators) {
				c = new Condition;
				c.and('foo', oper, 'bar');
				expect(c.getODataFilter()).toBe("foo " + Condition.OData.operators[oper] + " 'bar'");

				c = new Condition;
				c.and('foo', Condition.OData.operators[oper], 'bar');
				expect(c.getODataFilter()).toBe("foo " + Condition.OData.operators[oper] + " 'bar'");
			}
		});

		it ('should emulate IN and NOT IN', function() {
			c.and('foo', ['bar', 123]);
			expect(c.getODataFilter()).toBe("(foo eq 'bar' or foo eq 123)");

			c = new Condition;
			c.and('foo', 'eq', ['bar', 123]);
			expect(c.getODataFilter()).toBe("(foo eq 'bar' or foo eq 123)");

			c = new Condition;
			c.and('foo', Condition.NOT_IN, ['bar', 123]);
			expect(c.getODataFilter()).toBe("(foo ne 'bar' and foo ne 123)");

			c = new Condition;
			c.and('foo', Condition.NOT_EQUAL, ['bar', 123]);
			expect(c.getODataFilter()).toBe("(foo ne 'bar' and foo ne 123)");

			c = new Condition;
			c.and('foo', 'ne', ['bar', 123]);
			expect(c.getODataFilter()).toBe("(foo ne 'bar' and foo ne 123)");
		});

		it ('should support startswith and endswith', function(){
			c.and('foo', 'startswith', 'bar');
			expect(c.getODataFilter()).toBe("startswith(foo, 'bar')");

			c = new Condition;
			c.and('foo', Condition.ENDS_WITH, 'bar');
			expect(c.getODataFilter()).toBe("endswith(foo, 'bar')");
		});

		it ('should support substringof and CONTAINS', function(){
			c.and('foo', Condition.CONTAINS, 'bar');
			expect(c.getODataFilter()).toBe("substringof('bar', foo)");

			c = new Condition;
			c.and('foo', 'substringof', 'bar');
			expect(c.getODataFilter()).toBe("substringof('bar', foo)");
		});

		it ('should support IS NULL and NOT NULL', function(){
			c.where('foo', null);
			expect(c.getODataFilter()).toBe("foo eq null");

			c = new Condition;
			c.where('foo', 'ne', null);
			expect(c.getODataFilter()).toBe("foo ne null");
		});

		it ('should support the "and" seperator', function(){
			c.where('fun', 'good');
			c.and('tough', 'rough');
			expect(c.getODataFilter()).toBe("fun eq 'good' and tough eq 'rough'");
		});

		it ('should support the "or" seperator', function(){
			c.where('fun', 'good');
			c.or('tough', 'rough');
			expect(c.getODataFilter()).toBe("fun eq 'good' or tough eq 'rough'");
		});

		it ('should support parenthesis', function(){
			c.and('fun', 'good');
			c.and('tough', 'rough');
			c.or(new Condition('foo', dabl.Query.CONTAINS, 'bar').or('tom', 'waits'));
			expect(c.getODataFilter()).toBe("fun eq 'good' and tough eq 'rough' or (substringof('bar', foo) or tom eq 'waits')");
		});
	});

});
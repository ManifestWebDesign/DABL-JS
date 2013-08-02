#!/bin/sh

/bin/rm dabl.js 2>/dev/null
/bin/rm dabl.min.js 2>/dev/null

echo 'dabl = typeof dabl === "undefined" ? {} : dabl;' >> dabl.js
echo >> dabl.js
echo '(function(dabl){' >> dabl.js

for i in src/*.js ; do
	echo >> dabl.js
	echo '/* '$(basename $i)' */' >> dabl.js
	cat $i >> dabl.js
	echo >> dabl.js
done

for i in src/query/*.js ; do
	echo >> dabl.js
	echo '/* '$(basename $i)' */' >> dabl.js
	cat $i >> dabl.js
	echo >> dabl.js
done

for i in src/adapter/*.js ; do
	echo >> dabl.js
	echo '/* '$(basename $i)' */' >> dabl.js
	cat $i >> dabl.js
	echo >> dabl.js
done

echo '})(dabl);' >> dabl.js

java -jar lib/yuicompressor-2.4.6.jar --type js dabl.js >>dabl.min.js
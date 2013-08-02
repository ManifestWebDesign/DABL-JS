@ECHO OFF & SETLOCAL
DEL dabl.min.js
DEL dabl.js

ECHO dabl = typeof dabl === "undefined" ? {} : dabl; >> dabl.js
ECHO.>> dabl.js
ECHO (function(dabl){ >> dabl.js

for %%i IN (src\*.js) DO (
	ECHO.>> dabl.js
	ECHO /* %%~ni.js */>> dabl.js
	type %%i >> dabl.js
	ECHO.>> dabl.js
)

for %%i IN (src\query\*.js) DO (
	ECHO.>> dabl.js
	ECHO /* %%~ni.js */>> dabl.js
	type %%i >> dabl.js
	ECHO.>> dabl.js
)

for %%i IN (src\adapter\*.js) DO (
	ECHO.>> dabl.js
	ECHO /* %%~ni.js */>> dabl.js
	type %%i >> dabl.js
	ECHO.>> dabl.js
)

ECHO })(dabl); >> dabl.js

java -jar lib/yuicompressor-2.4.6.jar --type js dabl.js>>dabl.min.js
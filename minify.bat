@ECHO OFF & SETLOCAL
DEL dabl.min.js
DEL dabl.js

for %%i IN (src\*.js) DO (
	ECHO.>> dabl.min.js
	ECHO /* %%~ni.js */>> dabl.min.js
	java -jar yuicompressor-2.4.6.jar --type js %%i>>dabl.min.js
	ECHO.>> dabl.min.js
	
	ECHO.>> dabl.js
	ECHO /* %%~ni.js */>> dabl.js
	type %%i >> dabl.js
	ECHO.>> dabl.js
)
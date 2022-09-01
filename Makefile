.PHONY: build-ts
build-ts:
	tsc --target es6 ./www/app.ts

.PHONY: php-serve
php-serve:
	php -t ./www -S localhost:8000 ./main.php

.PHONY: build-ts
build-ts:
	tsc --target es6 ./www/app.ts

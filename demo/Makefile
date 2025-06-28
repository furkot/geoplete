PROJECT=demo
NODE_BIN=./node_modules/.bin
SRC = index.js $(wildcard lib/*.js)
CSS = \
	../node_modules/@melitele/awesomplete/awesomplete.css \
	${PROJECT}.css

all: compile

compile: build/build.js build/build.css

build:
	mkdir -p $@

build/build.css: $(CSS) | build
	cat $^ > $@

build/build.js: node_modules $(SRC) | build
	node esbuild.js $@

.DELETE_ON_ERROR: build/build.js

node_modules: package.json
	yarn
	touch $@

clean:
	rm -fr build

distclean: clean
	rm -fr node_modules

.PHONY: clean check all compile

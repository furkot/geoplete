PROJECT=demo
NODE_BIN=./node_modules/.bin
SRC = index.js $(wildcard lib/*.js)
CSS = \
	../node_modules/@melitele/awesomplete/awesomplete.css \
	${PROJECT}.css

all: check compile

check: lint

compile: build/build.js build/build.css

build:
	mkdir -p $@

build/build.css: $(CSS) | build
	cat $^ > $@

build/build.js: node_modules $(SRC) | build
	$(NODE_BIN)/browserify \
		--debug \
		--transform envlocalify \
		--require ./index.js:$(PROJECT) \
		--outfile $@

.DELETE_ON_ERROR: build/build.js

node_modules: package.json
	yarn && touch $@

lint: | node_modules
	../node_modules/.bin/jshint $(SRC)

clean:
	rm -fr build

distclean: clean
	rm -fr node_modules

.PHONY: clean lint check all compile

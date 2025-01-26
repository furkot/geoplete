
1.1.6 / 2025-01-26
==================

 * change tilehosting to maptiler
 * @furkot/geocode 3.1.2 -> 3.2.1

1.1.5 / 2024-02-23
==================

 * upgrade github actions
 * relax debounce module requirement
 * replace mocha with node:test
 * replace jshint with @pirxpilot/jshint

1.1.4 / 2024-02-22
==================

 * @furkot/geocode 3.1.2

1.1.3 / 2024-02-18
==================

 * @furkot/geocode 3.1.1

1.1.2 / 2022-10-09
==================

 * handle abort and timeout exceptions

1.1.1 / 2022-10-08
==================

 * add optional function that triggers query depending on string value not just length

1.1.0 / 2022-09-03
==================

 * replace furkot-geocode with @furkot/geocode

1.0.2 / 2022-05-12
==================

 * furkot-geocode 2.0.2
 * fix substituting geocoder keys in demo

1.0.1 / 2022-05-06
==================

 * furkot-geocode 2.0.0 -> 2.0.1

1.0.0 / 2022-05-06
==================

 * replace geocoder used for the demo
 * move demo to a subfolder
 * rewrite code in ES6
 * furkot-geocode 1.4.10 -> 2.0.0

0.2.6 / 2018-08-30
==================

 * requery when bounds change

0.2.5 / 2018-08-30
==================

 * furkot-geocode 1.4.8 -> 1.4.10
 * fix passing geocoding stats

0.2.4 / 2018-08-19
==================

 * furkot-geocode 1.3 -> 1.4.8
 * skip query if enough entries match from the previous one
 * optional function to process query parameter prior to invoking geocoder
 * trim value before geocoding
 * pass 'sort' option to Awesomplete
 * refactor to calculate suggestions once per query

0.2.3 / 2018-05-28
==================

 * fix marking text in the demo when place is not set
 * fix location of awesomplete.css
 * @melitele/awesomplete 2.0.1 -> 2.0.2
 * furkot-geocode 1.2.1 -> 1.3.0

0.2.2 / 2018-05-27
==================

 * awesomplete -> @melitele/awesomplete 2.0.1
 * add stats and provider fields to list results

0.2.1 / 2018-05-23
==================

 * fix issue with empty `item` option

0.2.0 / 2018-05-23
==================

 * add option to keep list open
 * add support for changing options after creation
 * fix preventing re-query on the same input
 * handle minimum number of characters outside awesomplete to allow showing list with empty input
 * dispatch custom event when list is populated
 * expose function to populate list
 * expose function to customize generating list items
 * upgrade furkot geocode 1.2.0 -> 1.2.1

0.1.0 / 2018-05-21
==================

 * add support for aborting outstanding requests

0.0.3 / 2018-05-20
==================

 * add demo link
 * add support for input type (address or place)

0.0.2 / 2018-05-20
==================

 * simplify options and updated docs
 * always pass langage to geocoder queries
 * use displayAll filter for suggestions
 * switch to algolia as default geocoder

0.0.1 / 2018-05-20
==================

 * initial implementation

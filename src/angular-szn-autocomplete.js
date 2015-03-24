/**
 * An AngularJS directive to display suggestions while typing into text input.
 *
 * @author Jiri Kuchta <jiri.kuchta@live.com>
 * @version 1.0.2
 *
 */
(function () {
	"use strict";

	var ngModule = angular.module( "angular-szn-autocomplete", ["angular-szn-autocomplete/template/shadowinput.html", "angular-szn-autocomplete/template/default.html"]);

	var SznAutocompleteLink = function ($q, $timeout, $http, $compile, $templateCache, $scope, $elm, $attrs) {
		this._$q = $q;
		this._$timeout = $timeout;
		this._$http = $http;
		this._$compile = $compile;
		this._$templateCache = $templateCache;
		this._$scope = $scope;
		this._$attrs = $attrs;

		this._$scope.$evalAsync((function ($elm) {

			this._options = this._getOptions();

			// waiting timeout before calling for results ("delay" option)
			this._delayTimeout = null;

			// this is where we store promise when waiting for results
			this._deferredResults = null;

			// isolated scope that will be bound to the popup template
			this._popupScope = this._$scope.$new(true);
			this._popupScope.show = false;
			this._popupScope.highlightIndex = -1;

			this._dom = {
				input: $elm,
				popupCont: null,
				popupParent: null,
				shadowInput: null,
				shadowInputParent: null
			};
			this._findAndSetParentElements();

			this._$scope.$on("$destroy", this._destroy.bind(this));

			this._init();
		}).bind(this, $elm));
	};

	// default configuration
	SznAutocompleteLink.DEFAULT_OPTIONS = {
		templateUrl: "angular-szn-autocomplete/template/default.html", // popup template URL
		highlightFirst: false, 									// automatically highlight the first result in the popup?
		shadowInput: false, 									// show the shadowInput?
		onSelect: null, 										// a function, or name of scope function, to call after selection
		searchMethod: "getAutocompleteResults", 				// name of scope method to call to get results
		popupParent: "",										// CSS selector of element in which the results should be appended into (default is parent element of the main input)
		shadowInputParent: "",									// CSS selector of element in which the shadowInput should be appended into (default is parent element of the main input)
		delay: 100, 											// time in ms to wait before calling for results
		minLength: 1,											// minimal number of character that needs to be entered to search for results
		uniqueId: null,											// this ID will be passed as an argument in every event to easily identify this instance (in case there are multiple instances on the page)
		boldMatches: true										// bold matches in results?
	};

	SznAutocompleteLink.IGNORED_KEYS = [16, 17, 18, 20, 37];

	SznAutocompleteLink.NAVIGATION_KEYS = [13, 27, 9, 38, 39, 40];

	/**
	 * Get the directive configuration.
	 * Options can be set either via element attributes (e.g. delay="500")
	 * or in configuration object whose name is set as value of directive element attribute (e.g. szn-autocomplete="config")
	 * @returns {object} configuration object
	 */
	SznAutocompleteLink.prototype._getOptions = function () {
		var options = {};

		var optionsObject = this._$scope[this._$attrs.sznAutocomplete] || {};

		for (var key in this.constructor.DEFAULT_OPTIONS) {
			// options set via element attributes have highest priority
			options[key] = this._$attrs[key] || optionsObject[key] || this.constructor.DEFAULT_OPTIONS[key];
		}

		if (!this._$scope[options.searchMethod]) {
			throw new Error("angular-szn-autocomplete: scope method \"" + options.searchMethod + "\" does not exist.");
		}

		return options;
	};

	/**
	 * Init method
	 * Compiles and appends templates into DOM, adds event listeners
	 */
	SznAutocompleteLink.prototype._init = function () {
		this._getTemplate()
			.then((function (template) {
				this._dom.popupCont = angular.element(this._$compile(template)(this._popupScope));
				this._dom.popupParent.append(this._dom.popupCont);

				if (this._options.shadowInput) {
					var shadowInputTemplate = this._$templateCache.get("angular-szn-autocomplete/template/shadowinput.html");
					this._dom.shadowInput = angular.element(this._$compile(shadowInputTemplate)(this._popupScope));
					this._dom.shadowInputParent[0].insertBefore(this._dom.shadowInput[0], this._dom.input[0]);

					// some special styles are needed when using shadowInput
					this._dom.input.addClass("szn-shadow");
				}
			}).bind(this))
			.then((function () {
				// disable native autocomplete
				this._dom.input.attr("autocomplete", "off");

				this._dom.input.bind("keyup", this._keyup.bind(this));
				this._dom.input.bind("keydown", this._keydown.bind(this));
				this._dom.input.bind("blur", (function () {
					// when we click on some item in popup the blur event is fired
					// before the item can be selected. So we have to wait a little.
					this._$timeout(this._hide.bind(this, true), 200);
				}).bind(this));

				// we need some methods and variables to be accessible within isolated popup scope
				this._popupScope.highlight = this._highlight.bind(this);
				this._popupScope.select = this._select.bind(this);
				this._popupScope.boldMatches = this._options.boldMatches;

				this._$scope.$emit("sznAutocomplete-init", {instanceId: this._options.uniqueId});
			}).bind(this));
	};

	/**
	 * Handles keyup event
	 * Calls for suggestions when every conditions are met.
	 * @param {object} event
	 */
	SznAutocompleteLink.prototype._keyup = function (e) {
		if (this.constructor.IGNORED_KEYS.indexOf(e.keyCode) == -1) {
			if (this.constructor.NAVIGATION_KEYS.indexOf(e.keyCode) == -1) {
				var query = e.target.value;
				if (query.length >= this._options.minLength) {
					// call for results after
					this._delayTimeout = this._$timeout((function () {
						this._getResults(query);
					}).bind(this), this._options.delay);
				} else {
					// not enough number of characters
					this._hide(true);
				}
			}
		}
	};

	/**
	 * Handles keypress event
	 * @param {object} event
	 */
	SznAutocompleteLink.prototype._keydown = function (e) {
		if (this.constructor.IGNORED_KEYS.indexOf(e.keyCode) == -1) {
			if (this.constructor.NAVIGATION_KEYS.indexOf(e.keyCode) != -1) {
				this._navigate(e);
			} else {
				// new search is about to be performed

				// cancel previous timeout
				if (this._delayTimeout) {
					this._$timeout.cancel(this._delayTimeout);
				}

				// temporary hide shadowInput to prevent visual glitches
				if (this._dom.shadowInput) {
					this._dom.shadowInput.css("visibility", "hidden");
				}
			}
		}
	};

	/**
	 * Calls for results
	 * @param {string} query
	 */
	SznAutocompleteLink.prototype._getResults = function (query) {

		// "loading" scope variable can be used to show loading indicator
		this._popupScope.loading = true;

		this._deferredResults = this._$q.defer();
		this._deferredResults.promise.then(
			(function (query, data) {

				// there are no results. Hide popup.
				if (!data.results || !data.results.length) {
					this._hide();
					return;
				}

				// all returned data are available in the popup scope
				for (var key in data) {
					this._popupScope[key] = data[key];
				}

				this._show();

				if (this._options.highlightFirst) {
					this._highlight(0);
				}

				// propagete actual query into popup scope. Will be used for bolding string matches.
				this._popupScope.query = this._dom.input[0].value;

				if (this._options.shadowInput) {
					this._popupScope.shadowInputValue = "";
					if (data.results[0].value.toLowerCase() != query.toLowerCase()) {
						if (data.results[0].value.substring(0, query.length).toLowerCase() == query.toLowerCase()) {
							this._popupScope.shadowInputValue = query + data.results[0].value.substring(query.length);
						}
					}
					this._dom.shadowInput.css("visibility", "");
				}

				this._popupScope.loading = false;
			}).bind(this, query),
			(function () {
				this._hide(true);
			}).bind(this)
		);

		this._$scope[this._options.searchMethod](query, this._deferredResults);
	};

	/**
	 * Show the popup
	 */
	SznAutocompleteLink.prototype._show = function () {
		if (!this._popupScope.show) {
			this._popupScope.show = true;
			this._$scope.$emit("sznAutocomplete-show", {instanceId: this._options.uniqueId});
		}
	};

	/**
	 * Hide the popup
	 * @param {bool} digest Trigger $digest cycle?
	 */
	SznAutocompleteLink.prototype._hide = function (digest) {
		if (this._popupScope.show) {
			if (this._delayTimeout) {
				this._$timeout.cancel(this._delayTimeout);
			}

			if (this._deferredResults) {
				this._deferredResults.reject();
			}

			this._popupScope.show = false;
			this._popupScope.loading = true;
			this._popupScope.highlightIndex = -1;

			if (this._options.shadowInput) {
				this._popupScope.shadowInputValue = "";
			}

			if (digest) { this._popupScope.$digest(); }

			this._$scope.$emit("sznAutocomplete-hide", {instanceId: this._options.uniqueId});
		}
	};

	/**
	 * Navigation handling
	 * @param {object} e
	 */
	SznAutocompleteLink.prototype._navigate = function (e) {
		if (this._popupScope.show) {
			switch (e.keyCode) {
				case 27: // ESC
					this._hide(true);
				break;
				case 13: // ENTER
					var item = this._popupScope.results[this._popupScope.highlightIndex];
					if (item) {
						this._select(item);
					}
				break;
				case 38: // UP
					e.preventDefault();
					this._move(-1);
				break;
				case 40: // DOWN
					e.preventDefault();
					this._move(1);
				break;
				case 39: // RIGHT
					if (this._options.shadowInput && this._popupScope.shadowInputValue) {
						e.preventDefault();
						this._copyFromShadow();
					}
				break;
				case 9: // TAB
					if (this._options.shadowInput && this._popupScope.shadowInputValue) {
						e.preventDefault();
						this._copyFromShadow();
					}
				break;
			};
		}
	};

	/**
	 * Handles popup item selection
	 * @param {object} item Scope data of selected item
	 */
	SznAutocompleteLink.prototype._select = function (item) {
		if (item) { this._setValue(item.value); }

		this._$scope.$emit("sznAutocomplete-select", {
			instanceId: this._options.uniqueId,
			itemData: item
		});

		this._hide(true);

		if (this._options.onSelect) {
			// call the "onSelect" option callback
			if (typeof this._options.onSelect == "string") {
				this._$scope[this._options.onSelect](item);
			} else if (typeof this._options.onSelect == "function") {
				this._options.onSelect(item);
			}
		}
	};

	/**
	 * Set value into main input
	 * @param {string} value A string to be set as value. Default is actually highlighted result value.
	 */
	SznAutocompleteLink.prototype._setValue = function (value) {
		if (value) {
			this._$scope[this._$attrs["ngModel"]] = value;
			this._$scope.$digest();
		}
	};

	/**
	 * Highlights a popup item
	 * @param {int} index An index of results item to be highlighted
	 * @param {bool} digest Trigger $digest cycle?
	 */
	SznAutocompleteLink.prototype._highlight = function (index, digest) {
		this._popupScope.highlightIndex = index;
		if (digest) { this._popupScope.$digest(); }
	};

	/**
	 * Move through the results
	 * @param {int} direction Direction to move ("-1" or "1")
	 */
	SznAutocompleteLink.prototype._move = function (direction) {
		if (this._options.shadowInput) {
			this._popupScope.shadowInputValue = "";
		}

		var i = this._getMoveIndex(direction);
		this._highlight(i, true);
		this._setValue(this._popupScope.results[i].value);
	};

	/**
	 * Returns index of next or previous popup item
	 * @param {int} direction Direction to move ("-1" or "1")
	 * @return {int} index
	 */
	SznAutocompleteLink.prototype._getMoveIndex = function (direction) {
		var index = this._popupScope.highlightIndex + direction;
		if (index > this._popupScope.results.length - 1) {
			index = 0;
		} else if (index < 0) {
			index = this._popupScope.results.length - 1;
		}

		return index;
	};

	/**
	 * Complete word or append new one from shadowInput to the main input
	 */
	SznAutocompleteLink.prototype._copyFromShadow = function () {
		var shadowWords = this._popupScope.shadowInputValue.split(" ");
		var queryWords = this._$scope[this._$attrs["ngModel"]].split(" ");

		var i = queryWords.length - 1;
		if (queryWords[i].length < shadowWords[i].length) { // complete word
			queryWords[i] = shadowWords[i];
		} else if (shadowWords[i + 1]) { // append next word
			queryWords.push(shadowWords[i + 1]);
		} else {
			return;
		}

		// set input value and call for new results
		var query = queryWords.join(" ")
		this._$scope[this._$attrs["ngModel"]] = query;
		this._getResults(query);
	};

	/**
	 * Gets popup template
	 * @return {promise}
	 */
	SznAutocompleteLink.prototype._getTemplate = function () {
		var deferred = this._$q.defer();

		var template = this._$templateCache.get(this._options.templateUrl);
		if (template) {
			deferred.resolve(template);
		} else {
			this._$http.get(this._options.templateUrl)
				.success((function (deferred, data) { deferred.resolve(data); }).bind(this, deferred))
				.error((function (deferred, data) { throw new Error("angular-szn-autocomplete: Failed to load template \"" + this._options.templateUrl + "\".") }).bind(this));
		}

		return deferred.promise;
	};

	/**
	 * Finds parent elements in which the popup and shadowInput should be appended into
	 */
	SznAutocompleteLink.prototype._findAndSetParentElements = function () {
		var findElement = function (selector) {
			var elm = document.querySelector(selector);
			if (!elm) {
				throw new Error("angular-szn-autocomplete: CSS selector \"" + selector + "\" does not match any element.");
			}
			return angular.element(elm);
		};

		if (this._options.popupParent) {
			this._dom.popupParent = findElement(this._options.popupParent);
		} else {
			this._dom.popupParent = this._dom.input.parent();
		}

		if (this._options.shadowInput) {
			if (this._options.shadowInputParent) {
				this._dom.shadowInputParent = findElement(this._options.shadowInputParent);
			} else {
				this._dom.shadowInputParent = this._dom.input.parent();
			}
		}
	};

	/**
	 * Directive destructor
	 */
	SznAutocompleteLink.prototype._destroy = function () {
		// manually destroy the popup scope
		this._popupScope.$destroy();
	};

	ngModule.directive("sznAutocomplete", ["$q", "$timeout", "$http", "$compile", "$templateCache", function ($q, $timeout, $http, $compile, $templateCache) {
		return {
			restrict: "AC",
			require: 'ngModel',
			link: function ($scope, $elm, $attrs) {
				return new SznAutocompleteLink($q, $timeout, $http, $compile, $templateCache, $scope, $elm, $attrs);
			}
		};
	}]);

	/**
	 * A special directive for each item in popup.
	 */
	ngModule.directive("sznAutocompleteResult", [function () {
		return {
			link: function ($scope, $elm, $attrs) {
				$elm.on("mousemove", (function () {
					// the cursor is over the element -> highlight
					if ($scope.highlightIndex != $scope.$index) {
						$scope.highlight($scope.$index, true);
					}
				}).bind(this));
				$elm.on("mouseout", (function () {
					// the cursor left -> cancel highlight
					if ($scope.highlightIndex != $scope.$index) {
						$scope.highlight(-1, true);
					}
				}).bind(this));
				$elm.on("click", (function () {
					// select this result
					$scope.select($scope.results[$scope.$index]);
				}).bind(this));
			}
		};
	}]);

	/**
	 * Custom bind-html directive, so we dont have to include whole "angular-sanitize" module
	 */
	ngModule.directive("viewAsHtml", function () {
		return function ($scope, $elm, $attrs) {
			$elm.addClass('ng-binding').data('$binding', $attrs.viewAsHtml);
			$scope.$watch($attrs.viewAsHtml, function bindHtmlWatchAction(value) {
				$elm.html(value || '');
			});
		};
	});

	/**
	 * Filter to bold search query matches in popup items
	 */
	ngModule.filter("sznAutocompleteBoldMatch", function() {
		return function(matchItem, query) {
			var i = matchItem.toLowerCase().indexOf(query.toLowerCase());
			if (i < 0) {
				return matchItem;
			}

			var parts = [];
			parts.push("<b>" + matchItem.substring(0, i) + "</b>");
			parts.push(matchItem.substring(i, i + query.length));
			parts.push("<b>" + matchItem.substring(i + query.length) + "</b>");

			return parts.join("");
		};
	});

	/**
	 * Shadow input template
	 */
	angular.module("angular-szn-autocomplete/template/shadowinput.html", []).run(["$templateCache", function($templateCache) {
		$templateCache.put("angular-szn-autocomplete/template/shadowinput.html",
			'<input type="text" class="szn-autocomplete-shadow-input szn-shadow" ng-value="shadowInputValue" disabled="disabled">'
		);
	}]);

	/**
	 * Default popup template
	 */
	angular.module("angular-szn-autocomplete/template/default.html", []).run(["$templateCache", function($templateCache) {
		$templateCache.put("angular-szn-autocomplete/template/default.html",
			'<ul ng-show="show" class="szn-autocomplete-results" ng-class="{loading: loading}">\n' +
				'<li szn-autocomplete-result ng-repeat="result in results" ng-class="{selected: highlightIndex == $index}">\n' +
					'<span ng-if="boldMatches" view-as-html="result.value | sznAutocompleteBoldMatch:query"></span>\n' +
					'<span ng-if="!boldMatches">{{result.value}}</span>\n' +
				'</li>\n' +
			'</ul>'
		);
	}]);

})();

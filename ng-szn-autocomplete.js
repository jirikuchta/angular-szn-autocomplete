(function () {
	"use strict";

	var ngModule = angular.module("ngSznAutocomplete", []);

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
			this._delayTimeout = null;
			this._deferredResults = null;

			this._resultsScope = this._$scope.$new(true);
			this._resultsScope.isOpen = false;
			this._resultsScope.focusedIndex = -1;

			this._dom = {
				input: $elm,
				resultsCont: null
			};
			this._dom.parent = this._getParentElm();

			this._init();
		}).bind(this, $elm));
	};

	SznAutocompleteLink.DEFAULT_OPTIONS = {
		templateUrl: "",
		focusFirst: false,
		shadowInput: false,
		onSelect: null,
		searchMethod: "getAutocompleteResults",
		parentElm: "",
		delay: 100,
		minLength: 1
	};

	SznAutocompleteLink.IGNORED_KEYS = [17, 16, 18, 20, 37];

	SznAutocompleteLink.NAVIGATION_KEYS = [13, 27, 9, 38, 39, 40];

	SznAutocompleteLink.SHADOW_INPUT_HTML =
		'<input type="text" ng-value="shadowInputValue">';

	SznAutocompleteLink.DEFAULT_TEMPLATE =
		'<ul ng-show="isOpen" class="szn-autocomplete-results" ng-class="{loading: loading}">' +
			'<li szn-autocomplete-result ng-repeat="result in results" ng-class="{selected: focusedIndex == $index}">' +
				'{{result.value}}' +
			'</li>' +
		'</ul>';

	SznAutocompleteLink.prototype._getOptions = function () {
		var options = {};

		var optionsObject = this._$scope[this._$attrs.sznAutocomplete] || {};

		for (var key in this.constructor.DEFAULT_OPTIONS) {
			var capKey = key.charAt(0).toUpperCase() + key.slice(1);
			options[key] = this._$attrs["sznAutocomplete" + capKey] || optionsObject[key] || this.constructor.DEFAULT_OPTIONS[key];
		}

		if (!this._$scope[options.searchMethod]) {
			throw new Error("ngSznAutocomplete: scope method \"" + options.searchMethod + "\" does not exist.");
		}

		return options;
	};

	SznAutocompleteLink.prototype._init = function () {
		this._getTemplate()
			.then((function (template) {
				this._dom.resultsCont = angular.element(this._$compile(template)(this._resultsScope));
				this._dom.parent.append(this._dom.resultsCont);

				if (this._options.shadowInput) {
					this._dom.shadowInput = angular.element(this._$compile(this.constructor.SHADOW_INPUT_HTML)(this._resultsScope));
					this._dom.parent.append(this._dom.shadowInput);
				}
			}).bind(this))
			.then((function () {
				this._dom.input.attr("autocomplete", "off");
				this._dom.input.bind("keyup", this._keyup.bind(this));
				this._dom.input.bind("keypress", this._keypress.bind(this));
				this._dom.input.bind("blur", (function () {
					this._$timeout(this._close.bind(this, true), 200);
				}).bind(this));

				this._resultsScope.focusResult = this._focusResult.bind(this);
				this._resultsScope.select = this._select.bind(this);
			}).bind(this));
	};

	SznAutocompleteLink.prototype._keyup = function (e) {
		if (this.constructor.IGNORED_KEYS.indexOf(e.keyCode) == -1) {
			if (this.constructor.NAVIGATION_KEYS.indexOf(e.keyCode) == -1) {
				var query = e.target.value;
				if (query.length >= this._options.minLength) {
					if (this._delayTimeout) {
						this._$timeout.cancel(this._delayTimeout);
					}

					this._delayTimeout = this._$timeout((function () {
						this._getResults(query);
					}).bind(this), this._options.delay);
				} else {
					this._close(true)
				}
			}
		}
	};

	SznAutocompleteLink.prototype._keypress = function (e) {
		if (this.constructor.IGNORED_KEYS.indexOf(e.keyCode) == -1) {
			if (this.constructor.NAVIGATION_KEYS.indexOf(e.keyCode) != -1) {
				this._navigate(e);
			}
		}
	};

	SznAutocompleteLink.prototype._getResults = function (query) {
		this._resultsScope.loading = true;
		this._deferredResults = this._$q.defer();
		this._deferredResults.promise.then(
			(function (query, data) {
				if (!data.results || !data.results.length) {
					this._close();
					return;
				}

				for (var key in data) {
					this._resultsScope[key] = data[key];
				}

				this._open();

				if (this._options.focusFirst) {
					this._focusResult(0);
				}

				this._resultsScope.shadowInputValue = "";
				if (data.results[0].value.substring(0, query.length).toLowerCase() == query.toLowerCase()) {
					this._resultsScope.shadowInputValue = data.results[0].value;
				}

				this._resultsScope.loading = false;
			}).bind(this, query),
			(function () {
				this._close(true);
			}).bind(this)
		);

		this._$scope[this._options.searchMethod](query, this._deferredResults);
	};

	SznAutocompleteLink.prototype._open = function () {
		this._resultsScope.isOpen = true;
	};

	SznAutocompleteLink.prototype._close = function (digest) {
		if (this._delayTimeout) {
			this._$timeout.cancel(this._delayTimeout);
		}

		if (this._deferredResults) {
			this._deferredResults.reject();
		}

		this._resultsScope.isOpen = false;
		this._resultsScope.loading = true;
		this._resultsScope.focusedIndex = -1;
		this._resultsScope.shadowInputValue = "";

		if (digest) { this._resultsScope.$digest(); }
	};

	SznAutocompleteLink.prototype._navigate = function (e) {
		if (this._resultsScope.isOpen) {
			switch (e.keyCode) {
				case 27: // ESC
					this._close(true);
				break;
				case 13: // ENTER
					if (this._resultsScope.isOpen) {
						e.preventDefault();
						this._select();
					}
				break;
				case 38: // UP
					this._move("up");
				break;
				case 40: // DOWN
					this._move("dowm");
				break;
				case 39: // RIGHT
					this._copyFromShadow();
				break;
				case 9: // TAB
					this._copyFromShadow();
				break;
			};
		}
	};

	SznAutocompleteLink.prototype._select = function () {
		this._setValue();

		this._close(true);

		if (this._options.onSelect) {
			this._options.onSelect();
		}
	};

	SznAutocompleteLink.prototype._setValue = function (value) {
		value = value || this._resultsScope.results[this._resultsScope.focusedIndex].value;
		this._dom.input[0].value = value;
	};

	SznAutocompleteLink.prototype._focusResult = function (index, digest) {
		this._resultsScope.focusedIndex = index;
		if (digest) { this._resultsScope.$digest(); }
	};

	SznAutocompleteLink.prototype._move = function (direction) {
		this._resultsScope.shadowInputValue = "";
		this._focusResult(this._getMoveIndex(direction), true);
		this._setValue();
	};

	SznAutocompleteLink.prototype._getMoveIndex = function (direction) {
		var index = direction == "up" ? this._resultsScope.focusedIndex - 1 : this._resultsScope.focusedIndex + 1;
		if (index > this._resultsScope.results.length - 1) {
			index = 0;
		} else if (index < 0) {
			index = this._resultsScope.results.length - 1;
		}

		return index;
	};

	SznAutocompleteLink.prototype._copyFromShadow = function () {
		if (!this._options.shadowInput || !this._resultsScope.shadowInputValue) {
			return;
		}

		var shadowWords = this._resultsScope.shadowInputValue.split(" ");
		var queryWords = this._dom.input[0].value.split(" ");

		var i = queryWords.length - 1;
		if (queryWords[i].length < shadowWords[i].length) {
			queryWords[i] = shadowWords[i];
		} else if (shadowWords[i + 1]) {
			queryWords.push(shadowWords[i + 1]);
		} else {
			return;
		}

		var query = queryWords.join(" ")
		this._dom.input[0].value = query;
		this._getResults(query);
	};

	SznAutocompleteLink.prototype._getTemplate = function () {
		var deferred = this._$q.defer();

		if (this._options.templateUrl) {
			var template = this._$templateCache.get(this._options.templateUrl);
			if (template) {
				deferred.resolve(template);
			} else {
				this._$http.get(this._options.templateUrl)
					.success((function (deferred, data) { deferred.resolve(data); }).bind(this, deferred))
					.error((function (deferred, data) { throw new Error("ngSznAutocomplete: Failed to load template \"" + this._options.templateUrl + "\".") }));
			}
		} else {
			deferred.resolve(this.constructor.DEFAULT_TEMPLATE);
		}

		return deferred.promise;
	};

	SznAutocompleteLink.prototype._getParentElm = function () {
		if (this._options.parentElm) {
			var parent = document.querySelector(this._options.parentElm);
			if (!parent) {
				throw new Error("ngSznAutocomplete: CSS selector \"" + this._options.parentElm + "\" does not match any element.");
			}
			return angular.element(parent);
		} else {
			return this._dom.input.parent();
		}
	};

	ngModule.directive("sznAutocomplete", ["$q", "$timeout", "$http", "$compile", "$templateCache", function ($q, $timeout, $http, $compile, $templateCache) {
		return {
			restrict: "AC",
			link: function ($scope, $elm, $attrs) {
				return new SznAutocompleteLink($q, $timeout, $http, $compile, $templateCache, $scope, $elm, $attrs);
			}
		};
	}]);

	ngModule.directive("sznAutocompleteResult", [function () {
		return {
			link: function ($scope, $elm, $attrs) {
				$elm.on("mousemove", (function () {
					if ($scope.focusedIndex != $scope.$index) {
						$scope.focusResult($scope.$index, true);
					}
				}).bind(this));
				$elm.on("mouseout", (function () {
					if ($scope.focusedIndex != $scope.$index) {
						$scope.focusResult(-1, true);
					}
				}).bind(this));
				$elm.on("click", (function () {
					$scope.select($scope.results[$scope.$index].value);
				}).bind(this));
			}
		};
	}]);

})();

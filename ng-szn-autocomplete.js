(function () {
	"use strict";

	var ngModule = angular.module("ngSznAutocomplete", []);

	var Link = function ($q, $timeout, $http, $compile, $templateCache, $scope, $elm, $attrs) {
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
			this._previousInputValue = $elm[0].value;

			this._resultsScope = this._$scope.$new();

			this._dom = {
				input: $elm,
				resultsCont: null
			};
			this._dom.parent = this._getParentElm();

			this._init();
		}).bind(this, $elm));
	};

	// default options
	Link.DEFAULT_OPTIONS = {
		templateUrl: "../ng-szn-autocomplete.html",
		focusFirst: false,
		onSelect: null,
		searchMethod: "getAutocompleteResults",
		parentElm: "",
		cssClass: "",
		delay: 100,
		minLength: 2
	};

	Link.IGNORED_KEYS = [17, 16, 18, 20, 37];

	Link.NAVIGATION_KEYS = [13, 27, 9, 38, 39, 40];

	Link.prototype._getOptions = function () {
		var options = {};

		// options set via configuration object in "szn-autocomplete-option" attribute
		var optionsObject = this._$scope[this._$attrs.sznAutocompleteOptions] || {};

		for (var key in this.constructor.DEFAULT_OPTIONS) {
			// the key name with first letter capitalized to make comparision with normalized atribute name easier
			var capKey = key.charAt(0).toUpperCase() + key.slice(1);

			// options set via attributes have highest priority
			options[key] = this._$attrs["sznAutocomplete" + capKey] || optionsObject[key] || this.constructor.DEFAULT_OPTIONS[key];
		}

		if (!this._$scope[options.searchMethod]) {
			throw new Error("ngSznAutocomplete: scope method \"" + options.searchMethod + "\" does not exist.");
		}

		return options;
	};

	Link.prototype._init = function () {
		this._getTemplate()
			.then((function (template) {
				this._dom.resultsCont = angular.element(this._$compile(template)(this._resultsScope));
				this._dom.parent.append(this._dom.resultsCont);
			}).bind(this))
			.then((function () {
				this._dom.input.attr("autocomplete", "off");
				this._dom.input.bind("keyup", this._keyup.bind(this));
				this._dom.input.bind("blur", this._close.bind(this, true));

				this._$scope.focusResult = this._focusResult.bind(this);
			}).bind(this));
	};

	Link.prototype._keyup = function (e) {
		if (this.constructor.IGNORED_KEYS.indexOf(e.keyCode) == -1) {
			if (this.constructor.NAVIGATION_KEYS.indexOf(e.keyCode) != -1) {
				this._navigate(e.keyCode);
			} else {
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

	Link.prototype._getResults = function (query) {
		this._deferredResults = this._$q.defer();
		this._deferredResults.promise.then(
			(function (data) {
				if (!data.results || !data.results.length) {
					this._close();
					return;
				}

				for (var key in data) {
					this._resultsScope[key] = data[key];
				}

				if (this._options.focusFirst) {
					this._resultsScope.results[0].selected = true;
				}

				this._open();
			}).bind(this),
			(function () {
				this._close(true);
			}).bind(this)
		);

		this._$scope[this._options.searchMethod](query, this._deferredResults);
	};

	Link.prototype._open = function () {
		this._dom.resultsCont.css("display", "");
	};

	Link.prototype._close = function (digest) {
		if (this._delayTimeout) {
			this._$timeout.cancel(this._delayTimeout);
		}

		if (this._deferredResults) {
			this._deferredResults.reject();
		}

		this._dom.resultsCont.css("display", "none");

		if (digest) { this._$scope.$digest(); }
	};

	Link.prototype._navigate = function (key) {
		switch (key) {
			case 27: // ESC
				this._close(true);
				break;
			case 13: // ENTER
				this._select();
				break;
			case 38: // UP
				break;
			case 39: // DOWN
				break;
			case 39: // RIGHT
				break;
			case 9: // TAB
				break;
			default:
				break;
		};
	};

	Link.prototype._select = function () {
		this._close(true);
	};

	Link.prototype._focusResult = function (index) {
		this._resultsScope.results.forEach((function (result, i) {
			result.selected = false;
			if (i == index) {
				result.selected = true;
			}
		}).bind(this));
		this._$scope.$digest();
	};

	Link.prototype._getTemplate = function () {
		var deferred = this._$q.defer();

		var template = this._$templateCache.get(this._options.templateUrl);
		if (template) {
			deferred.resolve(template);
		} else {
			this._$http.get(this._options.templateUrl).success(
				(function (deferred, data) { deferred.resolve(data); }).bind(this, deferred)
			);
		}

		return deferred.promise;
	};

	Link.prototype._getParentElm = function () {
		if (this._options.parentElm) {
			var parent = document.querySelector(this._options.parentElm);
			if (!parent) {
				throw new Error("ngSznAutocomplete: CSS selector provided in \"parentElm\" option (\"" + this._options.parentElm + "\") does not match any element.");
			}
			return angular.element(parent);
		} else {
			return this._dom.input.parent();
		}
	};

	ngModule.directive("sznAutocomplete", ["$q", "$timeout", "$http", "$compile", "$templateCache", function ($q, $timeout, $http, $compile, $templateCache) {
		return {
			restrict: "A",
			link: function($scope, $elm, $attrs) {
				return new Link($q, $timeout, $http, $compile, $templateCache, $scope, $elm, $attrs);
			}
		};
	}]);

	ngModule.directive("sznAutocompleteResult", [function () {
		return {
			link: function ($scope, $elm, $attrs) {
				$elm.on("mouseover", (function () {
					$scope.focusResult($scope.$index);
				}).bind(this));
			}
		};
	}]);

})();

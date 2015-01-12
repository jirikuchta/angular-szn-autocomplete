(function () {

	"use strict";

	var ngModule = angular.module("ngSznAutocomplete", []);

	var Link = function ($scope, $elm, $attrs) {
		this._$elm = $elm;
		this._$scope = $scope;
		this._$attrs = $attrs;

		this._config = this._getConfig();
	};

	// default options
	Link.DEFAULT_OPTIONS = {
		template: "",
		url: "",
		resultKey: "",
		fillWords: false,
		boldResults: false,
		selectFirst: false,
		limit: Infinity
	};

	Link.prototype._getConfig = function () {
		var config = {};

		// options set via configuration object in "szn-autocomplete-option" attribute
		var optionsObject = this._$scope.options || {};

		for (var key in this.constructor.DEFAULT_OPTIONS) {
			// the key name with first letter capitalized to make comparision with normalized atribute name easier
			var capKey = key.charAt(0).toUpperCase() + key.slice(1);

			// options set via attributes have highest priority
			config[key] = this._$attrs["sznAutocomplete" + capKey] || optionsObject[key] || this.constructor.DEFAULT_OPTIONS[key];
		}

		// check final configuration validity
		this._validateConfig(config);

		return config;
	};

	Link.prototype._validateConfig = function (config) {
		if (!config.url) {
			throw new Error("ngSznAutocomplete: option \"url\" not set");
		}

		if (!config.template && !config.resultKey) {
			throw new Error("ngSznAutocomplete: option \"resultKey\" is mandatory when using default template.");
		}
	};

	ngModule.directive("sznAutocomplete", [function () {
		return {
			restrict: "A",
			scope: {
				options: "=sznAutocompleteOptions"
			},
			link: function($scope, $elm, $attrs) {
				return new Link($scope, $elm, $attrs);
			}
		};
	}]);
})();

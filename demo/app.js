"use strict";

var App = angular.module("App", ["ngSznAutocomplete"]);

App.controller("ngSznAutocomplete", function ($scope, $http) {

	$scope.getAutocompleteResults = function (query, deferred) {
		var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + query + "&sensor=false";
		$http.get(url).success((function (deferred, data) {
			var results = [];

			if (data.results && data.results.length) {
				data.results.forEach(function (item) { results.push({value: item.formatted_address}); });
			}

			deferred.resolve({results: results});
		}).bind(this, deferred));
	};

});

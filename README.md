# angular-szn-autocomplete
An [AngularJS](https://github.com/angular/angular.js) directive providing suggestions as you type into text input.

Features:
* custom template support
* can show top suggestion as a hint (i.e. background text)
* keyboard and mouse control
* works in legacy browsers
* no dependencies other than the AngularJS library
* emits custom events

**Requirements:** AngularJS **1.2.x** or **1.3.x**

**File Size:** 16.76KB (2.46KB compiled and gzipped)

## Examples
* [Basic usage](http://jsfiddle.net/jirikuchta/ac770wee/)
* [Advanced usage](http://jsfiddle.net/jirikuchta/h6jw0koy/)

## Installation

**1. Download via npm or bower**
```bash
$ npm install angular-szn-autocomplete
$ bower install angular-szn-autocomplete
```
(or simply [download zip file](https://github.com/jirikuchta/angular-szn-autocomplete/archive/master.zip) and copy the `angular-szn-autocomplete.js` and `angular-szn-autocomplete.css` files into your project)

**2. Link the files in the page header**
```html
<script src="/path-to-file/angular-szn-autocomplete.js"></script>
<link rel="stylesheet" href="/path-to-file/angular-szn-autocomplete.css">
```

**3. Include the module as a dependency in your app**
```javascript
angular.module("myApp", ["angular-szn-autocomplete"])
```

## Usage & configuration
There are two ways how to configure the directive. Either you can pass a configuration object
```html
<input type="text" ng-model="query" szn-autocomplete="options">
```
or configure the directive via element attributes. For example: 
```html
<input type="text" ng-model="query" szn-autocomplete highlight-first="true">
```

Settings set via element attributes have higher priority and override settings from the configuration object (if both ways are used).

**List of possible settings:**
* **highlightFirst**: `(default: false)` Whether to automatically hightlight first item in suggestions results.
* **shadowInput**: `(default: false)` <a id="shadowInput"></a> Whether to show a hint.
* **onSelect**: A function, or name of scope function, to be called after selection. Allows to perform custom action upon selection. An selected item data will be passed to this function.
* **searchMethod**: `(default: "getAutocompleteResults")` Allows set custom name of scope function that provides suggestions data. [Read more](#providing-data-for-the-directive). 
* **popupParent**: `(default: input parent element)` A CSS selector of an element in which the popup should be appended into.
* **shadowInputParent**: `(default: input parent element)` A CSS selector of an element in which the shadowInput should be appended into.
* **delay**: `(default: 100)` Time in ms to wait before calling the `searchMethod`.
* **minLength**: `(default: 1)` Number of characters that needs to be entered before the directive does any work.
* **uniqueId**: an unique ID that will be used as an idenficator in emitted events. Comes handy when you have multiple instances of the directive on the page and need to identify which instance emitted particular event.
* **boldMatches**: `(default: true)` Should the matches in suggestion be bold?
* **templateUrl**: Path to your custom template.

All attributes are optional and everything should work fine without any customization as far as the `getAutocompleteResults` method is defined in the scope ([more](#providing-data-for-the-directive)).

### Providing data for the directive
In order to obtain data, the directive calls scope function named `getAutocompleteResults` (name of the function can be changed via "searchMethod" option). It is up to you what logic you put into this function to get the data (i.e. searching within some static object or sending an HTTP request). 

Two argument are passed to the function:
* query string
* a deferred object

You are supposed to use the query string to perform your search and then resolve the deferred object with results data object. [See example](http://jsfiddle.net/jirikuchta/ac770wee/).

All data you return will be accessible in the popup template, so put everything you want to display in the popup into it. There is one requirement on the structure of the data - the returned object has to contain `results` array which has objects as its items. Each item has one mandatory key `value` that holds the suggested string. Example:

```javascript
{
  "results": [
    {
      "value": "foobar",
      // any custom data
    }
  ]
  // any custom data
}
```

## Events
The directive emits following events allowing further customization:

* `sznAutocomplete-init`: emitted when the directive is initialized
* `sznAutocomplete-show`: emitted each time the suggestions list shows
* `sznAutocomplete-hide`: emitted each time the suggestions list hides
* `sznAutocomplete-select`: emitted when some suggest item is selected. The selected item data is passed in the event data object

## License

Licensed under the MIT license




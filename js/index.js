(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

// will need to polyfill: Promises, 
(function () {
    "use strict";

    var model = {
        init: function init() {
            var _this = this;

            // SHOULD THIS STUFF BE IN CONTROLLER?
            this.dataPromises = [];
            var sheetID = '1t9kREavKorCycwgxrOIdS-Zk0OJWTB3BDW6v7xu5zo4',
                tabs = ['Sheet1'];

            tabs.forEach(function (each) {
                var promise = new Promise(function (resolve, reject) {
                    d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', function (error, data) {
                        // columns A through I
                        if (error) {
                            reject(error);
                            throw error;
                        }
                        var values = data.values;
                        console.log(values);
                        resolve(_this.returnKeyValues(values, 'category'));
                    });
                });
                _this.dataPromises.push(promise);
            });

            return Promise.all(this.dataPromises);
        },
        returnKeyValues: function returnKeyValues(values, rollup) {

            function nest(values) {
                return d3.nest().key(function (d) {
                    return d[rollup];
                }).entries(values);
            }

            var keyValues = values.slice(1).map(function (row) {
                return row.reduce(function (acc, cur, i) {
                    // 1. params: total, currentValue, currentIndex[, arr]
                    acc[values[0][i]] = isNaN(+cur) ? cur : +cur; // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
                    return acc;
                }, {});
            });
            if (!rollup) {
                return keyValues;
            } else {
                model.unrolled = keyValues;
                return nest(keyValues);
            }
        }
    };

    var controller = {
        init: function init() {
            model.init().then(function (values) {
                model.data = values[0];
                model.selectedTax = d3.select('#price-selector').node().value;
                d3.select('#price-selector').on('change', function () {
                    model.selectedTax = d3.event.target.value;
                    view.updateTaxPerUnit();
                    view.updateBarCharts();
                    view.updatePriceDivs();
                });

                view.init();
            });
        }
    };

    var view = {
        fadeInHTML: function fadeInHTML(callback) {
            this.each(function (d, i, array) {
                console.log(this, d, i, array);
            });
            console.log(callback);
            this.transition().duration(view.duration / 2).ease(d3.easeCubicOut).style('opacity', 0).on('end', function (d) {
                var $this = d3.select(this);
                $this.html(function () {
                    return callback(d);
                });
                $this.transition().duration(view.duration / 2).ease(d3.easeCubicOut).style('opacity', 1);
            });
        },
        init: function init() {
            console.log('view init', model.data);

            this.duration = 750;
            this.transition = function () {
                d3.transition().duration(view.duration).ease(d3.easeCubicOut);
            };
            scrollMonitors.init();
            var fuelCategories = d3.select('#d3-content').selectAll('categories').data(model.data).enter().append('div').classed('category', true).classed('no-prices', function (d) {
                return !(d.key === 'For homes and businesses' || d.key === 'Coals by type' || d.key === 'Other transportation fuels');
            });

            var categoryHeading = fuelCategories.append('div').classed('category-heading margins flex-container flex-start', true);

            categoryHeading.append('h3').classed('no-margin', true).text(function (d) {
                return d.key;
            });

            var eachFuelHeadings = fuelCategories.append('div').classed('fuel column-labels flex-container margins flex-start', true);

            eachFuelHeadings.append('p') // TO DO: this can be done before the return of the data driven stuuf below
            .classed('column-label label-fuel no-margin', true).text('');

            var dataHeadings = eachFuelHeadings.append('div').classed('data-headings flex-container flex-start', true);

            dataHeadings.append('p').classed('column-label label-co2-emissions no-margin', true).html('kg of CO&#8322;');

            dataHeadings.append('p').classed('column-label label-tax no-margin', true).text('carbon tax');

            dataHeadings.append('p').classed('column-label label-price no-margin', true).text('price change per unit');

            var eachFuel = fuelCategories.selectAll('fuels').data(function (d) {
                return d.values;
            }).enter().append('div').classed('fuel flex-container margins flex-start', true);

            eachFuel.append('p').classed('fuel-name no-margin', true).text(function (d) {
                return d.fuel;
            });

            var fuelData = eachFuel.append('div').classed('fuel-data flex-container grow', true);

            this.co2Emissions = fuelData.append('p').classed('no-margin co2-emissions', true);
            this.updateEmissions();
            this.taxPerUnit = fuelData.append('p').classed('no-margin tax-per-unit', true);
            this.updateTaxPerUnit();
            this.chartWrappers = fuelData.append('div').classed('chart-wrapper grow', true);
            this.chartDivs = this.chartWrappers.append('div').classed('chart-container flex-container', true);

            this.createBarCharts();
        },
        updateEmissions: function updateEmissions() {
            view.fadeInHTML.call(view.co2Emissions, function (d) {
                // calling fadeInHTML; param 2 is the function to return the html
                if (isNaN(d.kg_unit)) {
                    return 'n.a. <br />(' + d.kg_btu + ' / BTU )';
                } else if (d.kg_unit < 1000) {
                    return d3.format(',')(d.kg_unit) + ' / ' + d.unit + '<br />(' + d.kg_btu + ' / BTU )';
                } else {
                    return d3.format(',.0f')(d.kg_unit) + ' / ' + d.unit + '<br />(' + d.kg_btu + ' / BTU )';
                }
            });
        },
        updateTaxPerUnit: function updateTaxPerUnit() {
            view.fadeInHTML.call(view.taxPerUnit, function (d) {
                // calling fadeInHTML; param 2 is the function to return the html
                if (!isNaN(d.kg_unit)) {
                    return '$' + d3.format(',.2f')(d.kg_unit / 1000 * model.selectedTax) + ' / ' + d.unit;
                } else {
                    return 'n.a.';
                }
            });
        },
        updatePriceDivs: function updatePriceDivs() {
            view.fadeInHTML.call(view.priceDivs, function (d) {
                // calling fadeInHTML; param 2 is the function to return the html
                if (d.price_unit !== 'null') {
                    return '($' + d3.format(',.2f')(d.price_unit) + ' &rarr; $' + d3.format(',.2f')(d.price_unit + d.kg_unit / 1000 * model.selectedTax) + ')';
                } else {
                    return 'not provided';
                }
            });
        },

        /*   updatePercentDivs(){
               view.fadeInHTML.call(view.percentageDivs, function(d){ // calling fadeInHTML; param 2 is the function to return the html
                  return d3.format(',.0f')((( d.price_unit + (( d.kg_unit / 1000 ) * model.selectedTax ) ) / d.price_unit) * 100 ) + '%';
               });
           },*/
        createBarCharts: function createBarCharts() {
            var taxExtent = d3.extent(d3.select('#price-selector').node().options, function (d) {
                return +d.value;
            });
            var domain = [d3.min(model.unrolled, function (d) {
                return d.kg_unit / 1000 * taxExtent[0] / d.price_unit * 100;
            }), d3.max(model.unrolled, function (d) {
                return d.kg_unit / 1000 * taxExtent[1] / d.price_unit * 100;
            })];
            console.log(domain);
            this.scale = d3.scaleLinear().domain([0, domain[1]]).range([0, 1]);
            window.scale = this.scale;
            this.barCharts = this.chartDivs.append('div').classed('bar', true).classed('bar-null', function (d) {
                return d.price_unit === 'null';
            });

            this.percentDivs = this.chartDivs.append('div').classed('percent-div', true);

            this.priceDivs = this.chartDivs.append('div').classed('price-div', true);

            this.updateBarCharts();
        },
        updateBarCharts: function updateBarCharts() {
            var _this2 = this;

            this.barCharts.transition(view.transition).style('transform', function (d) {
                if (d.price_unit !== 'null') {
                    return 'scale(' + _this2.scale(d.kg_unit / 1000 * model.selectedTax / d.price_unit * 100) + ', 1)';
                    //   2100.82  / 1000 = 2.1  *  20  = 42.02        + 31.83 = 73.85  / 31.83 = 
                }
            });

            view.fadeInHTML.call(view.percentDivs, function (d) {
                if (d.price_unit !== 'null') {
                    return d3.format(',.0f')(d.kg_unit / 1000 * model.selectedTax / d.price_unit * 100) + '%';
                }
            });

            view.percentDivs.transition(view.transition).style('left', function (d) {
                return 'calc(' + _this2.scale(d.kg_unit / 1000 * model.selectedTax / d.price_unit * 100) * 100 + '% + 5px)';
            });

            view.updatePriceDivs();
            console.log(model);
            /*
                example @ 20 / metric ton
                coal (all types). price_unit: 31.83 / short ton.
                tax =  $20 * 2.1 tons / short ton =  $42.02 / short ton
                 1 short ton was 31.83 and is now 31.83 + 42.02 = 73.85
                 73.85 42.02/31.83
            */
        }
    };

    var scrollMonitors = {
        monitors: {},
        init: function init() {
            this.setMonitors();
            var timeOut = null;
            window.onresize = function () {
                if (timeOut != null) {
                    clearTimeout(timeOut);
                }
                timeOut = setTimeout(function () {
                    console.log('resized');
                    scrollMonitors.destroyMonitors();
                    scrollMonitors.setMonitors();
                }, 200);
            };
        },
        destroyMonitors: function destroyMonitors() {
            scrollMonitors.monitors.elementWatcher.destroy();
            scrollMonitors.monitors.contWatcher.destroy();
        },
        setMonitors: function setMonitors() {

            console.log('init scrollMonitors');
            var el = document.getElementById('dropdown-wrapper');
            console.log(el.classList);
            this.monitors.elementWatcher = scrollMonitor.create(el);
            var elementWatcher = this.monitors.elementWatcher;
            elementWatcher.lock();

            elementWatcher.partiallyExitViewport(function () {
                if (this.isAboveViewport) {
                    el.classList.add('fixed');
                }
            });

            elementWatcher.fullyEnterViewport(function () {
                el.classList.remove('fixed');
            });

            var cont = document.getElementById('d3-content');
            this.monitors.contWatcher = scrollMonitor.create(cont, { bottom: -44 });
            var contWatcher = this.monitors.contWatcher;
            contWatcher.exitViewport(function () {
                if (this.isAboveViewport) {
                    el.classList.add('fade');
                }
            });
            contWatcher.enterViewport(function () {
                if (this.isAboveViewport) {
                    el.classList.remove('fade');
                }
            });
        }
    };

    controller.init();
})(); // end IIFE

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQTtBQUNBLENBQUMsWUFBVTtBQUNYOztBQUNJLFFBQU0sUUFBUTtBQUNWLFlBRFUsa0JBQ0o7QUFBQTs7QUFBRTtBQUNKLGlCQUFLLFlBQUwsR0FBb0IsRUFBcEI7QUFDQSxnQkFBSSxVQUFVLDhDQUFkO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLFFBQUQsQ0FEWDs7QUFHQSxpQkFBSyxPQUFMLENBQWEsZ0JBQVE7QUFDakIsb0JBQUksVUFBVSxJQUFJLE9BQUosQ0FBWSxVQUFDLE9BQUQsRUFBUyxNQUFULEVBQW9CO0FBQzFDLHVCQUFHLElBQUgsQ0FBUSxtREFBbUQsT0FBbkQsR0FBNkQsVUFBN0QsR0FBMEUsSUFBMUUsR0FBaUYsOENBQXpGLEVBQXlJLFVBQUMsS0FBRCxFQUFPLElBQVAsRUFBZ0I7QUFBRTtBQUN2Siw0QkFBSSxLQUFKLEVBQVc7QUFDUCxtQ0FBTyxLQUFQO0FBQ0Esa0NBQU0sS0FBTjtBQUNIO0FBQ0QsNEJBQUksU0FBUyxLQUFLLE1BQWxCO0FBQ0EsZ0NBQVEsR0FBUixDQUFZLE1BQVo7QUFDQSxnQ0FBUSxNQUFLLGVBQUwsQ0FBcUIsTUFBckIsRUFBNkIsVUFBN0IsQ0FBUjtBQUNILHFCQVJEO0FBU0gsaUJBVmEsQ0FBZDtBQVdBLHNCQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsT0FBdkI7QUFDSCxhQWJEOztBQWVBLG1CQUFPLFFBQVEsR0FBUixDQUFZLEtBQUssWUFBakIsQ0FBUDtBQUNILFNBdEJTO0FBdUJWLHVCQXZCVSwyQkF1Qk0sTUF2Qk4sRUF1QmMsTUF2QmQsRUF1QnFCOztBQUUzQixxQkFBUyxJQUFULENBQWMsTUFBZCxFQUFzQjtBQUNsQix1QkFBTyxHQUFHLElBQUgsR0FDRixHQURFLENBQ0UsVUFBUyxDQUFULEVBQVk7QUFBRSwyQkFBTyxFQUFFLE1B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QUFDSCxhQUZBOztBQUlELGdCQUFJLE9BQU8sU0FBUyxjQUFULENBQXdCLFlBQXhCLENBQVg7QUFDQSxpQkFBSyxRQUFMLENBQWMsV0FBZCxHQUE0QixjQUFjLE1BQWQsQ0FBc0IsSUFBdEIsRUFBNEIsRUFBQyxRQUFPLENBQUMsRUFBVCxFQUE1QixDQUE1QjtBQUNBLGdCQUFJLGNBQWMsS0FBSyxRQUFMLENBQWMsV0FBaEM7QUFDQSx3QkFBWSxZQUFaLENBQXlCLFlBQVU7QUFDL0Isb0JBQUssS0FBSyxlQUFWLEVBQTJCO0FBQ3ZCLHVCQUFHLFNBQUgsQ0FBYSxHQUFiLENBQWlCLE1BQWpCO0FBQ0g7QUFDSixhQUpEO0FBS0Esd0JBQVksYUFBWixDQUEwQixZQUFVO0FBQ2hDLG9CQUFLLEtBQUssZUFBVixFQUEyQjtBQUN2Qix1QkFBRyxTQUFILENBQWEsTUFBYixDQUFvQixNQUFwQjtBQUNIO0FBQ0osYUFKRDtBQUtIO0FBckRnQixLQUFyQjs7QUF3REEsZUFBVyxJQUFYO0FBRUgsQ0F6VUQsSSxDQXlVTSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyB3aWxsIG5lZWQgdG8gcG9seWZpbGw6IFByb21pc2VzLCBcbihmdW5jdGlvbigpeyAgXG5cInVzZSBzdHJpY3RcIjtcbiAgICBjb25zdCBtb2RlbCA9IHtcbiAgICAgICAgaW5pdCgpeyAvLyBTSE9VTEQgVEhJUyBTVFVGRiBCRSBJTiBDT05UUk9MTEVSP1xuICAgICAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciBzaGVldElEID0gJzF0OWtSRWF2S29yQ3ljd2d4ck9JZFMtWmswT0pXVEIzQkRXNnY3eHU1em80JyxcbiAgICAgICAgICAgICAgICB0YWJzID0gWydTaGVldDEnXTtcblxuICAgICAgICAgICAgdGFicy5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgLy8gY29sdW1ucyBBIHRocm91Z2ggSVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHZhbHVlcyk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsICdjYXRlZ29yeScpKTsgXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgcm9sbHVwKXtcblxuICAgICAgICAgICAgZnVuY3Rpb24gbmVzdCh2YWx1ZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZDMubmVzdCgpXG4gICAgICAgICAgICAgICAgICAgIC5rZXkoZnVuY3Rpb24oZCkgeyByZXR1cm4gZFtyb2xsdXBdOyB9KVxuICAgICAgICAgICAgICAgICAgICAuZW50cmllcyh2YWx1ZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIga2V5VmFsdWVzID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICBhY2NbdmFsdWVzWzBdW2ldXSA9IGlzTmFOKCtjdXIpID8gY3VyIDogK2N1cjsgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgIGlmICggIXJvbGx1cCApe1xuICAgICAgICAgICAgICAgIHJldHVybiBrZXlWYWx1ZXM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1vZGVsLnVucm9sbGVkID0ga2V5VmFsdWVzO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0KGtleVZhbHVlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IHtcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgbW9kZWwuaW5pdCgpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICBtb2RlbC5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgIG1vZGVsLnNlbGVjdGVkVGF4ID0gZDMuc2VsZWN0KCcjcHJpY2Utc2VsZWN0b3InKS5ub2RlKCkudmFsdWU7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KCcjcHJpY2Utc2VsZWN0b3InKVxuICAgICAgICAgICAgICAgICAgICAub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbC5zZWxlY3RlZFRheCA9IGQzLmV2ZW50LnRhcmdldC52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXcudXBkYXRlVGF4UGVyVW5pdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmlldy51cGRhdGVCYXJDaGFydHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXcudXBkYXRlUHJpY2VEaXZzKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZpZXcuaW5pdCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBjb25zdCB2aWV3ID0ge1xuICAgICAgICBcbiAgICAgICAgZmFkZUluSFRNTChjYWxsYmFjayl7XG4gICAgICAgICAgICB0aGlzLmVhY2goZnVuY3Rpb24oZCxpLGFycmF5KXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLGQsaSxhcnJheSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIHRoaXMudHJhbnNpdGlvbigpXG4gICAgICAgICAgICAgICAgLmR1cmF0aW9uKHZpZXcuZHVyYXRpb24gLyAyKVxuICAgICAgICAgICAgICAgIC5lYXNlKGQzLmVhc2VDdWJpY091dClcbiAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAgICAgICAgIC5vbignZW5kJywgZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgIHZhciAkdGhpcyA9IGQzLnNlbGVjdCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgJHRoaXMuaHRtbChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGQpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgJHRoaXMudHJhbnNpdGlvbigpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZHVyYXRpb24odmlldy5kdXJhdGlvbiAvIDIpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZWFzZShkMy5lYXNlQ3ViaWNPdXQpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAxKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3ZpZXcgaW5pdCcsIG1vZGVsLmRhdGEpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gNzUwO1xuICAgICAgICAgICAgdGhpcy50cmFuc2l0aW9uID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBkMy50cmFuc2l0aW9uKClcbiAgICAgICAgICAgICAgICAgICAgLmR1cmF0aW9uKHZpZXcuZHVyYXRpb24pXG4gICAgICAgICAgICAgICAgICAgIC5lYXNlKGQzLmVhc2VDdWJpY091dCk7IFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzY3JvbGxNb25pdG9ycy5pbml0KCk7XG4gICAgICAgICAgICB2YXIgZnVlbENhdGVnb3JpZXMgPSBkMy5zZWxlY3QoJyNkMy1jb250ZW50JylcbiAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdjYXRlZ29yaWVzJylcbiAgICAgICAgICAgICAgICAuZGF0YShtb2RlbC5kYXRhKVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnY2F0ZWdvcnknLCB0cnVlKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCduby1wcmljZXMnLCBmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEoIGQua2V5ID09PSAnRm9yIGhvbWVzIGFuZCBidXNpbmVzc2VzJyB8fCBkLmtleSA9PT0gJ0NvYWxzIGJ5IHR5cGUnIHx8IGQua2V5ID09PSAnT3RoZXIgdHJhbnNwb3J0YXRpb24gZnVlbHMnKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIGNhdGVnb3J5SGVhZGluZyA9IGZ1ZWxDYXRlZ29yaWVzLmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnY2F0ZWdvcnktaGVhZGluZyBtYXJnaW5zIGZsZXgtY29udGFpbmVyIGZsZXgtc3RhcnQnLCB0cnVlKTtcblxuICAgICAgICAgICAgY2F0ZWdvcnlIZWFkaW5nLmFwcGVuZCgnaDMnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCduby1tYXJnaW4nLCB0cnVlKVxuICAgICAgICAgICAgICAgIC50ZXh0KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZC5rZXk7XG4gICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgdmFyIGVhY2hGdWVsSGVhZGluZ3MgPSBmdWVsQ2F0ZWdvcmllcy5hcHBlbmQoJ2RpdicpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2Z1ZWwgY29sdW1uLWxhYmVscyBmbGV4LWNvbnRhaW5lciBtYXJnaW5zIGZsZXgtc3RhcnQnLCB0cnVlKTtcblxuICAgICAgICAgICAgZWFjaEZ1ZWxIZWFkaW5ncy5hcHBlbmQoJ3AnKS8vIFRPIERPOiB0aGlzIGNhbiBiZSBkb25lIGJlZm9yZSB0aGUgcmV0dXJuIG9mIHRoZSBkYXRhIGRyaXZlbiBzdHV1ZiBiZWxvd1xuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdjb2x1bW4tbGFiZWwgbGFiZWwtZnVlbCBuby1tYXJnaW4nLCB0cnVlKVxuICAgICAgICAgICAgICAgIC50ZXh0KCcnKTtcblxuICAgICAgICAgICAgdmFyIGRhdGFIZWFkaW5ncyA9IGVhY2hGdWVsSGVhZGluZ3MuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkYXRhLWhlYWRpbmdzIGZsZXgtY29udGFpbmVyIGZsZXgtc3RhcnQnLCB0cnVlKTtcblxuICAgICAgICAgICAgZGF0YUhlYWRpbmdzLmFwcGVuZCgncCcpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2NvbHVtbi1sYWJlbCBsYWJlbC1jbzItZW1pc3Npb25zIG5vLW1hcmdpbicsIHRydWUpXG4gICAgICAgICAgICAgICAgLmh0bWwoJ2tnIG9mIENPJiM4MzIyOycpO1xuXG4gICAgICAgICAgICBkYXRhSGVhZGluZ3MuYXBwZW5kKCdwJylcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnY29sdW1uLWxhYmVsIGxhYmVsLXRheCBuby1tYXJnaW4nLCB0cnVlKVxuICAgICAgICAgICAgICAgIC50ZXh0KCdjYXJib24gdGF4Jyk7XG5cbiAgICAgICAgICAgIGRhdGFIZWFkaW5ncy5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdjb2x1bW4tbGFiZWwgbGFiZWwtcHJpY2Ugbm8tbWFyZ2luJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAudGV4dCgncHJpY2UgY2hhbmdlIHBlciB1bml0Jyk7XG5cbiAgICAgICAgICAgIHZhciBlYWNoRnVlbCA9IGZ1ZWxDYXRlZ29yaWVzLnNlbGVjdEFsbCgnZnVlbHMnKVxuICAgICAgICAgICAgICAgIC5kYXRhKGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZC52YWx1ZXM7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ2RpdicpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2Z1ZWwgZmxleC1jb250YWluZXIgbWFyZ2lucyBmbGV4LXN0YXJ0JywgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICBlYWNoRnVlbC5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdmdWVsLW5hbWUgbm8tbWFyZ2luJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAudGV4dChmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQuZnVlbDtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIGZ1ZWxEYXRhID0gZWFjaEZ1ZWwuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdmdWVsLWRhdGEgZmxleC1jb250YWluZXIgZ3JvdycsIHRydWUpO1xuXG4gICAgICAgICAgICB0aGlzLmNvMkVtaXNzaW9ucyA9IGZ1ZWxEYXRhLmFwcGVuZCgncCcpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ25vLW1hcmdpbiBjbzItZW1pc3Npb25zJywgdHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUVtaXNzaW9ucygpO1xuICAgICAgICAgICAgdGhpcy50YXhQZXJVbml0ID0gZnVlbERhdGEuYXBwZW5kKCdwJylcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnbm8tbWFyZ2luIHRheC1wZXItdW5pdCcsIHRydWUpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVUYXhQZXJVbml0KCk7XG4gICAgICAgICAgICB0aGlzLmNoYXJ0V3JhcHBlcnMgPSBmdWVsRGF0YS5hcHBlbmQoJ2RpdicpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2NoYXJ0LXdyYXBwZXIgZ3JvdycsIHRydWUpO1xuICAgICAgICAgICAgdGhpcy5jaGFydERpdnMgPSB0aGlzLmNoYXJ0V3JhcHBlcnMuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdjaGFydC1jb250YWluZXIgZmxleC1jb250YWluZXInLCB0cnVlKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5jcmVhdGVCYXJDaGFydHMoKTtcblxuICAgICAgICB9LFxuICAgICAgICB1cGRhdGVFbWlzc2lvbnMoKXtcbiAgICAgICAgICAgICB2aWV3LmZhZGVJbkhUTUwuY2FsbCh2aWV3LmNvMkVtaXNzaW9ucywgZnVuY3Rpb24oZCl7IC8vIGNhbGxpbmcgZmFkZUluSFRNTDsgcGFyYW0gMiBpcyB0aGUgZnVuY3Rpb24gdG8gcmV0dXJuIHRoZSBodG1sXG4gICAgICAgICAgICAgICAgaWYgKCBpc05hTihkLmtnX3VuaXQpICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYG4uYS4gPGJyIC8+KCR7ZC5rZ19idHV9IC8gQlRVIClgO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICggZC5rZ191bml0IDwgMTAwMCApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGAke2QzLmZvcm1hdCgnLCcpKGQua2dfdW5pdCl9IC8gJHtkLnVuaXR9PGJyIC8+KCR7ZC5rZ19idHV9IC8gQlRVIClgO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBgJHtkMy5mb3JtYXQoJywuMGYnKShkLmtnX3VuaXQpfSAvICR7ZC51bml0fTxiciAvPigke2Qua2dfYnR1fSAvIEJUVSApYDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlVGF4UGVyVW5pdCgpe1xuICAgICAgICAgIHZpZXcuZmFkZUluSFRNTC5jYWxsKHZpZXcudGF4UGVyVW5pdCwgZnVuY3Rpb24oZCl7IC8vIGNhbGxpbmcgZmFkZUluSFRNTDsgcGFyYW0gMiBpcyB0aGUgZnVuY3Rpb24gdG8gcmV0dXJuIHRoZSBodG1sXG4gICAgICAgICAgICAgICAgaWYgKCAhaXNOYU4oZC5rZ191bml0KSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYCQkeyBkMy5mb3JtYXQoJywuMmYnKSggKCBkLmtnX3VuaXQgLyAxMDAwICkgKiBtb2RlbC5zZWxlY3RlZFRheCApIH0gLyAke2QudW5pdH1gO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnbi5hLic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHVwZGF0ZVByaWNlRGl2cygpe1xuICAgICAgICAgICAgdmlldy5mYWRlSW5IVE1MLmNhbGwodmlldy5wcmljZURpdnMsIGZ1bmN0aW9uKGQpeyAvLyBjYWxsaW5nIGZhZGVJbkhUTUw7IHBhcmFtIDIgaXMgdGhlIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgaHRtbFxuICAgICAgICAgICAgICAgaWYgKGQucHJpY2VfdW5pdCAhPT0gJ251bGwnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBgKCQke2QzLmZvcm1hdCgnLC4yZicpKGQucHJpY2VfdW5pdCl9ICZyYXJyOyAkJHsgZDMuZm9ybWF0KCcsLjJmJykoZC5wcmljZV91bml0ICsgKCggZC5rZ191bml0IC8gMTAwMCApICogbW9kZWwuc2VsZWN0ZWRUYXggKSkgfSlgO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnbm90IHByb3ZpZGVkJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgLyogICB1cGRhdGVQZXJjZW50RGl2cygpe1xuICAgICAgICAgICAgdmlldy5mYWRlSW5IVE1MLmNhbGwodmlldy5wZXJjZW50YWdlRGl2cywgZnVuY3Rpb24oZCl7IC8vIGNhbGxpbmcgZmFkZUluSFRNTDsgcGFyYW0gMiBpcyB0aGUgZnVuY3Rpb24gdG8gcmV0dXJuIHRoZSBodG1sXG4gICAgICAgICAgICAgICByZXR1cm4gZDMuZm9ybWF0KCcsLjBmJykoKCggZC5wcmljZV91bml0ICsgKCggZC5rZ191bml0IC8gMTAwMCApICogbW9kZWwuc2VsZWN0ZWRUYXggKSApIC8gZC5wcmljZV91bml0KSAqIDEwMCApICsgJyUnO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sKi9cbiAgICAgICAgY3JlYXRlQmFyQ2hhcnRzKCl7XG4gICAgICAgICAgICB2YXIgdGF4RXh0ZW50ID0gZDMuZXh0ZW50KCBkMy5zZWxlY3QoJyNwcmljZS1zZWxlY3RvcicpLm5vZGUoKS5vcHRpb25zLCBmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gK2QudmFsdWU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciBkb21haW4gPSBbXG4gICAgICAgICAgICAgICAgZDMubWluKG1vZGVsLnVucm9sbGVkLCBmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICgoKCAoIGQua2dfdW5pdCAvIDEwMDAgKSAqIHRheEV4dGVudFswXSApICkgLyBkLnByaWNlX3VuaXQgKSAqIDEwMDtcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBkMy5tYXgobW9kZWwudW5yb2xsZWQsIGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgIHJldHVybiAoKCggKCBkLmtnX3VuaXQgLyAxMDAwICkgKiB0YXhFeHRlbnRbMV0gKSApIC8gZC5wcmljZV91bml0ICkgKiAxMDA7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhkb21haW4pO1xuICAgICAgICAgICAgdGhpcy5zY2FsZSA9IGQzLnNjYWxlTGluZWFyKCkuZG9tYWluKFswLCBkb21haW5bMV1dKS5yYW5nZShbMCwxXSk7IFxuICAgICAgICAgICAgd2luZG93LnNjYWxlID0gdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIHRoaXMuYmFyQ2hhcnRzID0gdGhpcy5jaGFydERpdnMuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdiYXInLCB0cnVlKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdiYXItbnVsbCcsZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkLnByaWNlX3VuaXQgPT09ICdudWxsJzsgXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMucGVyY2VudERpdnMgPSB0aGlzLmNoYXJ0RGl2cy5hcHBlbmQoJ2RpdicpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3BlcmNlbnQtZGl2JywgdHJ1ZSk7XG5cbiAgICAgICAgICAgIHRoaXMucHJpY2VEaXZzID0gdGhpcy5jaGFydERpdnNcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdwcmljZS1kaXYnLCB0cnVlKTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVCYXJDaGFydHMoKTtcbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlQmFyQ2hhcnRzKCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMuYmFyQ2hhcnRzXG4gICAgICAgICAgICAgICAgLnRyYW5zaXRpb24odmlldy50cmFuc2l0aW9uKVxuICAgICAgICAgICAgICAgIC5zdHlsZSgndHJhbnNmb3JtJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGQucHJpY2VfdW5pdCAhPT0gJ251bGwnKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnc2NhbGUoJyArIHRoaXMuc2NhbGUoKCgoICggZC5rZ191bml0IC8gMTAwMCApICogbW9kZWwuc2VsZWN0ZWRUYXggKSApIC8gZC5wcmljZV91bml0ICkgKiAxMDAgICkgKyAnLCAxKSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAyMTAwLjgyICAvIDEwMDAgPSAyLjEgICogIDIwICA9IDQyLjAyICAgICAgICArIDMxLjgzID0gNzMuODUgIC8gMzEuODMgPSBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2aWV3LmZhZGVJbkhUTUwuY2FsbCh2aWV3LnBlcmNlbnREaXZzLCBmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICBpZiAoZC5wcmljZV91bml0ICE9PSAnbnVsbCcpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDMuZm9ybWF0KCcsLjBmJykoKCggKCggZC5rZ191bml0IC8gMTAwMCApICogbW9kZWwuc2VsZWN0ZWRUYXggKSApIC8gZC5wcmljZV91bml0KSAqIDEwMCApICsgJyUnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgdmlldy5wZXJjZW50RGl2c1xuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKHZpZXcudHJhbnNpdGlvbilcbiAgICAgICAgICAgICAgICAuc3R5bGUoJ2xlZnQnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2NhbGMoJyArIHRoaXMuc2NhbGUoKCgoICggZC5rZ191bml0IC8gMTAwMCApICogbW9kZWwuc2VsZWN0ZWRUYXggKSApIC8gZC5wcmljZV91bml0ICkgKiAxMDAgICkgKiAxMDAgKyAnJSArIDVweCknO1xuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIHZpZXcudXBkYXRlUHJpY2VEaXZzKCk7XG5jb25zb2xlLmxvZyhtb2RlbCk7XG4gICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgICAgZXhhbXBsZSBAIDIwIC8gbWV0cmljIHRvblxuICAgICAgICAgICAgICAgICAgICBjb2FsIChhbGwgdHlwZXMpLiBwcmljZV91bml0OiAzMS44MyAvIHNob3J0IHRvbi5cbiAgICAgICAgICAgICAgICAgICAgdGF4ID0gICQyMCAqIDIuMSB0b25zIC8gc2hvcnQgdG9uID0gICQ0Mi4wMiAvIHNob3J0IHRvblxuXG4gICAgICAgICAgICAgICAgICAgIDEgc2hvcnQgdG9uIHdhcyAzMS44MyBhbmQgaXMgbm93IDMxLjgzICsgNDIuMDIgPSA3My44NVxuXG4gICAgICAgICAgICAgICAgICAgIDczLjg1IDQyLjAyLzMxLjgzXG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgc2Nyb2xsTW9uaXRvcnMgPSB7XG4gICAgICAgIG1vbml0b3JzOiB7fSxcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgdGhpcy5zZXRNb25pdG9ycygpO1xuICAgICAgICAgICAgdmFyIHRpbWVPdXQgPSBudWxsO1xuICAgICAgICAgICAgd2luZG93Lm9ucmVzaXplID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBpZiAodGltZU91dCAhPSBudWxsKXtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVPdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aW1lT3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygncmVzaXplZCcpO1xuICAgICAgICAgICAgICAgICAgICBzY3JvbGxNb25pdG9ycy5kZXN0cm95TW9uaXRvcnMoKTtcbiAgICAgICAgICAgICAgICAgICAgc2Nyb2xsTW9uaXRvcnMuc2V0TW9uaXRvcnMoKTtcbiAgICAgICAgICAgICAgICB9LCAyMDApO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9LFxuICAgICAgICBkZXN0cm95TW9uaXRvcnMoKXtcbiAgICAgICAgICAgIHNjcm9sbE1vbml0b3JzLm1vbml0b3JzLmVsZW1lbnRXYXRjaGVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHNjcm9sbE1vbml0b3JzLm1vbml0b3JzLmNvbnRXYXRjaGVyLmRlc3Ryb3koKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0TW9uaXRvcnMoKXtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2luaXQgc2Nyb2xsTW9uaXRvcnMnKTtcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcm9wZG93bi13cmFwcGVyJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlbC5jbGFzc0xpc3QpO1xuICAgICAgICAgICAgdGhpcy5tb25pdG9ycy5lbGVtZW50V2F0Y2hlciA9IHNjcm9sbE1vbml0b3IuY3JlYXRlKCBlbCApO1xuICAgICAgICAgICAgdmFyIGVsZW1lbnRXYXRjaGVyID0gdGhpcy5tb25pdG9ycy5lbGVtZW50V2F0Y2hlcjtcbiAgICAgICAgICAgIGVsZW1lbnRXYXRjaGVyLmxvY2soKTtcblxuICAgICAgICAgICAgZWxlbWVudFdhdGNoZXIucGFydGlhbGx5RXhpdFZpZXdwb3J0KGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNBYm92ZVZpZXdwb3J0KXtcbiAgICAgICAgICAgICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZml4ZWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgIGVsZW1lbnRXYXRjaGVyLmZ1bGx5RW50ZXJWaWV3cG9ydChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2ZpeGVkJyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIGNvbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZDMtY29udGVudCcpO1xuICAgICAgICAgICAgdGhpcy5tb25pdG9ycy5jb250V2F0Y2hlciA9IHNjcm9sbE1vbml0b3IuY3JlYXRlKCBjb250LCB7Ym90dG9tOi00NH0gKTtcbiAgICAgICAgICAgIHZhciBjb250V2F0Y2hlciA9IHRoaXMubW9uaXRvcnMuY29udFdhdGNoZXI7XG4gICAgICAgICAgICBjb250V2F0Y2hlci5leGl0Vmlld3BvcnQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMuaXNBYm92ZVZpZXdwb3J0ICl7XG4gICAgICAgICAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2ZhZGUnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnRXYXRjaGVyLmVudGVyVmlld3BvcnQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMuaXNBYm92ZVZpZXdwb3J0ICl7XG4gICAgICAgICAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2ZhZGUnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb250cm9sbGVyLmluaXQoKTtcblxufSkoKTsgLy8gZW5kIElJRkVcbiJdfQ==

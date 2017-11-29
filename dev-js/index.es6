// will need to polyfill: Promises, 
(function(){  
"use strict"; 
    const model = {
        init(){ // SHOULD THIS STUFF BE IN CONTROLLER?
            this.dataPromises = [];
            var sheetID = '1t9kREavKorCycwgxrOIdS-Zk0OJWTB3BDW6v7xu5zo4',
                tabs = ['Sheet1'];

            tabs.forEach(each => {
                var promise = new Promise((resolve,reject) => {
                    d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', (error,data) => { // columns A through I
                        if (error) {
                            reject(error);
                            throw error;
                        }
                        var values = data.values;
                        console.log(values); 
                        resolve(this.returnKeyValues(values, 'category')); 
                    });
                });
                this.dataPromises.push(promise);
            });

            return Promise.all(this.dataPromises);
        },
        returnKeyValues(values, rollup){

            function nest(values) {
                return d3.nest()
                    .key(function(d) { return d[rollup]; })
                    .entries(values);
            }

            var keyValues = values.slice(1).map(row => row.reduce(function(acc, cur, i) { // 1. params: total, currentValue, currentIndex[, arr]
                acc[values[0][i]] = isNaN(+cur) ? cur : +cur; // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
                return acc;
            }, {}));
            if ( !rollup ){
                return keyValues;
            } else {
                model.unrolled = keyValues;
                return nest(keyValues);
            }
        }
    };

    const controller = {
        init(){
            model.init().then(values => {
                model.data = values[0];
                model.selectedTax = d3.select('#price-selector').node().value;
                d3.select('#price-selector')
                    .on('change', function(){
                        model.selectedTax = d3.event.target.value;
                        view.updateTaxPerUnit();
                        view.updateBarCharts();
                        view.updatePriceDivs();
                    });
                
                view.init();
            });
        }

    };

    const view = {
        
        fadeInHTML(callback){
            this.each(function(d,i,array){
                console.log(this,d,i,array);
            });
            console.log(callback);
            this.transition()
                .duration(view.duration / 2)
                .ease(d3.easeCubicOut)
                .style('opacity', 0)
                .on('end', function(d){
                    var $this = d3.select(this);
                    $this.html(function(){
                        return callback(d);
                    });
                    $this.transition()
                        .duration(view.duration / 2)
                        .ease(d3.easeCubicOut)
                        .style('opacity', 1);
                });
        },
        init(){
            console.log('view init', model.data);
            
            this.duration = 750;
            this.transition = function(){
                d3.transition()
                    .duration(view.duration)
                    .ease(d3.easeCubicOut); 
                };
            var fuelCategories = d3.select('#d3-content')
                .selectAll('categories')
                .data(model.data)
                .enter().append('div')
                .classed('category', true)
                .classed('no-prices', function(d){
                    return !( d.key === 'For homes and businesses' || d.key === 'Coals by type' || d.key === 'Other transportation fuels');
                });

            var categoryHeading = fuelCategories.append('div')
                .classed('category-heading margins flex-container flex-start', true);

            categoryHeading.append('h3')
                .classed('no-margin', true)
                .text(function(d){
                    return d.key;
                });


            var eachFuelHeadings = fuelCategories.append('div')
                .classed('fuel column-labels flex-container margins flex-start', true);

            eachFuelHeadings.append('p')// TO DO: this can be done before the return of the data driven stuuf below
                .classed('column-label label-fuel no-margin', true)
                .text('');

            var dataHeadings = eachFuelHeadings.append('div')
                .classed('data-headings flex-container flex-start', true);

            dataHeadings.append('p')
                .classed('column-label label-co2-emissions no-margin', true)
                .html('kg of CO&#8322;');

            dataHeadings.append('p')
                .classed('column-label label-tax no-margin', true)
                .text('carbon tax');

            dataHeadings.append('p')
                .classed('column-label label-price no-margin', true)
                .text('price change per unit');

            var eachFuel = fuelCategories.selectAll('fuels')
                .data(function(d){
                    return d.values;
                })
                .enter().append('div')
                .classed('fuel flex-container margins flex-start', true);

                eachFuel.append('p')
                .classed('fuel-name no-margin', true)
                .text(function(d){
                    return d.fuel;
                });

            var fuelData = eachFuel.append('div')
                .classed('fuel-data flex-container grow', true);

            this.co2Emissions = fuelData.append('p')
                .classed('no-margin co2-emissions', true);
            this.updateEmissions();
            this.taxPerUnit = fuelData.append('p')
                .classed('no-margin tax-per-unit', true);
            this.updateTaxPerUnit();
            this.chartWrappers = fuelData.append('div')
                .classed('chart-wrapper grow', true);
            this.chartDivs = this.chartWrappers.append('div')
                .classed('chart-container flex-container', true);
            
            this.createBarCharts();

        },
        updateEmissions(){
             view.fadeInHTML.call(view.co2Emissions, function(d){ // calling fadeInHTML; param 2 is the function to return the html
                if ( isNaN(d.kg_unit) ) {
                    return `n.a. <br />(${d.kg_btu} / BTU )`;
                }
                else if ( d.kg_unit < 1000 ) {
                    return `${d3.format(',')(d.kg_unit)} / ${d.unit}<br />(${d.kg_btu} / BTU )`;
                } else {
                    return `${d3.format(',.0f')(d.kg_unit)} / ${d.unit}<br />(${d.kg_btu} / BTU )`;
                }
            });
        },
        updateTaxPerUnit(){
          view.fadeInHTML.call(view.taxPerUnit, function(d){ // calling fadeInHTML; param 2 is the function to return the html
                if ( !isNaN(d.kg_unit) ){
                    return `$${ d3.format(',.2f')( ( d.kg_unit / 1000 ) * model.selectedTax ) } / ${d.unit}`;
                } else {
                    return 'n.a.';
                }
            });
        },
        updatePriceDivs(){
            view.fadeInHTML.call(view.priceDivs, function(d){ // calling fadeInHTML; param 2 is the function to return the html
               if (d.price_unit !== 'null' ){
                    return `($${d3.format(',.2f')(d.price_unit)} &rarr; $${ d3.format(',.2f')(d.price_unit + (( d.kg_unit / 1000 ) * model.selectedTax )) })`;
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
        createBarCharts(){
            var taxExtent = d3.extent( d3.select('#price-selector').node().options, function(d){
                return +d.value;
            });
            var domain = [
                d3.min(model.unrolled, function(d){
                    return ((( ( d.kg_unit / 1000 ) * taxExtent[0] ) ) / d.price_unit ) * 100;
                }),
                d3.max(model.unrolled, function(d){
                return ((( ( d.kg_unit / 1000 ) * taxExtent[1] ) ) / d.price_unit ) * 100;
                })
            ];
            console.log(domain);
            this.scale = d3.scaleLinear().domain([0, domain[1]]).range([0,1]); 
            window.scale = this.scale;
            this.barCharts = this.chartDivs.append('div')
                .classed('bar', true)
                .classed('bar-null',function(d){
                    return d.price_unit === 'null'; 
                });

            this.percentDivs = this.chartDivs.append('div')
                .classed('percent-div', true);

            this.priceDivs = this.chartDivs
                .append('div')
                .classed('price-div', true);

            this.updateBarCharts();
        },
        updateBarCharts(){
            
            this.barCharts
                .transition(view.transition)
                .style('transform', (d) => {
                    if (d.price_unit !== 'null'){
                        return 'scale(' + this.scale(((( ( d.kg_unit / 1000 ) * model.selectedTax ) ) / d.price_unit ) * 100  ) + ', 1)';
                            //   2100.82  / 1000 = 2.1  *  20  = 42.02        + 31.83 = 73.85  / 31.83 = 
                    }
                });

            view.fadeInHTML.call(view.percentDivs, function(d){
                if (d.price_unit !== 'null'){
                    return d3.format(',.0f')((( (( d.kg_unit / 1000 ) * model.selectedTax ) ) / d.price_unit) * 100 ) + '%';
                }
            });
                
            view.percentDivs
                .transition(view.transition)
                .style('left', (d) => {
                    return 'calc(' + this.scale(((( ( d.kg_unit / 1000 ) * model.selectedTax ) ) / d.price_unit ) * 100  ) * 100 + '% + 5px)';
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

    controller.init();

})(); // end IIFE

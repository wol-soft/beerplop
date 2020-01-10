(function(beerFactoryGame) {
    'use strict';

    const PRODUCTION_BALANCE__ADD    = 'produced';
    const PRODUCTION_BALANCE__REMOVE = 'consumed';

    Stock.prototype.state           = null;
    Stock.prototype.cache           = null;
    Stock.prototype.numberFormatter = null;

    // track the production and the balance for materials
    Stock.prototype.productionBalanceIteration    = {};
    Stock.prototype.productionBalance             = {};
    Stock.prototype.averageProductionPerIteration = 0;

    // track the current total amount in stock
    Stock.prototype.amount = 0;

    Stock.prototype.materialFlowGraph = {
        material:         null,
        chart:            null,
        iterationCounter: 0,
        produced:         {},
        consumed:         {},
    };

    Stock.prototype.productionBalanceCache = {};

    function Stock(state, cache, numberFormatter) {
        this.state           = state;
        this.cache           = cache;
        this.numberFormatter = numberFormatter;
    }

    /**
     * How many items of the material can be stored?
     *
     * @param {string} material
     *
     * @returns {number}
     */
    Stock.prototype.getMaterialStockCapacity = function (material) {
        // TODO: possible cache
        const storage = this.state.getFactory('storage');

        return Math.floor(
            (100 + storage.amount * 50)
                * Math.pow(4, storage.upgrades.double)
                * this.state.getGameSpeed()
                / MATERIAL_STORAGE_DIVIDENT[material]
        );
    };

    /**
     * Add items to the stock. Returns the amount of added items (may differ from the requested amount if not enough
     * capacity for the material is available)
     *
     * @param {string}  materialKey The requested material
     * @param {number}  amount   The requested amount to add
     * @param {string}  source   The source which adds the material to the stock
     * @param {boolean} updateUI Update the UI of the stock table
     *
     * @returns {number}
     */
    Stock.prototype.addToStock = function (materialKey, amount, source, updateUI = true) {
        this._registerProductionBalance(materialKey, amount, PRODUCTION_BALANCE__ADD);

        const materialStockCapacity = this.getMaterialStockCapacity(materialKey),
              material              = this.state.getMaterial(materialKey) ;

        if (material.amount >= materialStockCapacity || amount <= 0) {
            return 0;
        }

        amount = Math.min(amount, materialStockCapacity - material.amount);
        material.amount += amount;
        material.total += amount;
        this.amount += amount;

        if (updateUI && amount) {
            this.updateStock();
        }

        this._registerMaterialFlow(materialKey, amount, source, PRODUCTION_BALANCE__ADD);

        return amount;
    };

    /**
     * Remove items from the stock. Returns the amount of removed items (may differ from the requested amount if not
     * enough items are available)
     *
     * @param {string}  materialKey The requested material
     * @param {number}  amount      The requested amount to remove
     * @param {string}  destination The consumer of the material
     * @param {boolean} updateUI    Update the UI of the stock table
     *
     * @returns {number}
     */
    Stock.prototype.removeFromStock = function (materialKey, amount, destination, updateUI = true) {
        this._registerProductionBalance(materialKey, amount, PRODUCTION_BALANCE__REMOVE);
        const material = this.state.getMaterial(materialKey);

        if (material.amount <= 0 || amount <= 0) {
            return 0;
        }

        amount = Math.min(material.amount, amount);
        material.amount -= amount;
        this.amount -= amount;

        if (updateUI) {
            this.updateStock();
        }

        this._registerMaterialFlow(materialKey, amount, destination, PRODUCTION_BALANCE__REMOVE);

        return amount;
    };

    /**
     * Check if any material in stock contains more materials than allowed (eg. after a boost).
     * In this case remove all items so the stock doesn't contain more items than allowed.
     */
    Stock.prototype.clearStockOverflow = function () {
        $.each(this.state.getState().materials, (function (materialKey, material) {
            const capacity = this.getMaterialStockCapacity(materialKey);

            if (material.amount > capacity) {
                material.amount = capacity;
            }
        }).bind(this));

        this.updateCurrentAmount();
    };

    /**
     * Update the current amount of materials in the stock
     */
    Stock.prototype.updateCurrentAmount = function () {
        this.amount = Object.values(this.state.getState().materials).reduce((prev, cur) => prev + cur.amount, 0);
    };

    /**
     * Update all variable parts of the stock table
     */
    Stock.prototype.updateStock = function () {
        // TODO: check calls per iteration
        $('#beer-factory__stock__total').text(this.numberFormatter.formatInt(this.amount));
        $('#beer-factory__delivery-capacity').text(this.numberFormatter.formatInt(this.cache.getDeliverCapacity()));

        $.each(this.state.getMaterials(), (function updateStockAmount(material, materialData) {
            $('#beer-factory__stock__amount-' + material).text(this.numberFormatter.formatInt(materialData.amount));
        }).bind(this));
    };

    /**
     * Register a request to a stock resource
     *
     * @param material The requested material
     * @param amount   The requested amount
     * @param type     "produced" or "consumed"
     *
     * @private
     */
    Stock.prototype._registerProductionBalance = function (material, amount, type) {
        if (!this.productionBalanceIteration[material]) {
            this.productionBalanceIteration[material] = {
                produced: 0,
                consumed: 0,
            };
        }

        this.productionBalanceIteration[material][type] += amount;
    };

    /**
     * Register a request to a stock resource
     *
     * @param material         The moved material
     * @param amount           The moved amount
     * @param trackingLocation The producer/consumer of the material
     * @param type             "produced" or "consumed"
     *
     * @private
     */
    Stock.prototype._registerMaterialFlow = function (material, amount, trackingLocation, type) {
        if (this.materialFlowGraph.material !== material) {
            return;
        }

        if (!this.materialFlowGraph[type][trackingLocation]) {
            this.materialFlowGraph[type][trackingLocation] = {
                amount:     [],
                iteration:  amount,
                lastUpdate: this.materialFlowGraph.iterationCounter
            };
        } else {
            this.materialFlowGraph[type][trackingLocation].iteration += amount;
            this.materialFlowGraph[type][trackingLocation].lastUpdate = this.materialFlowGraph.iterationCounter;
        }
    };

    /**
     * Adds all event listeners required for the stock table partial view
     */
    Stock.prototype.initStockTableEventListener = function () {
        $('#beer-factory__transport-preference').on('change', (function (event) {
            this.state.getState().deliveryPreferQueue = $(event.target).is(':checked');
        }).bind(this));

        $('.beer-factory__stock__container').on('click', (function (event) {
            this._initMaterialFlowGraph($(event.target).closest('.beer-factory__stock__container').data('material'));
        }).bind(this));
    };

    /**
     * Order a list of materials by their current production balance. The least produced material will be set to the
     * top of the list, the most produced material will be set to the bottom
     *
     * @param {Array} materials
     *
     * @returns {Array}
     */
    Stock.prototype.orderMaterialListByProductionBalance = function (materials) {
        if (Object.keys(this.productionBalance).length === 0) {
            return materials;
        }

        return materials.sort(
            (function (material1, material2) {
                const productionMaterial1 = this.productionBalance[material1.key]
                                                ? this.productionBalance[material1.key].produced
                                                : 0,
                      productionMaterial2 = this.productionBalance[material2.key]
                                                ? this.productionBalance[material2.key].produced
                                                : 0;

                return productionMaterial1 < productionMaterial2 ? -1 : 1;
            }).bind(this)
        );
    };

    /**
     * Update the displayed production/usage balance for each material
     * Update the total amount of produced items
     *
     * @private
     */
    Stock.prototype.updateProductionBalance = function () {
        this._updateMaterialFlowGraph();

        let productionInIteration = 0;

        $.each(this.state.getMaterials(), (function (material, materialData) {
            if (materialData.enabled === false) {
                return;
            }

            let iterationProduction  = 0,
                iterationConsumption = 0;

            if (this.productionBalanceIteration[material]) {
                iterationProduction  = this.productionBalanceIteration[material].produced;
                iterationConsumption = this.productionBalanceIteration[material].consumed;

                productionInIteration += iterationProduction;
            }

            if (!this.productionBalance[material]) {
                this.productionBalance[material] = {
                    produced: iterationProduction,
                    consumed: iterationConsumption,
                };

                return;
            }

            const materialProduction  = Math.floor((this.productionBalance[material].produced * 3 + iterationProduction) / 4),
                  materialConsumption = Math.floor((this.productionBalance[material].consumed * 3 + iterationConsumption) / 4),
                  materialBalance     = materialProduction - materialConsumption;

            this.productionBalance[material] = {
                produced: materialProduction,
                consumed: materialConsumption,
                balance:  materialBalance,
            };

            // cache the material balance to avoid DOM updates and expensive redraws if not necessary
            if (!this.productionBalanceCache[material] ||
                Math.sign(materialBalance) !== this.productionBalanceCache[material]
            ) {
                this.productionBalanceCache[material] = Math.sign(materialBalance);

                $('#beer-factory__stock__balance-' + material).html(
                    '<span class="' + this.numberFormatter.getBalanceClass(materialBalance) + '">' +
                        '<i class="fas ' + (materialBalance > 0 ? 'fa-arrow-up' : (materialBalance < 0 ? 'fa-arrow-down' : 'fa-arrow-right')) + '"></i>' +
                    '</span>'
                );
            }
        }).bind(this));

        this.averageProductionPerIteration = (this.averageProductionPerIteration === 0
                ? productionInIteration
                : (this.averageProductionPerIteration * 3 + productionInIteration) / 4
        );

        $('#beer-factory__average-production').text(this.numberFormatter.formatInt(this.averageProductionPerIteration));
    };

    Stock.prototype.resetProductionBalanceDOMCache = function () {
        this.productionBalanceCache = {};
    };

    Stock.prototype.resetProductionBalanceTracking = function () {
        this.productionBalanceIteration = {};
    };

    Stock.prototype._updateMaterialFlowGraph = function() {
        if (!this.materialFlowGraph.material) {
            return;
        }

        $.each([PRODUCTION_BALANCE__ADD, PRODUCTION_BALANCE__REMOVE], (function (index, method) {
            $.each(this.materialFlowGraph[method], (function (location, data) {
                if (this.materialFlowGraph.iterationCounter - data.lastUpdate > 20) {
                    delete this.materialFlowGraph[method][location];
                    return false;
                }

                this.materialFlowGraph[method][location].amount.push(
                    data.lastUpdate === this.materialFlowGraph.iterationCounter ? data.iteration : 0
                );

                this.materialFlowGraph[method][location].iteration = 0;
                this.materialFlowGraph[method][location].amount    =
                    this.materialFlowGraph[method][location].amount.slice(-20);
            }).bind(this));
        }).bind(this));

        this.materialFlowGraph.iterationCounter++;

        if (this.materialFlowGraph.iterationCounter % 5 !== 0) {
            return;
        }

        let   graphData       = [];
        const average         = array => array.reduce((a, b) => a + b, 0) / array.length,
              numberFormatter = this.numberFormatter,
              stockLabel      = translator.translate('beerFactory.stock');

        $.each(this.materialFlowGraph[PRODUCTION_BALANCE__ADD], function(location, data) {
            const amount = average(data.amount);

            if (amount > 0) {
                graphData.push([location, stockLabel, amount]);
            }
        });
        $.each(this.materialFlowGraph[PRODUCTION_BALANCE__REMOVE], function(location, data) {
            const amount = average(data.amount);

            if (amount > 0) {
                graphData.push([stockLabel, location, amount]);
            }
        });

        if (this.materialFlowGraph.chart) {
            this.materialFlowGraph.chart.series[0].setData(graphData);
            return;
        }

        this.materialFlowGraph.chart = Highcharts.chart('beer-factory__material-flow-graph', {
            title: {
                text: translator.translate('beerFactory.modal.materialFlow.distribution')
            },
            series: [{
                keys: ['from', 'to', 'weight'],
                data: graphData,
                type: 'sankey',
            }],
            credits: {
                enabled: false
            },
            colorByPoint: true,
            colors: ['#7cb5ec'],
            tooltip: {
                formatter: function() {
                    return this.point.isNode
                        ? this.point.id
                        : this.point.from + ' --> ' + this.point.to + ': ' + numberFormatter.formatInt(this.point.weight);
                }
            },
        });

        $('.beer-factory__material-flow__toggle').toggleClass('d-none');
    };

    Stock.prototype._initMaterialFlowGraph = function(material) {
        const modal = $('#beer-factory__material-flow-modal');

        modal.find('.modal-title').text(translator.translate(
            'beerFactory.modal.materialFlow.title',
            {
                __MATERIAL__: translator.translate('beerFactory.material.' + material)
            },
        ));

        this.materialFlowGraph.material = material;

        modal.modal('show');
        modal.on('hide.bs.modal.clearChart', (function () {
            if (this.materialFlowGraph.chart) {
                $('.beer-factory__material-flow__toggle').toggleClass('d-none');
                this.materialFlowGraph.chart.destroy();
            }

            this.materialFlowGraph = {
                material:         null,
                chart:            null,
                iterationCounter: 0,
                produced:         {},
                consumed:         {},
            };

            modal.off('hide.bs.modal.clearChart');
        }).bind(this));
    };

    beerFactoryGame.Stock = Stock;
})(BeerFactoryGame);

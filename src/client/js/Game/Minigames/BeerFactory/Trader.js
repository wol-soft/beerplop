(function(beerFactoryGame) {
    'use strict';

    const TRADABLE_MATERIALS = [
        'wood',
        'strongWood',
        'woodenBeam',
        'charcoal',
        'stone',
        'granite',
        'marble',
        'iron',
        'copper',
        'tools',
        'gold',
        'diamond',
        'medallion',
    ];

    const TRADE_VALUE = {
        wood:       2,
        strongWood: 6,
        woodenBeam: 6,
        charcoal:   10,
        stone:      3,
        granite:    6,
        marble:     100,
        iron:       5,
        copper:     15,
        tools:      70,
        gold:       25,
        diamond:    50,
        medallion:  300,
    };

    Trader.prototype.state = {
        routes: [],
        stats: {
            sold: {},
            purchased: {},
            total: {
                sold: 0,
                purchased: 0,
            },
        }
    };

    Trader.prototype.numberFormatter       = null;
    Trader.prototype.achievementController = null;
    Trader.prototype.gameEventBus          = null;

    Trader.prototype.beerFactoryState = null;

    Trader.prototype.initialState = null;

    Trader.prototype.overviewModalOpen = false;
    Trader.prototype.routeModalOpen    = null;

    function Trader(state, gameEventBus, numberFormatter, achievementController) {
        this.initialState = $.extend(true, {}, this.state);

        this.numberFormatter       = numberFormatter;
        this.achievementController = achievementController;
        this.gameEventBus          = gameEventBus;

        this.beerFactoryState = state;

        // set up the first trading route which is automatically unlocked
        if (this.state.routes.length === 0) {
            this.addRoute();
        }

        (new Beerplop.GamePersistor()).registerModule(
            'BeerFactory__Trader',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedState) {
                this.state = $.extend(true, {}, this.initialState, loadedState);
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.BEER_FACTORY.QUEUE.FINISHED, (function (event, id, action, item) {
            if (action === BUILD_QUEUE__BUILD && item === 'tradingPost') {
                this.recalculateAutoMaxDeals();
            }
        }).bind(this));

        // the Beer Factory speed may be increased so check if a current deal must be enlarged
        this.gameEventBus.on(EVENTS.BEER_FACTORY.UNIQUE_BUILD.UPDATED, () => this.recalculateAutoMaxDeals());
        this.gameEventBus.on(
            EVENTS.SAVE.LOAD.FINISHED,
            () => window.setTimeout(() => this.recalculateAutoMaxDeals(false), 0)
        );

        this.gameEventBus.on(EVENTS.CORE.ITERATION_LONG, (function () {
            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerFactory.traded,
                this.state.stats.total.purchased
            );
        }).bind(this));
    }

    /**
     * Add a new route to the trading system
     */
    Trader.prototype.addRoute = function () {
        this.state.routes.push({
            name:     chance.capitalize(chance.word({syllables: 3})),
            purchase: null,
            sell:     null,
            amount:   0,
            active:   true,
            autoMax:  true,
        });

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerFactory.tradingRoutes,
            this.state.routes.length
        );
    };

    Trader.prototype.getRoutes = function () {
        return this.state.routes;
    };

    /**
     * Initialize the event listener to open the trading route management modal
     */
    Trader.prototype.initTradingRouteEventListener = function () {
        $('#beer-factory__manage-trading-routes').on('click', this._renderTradingRouteOverviewModal.bind(this));
        $('#beer-factory__trading-route-statistics').on('click', this._renderTradingRouteStatisticsModal.bind(this));
    };

    Trader.prototype._renderTradingRouteStatisticsModal = function () {
        $('#beer-factory__trading-routes-statistics__sold-title').text(
            this.numberFormatter.formatInt(this.state.stats.total.sold)
        );
        $('#beer-factory__trading-routes-statistics__purchased-title').text(
            this.numberFormatter.formatInt(this.state.stats.total.purchased)
        );

        const mapMaterials = material => Object.entries(material).map(function (material) {
                const colorIndex = TRADABLE_MATERIALS.indexOf(material[0]);

                return {
                    name:       translator.translate('beerFactory.material.' + material[0]),
                    y:          material[1],
                    colorIndex: colorIndex,
                };
            });

        let charts = [];

        charts.push(
            this._renderTradingStatisticsGraph(
                'beer-factory__trading-routes-statistics__sold-graph',
                translator.translate(
                    'beerFactory.modal.tradingRoutesStats.sold',
                    {
                        __AMOUNT__: this.numberFormatter.formatInt(this.state.stats.total.sold)
                    }
                ),
                mapMaterials(this.state.stats.sold),
            )
        );

        charts.push(
            this._renderTradingStatisticsGraph(
                'beer-factory__trading-routes-statistics__purchased-graph',
                translator.translate(
                    'beerFactory.modal.tradingRoutesStats.purchased',
                    {
                        __AMOUNT__: this.numberFormatter.formatInt(this.state.stats.total.purchased)
                    }
                ),
                mapMaterials(this.state.stats.purchased),
            )
        );

        const modal = $('#beer-factory__trading-routes-statistics-modal');
        modal.modal('show');
        modal.off('hidden.bs.modal');
        modal.on('hidden.bs.modal', (function () {
            $.each(charts, (function (index, chart) {
                if (chart) {
                    charts[index] = chart.destroy();
                }
            }).bind(this));
        }).bind(this));
    };

    Trader.prototype._renderTradingStatisticsGraph = function(containerId, title, data) {
        const numberFormatter = this.numberFormatter;

        let colors = [],
            base   = Highcharts.getOptions().colors[0],
            i;

        for (i = 0; i <= TRADABLE_MATERIALS.length; i += 1) {
            colors.push(
                Highcharts
                    .Color(base)
                    .brighten((i - TRADABLE_MATERIALS.length * 0.75) / TRADABLE_MATERIALS.length)
                    .get()
            );
        }

        return Highcharts.chart(containerId, {
            chart: {
                type: 'pie'
            },
            title: {
                text: title
            },
            tooltip: {
                formatter: function () {
                    return `${this.point.name}:<br />${numberFormatter.formatInt(this.point.y)} (${numberFormatter.format(this.point.percentage)}%)`;
                },
            },
            plotOptions: {
                pie: {
                    colors: colors,
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b>: {point.percentage:.1f} %',
                        style: {
                            color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black'
                        }
                    }
                }
            },
            series: [{
                data: data,
            }]
        });
    };

    Trader.prototype._renderTradingRouteOverviewModal = function () {
        const modal = $('#beer-factory__trading-routes-modal');

        $('#beer-factory__trading-routes-modal__body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__trading-routes-modal__body-template'),
                {
                    routes: Object.entries(this.state.routes).map(
                        (function (route) {
                            return {
                                id:             route[0],
                                name:           route[1].name,
                                purchase:       translator.translate('beerFactory.material.' + route[1].purchase),
                                sell:           translator.translate('beerFactory.material.' + route[1].sell),
                                sellAmount:     this.numberFormatter.formatInt(route[1].amount),
                                purchaseAmount: this.numberFormatter.formatInt(
                                    this.getTradedAmount(route[1].sell, route[1].purchase, route[1].amount)
                                ),
                                empty:          route[1].sell === null,
                                active:         route[1].active,
                            };
                        }).bind(this)),
                }
            )
        );

        // apply the material design manually as it's dynamically generated content
        modal.find('.checkbox').bootstrapMaterialDesign();

        modal.modal('show');

        // make sure the event listener isn't attached multiple times
        modal.off('hide.bs.modal.trackOverviewModal');
        modal.on('hide.bs.modal.trackOverviewModal', (function () {
            this.overviewModalOpen = false;
            modal.off('hide.bs.modal.trackOverviewModal');
        }).bind(this));

        this._initRoutesManagementEventListener();
        this.overviewModalOpen = true;
    };

    Trader.prototype._initRoutesManagementEventListener = function () {
        const container = $('#beer-factory__trading-routes-modal__body');

        // enable/disable the trading of a trading route
        container.find('.beer-factory__trading-route__enable-switch').on ('change', (function (event) {
            this.state.routes[
                $(event.target).closest('.beer-factory__trading-route__container').data('routeId')
            ].active = $(event.target).is(':checked');
        }).bind(this));

        // open modal to manage a trading route
        container.find('.beer-factory__trading-route__manage').on('click', (function (event) {
            this._renderTradingRouteManagementModal(
                $(event.target).closest('.beer-factory__trading-route__container').data('routeId')
            );

            $('#beer-factory__trading-routes-modal').modal('hide');
        }).bind(this));

        new Beerplop.ObjectNaming(
            container.find('.beer-factory__trading-route__name'),
            (routeId, name) => this.state.routes[routeId].name = name,
            'beerFactory.trade.naming'
        );
    };

    Trader.prototype._renderTradingRouteManagementModal = function (routeId) {
        const modal = $('#beer-factory__trading-route-modal'),
              route = this.state.routes[routeId];

        $('#beer-factory__trading-route-modal__body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__trading-route-modal__body-template'),
                {
                    empty:     route.sell === null,
                    materials: TRADABLE_MATERIALS.map(
                        function (material) {
                            return {
                                key:   material,
                                label: translator.translate('beerFactory.material.' + material),
                            };
                        }),
                }
            )
        );

        modal.find('.modal-title').text(translator.translate(
            'beerFactory.modal.tradingRoute.title',
            {
                __ROUTE__: route.name
            }
        ));

        this._initRouteManagementEventListener(routeId);

        // show the current deal of the trading route
        if (route.sell && route.purchase) {
            // re enable the currently traded value via click simulation to hide the material on the opposite side
            $('input[name=beer-factory__trading-route__material-sell][data-material=' + route.sell + ']').trigger('click');
            $('input[name=beer-factory__trading-route__material-purchase][data-material=' + route.purchase + ']').trigger('click');

            const input = $('#beer-factory__trading-route__current-deal')
                .find('.beer-factory__trading-route__deal-amount');

            input.val(route.amount);
            input.trigger('change');
        }

        // apply the material design manually as it's dynamically generated content
        modal.find('.radio').bootstrapMaterialDesign();

        modal.modal('show');

        // make sure the event listener isn't attached multiple times
        modal.off('hide.bs.modal.openParent');
        modal.on('hide.bs.modal.openParent', (function () {
            this._renderTradingRouteOverviewModal();
            this.routeModalOpen = null;
            modal.off('hide.bs.modal.openParent');
        }).bind(this));

        setTimeout(function(){
            $('body').addClass('modal-open');
        },500);

        this.routeModalOpen = routeId;
    };

    Trader.prototype._initRouteManagementEventListener = function (routeId) {
        // A new material for the deal was selected
        $('.beer-factory__trading-route__material-select').on('change', (function (event) {
            const selectedElement  = $(event.target),
                  trade            = selectedElement.data('trade'),
                  material         = selectedElement.data('material'),
                  oppositeTrade    = (trade === 'sell' ? 'purchase' : 'sell'),
                  oppositeSelector = '.beer-factory__trading-route__material-select[name=beer-factory__trading-route__material-' + oppositeTrade + ']',
                  sell             = $('input[name=beer-factory__trading-route__material-sell]:checked').data('material'),
                  purchase         = $('input[name=beer-factory__trading-route__material-purchase]:checked').data('material');

            // make sure on the opposite site the selected material is not available to not deal same materials
            $(oppositeSelector).closest('.radio').removeClass('d-none');
            $(oppositeSelector + '[data-material=' + material + ']').closest('.radio').addClass('d-none');

            if (sell && purchase) {
                this._updateRouteManagementModalDeal(routeId, sell, purchase);
            }
        }).bind(this));

        // start a deal with the selected settings
        const startDealButton = $('#beer-factory__trading-route__start-deal');
        startDealButton.off('click');
        startDealButton.on('click', (function () {
            const route = this.state.routes[routeId];

            route.sell     = $('input[name=beer-factory__trading-route__material-sell]:checked').data('material');
            route.purchase = $('input[name=beer-factory__trading-route__material-purchase]:checked').data('material');
            route.amount   = parseInt($('.beer-factory__trading-route__deal-amount').val());

            if (!route.sell || !route.purchase) {
                route.sell     = null;
                route.purchase = null;
                route.amount   = 0;
            } else {
                // initialise the statistics for the materials
                if (!this.state.stats.sold[route.sell]) {
                    this.state.stats.sold[route.sell] = 0;
                }
                if (!this.state.stats.purchased[route.purchase]) {
                    this.state.stats.purchased[route.purchase] = 0;
                }
            }

            $('#beer-factory__trading-route-modal').modal('hide');

            if (route.amount > 0 && this.getTradedAmount(route.sell, route.purchase, route.amount) === 0) {
                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerFactory.trade.present
                );
            }
        }).bind(this));
    };

    Trader.prototype._updateRouteManagementModalDeal = function (routeId, sell, purchase) {
        const max       = this._getMaxTradableItems(sell),
              container = $('#beer-factory__trading-route__current-deal');

        container.html(
            Mustache.render(
                TemplateStorage.get('beer-factory__trading-route__deal'),
                {
                    max:            max,
                    sell:           translator.translate('beerFactory.material.' + sell),
                    purchase:       translator.translate('beerFactory.material.' + purchase),
                    sellAmount:     max,
                    purchaseAmount: this.getTradedAmount(sell, purchase, max),
                    autoMax:        this.state.routes[routeId].autoMax,
                }
            )
        );

        const autoMaxCheckbox = container.find('.beer-factory__trading-route__auto-max-switch');
        autoMaxCheckbox.bootstrapMaterialDesign();
        autoMaxCheckbox.on('change', (function (event) {
            this.state.routes[routeId].autoMax = $(event.target).is(':checked');
        }).bind(this));

        container.find('.beer-factory__trading-route__deal-amount').on('change', (function (event) {
            let amount = Math.floor($(event.target).val());

            // reset to the max tradable value if a too large trade was entered
            if (amount > max) {
                amount = max;
                $(event.target).val(amount);
            }
            // reset to 1 if a too small amount was entered
            if (amount < 1) {
                amount = 1;
                $(event.target).val(1);
            }

            container.find('.beer-factory__trading-route__sell-amount').text(amount);
            container.find('.beer-factory__trading-route__purchase-amount').text(
                this.getTradedAmount(sell, purchase, amount)
            );
        }).bind(this));

        $('#beer-factory__trading-route__deal-amount-max').on('click', function () {
            const inputElement = container.find('.beer-factory__trading-route__deal-amount');

            inputElement.val(max);
            inputElement.trigger('change');
        });
    };

    Trader.prototype.recalculateAutoMaxDeals = function (notify = true) {
        $.each(this.state.routes, (function (index, route) {
            const newAmount = this._getMaxTradableItems(route.sell);

            if (!route.autoMax && !(route.amount > newAmount)) {
                return;
            }

            if (!route.purchase || newAmount === route.amount) {
                return;
            }

            this.state.routes[index].amount = newAmount;

            if (notify) {
                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerFactory.trade.autoMax
                );

                (new Beerplop.Notification()).notify({
                    content: translator.translate(
                        'beerFactory.tradingRoute.amountUpdated',
                        {
                            __ROUTE__: `<i>${this.state.routes[index].name}</i>`,
                        }
                    ),
                    style: 'snackbar-info',
                    timeout: 5000,
                    channel: 'beerFactory',
                });
            }

            if (this.routeModalOpen === index) {
                this._renderTradingRouteManagementModal(this.routeModalOpen);
            }
        }).bind(this));

        if (this.overviewModalOpen) {
            this._renderTradingRouteOverviewModal();
        }
    };

    Trader.prototype.registerTrade = function (type, material, amount) {
        this.state.stats[type][material] += amount;
        this.state.stats.total[type]     += amount;
    };

    /**
     * Get the amount which is purchased by selling $sellAmount of $sell
     *
     * @param {string} sell       Material key for the sold good
     * @param {string} purchase   Material key for the purchased good
     * @param {int}    sellAmount The sold amount
     *
     * @returns {number}
     */
    Trader.prototype.getTradedAmount = function (sell, purchase, sellAmount) {
        return Math.floor((TRADE_VALUE[sell] * sellAmount) / TRADE_VALUE[purchase])
    };

    /**
     * Get the max amount which can be sold for the given material
     *
     * @param {string} sellMaterial Material key for the material which should be sold
     *
     * @returns {number}
     *
     * @private
     */
    Trader.prototype._getMaxTradableItems = function (sellMaterial) {
        const tradingPost   = this.beerFactoryState.getFactory('tradingPost'),
              tradableValue = 50
                * tradingPost.amount
                * Math.pow(2, tradingPost.upgrades.double)
                * this.beerFactoryState.getGameSpeed();

        return Math.ceil(tradableValue / TRADE_VALUE[sellMaterial]);
    };

    beerFactoryGame.Trader = Trader;
})(BeerFactoryGame);

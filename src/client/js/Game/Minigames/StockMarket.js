(function(minigames) {
    'use strict';

    const MAIN_CHART_DATA_POINTS         = 200;
    // Redraw the main chart after two hours to avoid highchart crashing the browser
    const REDRAW_MAIN_CHART_AFTER_POINTS = 7200;

    StockMarket.prototype._instance = null;

    StockMarket.prototype.gameState       = null;
    StockMarket.prototype.gameEventBus    = null;
    StockMarket.prototype.numberFormatter = null;

    StockMarket.prototype.enabled                   = false;
    StockMarket.prototype.overviewDiagramVisible    = false;
    StockMarket.prototype.overviewDiagramDataPoints = 0;

    StockMarket.prototype.mainStockChart              = null;
    StockMarket.prototype.mainStockChartSeriesMapping = {};
    StockMarket.prototype.updateHoldStockCharts       = {};
    StockMarket.prototype.updateStockCharts           = {};

    StockMarket.prototype.currentStockPurchase  = null;
    StockMarket.prototype.currentPurchaseMethod = null;

    StockMarket.prototype.autoClosePercentage = 0.12;
    StockMarket.prototype.investmentFee       = 0.025;
    StockMarket.prototype.stockMarketBuff     = 0;

    StockMarket.prototype.stocks = {
        hop: {
            volatility: 2,
            tendency: 0,
            value: 12500,
            minValue: 10000,
            maxValue: 15000,
            enabled: true,
            history: [],
            lever: [{value: 1}]
        },
        malt: {
            volatility: 2,
            tendency: 0,
            value: 12500,
            minValue: 9000,
            maxValue: 16000,
            enabled: true,
            history: [],
            lever: [{value: 1}]
        },
        beerglasses: {
            volatility: 3,
            tendency: 0,
            value: 12500,
            minValue: 8000,
            maxValue: 17000,
            enabled: false,
            history: [],
            lever: [{value: 1}]
        }
    };

    StockMarket.prototype.holds = {};
    StockMarket.prototype.stats = {
        totalHolds:    0,
        totalClosed:   0,
        totalPositive: 0,
        totalNegative: 0,
        systemClose:   0,
        balance:       0
    };

    StockMarket.prototype.holdHistory = [];

    /**
     * Initialize the stock market mini game
     *
     * @constructor
     */
    function StockMarket(gameState, gameEventBus) {
        if (StockMarket.prototype._instance) {
            return StockMarket.prototype._instance;
        }

        StockMarket.prototype._instance = this;

        this.gameState       = gameState;
        this.gameEventBus    = gameEventBus;
        this.numberFormatter = new Beerplop.NumberFormatter();

        this._initAchievementChecks();

        (new Beerplop.GamePersistor()).registerModule(
            'StockMarket',
            (function () {
                let stocks = {};

                $.each(this.stocks, function (stockKey, stockData) {
                    stocks[stockKey] = {
                        tendency: stockData.tendency,
                        value:    stockData.value
                    };
                });
                return {
                    stocks:              stocks,
                    holds:               this.holds,
                    autoClosePercentage: this.autoClosePercentage,
                    stats:               this.stats
                };
            }.bind(this)),
            (function (loadedData) {
                this.holds               = loadedData.holds;
                this.autoClosePercentage = loadedData.autoClosePercentage;
                this.stats               = $.extend(this.stats, loadedData.stats);

                $.each(loadedData.stocks, (function (stockKey, stockData) {
                    this.stocks[stockKey] = $.extend(this.stocks[stockKey], stockData);
                }).bind(this));
            }.bind(this))
        );

        this._initSacrifice();

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function () {
            this._iterate();
        }).bind(this));
    }

    StockMarket.prototype.getStats = function () {
        return this.stats;
    };

    StockMarket.prototype._initSacrifice = function () {
        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function () {
            $('#stock-market-control').addClass('d-none');

            this.enabled                = false;
            this.overviewDiagramVisible = false;

            this.mainStockChart              = null;
            this.mainStockChartSeriesMapping = {};
            this.updateHoldStockCharts       = {};
            this.updateStockCharts           = {};

            this.currentStockPurchase  = null;
            this.currentPurchaseMethod = null;

            this.autoClosePercentage = 0.12;
            this.investmentFee       = 0.025;
            this.stockMarketBuff     = 0;

            this.holds = {};

            this.stocks.beerglasses.enabled = false;
            $.each(this.stocks, function () {
                this.lever   = [{value: 1}];
                this.history = [];
            });

            this.holdHistory = [];
        }).bind(this));
    };

    /**
     * Unlock and initialize the stock market
     */
    StockMarket.prototype.unlockStockMarket = function () {
        this.enabled = true;

        $('#stock-market-control').removeClass('d-none');

        const element = $('#stock-market');
        element.on('shown.bs.collapse', (function () {
            this._renderOverviewHoldTable();
            this.drawMainStockMarketDiagram();

            this.overviewDiagramVisible    = true;
            this.overviewDiagramDataPoints = 0;
        }).bind(this));

        element.on('hidden.bs.collapse', (function () {
            this.overviewDiagramVisible = false;
        }).bind(this));

        (new Beerplop.OverlayController()).addCallback(
            'stock-market',
            (function () {
                this._renderStockMarket();
            }).bind(this)
        );

        const achievementController = new Beerplop.AchievementController();
        achievementController.checkAchievement(
            achievementController.getAchievementStorage().achievements.stockMarket.unlocked
        );

        // emulate a stock purchase so the updates will be available again after the game state was sacrificed
        if (this.stats.totalHolds > 0) {
            this.gameEventBus.emit(EVENTS.STOCK.PURCHASED, [this.stats.totalHolds, false]);
        }

        $('#stock-market__close-all').on('click', (function () {
            $.each(this.holds, (holdIndex, hold) => this._closeHold(hold.id, false, true));
            this._renderOverviewHoldTable();
        }).bind(this));
    };

    /**
     * Execute one stock market iteration
     *
     * @private
     */
    StockMarket.prototype._iterate = function () {
        const tablesToUpdate = $('#available-stocks-table, #hold-graph-accordion, #stock-market__purchase-table');
        $.each(this.stocks, (function iterateStock(stock, stockData) {
            if (!stockData.enabled) {
                return;
            }

            const scattering = stockData.maxValue - stockData.minValue;

            stockData.tendency += (Math.random() - 0.5 - (stockData.tendency * Math.random() * 2)) /
                ((Math.random() + 1) * 4);

            if (stockData.value > stockData.maxValue) {
                stockData.tendency -= 0.02;
            }
            if (stockData.value < stockData.minValue) {
                stockData.tendency += 0.02;
            }

            if (this.stockMarketBuff > 0) {
                stockData.tendency = this._calculateStockMarketBuff(stock, stockData.tendency);
            }

            stockData.value += (scattering / 100) * stockData.tendency * stockData.volatility;
            stockData.history.push(stockData.value);
            stockData.history = stockData.history.slice(-MAIN_CHART_DATA_POINTS);

            if (this.overviewDiagramVisible) {
                const serie = this.mainStockChartSeriesMapping[stock];

                this.mainStockChart.series[serie].addPoint(
                    stockData.value,
                    false,
                    this.mainStockChart.series[serie].data.length > MAIN_CHART_DATA_POINTS
                );
            }

            // TODO: analyze/optimize selector. Seems to be an expensive find.
            tablesToUpdate.find('.' + stock + '-value').text(this.numberFormatter.format(stockData.value));

            if (this.currentStockPurchase === stock) {
                $('#investment-close-value').text(
                    this.numberFormatter.format(
                        stockData.value *
                            (this.currentPurchaseMethod === 'long'
                                ? 1 - this.autoClosePercentage
                                : 1 + this.autoClosePercentage
                            )
                    )
                );

                let purchaseAmount = $('#stock-purchase-amount').val();
                this._setStockInvestment(
                    stockData.value * purchaseAmount * (1 + this.investmentFee)
                );

                $('#stock-market__purchase__traded-plops').text(
                    this.numberFormatter.format(
                        $('#stock-purchase-lever').val()
                            * stockData.value
                            * purchaseAmount
                    )
                );

                $('#stock-market__purchase__current-plops').text(
                    this.numberFormatter.format(this.gameState.getPlops())
                );
            }
        }).bind(this));

        if (this.overviewDiagramVisible) {
            // sum up the drawn points to redraw the diagram periodically to avoid browser crashes
            if (++this.overviewDiagramDataPoints > REDRAW_MAIN_CHART_AFTER_POINTS) {
                this.drawMainStockMarketDiagram();
            } else {
                this.mainStockChart.redraw();
            }
        }

        let holdSum = 0;

        $.each(this.holds, (function checkAutoClose(holdIndex, hold) {
            const holdBalance = hold.method === 'long'
                ? (this.stocks[hold.stock].value - hold.startValue) * hold.amount * hold.lever
                : (hold.startValue - this.stocks[hold.stock].value) * hold.amount * hold.lever;

            if ((hold.method === 'long' && this.stocks[hold.stock].value <= hold.startValueWithoutFee * (1 - this.autoClosePercentage)) ||
                (hold.method === 'short' && this.stocks[hold.stock].value >= hold.startValueWithoutFee * (1 + this.autoClosePercentage)) ||
                (holdBalance < -(hold.startValue * hold.amount))
            ) {
                this._closeHold(hold.id, true);
            }

            holdSum += holdBalance;
            this.writeBalance(
                $('#stock-market-overview-hold-table, #hold-graph-accordion').find('.stock-market-balance__' + hold.id),
                holdBalance
            );
        }).bind(this));

        this.writeBalance($('.stock-market-balance'), holdSum);

        $.each(this.updateHoldStockCharts, (function updateHoldChart(holdId, chart) {
            chart.series[0].addPoint(
                this.stocks[this.holds[holdId].stock].value,
                true,
                chart.series[0].data.length > MAIN_CHART_DATA_POINTS
            );
        }).bind(this));

        $.each(this.updateStockCharts, (function updateStockChart(stock, chart) {
            chart.series[0].addPoint(
                this.stocks[stock].value,
                true,
                chart.series[0].data.length > MAIN_CHART_DATA_POINTS
            );
        }).bind(this));
    };

    StockMarket.prototype.getStocks = function () {
        return this.stocks;
    };

    StockMarket.prototype.getStock = function (stock) {
        return this.stocks[stock];
    };

    StockMarket.prototype._calculateStockMarketBuff = function (stock, tendency) {
        let direction = 0;
        $.each(this.holds, function () {
            if (this.stock === stock) {
                direction += (this.method === 'long' ? 1 : -1);
            }
        });

        if (direction === 0) {
            return tendency;
        }

        return tendency + this.stockMarketBuff * (direction > 0 ? 1 : -1);
    };
    
    StockMarket.prototype.writeBalance = function (element, balance) {
        element.text(this.numberFormatter.format(balance));
        element.removeClass('balance-0 balance-positive balance-negative');
        element.addClass(this.numberFormatter.getBalanceClass(balance));
    };

    StockMarket.prototype.drawMainStockMarketDiagram = function () {
        let series = [],
            i      = 0;

        $.each(this.stocks, (function (stock, stockData) {
            if (!stockData.enabled) {
                return;
            }

            this.mainStockChartSeriesMapping[stock] = i++;
            series.push({
                name: translator.translate('stockMarket.' + stock),
                data: stockData.history
            });
        }).bind(this));

        this.mainStockChart = Highcharts.chart('stock-market-main-diagram', {
            title: {
                text: 'Stock market courses'
            },
            tooltip: {
                pointFormat: "{point.y:,.2f}"
            },
            credits: {
                enabled: false
            },
            series: series,
        });
    };

    StockMarket.prototype._renderStockChart = function (stock) {
        return Highcharts.chart('stock-graph-' + stock + '-container', {
            title: {
                text: translator.translate('stockMarket.' + stock) + ' course'
            },
            tooltip: {
                pointFormat: "{point.y:,.2f}"
            },
            credits: {
                enabled: false
            },
            series: [{
                name: translator.translate('stockMarket.' + stock),
                data: this.stocks[stock].history
            }]
        });
    };

    StockMarket.prototype._renderHoldStockChart = function (holdId) {
        const hold = this.holds[holdId];

        return Highcharts.chart('hold-graph-' + holdId + '-container', {
            title: {
                text: translator.translate('stockMarket.' + hold.stock) + ' course for investment #' + holdId
            },
            tooltip: {
                pointFormat: "{point.y:,.2f}"
            },
            credits: {
                enabled: false
            },
            series: [{
                name: translator.translate('stockMarket.' + hold.stock),
                data: this.stocks[hold.stock].history
            }],
            yAxis: {
                plotLines: [{
                    color: 'red',
                    width: 2,
                    value: hold.startValueWithoutFee *
                        (hold.method === 'long' ? 1 - this.autoClosePercentage : 1 + this.autoClosePercentage),
                    zIndex: 3,
                    label: {
                        text: translator.translate('stockMarket.graph.systemClose')
                    }
                },{
                    color: 'green',
                    width: 2,
                    value: hold.startValue,
                    zIndex: 3,
                    label: {
                        text: translator.translate('stockMarket.graph.breakEven')
                    }
                },{
                    color: 'blue',
                    width: 2,
                    value: hold.startValueWithoutFee,
                    zIndex: 3,
                    label: {
                        text: translator.translate('stockMarket.graph.start')
                    }
                }]
            }
        });
    };

    StockMarket.prototype._renderStockMarket = function () {
        let availableStocks = [];
        
        $.each(this.stocks, function (stock, stockData) {
            if (!stockData.enabled) {
                return;
            }

            availableStocks.push(
                $.extend(
                    {
                        key: stock,
                        name: translator.translate('stockMarket.' + stock)
                    },
                    stockData
                )
            );
        });

        $('#stock-market-overlay').html(
            Mustache.render(
                TemplateStorage.get('stock-market-overlay-template'),
                {
                    stocks: availableStocks
                }
            )
        );

        const renderStockPurchase = (function (stock, method) {
            const purchaseContainer = $('.purchase-container');

            $('.purchase-container__empty-state').addClass('d-none');
            purchaseContainer.html(
                Mustache.render(
                    TemplateStorage.get('stock-market-purchase-template'),
                    $.extend(
                        {
                            method:         method,
                            name:           translator.translate('stockMarket.' + stock),
                            description:    translator.translate(`stockMarket.${stock}.description`),
                            methodLabel:    translator.translate('stockMarket.' + method),
                            key:            stock,
                            lossPercentage: this.numberFormatter.format(this.autoClosePercentage * 100),
                            investmentFee:  this.numberFormatter.format(this.investmentFee * 100),
                            leverEnabled:   this.stocks[stock].lever.length > 1
                        },
                        this.stocks[stock]
                    )
                )
            );

            // apply the material design manually as it's dynamically generated content
            purchaseContainer.find('.checkbox').bootstrapMaterialDesign();

            this.currentPurchaseMethod = method;
            this.currentStockPurchase  = stock;

            this._enableStockPurchase();

            if ($('.stock-market-purchase-container').css('display') === 'none') {
                (new Beerplop.OverlayController()).openOverlay('stock-market-purchase-overlay');
            }
        }).bind(this);

        const availableStockTable = $('#available-stocks-table');

        availableStockTable.find('.stock-long').on('click', (function (event) {
            renderStockPurchase($(event.target).data('stock'), 'long');
            if ($(event.target).closest('tr').find('+ tr').find('.stock-graph-collapse').hasClass('show')) {
                event.stopPropagation();
            }
        }).bind(this));
        availableStockTable.find('.stock-short').on('click', (function (event) {
            renderStockPurchase($(event.target).data('stock'), 'short');
            if ($(event.target).closest('tr').find('+ tr').find('.stock-graph-collapse').hasClass('show')) {
                event.stopPropagation();
            }
        }).bind(this));

        $('#stock-market-tab__trade').on('click', function () {
            $('.stock-market-tab-container').addClass('d-none');
            $('#stock-market-list-container').removeClass('d-none');

            $('#stock-market-navigation').find('.active').removeClass('active');
            $('#stock-market-tab__trade').find('a').addClass('active');

            this.updateHoldStockCharts = {};
            $('#stock-market-hold-table').find('.hold-graph-collapse').removeClass('show');
        });

        $('#stock-market-tab__holds').on('click', (function () {
            $('.stock-market-tab-container').addClass('d-none');
            $('#stock-market-holds-container').removeClass('d-none');

            $('#stock-market-navigation').find('.active').removeClass('active');
            $('#stock-market-tab__holds').find('a').addClass('active');

            this._renderHoldTable();

            this.updateStockCharts = {};
            $('#available-stocks-table').find('.stock-graph-collapse').removeClass('show');
        }).bind(this));

        $('#stock-market-tab__history').on('click', (function () {
            $('.stock-market-tab-container').addClass('d-none');
            $('#stock-market-history-container').removeClass('d-none');

            $('#stock-market-navigation').find('.active').removeClass('active');
            $('#stock-market-tab__history').find('a').addClass('active');

            this.updateHoldStockCharts = {};
            this.updateStockCharts     = {};
            $('#available-stocks-table').find('.stock-graph-collapse').removeClass('show');
            $('#stock-market-hold-table').find('.hold-graph-collapse').removeClass('show');

            this._renderHoldHistoryTable();
        }).bind(this));

        availableStockTable.on('show.bs.collapse', (function (event) {
            const stock = $(event.target).data('stock');
            this.updateStockCharts[stock] = this._renderStockChart(stock);
        }).bind(this));
    };

    StockMarket.prototype._enableStockPurchase = function () {
        const amountInput  = $('#stock-purchase-amount');

        const maxInvestment = Math.ceil(
            (this._getMaxInvestment() * 0.9) /
            this.stocks[this.currentStockPurchase].value * (1 + this.investmentFee)
        );
        amountInput.attr('max', maxInvestment * 1.1);
        $('#stock-purchase-max-investment').text(this.numberFormatter.formatInt(maxInvestment));

        amountInput.on('change', (function (event) {
            this._setStockInvestment(
                this.stocks[this.currentStockPurchase].value * $(event.target).val() * (1 + this.investmentFee)
            );
        }).bind(this));

        $('#stock-purchase-all-in').on('click', (function () {
            const element = $('#stock-purchase-amount');
            element.val(
                Math.ceil(
                    (Math.min(this.gameState.getPlops(), this._getMaxInvestment()) * 0.9) /
                    this.stocks[this.currentStockPurchase].value * (1 + this.investmentFee)
                )
            );
            element.trigger('change');
        }).bind(this));

        const leverSelect = $('#stock-purchase-lever');
        leverSelect.on('change', (function (event) {
            $('#stock-market__purchase__traded-plops').text(
                this.numberFormatter.format(
                    $(event.target).val()
                        * this.stocks[this.currentStockPurchase].value
                        * $('#stock-purchase-amount').val()
                )
            );
        }).bind(this));

        leverSelect.val(
            this
                .stocks[this.currentStockPurchase]
                .lever[this.stocks[this.currentStockPurchase].lever.length - 1]
                .value
        );

        $('#stock-market-purchase').on('submit', (function (event) {
            event.preventDefault();

            let count = 0;
            $.each(this.holds, function () {
                count++;
            });

            if (count >= 10) {
                $('#stock-market__max-open-holds-reached-modal').modal('show');
                return;
            }

            const value      = this.stocks[this.currentStockPurchase].value,
                  amount     = Number($('#stock-purchase-amount').val()),
                  investment = value * amount * (1 + this.investmentFee);

            if (amount > 0 && investment < this._getMaxInvestment() && this.gameState.removePlops(investment)) {
                this.holds[++this.stats.totalHolds] = {
                    id:                   this.stats.totalHolds,
                    stock:                this.currentStockPurchase,
                    name:                 translator.translate('stockMarket.' + this.currentStockPurchase),
                    startValue:           this.currentPurchaseMethod === 'long'
                                            ? value * (1 + this.investmentFee)
                                            : value * (1 - this.investmentFee),
                    startValueWithoutFee: value,
                    amount:               amount,
                    method:               this.currentPurchaseMethod,
                    lever:                parseInt($('#stock-purchase-lever').val()) || 1
                };

                this.gameEventBus.emit(
                    EVENTS.STOCK.PURCHASED,
                    [this.stats.totalHolds, this.holds[this.stats.totalHolds]]
                );

                // reset the form if another hold shall be purchased. Else close the purchase view
                if ($('#stock-purchase__another').prop('checked')) {
                    amountInput.val(1);
                    amountInput.trigger('change');
                } else {
                    this._clearPurchaseView();
                }
                this._renderOverviewHoldTable();
            }
        }).bind(this));

        $('#cancel-purchase').on('click', (function () {
            this._clearPurchaseView();
        }).bind(this));
    };

    StockMarket.prototype._clearPurchaseView = function () {
        if ($('.purchase-overlay-close').css('display') === 'block') {
            (new Beerplop.OverlayController()).closeOverlay('stock-market-purchase-overlay');
        }

        $('.purchase-container').empty();
        $('.purchase-container__empty-state').removeClass('d-none');

        this.currentPurchaseMethod = null;
        this.currentStockPurchase  = null;
    };

    StockMarket.prototype._getMaxInvestment = function () {
        return this.gameState.getAutoPlopsPerSecondWithoutBuffMultiplier() * 10000;
    };

    StockMarket.prototype._renderOverviewHoldTable = function () {
        const element        = $('#stock-market-overview-hold'),
              closeAllButton = $('#stock-market__close-all');

        if (Object.values(this.holds).length === 0) {
            element.empty();
            closeAllButton.addClass('d-none');

            return;
        }

        element.html(
            Mustache.render(
                TemplateStorage.get('stock-market-overview-hold-template'),
                {
                    holds:   Object.values(this.holds),
                    ucfirst: function () {
                        return function (text, render) {
                            const renderedText = render(text);
                            return renderedText.charAt(0).toUpperCase() + renderedText.slice(1);
                        }
                    }
                }
            )
        );
        closeAllButton.removeClass('d-none');

        $('#stock-market-overview-hold-table').find('.close-stock').on('click', (function (event) {
            this._closeHold($(event.target).data('stockId'));
        }).bind(this));
    };

    StockMarket.prototype._renderHoldTable = function () {
        const container = $('#stock-market-holds-container');
        let   holds     = [];

        $.each(this.holds, (function (id, hold) {
            holds.push({
                id:         hold.id,
                key:        hold.stock,
                name:       translator.translate('stockMarket.' + hold.stock),
                lever:      hold.lever,
                method:     translator.translate('stockMarket.' + hold.method),
                amount:     this.numberFormatter.formatInt(hold.amount),
                investment: translator.translate(
                    'plopValue',
                    {
                        __PLOPS__: this.numberFormatter.format(hold.startValue * hold.amount)
                    }
                ),
                startValue: this.numberFormatter.format(hold.startValueWithoutFee),
                breakEven:  this.numberFormatter.format(hold.startValue)
            })
        }).bind(this));

        container.html(
            Mustache.render(
                TemplateStorage.get('stock-market-hold-template'),
                {
                    holds: holds
                }
            )
        );

        container.find('.close-stock').on('click', (function (event) {
            this._closeHold($(event.target).data('stockId'));
        }).bind(this));

        $('#hold-graph-accordion').on('show.bs.collapse', (function (event) {
            const holdId = $(event.target).data('holdId');
            this.updateHoldStockCharts[holdId] = this._renderHoldStockChart(holdId);
        }).bind(this));
    };

    StockMarket.prototype._renderHoldHistoryTable = function () {
        let holds        = [],
            totalBalance = 0;

        $.each(this.holdHistory.slice().reverse(), (function (id, hold) {
            holds.push({
                name:         translator.translate('stockMarket.' + hold.stock),
                method:       translator.translate('stockMarket.' + hold.method),
                amount:       this.numberFormatter.formatInt(hold.amount),
                investment:   translator.translate(
                    'plopValue',
                    {
                        __PLOPS__: this.numberFormatter.format(hold.startValueWithoutFee * hold.amount)
                    }
                ),
                balance:    `<span class='${this.numberFormatter.getBalanceClass(hold.balance)}'>${this.numberFormatter.format(hold.balance)}</span>`,
                startValue: this.numberFormatter.format(hold.startValue),
                endValue:   this.numberFormatter.format(hold.endValue),
                autoClose:  hold.autoClose,
                lever:      hold.lever
            });

            totalBalance += hold.balance;
        }).bind(this));

        $('#stock-market-history-container').html(
            Mustache.render(
                TemplateStorage.get('stock-market-hold-history-template'),
                {
                    holds:   holds,
                    balance: `<span class='${this.numberFormatter.getBalanceClass(totalBalance)}'>${this.numberFormatter.format(totalBalance)}</span>`,
                }
            )
        );

        $('#stock-market__clear-history').on('click', (function () {
            this.holdHistory = [];
            this._renderHoldHistoryTable();
        }).bind(this));
    };

    StockMarket.prototype._closeHold = function (holdId, autoClose = false, skipRender = false) {
        const hold        = this.holds[holdId],
              holdBalance = (hold.method === 'long'
                    ? (this.stocks[hold.stock].value - hold.startValue)
                    : (hold.startValue - this.stocks[hold.stock].value)
                ) * hold.amount * hold.lever,

              refund = hold.startValue * hold.amount + holdBalance;

        if (refund > 0) {
            this.gameState.addPlops(refund, holdBalance);
        }

        this.holdHistory.push(
            $.extend(
                {
                    autoClose: autoClose,
                    endValue:  this.stocks[hold.stock].value,
                    balance:   holdBalance
                },
                hold
            )
        );

        delete this.holds[holdId];
        delete this.updateHoldStockCharts[holdId];

        this.gameEventBus.emit(EVENTS.STOCK.CLOSED, holdBalance);

        if (!skipRender) {
            this._renderOverviewHoldTable();
            this._renderHoldTable();

            if (autoClose) {
                this._renderHoldHistoryTable();
            }
        }

        this.stats.totalClosed++;
        this.stats.balance += holdBalance;

        if (holdBalance >= 0) {
            this.stats.totalPositive++;
        } else {
            this.stats.totalNegative++;
        }

        if (autoClose) {
            this.stats.systemClose++;

            (new Beerplop.Notification()).notify({
                content: translator.translate('stockMarket.systemClose'),
                style: 'snackbar-error',
                timeout: 3000,
                channel: 'stockMarket',
            });
        }
    };

    StockMarket.prototype._initAchievementChecks = function () {
        const achievementController = new Beerplop.AchievementController();

        this.gameEventBus.on(EVENTS.STOCK.CLOSED, (function (event, balance) {
            if (balance > 0) {
                achievementController.checkAmountAchievement(
                    achievementController.getAchievementStorage().achievements.stockMarket.balance.positive,
                    balance
                );
            } else {
                achievementController.checkAmountAchievement(
                    achievementController.getAchievementStorage().achievements.stockMarket.balance.negative,
                    balance,
                    true
                );
            }

            let lastHistoryEntries = this.holdHistory.slice(-20).reverse(),
                direction          = lastHistoryEntries[0].balance > 0 ? 'positive' : 'negative',
                counter            = 0;

            $.each(lastHistoryEntries, function () {
                if (this.balance > 0 && direction === 'negative' || this.balance < 0 && direction === 'positive') {
                    return false;
                }

                counter++;
                const achievement = achievementController.getAchievementStorage()
                    .achievements.stockMarket.row[direction][counter];

                if (achievement) {
                    achievementController.checkAchievement(achievement);
                }
            });
        }).bind(this));

        this.gameEventBus.on(EVENTS.STOCK.PURCHASED, function (event, amount, hold) {
            achievementController.checkAmountAchievement(
                achievementController.getAchievementStorage().achievements.stockMarket.holds,
                amount
            );

            // skip hold achievement checks if no hold is provided
            if (!hold) {
                return;
            }

            achievementController.checkAmountAchievement(
                achievementController.getAchievementStorage().achievements.stockMarket.lever,
                hold.lever
            );

            achievementController.checkAmountAchievement(
                achievementController.getAchievementStorage().achievements.stockMarket.investment,
                hold.startValue * hold.amount
            );

            if (hold.method === 'long') {
                achievementController.checkAchievement(
                    achievementController.getAchievementStorage().achievements.stockMarket.method.long
                );
            } else {
                achievementController.checkAchievement(
                    achievementController.getAchievementStorage().achievements.stockMarket.method.short
                );
            }
        });
    };

    StockMarket.prototype._setStockInvestment = function (value) {
        const element = $('.stock-investment');
        element.text(this.numberFormatter.format(value));

        if (value > this.gameState.getPlops()) {
            element.addClass('missing-plops');
        } else {
            element.removeClass('missing-plops');
        }
    };

    StockMarket.prototype.enableStock = function (stock) {
        if (this.stocks.hop.history.length > 0) {
            this.stocks[stock].history[
                Math.max(...Object.keys(this.stocks.hop.history))
            ] = this.stocks[stock].value;

            this.stocks[stock].history.fill(this.stocks[stock].value);
        }
        this.stocks[stock].enabled = true;

        this.mainStockChartSeriesMapping[stock] =
            Math.max(...Object.values(this.mainStockChartSeriesMapping)) + 1;

        if (this.mainStockChart) {
            this.drawMainStockMarketDiagram();
        }
    };

    StockMarket.prototype.addAvailableLever = function (stock, lever) {
        this.stocks[stock].lever.push({value : lever});
    };

    StockMarket.prototype.addStockMarketBuff = function (stockMarketBuff) {
        this.stockMarketBuff += stockMarketBuff;
    };

    StockMarket.prototype.removeStockMarketBuff = function (stockMarketBuff) {
        this.stockMarketBuff -= stockMarketBuff;
    };

    StockMarket.prototype.lowerFee = function (amount) {
        this.investmentFee -= amount;
    };

    minigames.StockMarket = StockMarket;
})(Minigames);

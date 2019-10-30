(function(beerplop) {
    'use strict';

    StatisticsController.prototype.gameState = null;
    StatisticsController.prototype.buffController = null;

    /**
     * Initialize the plop main controller
     *
     * @constructor
     */
    function StatisticsController(gameState, buffController, levelController) {
        this.gameState       = gameState;
        this.buffController  = buffController;
        this.levelController = levelController;

        this._initStatisticsRendering();
    }

    StatisticsController.prototype._initStatisticsRendering = function () {
        (new Beerplop.OverlayController()).addCallback(
            'statistics',
            (function () {
                const numberFormatter = new Beerplop.NumberFormatter(),
                      researchProject = new Minigames.ResearchProject(),
                      beerBank        = new Minigames.BeerBank(),
                      stockMarket     = new Minigames.StockMarket(),
                      generalStats = [
                        {
                            label: translator.translate('stats.speed'),
                            value: this.gameState.getGameSpeed() + 'x'
                        },
                        {
                            label: translator.translate('stats.running'),
                            value: numberFormatter.formatTimeSpan((new Date()) - this.gameState.getStartTime())
                        },
                        {
                            label: translator.translate('stats.ownedPlops'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(this.gameState.getPlops()),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.pps'),
                            value: translator.translate(
                                'stats.ppsValue',
                                {
                                    __PLOPS__: numberFormatter.format(this.gameState.getAutoPlopsPerSecond(true)),
                                    __MULTIPLIER__: numberFormatter.format((this.gameState.getExternalAutoPlopsMultiplier() - 1) * 100),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.allTimePlops'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(this.gameState.getAllTimePlops()),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.periodPlops'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(this.gameState.getTotalPlops()),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.buildings'),
                            value: translator.translate(
                                'stats.buildingsValue',
                                {
                                    __AMOUNT__: numberFormatter.formatInt(this.gameState.getOwnedBuildingsAmount()),
                                    __TYPES__: this.gameState.getOwnedBuildingTypesAmount(),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.allTimeClicks'),
                            value: numberFormatter.formatInt(this.gameState.getAllTimeBeerClicks())
                        },
                        {
                            label: translator.translate('stats.clicks'),
                            value: numberFormatter.formatInt(this.gameState.getBeerClicks())
                        },
                        {
                            label: translator.translate('stats.manualPlops'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(this.gameState.getManualPlops()),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.plopsPerClick'),
                            value: numberFormatter.format(ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP).getValue())
                        },
                        {
                            label: translator.translate('stats.buffBottles'),
                            value: numberFormatter.formatInt(this.buffController.getClickedBuffBottles())
                        }
                    ],
                sacrificeStats = [
                        {
                            label: translator.translate('stats.lastSacrifice'),
                            value: translator.translate(
                                'stats.lastSacrificeValue',
                                {
                                    __TIME__: numberFormatter.formatTimeSpan((new Date()) - this.levelController.getAgeStartTime()),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.sacrificeAmount'),
                            value: numberFormatter.formatInt(this.levelController.getSacrified())
                        },
                        {
                            label: translator.translate('stats.beermats'),
                            value: numberFormatter.formatInt(this.levelController.getAvailableBeerMats())
                        },
                        {
                            label: translator.translate('stats.levelBonus'),
                            value: numberFormatter.format(this.levelController.getLevelBonus() * 100) + '%'
                        },
                        {
                            label: translator.translate('stats.lastSacrificeLevelBonus'),
                            value: numberFormatter.format(this.levelController.getLevelBonusLastPeriod() * 100) + '%'
                        },
                        {
                            label: translator.translate('stats.lastSacrificeLevel'),
                            value: numberFormatter.formatInt(this.levelController.getLevelLastPeriod())
                        },
                        {
                            label: translator.translate('stats.lastSacrificeAutoPlops'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(this.levelController.getAutoPlopsLastPeriod()),
                                }
                            )
                        },
                    ],
                researchProjectStats = [
                        {
                            label: translator.translate('stats.researchProjects'),
                            value: numberFormatter.formatInt(researchProject.getCompletedResearchProjectAmount())
                        },
                        {
                            label: translator.translate('stats.researchInvestment'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(researchProject.getTotalInvestedPlops()),
                                }
                            )
                        }
                    ],
                beerBankStats = [
                        {
                            label: translator.translate('stats.beerBankInvestment'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(beerBank.getInvestedPlops()),
                                }
                            )
                        },
                        {
                            label: translator.translate('stats.beerBankBoost'),
                            value: numberFormatter.formatFraction(beerBank.getAutoPlopBoost() * 100, 3) + '%'
                        }
                    ],
                stockMarketStats = [
                        {
                            label: translator.translate('stats.totalHolds'),
                            value: numberFormatter.formatInt(stockMarket.getStats().totalHolds)
                        },
                        {
                            label: translator.translate('stats.closedHolds'),
                            value: numberFormatter.formatInt(stockMarket.getStats().totalClosed)
                        },
                        {
                            label: translator.translate('stats.systemClosedHolds'),
                            value: numberFormatter.formatInt(stockMarket.getStats().systemClose)
                        },
                        {
                            label: translator.translate('stats.positiveHoldsPercentage'),
                            value: (stockMarket.getStats().totalPositive + stockMarket.getStats().totalNegative > 0)
                                        ? numberFormatter.format(
                                            stockMarket.getStats().totalPositive / (stockMarket.getStats().totalPositive + stockMarket.getStats().totalNegative) * 100
                                          ) + '%'
                                        : '-'
                        },
                        {
                            label: translator.translate('stats.positiveHolds'),
                            value: numberFormatter.formatInt(stockMarket.getStats().totalPositive)
                        },
                        {
                            label: translator.translate('stats.negativeHolds'),
                            value: numberFormatter.formatInt(stockMarket.getStats().totalNegative)
                        },
                        {
                            label: translator.translate('stats.holdsBalance'),
                            value: translator.translate(
                                'plopValue',
                                {
                                    __PLOPS__: numberFormatter.format(stockMarket.getStats().balance),
                                }
                            )
                        }
                    ];

                const researchProjectsEnabled = !$('#research-project-control').hasClass('d-none');
                const beerBankEnabled         = !$('#beer-bank-control').hasClass('d-none');

                $('#statistics-container').html(
                    Mustache.render(
                        TemplateStorage.get('statistics-template'),
                        {
                            generalStats:              generalStats,
                            showSacrificeStats:        this.levelController.getSacrified() > 0,
                            showAdditionalInvestments: researchProjectsEnabled || beerBankEnabled,
                            researchProjectsEnabled:   researchProjectsEnabled,
                            beerBankEnabled:           beerBankEnabled,
                            researchProjectStats:      researchProjectStats,
                            beerBankStats:             beerBankStats,
                            sacrificeStats:            sacrificeStats,
                            stockMarketStats:          stockMarketStats,
                            showStockMarketStats:      stockMarket.enabled || stockMarket.getStats().totalHolds > 0
                        }
                    )
                );
            }).bind(this),
            () => $('#statistics-container').html(''),
        );
    };

    beerplop.StatisticsController = StatisticsController;
})(Beerplop);

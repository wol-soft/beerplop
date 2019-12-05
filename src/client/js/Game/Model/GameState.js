(function(beerplop) {
    'use strict';

    GameState.prototype.numberFormatter         = null;
    GameState.prototype.buildingLevelController = null;
    GameState.prototype.achievementController   = null;
    GameState.prototype.gameEventBus            = null;
    GameState.prototype.upgradeController       = null;
    GameState.prototype.levelController         = null;
    GameState.prototype.slotController          = null;
    GameState.prototype.researchProject         = null;
    GameState.prototype.beerBank                = null;
    GameState.prototype.beerBlender             = null;
    GameState.prototype.beerCloner              = null;
    GameState.prototype.automatedBar            = null;
    GameState.prototype.beerwarts               = null;
    GameState.prototype.beerFactory             = null;
    GameState.prototype.flyoutText              = null;
    GameState.prototype.productionStatistics    = null;

    GameState.prototype.buyAmount        = 1;
    GameState.prototype.isOnMaxBuyAmount = false;

    GameState.prototype.buildingReductionFromBuffBottle = 0;

    GameState.prototype.coreIterations    = 0;
    GameState.prototype.coreIterationLock = 0;
    GameState.prototype.lastIteration     = null;

    GameState.prototype.clickInIteration = false;
    GameState.prototype.lastClick        = {
        at: null,
        lastDisplay: null,
        sumSinceLastDisplay: 0,
    };

    GameState.prototype.state = {
        gameSpeed: 1,
        startTime: new Date(),
        allTimePlops: 0,
        plops: 0,
        totalPlops: 0,
        manualClicksAllTime: 0,
        autoBuyerBuildings: 0,
        manualClicks: 0,
        manualPlops: 0,
        manualPurchase: false,
        autoPlopsPerSecond: 0,
        buffAutoPlopsMultiplier: 0,
        upgradeAutoPlopsMultiplier: 1,
        achievementMultiplier: 1,
        achievementUpgradeMultiplier: 1,
        manualClicksMultiplier: 0,
        buildingReduction: 0,
        buildingReductionFromHolyUpgrades: 0,
        buildingReductionFromResearchProject: 0,
        customBuyCharge: 50,
        interpolate: {
            percentage: 0.05,
            duration: 30 * 60
        },
        buildings: {
            opener: {
                amount: 0,
                baseCost: 10,
                basePPS: 0.1,
                costNext: 10,
                level: 1,
                tier: 1,
                production: 0,
                upgradeBoost: {
                    boost: 0,
                    getUpgradeBoost: null
                }
            },
            dispenser: {
                amount: 0,
                baseCost: 100,
                basePPS: 1,
                costNext: 100,
                level: 1,
                tier: 2,
                production: 0,
                upgradeBoost: {
                    boost: {},
                    getUpgradeBoost: null
                }
            },
            serviceAssistant: {
                amount: 0,
                baseCost: 1e3,
                basePPS: 5,
                costNext: 1e3,
                level: 1,
                tier: 3,
                production: 0,
                upgradeBoost: {
                    boost: 0,
                    getUpgradeBoost: null
                }
            },
            automatedBar: {
                amount: 0,
                baseCost: 1e4,
                basePPS: 20,
                costNext: 1e4,
                level: 1,
                tier: 4,
                production: 0,
                upgradeBoost: {
                    boost: 1,
                    getUpgradeBoost: null
                }
            },
            deliveryTruck: {
                amount: 0,
                baseCost: 1e5,
                basePPS: 75,
                costNext: 1e5,
                level: 1,
                tier: 5,
                production: 0,
                upgradeBoost: {
                    boost: 1,
                    getUpgradeBoost: null
                }
            },
            tankerTruck: {
                amount: 0,
                baseCost: 1e6,
                basePPS: 200,
                costNext: 1e6,
                level: 1,
                tier: 6,
                production: 0,
                upgradeBoost: {
                    boost: 1,
                    getUpgradeBoost: null
                }
            },
            beerPipeline: {
                amount: 0,
                baseCost: 1e7,
                basePPS: 700,
                costNext: 1e7,
                level: 1,
                tier: 7,
                production: 0,
                upgradeBoost: {
                    boost: 1,
                    getUpgradeBoost: null
                }
            },
            cellarBrewery: {
                amount: 0,
                baseCost: 1e8,
                basePPS: 2500,
                costNext: 1e8,
                level: 1,
                tier: 8,
                production: 0,
                upgradeBoost: {
                    boost: 1,
                    getUpgradeBoost: null
                }
            },
            automatedBrewery: {
                amount: 0,
                baseCost: 1e9,
                basePPS: 8000,
                costNext: 1e9,
                level: 1,
                tier: 9,
                production: 0,
                upgradeBoost: {
                    boost: 1,
                    getUpgradeBoost: null
                }
            },
            pharmaceuticalBeer: {
                amount: 0,
                baseCost: 1e10,
                basePPS: 28000,
                costNext: 1e10,
                level: 1,
                tier: 10,
                production: 0
            },
            drinkingWaterLine: {
                amount: 0,
                baseCost: 1e11,
                basePPS: 1e5,
                costNext: 1e11,
                level: 1,
                tier: 11,
                production: 0
            },
            beerTeleporter: {
                amount: 0,
                baseCost: 1e12,
                basePPS: 35e4,
                costNext: 1e12,
                level: 1,
                tier: 12,
                production: 0
            },
            beerCloner: {
                amount: 0,
                baseCost: 1e13,
                basePPS: 12e5,
                costNext: 1e13,
                level: 1,
                tier: 13,
                production: 0
            },
        }
    };

    GameState.prototype.cache = {
        totalAutoPlopsPerSecond: 0,
        buildingProduction: {},
        maxBuildingsCost: {},
        maxBuildingsAvailable: {},
    };

    GameState.prototype._instance    = null;
    GameState.prototype.initialState = null;

    // a semaphore to track which building is currently bought by an auto buyer
    GameState.prototype.autoBuySemaphore = null;
    // block recalculations during loading a save state to increase performance.
    // Instead recalculate after the save state was applied
    GameState.prototype.updateSemaphore  = false;

    GameState.prototype.upgradeMultiplierChannel = {};

    // store callback functions per building to add specific information to the building popover
    GameState.prototype.popoverCallbacks = {};
    // track the currently opened building popover
    GameState.prototype.activeBuildingPopover = null;
    // track the currently opened building details modal
    GameState.prototype.activeBuildingDetailsModal = null;

    /**
     * Initialize the game state
     * @constructor
     */
    function GameState (gameEventBus, beerBlender) {
        if (GameState.prototype._instance) {
            return GameState.prototype._instance;
        }

        this.gameEventBus = gameEventBus;
        this.beerBlender  = beerBlender;

        this.initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'GameState',
            (function getGameStateData() {
                return this._minifyState();
            }.bind(this)),
            (function setGameStateData(loadedData) {
                // TODO: remove code, prevent easy achievement reaching by sacrificing after updating to latest version
                // (1.62.0)
                if (typeof loadedData.manualPurchase === 'undefined') {
                    loadedData.manualPurchase = true;
                }

                this.state = $.extend(true, {}, this.initialState, loadedData);

                this._initUpgradeBoosts();
                this._initPopoverCallbacks();
                this._updateCustomBuyAmountButton();

                $('#current-plops').text(this.numberFormatter.format(this.state.plops));
                $('#total-plops').text(this.numberFormatter.format(this.state.totalPlops));
            }.bind(this))
        );

        this.numberFormatter         = new Beerplop.NumberFormatter();
        this.flyoutText              = new Beerplop.FlyoutText();
        this.productionStatistics    = new Beerplop.ProductionStatistics(
            new Beerplop.IndexedDB(this, this.gameEventBus),
            this.gameEventBus,
        );
        this.buildingLevelController = new Beerplop.BuildingLevelController(
            this,
            this.gameEventBus,
            this.productionStatistics,
        );

        this._initBuyBuildings();
        this._initBuyAmountControl();
        this._initUpgradeBoosts();
        this._initPopoverCallbacks();
        this._initSacrifice();

        $('#beer').find('svg').on('click', (function manualBeerClick(event) {
            event.preventDefault();

            const now = new Date();
            // allow only one click each 10ms to limit autoclicker
            if (this.lastClick.at && now - this.lastClick.at < 10 && !TESTMODE) {
                return;
            }

            this.clickInIteration = true;
            this.lastClick.at     = now;

            const manuallyPlopped = ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP).getValue();

            this.addPlops(manuallyPlopped, manuallyPlopped, false);
            this.state.manualClicks++;
            this.state.manualClicksAllTime++;
            this.state.manualPlops += manuallyPlopped;

            if (!isFinite(this.state.manualPlops)) {
                this.state.manualPlops = Number.MAX_VALUE;
            }

            // spawn manual plop labels only each 50ms
            if (this.lastClick.lastDisplay && now - this.lastClick.lastDisplay < 50 && !TESTMODE) {
                this.lastClick.sumSinceLastDisplay += manuallyPlopped;
                return;
            }

            this.lastClick.lastDisplay         = now;
            this.lastClick.sumSinceLastDisplay = 0;

            $('#manual-plops').text(this.numberFormatter.format(this.state.manualPlops));
            this.flyoutText.spawnFlyoutText(
                '+ ' + this.numberFormatter.format(manuallyPlopped + this.lastClick.sumSinceLastDisplay) + ' Plops',
                event.clientX,
                event.clientY - 25,
                'manual-plop',
                'manual-plop-top',
                1000,
                1500
            );

            this.gameEventBus.emit(EVENTS.CORE.CLICK, [this.state.manualClicksAllTime, this.state.manualPlops]);
        }).bind(this));

        window.setInterval(
            (function initCoreIteration() {
                if (this.coreIterationLock > 0) {
                    return;
                }

                this.iterate();

                // Check if the game was stopped and restarted now (mainly mobile devices).
                // In this case interpolate the generated plops
                if (this.lastIteration !== null) {
                    let interpolateDuration = Math.floor((new Date() - this.lastIteration) / 1000);
                    if (interpolateDuration > 60) {
                        this._interpolateGameBreakPlops(interpolateDuration);
                    }
                }

                this.lastIteration = new Date();
            }).bind(this),
            1000
        );

        this.gameEventBus.on(EVENTS.CORE.ACHIEVEMENT_REACHED, (function addAchievementMultiplierToGameState() {
            this.state.achievementMultiplier += 0.01;
            this.updatePlopsPerSecond();
        }).bind(this));

        this.gameEventBus.on(EVENTS.SAVE.LOAD.STARTED, () => this.updateSemaphore = true);

        this.gameEventBus.on(
            EVENTS.SAVE.LOAD.FINISHED,
            (function updatePlopsPerSecond(event, interpolateGameBreakSeconds) {
                this.updateSemaphore = false;

                this._updateUI();
                this._interpolateGameBreakPlops(interpolateGameBreakSeconds);
            }).bind(this)
        );

        this.gameEventBus.on(EVENTS.BEER_FACTORY.UNIQUE_BUILD.UPDATED, (function () {
            this._recalculateAllCostNext();
            this.updatePlopsPerSecond();
        }).bind(this));

        this.gameEventBus.on(EVENTS.BEER_BLENDER.UPDATE, (function () {
            this._recalculateAllCostNext();
            this.updatePlopsPerSecond();
        }).bind(this));

        this.gameEventBus.on(EVENTS.BEER_FACTORY.AUTO_BUYER, (function (event, context) {
            if (!context.enabled || context.building === 'bottleCapFactory') {
                return;
            }

            // _updateMaxAvailableBuildings triggers the auto buyer check
            (context.building === 'global' ? this.getBuildings() : [context.building]).forEach(
                building => this._updateMaxAvailableBuildings(building)
            );
        }).bind(this));

        $('#select-speed').on('click', (function () {
            this.state.gameSpeed = $('input[name=gameSpeed]:checked').data('speed');
            $('#select-game-speed-overlay').addClass('d-none');
            (new Beerplop.GamePersistor()).setSaveSemaphore(false);

        }).bind(this));

        ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP)
            .addModifier('AutoPlopPartial',       () => 1 + this.getAutoPlopsPerSecond() * 0.2, false)
            .addModifier('ManualClickMultiplier', () => this.state.manualClicksMultiplier || 1);

        GameState.prototype._instance = this;
    }

    GameState.prototype._initSacrifice = function () {
        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function handleSacrificeForGameState() {
            if (this.getBeerClicks() === 0) {
                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.special.noClick
                );

                if (!this.state.manualPurchase) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.special.automation
                    );
                }
            }

            // reset the state except the all time plops
            const clicks             = this.getAllTimeBeerClicks(),
                  plops              = this.getAllTimePlops(),
                  achievementBoost   = this.state.achievementMultiplier,
                  startTime          = this.state.startTime,
                  autoBuyerBuildings = this.state.autoBuyerBuildings,
                  gameSpeed          = this.state.gameSpeed;

            this.resetInitialState();
            this.state.allTimePlops          = plops;
            this.state.manualClicksAllTime   = clicks;
            this.state.achievementMultiplier = achievementBoost;
            this.state.startTime             = startTime;
            this.state.gameSpeed             = gameSpeed;
            this.state.autoBuyerBuildings    = autoBuyerBuildings;

            this.cache.maxBuildingsAvailable = {};
            this.cache.maxBuildingsCost      = {};

            this._initPopoverCallbacks();
            this._updateUI();
        }).bind(this));
    };

    GameState.prototype.resetInitialState = function () {
        this.state          = $.extend(true, {}, this.initialState);
        this.coreIterations = 0;

        this.buildingLevelController.resetInitialState();
        this._initUpgradeBoosts();
        this._updateUI();
    };

    GameState.prototype._updateUI = function () {
        this.recalculateAutoPlopsPerSecond();
        this._recalculateAllCostNext();
        this._updateBuyButtons();

        $.each(this.state.buildings, (function updateBuildingUI(building, buildingData) {
            $('.amount-' + building).text(this.numberFormatter.formatInt(buildingData.amount));
            $('#cost-next-' + building).text(this.numberFormatter.format(buildingData.costNext));
        }).bind(this));

        $('#manual-plops').text(this.numberFormatter.format(this.state.manualPlops));
    };

    GameState.prototype._minifyState = function () {
        let data = $.extend(true, {}, this.state);

        // TODO: don't save in the state struct
        // remove buffs from the save state
        delete data.buffAutoPlopsMultiplier;
        delete data.manualClicksMultiplier;
        delete data.upgradeAutoPlopsMultiplier;
        delete data.achievementUpgradeMultiplier;
        delete data.buildingReduction;
        delete data.buildingReductionFromHolyUpgrades;
        delete data.buildingReductionFromResearchProject;
        delete data.interpolate;

        $.each(data.buildings, function collectBuildingDataForSaveState(building) {
            delete data.buildings[building].tier;
            delete data.buildings[building].baseCost;
            delete data.buildings[building].basePPS;
            delete data.buildings[building].upgradeBoost;
            delete data.buildings[building].costNext;
        });

        return data;
    };

    /**
     * Execute a core iteration
     *
     * @return {number}
     */
    GameState.prototype.iterate = function () {
        this.coreIterations++;
        const isCoreIterationLong = this.coreIterations % 60 === 0;

        this.cache.totalAutoPlopsPerSecond = Math.min(
            this.state.autoPlopsPerSecond * this.getExternalAutoPlopsMultiplier(),
            Number.MAX_VALUE,
        );

        const autoPlopsPerSecond = this.getAutoPlopsPerSecond(),
              addedPlops         = autoPlopsPerSecond *
                  ((100 - this.researchProject.getResearchPercentage() - this.beerBank.getInvestmentPercentage()) / 100);

        this.addPlops(addedPlops, autoPlopsPerSecond);

        if (addedPlops <= 0 && this.clickInIteration) {
            this.updatePlops(this.state.plops);
        }
        this.clickInIteration = false;

        this.gameEventBus.emit(EVENTS.CORE.ITERATION);
        if (isCoreIterationLong) {
            this.gameEventBus.emit(EVENTS.CORE.ITERATION_LONG);
        }

        // add the overall production for each building
        $.each(this.state.buildings, (function updateTotalProductionPerBuilding(building, data) {
            const production = this.getBuildingProduction(building, data, false);

            this.state.buildings[building].production += production;

            if (this.activeBuildingPopover === building || this.activeBuildingDetailsModal === building) {
                $('#total-production-' + building).text(
                    this.numberFormatter.format(this.state.buildings[building].production)
                );

                $('#production-percentage-' + building).text(
                    this.numberFormatter.format(production > 0 ? production / this.getAutoPlopsPerSecond() * 100 : 0)
                );

                $('#production-each-' + building).text(this.numberFormatter.format(production / data.amount || 0));
                $('#production-iteration-' + building).text(this.numberFormatter.format(production));
                $('#beer-cloner-boost__' + building).text(this.beerCloner.getPercentageDetails(building));
            }

            // take a statistics snapshot for the building
            if (isCoreIterationLong) {
                this.productionStatistics.statisticsSnapshot(
                    building,
                    production,
                    this.state.buildings[building].production,
                    this.state.buildings[building].amount
                );
            }
        }).bind(this));

        // take a statistics snapshot of the total state
        if (isCoreIterationLong) {
            this.productionStatistics.statisticsSnapshot(
                'total',
                autoPlopsPerSecond,
                this.getTotalPlops(),
                this.getOwnedBuildingsAmount()
            );
        }

        return this.state.plops;
    };

    GameState.prototype.setActiveBuildingPopover = function (buildingKey) {
        this.activeBuildingPopover = buildingKey;
    };

    GameState.prototype.setActiveBuildingDetailsModal = function (buildingKey) {
        this.activeBuildingDetailsModal = buildingKey;
    };

    GameState.prototype._initUpgradeBoosts = function () {
        // openers are boosted for each 100 buildings owned
        this.state.buildings.opener.upgradeBoost.getUpgradeBoost = (function calculateOpenerBoost(opener) {
            return (opener.basePPS +
                (opener.upgradeBoost.boost * Math.floor((this.getOwnedBuildingsAmount() - this.state.buildings.opener.amount) / 100))
            );
        }).bind(this);

        // Dispensers get boosted by the amount of other buildings
        this.state.buildings.dispenser.upgradeBoost.getUpgradeBoost = (function calculateDispenserBoost(dispenser) {
            let boostMultiplier = 1;

            $.each(dispenser.upgradeBoost.boost, (function (building, percentage) {
                boostMultiplier += percentage * this.getBuildingData(building).amount;
            }).bind(this));

            return dispenser.basePPS * boostMultiplier * this.automatedBar.getDispenserBoost();
        }).bind(this);

        // service assistants are boosted by an enlarged base PPS
        this.state.buildings.serviceAssistant.upgradeBoost.getUpgradeBoost = (function calculateServiceAssistantBoost(serviceAssistant) {
            return serviceAssistant.basePPS + serviceAssistant.upgradeBoost.boost;
        }).bind(this);

        $.each(
            ['automatedBar', 'deliveryTruck', 'tankerTruck', 'beerPipeline', 'cellarBrewery', 'automatedBrewery'],
            (function (index, building) {
                this.state.buildings[building].upgradeBoost.getUpgradeBoost =
                    (function calculateDefaultBoost(buildingData) {
                        return buildingData.basePPS * buildingData.upgradeBoost.boost;
                    }).bind(this)
            }).bind(this)
        );
    };

    GameState.prototype._initBuyBuildings = function () {
        const gameState = this;

        $.each($('#buildings-container').find('.label-cost'), function () {
            $(this).text(
                gameState.numberFormatter.format(
                    gameState.state.buildings[$(this).attr('id').substr(10)].costNext
                )
            );
        });

        $.each($('.buy'), function initBuyBuildingButtonEventListener() {
            let button   = $(this),
                building = button.data('building');

            button.on('click', function buyBuildingButtonClick() {
                let amount, plops;

                if (gameState.isOnMaxBuyAmount) {
                    amount = gameState.cache.maxBuildingsAvailable[building];
                    plops  = gameState.cache.maxBuildingsCost[building][amount];
                } else {
                    amount = gameState.buyAmount;
                    plops  = gameState.state.buildings[building].costNext;
                }

                if (gameState.removePlops(plops)) {
                    gameState.addBuildings(building, amount, true);
                }
            });
        });
    };

    /**
     * Initialize the selection for the amount of buildings to buy in a single step
     *
     * @private
     */
    GameState.prototype._initBuyAmountControl = function () {
        const gameState = this;

        $('#buy-amount-custom__configure').on('click', (function showCustomBuyAmountConfigureModal() {
            $('#buy-amount-configure').val(this.state.customBuyCharge);
            $('#buy-amount-configure-modal').modal('show');
        }).bind(this));

        assetPromises['modals'].then(() => {
            $('#form-buy-amount-configure').on('submit', (function (event) {
                $('#buy-amount-configure-modal').modal('hide');
                event.preventDefault();

                this.state.customBuyCharge = Math.floor($('#buy-amount-configure').val());
                this._updateCustomBuyAmountButton();

                this.buyAmount = this.state.customBuyCharge;

                if ($('#buy-amount-custom').hasClass('active')) {
                    gameState._recalculateAllCostNext();
                    gameState.gameEventBus.emit(EVENTS.CORE.BUY_AMOUNT_UPDATED, this.state.customBuyCharge);
                }

                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.special.config
                );

                if ($.inArray(this.state.customBuyCharge, [1, 10, 100]) !== -1) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.special.doubleConfig
                    );
                }

                if (this.state.customBuyCharge === 443) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.special[443]
                    );
                }
            }).bind(this));
        });

        $('.buy-amount:not(.buy-amount__configure)').on('click', function switchBuyChargeButtonClick() {
            const amountSelection = $(this);

            if (amountSelection.hasClass('active')) {
                return;
            }

            $('.buy-amount.active').removeClass('active');
            amountSelection.addClass('active');
            gameState.buyAmount = amountSelection.data('amount');

            gameState._recalculateAllCostNext();
            gameState.gameEventBus.emit(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameState.buyAmount);
        });

        $('#buy-control__advanced-control-toggle').on('click', function () {
            $('#buy-control__advanced-control-toggle').find('i').toggleClass('fa-angle-double-down fa-angle-double-up');
        })
    };

    GameState.prototype._updateCustomBuyAmountButton = function () {
        const customBuyAmountButton = $('#buy-amount-custom');

        customBuyAmountButton.data('amount', this.state.customBuyCharge);
        customBuyAmountButton.text(this.numberFormatter.formatInt(this.state.customBuyCharge));
    };
    /**
     * Initialize popover callback functions to display additional hints in building popovers
     *
     * @private
     */
    GameState.prototype._initPopoverCallbacks = function () {
        $.each(this.state.buildings, (function (building) {
            this.popoverCallbacks[building] = [];

            this.popoverCallbacks[building].push(
                (function () {
                    if (this.state.buildings[building].tier + (new Minigames.ResearchProject()).getStage('stargazer') > this.getBuildings().length) {
                        return translator.translate('building.popover.stargazer');
                    }

                    return false;
                }).bind(this)
            );

            this.popoverCallbacks[building].push(
                (function () {
                    if (this.beerCloner.isBuildingCloned(building)) {
                        let clonings          = this.beerCloner.state.cloning[building].length,
                            percentageDetails = `<span id="beer-cloner-boost__${building}">${this.beerCloner.getPercentageDetails(building)}</span>`;

                        if (this.researchProject.getStage('clonedike')) {
                            const clonedikeBoost = translator.translate(
                                'beerCloner.cloning.clonedike',
                                {
                                    __MULTIPLIER__: this.numberFormatter.formatInt(
                                        (Math.pow(1.1, this.researchProject.getStage('clonedike')) - 1) * 100
                                    ),
                                }
                            );

                            percentageDetails = `${percentageDetails}, ${clonedikeBoost}`;
                        }

                        return translator.translate(
                            'beerCloner.cloning.buildingBoost',
                            {
                                __AMOUNT__:     clonings,
                                __MULTIPLIER__: percentageDetails,
                            },
                            '',
                            clonings
                        );
                    }

                    return false;
                }).bind(this)
            );
        }).bind(this));

        this.popoverCallbacks['opener'].push(
            (function getOpenerPopoverAdditionalInformation() {
                if (!this.upgradeController.getUpgradeStorage().upgrades.buildingUpgrades.doubleBottle.reached) {
                    return false;
                }

                return translator.translate(
                    'building.popover.doubleBuff',
                    {
                        __OPENER_AMOUNT__: this.numberFormatter.formatInt(this.state.buildings.opener.amount),
                        __PERCENTAGE__:    Math.floor(this.state.buildings.opener.amount / 100),
                    }
                );
            }).bind(this)
        );

        this.popoverCallbacks['dispenser'].push(
            (function getDispenserPopoverAdditionalInformation() {
                if (!this.upgradeController.getUpgradeStorage().upgrades.buildingUpgrades.autoClick.reached) {
                    return false;
                }

                return translator.translate(
                    'building.popover.autoClick',
                    {
                        __DISPENSER_AMOUNT__: this.numberFormatter.formatInt(this.state.buildings.dispenser.amount),
                        __PERCENTAGE__:       Math.floor(this.state.buildings.dispenser.amount / 100),
                    }
                );
            }).bind(this)
        );

        this.popoverCallbacks['dispenser'].push(
            (function getDispenserPopoverAdditionalInformationAutomatedBarBoost() {
                if (this.automatedBar.getDispenserBoost() === 1) {
                    return false;
                }

                return translator.translate(
                    'building.popover.automatedBarDispenser',
                    {
                        __PERCENTAGE__: this.numberFormatter.formatInt((this.automatedBar.getDispenserBoost() - 1) * 100),
                    }
                );
            }).bind(this)
        );

        this.popoverCallbacks['serviceAssistant'].push(
            (function getServiceAssistantPopoverAdditionalInformation() {
                if (!this.upgradeController.getUpgradeStorage().upgrades.buildingUpgrades.serviceHelper.reached) {
                    return false;
                }

                return translator.translate(
                    'building.popover.buildingDiscount',
                    {
                        __ASSISTANT_AMOUNT__: this.numberFormatter.formatInt(this.state.buildings.serviceAssistant.amount),
                        __PERCENTAGE__:       this.numberFormatter.format(
                            this.getServiceAssistantBuildingReduction(this.state.buildings.serviceAssistant.amount) * 100
                        ),
                    }
                );
            }).bind(this)
        );
    };

    /**
     * Get all additional popover information for the given building
     *
     * @param {string} building
     *
     * @returns {string}
     */
    GameState.prototype.resolvePopoverCallback = function (building) {
        let popoverHints = [];

        $.each(this.popoverCallbacks[building], function () {
            popoverHints.push(this());
        });

        return popoverHints.filter(Boolean).join('<br /><br />');
    };

    /**
     * Recalculate and update the view for the costs of the next building instance
     *
     * @private
     */
    GameState.prototype._recalculateAllCostNext = function () {
        if (this.updateSemaphore) {
            return;
        }

        let forceMaxAvailableUpdate = false,
            toggleCostsLabel        = false;

        // the recalculation was triggered by a buy amount charge switch. So check, if a switch between MAX and a
        // constant number happened and update everything accordingly to the change
        if (this.buyAmount === 'max' ? !this.isOnMaxBuyAmount : this.isOnMaxBuyAmount) {
            this.isOnMaxBuyAmount = !this.isOnMaxBuyAmount;
            toggleCostsLabel      = true;

            if (this.isOnMaxBuyAmount) {
                forceMaxAvailableUpdate = true;
            }
        }

        // reset cache to force recalculation of the available buildings amount
        this.cache.maxBuildingsCost = {};

        $.each(this.state.buildings, (function recalculateCostForBuilding(building) {
            // always keep track of the max available cache for auto buyer
            this._updateMaxAvailableBuildings(building, forceMaxAvailableUpdate);

            if (!this.isOnMaxBuyAmount) {
                this.calculateCostNext(building);
            }
        }).bind(this));

        this._updateBuyButtons();
        // switch between the costs label and the available buildings label
        if (toggleCostsLabel) {
            $('.building-container__costs-label').toggleClass('d-none');
        }
    };

    GameState.prototype._updateMaxAvailableBuildings = function (building, forceMaxAvailableUpdate = false) {
        // if an update is triggered by an auto buyer skip to avoid an recursive loop
        if (this.autoBuySemaphore === building) {
            return;
        }

        // prefill the cache
        if (typeof this.cache.maxBuildingsCost[building] === 'undefined') {
            this._calculateMaxBuildingsCostCache(building);
            this.cache.maxBuildingsAvailable[building] = 0;
        }

        let availableAmount = 0;

        // check how many cache entries are required
        while (true) {
            let currentLength = this.cache.maxBuildingsCost[building].length - 1;
            if (this.cache.maxBuildingsCost[building][currentLength] < this.state.plops) {
                this._calculateMaxBuildingsCostCache(building);
                availableAmount = currentLength;
                continue;
            }
            break;
        }

        // Get close to the cache entry which is currently available
        availableAmount = this._getMaxAvailableBuildingsFromCache(building, availableAmount, 25);
        // walk through the latest cache block to find the amount
        availableAmount = this._getMaxAvailableBuildingsFromCache(building, availableAmount, 1);

        if (this.slotController && this.slotController.isAutoBuyerEnabled(building) && availableAmount > 0) {
            this.autoBuySemaphore = building;

            if (this.removePlops(this.cache.maxBuildingsCost[building][availableAmount], false)) {
                this.addBuildings(building, availableAmount, false);
                this.addAutoBuyerBuildings(availableAmount);

                $('#building-container-' + building).find('.fieldset-buy').prop('disabled', true);
                $('#available-buildings-' + building).text(
                    '0 (' + translator.translate('plopValue', {__PLOPS__: 0}) + ')'
                );

                this.cache.maxBuildingsAvailable[building] = 0;
                this.autoBuySemaphore = null;

                return;
            }

            this.autoBuySemaphore = null;
        }

        if (this.isOnMaxBuyAmount &&
            (forceMaxAvailableUpdate || availableAmount !== this.cache.maxBuildingsAvailable[building])
        ) {
            if (this.cache.maxBuildingsAvailable[building] === 0 && availableAmount > 0) {
                $('#building-container-' + building).find('.fieldset-buy').prop('disabled', false);
            }
            if (this.cache.maxBuildingsAvailable[building] > 0 && availableAmount === 0) {
                $('#building-container-' + building).find('.fieldset-buy').prop('disabled', true);
            }

            $('#available-buildings-' + building).text(
                this.numberFormatter.formatInt(availableAmount) + ' (' +
                translator.translate(
                    'plopValue',
                    {
                        __PLOPS__: this.numberFormatter.format(this.cache.maxBuildingsCost[building][availableAmount])
                    }
                ) + ')'
            );
        }

        this.cache.maxBuildingsAvailable[building] = availableAmount;

        return availableAmount;
    };

    /**
     * Adds the given amount to the automatically purchased buildings counter
     *
     * @param amount
     */
    GameState.prototype.addAutoBuyerBuildings = function (amount) {
        this.state.autoBuyerBuildings += amount;

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerFactory.slots.automation.autoBuyer.amount,
            this.state.autoBuyerBuildings
        );
    };

    GameState.prototype._getMaxAvailableBuildingsFromCache = function (building, start, step) {
        for (start; start < this.cache.maxBuildingsCost[building].length; start += step) {
            if (!this.cache.maxBuildingsCost[building][start + step] ||
                this.cache.maxBuildingsCost[building][start + step] > this.state.plops
            ) {
                break;
            }
        }

        return start;
    };

    /**
     * Calculate the next 100 entries of the max available buildings cache
     *
     * @param {string} building
     * @private
     */
    GameState.prototype._calculateMaxBuildingsCostCache = function (building) {
        if (!this.cache.maxBuildingsCost[building]) {
            this.cache.maxBuildingsCost[building] = [0];
        }

        const length         = this.cache.maxBuildingsCost[building].length,
              costMultiplier = this._getBuildingCostMultiplier(building);

        let costsOfBuildingsBefore = this.cache.maxBuildingsCost[building][length - 1];

        for (let i = 0; i < 100; i++) {
            this.cache.maxBuildingsCost[building][length + i] = (costsOfBuildingsBefore += Math.ceil(
                this.state.buildings[building].baseCost *
                Math.pow(1.1, this.state.buildings[building].amount + length + i - 1)
            ) * costMultiplier);
        }
    };

    GameState.prototype.updateCosts = function (building) {
        if (!this.isOnMaxBuyAmount) {
            this.calculateCostNext(building);
        }

        // delete the caches for the given building to force a recalculation
        delete this.cache.maxBuildingsAvailable[building];
        delete this.cache.maxBuildingsCost[building];

        this._updateMaxAvailableBuildings(building, true);
        this._updateBuyButtons();
    };

    GameState.prototype.calculateCostNext = function (building) {
        let costNext = 0;
        for (let counter = 0; counter < this.buyAmount; counter++) {
            costNext += Math.ceil(
                this.state.buildings[building].baseCost *
                Math.pow(1.1, this.state.buildings[building].amount + counter)
            );
        }

        this.state.buildings[building].costNext = costNext * this._getBuildingCostMultiplier(building);

        $('#cost-next-' + building).text(this.numberFormatter.format(this.state.buildings[building].costNext));
        return costNext;
    };

    GameState.prototype._getBuildingCostMultiplier = function (building) {
        return (1 - this.state.buildingReduction)
            * (1 - this.state.buildingReductionFromHolyUpgrades)
            * (1 - this.state.buildingReductionFromResearchProject)
            * (1 - this.buildingReductionFromBuffBottle)
            * this.beerwarts.getBuildingReduction(building)
            * this.beerBlender.getEffect('buildings');
    };

    GameState.prototype.getServiceAssistantBuildingReduction = function (amount) {
        let buildingReduction = 0;
        if (amount <= 500) {
            buildingReduction = Math.floor(amount / 100) * 0.01;
        } else if (amount <= 1500) {
            buildingReduction = 0.05 + Math.floor((amount - 500) / 100) * 0.005;
        } else {
            buildingReduction = 0.1;
        }

        return buildingReduction;
    };

    GameState.prototype.setBuildingReduction = function (reduction) {
        this.state.buildingReduction = reduction;
        this._recalculateAllCostNext();
    };

    GameState.prototype.addBuildingReductionFromHolyUpgrades = function (reduction) {
        this.state.buildingReductionFromHolyUpgrades += reduction;
        this._recalculateAllCostNext();
    };

    GameState.prototype.addBuildingReductionFromResearchProject = function (reduction) {
        this.state.buildingReductionFromResearchProject += reduction;
        this._recalculateAllCostNext();
    };

    GameState.prototype.recalculateAutoPlopsPerSecond = function () {
        if (this.updateSemaphore) {
            return;
        }

        // reset the building production cache so all building productions are recalculated
        this.cache.buildingProduction = {};

        let autoPlops = 0;
        $.each(this.state.buildings, (function addBuildingProduction(building, buildingData) {
            autoPlops += this.getBuildingProduction(building, buildingData, true);
        }).bind(this));

        if (!isFinite(autoPlops)) {
            autoPlops = Number.MAX_VALUE;
        }

        this.updatePlopsPerSecond(autoPlops);
    };

    /**
     * Calculate the production of a building type
     *
     * @param {String}  building                         The building for which to calculate the production
     * @param {Object}  buildingData                     An object with the building data
     * @param {boolean} excludeGlobalAutoPlopsMultiplier [optional] Calculate only the base production for the building
     *                                                   type without the global multiplier
     *
     * @returns {number}
     */
    GameState.prototype.getBuildingProduction = function (
        building,
        buildingData,
        excludeGlobalAutoPlopsMultiplier = false
    ) {
        if (!this.cache.buildingProduction[buildingData.tier]) {
            const base     = buildingData.amount * this.getBuildingProductionPerBuilding(building, buildingData),
                  complete = base * this.getExternalAutoPlopsMultiplier();

            this.cache.buildingProduction[buildingData.tier] = {
                base:     isFinite(base) ? base : Number.MAX_VALUE,
                complete: isFinite(complete) ? complete : Number.MAX_VALUE
            };
        }

        return excludeGlobalAutoPlopsMultiplier
            ? this.cache.buildingProduction[buildingData.tier].base
            : this.cache.buildingProduction[buildingData.tier].complete;
    };

    /**
     * Calculate the production of a single building
     *
     * @param {String}  building                         The building for which to calculate the production
     * @param {Object}  buildingData                     An object with the building data
     *
     * @returns {number}
     */
    GameState.prototype.getBuildingProductionPerBuilding = function (building, buildingData) {
        let production = (buildingData.upgradeBoost
            ? buildingData.upgradeBoost.getUpgradeBoost(buildingData)
            : buildingData.basePPS)
                * Math.pow(2, buildingData.level - 1);

        if (buildingData.tier + (new Minigames.ResearchProject()).getStage('stargazer') > this.getBuildings().length) {
            production *= 4;
        }

        return production
            * this.beerCloner.getBuildingBoostByCloning(building)
            * this.beerwarts.getBuildingMultiplier(building).totalMultiplier
            * this.beerFactory.getSlotController().getBuildingMultiplier(building).totalMultiplier;
    };

    /**
     * Get the complete external auto plop multiplier
     *
     * @returns {number}
     *
     * @private
     */
    GameState.prototype.getExternalAutoPlopsMultiplier = function () {
        return this.getBuffAutoPlopsMultiplier()
            * (1 + (this.state.achievementMultiplier - 1) * this.state.achievementUpgradeMultiplier)
            * this.state.upgradeAutoPlopsMultiplier
            * this.levelController.getLevelBonus()
            * this.state.gameSpeed
            * (1 + this.beerBank.getAutoPlopBoost())
            * this.beerBlender.getEffect('plop')
            * this.beerFactory.uniqueBuild.getMultiplier('ankh')
            * this.automatedBar.getAutoPlopBoost();
    };

    GameState.prototype.addUpgradeAutoPlopMultiplier = function (upgradeAutoPlopsMultiplier, channel = '') {
        this.state.upgradeAutoPlopsMultiplier *= 1 + upgradeAutoPlopsMultiplier;

        if (!this.upgradeMultiplierChannel[channel]) {
            this.upgradeMultiplierChannel[channel] = 1;
        }
        this.upgradeMultiplierChannel[channel] *= 1 + upgradeAutoPlopsMultiplier;

        this.updatePlopsPerSecond();
    };

    GameState.prototype.removeUpgradeAutoPlopMultiplier = function (upgradeAutoPlopsMultiplier, channel = '') {
        this.state.upgradeAutoPlopsMultiplier /= 1 + upgradeAutoPlopsMultiplier;

        if (!this.upgradeMultiplierChannel[channel]) {
            this.upgradeMultiplierChannel[channel] = 1;
        }
        this.upgradeMultiplierChannel[channel] /= 1 + upgradeAutoPlopsMultiplier;

        this.updatePlopsPerSecond();
    };

    GameState.prototype.addAchievementUpgradeMultiplier = function (achievementUpgradeMultiplier) {
        this.state.achievementUpgradeMultiplier *= 1 + achievementUpgradeMultiplier;
        this.updatePlopsPerSecond();
    };

    /**
     * Add some plops
     *
     * @param {number}  plops           The amount of plops to add
     * @param {number}  addToTotalPlops If a value != 0 is given this number will be added to the total plops
     *                                  instead of the plops value
     * @param {boolean} update          Update everything after plops are added
     */
    GameState.prototype.addPlops = function (plops, addToTotalPlops = 0, update = true) {
        const add = (addToTotalPlops !== 0 ? addToTotalPlops : plops);

        this.state.totalPlops   += add;
        this.state.allTimePlops += add;

        if (!isFinite(this.state.totalPlops)) {
            this.state.totalPlops = Number.MAX_VALUE;
        }
        if (!isFinite(this.state.allTimePlops)) {
            this.state.allTimePlops = Number.MAX_VALUE;
        }

        $('#total-plops').text(this.numberFormatter.format(this.state.totalPlops));

        if (plops <= 0) {
            return;
        }

        this.updatePlops(this.state.plops + plops, update);

        if (update) {
            this.gameEventBus.emit(EVENTS.CORE.PLOPS.ADDED, plops);
        }
    };

    /**
     * Remove plops. Returns true on success, false on error (not enough plops available)
     *
     * @param {number}  plops  The amount of plops to remove
     * @param {boolean} update Update everything after updating the plops
     *
     * @return {boolean}
     */
    GameState.prototype.removePlops = function (plops, update = true) {
        if (plops > this.state.plops) {
            return false;
        }

        this.updatePlops(this.state.plops - plops, update);

        if (update) {
            this.gameEventBus.emit(EVENTS.CORE.PLOPS.REMOVED, plops);
        }

        return true;
    };

    /**
     * Get the current amount of plops
     *
     * @returns {number}
     */
    GameState.prototype.getPlops = function() {
        return this.state.plops;
    };

    /**
     * Get the total amount of plops
     *
     * @returns {number}
     */
    GameState.prototype.getTotalPlops = function() {
        return this.state.totalPlops;
    };

    /**
     * Get the total amount of plops
     *
     * @returns {number}
     */
    GameState.prototype.getAllTimePlops = function() {
        return this.state.allTimePlops;
    };

    /**
     * Get the amount of manual clicks over all periods
     *
     * @returns {number}
     */
    GameState.prototype.getAllTimeBeerClicks = function() {
        return this.state.manualClicksAllTime;
    };

    /**
     * Get the amount of manual clicks in the current period
     *
     * @returns {number}
     */
    GameState.prototype.getBeerClicks = function () {
        return this.state.manualClicks;
    };

    GameState.prototype.getManualPlops = function () {
        return this.state.manualPlops;
    };

    /**
     * Update the amount of plops
     *
     * @param {number}  plops
     * @param {boolean} update Update everything after updating the plops
     */
    GameState.prototype.updatePlops = function (plops, update = true) {
        this.state.plops = plops;

        if (!isFinite(this.state.plops)) {
            this.state.plops = Number.MAX_VALUE;
        }

        $('#current-plops').text(this.numberFormatter.format(this.state.plops));

        if (update) {
            // always keep track of the max available cache for auto buyer. First process the buildings with activated
            // auto buyer to update the purchase buttons of all other buildings with the correct remaining plop amount
            Object.keys(this.state.buildings)
                .sort(building => this.slotController.isAutoBuyerEnabled(building) ? -1 : 1)
                .forEach(building => this._updateMaxAvailableBuildings(building));

            if (!this.isOnMaxBuyAmount) {
                this._updateBuyButtons();
            }

            this.gameEventBus.emit(EVENTS.CORE.PLOPS.UPDATED, this.state.plops);
        }
    };

    GameState.prototype._updateBuyButtons = function () {
        if (this.updateSemaphore) {
            return;
        }

        let gameState  = this;

        $.each($('#buildings-container').find('.buy'), function updateBuyButtonDisabledState() {
            $(this).closest('fieldset').prop(
                'disabled',
                gameState.isOnMaxBuyAmount
                    ? gameState.cache.maxBuildingsAvailable[$(this).data('building')] === 0
                    : gameState.state.buildings[$(this).data('building')].costNext > gameState.state.plops
            );
        });
    };

    GameState.prototype.updatePlopsPerSecond = function (plopsPerSecond) {
        if (this.updateSemaphore) {
            return;
        }

        if (plopsPerSecond) {
            this.state.autoPlopsPerSecond = Math.min(Number.MAX_VALUE, plopsPerSecond);
        }

        // reset the building production cache so all building productions are recalculated
        this.cache.buildingProduction = {};
        this.cache.totalAutoPlopsPerSecond = Math.min(
            this.state.autoPlopsPerSecond * this.getExternalAutoPlopsMultiplier(),
            Number.MAX_VALUE,
        );

        const plops = this.getAutoPlopsPerSecond();
        $('#auto-plops').text(this.numberFormatter.format(plops));

        this.gameEventBus.emit(EVENTS.CORE.PLOPS.AUTO_PLOPS_UPDATED, plops);
    };

    /**
     * Interpolate the plops gained during a game break
     *
     * @param interpolateGameBreakSeconds
     * @private
     */
    GameState.prototype._interpolateGameBreakPlops = function (interpolateGameBreakSeconds) {
        const interpolateDuration = Math.min(interpolateGameBreakSeconds, this.state.interpolate.duration),
              interpolatedPlops   = this.getAutoPlopsPerSecondWithoutBuffMultiplier()
                  * this.state.interpolate.percentage
                  * interpolateDuration;

        // trigger the building level controller to also execute an interpolation
        this.buildingLevelController.interpolateGameBreakBottleCaps(
            interpolateDuration,
            this.state.interpolate.percentage
        );

        this.beerwarts.interpolateGameBreakMana(
            interpolateDuration,
            this.state.interpolate.percentage
        );

        if (interpolatedPlops < 1) {
            return;
        }

        this.addPlops(interpolatedPlops);
        $('.manual-plop').remove();

        this.flyoutText.spawnFlyoutText(
            translator.translate(
                'abstinenceHint',
                {
                    __PLOPS__: this.numberFormatter.format(interpolatedPlops),
                }
            ),
            window.innerWidth / 2,
            window.innerHeight / 2,
            'manual-plop',
            'manual-plop-top',
            3000,
            3500
        );

        window.setTimeout(
            () => this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.abstinence,
                interpolatedPlops
            ),
            0
        );
    };

    GameState.prototype.getBuildingData = function (building) {
        return this.state.buildings[building];
    };

    GameState.prototype.getBuildings = function () {
        return Object.keys(this.state.buildings);
    };

    /**
     * Get a random owned building
     *
     * @returns {String}
     */
    GameState.prototype.getRandomOwnedBuilding = function () {
        let ownedBuildings = [];

        $.each(this.state.buildings, function gatherOwnedBuildings(buildingKey, buildingData) {
            if (buildingData.amount > 0) {
                ownedBuildings.push(buildingKey);
            }
        });

        if (ownedBuildings.length === 0) {
            return null;
        }

        return ownedBuildings[Math.floor(Math.random() * ownedBuildings.length)];
    };

    GameState.prototype.getStartTime = function () {
        return new Date(this.state.startTime);
    };

    /**
     * Add a level to a building
     *
     * @param {string} building
     */
    GameState.prototype.incBuildingLevel = function (building) {
        this.state.buildings[building].level++;

        this.gameEventBus.emit(
            EVENTS.CORE.BUILDING.LEVEL_UP,
            {
                building: building,
                level:    this.state.buildings[building].level,
            }
        );

        this.recalculateAutoPlopsPerSecond();

        return this.state.buildings[building].level;
    };

    GameState.prototype.getAutoPlopsPerSecond = function (excludeGlobalAutoPlopsMultiplier = false) {
        return excludeGlobalAutoPlopsMultiplier ? this.state.autoPlopsPerSecond : this.cache.totalAutoPlopsPerSecond;
    };

    GameState.prototype.getAutoPlopsPerSecondWithoutBuffMultiplier = function () {
        return this.getAutoPlopsPerSecond() / this.getBuffAutoPlopsMultiplier();
    };

    GameState.prototype.addManualClicksMultiplier = function (multiplier) {
        this.state.manualClicksMultiplier += multiplier;
        ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP).triggerModifierChange('ManualClickMultiplier');
    };

    GameState.prototype.removeManualClicksMultiplier = function (multiplier) {
        this.state.manualClicksMultiplier -= multiplier;
        ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP).triggerModifierChange('ManualClickMultiplier');
    };

    GameState.prototype.getBuffAutoPlopsMultiplier = function () {
        return this.state.buffAutoPlopsMultiplier > 0 ? this.state.buffAutoPlopsMultiplier : 1;
    };

    GameState.prototype.addBuffAutoPlopsMultiplier = function (multiplier) {
        this.state.buffAutoPlopsMultiplier += multiplier;
        this.updatePlopsPerSecond();
    };

    GameState.prototype.addBuffBuildingReduction = function (reduction) {
        this.buildingReductionFromBuffBottle += reduction;
        this.buildingLevelController.addBuffBottleCapFactoryReduction(reduction);
        this._recalculateAllCostNext();
    };

    GameState.prototype.removeBuffBuildingReduction = function (reduction) {
        this.buildingReductionFromBuffBottle -= reduction;
        this.buildingLevelController.removeBuffBottleCapFactoryReduction(reduction);
        this._recalculateAllCostNext();
    };

    GameState.prototype.removeBuffAutoPlopsMultiplier = function (multiplier) {
        this.state.buffAutoPlopsMultiplier -= multiplier;
        this.state.buffAutoPlopsMultiplier = +(this.state.buffAutoPlopsMultiplier.toFixed(2));
        this.updatePlopsPerSecond();
    };

    GameState.prototype.getBuildingLevelController = function () {
        return this.buildingLevelController;
    };

    GameState.prototype.setUpgradeController = function (upgradeController) {
        this.upgradeController = upgradeController;
        return this;
    };

    GameState.prototype.setAchievementController = function (achievementController) {
        this.achievementController = achievementController;
        return this;
    };

    GameState.prototype.setLevelController = function (levelController) {
        this.levelController = levelController;
        return this;
    };

    GameState.prototype.setSlotController = function (slotController) {
        this.slotController = slotController;
        this.buildingLevelController.setSlotController(slotController);

        return this;
    };

    GameState.prototype.setResearchProject = function (researchProject) {
        this.researchProject = researchProject;
        return this;
    };

    GameState.prototype.setBeerBank = function (beerBank) {
        this.beerBank = beerBank;
        return this;
    };

    GameState.prototype.setBeerCloner = function (beerCloner) {
        this.beerCloner = beerCloner;
        return this;
    };

    GameState.prototype.setBeerwarts = function (beerwarts) {
        this.beerwarts = beerwarts;
        return this;
    };

    GameState.prototype.setBeerFactory = function (beerFactory) {
        this.beerFactory = beerFactory;
        return this;
    };

    GameState.prototype.setAutomatedBar = function (automatedBar) {
        this.automatedBar = automatedBar;
        return this;
    };

    GameState.prototype.getGameSpeed = function () {
        return this.state.gameSpeed;
    };

    /**
     * Add an upgrade boost to a building
     *
     * @param {string} building
     * @param {number} boost
     * @param {string} key
     */
    GameState.prototype.addUpgradeBoost = function (building, boost, key = '') {
        if (key === '') {
            this.state.buildings[building].upgradeBoost.boost += boost;
        } else {
            this.state.buildings[building].upgradeBoost.boost[key] = boost;
        }

        this.recalculateAutoPlopsPerSecond();
    };

    /**
     * Add an multiplicative upgrade boost
     *
     * @param {string} building
     * @param {number} boost
     */
    GameState.prototype.addUpgradeBoostMultiplicative = function (building, boost) {
        this.state.buildings[building].upgradeBoost.boost *= boost;
        this.recalculateAutoPlopsPerSecond();
    };

    /**
     * Get the amount of different owned building types
     *
     * @returns {number}
     */
    GameState.prototype.getOwnedBuildingTypesAmount = function () {
        let amount = 0;

        $.each(this.state.buildings, function () {
            if (this.amount > 0) {
                amount++;
            }
        });

        return amount;
    };

    /**
     * Get the smallest amount of buildings owned
     *
     * @returns {number}
     */
    GameState.prototype.getMinimumBuildingAmount = function () {
        let amounts = [];

        $.each(this.state.buildings, function () {
            amounts.push(this.amount);
        });

        return Math.min(...amounts);
    };

    /**
     * Get the total production of a building
     *
     * @param {string} building
     */
    GameState.prototype.getTotalBuildingProduction = function (building) {
        return this.state.buildings[building].production;
    };

    /**
     * Add buildings to the game state. Returns the updated number of buildings
     *
     * @param {string}  building
     * @param {int}     amount
     * @param {boolean} byUserClick
     *
     * @returns {int|boolean}
     */
    GameState.prototype.addBuildings = function (building, amount, byUserClick = false) {
        if (amount <= 0) {
            return false;
        }

        this.state.buildings[building].amount += amount;

        this._updateBuildingAmount(building);
        this.gameEventBus.emit(
            EVENTS.CORE.BUILDING.PURCHASED,
            {
                building: building,
                amount: amount,
            }
        );

        if (byUserClick) {
            this.state.manualPurchase = true;

            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.buyAmount.buildings,
                amount
            );
        }

        return this.state.buildings[building].amount;
    };

    /**
     * Remove buildings from the game state. Returns the updated number of buildings. False on error
     *
     * @param {string}  building
     * @param {int}     amount
     *
     * @returns {int}
     */
    GameState.prototype.removeBuildings = function (building, amount) {
        if (this.state.buildings[building].amount < amount) {
            return false;
        }

        this.state.buildings[building].amount -= amount;
        this._updateBuildingAmount(building);

        return this.state.buildings[building].amount;
    };

    /**
     * Execute required updates after the owned amount of a building changed
     *
     * @param {string} building
     *
     * @private
     */
    GameState.prototype._updateBuildingAmount = function (building) {
        $('.amount-' + building).text(this.numberFormatter.formatInt(this.state.buildings[building].amount));

        this.updateCosts(building);

        // reset the beer factory cache so the building amount boost is recalculated and updated values are used for
        // recalculateAutoPlopsPerSecond
        this.beerFactory.getCache().resetCarbonationBuildingAmountCache();

        // update the auto plops per second
        this.recalculateAutoPlopsPerSecond();
    };

    /**
     * Get the amount of owned buildings
     *
     * @returns {number}
     */
    GameState.prototype.getOwnedBuildingsAmount = function () {
        let amount = 0;
        $.each(this.state.buildings, function addBuildingAmount() {
            amount += this.amount;
        });

        return amount;
    };

    GameState.prototype.setCoreIterationLock = function () {
        this.lastIteration = null;
        this.coreIterationLock++;
    };

    GameState.prototype.releaseCoreIterationLock = function () {
        if (this.coreIterationLock > 0) {
            this.coreIterationLock--;
        }
    };

    GameState.prototype.addInterpolateDuration = function (minutes) {
        this.state.interpolate.duration += minutes * 60;
    };

    GameState.prototype.addInterpolatePercentage = function (percentage) {
        this.state.interpolate.percentage += percentage;
    };

    GameState.prototype.getBuyAmount = function () {
        return this.buyAmount;
    };

    GameState.prototype.isBuyChargeOnMaxBuyAmount = function () {
        return this.isOnMaxBuyAmount;
    };

    GameState.prototype.debug = function () {
        const externalMultiplier = this.getExternalAutoPlopsMultiplier(),
              totalProduction    = this.state.autoPlopsPerSecond * externalMultiplier,
              multiplierSum      = this.state.buffAutoPlopsMultiplier
                    + (1 + (this.state.achievementMultiplier - 1) * this.state.achievementUpgradeMultiplier)
                    + this.state.upgradeAutoPlopsMultiplier
                    + this.levelController.getLevelBonus();

        console.log('AutoPlops: ' + this.numberFormatter.format(totalProduction) + ' plops');

        $.each(this.state.buildings, (function (building, buildingData) {
            let enchantment = this.beerwarts.getBuildingMultiplier(building),
                slot        = this.beerFactory.getSlotController().getBuildingMultiplier(building);

            console.log(`  - ${building}: ${this.numberFormatter.format(this.getBuildingProduction(building, buildingData, true))} plops`);
            console.log(`    - Cloning Multiplier: ${this.numberFormatter.format(this.beerCloner.getBuildingBoostByCloning(building))}`);
            console.log(`    - Enchantment Multiplier: ${this.numberFormatter.format(enchantment.totalMultiplier)}`);
            console.log(`      - Own enchantments: ${this.numberFormatter.format(enchantment.buildingBoost)}`);
            console.log(`      - Enchantments on other buildings: ${this.numberFormatter.format(enchantment.totalBoost)}`);
            console.log(`    - Slot Multiplier: ${this.numberFormatter.format(slot.totalMultiplier)}`);
            console.log(`      - Own slots: ${this.numberFormatter.format(slot.equipmentBoost)}`);
            console.log(`      - Carbonation on other buildings: ${this.numberFormatter.format(slot.carbonation)}`);
        }).bind(this));

        console.log('Base-AutoPlops: ' + this.numberFormatter.format(this.state.autoPlopsPerSecond) + ' plops');
        console.log('Multiplier: ' + this.numberFormatter.format(externalMultiplier));
        console.log('  - Game Speed: ' + this.state.gameSpeed);
        console.log('  - Beer Bank: ' + (1 + this.beerBank.getAutoPlopBoost()));

        const buffGenerating = (this.state.buffAutoPlopsMultiplier) / multiplierSum * totalProduction;
        console.log('  - Buff-Multiplier: ' + this.numberFormatter.format(this.state.buffAutoPlopsMultiplier + 1) +
            ' (generating ' + this.numberFormatter.format(buffGenerating) + ' plops [' +
            this.numberFormatter.format(buffGenerating / totalProduction * 100) + '%])');

        const achievementMultiplier = (1 + (this.state.achievementMultiplier - 1) * this.state.achievementUpgradeMultiplier),
              achievementGenerating = achievementMultiplier / multiplierSum * totalProduction;
        console.log('  - Achievement-Multiplier: ' + this.numberFormatter.format(achievementMultiplier) +
            ' (generating ' + this.numberFormatter.format(achievementGenerating) + ' plops [' +
            this.numberFormatter.format(achievementGenerating / totalProduction * 100) + '%])');

        console.log('     - Base-Achievement-Multiplier: ' + this.numberFormatter.format(this.state.achievementMultiplier));
        console.log('     - Achievement-Upgrade-Multiplier: ' + this.numberFormatter.format(this.state.achievementUpgradeMultiplier));

        const upgradeGenerating = (this.state.upgradeAutoPlopsMultiplier - 1) / multiplierSum * totalProduction;
        console.log('  - Upgrade-Multiplier: ' + this.numberFormatter.format(this.state.upgradeAutoPlopsMultiplier) +
            ' (generating ' + this.numberFormatter.format(upgradeGenerating) + ' plops [' +
            this.numberFormatter.format(upgradeGenerating / totalProduction * 100) + '%])');

        $.each(this.upgradeMultiplierChannel, function (channel, multiplier) {
            console.log('     - Channel multiplier [' + channel + ']: ' + multiplier);
        });

        const levelGenerating = (this.levelController.getLevelBonus() - 1) / multiplierSum * totalProduction;
        console.log('  - Level-Multiplier: ' + this.numberFormatter.format(this.levelController.getLevelBonus()) +
            ' (generating ' + this.numberFormatter.format(levelGenerating) + ' plops [' +
            this.numberFormatter.format(levelGenerating / totalProduction * 100) + '%])');

        console.log('  - Beer Blender Bar Multiplier: ' + this.numberFormatter.format(this.beerBlender.getEffect('plop')));
        console.log('  - Unique Build Multiplier: ' + this.numberFormatter.format(this.beerFactory.uniqueBuild.getMultiplier('ankh')));
        console.log('  - Automated Bar Multiplier: ' + this.numberFormatter.format(this.automatedBar.getAutoPlopBoost()));
    };

    beerplop.GameState = GameState;
})(Beerplop);

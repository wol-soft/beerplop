(function(minigames) {
    'use strict';

    BeerFactory.prototype._instance = null;

    BeerFactory.prototype.isBeerFactoryEnabled = false;

    // External dependencies of BeerFactory
    BeerFactory.prototype.gameEventBus          = null;
    BeerFactory.prototype.gameState             = null;
    BeerFactory.prototype.numberFormatter       = null;
    BeerFactory.prototype.flyoutText            = null;
    BeerFactory.prototype.achievementController = null;

    // Internal dependencies
    BeerFactory.prototype.state       = {};
    BeerFactory.prototype.cache       = {};
    BeerFactory.prototype.buildQueue  = {};
    BeerFactory.prototype.upgrade     = {};
    BeerFactory.prototype.render      = {};
    BeerFactory.prototype.slot        = {};
    BeerFactory.prototype.trader      = {};
    BeerFactory.prototype.uniqueBuild = {};

    // iterators which handle the ticks of the factories
    BeerFactory.prototype.buildQueueIterator                       = null;
    BeerFactory.prototype.factoryProductionIterator                = null;
    BeerFactory.prototype.factoryExtensionProductionIterator       = null;
    BeerFactory.prototype.factoryExtensionMaterialDeliveryIterator = null;
    BeerFactory.prototype.traderIterator                           = null;

    /**
     * @param gameState
     * @param gameEventBus
     *
     * @constructor
     */
    function BeerFactory(gameState, gameEventBus) {
        if (BeerFactory.prototype._instance) {
            return BeerFactory.prototype._instance;
        }

        BeerFactory.prototype._instance = this;

        this.gameEventBus          = gameEventBus;
        this.gameState             = gameState;
        this.numberFormatter       = new Beerplop.NumberFormatter();
        this.flyoutText            = new Beerplop.FlyoutText();
        this.achievementController = new Beerplop.AchievementController();

        // set up the internal objetcs
        this.state   = new BeerFactoryGame.State(this.gameState, this.gameEventBus);
        this.cache   = new BeerFactoryGame.Cache(this.state, this.gameState);
        this.stock   = new BeerFactoryGame.Stock(this.state, this.cache, this.numberFormatter);
        this.factory = new BeerFactoryGame.Factory(this.state, this.cache, this.achievementController);
        this.trader  = new BeerFactoryGame.Trader(
            this.state,
            this.gameEventBus,
            this.numberFormatter,
            this.achievementController,
        );

        this.upgrade = new BeerFactoryGame.Upgrade(
            this.state,
            this.factory,
            this.stock,
            this.trader,
            this.cache,
            this.achievementController,
            this.numberFormatter,
        );

        this.buildQueue = new BeerFactoryGame.BuildQueue(
            this.state,
            this.stock,
            this.cache,
            this.upgrade,
            this.gameState,
            this.achievementController,
            this.gameEventBus,
        );

        this.uniqueBuild = new BeerFactoryGame.UniqueBuilds(
            this.buildQueue,
            this.gameEventBus,
            this.numberFormatter,
            this.achievementController,
        );

        this.render = new BeerFactoryGame.Render(
            this.numberFormatter,
            this.state,
            this.stock,
            this.buildQueue,
            this.upgrade,
            this.factory,
            this.cache,
            this.achievementController,
            this.flyoutText,
            this.trader,
            this.uniqueBuild,
        );

        this.slot = new BeerFactoryGame.Slot(
            this.state,
            this.cache,
            this.factory,
            this.buildQueue,
            this.numberFormatter,
        );

        this.factory
            .setRender(this.render)
            .setUpgrade(this.upgrade);

        this.upgrade
            .setRender(this.render)
            .setUniqueBuild(this.uniqueBuild)
            .setSlot(this.slot)
            .setBuildQueue(this.buildQueue);

        this.buildQueue.setRender(this.render);

        this.state
            .setUniqueBuild(this.uniqueBuild)
            .setCache(this.cache)
            .setRender(this.render);

        this.gameEventBus.on(EVENTS.SAVE.LOAD.FINISHED, () => {
            this.stock.clearStockOverflow();
        });

        (new Beerplop.GamePersistor()).registerModule(
            'BeerFactory',
            (function () {
                return this.state.getState();
            }.bind(this)),
            (function (loadedData) {
                this.state.extendState(loadedData);

                window.setTimeout(
                    () => {
                        const state = (new Minigames.BeerFactory()).state.getState(),
                              achievementController = new Beerplop.AchievementController();

                        // code to fix broken save states after 1.64.0
                        $.each(state.materials, function (material) {
                            if (!isFinite(state.materials[material].amount) || state.materials[material].amount < 0) {
                                state.materials[material].amount = 0;
                            }

                            if (!isFinite(state.materials[material].amount) ||
                                state.materials[material].amount < 0 ||
                                typeof state.materials[material].total === 'string'
                            ) {
                                let lastAmount = 0,
                                    fixed      = false;

                                $.each(achievementController.achievementStorage.achievements.beerFactory.materials[material], function (amount, data) {
                                    if (!data.reached) {
                                        state.materials[material].total = lastAmount;
                                        fixed = true;
                                        return false;
                                    }

                                    lastAmount = parseInt(amount);
                                });

                                if (!fixed) {
                                    state.materials[material].total = lastAmount;
                                }
                            }
                        });
                    },
                    0
                );

                this.buildQueue.reIndexBuildQueue();
                this.buildQueue.updateQueuedJobsAmount();
            }.bind(this))
        );
    }

    BeerFactory.prototype.unlockBeerFactory = function () {
        if (this.isBeerFactoryEnabled) {
            return;
        }

        this.isBeerFactoryEnabled = true;

        this.achievementController.checkAchievement(
            this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.beerFactory
        );

        this.buildQueueIterator = new BeerFactoryGame.BuildQueueIterator(
            this.state,
            this.stock,
            this.render,
            this.cache,
            this.buildQueue,
            this.numberFormatter,
            this.gameEventBus,
        );
        this.factoryExtensionProductionIterator = new BeerFactoryGame.FactoryExtensionProductionIterator(
            this.state,
            this.stock,
            this.render,
            this.factory,
            this.cache,
            this.numberFormatter,
        );
        this.factoryExtensionMaterialDeliveryIterator = new BeerFactoryGame.FactoryExtensionMaterialDeliveryIterator(
            this.state,
            this.stock,
            this.factory,
            this.cache,
            this.render,
            this.numberFormatter,
        );
        this.factoryProductionIterator = new BeerFactoryGame.FactoryProductionIterator(
            this.state,
            this.stock,
            this.render,
            this.factory,
            this.cache,
            this.factoryExtensionProductionIterator,
            this.factoryExtensionMaterialDeliveryIterator,
        );
        this.traderIterator = new BeerFactoryGame.TraderIterator(this.state, this.stock, this.trader);

        $('#enter-beer-factory').removeClass('d-none');

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function beerFactoryCoreIteration() {
            this.stock.resetProductionBalanceTracking();

            // The configured trading deals have priority to access stored items
            this.traderIterator.iterate();

            // first the queue then the production. So produced goods are at least for one tick in the storage
            this.buildQueueIterator.checkBuildQueue();

            // if the build queue is the preferred delivery check the factory extension delivery after the build queue.
            // Else the factory extension delivery is checked after the production in _checkProduction
            if (this.state.getState().deliveryPreferQueue &&
                this.factoryExtensionMaterialDeliveryIterator.checkEnabledExtensionsMaterialDelivery() &&
                this.render.isOverlayVisible()
            ) {
                this.stock.updateStock();
            }

            this.factoryProductionIterator.checkProduction();

            if (this.render.isOverlayVisible()) {
                this.stock.updateProductionBalance();
            }
        }).bind(this));

        // check the material production achievements not on each iteration to save performance
        this.gameEventBus.on(EVENTS.CORE.ITERATION_LONG, (function () {
            $.each(this.state.getMaterials(), (function (material, materialData) {
                if (materialData.enabled === false ||
                    !this.achievementController.getAchievementStorage().achievements.beerFactory.materials[material]
                ) {
                    return;
                }

                this.achievementController.checkAmountAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerFactory.materials[material],
                    materialData.total
                );
            }).bind(this));
        }).bind(this));
        
        this.gameEventBus.on(EVENTS.BEER_BLENDER.UPDATE, this.updateMultiplier.bind(this));
        this.gameEventBus.on(EVENTS.BEER_FACTORY.UNIQUE_BUILD.UPDATED, this.updateMultiplier.bind(this));
        
        ComposedValueRegistry.getComposedValue(CV_FACTORY)
            .addModifier('GameSpeed', () => this.state.gameState.getGameSpeed())
    };

    /**
     * Clears all storages (Stock storage, factory extension storage)
     */
    BeerFactory.prototype.clearStorages = function () {
        const state = this.state.getState();

        $.each(state.materials, (function (material) {
            state.materials[material].amount = 0;
        }).bind(this));

        $.each(state.extensionStorage, (function (extension) {
            $.each(state.extensionStorage[extension].materials, (function (material) {
                state.extensionStorage[extension].materials[material] = 0;
            }).bind(this));

            state.extensionStorage[extension].stored = 0;
        }).bind(this));

        state.stock.amount = 0;
    };

    BeerFactory.prototype.getCache = function () {
        return this.cache;
    };

    BeerFactory.prototype.getSlotController = function () {
        return this.slot;
    };

    /**
     * updates the Beer Factory view after a multiplier change
     * e.g. after a Buff Bottle has been clicked or a Beer Blender ingredient change
     */
    BeerFactory.prototype.updateMultiplier = function () {
        this.stock.clearStockOverflow();
        this.cache.resetCache();
        this.trader.recalculateAutoMaxDeals(false);

        if (this.render.isOverlayVisible()) {
            this.render.renderOverlay();
        }
    };

    minigames.BeerFactory = BeerFactory;
})(Minigames);

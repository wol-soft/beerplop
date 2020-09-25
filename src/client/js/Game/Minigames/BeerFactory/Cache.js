(function(beerFactoryGame) {
    'use strict';

    Cache.prototype.cache = {
        productionAmountCache: {},
        producedMaterialCache: {},
        deliverCapacity: 0,
        // Cache the amount of consumed/produced materials for a factory extension production cycle including boosts
        factoryExtensionConsumptionCache: {},
        factoryExtensionProductionCache: {},
        factoryExtensionDeliverCapacityCache: {},
        // cache the multipliers an equipped carbonation item results in for faster auto plop calculation
        carbonationBuildingAmountCache: null,
    };

    Cache.prototype.state           = null;
    Cache.prototype.gameState       = null;
    Cache.prototype.numberFormatter = null;

    Cache.prototype.emptyState = null;

    function Cache(state, gameState) {
        this.state           = state;
        this.gameState       = gameState;
        this.numberFormatter = new Beerplop.NumberFormatter();

        this.emptyState = $.extend(true, {}, this.cache);

        // reset all caches to make sure all caches including the modifier will update with the changed value
        ComposedValueRegistry.getComposedValue(CV_FACTORY).onValueChange(this.resetCache.bind(this));
    }

    Cache.prototype.resetCache = function () {
        this.cache = $.extend(true, {}, this.emptyState);
    };

    Cache.prototype.getCache = function () {
        return this.cache;
    };

    Cache.prototype.getDeliverCapacity = function () {
        if (!this.cache.deliverCapacity) {
            const state = this.state.getState();

            this.cache.deliverCapacity = (
                    3
                    + (state.factories.storage.upgrades.diversify > 0 ? state.factories.storage.amount : 0)
                    + state.factories.transport.amount * 2
                )
                * Math.pow(2, state.factories.transport.upgrades.double)
                * Math.pow(1 + state.factories.lodge.upgrades.comfort * 0.05, state.factories.lodge.amount)
                * ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue();
        }

        return this.cache.deliverCapacity;
    };

    /**
     * get the internal extension deliver capacity from the extension storage to the production
     *
     * @param {string} factoryKey
     * @param {string} extensionKey
     *
     * @return {Number}
     */
    Cache.prototype.getFactoryExtensionDeliverCapacity = function (factoryKey, extensionKey) {
        if (!this.cache.factoryExtensionDeliverCapacityCache[extensionKey]) {
            this.cache.factoryExtensionDeliverCapacityCache[extensionKey] = this.state.getFactory(factoryKey).amount
                * this.state.getFactory('storage').amount
                * ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue();
        }

        return this.cache.factoryExtensionDeliverCapacityCache[extensionKey];
    };

    Cache.prototype.resetDeliverCapacityCache = function () {
        delete this.cache['deliverCapacity'];
        this.cache.factoryExtensionDeliverCapacityCache = {};
    };

    /**
     * Get the production amount of a factory
     *
     * @param {string} factory
     *
     * @returns {number}
     * @private
     */
    Cache.prototype.getProducedAmount = function (factory) {
        if (!this.cache.productionAmountCache[factory]) {
            const factoryData        = this.state.getFactory(factory),
                  lodge              = this.state.getFactory('lodge'),
                  backRoomMultiplier = this.getBackRoomMultiplier(factory);

            let multiplier = ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue()
                * Math.pow(lodge.productionMultiplier, lodge.amount)
                * backRoomMultiplier;

            if (backRoomMultiplier >= 2) {
                const achievementController = new Beerplop.AchievementController();
                achievementController.checkAchievement(
                    achievementController.getAchievementStorage().achievements.beerFactory.lobby.double
                );
            }

            if (factoryData.upgrades.double) {
                multiplier *= Math.pow(2, factoryData.upgrades.double);
            }

            this.cache.productionAmountCache[factory] = factoryData.amount * multiplier;

            // as a recalculation may occur without a re-rendering (eg. lobbyist sector changed) update the values
            $('#beer-factory__' + factory)
                .find('.beer-factory__building__production')
                .text(this.numberFormatter.formatInt(this.cache.productionAmountCache[factory]));
        }

        return this.cache.productionAmountCache[factory];
    };

    /**
     * Reset the cache which holds the data about produced items per iteration
     */
    Cache.prototype.resetProductionAmountCache = function () {
        this.cache.productionAmountCache = {};
    };

    Cache.prototype.getBackRoomMultiplier = function (factory) {
        const backRoom = this.state.getFactory('backRoom');

        return Math.pow(
            1 + backRoom.amount * 0.02 * Math.pow(1.25, backRoom.upgrades.influence),
            // calculate the supporting lobbyists
            backRoom.lobbyists.reduce((prev, cur) => prev + (cur.factory === factory), 0)
        );
    };

    /**
     * Fill the cache for the item production of the given factory
     *
     * @param {string} factory The key of the requested factory
     *
     * @returns {Array}
     * @private
     */
    Cache.prototype.getProducedMaterialCache = function (factory) {
        if (!this.cache.producedMaterialCache[factory]) {
            this.cache.producedMaterialCache[factory] = [];

            $.each(
                this.state.getFactory(factory).production,
                (function addPossibleItemProductionToFactoryProductionCache(item, possibility) {
                    for (let i = 0; i < possibility; i++) {
                        this.cache.producedMaterialCache[factory].push(item);
                    }
                }).bind(this)
            );
        }

        return this.cache.producedMaterialCache[factory];
    };

    /**
     * Get a list of materials a factory extension consumes for one produced item
     *
     * @param {string} extension
     *
     * @returns {Object}
     *
     * @private
     */
    Cache.prototype.getFactoryExtensionConsumption = function (extension) {
        if (extension === null) {
            return {};
        }

        if (!this.cache.factoryExtensionConsumptionCache[extension]) {
            let consumption = {};

            $.each(
                EXTENSIONS[extension].consumes || [],
                (function updateFactoryConsumptionCache(material, amount) {
                    consumption[material] = Math.ceil(amount / (this.state.getExtensionStorage(extension).boost || 1));
                }).bind(this)
            );

            this.cache.factoryExtensionConsumptionCache[extension] = consumption;
        }

        return this.cache.factoryExtensionConsumptionCache[extension];
    };

    /**
     * Get a list of materials a factory extension produces for one set of consumed items
     *
     * @param {string} extension
     *
     * @returns {Object}
     *
     * @private
     */
    Cache.prototype.getFactoryExtensionProduction = function (extension) {
        if (extension === null) {
            return {};
        }

        if (!this.cache.factoryExtensionProductionCache[extension]) {
            let production = {};

            $.each(
                EXTENSIONS[extension].produces,
                (function updateFactoryProductionCache(material, amount) {
                    production[material] = {
                        amount: amount * ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue(),
                        boost:  (this.state.getExtensionStorage(extension).multiplier || 1),
                    };
                }).bind(this)
            );

            this.cache.factoryExtensionProductionCache[extension] = production;
        }

        return this.cache.factoryExtensionProductionCache[extension];
    };

    /**
     * Calculate the multiplier equipped carbonation items boost
     *
     * @returns {Number}
     */
    Cache.prototype.getCarbonationBuildingAmountCache = function() {
        if (!this.cache.carbonationBuildingAmountCache) {
            let multiplier = 1;

            $.each(
                this.state.getState().equippedBuildings,
                (function applyEquippedCarbonationItemsToBoostMultiplier(building, equipmentData) {
                    const equippedCarbonationItems = equipmentData.slots.reduce(
                        // only slots which are equipped with a finished carbonation are considered for calculation
                        (total, slot) => total +
                            (slot !== null &&
                                slot.equip === EQUIPMENT_ITEM__CARBONATION &&
                                slot.state === EQUIPMENT_STATE__FINISHED
                                    ? 1
                                    : 0
                            ),
                        0
                    );

                    if (equippedCarbonationItems === 0) {
                        return;
                    }

                    const buildingData = this.gameState.getBuildingData(building);

                    if (!buildingData) {
                        (new Beerplop.ErrorReporter()).reportError(
                            'DEBUG getCarbonationBuildingAmountCache',
                            `Tried to fetch building data for building "${building}"`,
                            ''
                        );

                        delete this.state.getState().equippedBuildings[building];
                        return;
                    }

                    multiplier *= Math.pow(
                        1 + buildingData.amount / 5e3,
                        equippedCarbonationItems
                    );
                }).bind(this)
            );
            this.cache.carbonationBuildingAmountCache = multiplier;
        }

        return this.cache.carbonationBuildingAmountCache;
    };

    /**
     * Reset the carbonation effect cache so the values are recalculated on the next request
     */
    Cache.prototype.resetCarbonationBuildingAmountCache = function() {
        this.cache.carbonationBuildingAmountCache = null;
    };

    beerFactoryGame.Cache = Cache;
})(BeerFactoryGame);

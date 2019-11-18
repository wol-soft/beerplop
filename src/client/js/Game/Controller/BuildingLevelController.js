(function(beerplop) {
    'use strict';

    BuildingLevelController.prototype.numberFormatter      = null;
    BuildingLevelController.prototype.gameState            = null;
    BuildingLevelController.prototype.gameEventBus         = null;
    BuildingLevelController.prototype.slotController       = null;
    BuildingLevelController.prototype.productionStatistics = null;

    BuildingLevelController.prototype.bottleCapProductionMultiplier  = 1;
    BuildingLevelController.prototype.bottleCapFactoryReduction      = 1;
    BuildingLevelController.prototype.bottleCapFactoryLevelReduction = 1;
    BuildingLevelController.prototype.buffFottleCapFactoryReduction  = 1;

    BuildingLevelController.prototype.interpolateBottleCapFactories = false;

    BuildingLevelController.prototype.buffBottleCapProductionMultiplier = 0;

    BuildingLevelController.prototype.state = {
        amount:          0,
        factories:       0,
        totalProduction: 0,
        costNext:        100,
        baseCost:        100,
        level:           1,
        autoLevelUp:     0,
    };

    // block recalculations during loading a save state to increase performance.
    // Instead recalculate after the save state was applied
    BuildingLevelController.prototype.updateSemaphore      = false;
    // this semaphore is set to true if the controller currently executes an auto build
    BuildingLevelController.prototype.autoBuildSemaphore   = false;
    BuildingLevelController.prototype.autoLevelUpSemaphore = false;
    BuildingLevelController.prototype.initialState         = null;

    BuildingLevelController.prototype.cache = {
        maxFactoriesCost: null,
        maxFactoriesAvailable: 0,
    };

    /**
     * Initialize the building level controller
     *
     * @constructor
     */
    function BuildingLevelController(gameState, gameEventBus, productionStatistics) {
        this.numberFormatter      = new Beerplop.NumberFormatter();
        this.gameState            = gameState;
        this.gameEventBus         = gameEventBus;
        this.productionStatistics = productionStatistics;

        this.initialState = $.extend(true, {}, this.state);

        ComposedValueRegistry
            .getComposedValue(CV_BOTTLE_CAP)
            .onValueChange(this.updateBottleCapFactoryView.bind(this))
            .addModifier('BuildingLevelController__Base-Production',       () => this.state.factories * 0.1)
            .addModifier('BuildingLevelController__Factory-Level',         () => Math.pow(2, this.state.level - 1))
            .addModifier('BuildingLevelController__Production-Multiplier', () => this.bottleCapProductionMultiplier)
            .addModifier('BuildingLevelController__Factory-Buff',          () => this.buffBottleCapProductionMultiplier || 1)
            .addModifier('BuildingLevelController__Game-Speed',            () => this.gameState.getGameSpeed());

        this._initLevelBuildingUp();
        this._initBuyBottleCapFactory();
        this._initLevelBottleFactoryUp();

        this.gameEventBus.on(
            EVENTS.CORE.ITERATION,
            () => this.addBottleCaps(ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).getValue())
        );

        this.gameEventBus.on(EVENTS.CORE.ITERATION_LONG, (function () {
            this.productionStatistics.statisticsSnapshot(
                'bottleCapFactory',
                ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).getValue(),
                this.getTotalBottleCaps(),
                this.getBottleCapFactoriesAmount()
            );
        }).bind(this));

        // check if there are enough plops available to buy a new bottle cap factory/level up bottle cap factories
        this.gameEventBus.on(EVENTS.CORE.PLOPS.UPDATED, (function (event, amount) {
            this._updateMaxAvailableFactories();
            this._updateLevelUp();

            $('#buy-bottle-cap-factory').closest('fieldset').prop(
                'disabled',
                this.gameState.isBuyChargeOnMaxBuyAmount()
                    ? this.cache.maxFactoriesAvailable === 0
                    : amount < this.state.costNext
            );
        }).bind(this));

        this.gameEventBus.on(
            EVENTS.BEER_FACTORY.AUTO_BUYER,
            (event, context) =>
                context.enabled
                    && $.inArray(context.building, ['global', 'bottleCapFactory']) !== -1
                    && this._updateMaxAvailableFactories()
        );

        this.gameEventBus.on(
            EVENTS.BEER_FACTORY.AUTO_LEVEL_UP,
            (event, context) => {
                if (!context.enabled) {
                    return;
                }

                switch (context.building) {
                    case 'bottleCapFactory':
                        this._updateLevelUp();
                        break;
                    case 'global':
                        this._updateLevelUp();
                        $.each(this.gameState.getBuildings(), (function (index, building) {
                            this._checkLevelUpButton(building);
                        }).bind(this));
                        break;
                    default:
                        this._checkLevelUpButton(context.building);
                }
            }
        );

        this.gameEventBus.on(EVENTS.CORE.BUY_AMOUNT_UPDATED, (function () {
            this.updateCostNext(true);

            $('#buy-bottle-cap-factory').closest('fieldset').prop(
                'disabled',
                this.gameState.isBuyChargeOnMaxBuyAmount()
                    ? this.cache.maxFactoriesAvailable === 0
                    : this.gameState.getPlops() < this.state.costNext
            );
        }).bind(this));

        // register the controller so the internal data will be saved
        (new Beerplop.GamePersistor()).registerModule(
            'BuildingLevelController',
            (function () {
                let data = $.extend(true, {}, this.state);

                delete data.costNext;

                return data;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(this.state, loadedData);
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function () {
            this._updateUI();
            $('.level-up').text(
                translator.translate(
                    'building.levelUp',
                    {
                        __LEVEL__: 'I'
                    }
                )
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.SAVE.LOAD.STARTED, () => this.updateSemaphore = true);
        this.gameEventBus.on(EVENTS.SAVE.LOAD.FINISHED, () => {
            this.updateSemaphore = false;
            this.updateCostNext(true);
            this._updateUI();
        });
    }

    BuildingLevelController.prototype.resetInitialState = function () {
        const autoLevelUp = this.state.autoLevelUp;

        this.bottleCapProductionMultiplier  = 1;
        this.bottleCapFactoryReduction      = 1;
        this.bottleCapFactoryLevelReduction = 1;
        this.interpolateBottleCapFactories  = false;
        this.state                          = $.extend(true, {}, this.initialState);

        this.state.autoLevelUp = autoLevelUp;

        this.cache.maxFactoriesCost      = null;
        this.cache.maxFactoriesAvailable = 0;

        ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).recalculate();
    };

    BuildingLevelController.prototype._updateLevelUp = function () {
        if (this._checkBottleCapFactoryLevelUpButton() &&
            this.slotController.isAutoLevelUpEnabled('bottleCapFactory')
        ) {
            do {
                this._addLevel();
                this._incAutoLevelUps();
            } while (this._checkBottleCapFactoryLevelUpButton());
        }
    };

    BuildingLevelController.prototype._updateUI = function () {
        this.updateBottleCapFactoryView();
        this._checkLevelUpButtons();
        this._updateLevelUp();

        // update the level up buttons so they display the correct level
        $.each(this.gameState.getBuildings(), (function (index, building) {
            const button = $('#level-up-' + building);
            button.text(
                translator.translate(
                    'building.levelUp',
                    {
                        __LEVEL__: this.numberFormatter.romanize(this.gameState.getBuildingData(building).level)
                    }
                )
            );
        }).bind(this));

        $('#level-up-bottle-cap-factory').text(
            translator.translate(
                'building.levelUp',
                {
                    __LEVEL__: this.numberFormatter.romanize(this.state.level)
                }
            )
        );
    };

    /**
     * Initialize the level up buttons for the different buildings
     *
     * @private
     */
    BuildingLevelController.prototype._initLevelBuildingUp = function () {
        $('#buildings-container').find('.level-up').on('click', (function (event) {
            let building         = $(event.target).data('building'),
                buildingData     = this.gameState.getBuildingData(building),
                capsForNextLevel = this.getRequiredBottleCapsForNextLevel(buildingData.tier, buildingData.level);

            if (buildingData.amount < this.getRequiredBuildingsForNextLevel(buildingData.level) ||
                !this._removeBottleCaps(capsForNextLevel)
            ) {
                return;
            }

            this._addLevelToBuilding(building);
            this._checkLevelUpButton(building);
            this.gameState.manualPurchase = true;

            $(event.target).closest('.level-up-tooltip').tooltip('hide');
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, (function (event, purchase) {
            this._checkLevelUpButton(purchase.building);
        }).bind(this));
    };

    BuildingLevelController.prototype._addLevelToBuilding = function (building) {
        const newLevel = this.gameState.incBuildingLevel(building),
              button   = $('#level-up-' + building);

        button.closest('fieldset').prop('disabled', true);
        button.text(
            translator.translate('building.levelUp', {__LEVEL__: this.numberFormatter.romanize(newLevel)})
        );
    };

    /**
     * Initialize the level up button for the bottle cap factory.
     *
     * @private
     */
    BuildingLevelController.prototype._initLevelBottleFactoryUp = function () {
        $('#level-up-bottle-cap-factory').on('click touchstart', (function () {
            if (this._getPossibleBottleCapFactoryLevel() > this.state.level &&
                this.gameState.removePlops(this.getCostsForNextBottleCapFactoryLevel())
            ) {
                this._addLevel();
                $('#level-up-bottle-cap-factory').closest('.level-up-bottle-cap-factory-tooltip').tooltip('hide');

                this.gameState.manualPurchase = true;
            }
        }).bind(this));
    };

    /**
     * Add one level to the Bottle Cap Factories
     *
     * @private
     */
    BuildingLevelController.prototype._addLevel = function () {
        this.state.level++;

        $('#level-up-bottle-cap-factory').text(
            translator.translate(
                'building.levelUp',
                {__LEVEL__: this.numberFormatter.romanize(this.state.level)}
            )
        );

        this._checkBottleCapFactoryLevelUpButton();

        this.gameEventBus.emit(EVENTS.CORE.BUILDING.LEVEL_UP, ['bottleCapFactory', this.state.level]);
        this.gameEventBus.emit(
            EVENTS.CORE.BOTTLE_CAP.PRODUCTION_UPDATED,
            ComposedValueRegistry
                .getComposedValue(CV_BOTTLE_CAP)
                .triggerModifierChange('BuildingLevelController__Factory-Level')
                .getValueExcludingModifier(['BuildingLevelController__Factory-Buff'])
        );
    };

    /**
     * Get the highest level the bottle cap factory can reach with the current buildings the player owns
     *
     * @returns {number}
     *
     * @private
     */
    BuildingLevelController.prototype._getPossibleBottleCapFactoryLevel = function () {
        return Math.min(
            Math.floor(this.state.factories / 5) + 1,
            this.gameState.getOwnedBuildingTypesAmount() < this.gameState.getBuildings().length
                ? this.gameState.getOwnedBuildingTypesAmount() - 1
                : Infinity
        );
    };

    /**
     * Get the costs a level up of the bottle cap factory would cause
     *
     * @returns {number}
     */
    BuildingLevelController.prototype.getCostsForNextBottleCapFactoryLevel = function () {
        return 10 * Math.pow(10, this.state.level + 1) * this.bottleCapFactoryLevelReduction;
    };

    /**
     * Check all conditions for the bottle cap factory level up button and enable/disable the button
     *
     * @private
     */
    BuildingLevelController.prototype._checkBottleCapFactoryLevelUpButton = function () {
        const isNextLevelAllowed = this._getPossibleBottleCapFactoryLevel() > this.state.level &&
            this.gameState.getPlops() >= this.getCostsForNextBottleCapFactoryLevel();

        $('#level-up-bottle-cap-factory').closest('fieldset').prop('disabled', !isNextLevelAllowed);

        return isNextLevelAllowed;
    };

    /**
     * Get the current level of the bottle cap factory
     *
     * @returns {number}
     */
    BuildingLevelController.prototype.getCurrentBottleCapFactoryLevel = function () {
        return this.state.level;
    };

    /**
     * Determine the amount of required bottle caps to level up a building
     *
     * @param {number} tier  The tier of the building
     * @param {number} level The current level of the building
     *
     * @return {number}
     */
    BuildingLevelController.prototype.getRequiredBottleCapsForNextLevel = function (tier, level) {
        return 50 * Math.pow(4, tier - 1) * Math.pow(4, level - 1) * Math.pow(3 - (1 / 16 * tier), (level - 1) * 1.2);
    };

    /**
     * Determine the amount of required buildings to level up a building
     *
     * @param {number} level The current level of the building
     *
     * @return {number}
     */
    BuildingLevelController.prototype.getRequiredBuildingsForNextLevel = function (level) {
        switch (level + 1) {
            case 1:  return 0;
            case 2:  return 10;
            case 3:  return 25;
            default: return (level - 2) * 50;
        }
    };

    /**
     * Check the level up button for a building
     *
     * @param {string} building
     *
     * @private
     */
    BuildingLevelController.prototype._checkLevelUpButton = function (building) {
        const buildingData = this.gameState.getBuildingData(building),
              element      = $('#level-up-' + building).closest('fieldset'),
              bottleCaps   = this.getRequiredBottleCapsForNextLevel(buildingData.tier, buildingData.level);

        if (buildingData.amount >= this.getRequiredBuildingsForNextLevel(buildingData.level) &&
            this.state.amount >= bottleCaps
        ) {
            if (this.slotController && this.slotController.isAutoLevelUpEnabled(building)) {
                this.autoLevelUpSemaphore = true;
                this._removeBottleCaps(bottleCaps);
                this._addLevelToBuilding(building);
                this._incAutoLevelUps();

                this.autoLevelUpSemaphore = false;
            } else {
                if (element.prop('disabled')) {
                    element.prop('disabled', false);
                }
            }

            return;
        }

        if (!element.prop('disabled')) {
            element.prop('disabled', true);
        }
    };

    /**
     * Increase the counter for automatic level ups
     *
     * @private
     */
    BuildingLevelController.prototype._incAutoLevelUps = function () {
        this.state.autoLevelUp++;

        const achievementController = new Beerplop.AchievementController();
        achievementController.checkAmountAchievement(
            achievementController.getAchievementStorage().achievements.beerFactory.slots.automation.autoLevelUp.amount,
            this.state.autoLevelUp
        );
    };

    /**
     * Initialize the button to buy a bottle cap factory
     *
     * @private
     */
    BuildingLevelController.prototype._initBuyBottleCapFactory = function () {
        $('#buy-bottle-cap-factory').on('click', (function () {
            let amount, plops;

            // recalculate in case anything changed to have the correct value.
            this.updateCostNext(true);

            if (this.gameState.isBuyChargeOnMaxBuyAmount()) {
                amount = this.cache.maxFactoriesAvailable;
                plops  = this.cache.maxFactoriesCost[amount];
            } else {
                amount = this.gameState.getBuyAmount();
                plops  = this.state.costNext;
            }

            if (this.gameState.removePlops(plops)) {
                this.addFactories(amount, true);
            }
        }).bind(this));
    };

    /**
     * Add the given amount of bottle cap factories. Returns the new amount of factories
     *
     * @param {number}  amount
     * @param {boolean} byUserClick
     *
     * @returns {number|boolean}
     */
    BuildingLevelController.prototype.addFactories = function (amount, byUserClick) {
        if (amount <= 0) {
            return false;
        }

        this.state.factories += amount;

        this.updateCostNext(true);

        this.gameEventBus.emit(
            EVENTS.CORE.BOTTLE_CAP.PURCHASED,
            {
                amount: this.state.factories,
                building: 'bottleCapFactory',
            }
        );

        this.gameEventBus.emit(
            EVENTS.CORE.BOTTLE_CAP.PRODUCTION_UPDATED,
            ComposedValueRegistry
                .getComposedValue(CV_BOTTLE_CAP)
                .triggerModifierChange('BuildingLevelController__Base-Production')
                .getValueExcludingModifier(['BuildingLevelController__Factory-Buff'])
        );

        if (byUserClick) {
            this.gameState.manualPurchase = true;
        }

        return this.state.factories;
    };

    /**
     * Recalculate the costs for the next bottle cap factory
     *
     * @private
     */
    BuildingLevelController.prototype.updateCostNext = function (forceMaxAvailableUpdate = false) {
        if (this.updateSemaphore) {
            return;
        }

        // always keep track of the max available cache for auto buyer
        this.cache.maxFactoriesCost = null;
        this._updateMaxAvailableFactories(forceMaxAvailableUpdate);

        if (!this.gameState.isBuyChargeOnMaxBuyAmount()) {
            this._calculateCostNext();
        }
    };

    BuildingLevelController.prototype._calculateCostNext = function () {
        let costNext = 0;
        for (let counter = 0; counter < this.gameState.getBuyAmount(); counter++) {
            costNext += Math.ceil(this.state.baseCost * Math.pow(1.5, this.state.factories + counter));
        }

        this.state.costNext = costNext * this._getExternalFactoryReductionMultiplier();

        $('.cost-next-bottle-cap-factory').text(this.numberFormatter.format(this.state.costNext));

        return this.state.costNext;
    };

    /**
     * Calculate a multiplier which defines the reduction for purchasing new Bottle Cap Factories
     *
     * @returns {number}
     *
     * @private
     */
    BuildingLevelController.prototype._getExternalFactoryReductionMultiplier = function () {
        return this.bottleCapFactoryReduction
            * this.buffFottleCapFactoryReduction
            * this.gameState.beerwarts.getBuildingReduction('bottleCapFactory');
    };

    BuildingLevelController.prototype._updateMaxAvailableFactories = function (forceMaxAvailableUpdate = false) {
        // prefill the cache
        if (!this.cache.maxFactoriesCost) {
            this._calculateMaxBottleCapFactoriesCostCache();
            this.cache.maxFactoriesAvailable = 0;
        }

        let availableAmount = 0;

        // check how many cache entries are required
        while (true) {
            let currentLength = this.cache.maxFactoriesCost.length - 1;
            if (this.cache.maxFactoriesCost[currentLength] < this.gameState.getPlops()) {
                this._calculateMaxBottleCapFactoriesCostCache();
                availableAmount = currentLength;
                continue;
            }
            break;
        }

        // Get close to the cache entry which is currently available
        availableAmount = this._getMaxAvailableFactoriesFromCache(availableAmount, 25);
        // walk through the latest cache block to find the amount
        availableAmount = this._getMaxAvailableFactoriesFromCache(availableAmount, 1);

        if (this.slotController.isAutoBuyerEnabled('bottleCapFactory')
            && availableAmount > 0
            && !this.autoBuildSemaphore
        ) {
            this.autoBuildSemaphore = true;

            if (this.gameState.removePlops(this.cache.maxFactoriesCost[availableAmount])) {
                this.addFactories(availableAmount, false);
                this.gameState.addAutoBuyerBuildings(availableAmount);

                $('#special-building-bottle-cap-factory').find('.fieldset-buy').prop('disabled', true);
                $('#available-bottle-cap-factories').text(
                    '0 (' + translator.translate('plopValue', {__PLOPS__: 0}) + ')'
                );

                this.autoBuildSemaphore = false;

                return 0;
            }

            this.autoBuildSemaphore = false;
        }

        if (forceMaxAvailableUpdate || availableAmount !== this.cache.maxFactoriesAvailable) {
            if (this.cache.maxFactoriesAvailable === 0 && availableAmount > 0) {
                $('#special-building-bottle-cap-factory').find('.fieldset-buy').prop('disabled', false);
            }
            if (this.cache.maxFactoriesAvailable > 0 && availableAmount === 0) {
                $('#special-building-bottle-cap-factory').find('.fieldset-buy').prop('disabled', true);
            }

            $('#available-bottle-cap-factories').text(
                this.numberFormatter.formatInt(availableAmount) + ' (' +
                this.numberFormatter.format(this.cache.maxFactoriesCost[availableAmount]) + ' plops)'
            );
            this.cache.maxFactoriesAvailable = availableAmount;
        }

        return availableAmount;
    };

    BuildingLevelController.prototype._getMaxAvailableFactoriesFromCache = function (start, step) {
        for (start; start < this.cache.maxFactoriesCost.length; start += step) {
            if (!this.cache.maxFactoriesCost[start + step] ||
                this.cache.maxFactoriesCost[start + step] > this.gameState.getPlops()
            ) {
                break;
            }
        }

        return start;
    };

    /**
     * Calculate the next 100 entries of the max available factories cache
     *
     * @private
     */
    BuildingLevelController.prototype._calculateMaxBottleCapFactoriesCostCache = function () {
        if (!this.cache.maxFactoriesCost) {
            this.cache.maxFactoriesCost = [0];
        }

        const length         = this.cache.maxFactoriesCost.length,
              costMultiplier = this._getExternalFactoryReductionMultiplier();

        let costsOfFactoriesBefore = this.cache.maxFactoriesCost[length - 1];

        for (let i = 0; i < 100; i++) {
            this.cache.maxFactoriesCost[length + i] = (costsOfFactoriesBefore += Math.ceil(
                this.state.baseCost *
                Math.pow(1.5, this.state.factories + length + i - 1)
            ) * costMultiplier);
        }
    };

    /**
     * Update the view for the bottle cap factory with the values from the internal data store
     *
     * @private
     */
    BuildingLevelController.prototype.updateBottleCapFactoryView = function () {
        if (this.updateSemaphore) {
            return;
        }

        $('.cost-next-bottle-cap-factory').text(this.numberFormatter.format(this.state.costNext));
        $('.bottle-cap-factories').text(this.numberFormatter.formatInt(this.state.factories));
        $('.bottle-caps-per-second').text(
            this.numberFormatter.format(ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).getValue())
        );
    };

    /**
     * Remove bottle caps. Returns true on success, false on error (not enough plops available)
     *
     * @param {number} bottleCaps
     *
     * @return {boolean}
     *
     * @private
     */
    BuildingLevelController.prototype._removeBottleCaps = function (bottleCaps) {
        if (bottleCaps > this.state.amount) {
            return false;
        }

        this._updateBottleCapsAmount(this.state.amount - bottleCaps);
        return true;
    };

    /**
     * Add bottle caps
     *
     * @param {number} bottleCaps
     *
     * @return {number}
     */
    BuildingLevelController.prototype.addBottleCaps = function (bottleCaps) {
        this._updateBottleCapsAmount(this.state.amount + bottleCaps);

        this.state.totalProduction += bottleCaps;

        if (!isFinite(this.state.totalProduction)) {
            this.state.totalProduction = Number.MAX_VALUE;
        }

        $('#bottle-caps-amount-total').text(this.numberFormatter.format(this.state.totalProduction));

        return this.state.amount;
    };

    /**
     * Update the amount of available bottle caps
     *
     * @param {Number} amount
     *
     * @private
     */
    BuildingLevelController.prototype._updateBottleCapsAmount = function (amount) {
        this.state.amount = amount;

        if (!isFinite(this.state.amount)) {
            this.state.amount = Number.MAX_VALUE;
        }

        $('#panel-bottle-cap-factory').find('.bottle-caps-amount').text(this.numberFormatter.format(amount));

        this._checkLevelUpButtons();
    };

    /**
     * Check all level up buttons
     *
     * @private
     */
    BuildingLevelController.prototype._checkLevelUpButtons = function () {
        if (this.autoLevelUpSemaphore) {
            return;
        }

        $.each(this.gameState.getBuildings(), (function (index, building) {
            this._checkLevelUpButton(building);
        }).bind(this));
    };

    /**
     * Get the amount of available bottle caps
     *
     * @returns {number}
     */
    BuildingLevelController.prototype.getBottleCaps = function () {
        return this.state.amount;
    };

    /**
     * Get the total amount of produced bottle caps
     *
     * @returns {number}
     */
    BuildingLevelController.prototype.getTotalBottleCaps = function () {
        return this.state.totalProduction;
    };

    /**
     * Add an upgrade multiplier to the bottle cap production
     *
     * @param {number} percentage
     */
    BuildingLevelController.prototype.addBottleCapProductionMultiplier = function (percentage) {
        this.bottleCapProductionMultiplier *= 1 + percentage;

        this.gameEventBus.emit(
            EVENTS.CORE.BOTTLE_CAP.PRODUCTION_UPDATED,
            ComposedValueRegistry
                .getComposedValue(CV_BOTTLE_CAP)
                .triggerModifierChange('BuildingLevelController__Production-Multiplier')
                .getValueExcludingModifier(['BuildingLevelController__Factory-Buff'])
        );
    };

    /**
     * Add a reduction for bottle cap factories
     *
     * @param {number} percentage
     */
    BuildingLevelController.prototype.addBottleCapFactoryReduction = function (percentage) {
        this.bottleCapFactoryReduction *= 1 - percentage;

        this.updateCostNext();
    };

    BuildingLevelController.prototype.addBuffBottleCapFactoryReduction = function (reduction) {
        this.buffFottleCapFactoryReduction *= 1 - reduction;

        this.updateCostNext();
    };

    BuildingLevelController.prototype.removeBuffBottleCapFactoryReduction = function (reduction) {
        this.buffFottleCapFactoryReduction /= 1 - reduction;

        this.updateCostNext();
    };

    /**
     * Add a reduction for level up bottle cap factories
     *
     * @param percentage
     */
    BuildingLevelController.prototype.addBottleCapFactoryLevelReduction = function (percentage) {
        this.bottleCapFactoryLevelReduction *= 1 - percentage;
    };

    BuildingLevelController.prototype.getBottleCapFactoriesAmount = function () {
        return this.state.factories;
    };

    BuildingLevelController.prototype.addBuffBottleCapProductionMultiplier = function (multiplier) {
        this.buffBottleCapProductionMultiplier += multiplier;

        ComposedValueRegistry
            .getComposedValue(CV_BOTTLE_CAP)
            .triggerModifierChange('BuildingLevelController__Factory-Buff');
    };

    BuildingLevelController.prototype.removeBuffBottleCapProductionMultiplier = function (multiplier) {
        this.buffBottleCapProductionMultiplier -= multiplier;

        ComposedValueRegistry
            .getComposedValue(CV_BOTTLE_CAP)
            .triggerModifierChange('BuildingLevelController__Factory-Buff');
    };

    /**
     * Interpolate the bottle caps generated during an abstinence
     *
     * @param duration   The duration in seconds
     * @param percentage The production percentage
     */
    BuildingLevelController.prototype.interpolateGameBreakBottleCaps = function (duration, percentage) {
        if (!this.interpolateBottleCapFactories) {
            return;
        }

        this.addBottleCaps(ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).getValue() * duration * percentage);
    };

    /**
     * Enable the interpolation of bottle caps
     */
    BuildingLevelController.prototype.enableBottleCapInterpolation = function () {
        this.interpolateBottleCapFactories = true;
    };

    BuildingLevelController.prototype.setSlotController = function (slotController) {
        this.slotController = slotController;
        return this;
    };

    beerplop.BuildingLevelController = BuildingLevelController;
})(Beerplop);

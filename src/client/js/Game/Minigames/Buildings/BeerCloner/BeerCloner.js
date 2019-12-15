(function(buildingMinigames) {
    'use strict';

    const MIN_BEERCLONER_CLONING = 150;

    BeerCloner.prototype._instance = null;

    BeerCloner.prototype.gameState             = null;
    BeerCloner.prototype.gameEventBus          = null;
    BeerCloner.prototype.achievementController = null;
    BeerCloner.prototype.numberFormatter       = null;
    BeerCloner.prototype.researchProject       = null;

    BeerCloner.prototype.cloningEnabled        = false;
    BeerCloner.prototype.forceUpdateMultiplier = false;
    BeerCloner.prototype.cloningCooldown       = 4;
    BeerCloner.prototype.autoCloningUnlocked   = false;
    BeerCloner.prototype.autoCloneSemaphore    = false;

    BeerCloner.prototype.initialState = null;

    BeerCloner.prototype.state = {
        // the clonings of buildings
        cloning: {},
        // store the auto cloning priority for each building
        priority: {},
        // the time of the last clone for cooldown
        lastCloning: null,
        // the total amount of clones (all time)
        clones: 0,
        // the total amount of automatic clones (all time)
        autoClones: 0,
        // is it allowed to clone Beer Cloners?
        clonerCloning: false,
        enabled: false,
        autoCloning: false,
    };

    BeerCloner.prototype.cache = {
        buildingBoost: {},
    };

    function BeerCloner (gameState, gameEventBus, achievementController, researchProject) {
        if (BeerCloner.prototype._instance) {
            return BeerCloner.prototype._instance;
        }

        this.gameState             = gameState;
        this.gameEventBus          = gameEventBus;
        this.achievementController = achievementController;
        this.researchProject       = researchProject;
        this.numberFormatter       = new Beerplop.NumberFormatter();

        this.initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'BMG_BeerCloner',
            (function getBeerClonerData() {
                return this.state;
            }.bind(this)),
            (function setBeerClonerData(loadedData) {
                this.state = $.extend(true, {}, this.initialState, loadedData);

                // convert the timestamps to Date objects
                $.each(this.state.cloning, (function (building, clonings) {
                    $.each(clonings, (function (index, cloningActiveSince) {
                        this.state.cloning[building][index] = new Date(cloningActiveSince);
                    }).bind(this));
                }).bind(this));
                this.state.lastCloning = new Date(this.state.lastCloning);

                this._updateBuildingBoostCache();
            }.bind(this))
        );

        $('#special-building-bottle-cap-factory, #buildings-container')
            .find('.building-container__clone-building')
            .on('click', (function (event) {
                const building = $(event.target).closest('.building-container__clone-building').data('buildingKey');

                if (!building) {
                    return;
                }

                this._toggleBuildingCloningButtons();
                $('#beer-cloner__building-cloning__cancel-clone').addClass('d-none');

                this.addCloning(building);
            }).bind(this));

        ComposedValueRegistry
            .getComposedValue(CV_BOTTLE_CAP)
            .addModifier('Cloning', () => this.getBuildingBoostByCloning('bottleCapFactory'), false);

        BeerCloner.prototype._instance = this;
    }

    BeerCloner.prototype.unlock = function () {
        window.setTimeout(() => this._enableCloning(), 0);

        this.gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, (function buildingBoughtBeerCloner(event, purchase) {
            if (purchase.building === 'beerCloner') {
                this._enableCloning();
                this._updateCloningAvailability();
            }

            // a new cloning stage may be unlocked by purchasing buildings
            this._checkAutoCloning();
        }).bind(this));

        // reset cloning when sacrificing
        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function sacrificeBeerCloner() {
            this.cloningEnabled      = false;
            this.cloningCooldown     = 4;

            this.state.enabled       = false;
            this.state.cloning       = {};
            this.state.lastCloning   = null;

            this.cache.buildingBoost = {};

            const cancelCloning = $('#beer-cloner__building-cloning__cancel-clone');
            if (!cancelCloning.hasClass('d-none')) {
                cancelCloning.trigger('click');
            }
            $('#beer-cloner__building-cloning__clone').closest('fieldset').prop('disabled', true);
            $('#beer-cloner__building-cloning__cooldown-container').addClass('d-none');
            $('#buildings-container').find('.beer-cloner__building-cloning__container').remove();
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.ITERATION_LONG, (function coreIterationLongBeerClonerEventListener() {
            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.buildingMG.beerCloner.boost,
                Math.floor(Math.max(...Object.values(this.cache.buildingBoost)))
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function coreIterationBeerClonerEventListener() {
            if (!this.cloningEnabled && !this.forceUpdateMultiplier) {
                return;
            }

            this._updateBuildingBoostCache();
            this.gameState.recalculateAutoPlopsPerSecond();

            if (!this.state.lastCloning) {
                return;
            }

            const timeSinceLastCloning = new Date() - this.state.lastCloning;

            // TODO: only update if beer cloner extension is visible after implementing accordion
            $('#beer-cloner__building-cloning__cooldown').text(
                this.numberFormatter.formatTimeSpan(
                    this.getCloningCooldown() * (1000 * 60 * 60) - timeSinceLastCloning,
                    true
                )
            );

            if (timeSinceLastCloning  / (1000 * 60 * 60) >= this.getCloningCooldown()) {
                this.state.lastCloning = null;

                if (this._checkAutoCloning()) {
                    // if an automatic cloning was executed don't enable manual cloning
                    return;
                }

                $('#beer-cloner__building-cloning__clone').closest('fieldset').prop('disabled', false);
                $('#beer-cloner__building-cloning__cooldown-container').addClass('d-none');

                $('#building-container-beerCloner')
                    .closest('.building-container')
                    .find('.toggle-minigame')
                    .addClass('minigame-cta');

                (new Beerplop.Notification()).notify({
                    content: translator.translate('beerCloner.cloning.notifyAvailable'),
                    style:   'snackbar-info',
                    timeout: 5000,
                    channel: 'buildingMinigame',
                });

                this.gameEventBus.emit(EVENTS.CLONING.AVAILABLE);
            }
        }).bind(this));
    };

    BeerCloner.prototype._enableCloning = function () {
        if (this.cloningEnabled ||
            (this._getBuildingAmount('beerCloner') < MIN_BEERCLONER_CLONING) && !this.state.enabled
        ) {
            return;
        }

        this.cloningEnabled = true;
        this.state.enabled  = true;

        this.achievementController.checkAchievement(
            this.achievementController.getAchievementStorage().achievements.buildingMG.beerCloner.enabled
        );

        const container = $('#building-container-beerCloner').parent();
        container.append(
            Mustache.render(
                TemplateStorage.get('beer-cloner__building-cloning-template'),
                {
                    autoCloningUnlocked: this.autoCloningUnlocked,
                    autoCloningEnabled:  this.state.autoCloning,
                }
            )
        );

        const toggle = container.find('.toggle-minigame');

        if (!this.state.lastCloning) {
            toggle.addClass('minigame-cta');
            this.gameEventBus.emit(EVENTS.CLONING.AVAILABLE);
        }

        toggle.removeClass('d-none');

        const cloneButton = $('#beer-cloner__building-cloning__clone');
        if ((new Date() - this.state.lastCloning) / (1000 * 60 * 60) < this.getCloningCooldown()) {
            $('#beer-cloner__building-cloning__cooldown-container').removeClass('d-none');
        } else {
            cloneButton.closest('fieldset').prop('disabled', false);
        }

        cloneButton.on('click', (function () {
            $('#beer-cloner__building-cloning__cancel-clone').removeClass('d-none');
            $('#beer-cloner__building-cloning__clone').closest('fieldset').prop('disabled', true);

            this._updateCloningAvailability();
            this._toggleBuildingCloningButtons();
        }).bind(this));

        $('#beer-cloner__building-cloning__cancel-clone').on('click', (function () {
            $('#beer-cloner__building-cloning__cancel-clone').addClass('d-none');
            $('#beer-cloner__building-cloning__clone').closest('fieldset').prop('disabled', false);
            this._toggleBuildingCloningButtons();
        }).bind(this));

        $('#beer-cloner__building-cloning__toggle-auto-cloning').on(
            'change',
            event => {
                this.state.autoCloning = $(event.target).is(':checked');
                this._checkAutoCloning();
            }
        );

        const beerCloner = this;
        $('.building-container__clone-tooltip').tooltip({
            title: function () {
                const building          = $(this).find('.building-container__clone-building').data('buildingKey'),
                      requiredBuildings = beerCloner.getRequiredBuildingsForCloning(building),
                      requiredCloners   = beerCloner.getRequiredClonersForCloning(building);

                return Mustache.render(
                    TemplateStorage.get('building-clone-tooltip-template'),
                    {
                        buildings:        beerCloner.numberFormatter.formatInt(requiredBuildings),
                        buildingsReached: requiredBuildings <= beerCloner._getBuildingAmount(building),
                        cloners:          beerCloner.numberFormatter.formatInt(requiredCloners),
                        clonersReached:   requiredCloners <= beerCloner._getBuildingAmount('beerCloner'),
                    }
                );
            }
        });

        this._checkAutoCloning();
    };

    /**
     * Check if cloning automation is enabled.
     * If it's enabled check for adding a cloning to the highest prioritised building.
     *
     * @return {boolean} Returns true if a building was cloned automatically, false if no building was cloned
     *
     * @private
     */
    BeerCloner.prototype._checkAutoCloning = function () {
        if (!this.cloningEnabled ||
            !this.autoCloningUnlocked ||
            !this.state.autoCloning ||
            this.state.lastCloning ||
            this.autoCloneSemaphore
        ) {
            return false;
        }

        this.autoCloneSemaphore = true;

        const defaultPriority = {};
        this.gameState.getBuildings().forEach(building => defaultPriority[building] = 1);

        let cloned = false;

        // combine the default priorities with the configured priorities.
        Object.entries(Object.assign(defaultPriority, this.state.priority))
            // filter out disabled auto cloning buildings
            .filter(priority => priority[1] > 0)
            // the highest priority shall be checked first
            .sort((a, b) => a[1] < b[1] ? 1 : -1)
            // try to find a building to auto clone
            .some(priority => {
                let [building] = priority;

                if (!cloned
                    && this._checkBuildingAmountRequirementsForCloning(building)
                    && this.addCloning(building, false, true)
                ) {
                    const cancelCloneButton = $('#beer-cloner__building-cloning__cancel-clone');
                    if (!cancelCloneButton.hasClass('d-none')) {
                        this._toggleBuildingCloningButtons();
                        cancelCloneButton.addClass('d-none');
                    }
                    $('#beer-cloner__building-cloning__clone').closest('fieldset').prop('disabled', true);

                    this.achievementController.checkAmountAchievement(
                        this.achievementController.getAchievementStorage()
                            .achievements
                            .buildingMG
                            .beerCloner
                            .autoClonings,
                        ++this.state.autoClones
                    );

                    (new Beerplop.Notification()).notify({
                        content: translator.translate(
                            'beerCloner.cloning.notifyAutoClone',
                            {
                                __BUILDING__: translator.translate(`building.${building}.plural`),
                            }
                        ),
                        style:   'snackbar-info',
                        timeout: 5000,
                        channel: 'buildingMinigame',
                    });

                    cloned = true;

                    return true;
                }

                return false;
            });

        this.autoCloneSemaphore = false;

        return cloned;
    };

    /**
     * Update the cloning buttons on each building
     *
     * @private
     */
    BeerCloner.prototype._updateCloningAvailability = function () {
        $.each(
            $('#special-building-bottle-cap-factory, #buildings-container').find('.building-container__clone-building'),
            (function (index, button) {
                button = $(button);

                const building = button.data('buildingKey');

                button.closest('fieldset').prop('disabled', !this._checkBuildingAmountRequirementsForCloning(building));
                button.find('.clone-level').text(this.isBuildingCloned(building)
                    ? `(${this.numberFormatter.romanize(this.state.cloning[building].length)})`
                    : ''
                );
            }).bind(this)
        );
    };

    /**
     * Check if a cloning is available for the given building
     *
     * @param {string} building
     *
     * @return {boolean}
     *
     * @private
     */
    BeerCloner.prototype._checkBuildingAmountRequirementsForCloning = function (building) {
        return this.getRequiredBuildingsForCloning(building) <= this._getBuildingAmount(building) &&
            this.getRequiredClonersForCloning(building) <= this._getBuildingAmount('beerCloner')
    };

    BeerCloner.prototype._getBuildingAmount = function (building) {
        return building === 'bottleCapFactory'
            ? this.gameState.buildingLevelController.getBottleCapFactoriesAmount()
            : this.gameState.getBuildingData(building).amount;
    };

    /**
     * Toggle the visibility of the cloning buttons
     *
     * @private
     */
    BeerCloner.prototype._toggleBuildingCloningButtons = function () {
        $('#special-building-bottle-cap-factory, .building-container' + (this.state.clonerCloning ? '' : '[data-building-key!="beerCloner"]'))
            .find('.building-container__cloning-container').toggleClass('d-none');
    };

    /**
     * Add a cloning to a building
     *
     * @param {string}  building    The key of the building to clone
     * @param {boolean} addForFree  If set to true the cloning will neither remove Beer Cloner nor set a cloning cooldown
     * @param {boolean} autoCloning The cloning was executed automatically
     *
     * @returns {boolean}
     */
    BeerCloner.prototype.addCloning = function (building, addForFree = false, autoCloning = false) {
        // if the building is not added for free remove cloner
        if (!addForFree && (
                !this._isCloningAvailable() ||
                this.gameState.removeBuildings('beerCloner', this.getRequiredClonersForCloning(building)) === false
            )
        ) {
            return false;
        }

        if (!this.state.cloning[building]) {
            this.state.cloning[building] = [];
        }

        this.state.cloning[building].push(new Date());
        this.state.clones++;

        if (!addForFree) {
            this.state.lastCloning = new Date();

            $('#beer-cloner__building-cloning__cooldown').text(
                this.numberFormatter.formatTimeSpan(this.getCloningCooldown() * 1000 * 60 * 60, true)
            );
            $('#beer-cloner__building-cloning__cooldown-container').removeClass('d-none');
            $('#building-container-beerCloner')
                .closest('.building-container')
                .find('.toggle-minigame')
                .removeClass('minigame-cta');
        }

        this.cache.buildingBoost[building] = 0;
        // force recalculation so the negative auto plop effect of the cloning is adopted
        this.gameState.recalculateAutoPlopsPerSecond();

        // must be the same size as the available buildings due to Bottle Cap Factory cloning
        if (Object.keys(this.state.cloning).length >= this.gameState.getBuildings().length) {
            this.state.clonerCloning = true;

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.buildingMG.beerCloner.clonerCloning
            );
        }

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.buildingMG.beerCloner.clonings,
            this.state.clones
        );
        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.buildingMG.beerCloner.buildingLevel,
            this.state.cloning[building].length
        );

        this.gameEventBus.emit(
            EVENTS.CLONING.CLONED,
            {
                building:     building,
                cloningLevel: this.state.cloning[building].length,
                autoCloning:  autoCloning,
            }
        );

        return true;
    };

    BeerCloner.prototype.getRequiredBuildingsForCloning = function (building) {
        return ((this.state.cloning[building] ? this.state.cloning[building].length : 0) + 1)
            * (building === 'bottleCapFactory' ? 100 : 250);
    };

    BeerCloner.prototype.getRequiredClonersForCloning = function (building) {
        return ((this.state.cloning[building] ? this.state.cloning[building].length : 0) + 1) * 50;
    };

    BeerCloner.prototype.getPercentageDetails = function (building) {
        let i          = 0,
            now        = new Date(),
            percentage = this.numberFormatter.formatFraction(this.getBuildingBoostByCloning(building) * 100, 3) + '%';

        return (this.isBuildingCloned(building) && this.state.cloning[building].length > 1)
            ? `${percentage} (${this.state.cloning[building].map(
                    since => this.numberFormatter.formatFraction(this._getMultiplier(now, i++, since) * 100, 3) + '%'
                ).join(', ')})`
            : percentage;
    };

    /**
     * Calculate the multiplier a cloning effects the requested building
     *
     * @param {string} building
     *
     * @returns {number}
     */
    BeerCloner.prototype.getBuildingBoostByCloning = function (building) {
        return typeof this.cache.buildingBoost[building] !== 'undefined' ? this.cache.buildingBoost[building] : 1;
    };

    /**
     * Check if a building is cloned
     *
     * @param {string} building
     *
     * @returns {boolean}
     */
    BeerCloner.prototype.isBuildingCloned = function (building) {
        return typeof this.state.cloning[building] !== 'undefined';
    };

    /**
     * Update the internal cache which holds the boost for buildings by clonings
     *
     * @private
     */
    BeerCloner.prototype._updateBuildingBoostCache = function () {
        const now = new Date();

        $.each(this.state.cloning, (function (building, clonings) {
            let multiplier = 1;

            $.each(clonings, (function (index, cloningActiveSince) {
                multiplier *= this._getMultiplier(now, index, cloningActiveSince);
            }).bind(this));

            this.cache.buildingBoost[building] = multiplier;
        }).bind(this));
    };

    BeerCloner.prototype._isCloningAvailable = function () {
        return !this.state.lastCloning ||
            (new Date() - this.state.lastCloning) / (1000 * 60 * 60) >= this.getCloningCooldown();
    };

    BeerCloner.prototype.getCloningCooldown = function () {
        return this.cloningCooldown / this.gameState.getGameSpeed();
    };

    /**
     * The multiplier calculates from the square root of the days the cloning is active. A higher leveled
     * cloning takes a longer time to raise the boost. (first level 2 days, second level 4 days etc.)
     *
     * @param now
     * @param index
     * @param cloningActiveSince
     *
     * @returns {number}
     *
     * @private
     */
    BeerCloner.prototype._getMultiplier = function (now, index, cloningActiveSince) {
        const activeSince = (now - cloningActiveSince) / (1000 * 60 * 60 * 24 / this.gameState.getGameSpeed());

        return Math.sqrt(Math.sqrt(activeSince / (index * 1 + 1)))
            * Math.pow(1.1, this.researchProject.getStage('clonedike'))
            * Math.tanh(activeSince);
    };

    BeerCloner.prototype.decrementCloningCooldown = function () {
        this.cloningCooldown--;
    };

    BeerCloner.prototype.unlockAutoCloning = function () {
        this.autoCloningUnlocked = true;
        return this;
    };

    BeerCloner.prototype.isAutoCloningUnlocked = function () {
        return this.autoCloningUnlocked;
    };

    BeerCloner.prototype.getAutoCloningPriority = function (building) {
        return typeof this.state.priority[building] !== 'undefined' ? this.state.priority[building] : 1;
    };

    BeerCloner.prototype.setAutoCloningPriority = function (building, priority) {
        if (priority === 1) {
            delete this.state.priority[building];
            return this;
        }

        this.state.priority[building] = priority;

        return this;
    };

    buildingMinigames.BeerCloner = BeerCloner;
})(BuildingMinigames);

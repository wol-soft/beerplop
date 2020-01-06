(function(beerFactoryGame) {
    'use strict';

    State.prototype.state = {
        hasFactoryExtensions: false,
        deliveryPreferQueue: false,
        hideCompletedMaterials: false,
        materials: {
            wood: {
                amount: 0,
                total: 0,
            },
            strongWood: {
                amount: 0,
                total: 0,
            },
            woodenBeam: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            charcoal: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            stone: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            granite: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            marble: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            iron: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            copper: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            tools: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            gold: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            diamond: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            medallion: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            basePlate: {
                enabled: false,
                amount: 0,
                total: 0,
            },
            knowledge: {
                amount: 0,
                total: 0,
            }
        },
        factories: {
            wood: {
                enabled: true,
                factory: false,
                amount: 0,
                production: {
                    wood: 6,
                    strongWood: 1,
                },
                upgrades: {
                    double: 0,
                    diversify: 0,
                },
                extensions: [],
            },
            storage: {
                enabled: false,
                amount: 0,
                production: false,
                upgrades: {
                    double: 0,
                    diversify: 0,
                },
                extensions: [],
            },
            transport: {
                enabled: false,
                amount: 0,
                production: false,
                upgrades: {
                    double: 0,
                    diversify: 0,
                },
            },
            stone: {
                enabled: false,
                amount: 0,
                production: {
                    stone: 1
                },
                upgrades: {
                    double: 0,
                    diversify: 0,
                },
                extensions: [],
            },
            iron: {
                enabled: false,
                amount: 0,
                production: {
                    iron: 1
                },
                upgrades: {
                    double: 0,
                    diversify: 0,
                },
                extensions: [],
            },
            lodge: {
                enabled: false,
                amount: 0,
                production: false,
                upgrades: {
                    capacity: 0,
                    comfort: 0,
                },
                productionMultiplier: 1.1,
                extensions: [],
            },
            mine: {
                enabled: false,
                amount: 0,
                production: {
                    gold: 1
                },
                upgrades: {
                    double: 0,
                    diversify: 0,
                },
                extensions: [],
            },
            queue: {
                enabled: false,
                production: false,
                amount: 1,
                upgrades: {
                    parallelization: 0,
                    capacity: 0,
                },
            },
            academy: {
                enabled: false,
                amount: 0,
                production: {
                    knowledge: 1,
                },
                upgrades: {
                    double: 0,
                    explore: 0,
                },
            },
            builder: {
                enabled: false,
                production: false,
                amount: 0,
                upgrades: {
                    double: 0,
                    diversify: 0,
                },
            },
            tradingPost: {
                enabled: false,
                production: false,
                amount: 0,
                upgrades: {
                    double: 0,
                    routes: 0,
                },
            },
            engineer: {
                enabled: false,
                production: false,
                amount: 1,
                upgrades: {
                    construction: 0,
                    calculation: 0,
                },
            },
            backRoom: {
                enabled: false,
                production: false,
                amount: 0,
                upgrades: {
                    lobbyist: 0,
                    influence: 0,
                },
                lobbyists: [],
            },
        },
        equippedBuildings: {},
        buildQueue: [],
        totalQueuedJobs: 0,
        buildQueueHistory: [],
        /**
         * Contains the storage for a factory extension. Schema of a single extensionStorage entry:
         * {
         *     stored: int           // stores the amount of stored items
         *     materials: array [    // list of stored materials
         *         materialKey: materialAmount
         *         ...
         *     ],
         *     paused: bool [optional] // stores if the production of the extension is paused
         *     boost: int [optional] // stores a boost for the extension
         * }
         */
        extensionStorage: {},
        extensionStorageCapacity: 100,
        extensionTransportDividend: 10,
        // store mapping for proxied extensions
        proxyExtension: {},
        maxSameActionsInQueue: 2,
        maxActionsInQueue: 5,
        // the global settings to en/disable buy automation
        autoBuyerDisabled: false,
        autoLevelUpDisabled: false,
        autoUpgradeDisabled: false,
    };

    State.prototype.gameState        = null;
    State.prototype.gameEventBus     = null;
    State.prototype.uniqueBuild      = null;
    State.prototype.render           = null;
    State.prototype.beerFactoryCache = null;

    State.prototype.initialState = null;

    State.prototype.cache = {
        uniqueBuildMultiplier: 1,
    };

    function State(gameState, gameEventBus) {
        this.gameState    = gameState;
        this.gameEventBus = gameEventBus;

        this.initialState = $.extend(true, {}, this.state);

        this.gameEventBus.on('finish-load-savestate beer-factory__unique-build__update', (function () {
            this.cache.uniqueBuildMultiplier = this.uniqueBuild.getMultiplier('was');

            this.beerFactoryCache.resetCache();

            this.render.renderOverlay();
        }).bind(this));
    }

    /**
     * Initialize the extension storage for a given extension
     *
     * @param {string} extension
     * @param {string} proxiedExtension
     *
     * @private
     */
    State.prototype.initExtensionStorage = function (extension, proxiedExtension) {
        this.state.extensionStorage[extension] = {
            stored: 0,
            materials: {},
            produced: {},
        };

        $.each(EXTENSIONS[proxiedExtension].consumes, (function (material) {
            this.state.extensionStorage[extension].materials[material] = 0;
        }).bind(this));

        $.each(EXTENSIONS[proxiedExtension].produces, (function (material) {
            this.state.extensionStorage[extension].produced[material] = 0;
        }).bind(this));
    };

    State.prototype.getState = function () {
        return this.state;
    };

    State.prototype.extendState = function (loadedState) {
        this.state = $.extend(true, {}, this.initialState, loadedState);

        $.each(this.state.buildQueue, function (id, item) {
            item.startedAt = new Date(item.startedAt);
        });

        this.checkAdvancedBuyControlEnable();
    };

    /**
     * Update the advanced buy control UI. UI must be visible if either slots are equipped with auto buyer or
     * auto level up or the user has unlocked auto upgrades.
     */
    State.prototype.checkAdvancedBuyControlEnable = function () {
        let hasAutoBuyer   = false,
            hasAutoLevelUp = false,
            hasAutoUpgrade = this.getFactory('academy').upgrades.explore >= 9;

        $.each(this.state.equippedBuildings, function (index, building) {
            $.each(building.slots, function (index, slot) {
                if (!slot) {
                    return;
                }

                switch (slot.equip) {
                    case EQUIPMENT_ITEM__DIASTATIC:
                        hasAutoBuyer = true;
                        break;
                    case EQUIPMENT_ITEM__AMYLASE:
                        hasAutoLevelUp = true;
                        break;
                }
            });
        });

        $('.buy-control__advanced--auto-buyer').toggleClass('d-none', !hasAutoBuyer);
        $('.buy-control__advanced--auto-level-up').toggleClass('d-none', !hasAutoLevelUp);
        $('.buy-control__advanced--auto-upgrade').toggleClass('d-none', !hasAutoUpgrade);
        $('#buy-control__advanced-control-toggle').toggleClass(
            'd-none',
            !hasAutoBuyer && !hasAutoLevelUp && !hasAutoUpgrade
        );

        this._enableAdvancedBuyControlEventListener(
            '#buy-advanced__toggle-auto-buyer',
            'autoBuyerDisabled',
            EVENTS.BEER_FACTORY.AUTO_BUYER,
        );

        this._enableAdvancedBuyControlEventListener(
            '#buy-advanced__toggle-auto-level-up',
            'autoLevelUpDisabled',
            EVENTS.BEER_FACTORY.AUTO_LEVEL_UP,
        );

        this._enableAdvancedBuyControlEventListener(
            '#buy-advanced__toggle-auto-upgrade',
            'autoUpgradeDisabled',
            EVENTS.BEER_FACTORY.AUTO_UPGRADE,
        );
    };

    /**
     * Add event listener to an advanced buy control input element
     *
     * @param {string} id    The ID of the input element
     * @param {string} field The field inside the state holding the current state of the input element
     * @param {string} event Event to trigger on a value change
     *
     * @private
     */
    State.prototype._enableAdvancedBuyControlEventListener = function (id, field, event) {
        const advancedBuyElement = $(id);

        advancedBuyElement.off('change');
        advancedBuyElement.on('change', (function () {
            this.state[field] = !this.state[field];
            this.gameEventBus.emit(
                event,
                {
                    building: 'global',
                    enabled:  !this.state[field]
                }
            );
        }).bind(this));

        if (this.state[field]) {
            advancedBuyElement.prop('checked', true);
        }
    };

    State.prototype.isAutoUpgradingEnabled = function () {
        return this.getFactory('academy').upgrades.explore >= 9 && !this.state.autoUpgradeDisabled;
    };

    State.prototype.getBuildQueue = function () {
        return this.getState().buildQueue;
    };

    State.prototype.getBuildQueueItem = function (index) {
        return this.getState().buildQueue[index];
    };

    State.prototype.setBuildQueue = function (buildQueue) {
        this.state.buildQueue = buildQueue;
    };

    State.prototype.getFactories = function () {
        return this.getState().factories;
    };

    State.prototype.getFactory = function (factory) {
        return this.getFactories()[factory];
    };

    State.prototype.getMaterials = function () {
        return this.getState().materials;
    };

    State.prototype.getMaterial = function (material) {
        return this.getState().materials[material];
    };

    State.prototype.getExtensionStorage = function (extension) {
        return this.getState().extensionStorage[extension];
    };

    State.prototype.setUniqueBuild = function (uniqueBuild) {
        this.uniqueBuild = uniqueBuild;
        return this;
    };

    State.prototype.setCache = function (cache) {
        this.beerFactoryCache = cache;
        return this;
    };

    State.prototype.setRender = function (render) {
        this.render = render;
        return this;
    };

    beerFactoryGame.State = State;
})(BeerFactoryGame);

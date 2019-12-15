(function(beerplop) {
    'use strict';

    // The reduction for all buff bottle triggered upgrades
    UpgradeStorage.prototype.buffBottleUpgradeReduction = 1;

    UpgradeStorage.prototype.reachedUpgrades       = [];
    UpgradeStorage.prototype.availableUpgrades     = [];
    UpgradeStorage.prototype.autoPurchasedUpgrades = 0;

    UpgradeStorage.prototype.upgrades = {};

    UpgradeStorage.prototype.gameState          = null;
    UpgradeStorage.prototype.buffController     = null;
    UpgradeStorage.prototype.clickBarController = null;

    UpgradeStorage.prototype.upgradeSemaphore = false;

    UpgradeStorage.prototype.upgradeReductionFromHolyUpgrades = 1;

    /**
     * Initialize the upgrade storage
     *
     * @constructor
     */
    function UpgradeStorage(gameState, buffController, gameEventBus, clickBarController) {
        this.gameState          = gameState;
        this.buffController     = buffController;
        this.clickBarController = clickBarController;

        (new Beerplop.GamePersistor()).registerModule(
            'UpgradeStorage',
            (function () {
                return {
                    reached:       Object.values(this.reachedUpgrades),
                    available:     Object.values(this.availableUpgrades),
                    autoPurchased: this.autoPurchasedUpgrades,
                };
            }.bind(this)),
            (function (loadedData) {
                this.reachedUpgrades       = loadedData.reached || [];
                this.availableUpgrades     = loadedData.available || [];
                this.autoPurchasedUpgrades = loadedData.autoPurchased || 0;

                $.each(this.reachedUpgrades, (function (index, upgrade) {
                    var upgradeKey  = upgrade.split('.');
                    this.upgrades[upgradeKey[0]][upgradeKey[1]].reached = true;
                    this.upgrades[upgradeKey[0]][upgradeKey[1]].upgrade();
                }).bind(this));

                this.updateAvailableUpgradesView();
            }.bind(this))
        );

        this._initUpgrades();

        gameEventBus.on([EVENTS.CORE.SACRIFICE, EVENTS.CORE.INFINITY_SACRIFICE].join(' '), (function () {
            this.buffBottleUpgradeReduction       = 1;
            this.upgradeReductionFromHolyUpgrades = 1;

            this.reachedUpgrades   = [];
            this.availableUpgrades = [];

            $.each(this.upgrades, function () {
                $.each(this, function () {
                    this.reached = false;
                });
            });

            this.updateAvailableUpgradesView();
        }).bind(this));

        // if the auto plops changed check if the available upgrade view has to be updated to make sure the available
        // upgrades are ordered correctly
        gameEventBus.on(EVENTS.CORE.PLOPS.AUTO_PLOPS_UPDATED, (function () {
            this._checkUpgradeOrderInAvailableUpgradesView();
        }).bind(this));

        $('#purchase-all-available-upgrades').on('click', this.purchaseAllPossibleUpgrades.bind(this));
    }

    /**
     * Add a reduction for buff bottle triggered upgrades
     *
     * @param {number} percentage
     */
    UpgradeStorage.prototype.addBuffBottleUpgradeReduction = function (percentage) {
        this.buffBottleUpgradeReduction *= 1 - percentage;
    };

    UpgradeStorage.prototype.addAvailableUpgrade = function (upgrade, updateView = true) {
        if (this.upgradeSemaphore
            || $.inArray(upgrade, this.availableUpgrades) !== -1
            || $.inArray(upgrade, this.reachedUpgrades) !== -1
        ) {
            return;
        }

        this.availableUpgrades.push(upgrade);

        if (updateView) {
            this.updateAvailableUpgradesView();
        }
    };

    UpgradeStorage.prototype.addUpgradeReductionFromHolyUpgrades = function (reduction) {
        this.upgradeReductionFromHolyUpgrades -= reduction;
    };

    /**
     * Test if the available upgrades are ordered correctly. Else trigger a redraw
     *
     * @private
     */
    UpgradeStorage.prototype._checkUpgradeOrderInAvailableUpgradesView = function () {
        const upgradeStorage = this;
        let previousPrice = 0;

        $.each($('#upgrade-item-container').find('.upgrade-item'), function () {
            const upgrade      = $(this).data('upgrade').split('.'),
                  upgradeData  = upgradeStorage.upgrades[upgrade[0]][upgrade[1]],
                  upgradeCosts = upgradeStorage.getCosts(upgradeData);

            if (previousPrice > upgradeCosts) {
                upgradeStorage.updateAvailableUpgradesView();
                return false;
            }

            previousPrice = upgradeCosts;
        });
    };

    UpgradeStorage.prototype.updateAvailableUpgradesView = function () {
        const upgradeStorage = this,
              container      = $('#upgrade-item-container'),
              availablePlops = this.gameState.getPlops();

        container.find('.upgrade-item').tooltip('dispose');

        container.html(
            Mustache.render(
                TemplateStorage.get('available-upgrades-template'),
                {
                    upgrades: this.availableUpgrades
                        // order the available upgrades by their price
                        .sort(this._orderUpgrades.bind(this))
                        .map((function (upgrade) {
                            const upgradeParts = upgrade.split('.');
                            return {
                                key:       upgrade,
                                available: availablePlops >= this.getCosts(upgradeStorage.upgrades[upgradeParts[0]][upgradeParts[1]])
                            }
                        }).bind(this))
                }
            )
        );

        const items = container.find('.upgrade-item');
        items.tooltip({
            title: function () {
                const upgrade     = $(this).data('upgrade').split('.'),
                      upgradeData = upgradeStorage.upgrades[upgrade[0]][upgrade[1]];

                return Mustache.render(
                    TemplateStorage.get('upgrade-tooltip-template__costs'),
                    {
                        costsLabel: translator.translate('plop.plural'),
                        path:       'upgrade.' + $(this).data('upgrade'),
                        costs:      (new Beerplop.NumberFormatter()).format(upgradeStorage.getCosts(upgradeData))
                    }
                );
            }
        });

        items.on('click', function () {
            const upgradeKey  = $(this).data('upgrade'),
                  upgrade     = upgradeKey.split('.'),
                  upgradeData = upgradeStorage.upgrades[upgrade[0]][upgrade[1]];

            if (!($.inArray(upgradeKey, upgradeStorage.availableUpgrades) !== -1)
                || !upgradeStorage.gameState.removePlops(upgradeStorage.getCosts(upgradeData))
            ) {
                return;
            }

            $(this).tooltip('dispose');

            upgradeStorage.availableUpgrades.splice($.inArray(upgradeKey, upgradeStorage.availableUpgrades), 1);

            if ($.inArray(upgradeKey, upgradeStorage.reachedUpgrades) !== -1) {
                return;
            }

            upgradeStorage.reachedUpgrades.push(upgradeKey);

            upgradeData.reached = true;
            upgradeData.upgrade();

            upgradeStorage.updateAvailableUpgradesView();

            if (upgrade[0] === 'buffBottleUpgrades') {
                upgradeStorage._checkBuffBottleUpgradeAchievements();
            }

            upgradeStorage.gameState.manualPurchase = true;
        });
    };

    /**
     * Purchase as many upgrades as possible. Returns the amount of purchased upgrades.
     *
     * @returns {int}
     */
    UpgradeStorage.prototype.purchaseAllPossibleUpgrades = function () {
        // store the sorted upgrades in an additional variable to avoid side effects
        const orderedUpgrades = this.availableUpgrades.sort(this._orderUpgrades.bind(this));

        let purchasedUpgrades = [];

        $.each(orderedUpgrades, (function (index, upgradeKey) {
            const upgrade     = upgradeKey.split('.'),
                  upgradeData = this.upgrades[upgrade[0]][upgrade[1]];

            if (!this.gameState.removePlops(this.getCosts(upgradeData))) {
                return false;
            }

            purchasedUpgrades.push(upgradeKey);
        }).bind(this));

        $.each(purchasedUpgrades, (function (index, upgradeKey) {
            this.availableUpgrades.splice($.inArray(upgradeKey, this.availableUpgrades), 1);

            if ($.inArray(upgradeKey, this.reachedUpgrades) === -1) {
                this.reachedUpgrades.push(upgradeKey);

                const upgrade     = upgradeKey.split('.'),
                      upgradeData = this.upgrades[upgrade[0]][upgrade[1]];

                upgradeData.reached = true;
                upgradeData.upgrade();
            }
        }).bind(this));

        this.updateAvailableUpgradesView();
        this._checkBuffBottleUpgradeAchievements();

        const achievementController = (new Beerplop.AchievementController());

        window.setTimeout(
            function () {
                achievementController.checkAmountAchievement(
                    achievementController.getAchievementStorage().achievements.buyAmount.upgrades,
                    purchasedUpgrades.length
                );
            },
            0
        );

        return purchasedUpgrades.length;
    };

    /**
     * Order function to order upgrades by price ascending
     *
     * @param upgrade1
     * @param upgrade2
     *
     * @returns {number}
     * @private
     */
    UpgradeStorage.prototype._orderUpgrades = function (upgrade1, upgrade2) {
        const upgrade1Parts = upgrade1.split('.'),
              costs1        = this.getCosts(
                  this.upgrades[upgrade1Parts[0]][upgrade1Parts[1]]
              ),
              upgrade2Parts = upgrade2.split('.'),
              costs2        = this.getCosts(
                  this.upgrades[upgrade2Parts[0]][upgrade2Parts[1]]
              );

        if (costs1 < costs2) {
            return -1;
        }
        if (costs1 > costs2) {
            return 1;
        }

        return 0;
    };

    /**
     * Check achievements for purchased buff bottle triggered upgrades
     *
     * @private
     */
    UpgradeStorage.prototype._checkBuffBottleUpgradeAchievements = function () {
        const achievementController = new Beerplop.AchievementController();

        let reachedUpgrades = 0;
        $.each(this.upgrades.buffBottleUpgrades, function () {
            if (this.reached) {
                reachedUpgrades++;
            }
        });

        achievementController.checkAmountAchievement(
            achievementController.getAchievementStorage().achievements.buff.upgrade,
            reachedUpgrades
        );
    };

    /**
     * Get the costs for an update. Either return a constant costs value or calculate the costs via a callback function
     *
     * @param {Object} upgrade
     *
     * @returns {number}
     */
    UpgradeStorage.prototype.getCosts = function (upgrade) {
        const costs = typeof upgrade.costs === 'function' ? upgrade.costs() : upgrade.costs;

        return costs * this.upgradeReductionFromHolyUpgrades;
    };

    UpgradeStorage.prototype._initUpgrades = function () {
        const addPercentage = (function (percentage, channel = '') {
            return (function () {
                this.gameState.addUpgradeAutoPlopMultiplier(percentage, channel);
            }).bind(this);
        }).bind(this);

        const buffBottleUpgradeCosts = (function () {
            return Math.max(this.gameState.getAutoPlopsPerSecond() * 600, 1500) * this.buffBottleUpgradeReduction;
        }).bind(this);

        const achievementUpgrade = (function (percentage) {
            return (function () {
                this.gameState.addAchievementUpgradeMultiplier(percentage);
            }).bind(this);
        }).bind(this);

        const bottleCapFactoryPercentage = (function (percentage) {
            return (function () {
                this.gameState.getBuildingLevelController().addBottleCapProductionMultiplier(percentage);
            }).bind(this);
        }).bind(this);

        const drinkerUpgradeMultiplier = 0.4;

        this.upgrades = {
            buildingUpgrades: {
                doubleBottle: {
                    reached: false,
                    upgrade: (function () {
                        this.buffController.setDoubleBottlePossibility(
                            Math.floor(this.gameState.getBuildingData('opener').amount / 100)
                        );
                    }).bind(this),
                    costs: 1e11
                },
                autoClick: {
                    reached: false,
                    upgrade: (function () {
                        this.buffController.setAutoClickPossibility(
                            Math.floor(this.gameState.getBuildingData('dispenser').amount / 100)
                        );
                    }).bind(this),
                    costs: 1e11
                },
                serviceHelper: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.setBuildingReduction(
                            Math.floor(this.gameState.getBuildingData('serviceAssistant').amount / 100) * 0.01
                        );
                    }).bind(this),
                    costs: 1e11
                }
            },
            openerUpgrades: {
                50: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 0.1);
                    }).bind(this),
                    costs: 5e5
                },
                100: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 0.5);
                    }).bind(this),
                    costs: 5e7
                },
                150: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 1);
                    }).bind(this),
                    costs: 5e9
                },
                200: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 5);
                    }).bind(this),
                    costs: 5e11
                },
                250: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 15);
                    }).bind(this),
                    costs: 5e13
                },
                300: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 30);
                    }).bind(this),
                    costs: 5e15
                },
                350: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 50);
                    }).bind(this),
                    costs: 5e17
                },
                400: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 80);
                    }).bind(this),
                    costs: 5e19
                },
                450: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('opener', 120);
                    }).bind(this),
                    costs: 5e21
                }
            },
            dispenserUpgrades: {
                50: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 0.01, 'opener');
                    }).bind(this),
                    costs: 1e6
                },
                100: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 0.05, 'serviceAssistant');
                    }).bind(this),
                    costs: 1e8
                },
                150: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 0.15, 'automatedBar');
                    }).bind(this),
                    costs: 1e10
                },
                200: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 0.3, 'deliveryTruck');
                    }).bind(this),
                    costs: 1e12
                },
                250: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 0.75, 'tankerTruck');
                    }).bind(this),
                    costs: 1e14
                },
                300: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 2.5, 'beerPipeline');
                    }).bind(this),
                    costs: 1e16
                },
                350: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 7.5, 'cellarBrewery');
                    }).bind(this),
                    costs: 1e18
                },
                400: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('dispenser', 20, 'automatedBrewery');
                    }).bind(this),
                    costs: 1e20
                }
            },
            serviceAssistantUpgrades: {
                50: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 3);
                    }).bind(this),
                    costs: 1e7
                },
                100: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 10);
                    }).bind(this),
                    costs: 1e9
                },
                150: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 50);
                    }).bind(this),
                    costs: 1e11
                },
                200: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 200);
                    }).bind(this),
                    costs: 1e13
                },
                250: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 750);
                    }).bind(this),
                    costs: 1e15
                },
                300: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 15e2);
                    }).bind(this),
                    costs: 1e17
                },
                350: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 3e3);
                    }).bind(this),
                    costs: 1e19
                },
                400: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoost('serviceAssistant', 75e2);
                    }).bind(this),
                    costs: 1e21
                }

            },
            achievementUpgrades: {
                50: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 5e6
                },
                100: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 5e7
                },
                150: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e10
                },
                200: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e12
                },
                250: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e14
                },
                300: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 5e16
                },
                350: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e19
                },
                400: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 5e21
                },
                450: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e23
                },
                500: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e25
                },
                550: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e27
                },
                600: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e29
                },
                650: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e31
                },
                700: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e33
                },
                750: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e35
                },
                800: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e38
                },
                850: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e41
                },
                900: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e44
                },
                950: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e47
                },
                1000: {
                    reached: false,
                    upgrade: achievementUpgrade(drinkerUpgradeMultiplier),
                    costs: 1e50
                },
            },
            beerLaser1: {
                ark: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e21
                },
                montezuma: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e21
                },
                blackbeard: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e22
                },
                eggs: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e22
                },
                amber: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e23
                },
                paititi: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e23
                }
            },
            beerLaser2: {
                choudette: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e22
                },
                menorah: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e23
                },
                ganj: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e23
                },
                ireland: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e24
                },
                huang: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e24
                },
                dorado: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e25
                }
            },
            beerLaser3: {
                heirloom: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e24
                },
                beale: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e24
                },
                vero: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e25
                },
                templar: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e25
                },
                florentine: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e26
                },
                miguel: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e26
                }
            },
            beerLaser4: {
                copper: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e25
                },
                flor: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e26
                },
                oak: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e26
                },
                duc: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e27
                },
                toplitz: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 5e27
                },
                trabuco: {
                    reached: false,
                    upgrade: addPercentage(0.04, 'beerLaser'),
                    costs: 1e28
                }
            },
            beerPark: {
                bar1: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('automatedBar', 4);
                    }).bind(this),
                    costs: 1e19
                },
                bar2: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('automatedBar', 4);
                    }).bind(this),
                    costs: 5e19
                },
                bar3: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('automatedBar', 4);
                    }).bind(this),
                    costs: 1e20
                },
                bar4: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('automatedBar', 4);
                    }).bind(this),
                    costs: 5e20
                },
                deliv1: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('deliveryTruck', 3);
                    }).bind(this),
                    costs: 5e19
                },
                deliv2: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('deliveryTruck', 3);
                    }).bind(this),
                    costs: 1e20
                },
                deliv3: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('deliveryTruck', 4);
                    }).bind(this),
                    costs: 5e20
                },
                deliv4: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('deliveryTruck', 4);
                    }).bind(this),
                    costs: 1e21
                },
            },
            beerdedNation: {
                tt1: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('tankerTruck', 3);
                    }).bind(this),
                    costs: 1e20
                },
                tt2: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('tankerTruck', 3);
                    }).bind(this),
                    costs: 5e20
                },
                tt3: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('tankerTruck', 3);
                    }).bind(this),
                    costs: 1e21
                },
                tt4: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('tankerTruck', 3);
                    }).bind(this),
                    costs: 5e21
                },
                bp1: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('beerPipeline', 2);
                    }).bind(this),
                    costs: 5e20
                },
                bp2: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('beerPipeline', 2);
                    }).bind(this),
                    costs: 1e21
                },
                bp3: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('beerPipeline', 3);
                    }).bind(this),
                    costs: 5e21
                },
                bp4: {
                    reached: false,
                    upgrade: (function () {
                        this.gameState.addUpgradeBoostMultiplicative('beerPipeline', 3);
                    }).bind(this),
                    costs: 1e22
                },
            },
            specialBuildingUpgrades: {
                stockMarket: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).unlockStockMarket();
                    },
                    costs: 1e9
                },
                clickBar: {
                    reached: false,
                    upgrade: (function () {
                        this.clickBarController.enable();

                        const achievementController = new Beerplop.AchievementController();
                        achievementController.checkAchievement(
                            achievementController.getAchievementStorage().achievements.special.clickBar
                        );
                    }).bind(this),
                    costs: 1e10
                },
                nextCustomer: {
                    reached: false,
                    upgrade: (function () {
                        this.clickBarController.addGlass();
                    }).bind(this),
                    costs: 1e11
                },
                journey: {
                    reached: false,
                    upgrade: (function () {
                        this.clickBarController.addGlass();
                    }).bind(this),
                    costs: 1e12
                },
                homies: {
                    reached: false,
                    upgrade: (function () {
                        this.clickBarController.addGlass();

                        const achievementController = new Beerplop.AchievementController();
                        achievementController.checkAchievement(
                            achievementController.getAchievementStorage()
                                .achievements
                                .special
                                .clickBarComplete
                        );
                    }).bind(this),
                    costs: 1e13
                }
            },
            stockMarketUpgrades: {
                25: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('hop', 2);
                    },
                    costs: 1e9
                },
                30: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).lowerFee(0.0025);
                    },
                    costs: 1e11
                },
                50: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('malt', 2);
                    },
                    costs: 5e9
                },
                60: {
                    reached: false,
                    upgrade: (function () {
                        this.buffController.enableAdditionalBuff('stockMarketLobby');
                    }).bind(this),
                    costs: 1e12
                },
                75: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('hop', 3);
                    },
                    costs: 1e10
                },
                90: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).lowerFee(0.0025);
                    },
                    costs: 1e12
                },
                100: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).enableStock('beerglasses');
                    },
                    costs: 1e11
                },
                125: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('malt', 3);
                    },
                    costs: 1e10
                },
                150: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('beerglasses', 2);
                    },
                    costs: 1e10
                },
                175: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('hop', 4);
                    },
                    costs: 1e11
                },
                200: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('beerglasses', 3);
                    },
                    costs: 1e11
                },
                225: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('malt', 4);
                    },
                    costs: 1e11
                },
                250: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('hop', 5);
                    },
                    costs: 1e12
                },
                275: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('beerglasses', 4);
                    },
                    costs: 1e12
                },
                300: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('malt', 5);
                    },
                    costs: 1e13
                },
                325: {
                    reached: false,
                    upgrade: function () {
                        (new Minigames.StockMarket()).addAvailableLever('beerglasses', 5);
                    },
                    costs: 1e14
                }
            },
            autoPlopUpgrades: {
                10: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e3
                },
                100: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e4
                },
                1e3: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e5
                },
                1e4: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e6
                },
                1e5: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e7
                },
                1e6: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e8
                },
                1e7: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e9
                },
                1e8: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e10
                },
                1e9: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e11
                },
                1e10: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e12
                },
                1e11: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e13
                },
                1e12: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e14
                },
                1e13: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e15
                },
                1e14: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e16
                },
                1e15: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e17
                },
                1e16: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e18
                },
                1e17: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e19
                },
                1e18: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e20
                },
                1e19: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e21
                },
                1e20: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e22
                },
                1e21: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e23
                },
                1e22: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e24
                },
                1e23: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e25
                },
                1e24: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e26
                },
                1e25: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e27
                },
                1e26: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e28
                },
                1e27: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e29
                },
                1e28: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e30
                },
                1e29: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e31
                },
                1e30: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e32
                },
                1e31: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e33
                },
                1e32: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e34
                },
                1e33: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e35
                },
                1e34: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e36
                },
                1e35: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e37
                },
                1e36: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e38
                },
                1e37: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e39
                },
                1e38: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e40
                },
                1e39: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e41
                },
                1e40: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e42
                },
                1e41: {
                    reached: false,
                    upgrade: addPercentage(0.01, 'autoplop'),
                    costs: 5e43
                },
            },
            totalPlopUpgrades: {
                1e6: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e5
                },
                1e7: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e6
                },
                1e8: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e7
                },
                1e9: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e8
                },
                1e10: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e9
                },
                1e11: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e10
                },
                1e12: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e11
                },
                1e13: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e12
                },
                1e14: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e13
                },
                1e15: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e14
                },
                1e16: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e15
                },
                1e17: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e16
                },
                1e18: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e17
                },
                1e19: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e18
                },
                1e20: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e19
                },
                1e21: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e20
                },
                1e22: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e21
                },
                1e23: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e22
                },
                1e24: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e23
                },
                1e25: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e24
                },
                1e26: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e25
                },
                1e27: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e26
                },
                1e28: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e27
                },
                1e29: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e28
                },
                1e30: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e29
                },
                1e31: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e30
                },
                1e32: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e31
                },
                1e33: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e32
                },
                1e34: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e33
                },
                1e35: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e34
                },
                1e36: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e35
                },
                1e37: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e36
                },
                1e38: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'totalplop'),
                    costs: 1e37
                },
            },
            buffUpgrades: {
                perseveringBottles: {
                    requiredBottles: 25,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseBuffLifetime(2);
                    }).bind(this),
                    costs: 5e8
                },
                moreBottles: {
                    requiredBottles: 50,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseBuffPossibility(0.05);
                    }).bind(this),
                    costs: 1e9
                },
                strongBeer: {
                    requiredBottles: 100,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseBuffEffectMultiplier(2);
                    }).bind(this),
                    costs: 5e9
                },
                returnableBottle: {
                    requiredBottles: 150,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseAssemblyLinePower(1.5);
                    }).bind(this),
                    costs: 1e10
                },
                longLiveTheBottle: {
                    requiredBottles: 200,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseBuffLifetime(2);
                    }).bind(this),
                    costs: 1e11
                },
                aTrayOfBottles: {
                    requiredBottles: 250,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseBuffPossibility(0.1);
                    }).bind(this),
                    costs: 1e12
                },
                luettUnLuett: {
                    requiredBottles: 300,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseBuffEffectMultiplier(2);
                    }).bind(this),
                    costs: 1e13
                },
                bottleCollector: {
                    requiredBottles: 350,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseAssemblyLinePower(1.5);
                    }).bind(this),
                    costs: 1e14
                },
                chains: {
                    requiredBottles: 400,
                    reached: false,
                    upgrade: (function () {
                        this.buffController.increaseBottleChainPower(0.15);
                    }).bind(this),
                    costs: 1e15
                }
            },
            minimumBuildingUpgrades: {
                50: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 6e16
                },
                100: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 6e18
                },
                150: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 1e21
                },
                200: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 8e22
                },
                250: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 22e23
                },
                300: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 24e25
                },
                350: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 26e26
                },
                400: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 1e29
                },
                450: {
                    reached: false,
                    upgrade: addPercentage(0.1, 'minBuilding'),
                    costs: 16e29
                }
            },
            buffBottleUpgrades: {
                ecks: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                heinekeine: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                carlshuegel: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                leffers: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                iststeiner: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                chromebacher: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                tigerbraeu: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                peperoni: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                tuberg: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                weltins: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                lieberoeder: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                novemberiner: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                holstein: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                radelberger: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                eastmalle: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                email: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                jewer: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                corano: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                duebels: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                spencerweiser: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                flansburger: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                byteburger: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                mondinger: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                mithmarscher: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                stoertebaecker: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                forresters: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                genniuss: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                51: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                staropraguen: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                DUB: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                schifferhofer: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                dagobertstein: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                siegelpilz: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                rollnick: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                },
                otteringer: {
                    reached: false,
                    upgrade: addPercentage(0.02, 'buffBottle'),
                    costs: buffBottleUpgradeCosts
                }
            },
            bottleCapFactoryUpgrades: {
                5: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e5
                },
                10: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e6
                },
                15: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e7
                },
                20: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e8
                },
                25: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e9
                },
                30: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e10
                },
                35: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 5e10
                },
                40: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e11
                },
                45: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 5e11
                },
                50: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 13e11
                },
                55: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e13
                },
                60: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 7e13
                },
                65: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 5e14
                },
                70: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 4e15
                },
                75: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 3e16
                },
                80: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 2e17
                },
                85: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e18
                },
                90: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 9e18
                },
                95: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 8e19
                },
                100: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 7e20
                },
                105: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 6e21
                },
                110: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 5e22
                },
                115: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 4e23
                },
                120: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 3e24
                },
                125: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 2e25
                },
                130: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e26
                },
                135: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 9e26
                },
                // Dos Equis
                140: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 9e26
                },
                // Coors
                145: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 8e27
                },
                // Birra Moretti
                150: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 7e28
                },
                // Chimay Blue Top
                155: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 6e29
                },
                // Duvel
                160: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 5e30
                },
                // Dreher
                165: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 4e31
                },
                // Coreff Ambree
                170: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 3e32
                },
                // Lasko
                175: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 2e33
                },
                // singha beer
                180: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 1e34
                },
                // Tiger beer
                185: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 9e34
                },
                // Tsingtao
                190: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 8e35
                },
                // San Miguel
                195: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 7e36
                },
                // Chang beer, Altbierlied
                200: {
                    reached: false,
                    upgrade: bottleCapFactoryPercentage(0.15),
                    costs: 6e37
                },
            }
        }
    };

    beerplop.UpgradeStorage = UpgradeStorage;
})(Beerplop);

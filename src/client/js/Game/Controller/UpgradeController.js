(function(beerplop) {
    'use strict';

    UpgradeController.prototype._instance = null;

    UpgradeController.prototype.upgradeStorage = null;
    UpgradeController.prototype.holyUpgradeStorage = null;

    UpgradeController.prototype.gameEventBus   = null;
    UpgradeController.prototype.buffController = null;
    UpgradeController.prototype.beerFactory    = null;

    UpgradeController.prototype.buffBottleUpgradePossibility = 0.25;
    UpgradeController.prototype.buffBottleUpgradesAfterReincarnation = false;

    /**
     * Initialize the upgrade controller
     *
     * @constructor
     */
    function UpgradeController(
        gameState,
        gameEventBus,
        buffController,
        levelController,
        clickBarController,
        beerFactory,
    ) {
        if (UpgradeController.prototype._instance) {
            return UpgradeController.prototype._instance;
        }

        this.upgradeStorage = new Beerplop.UpgradeStorage(
            gameState,
            buffController,
            gameEventBus,
            clickBarController
        );

        this.holyUpgradeStorage = new Beerplop.HolyUpgradeStorage(
            gameState,
            gameEventBus,
            levelController,
            this,
            buffController
        );

        this.gameEventBus   = gameEventBus;
        this.gameState      = gameState;
        this.buffController = buffController;
        this.beerFactory    = beerFactory;

        this._initUpgradeSemaphore();

        this.gameEventBus.on([EVENTS.CORE.SACRIFICE, EVENTS.CORE.INFINITY_SACRIFICE].join(' '), (function () {
            this.buffBottleUpgradePossibility = 0.25;

            window.setTimeout(
                (function () {
                    this._checkAchievementUpgrades();
                }).bind(this),
                1000
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.SAVE.LOAD.FINISHED, (function () {
            this._checkUnlockingBuffBottleUpgrades();
            this._checkAchievementUpgrades();
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.ITERATION_LONG, (function () {
            this._checkAchievementUpgrades();
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.REINCARNATE, (function () {
            window.setTimeout(
                (function () {
                    this._checkAchievementUpgrades();
                    this._checkUnlockingBuffBottleUpgrades();
                }).bind(this),
                1000
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUFF.CLICKED, (function (event, data) {
            this._checkBuffBottleUpgrades();
            this._checkBuffUpgrades(data.buffBottlesClicked);
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, (function (event, purchase) {
            this._checkBuildingUpgrades(purchase.building, purchase.amount);
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.ACHIEVEMENT_REACHED, (function () {
            this._checkAchievementUpgrades();
        }).bind(this));

        // Check for all available upgrades if there are enough plops for buying them.
        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function () {
            const upgradeStorage   = this.upgradeStorage,
                  beerFactoryState = this.beerFactory.state,
                  availablePlops   = this.gameState.getPlops(),
                  totalPlops       = this.gameState.getTotalPlops();

            let hasAvailableUpgrades = false;

            $.each($('#upgrade-item-container').find('.upgrade-item'), function () {
                const element    = $(this),
                      upgradeKey = element.data('upgrade').split('.'),
                      upgrade    = upgradeStorage.upgrades[upgradeKey[0]][upgradeKey[1]],
                      costs      = upgradeStorage.getCosts(upgrade);

                if (availablePlops >= costs) {
                    hasAvailableUpgrades = true;

                    if (!element.hasClass('available-upgrade')) {
                        element.addClass('available-upgrade');
                    }
                }

                if (availablePlops < costs && element.hasClass('available-upgrade')) {
                    element.removeClass('available-upgrade');
                }
            });

            if (hasAvailableUpgrades && beerFactoryState.isAutoUpgradingEnabled()) {
                this._checkAutoPurchaseUpgrades();
            }

            let addedUpgrades = false;
            $.each(upgradeStorage.upgrades.totalPlopUpgrades, (function (requiredAmount, data) {
                const key = 'totalPlopUpgrades.' + requiredAmount;

                if (data.reached ||
                    $.inArray(key, upgradeStorage.availableUpgrades) !== -1 ||
                    requiredAmount > totalPlops
                ) {
                    return;
                }

                addedUpgrades = true;
                upgradeStorage.addAvailableUpgrade(key, false);
            }).bind(this));

            if (addedUpgrades) {
                upgradeStorage.updateAvailableUpgradesView();
            }
        }).bind(this));

        this.gameEventBus.on(EVENTS.BEER_FACTORY.AUTO_UPGRADE, (event, context) => {
            if (context.enabled) {
                this._checkAutoPurchaseUpgrades();
            }
        });

        this.gameEventBus.on(EVENTS.CORE.PLOPS.AUTO_PLOPS_UPDATED, (function () {
            const autoPlops = this.gameState.getAutoPlopsPerSecondWithoutBuffMultiplier();

            let addedUpgrades = false;
            $.each(this.upgradeStorage.upgrades.autoPlopUpgrades, (function (requiredAmount, data) {
                const key = 'autoPlopUpgrades.' + requiredAmount;

                if (data.reached ||
                    $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1 ||
                    requiredAmount > autoPlops
                ) {
                    return;
                }

                addedUpgrades = true;
                this.upgradeStorage.addAvailableUpgrade(key, false);
            }).bind(this));

            if (addedUpgrades) {
                this.upgradeStorage.updateAvailableUpgradesView();
            }
        }).bind(this));

        $('.upgrades-title').on('click', (function () {
            (new Beerplop.OverlayController()).openOverlay('upgrades-overlay', 'upgrades');
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.PLOPS.REMOVED, (function (event, removedPlops) {
            const upgrades = {
                1e9:  'stockMarket',
                1e10: 'clickBar',
                1e11: 'nextCustomer',
                1e12: 'journey',
                1e13: 'homies'
            };

            $.each(upgrades, (function (requiredRemovedPlops, upgrade) {
                if (removedPlops >= requiredRemovedPlops &&
                    !this.upgradeStorage.upgrades.specialBuildingUpgrades[upgrade].reached &&
                    $.inArray('specialBuildingUpgrades.' + upgrade, this.upgradeStorage.availableUpgrades) === -1
                ) {
                    // skip unlocking additional click bar upgrades if the click bar isn't enabled
                    if ($.inArray(upgrade, ['nextCustomer', 'journey', 'homies']) !== -1 &&
                        !this.upgradeStorage.upgrades.specialBuildingUpgrades.clickBar.reached
                    ) {
                        return;
                    }

                    this.upgradeStorage.addAvailableUpgrade('specialBuildingUpgrades.' + upgrade);
                }
            }).bind(this));
        }).bind(this));

        this.gameEventBus.on(EVENTS.STOCK.PURCHASED, (function (event, purchasedHolds) {
            $.each(this.upgradeStorage.upgrades.stockMarketUpgrades, (function (requiredAmount, data) {
                const key = 'stockMarketUpgrades.' + requiredAmount;

                if (data.reached ||
                    $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1 ||
                    requiredAmount > purchasedHolds
                ) {
                    return;
                }

                this.upgradeStorage.addAvailableUpgrade(key);
            }).bind(this));
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BOTTLE_CAP.PURCHASED, (function (event, factories) {
            let addedUpgrades = false;
            $.each(this.upgradeStorage.upgrades.bottleCapFactoryUpgrades, (function (requiredAmount, data) {
                const key = 'bottleCapFactoryUpgrades.' + requiredAmount;

                if (data.reached ||
                    $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1 ||
                    requiredAmount > factories.amount
                ) {
                    return;
                }

                addedUpgrades = true;
                this.upgradeStorage.addAvailableUpgrade(key, false);
            }).bind(this));

            if (addedUpgrades) {
                this.upgradeStorage.updateAvailableUpgradesView();
            }
        }).bind(this));

        (new Beerplop.OverlayController()).addCallback(
            'upgrades',
            (function () {
                const container = $('#upgrades-overview-container');

                let upgrades     = [],
                    holyUpgrades = [];

                $.each(this.upgradeStorage.upgrades, function prepareUpgradesForOverlay(upgradeGroupKey, upgradeGroup) {
                    upgrades = upgrades.concat(
                        Object.entries(upgradeGroup).map(
                            function (entry) {
                                return $.extend({key: `${upgradeGroupKey}.${entry[0]}`}, entry[1]);
                            }
                        )
                    );
                });

                $.each(this.holyUpgradeStorage.upgrades, function prepareHolyUpgradesForOverlay(upgradeKey, upgrade) {
                    if (upgrade.reached) {
                        holyUpgrades.push($.extend({key: upgradeKey}, upgrade));
                    }
                });

                container.html(
                    Mustache.render(
                        TemplateStorage.get('upgrade-overview-template'),
                        {
                            upgrades:            upgrades,
                            total:               upgrades.length,
                            reached:             this.upgradeStorage.reachedUpgrades.length,
                            showHolyUpgrades:    holyUpgrades.length > 0,
                            holyUpgrades:        holyUpgrades,
                            holyUpgradesReached: holyUpgrades.length
                        }
                    )
                );

                $.each($('.holy-upgrade-overview-svg'), function () {
                    $(this).html($('#' + $(this).data('svgKey')).html());
                });

                const items          = container.find('.upgrade-item'),
                      upgradeStorage = this.upgradeStorage;

                items.tooltip({
                    title: function () {
                        const isHolyUpgrade = $(this).hasClass('upgrade-item__holy-upgrade'),
                              upgradeKey    = $(this).data('upgradeKey').split('.'),
                              upgradePath   = [(isHolyUpgrade ? 'holyUpgrade' : 'upgrade')].concat(upgradeKey).join('.');

                        return Mustache.render(
                            TemplateStorage.get('upgrade-tooltip-template'),
                            {
                                path:    upgradePath,
                                reached: isHolyUpgrade || upgradeStorage.upgrades[upgradeKey[0]][upgradeKey[1]].reached,
                            }
                        );
                    }
                });
            }).bind(this),
            () => {
                const container = $('#upgrades-overview-container');

                container.find('.upgrade-item').tooltip('dispose');
                container.html('');
            },
        );

        UpgradeController.prototype._instance = this;
    }

    UpgradeController.prototype._checkAutoPurchaseUpgrades = function () {
        this.upgradeStorage.autoPurchasedUpgrades += this.upgradeStorage.purchaseAllPossibleUpgrades();

        const achievementController = new Beerplop.AchievementController();
        achievementController.checkAmountAchievement(
            achievementController.getAchievementStorage().achievements.beerFactory.slots.automation.autoUpgrade,
            this.upgradeStorage.autoPurchasedUpgrades
        );
    };

    UpgradeController.prototype._checkUnlockingBuffBottleUpgrades = function () {
        if (!this.buffBottleUpgradesAfterReincarnation) {
            return;
        }

        let addedUpgrades = false;

        $.each(this.upgradeStorage.upgrades.buffBottleUpgrades, (function (upgrade, data) {
            const key = 'buffBottleUpgrades.' + upgrade;

            if (data.reached || $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1) {
                return;
            }
            addedUpgrades = true;
            this.upgradeStorage.addAvailableUpgrade(key, false);
        }).bind(this));

        if (addedUpgrades) {
            this.upgradeStorage.updateAvailableUpgradesView();
        }
    };

    /**
     * Extend the possibility a buff bottle triggered upgrade appears.
     *
     * @param percentage
     */
    UpgradeController.prototype.addBuffBottleUpgradePossibility = function (percentage) {
        this.buffBottleUpgradePossibility += percentage;
    };

    /**
     * Unlock all buff bottle triggered upgrades right after reincarnation
     */
    UpgradeController.prototype.enableBuffBottleUpgradesAfterReincarnation = function () {
        this.buffBottleUpgradesAfterReincarnation = true;
    };

    UpgradeController.prototype._checkBuffBottleUpgrades = function () {
        if (Math.random() > this.buffBottleUpgradePossibility || this.buffBottleUpgradesAfterReincarnation) {
            return;
        }

        let possibleUpgrades = [];
        $.each(this.upgradeStorage.upgrades.buffBottleUpgrades, (function (upgrade, data) {
            const key = 'buffBottleUpgrades.' + upgrade;

            if (data.reached || $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1) {
                return;
            }
            possibleUpgrades.push(key);
        }).bind(this));

        if (possibleUpgrades.length === 0) {
            return;
        }

        this.upgradeStorage.addAvailableUpgrade(
            possibleUpgrades[Math.floor(Math.random() * possibleUpgrades.length)]
        );
    };

    UpgradeController.prototype._checkAchievementUpgrades = function () {
        const achievementAmount = (new Beerplop.AchievementController())
            .getAchievementStorage()
            .getReachedAchievements();

        if (!achievementAmount) {
            return;
        }

        let addedUpgrades = false;
        $.each(this.upgradeStorage.upgrades.achievementUpgrades, (function (upgrade, data) {
            const key = 'achievementUpgrades.' + upgrade;

            if (data.reached ||
                $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1 ||
                upgrade > achievementAmount
            ) {
                return;
            }

            addedUpgrades = true;
            this.upgradeStorage.addAvailableUpgrade(key, false);
        }).bind(this));

        if (addedUpgrades) {
            this.upgradeStorage.updateAvailableUpgradesView();
        }
    };

    UpgradeController.prototype._checkBuffUpgrades = function (buffBottleAmount) {
        let addedUpgrades = false;
        $.each(this.upgradeStorage.upgrades.buffUpgrades, (function (upgrade, data) {
            const key = 'buffUpgrades.' + upgrade;

            if (data.reached ||
                $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1 ||
                data.requiredBottles > buffBottleAmount
            ) {
                return;
            }

            addedUpgrades = true;
            this.upgradeStorage.addAvailableUpgrade(key, false);
        }).bind(this));

        if (addedUpgrades) {
            this.upgradeStorage.updateAvailableUpgradesView();
        }
    };

    UpgradeController.prototype._checkBuildingUpgrades = function (building, amountOfNewBoughtBuildings) {
        const amount                      = this.gameState.getBuildingData(building).amount,
              checkBuildingAmountUpgrades = (function (upgradeKey) {
                  let addedUpgrades = false;
                  $.each(this.upgradeStorage.upgrades[upgradeKey], (function (upgrade, data) {
                      const key = upgradeKey + '.' + upgrade;

                      if (data.reached ||
                          $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1 ||
                          upgrade > amount
                      ) {
                          return;
                      }

                      addedUpgrades = true;
                      this.upgradeStorage.addAvailableUpgrade(key, false);
                  }).bind(this));

                  if (addedUpgrades) {
                      this.upgradeStorage.updateAvailableUpgradesView();
                  }
              }).bind(this);

        if (building === 'opener') {
            if (amount >= 100 &&
                !this.upgradeStorage.upgrades.buildingUpgrades.doubleBottle.reached &&
                $.inArray('buildingUpgrades.doubleBottle', this.upgradeStorage.availableUpgrades) === -1
            ) {
                this.upgradeStorage.addAvailableUpgrade('buildingUpgrades.doubleBottle');
            } else if (this.upgradeStorage.upgrades.buildingUpgrades.doubleBottle.reached) {
                this.buffController.setDoubleBottlePossibility(
                    Math.floor(amount / 100)
                );
            }

            checkBuildingAmountUpgrades('openerUpgrades');

            if (this.holyUpgradeStorage.upgrades.openerStudy.reached) {
                this.gameState.removeUpgradeAutoPlopMultiplier((amount - amountOfNewBoughtBuildings) * 0.0005, 'openerStudy');
                this.gameState.addUpgradeAutoPlopMultiplier(amount * 0.0005, 'openerStudy');

            }
        }

        if (building === 'dispenser') {
            if (amount >= 100 &&
                !this.upgradeStorage.upgrades.buildingUpgrades.autoClick.reached &&
                $.inArray('buildingUpgrades.autoClick', this.upgradeStorage.availableUpgrades) === -1
            ) {
                this.upgradeStorage.addAvailableUpgrade('buildingUpgrades.autoClick');
            } else if (this.upgradeStorage.upgrades.buildingUpgrades.autoClick.reached) {
                this.buffController.setAutoClickPossibility(
                    Math.floor(amount / 100)
                );
            }

            checkBuildingAmountUpgrades('dispenserUpgrades');

            if (this.holyUpgradeStorage.upgrades.dispenserFactory.reached) {
                this.gameState.removeUpgradeAutoPlopMultiplier((amount - amountOfNewBoughtBuildings) * 0.0005, 'dispenserFactory');
                this.gameState.addUpgradeAutoPlopMultiplier(amount * 0.0005, 'dispenserFactory');
            }
        }

        if (building === 'serviceAssistant') {
            if (amount >= 100 &&
                !this.upgradeStorage.upgrades.buildingUpgrades.serviceHelper.reached &&
                $.inArray('buildingUpgrades.serviceHelper', this.upgradeStorage.availableUpgrades) === -1
            ) {
                this.upgradeStorage.addAvailableUpgrade('buildingUpgrades.serviceHelper');
            } else if (this.upgradeStorage.upgrades.buildingUpgrades.serviceHelper.reached) {
                this.gameState.setBuildingReduction(this.gameState.getServiceAssistantBuildingReduction(amount));
            }

            checkBuildingAmountUpgrades('serviceAssistantUpgrades');

            if (this.holyUpgradeStorage.upgrades.beerAcademy.reached) {
                this.gameState.removeUpgradeAutoPlopMultiplier((amount - amountOfNewBoughtBuildings) * 0.0005, 'beerAcademy');
                this.gameState.addUpgradeAutoPlopMultiplier(amount * 0.0005, 'beerAcademy');
            }
        }

        const minimumBuildingAmount = this.gameState.getMinimumBuildingAmount();
        let addedUpgrades = false;
        $.each(this.upgradeStorage.upgrades.minimumBuildingUpgrades, (function (requiredAmount, upgradeData) {
            const key = 'minimumBuildingUpgrades.' + requiredAmount;

            if (upgradeData.reached ||
                $.inArray(key, this.upgradeStorage.availableUpgrades) !== -1 ||
                requiredAmount > minimumBuildingAmount
            ) {
                return;
            }

            addedUpgrades = true;
            this.upgradeStorage.addAvailableUpgrade(key, false);
        }).bind(this));

        if (addedUpgrades) {
            this.upgradeStorage.updateAvailableUpgradesView();
        }
    };

    UpgradeController.prototype._initUpgradeSemaphore = function () {
        this.gameEventBus.on(EVENTS.SAVE.LOAD.STARTED, (function () {
            this.upgradeStorage.upgradeSemaphore = true;
        }).bind(this));

        this.gameEventBus.on(EVENTS.SAVE.LOAD.FINISHED, (function () {
            this.upgradeStorage.upgradeSemaphore = false;
        }).bind(this));
    };

    UpgradeController.prototype.getUpgradeStorage = function () {
        return this.upgradeStorage;
    };

    UpgradeController.prototype.unlockAllUpgrades = function () {
        $.each(this.upgradeStorage.upgrades, (function (upgradeTypeKey, upgrades) {
            $.each(upgrades, (function (upgradeKey, upgrade) {
                const key = upgradeTypeKey + '.' + upgradeKey;

                if (!upgrade.reached && $.inArray(key, this.upgradeStorage.availableUpgrades) === -1) {
                    this.upgradeStorage.addAvailableUpgrade(key, false);
                }
            }).bind(this));
        }).bind(this));

        this.upgradeStorage.updateAvailableUpgradesView();
    };

    beerplop.UpgradeController = UpgradeController;
})(Beerplop);

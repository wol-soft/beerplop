(function(buildingMinigames) {
    'use strict';

    AutomatedBarUpgradeStorage.prototype.automatedBar = null;
    AutomatedBarUpgradeStorage.prototype.gameEventBus = null;

    AutomatedBarUpgradeStorage.prototype.reachedUpgrades  = [];
    AutomatedBarUpgradeStorage.prototype.unlockedUpgrades = [];

    AutomatedBarUpgradeStorage.prototype.upgrades = null;

    function AutomatedBarUpgradeStorage (automatedBar, gameEventBus) {
        this.automatedBar = automatedBar;
        this.gameEventBus = gameEventBus;

        this._initUpgrades();

        (new Beerplop.OverlayController()).addCallback(
            'automatedBar-upgrades',
            (function () {
                $('#upgrades-overlay').addClass('overlay--full');

                let upgrades = [];

                const container                 = $('#upgrades-overview-container'),
                      prepareUpgradesForOverlay = function (upgradeGroupKey, upgradeGroup) {
                          $.each(upgradeGroup, (key, upgrade) => {
                              if (typeof upgrade.reached !== 'undefined') {
                                  upgrades.push($.extend({key: `${upgradeGroupKey}.${key}`}, upgrade));
                                  return;
                              }

                              prepareUpgradesForOverlay((upgradeGroupKey ? upgradeGroupKey + '.' : '') + key, upgrade);
                          });
                      };

                prepareUpgradesForOverlay('', this.upgrades);

                container.html(
                    Mustache.render(
                        TemplateStorage.get('upgrade-overview-template'),
                        {
                            upgrades:            upgrades,
                            total:               upgrades.length,
                            reached:             this.reachedUpgrades.length,
                            showHolyUpgrades:    false,
                        }
                    )
                );

                const items = container.find('.upgrade-item');

                items.tooltip({
                    title: function () {
                        return Mustache.render(
                            TemplateStorage.get('upgrade-tooltip-template'),
                            {
                                path:    'automatedBar.upgrade.' + $(this).data('upgradeKey'),
                                reached: $(this).find('span').hasClass('upgrade-reached'),
                            }
                        );
                    }
                });
            }).bind(this),
            () => {
                const container = $('#upgrades-overview-container');

                container.find('.upgrade-item').tooltip('dispose');
                container.html('');

                $('#upgrades-overlay').removeClass('overlay--full');
            },
        );
    }

    AutomatedBarUpgradeStorage.prototype.getAvailableUpgrade = function (itemType, itemLevel) {
        if ($.inArray(`level.${itemType}.${itemLevel + 1}`, this.reachedUpgrades) === -1) {
            return null;
        }

        return this.upgrades.level[itemType][itemLevel + 1];
    };

    AutomatedBarUpgradeStorage.prototype.setReachedUpgrades = function (upgrades) {
        if (!upgrades) {
            return;
        }

        this.reachedUpgrades = upgrades;
        $.each(this.reachedUpgrades, (index, path) => {
            const upgrade = this.getUpgradeByPath(path);

            upgrade.reached = true;

            if (upgrade.upgrade) {
                upgrade.upgrade();
            }
        });
    };

    AutomatedBarUpgradeStorage.prototype.getUpgradeByPath = function (path) {
        const parts = path.split('.');

        let part,
            upgrade = this.upgrades;

        while (part = parts.shift()) {
            upgrade = upgrade[part];
        }

        return upgrade;
    };

    /**
     * Get the costs for an upgrade
     *
     * @param {string} path
     *
     * @return {number}
     *
     * @private
     */
    AutomatedBarUpgradeStorage.prototype.getUpgradeCosts = function (path) {
        // Equipping an item with an upgrade costs 50% of the base upgrade price
        return this.getUpgradeByPath(path).costs / 2;
    };

    /**
     * Check if additional upgrades must be unlocked
     */
    AutomatedBarUpgradeStorage.prototype.checkUnlockedUpgrades = function () {
        $.each(this.upgrades.level, (function (item, upgrades) {
            $.each(upgrades, (function (requiredLevel, upgrade) {
                const path = ['level', item, requiredLevel].join('.');

                if (upgrade.reached ||
                    (upgrade.requiredLevel || requiredLevel) > this.automatedBar.state.level ||
                    $.inArray(path, this.unlockedUpgrades) !== -1 ||
                    // the upgrade one level below must be reached to unlock an upgrade.
                    (typeof this.upgrades.level[item][requiredLevel - 1] !== 'undefined' && !this.upgrades.level[item][requiredLevel - 1].reached)
                ) {
                    return;
                }

                this.unlockedUpgrades.push(path);
            }).bind(this));
        }).bind(this));
        
        $.each(this.upgrades.items, (function (item, upgrade) {
            const path = 'items.' + item;

            if (upgrade.reached ||
                upgrade.requiredLevel > this.automatedBar.state.level ||
                $.inArray(path, this.unlockedUpgrades) !== -1
            ) {
                return;
            }

            this.unlockedUpgrades.push(path);
        }).bind(this));
    };

    AutomatedBarUpgradeStorage.prototype.renderAvailableUpgrades = function () {
        const upgradeStorage = this,
              container      = $('#automated-bar__available-upgrades-container'),
              availableBeers = this.automatedBar.state.ownedBeer;

        container.find('.upgrade-item').tooltip('dispose');

        container.html(
            Mustache.render(
                TemplateStorage.get('available-upgrades-template'),
                {
                    upgrades: this.unlockedUpgrades
                        // order the available upgrades by their price
                        .sort(this._orderUpgrades.bind(this))
                        .map((function (upgrade) {
                            return {
                                key:       upgrade,
                                available: availableBeers >= this.getUpgradeByPath(upgrade).costs
                            }
                        }).bind(this))
                }
            )
        );

        const items = container.find('.upgrade-item');
        items.tooltip({
            title: function () {
                const upgrade = $(this).data('upgrade');

                return Mustache.render(
                    TemplateStorage.get('upgrade-tooltip-template__costs'),
                    {
                        costsLabel: translator.translate('automatedBar.beersLabel'),
                        path:       'automatedBar.upgrade.' + upgrade,
                        costs:      (new Beerplop.NumberFormatter()).formatInt(
                            upgradeStorage.getUpgradeByPath(upgrade).costs
                        ),
                        hint:       upgrade.includes('level') &&
                                    $.inArray(upgrade.match(/level\.([a-z]+)/i)[1], upgradeStorage.automatedBar.getItems()) !== -1
                            ? translator.translate('automatedBar.levelUpgradeHint')
                            : null,
                    }
                );
            }
        });

        items.on('click', (function (event) {
            const upgradeKey = $(event.target).closest('.upgrade-item').data('upgrade'),
                  upgrade    = this.getUpgradeByPath(upgradeKey);

            if (!($.inArray(upgradeKey, this.unlockedUpgrades) !== -1)
                || !this.automatedBar.removeBeers(upgrade.costs)
            ) {
                return;
            }

            $(this).tooltip('dispose');

            this.unlockedUpgrades.splice($.inArray(upgradeKey, this.unlockedUpgrades), 1);

            if ($.inArray(upgradeKey, this.reachedUpgrades) !== -1) {
                return;
            }

            this.reachedUpgrades.push(upgradeKey);

            upgrade.reached = true;
            if (upgrade.upgrade) {
                upgrade.upgrade();
            }

            this.checkUnlockedUpgrades();

            upgradeStorage.renderAvailableUpgrades();

            this.gameEventBus.emit(EVENTS.AUTOMATED_BAR.UPGRADE_PURCHASED, upgradeKey);
        }).bind(this));
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
    AutomatedBarUpgradeStorage.prototype._orderUpgrades = function (upgrade1, upgrade2) {
        const costs1 = this.getUpgradeByPath(upgrade1).costs,
              costs2 = this.getUpgradeByPath(upgrade2).costs;

        if (costs1 < costs2) {
            return -1;
        }
        if (costs1 > costs2) {
            return 1;
        }

        return 0;
    };

    AutomatedBarUpgradeStorage.prototype._initUpgrades = function () {
        this.upgrades = {
            // upgrades which depend on the reached level
            level: {
                capacity: {
                    1: {
                        reached: false,
                        costs: 1e5,
                    },
                    2: {
                        reached: false,
                        costs: 1e6,
                    },
                    3: {
                        reached: false,
                        costs: 1e7,
                    },
                    4: {
                        reached: false,
                        costs: 1e8,
                    },
                    5: {
                        reached: false,
                        costs: 1e9,
                    },
                    6: {
                        reached: false,
                        costs: 1e10,
                    },
                    7: {
                        reached: false,
                        costs: 1e11,
                    },
                    8: {
                        reached: false,
                        costs: 1e12,
                    },
                    9: {
                        reached: false,
                        costs: 1e13,
                    },
                },
                price: {
                    1: {
                        reached: false,
                        costs: 1e5,
                    },
                    2: {
                        reached: false,
                        costs: 1e6,
                    },
                    3: {
                        reached: false,
                        costs: 1e7,
                    },
                    4: {
                        reached: false,
                        costs: 1e8,
                    },
                    5: {
                        reached: false,
                        costs: 1e9,
                    },
                    6: {
                        reached: false,
                        costs: 1e10,
                    },
                    7: {
                        reached: false,
                        costs: 1e11,
                    },
                    8: {
                        reached: false,
                        costs: 1e12,
                    },
                    9: {
                        reached: false,
                        costs: 1e13,
                    },
                },
                bar: {
                    1: {
                        reached: false,
                        costs: 5e4,
                    },
                    2: {
                        reached: false,
                        costs: 5e5,
                    },
                    3: {
                        reached: false,
                        costs: 5e6,
                    },
                    4: {
                        reached: false,
                        costs: 5e7,
                    },
                    5: {
                        reached: false,
                        costs: 5e8,
                    },
                    6: {
                        reached: false,
                        costs: 5e9,
                    },
                    7: {
                        reached: false,
                        costs: 5e10,
                    },
                    8: {
                        reached: false,
                        costs: 5e11,
                    },
                    9: {
                        reached: false,
                        costs: 5e12,
                    },
                },
                pipe: {
                    1: {
                        reached: false,
                        costs: 1e4,
                    },
                    2: {
                        reached: false,
                        costs: 1e5,
                    },
                    3: {
                        reached: false,
                        costs: 1e6,
                    },
                    4: {
                        reached: false,
                        costs: 1e7,
                    },
                    5: {
                        reached: false,
                        costs: 1e8,
                    },
                    6: {
                        reached: false,
                        costs: 1e9,
                    },
                    7: {
                        reached: false,
                        costs: 1e10,
                    },
                    8: {
                        reached: false,
                        costs: 1e11,
                    },
                    9: {
                        reached: false,
                        costs: 1e12,
                    },
                },
                table: {
                    1: {
                        reached: false,
                        costs: 25e3,
                    },
                    2: {
                        reached: false,
                        costs: 25e4,
                    },
                    3: {
                        reached: false,
                        costs: 25e5,
                    },
                    4: {
                        reached: false,
                        costs: 25e6,
                    },
                    5: {
                        reached: false,
                        costs: 25e7,
                    },
                    6: {
                        reached: false,
                        costs: 25e8,
                    },
                    7: {
                        reached: false,
                        costs: 25e9,
                    },
                    8: {
                        reached: false,
                        costs: 25e10,
                    },
                    9: {
                        reached: false,
                        costs: 25e11,
                    },
                },
                coolingEngine: {
                    1: {
                        reached: false,
                        requiredLevel: 5,
                        costs: 2e8,
                    },
                },
            },
            // upgrades for unlocking new items
            items: {
                coolingEngine: {
                    reached: false,
                    requiredLevel: 3,
                    costs: 5e6,
                    upgrade: () => this.automatedBar.unlockItem(TYPE_COOLING_ENGINE),
                }
            }
        }
    };

    buildingMinigames.AutomatedBarUpgradeStorage = AutomatedBarUpgradeStorage;
})(BuildingMinigames);

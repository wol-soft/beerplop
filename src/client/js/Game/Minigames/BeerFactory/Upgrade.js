(function(beerFactoryGame) {
    'use strict';

    Upgrade.prototype.upgradePath = null;

    Upgrade.prototype.state       = null;
    Upgrade.prototype.factory     = null;
    Upgrade.prototype.stock       = null;
    Upgrade.prototype.trader      = null;
    Upgrade.prototype.cache       = null;
    Upgrade.prototype.render      = null;
    Upgrade.prototype.uniqueBuild = null;
    Upgrade.prototype.slot        = null;
    Upgrade.prototype.buildQueue  = null;

    Upgrade.prototype.achievementController = null;
    Upgrade.prototype.numberFormatter       = null;

    function Upgrade(state, factory, stock, trader, cache, achievementController, numberFormatter) {
        this.state   = state;
        this.factory = factory;
        this.stock   = stock;
        this.trader  = trader;
        this.cache   = cache;

        this.achievementController = achievementController;
        this.numberFormatter       = numberFormatter;

        this._initUpgradePath();
    }

    Upgrade.prototype.setRender = function (render) {
        this.render = render;
        return this;
    };

    Upgrade.prototype.setUniqueBuild = function (uniqueBuild) {
        this.uniqueBuild = uniqueBuild;
        return this;
    };

    Upgrade.prototype.setSlot = function (slot) {
        this.slot = slot;
        return this;
    };

    Upgrade.prototype.setBuildQueue = function (buildQueue) {
        this.buildQueue = buildQueue;
        return this;
    };

    Upgrade.prototype.getUpgrade = function (factory, upgrade, level) {
        return this.upgradePath[factory][upgrade][level];
    };

    Upgrade.prototype.getUpgradePaths = function (factory) {
        if (!this.state.getFactory(factory).upgrades || !this.upgradePath[factory]) {
            return [];
        }

        let availableUpgrades = [];
        $.each(this.state.getFactory(factory).upgrades, (function mapUpgradePath(upgrade, currentLevel) {
            availableUpgrades.push(
                $.extend(
                    {
                        title:       translator.translate(`beerFactory.upgrade.${factory}.${upgrade}.${currentLevel + 1}.title`),
                        description: translator.translate(`beerFactory.upgrade.${factory}.${upgrade}.${currentLevel + 1}.description`),
                        effect:      translator.translate(`beerFactory.upgrade.${factory}.${upgrade}.${currentLevel + 1}.effect`),
                        completed:   !this.upgradePath[factory][upgrade][currentLevel + 1],
                        locked:      !this.isUpgradePathAvailable(factory, upgrade, currentLevel + 1),
                        upgrade:     upgrade,
                        header:      translator.translate('beerFactory.upgrade.pathLabel.' + upgrade) +
                            ' (' + this.numberFormatter.romanize(currentLevel) + ')',
                    },
                    this.upgradePath[factory][upgrade][currentLevel + 1] || {}
                )
            );
        }).bind(this));

        return availableUpgrades;
    };

    Upgrade.prototype.isUpgradePathAvailable = function (factory, upgrade, level) {
        if (!this.state.getFactory(factory).upgrades ||
            this.state.getFactory(factory).upgrades[upgrade] < level - 1 ||
            !this.upgradePath[factory][upgrade][level]
        ) {
            return false;
        }

        let isAvailable = true;

        // check if another upgrade for the requested factory is currently under construction (only one upgrade at a
        // time per factory is allowed)
        $.each(this.state.getBuildQueue(), function checkUpgradeForFactoryQueued() {
            if (this.action === BUILD_QUEUE__UPGRADE && this.item.factory === factory) {
                isAvailable = false;
                return false;
            }
        });

        if (!isAvailable) {
            return false;
        }

        // check each requirement concerning factory amounts and upgrade paths which must be fulfilled to unlock the
        // requested upgrade path
        $.each(
            this.upgradePath[factory][upgrade][level].requires,
            (function checkUpgradeRequirements(requiredFactory, settings) {
                $.each(settings, (function checkUpgradeRequirement(setting, requirement) {
                    if ((setting === 'amount' && this.state.getFactory(requiredFactory).amount < requirement) ||
                        (setting !== 'amount' && this.state.getFactory(requiredFactory).upgrades[setting] < requirement)
                    ) {
                        isAvailable = false;
                        return false;
                    }
                }).bind(this));

                return isAvailable;
            }).bind(this)
        );

        // check if a custom callback function is defined which must be evaluated to check the availability of the
        // requested upgrade path
        if (isAvailable && this.upgradePath[factory][upgrade][level].requiresCallback) {
            return this.upgradePath[factory][upgrade][level].requiresCallback();
        }

        return isAvailable;
    };

    Upgrade.prototype.getRequiredMaterialsForUpgrade = function (factory, upgrade, level) {
        let materials            = [],
            currentFactoryAmount = this.factory.getFactoryAmount(factory),
            upgradePath          = this.getUpgrade(factory, upgrade, level);

        $.each(
            upgradePath.costs,
            (function (material, amount) {
                materials.push({
                    name:      translator.translate('beerFactory.material.' + material),
                    key:       material,
                    required:  Math.ceil(
                        amount
                            * (upgradePath.fixCosts ? 1 : currentFactoryAmount)
                            * this.factory.getBuilderReduction(BUILD_QUEUE__UPGRADE)
                    ),
                    delivered: 0,
                })
            }).bind(this)
        );

        return materials;
    };

    /**
     * Increase the max amount of jobs queued in the build queue
     *
     * @private
     */
    Upgrade.prototype._incMaxActionsInQueue = function () {
        this.state.getState().maxActionsInQueue++;
        $('#build-queue__max-jobs').text(this.state.getState().maxActionsInQueue);
    };

    /**
     * Set up all upgrade paths and fill the class variable upgradePath
     *
     * @private
     */
    Upgrade.prototype._initUpgradePath = function () {
        const enableMaterial = (function (material) {
                this.state.getMaterial(material).enabled = true;
                this.render.updateStockTable();
            }).bind(this),

            enableFactoryExtension = (function enableFactoryExtension(factoryKey, extension) {
                const factory = this.state.getFactory(factoryKey);

                if (!factory.extensions) {
                    factory.extensions = [];
                }

                if ($.inArray(extension, factory.extensions) !== -1) {
                    console.warn(`Extension ${extension} for factory ${factoryKey} already unlocked`);
                    return;
                }

                factory.extensions.push(extension);

                if (EXTENSIONS[extension].type === EXTENSION_TYPE__PROXY) {
                    this.state.getState().proxyExtension[extension] = {
                        extension: null,
                    };
                } else {
                    this.state.initExtensionStorage(extension, extension);

                    $.each(EXTENSIONS[extension].enableMaterial || [], (function (index, material) {
                        this.state.getMaterial(material).enabled = true;
                    }).bind(this));
                }

                this.state.getState().hasFactoryExtensions = true;

                this.render.updateStockTable();
                this.render.updateFactoriesMap();

                if (this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked[extension]) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked[extension]
                    );
                }
            }).bind(this),

            addLobbyist = () => this.state.getFactory('backRoom').lobbyists.push({
                factory: null,
                name:    chance.name({ middle: true }),
            }),

            raiseTransportByLodge = (function () {
                this.cache.resetDeliverCapacityCache();
                this.stock.updateStock();
                this.render.updateFactoriesMap();
            }).bind(this),

            raiseProductionByLodge = (function () {
                this.state.getFactory('lodge').productionMultiplier += 0.05;
                this.cache.resetProductionAmountCache();
            }).bind(this),

            raiseFactoryExtensionProductionMultiplier = (function (extension) {
                const extensionStorage = this.state.getExtensionStorage(extension);

                if (!extensionStorage.multiplier) {
                    extensionStorage.multiplier = 1;
                }

                extensionStorage.multiplier *= 2;
                delete this.cache.getCache().factoryExtensionProductionCache[extension];
                this.render.updateFactoriesMap();
            }).bind(this);

        this.upgradePath = {
            wood: {
                double: {
                    1: {
                        costs: {
                            wood: 400,
                            strongWood: 75,
                            stone: 350,
                        },
                        requires: {
                            wood: {
                                amount: 5,
                            },
                            stone: {
                                amount: 1,
                            },
                        }
                    },
                    2: {
                        costs: {
                            wood: 2_000,
                            strongWood: 1_000,
                            stone: 1_000,
                            granite: 750,
                        },
                        requires: {
                            wood: {
                                amount: 10,
                            },
                            stone: {
                                double: 1,
                            },
                            transport: {
                                amount: 8,
                            },
                        }
                    },
                    3: {
                        costs: {
                            wood: 6_500,
                            strongWood: 8_000,
                            woodenBeam: 8_000,
                            stone: 14_000,
                            granite: 7_000,
                            iron: 4_500,
                            charcoal: 1_750,
                        },
                        requires: {
                            wood: {
                                amount: 15,
                                diversify: 3,
                            },
                            stone: {
                                double: 2,
                            },
                            iron: {
                                amount: 5,
                            },
                        }
                    },
                    4: {
                        costs: {
                            wood: 159_000,
                            strongWood: 57_000,
                            woodenBeam: 61_000,
                            stone: 130_000,
                            granite: 53_000,
                            iron: 79_000,
                            charcoal: 5_900,
                            tools: 4_550,
                            gold: 12_750,
                        },
                        requires: {
                            wood: {
                                amount: 20,
                            },
                            mine: {
                                amount: 1,
                            },
                        }
                    },
                    5: {
                        costs: {
                            wood: 3_500_000,
                            strongWood: 1_500_000,
                            woodenBeam: 1_500_000,
                            stone: 3_000_000,
                            granite: 1_900_000,
                            iron: 2_570_000,
                            charcoal: 25_000,
                            tools: 15_500,
                            gold: 350_000,
                            marble: 15_000,
                            diamond: 120_000,
                        },
                        requires: {
                            wood: {
                                amount: 25,
                            },
                            mine: {
                                amount: 5,
                            },
                        }
                    },
                    6: {
                        costs: {
                            wood: 35_000_000,
                            strongWood: 15_000_000,
                            woodenBeam: 15_000_000,
                            stone: 30_000_000,
                            granite: 17_000_000,
                            iron: 22_700_000,
                            charcoal: 110_000,
                            tools: 105_000,
                            gold: 3_500_000,
                            marble: 100_000,
                            diamond: 1_200_000,
                            medallion: 10_000,
                        },
                        requires: {
                            wood: {
                                amount: 30,
                            },
                        }
                    },
                    7: {
                        costs: {
                            wood: 1_525_000_000,
                            strongWood: 625_000_000,
                            woodenBeam: 625_000_000,
                            stone: 1_250_000_000,
                            granite: 755_000_000,
                            iron: 1_040_500_000,
                            charcoal: 1_650_000,
                            tools: 1_575_000,
                            gold: 152_500_000,
                            copper: 152_500_000,
                            marble: 1_500_000,
                            diamond: 58_000_000,
                            medallion: 150_000,
                        },
                        requires: {
                            wood: {
                                amount: 35,
                            },
                        }
                    },
                    8: {
                        costs: {
                            wood: 50_875_000_000,
                            strongWood: 25_375_000_000,
                            woodenBeam: 25_375_000_000,
                            stone: 40_750_000_000,
                            granite: 24_825_000_000,
                            iron: 37_107_500_000,
                            charcoal: 24_750_000,
                            tools: 23_625_000,
                            gold: 787_500_000,
                            copper: 4_787_500_000,
                            marble: 22_500_000,
                            diamond: 1_270_000_000,
                            medallion: 2_250_000,
                        },
                        requires: {
                            wood: {
                                amount: 40,
                            },
                        }
                    },
                    9: {
                        costs: {
                            wood: 2_712_250_000_000,
                            strongWood: 955_250_000_000,
                            woodenBeam: 955_250_000_000,
                            stone: 2_470_500_000_000,
                            granite: 907_550_000_000,
                            iron: 1_519_505_000_000,
                            charcoal: 346_500_000,
                            tools: 330_750_000,
                            gold: 41_025_000_000,
                            copper: 67_025_000_000,
                            marble: 315_000_000,
                            diamond: 50_780_000_000,
                            medallion: 31_500_000,
                        },
                        requires: {
                            wood: {
                                amount: 45,
                            },
                        }
                    },
                    10: {
                        costs: {
                            wood: 35_259_250_000_000,
                            strongWood: 12_418_250_000_000,
                            woodenBeam: 12_418_250_000_000,
                            stone: 32_116_500_000_000,
                            granite: 11_798_150_000_000,
                            iron: 19_753_565_000_000,
                            charcoal: 4_504_500_000,
                            tools: 4_299_750_000,
                            gold: 533_325_000_000,
                            copper: 871_325_000_000,
                            marble: 4_095_000_000,
                            diamond: 660_140_000_000,
                            medallion: 409_500_000,
                        },
                        requires: {
                            wood: {
                                amount: 50,
                            },
                        }
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1_000,
                            strongWood: 200,
                            stone: 800,
                        },
                        requires: {
                            wood: {
                                amount: 8,
                                double: 1,
                            },
                            stone: {
                                amount: 3,
                            },
                        },
                        callback: (function () {
                            delete this.cache.getCache().producedMaterialCache['wood'];
                            this.state.getFactory('wood').production.strongWood++;
                        }).bind(this),
                    },
                    2: {
                        costs: {
                            wood: 7_500,
                            strongWood: 4_000,
                            stone: 5_000,
                            granite: 2_500,
                        },
                        requires: {
                            wood: {
                                amount: 10,
                            },
                            storage: {
                                amount: 8,
                            },
                            stone: {
                                amount: 6,
                                diversify: 1,
                                double: 1,
                            },
                        },
                        callback: (function () {
                            delete this.cache.getCache().producedMaterialCache['wood'];
                            this.state.getFactory('wood').production['woodenBeam'] = 2;
                            enableMaterial('woodenBeam');
                        }).bind(this)
                    },
                    3: {
                        costs: {
                            wood: 16_000,
                            strongWood: 6_000,
                            woodenBeam: 4_000,
                            stone: 14_000,
                            granite: 7_000,
                            iron: 2_000,
                        },
                        requires: {
                            wood: {
                                amount: 12,
                            },
                            storage: {
                                amount: 8,
                            },
                            stone: {
                                diversify: 1,
                            },
                            transport: {
                                diversify: 1,
                            },
                            iron: {
                                amount: 1,
                            },
                        },
                        callback: () => enableFactoryExtension('wood', 'charcoal'),
                    },
                    4: {
                        costs: {
                            wood: 520_000,
                            strongWood: 260_000,
                            woodenBeam: 260_000,
                            stone: 495_000,
                            granite: 245_000,
                            iron: 265_000,
                            gold: 12_500,
                            marble: 6_500,
                            tools: 6_000,
                        },
                        requires: {
                            wood: {
                                amount: 20,
                            },
                            mine: {
                                amount: 1,
                            }
                        },
                        callback: (function () {
                            this.state.getExtensionStorage('charcoal').boost = 2;
                            delete this.cache.getCache().factoryExtensionConsumptionCache.charcoal;
                        }).bind(this)
                    },
                    5: {
                        costs: {
                            wood: 42_000_000,
                            strongWood: 18_000_000,
                            woodenBeam: 18_000_000,
                            stone: 36_000_000,
                            granite: 20_400_000,
                            iron: 27_240_000,
                            charcoal: 132_000,
                            tools: 126_000,
                            gold: 4_200_000,
                            copper: 4_200_000,
                            marble: 120_000,
                            diamond: 1_440_000,
                            medallion: 12_000,
                        },
                        requires: {
                            wood: {
                                amount: 30,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('charcoal'),
                    },
                    6: {
                        costs: {
                            wood: 490_000_000,
                            strongWood: 210_000_000,
                            woodenBeam: 210_000_000,
                            stone: 420_000_000,
                            granite: 238_000_000,
                            iron: 317_800_000,
                            charcoal: 1_540_000,
                            tools: 1_470_000,
                            gold: 49_000_000,
                            copper: 49_000_000,
                            marble: 1_400_000,
                            diamond: 16_800_000,
                            medallion: 140_000,
                        },
                        requires: {
                            wood: {
                                amount: 35,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('charcoal'),
                    },
                    7: {
                        costs: {
                            wood: 490_000_000_000,
                            strongWood: 210_000_000_000,
                            woodenBeam: 210_000_000_000,
                            stone: 420_000_000_000,
                            granite: 230_800_000_000,
                            iron: 310_780_000_000,
                            charcoal: 154_000_000,
                            tools: 147_000_000,
                            gold: 40_900_000_000,
                            copper: 90_900_000_000,
                            marble: 140_000_000,
                            diamond: 9_680_000_000,
                            medallion: 14_000_000,
                        },
                        requires: {
                            wood: {
                                amount: 42,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('charcoal'),
                    },
                },
            },
            stone: {
                double: {
                    1: {
                        costs: {
                            wood: 1_000,
                            strongWood: 550,
                            stone: 750,
                        },
                        requires: {
                            wood: {
                                amount: 5,
                            },
                            stone: {
                                amount: 5,
                            },
                        }
                    },
                    2: {
                        costs: {
                            wood: 7_000,
                            strongWood: 3_500,
                            woodenBeam: 3_500,
                            stone: 5_000,
                            granite: 2_500,
                            iron: 2_250,
                        },
                        requires: {
                            wood: {
                                diversify: 2,
                            },
                            stone: {
                                amount: 10,
                            },
                            iron: {
                                amount: 2,
                            },
                        }
                    },
                    3: {
                        costs: {
                            wood: 480_000,
                            strongWood: 242_000,
                            woodenBeam: 242_000,
                            stone: 465_000,
                            granite: 225_000,
                            iron: 136_500,
                            gold: 36_000,
                            tools: 5_500,
                            marble: 4_000,
                        },
                        requires: {
                            stone: {
                                amount: 15,
                                diversify: 3,
                            },
                        }
                    },
                    4: {
                        costs: {
                            wood: 4_000_000,
                            strongWood: 2_200_000,
                            woodenBeam: 2_200_000,
                            stone: 3_500_000,
                            granite: 1_500_000,
                            iron: 1_850_000,
                            gold: 300_000,
                            tools: 14_000,
                            marble: 13_000,
                            diamond: 125_000,
                        },
                        requires: {
                            stone: {
                                amount: 20,
                            }
                        },
                    },
                    5: {
                        costs: {
                            wood: 40_000_000,
                            strongWood: 22_000_000,
                            woodenBeam: 22_000_000,
                            stone: 35_000_000,
                            granite: 15_000_000,
                            iron: 18_500_000,
                            gold: 3_000_000,
                            charcoal: 45_000,
                            tools: 34_000,
                            marble: 40_000,
                            diamond: 1_250_000,
                            medallion: 8_000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            }
                        },
                    },
                    6: {
                        costs: {
                            wood: 400_000_000,
                            strongWood: 220_000_000,
                            woodenBeam: 220_000_000,
                            stone: 300_000_000,
                            granite: 175_000_000,
                            iron: 195_000_000,
                            gold: 35_000_000,
                            charcoal: 230_000,
                            tools: 200_000,
                            marble: 200_000,
                            diamond: 17_000_000,
                            medallion: 80_000,
                        },
                        requires: {
                            stone: {
                                amount: 30,
                            }
                        },
                    },
                    7: {
                        costs: {
                            wood: 10_600_000_000,
                            strongWood: 5_560_000_000,
                            woodenBeam: 5_560_000_000,
                            stone: 4_210_000_000,
                            granite: 1_975_000_000,
                            iron: 5_235_000_000,
                            gold: 895_000_000,
                            copper: 995_000_000,
                            charcoal: 2_990_000,
                            tools: 2_600_000,
                            marble: 2_600_000,
                            diamond: 391_000_000,
                            medallion: 1_040_000,
                        },
                        requires: {
                            stone: {
                                amount: 35,
                            }
                        },
                    },
                    8: {
                        costs: {
                            wood: 390_000_000_000,
                            strongWood: 230_400_000_000,
                            woodenBeam: 230_400_000_000,
                            stone: 330_150_000_000,
                            granite: 140_625_000_000,
                            iron: 180_525_000_000,
                            gold: 20_925_000_000,
                            copper: 30_925_000_000,
                            charcoal: 44_850_000,
                            tools: 39_000_000,
                            marble: 39_000_000,
                            diamond: 20_365_000_000,
                            medallion: 15_600_000,
                        },
                        requires: {
                            stone: {
                                amount: 40,
                            }
                        },
                    },
                    9: {
                        costs: {
                            wood: 5_850_000_000_000,
                            strongWood: 3_456_000_000_000,
                            woodenBeam: 3_456_000_000_000,
                            stone: 4_952_250_000_000,
                            granite: 2_109_375_000_000,
                            iron: 2_707_875_000_000,
                            gold: 313_875_000_000,
                            copper: 463_875_000_000,
                            charcoal: 672_750_000,
                            tools: 585_000_000,
                            marble: 585_000_000,
                            diamond: 305_475_000_000,
                            medallion: 234_000_000,
                        },
                        requires: {
                            stone: {
                                amount: 45,
                            }
                        },
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1_500,
                            strongWood: 750,
                            stone: 1_000,
                        },
                        requires: {
                            wood: {
                                double: 1,
                                diversify: 1,
                            },
                            stone: {
                                amount: 5,
                            },
                        },
                        callback: (function () {
                            delete this.cache.getCache().producedMaterialCache['stone'];
                            this.state.getFactory('stone').production = {
                                stone: 2,
                                granite: 1,
                            };
                            enableMaterial('granite');
                        }).bind(this)
                    },
                    2: {
                        costs: {
                            wood: 12_500,
                            strongWood: 9_500,
                            woodenBeam: 8_500,
                            charcoal: 1_000,
                            stone: 12_000,
                            granite: 6_000,
                            iron: 7_000,
                        },
                        requires: {
                            wood: {
                                amount: 13,
                                diversify: 3,
                            },
                            storage: {
                                amount: 8,
                            },
                            stone: {
                                amount: 12,
                            },
                            transport: {
                                diversify: 1,
                            },
                            iron: {
                                amount: 6,
                            },
                        },
                        callback: (function () {
                            enableFactoryExtension('stone', 'mason');
                        }).bind(this)
                    },
                    3: {
                        costs: {
                            wood: 14_000,
                            strongWood: 11_000,
                            woodenBeam: 10_000,
                            charcoal: 2_000,
                            stone: 15_000,
                            granite: 8_000,
                            marble: 1_500,
                            iron: 10_000,
                            tools: 1_500,
                            gold: 2_000,
                        },
                        requires: {
                            mine: {
                                amount: 4,
                            },
                            transport: {
                                diversify: 2,
                            }
                        },
                        callback: (function () {
                            enableFactoryExtension('stone', 'basePlate');
                        }).bind(this)
                    },
                    4: {
                        costs: {
                            wood: 50_000_000,
                            strongWood: 23_000_000,
                            woodenBeam: 23_000_000,
                            stone: 42_000_000,
                            granite: 19_000_000,
                            iron: 26_500_000,
                            gold: 3_900_000,
                            charcoal: 55_000,
                            tools: 36_000,
                            marble: 42_000,
                            diamond: 1_550_000,
                            medallion: 9_000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            },
                        },
                    },
                    5: {
                        costs: {
                            wood: 500_000_000,
                            strongWood: 230_000_000,
                            woodenBeam: 230_000_000,
                            stone: 420_000_000,
                            granite: 190_000_000,
                            iron: 265_000_000,
                            gold: 39_000_000,
                            copper: 39_000_000,
                            charcoal: 550_000,
                            tools: 360_000,
                            marble: 420_000,
                            diamond: 15_500_000,
                            medallion: 90_000,
                        },
                        requires: {
                            stone: {
                                amount: 30,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('mason'),
                    },
                    6: {
                        costs: {
                            wood: 600_000_000,
                            strongWood: 276_000_000,
                            woodenBeam: 276_000_000,
                            stone: 504_000_000,
                            granite: 228_000_000,
                            iron: 318_000_000,
                            gold: 46_800_000,
                            copper: 46_800_000,
                            charcoal: 660_000,
                            tools: 432_000,
                            marble: 504_000,
                            diamond: 18_600_000,
                            medallion: 108_000,
                        },
                        requires: {
                            stone: {
                                amount: 32,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('basePlate'),
                    },
                    7: {
                        costs: {
                            wood: 6_000_000_000,
                            strongWood: 2_760_000_000,
                            woodenBeam: 2_760_000_000,
                            stone: 5_040_000_000,
                            granite: 2_280_000_000,
                            iron: 3_180_000_000,
                            gold: 468_000_000,
                            copper: 468_000_000,
                            charcoal: 6_600_000,
                            tools: 4_320_000,
                            marble: 5_040_000,
                            diamond: 186_000_000,
                            medallion: 1_080_000,
                        },
                        requires: {
                            stone: {
                                amount: 35,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('mason'),
                    },
                    8: {
                        costs: {
                            wood: 7_200_000_000,
                            strongWood: 3_312_000_000,
                            woodenBeam: 3_312_000_000,
                            stone: 6_048_000_000,
                            granite: 2_736_000_000,
                            iron: 3_816_000_000,
                            gold: 561_600_000,
                            copper: 561_600_000,
                            charcoal: 7_920_000,
                            tools: 5_184_000,
                            marble: 6_048_000,
                            diamond: 223_200_000,
                            medallion: 1_296_000,
                        },
                        requires: {
                            stone: {
                                amount: 38,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('basePlate'),
                    },
                    9: {
                        costs: {
                            wood: 900_000_000_000,
                            strongWood: 410_400_000_000,
                            woodenBeam: 410_400_000_000,
                            stone: 750_600_000_000,
                            granite: 340_200_000_000,
                            iron: 470_700_000_000,
                            gold: 70_020_000_000,
                            copper: 70_020_000_000,
                            charcoal: 99_000_000,
                            tools: 64_800_000,
                            marble: 75_600_000,
                            diamond: 20_790_000_000,
                            medallion: 16_200_000,
                        },
                        requires: {
                            stone: {
                                amount: 42,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('mason'),
                    },
                    10: {
                        costs: {
                            wood: 7_200_000_000,
                            strongWood: 3_312_000_000,
                            woodenBeam: 3_312_000_000,
                            stone: 6_048_000_000,
                            granite: 2_736_000_000,
                            iron: 3_816_000_000,
                            gold: 561_600_000,
                            copper: 561_600_000,
                            charcoal: 7_920_000,
                            tools: 5_184_000,
                            marble: 6_048_000,
                            diamond: 223_200_000,
                            medallion: 1_296_000,
                        },
                        requires: {
                            stone: {
                                amount: 45,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('basePlate'),
                    },
                },
            },
            storage: {
                double: {
                    1: {
                        costs: {
                            wood: 1_150,
                            strongWood: 600,
                            stone: 800,
                        },
                        requires: {
                            wood: {
                                amount: 5,
                            },
                            stone: {
                                amount: 5,
                            },
                            storage: {
                                amount: 5,
                            }
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    2: {
                        costs: {
                            wood: 3_000,
                            strongWood: 4_000,
                            woodenBeam: 4_000,
                            stone: 3_000,
                            granite: 2_500,
                            iron: 2_000,
                        },
                        requires: {
                            wood: {
                                diversify: 2,
                            },
                            stone: {
                                diversify: 1,
                            },
                            transport: {
                                amount: 10,
                            },
                            storage: {
                                amount: 10,
                            },
                            iron: {
                                amount: 5,
                            }
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    3: {
                        costs: {
                            wood: 90_000,
                            strongWood: 80_000,
                            woodenBeam: 80_000,
                            stone: 100_000,
                            granite: 80_000,
                            iron: 70_000,
                            charcoal: 2_000,
                            tools: 2_500,
                            marble: 1_550,
                        },
                        requires: {
                            transport: {
                                amount: 10,
                            },
                            storage: {
                                amount: 15,
                            },
                            iron: {
                                diversify: 1,
                            }
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    4: {
                        costs: {
                            wood: 1_500_000,
                            strongWood: 600_000,
                            woodenBeam: 600_000,
                            stone: 1_200_000,
                            granite: 512_000,
                            iron: 550_000,
                            charcoal: 5_400,
                            tools: 5_300,
                            marble: 3_500,
                            gold: 75_000,
                            diamond: 55_000,
                        },
                        requires: {
                            storage: {
                                amount: 20,
                            },
                            mine: {
                                amount: 2,
                            }
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    5: {
                        costs: {
                            wood: 40_000_000,
                            strongWood: 23_000_000,
                            woodenBeam: 23_000_000,
                            stone: 33_000_000,
                            granite: 14_000_000,
                            iron: 17_500_000,
                            gold: 2_800_000,
                            charcoal: 39_000,
                            tools: 33_000,
                            marble: 40_000,
                            diamond: 1_750_000,
                            medallion: 8_000,
                        },
                        requires: {
                            storage: {
                                amount: 25,
                            },
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    6: {
                        costs: {
                            wood: 360_000_000,
                            strongWood: 207_000_000,
                            woodenBeam: 207_000_000,
                            stone: 297_000_000,
                            granite: 126_000_000,
                            iron: 157_500_000,
                            gold: 25_200_000,
                            copper: 25_200_000,
                            charcoal: 351_000,
                            tools: 297_000,
                            marble: 360_000,
                            diamond: 15_750_000,
                            medallion: 72_000,
                        },
                        requires: {
                            storage: {
                                amount: 30,
                            },
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    7: {
                        costs: {
                            wood: 3_240_000_000,
                            strongWood: 1_863_000_000,
                            woodenBeam: 1_863_000_000,
                            stone: 2_673_000_000,
                            granite: 1_134_000_000,
                            iron: 1_417_500_000,
                            gold: 226_800_000,
                            copper: 226_800_000,
                            charcoal: 3_159_000,
                            tools: 2_673_000,
                            marble: 3_240_000,
                            diamond: 141_750_000,
                            medallion: 648_000,
                        },
                        requires: {
                            storage: {
                                amount: 35,
                            },
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    8: {
                        costs: {
                            wood: 29_160_000_000,
                            strongWood: 16_767_000_000,
                            woodenBeam: 16_767_000_000,
                            stone: 24_057_000_000,
                            granite: 10_206_000_000,
                            iron: 12_757_500_000,
                            gold: 2_041_200_000,
                            copper: 2_041_200_000,
                            charcoal: 28_431_000,
                            tools: 3_005_700,
                            marble: 3_016_000,
                            diamond: 1_275_750_000,
                            medallion: 1_132_000,
                        },
                        requires: {
                            storage: {
                                amount: 40,
                            },
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    9: {
                        costs: {
                            wood: 262_440_000_000,
                            strongWood: 150_903_000_000,
                            woodenBeam: 150_903_000_000,
                            stone: 216_513_000_000,
                            granite: 91_854_000_000,
                            iron: 114_817_500_000,
                            gold: 18_370_800_000,
                            copper: 18_370_800_000,
                            charcoal: 255_879_000,
                            tools: 27_051_300,
                            marble: 27_144_000,
                            diamond: 11_481_750_000,
                            medallion: 10_188_000,
                        },
                        requires: {
                            storage: {
                                amount: 45,
                            },
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                    10: {
                        costs: {
                            wood: 13_500_000_000_000,
                            strongWood: 6_156_000_000_000,
                            woodenBeam: 6_156_000_000_000,
                            stone: 11_259_000_000_000,
                            granite: 5_103_000_000_000,
                            iron: 7_060_500_000_000,
                            gold: 1_050_300_000_000,
                            copper: 1_050_300_000_000,
                            charcoal: 1_485_000_000,
                            tools: 972_000_000,
                            marble: 1_134_000_000,
                            diamond: 311_850_000_000,
                            medallion: 243_000_000,
                        },
                        requires: {
                            storage: {
                                amount: 50,
                            },
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 2_000,
                            strongWood: 950,
                            stone: 1_300,
                        },
                        requires: {
                            wood: {
                                amount: 5,
                            },
                            transport: {
                                amount: 5,
                            },
                            storage: {
                                amount: 5,
                            }
                        },
                        callback: (function () {
                            this.cache.resetDeliverCapacityCache();
                            this.stock.updateStock();
                        }).bind(this)
                    },
                    2: {
                        costs: {
                            strongWood: 8_000,
                            woodenBeam: 7_000,
                            stone: 7_000,
                            granite: 4_000,
                            marble: 750,
                            iron: 3_000,
                        },
                        requires: {
                            wood: {
                                diversify: 3,
                            },
                            transport: {
                                diversify: 1,
                            },
                            stone: {
                                diversify: 2,
                            }
                        },
                        callback: (function () {
                            this.state.getState().extensionStorageCapacity *= 2;
                        }).bind(this)
                    },
                    3: {
                        costs: {
                            wood: 100_000,
                            strongWood: 40_000,
                            woodenBeam: 45_000,
                            stone: 90_000,
                            granite: 45_000,
                            iron: 60_000,
                            marble: 7_500,
                            tools: 4_000,
                            gold: 10_000,
                        },
                        requires: {
                            wood: {
                                diversify: 3,
                            },
                            transport: {
                                diversify: 1,
                            },
                            mine: {
                                amount: 2,
                            },
                            storage: {
                                amount: 17,
                            }
                        },
                        callback: (function () {
                            this.state.getState().extensionStorageCapacity *= 2;
                        }).bind(this)
                    },
                    4: {
                        costs: {
                            wood: 2_000_000,
                            strongWood: 800_000,
                            woodenBeam: 900_000,
                            stone: 1_800_000,
                            granite: 900_000,
                            iron: 1_200_000,
                            copper: 500_000,
                            marble: 15_000,
                            tools: 20_000,
                            gold: 200_000,
                            diamond: 90_000,
                        },
                        requires: {
                            storage: {
                                amount: 20,
                            }
                        },
                        callback: () => enableFactoryExtension('storage', 'coworker'),
                    },
                    5: {
                        costs: {
                            wood: 30_000_000,
                            strongWood: 13_000_000,
                            woodenBeam: 13_000_000,
                            stone: 20_000_000,
                            granite: 9_000_000,
                            iron: 10_500_000,
                            gold: 1_500_000,
                            charcoal: 29_000,
                            tools: 19_000,
                            marble: 25_000,
                            diamond: 1_050_000,
                            medallion: 7_000,
                        },
                        requires: {
                            storage: {
                                amount: 25,
                            }
                        },
                        callback: (function () {
                            this.state.getState().extensionStorageCapacity *= 2;
                        }).bind(this)
                    },
                    6: {
                        costs: {
                            wood: 270_000_000,
                            strongWood: 117_000_000,
                            woodenBeam: 117_000_000,
                            stone: 180_000_000,
                            granite: 81_000_000,
                            iron: 94_500_000,
                            gold: 13_500_000,
                            copper: 13_500_000,
                            charcoal: 261_000,
                            tools: 171_000,
                            marble: 225_000,
                            diamond: 9_450_000,
                            medallion: 63_000,
                        },
                        requires: {
                            storage: {
                                amount: 30,
                            }
                        },
                        callback: (function () {
                            this.state.getState().extensionStorageCapacity *= 4;
                        }).bind(this)
                    },
                    7: {
                        costs: {
                            wood: 2_430_000_000,
                            strongWood: 1_053_000_000,
                            woodenBeam: 1_053_000_000,
                            stone: 1_620_000_000,
                            granite: 729_000_000,
                            iron: 850_500_000,
                            gold: 121_500_000,
                            copper: 121_500_000,
                            charcoal: 2_349_000,
                            tools: 1_539_000,
                            marble: 2_025_000,
                            diamond: 85_050_000,
                            medallion: 567_000,
                        },
                        requires: {
                            storage: {
                                amount: 35,
                            }
                        },
                        callback: () => enableFactoryExtension('storage', 'planned'),
                    },
                },
            },
            transport: {
                double: {
                    1: {
                        costs: {
                            wood: 800,
                            strongWood: 600,
                            stone: 800,
                            granite: 400,
                        },
                        requires: {
                            wood: {
                                diversify: 1,
                            },
                            stone: {
                                diversify: 1,
                            },
                            transport: {
                                amount: 8,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    2: {
                        costs: {
                            wood: 2_500,
                            strongWood: 2_000,
                            woodenBeam: 1_850,
                            stone: 2_750,
                            granite: 1_800,
                        },
                        requires: {
                            wood: {
                                diversify: 2,
                            },
                            stone: {
                                diversify: 1,
                            },
                            transport: {
                                amount: 10,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    3: {
                        costs: {
                            wood: 13_500,
                            strongWood: 8_000,
                            woodenBeam: 10_000,
                            stone: 13_500,
                            granite: 8_000,
                            iron: 1_500,
                            tools: 1_000,
                        },
                        requires: {
                            transport: {
                                amount: 14,
                            },
                            iron: {
                                diversify: 1,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    4: {
                        costs: {
                            wood: 55_000,
                            strongWood: 29_000,
                            woodenBeam: 40_000,
                            stone: 56_000,
                            granite: 29_000,
                            iron: 40_000,
                            charcoal: 3_000,
                            marble: 4_000,
                            tools: 4_000,
                            gold: 2_300,
                        },
                        requires: {
                            transport: {
                                amount: 18,
                            },
                            mine: {
                                amount: 1,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    5: {
                        costs: {
                            wood: 5_750_000,
                            strongWood: 3_250_000,
                            woodenBeam: 3_300_000,
                            stone: 5_600_000,
                            granite: 3_300_000,
                            iron: 4_500_000,
                            charcoal: 34_000,
                            marble: 22_000,
                            tools: 20_000,
                            gold: 36_000,
                        },
                        requires: {
                            transport: {
                                amount: 22,
                            },
                            mine: {
                                amount: 5,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    6: {
                        costs: {
                            wood: 50_000_000,
                            strongWood: 27_000_000,
                            woodenBeam: 27_000_000,
                            stone: 39_000_000,
                            granite: 17_000_000,
                            iron: 20_500_000,
                            gold: 3_300_000,
                            charcoal: 49_000,
                            tools: 39_000,
                            marble: 45_000,
                            diamond: 2_050_000,
                            medallion: 10_000,
                        },
                        requires: {
                            transport: {
                                amount: 26,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    7: {
                        costs: {
                            wood: 400_000_000,
                            strongWood: 216_000_000,
                            woodenBeam: 216_000_000,
                            stone: 312_000_000,
                            granite: 136_000_000,
                            iron: 164_000_000,
                            gold: 26_400_000,
                            copper: 26_400_000,
                            charcoal: 392_000,
                            tools: 312_000,
                            marble: 360_000,
                            diamond: 16_400_000,
                            medallion: 80_000,
                        },
                        requires: {
                            transport: {
                                amount: 30,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    8: {
                        costs: {
                            wood: 3_200_000_000,
                            strongWood: 1_728_000_000,
                            woodenBeam: 1_728_000_000,
                            stone: 2_496_000_000,
                            granite: 1_088_000_000,
                            iron: 1_312_000_000,
                            gold: 211_200_000,
                            copper: 211_200_000,
                            charcoal: 3_136_000,
                            tools: 2_496_000,
                            marble: 2_880_000,
                            diamond: 131_200_000,
                            medallion: 640_000,
                        },
                        requires: {
                            transport: {
                                amount: 34,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    9: {
                        costs: {
                            wood: 25_600_000_000,
                            strongWood: 13_824_000_000,
                            woodenBeam: 13_824_000_000,
                            stone: 19_968_000_000,
                            granite: 8_704_000_000,
                            iron: 10_496_000_000,
                            gold: 1_689_600_000,
                            copper: 1_689_600_000,
                            charcoal: 25_088_000,
                            tools: 8_968_000,
                            marble: 8_040_000,
                            diamond: 1_049_600_000,
                            medallion: 920_000,
                        },
                        requires: {
                            transport: {
                                amount: 38,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    10: {
                        costs: {
                            wood: 204_800_000_000,
                            strongWood: 110_592_000_000,
                            woodenBeam: 110_592_000_000,
                            stone: 159_744_000_000,
                            granite: 69_632_000_000,
                            iron: 83_968_000_000,
                            gold: 13_516_800_000,
                            copper: 13_516_800_000,
                            charcoal: 200_704_000,
                            tools: 11_744_000,
                            marble: 11_320_000,
                            diamond: 8_396_800_000,
                            medallion: 736_000,
                        },
                        requires: {
                            transport: {
                                amount: 42,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    11: {
                        costs: {
                            wood: 3_072_000_000_000,
                            strongWood: 1_658_880_000_000,
                            woodenBeam: 1_658_880_000_000,
                            stone: 2_396_160_000_000,
                            granite: 1_044_480_000_000,
                            iron: 1_259_520_000_000,
                            gold: 202_752_000_000,
                            copper: 202_752_000_000,
                            charcoal: 3_010_560_000,
                            tools: 176_160_000,
                            marble: 169_800_000,
                            diamond: 125_952_000_000,
                            medallion: 11_040_000,
                        },
                        requires: {
                            transport: {
                                amount: 46,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                    12: {
                        costs: {
                            wood: 46_080_000_000_000,
                            strongWood: 24_883_200_000_000,
                            woodenBeam: 24_883_200_000_000,
                            stone: 35_942_400_000_000,
                            granite: 15_667_200_000_000,
                            iron: 18_892_800_000_000,
                            gold: 3_041_280_000_000,
                            copper: 3_041_280_000_000,
                            charcoal: 45_158_400_000,
                            tools: 2_642_400_000,
                            marble: 2_547_000_000,
                            diamond: 1_889_280_000_000,
                            medallion: 165_600_000,
                        },
                        requires: {
                            transport: {
                                amount: 50,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 6_000,
                            strongWood: 1_500,
                            woodenBeam: 1_750,
                            stone: 6_000,
                            granite: 3_500,
                            iron: 3_000,
                        },
                        requires: {
                            stone: {
                                diversify: 1,
                            },
                            transport: {
                                amount: 10,
                                double: 1,
                            },
                            iron: {
                                amount: 4,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 200_000,
                            strongWood: 100_000,
                            woodenBeam: 100_000,
                            stone: 180_000,
                            granite: 80_000,
                            iron: 100_000,
                            gold: 20_000,
                            tools: 7_000,
                        },
                        requires: {
                            transport: {
                                amount: 15,
                            },
                            mine: {
                                amount: 2,
                            },
                        },
                    },
                    3: {
                        costs: {
                            wood: 1_700_000,
                            strongWood: 900_000,
                            woodenBeam: 900_000,
                            stone: 1_500_000,
                            granite: 850_000,
                            iron: 1_100_000,
                            gold: 200_000,
                            tools: 11_000,
                            marble: 10_000,
                            charcoal: 13_000,
                        },
                        requires: {
                            transport: {
                                amount: 20,
                            },
                        },
                        callback: () => this.state.getState().extensionTransportDividend -= 1.5,
                    },
                    4: {
                        costs: {
                            wood: 440_000_000,
                            strongWood: 237_600_000,
                            woodenBeam: 237_600_000,
                            stone: 343_200_000,
                            granite: 149_600_000,
                            iron: 180_400_000,
                            gold: 29_040_000,
                            copper: 29_040_000,
                            charcoal: 431_200,
                            tools: 343_200,
                            marble: 396_000,
                            diamond: 18_040_000,
                            medallion: 88_000,
                        },
                        requires: {
                            transport: {
                                amount: 30,
                            },
                        },
                        callback: () => this.state.getState().extensionTransportDividend -= 1,
                    },
                    5: {
                        costs: {
                            wood: 1_024_000_000_000,
                            strongWood: 552_960_000_000,
                            woodenBeam: 552_960_000_000,
                            stone: 798_720_000_000,
                            granite: 348_160_000_000,
                            iron: 419_840_000_000,
                            gold: 67_584_000_000,
                            copper: 67_584_000_000,
                            charcoal: 1_003_520_000,
                            tools: 58_720_000,
                            marble: 56_600_000,
                            diamond: 41_984_000_000,
                            medallion: 3_680_000,
                        },
                        requires: {
                            transport: {
                                amount: 40,
                            },
                        },
                        callback: () => this.state.getState().extensionTransportDividend -= 1,
                    },
                },
            },
            iron: {
                double: {
                    1: {
                        costs: {
                            wood: 10_000,
                            strongWood: 10_000,
                            woodenBeam: 7_500,
                            stone: 8_000,
                            granite: 4_500,
                            iron: 3_750,
                            charcoal: 800,
                        },
                        requires: {
                            wood: {
                                diversify: 3,
                            },
                            stone: {
                                diversify: 1,
                            },
                            transport: {
                                amount: 10,
                            },
                            iron: {
                                amount: 5,
                            }
                        },
                    },
                    2: {
                        costs: {
                            wood: 500_000,
                            strongWood: 250_000,
                            woodenBeam: 235_000,
                            stone: 400_000,
                            granite: 250_000,
                            iron: 175_000,
                            charcoal: 13_000,
                            tools: 9_000,
                            marble: 10_000,
                        },
                        requires: {
                            iron: {
                                amount: 12,
                                diversify: 1,
                            }
                        },
                    },
                    3: {
                        costs: {
                            wood: 1_100_000,
                            strongWood: 550_000,
                            woodenBeam: 535_000,
                            stone: 1_200_000,
                            granite: 650_000,
                            iron: 850_000,
                            copper: 150_000,
                            charcoal: 40_000,
                            tools: 25_000,
                            marble: 30_000,
                            gold: 300_000,
                            diamond: 100_000,
                        },
                        requires: {
                            iron: {
                                amount: 18,
                                diversify: 2,
                            },
                            mine: {
                                amount: 5,
                            }
                        },
                    },
                    4: {
                        costs: {
                            wood: 5_000_000,
                            strongWood: 2_700_000,
                            woodenBeam: 2_700_000,
                            stone: 3_900_000,
                            granite: 1_700_000,
                            iron: 2_050_000,
                            gold: 340_000,
                            tools: 17_000,
                            marble: 16_000,
                            diamond: 185_000,
                            copper: 150_000,
                        },
                        requires: {
                            iron: {
                                amount: 22,
                            },
                        },
                    },
                    5: {
                        costs: {
                            wood: 50_000_000,
                            strongWood: 27_000_000,
                            woodenBeam: 27_000_000,
                            stone: 39_000_000,
                            granite: 17_000_000,
                            iron: 20_500_000,
                            gold: 3_300_000,
                            charcoal: 49_000,
                            tools: 39_000,
                            marble: 45_000,
                            diamond: 2_050_000,
                            medallion: 10_000,
                        },
                        requires: {
                            iron: {
                                amount: 26,
                            },
                        },
                    },
                    6: {
                        costs: {
                            wood: 400_000_000,
                            strongWood: 216_000_000,
                            woodenBeam: 216_000_000,
                            stone: 312_000_000,
                            granite: 136_000_000,
                            iron: 164_000_000,
                            gold: 26_400_000,
                            copper: 26_400_000,
                            charcoal: 392_000,
                            tools: 312_000,
                            marble: 360_000,
                            diamond: 16_400_000,
                            medallion: 80_000,
                        },
                        requires: {
                            iron: {
                                amount: 30,
                            },
                        },
                    },
                    7: {
                        costs: {
                            wood: 30_840_000_000,
                            strongWood: 16_073_600_000,
                            woodenBeam: 16_073_600_000,
                            stone: 20_995_200_000,
                            granite: 10_305_600_000,
                            iron: 10_574_400_000,
                            gold: 2_503_440_000,
                            copper: 2_503_440_000,
                            charcoal: 3_763_200,
                            tools: 2_995_200,
                            marble: 3_456_000,
                            diamond: 1_257_440_000,
                            medallion: 768_000,
                        },
                        requires: {
                            iron: {
                                amount: 34,
                            },
                        },
                    },
                    8: {
                        costs: {
                            wood: 2_162_600_000_000,
                            strongWood: 841_104_000_000,
                            woodenBeam: 841_104_000_000,
                            stone: 1_614_928_000_000,
                            granite: 654_584_000_000,
                            iron: 658_616_000_000,
                            gold: 137_551_600_000,
                            copper: 137_551_600_000,
                            charcoal: 56_448_000,
                            tools: 44_928_000,
                            marble: 51_840_000,
                            diamond: 218_861_600_000,
                            medallion: 11_520_000,
                        },
                        requires: {
                            iron: {
                                amount: 38,
                            },
                        },
                    },
                    9: {
                        costs: {
                            wood: 32_439_000_000_000,
                            strongWood: 12_616_560_000_000,
                            woodenBeam: 12_616_560_000_000,
                            stone: 24_223_920_000_000,
                            granite: 9_818_760_000_000,
                            iron: 9_879_240_000_000,
                            gold: 2_063_274_000_000,
                            copper: 2_063_274_000_000,
                            charcoal: 846_720_000,
                            tools: 673_920_000,
                            marble: 777_600_000,
                            diamond: 3_282_924_000_000,
                            medallion: 172_800_000,
                        },
                        requires: {
                            iron: {
                                amount: 42,
                            },
                        },
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 17_500,
                            strongWood: 7_000,
                            woodenBeam: 8_000,
                            stone: 16_000,
                            granite: 7_000,
                            iron: 9_000,
                            charcoal: 2_500,
                        },
                        requires: {
                            wood: {
                                diversify: 2,
                            },
                            stone: {
                                diversify: 1,
                            },
                            iron: {
                                amount: 8,
                            },
                            transport: {
                                diversify: 1,
                            },
                        },
                        callback: (function () {
                            enableFactoryExtension('iron', 'blacksmith');
                        }).bind(this),
                    },
                    2: {
                        costs: {
                            wood: 175_000,
                            strongWood: 83_000,
                            woodenBeam: 95_000,
                            stone: 170_000,
                            granite: 80_000,
                            iron: 145_000,
                            charcoal: 2_500,
                            tools: 4_000,
                            marble: 2_500,
                            gold: 35_000,
                        },
                        requires: {
                            academy: {
                                amount: 1,
                            },
                        },
                        callback: (function () {
                            delete this.cache.getCache().producedMaterialCache['iron'];
                            this.state.getFactory('iron').production = {
                                iron: 3,
                                copper: 1,
                            };
                            enableMaterial('copper');
                        }).bind(this),
                    },
                    3: {
                        costs: {
                            wood: 400_000_000,
                            strongWood: 216_000_000,
                            woodenBeam: 216_000_000,
                            stone: 312_000_000,
                            granite: 136_000_000,
                            iron: 164_000_000,
                            gold: 26_400_000,
                            copper: 26_400_000,
                            charcoal: 392_000,
                            tools: 312_000,
                            marble: 360_000,
                            diamond: 16_400_000,
                            medallion: 80_000,
                        },
                        requires: {
                            stone: {
                                amount: 28,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('blacksmith'),
                    },
                    4: {
                        costs: {
                            wood: 500_000_000,
                            strongWood: 230_000_000,
                            woodenBeam: 230_000_000,
                            stone: 420_000_000,
                            granite: 190_000_000,
                            iron: 265_000_000,
                            gold: 39_000_000,
                            copper: 39_000_000,
                            charcoal: 550_000,
                            tools: 360_000,
                            marble: 420_000,
                            diamond: 15_500_000,
                            medallion: 90_000,
                        },
                        requires: {
                            stone: {
                                amount: 34,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('blacksmith'),
                    },
                },
            },
            lodge: {
                capacity: {
                    1: {
                        costs: {
                            wood: 8_000,
                            strongWood: 3_000,
                            woodenBeam: 4_000,
                            stone: 7_000,
                            granite: 4_000,
                            iron: 3_500,
                            charcoal: 1_000,
                        },
                        requires: {
                            wood: {
                                diversify: 3,
                            },
                            stone: {
                                diversify: 1,
                            },
                            lodge: {
                                amount: 4,
                            },
                        },
                        callback: raiseProductionByLodge,
                    },
                    2: {
                        costs: {
                            wood: 80_000,
                            strongWood: 30_000,
                            woodenBeam: 40_000,
                            stone: 70_000,
                            granite: 40_000,
                            iron: 35_000,
                            charcoal: 8_000,
                        },
                        requires: {
                            lodge: {
                                amount: 10,
                            },
                            transport: {
                                amount: 15,
                            },
                        },
                        callback: () => this.state.getState().extensionTransportDividend -= 2.5,
                    },
                    3: {
                        costs: {
                            wood: 6_000_000,
                            strongWood: 2_400_000,
                            woodenBeam: 1_800_000,
                            stone: 5_800_000,
                            granite: 2_700_000,
                            iron: 3_600_000,
                            copper: 1_500_000,
                            marble: 37_000,
                            tools: 50_000,
                            gold: 600_000,
                            diamond: 270_000,
                            medallion: 5_000,
                        },
                        requires: {
                            lodge: {
                                amount: 14,
                            }
                        },
                        callback: (function () {
                            enableFactoryExtension('lodge', 'bully');
                        }).bind(this)
                    },
                    4: {
                        costs: {
                            charcoal: 225_000,
                            copper: 1_500_000,
                            diamond: 1_000_000,
                            gold: 2_500_000,
                            granite: 11_750_000,
                            iron: 17_350_000,
                            marble: 150_000,
                            stone: 23_650_000,
                            strongWood: 11_350_000,
                            tools: 135_000,
                            wood: 23_100_000,
                            woodenBeam: 11_925_000,
                        },
                        requires: {
                            lodge: {
                                amount: 18,
                            },
                        },
                        callback: raiseProductionByLodge,
                    },
                    5: {
                        costs: {
                            charcoal: 4_500_000,
                            copper: 30_000_000,
                            diamond: 20_000_000,
                            gold: 50_000_000,
                            granite: 235_000_000,
                            iron: 347_000_000,
                            marble: 3_000_000,
                            medallion: 440_000,
                            stone: 473_000_000,
                            strongWood: 227_000_000,
                            tools: 2_700_000,
                            wood: 462_000_000,
                            woodenBeam: 238_500_000,
                        },
                        requires: {
                            lodge: {
                                amount: 28,
                            },
                        },
                        callback: raiseProductionByLodge,
                    },
                },
                comfort: {
                    1: {
                        costs: {
                            wood: 9_000,
                            strongWood: 3_000,
                            woodenBeam: 5_000,
                            stone: 8_000,
                            granite: 5_000,
                            iron: 5_000,
                            charcoal: 1_000,
                            marble: 500,
                        },
                        requires: {
                            wood: {
                                diversify: 3,
                            },
                            stone: {
                                diversify: 2,
                            },
                            lodge: {
                                amount: 5,
                            },
                        },
                        callback: raiseTransportByLodge,
                    },
                    2: {
                        costs: {
                            wood: 120_000,
                            strongWood: 70_000,
                            woodenBeam: 85_000,
                            stone: 130_000,
                            granite: 95_000,
                            iron: 70_000,
                            charcoal: 10_000,
                            marble: 9_000,
                            tools: 8_000,
                        },
                        requires: {
                            iron: {
                                diversify: 1,
                            },
                            stone: {
                                diversify: 2,
                            },
                            lodge: {
                                amount: 8,
                            },
                        },
                        callback: raiseTransportByLodge,
                    },
                    3: {
                        costs: {
                            wood: 620_000,
                            strongWood: 270_000,
                            woodenBeam: 385_000,
                            stone: 730_000,
                            granite: 350_000,
                            iron: 470_000,
                            charcoal: 21_000,
                            marble: 16_000,
                            tools: 17_000,
                            gold: 30_000,
                        },
                        requires: {
                            iron: {
                                diversify: 1,
                            },
                            stone: {
                                diversify: 2,
                            },
                            mine: {
                                amount: 1,
                            },
                            lodge: {
                                amount: 12,
                            },
                        },
                        callback: raiseTransportByLodge,
                    },
                    4: {
                        costs: {
                            wood: 4_620_000,
                            strongWood: 2_270_000,
                            woodenBeam: 2_385_000,
                            stone: 4_730_000,
                            granite: 2_350_000,
                            iron: 3_470_000,
                            charcoal: 45_000,
                            marble: 30_000,
                            tools: 27_000,
                            gold: 500_000,
                            diamond: 200_000,
                            copper: 300_000,
                        },
                        requires: {
                            lodge: {
                                amount: 17,
                            },
                        },
                        callback: raiseTransportByLodge,
                    },
                },
            },
            queue: {
                capacity: {
                    1: {
                        costs: {
                            wood: 100_000,
                            strongWood: 50_000,
                            woodenBeam: 50_000,
                            stone: 90_000,
                            granite: 60_000,
                            iron: 50_000,
                            charcoal: 10_000,
                            marble: 8_000,
                        },
                        requires: {
                            wood: {
                                diversify: 3,
                            },
                            stone: {
                                diversify: 2,
                            },
                        },
                        callback: this._incMaxActionsInQueue.bind(this),
                    },
                    2: {
                        costs: {
                            wood: 1_000_000,
                            strongWood: 500_000,
                            woodenBeam: 500_000,
                            stone: 900_000,
                            granite: 600_000,
                            iron: 500_000,
                            charcoal: 50_000,
                            marble: 80_000,
                            tools: 15_000,
                            gold: 25_000,
                        },
                        requires: {
                            wood: {
                                amount: 20,
                                diversify: 3,
                            },
                            stone: {
                                diversify: 2,
                            },
                            iron: {
                                diversify: 1,
                            },
                            mine: {
                                amount: 2,
                            }
                        },
                        callback: this._incMaxActionsInQueue.bind(this),
                    },
                    3: {
                        costs: {
                            wood: 1_200_000_000,
                            strongWood: 660_000_000,
                            woodenBeam: 660_000_000,
                            stone: 1_050_000_000,
                            granite: 450_000_000,
                            iron: 550_000_000,
                            gold: 90_000_000,
                            charcoal: 2_300_000,
                            tools: 2_100_000,
                            marble: 1_400_000,
                            diamond: 37_500_000,
                            copper: 43_200_000,
                            medallion: 840_000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            },
                        },
                        callback: this._incMaxActionsInQueue.bind(this),
                    },
                },
                parallelization: {
                    1: {
                        costs: {
                            wood: 120_000,
                            strongWood: 90_000,
                            woodenBeam: 100_000,
                            stone: 120_000,
                            granite: 80_000,
                            iron: 75_000,
                            charcoal: 12_000,
                            marble: 12_000,
                            tools: 8_000,
                        },
                        requires: {
                            wood: {
                                diversify: 3,
                            },
                            stone: {
                                diversify: 2,
                            },
                            iron: {
                                diversify: 1,
                            },
                        },
                        callback: (function () {
                            this.state.getState().maxSameActionsInQueue++;
                        }).bind(this),
                    },
                },
            },
            mine: {
                double: {
                    1: {
                        costs: {
                            wood: 12_000,
                            strongWood: 7_000,
                            woodenBeam: 8_500,
                            stone: 10_000,
                            granite: 6_500,
                            iron: 5_000,
                            charcoal: 750,
                            gold: 1_000,
                        },
                        requires: {
                            mine: {
                                amount: 5,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 200_000,
                            strongWood: 80_000,
                            woodenBeam: 75_000,
                            stone: 180_000,
                            granite: 86_500,
                            marble: 15_000,
                            iron: 115_000,
                            charcoal: 10_750,
                            tools: 5_600,
                            gold: 35_000,
                            diamond: 7_500,
                        },
                        requires: {
                            mine: {
                                amount: 10,
                                diversify: 1,
                            },
                        },
                    },
                    3: {
                        costs: {
                            wood: 500_000,
                            strongWood: 220_000,
                            woodenBeam: 245_000,
                            stone: 480_000,
                            granite: 186_500,
                            marble: 75_000,
                            iron: 2_115_000,
                            charcoal: 80_750,
                            tools: 18_600,
                            gold: 135_000,
                            diamond: 27_500,
                            copper: 50_000
                        },
                        requires: {
                            mine: {
                                amount: 15,
                            },
                        },
                    },
                    4: {
                        costs: {
                            wood: 65_000_000,
                            strongWood: 28_600_000,
                            woodenBeam: 31_850_000,
                            stone: 62_400_000,
                            granite: 24_245_000,
                            marble: 975_000,
                            iron: 274_950_000,
                            charcoal: 1_049_750,
                            tools: 241_800,
                            gold: 17_550_000,
                            diamond: 3_575_000,
                            copper: 6_500_000,
                            medallion: 26_000,
                        },
                        requires: {
                            mine: {
                                amount: 20,
                            },
                        },
                    },
                    5: {
                        costs: {
                            wood: 845_000_000,
                            strongWood: 371_800_000,
                            woodenBeam: 414_050_000,
                            stone: 811_200_000,
                            granite: 315_185_000,
                            marble: 12_675_000,
                            iron: 3_574_350_000,
                            charcoal: 13_646_750,
                            tools: 3_143_400,
                            gold: 228_150_000,
                            diamond: 46_475_000,
                            copper: 84_500_000,
                            medallion: 338_000,
                        },
                        requires: {
                            mine: {
                                amount: 25,
                            },
                        },
                    },
                    6: {
                        costs: {
                            wood: 1_900_125_000_000,
                            strongWood: 830_655_000_000,
                            woodenBeam: 930_161_250_000,
                            stone: 1_782_520_000_000,
                            granite: 600_916_625_000,
                            marble: 251_875_000,
                            iron: 1_304_228_750_000,
                            charcoal: 370_518_750,
                            tools: 407_265_000,
                            gold: 351_333_750_000,
                            diamond: 150_456_875_000,
                            copper: 190_012_500_000,
                            medallion: 36_050_000,
                        },
                        requires: {
                            mine: {
                                amount: 30,
                            },
                        },
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 175_000,
                            strongWood: 83_000,
                            woodenBeam: 95_000,
                            stone: 170_000,
                            granite: 80_000,
                            iron: 145_000,
                            charcoal: 2_500,
                            tools: 4_000,
                            gold: 35_000,
                        },
                        requires: {
                            mine: {
                                amount: 5,
                            },
                            academy: {
                                amount: 1,
                            },
                        },
                        callback: (function () {
                            delete this.cache.getCache().producedMaterialCache['mine'];
                            this.state.getFactory('mine').production = {
                                gold: 2,
                                diamond: 1,
                            };
                            enableMaterial('diamond');
                        }).bind(this),
                    },
                    2: {
                        costs: {
                            wood: 795_000,
                            strongWood: 383_000,
                            woodenBeam: 495_000,
                            stone: 870_000,
                            granite: 480_000,
                            iron: 545_000,
                            charcoal: 12_000,
                            tools: 12_000,
                            marble: 6_500,
                            gold: 150_000,
                            diamond: 80_000,
                        },
                        requires: {
                            mine: {
                                amount: 8,
                            },
                            academy: {
                                amount: 4,
                            },
                        },
                        callback: () => enableFactoryExtension('mine', 'medallion'),
                    },
                    3: {
                        costs: {
                            wood: 52_000_000,
                            strongWood: 22_880_000,
                            woodenBeam: 25_480_000,
                            stone: 49_920_000,
                            granite: 19_396_000,
                            marble: 780_000,
                            iron: 219_960_000,
                            charcoal: 839_800,
                            tools: 193_440,
                            gold: 14_040_000,
                            diamond: 2_860_000,
                            copper: 5_200_000,
                            medallion: 20_800,
                        },
                        requires: {
                            mine: {
                                amount: 16,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('medallion'),
                    },
                    4: {
                        costs: {
                            wood: 845_000_000,
                            strongWood: 371_800_000,
                            woodenBeam: 414_050_000,
                            stone: 811_200_000,
                            granite: 315_185_000,
                            marble: 12_675_000,
                            iron: 3_574_350_000,
                            charcoal: 13_646_750,
                            tools: 3_143_400,
                            gold: 228_150_000,
                            diamond: 46_475_000,
                            copper: 84_500_000,
                            medallion: 338_000,
                        },
                        requires: {
                            mine: {
                                amount: 24,
                            },
                        },
                        callback: () => raiseFactoryExtensionProductionMultiplier('medallion'),
                    },
                },
            },
            builder: {
                double: {
                    1: {
                        costs: {
                            wood: 2_995_000,
                            strongWood: 1_083_000,
                            woodenBeam: 1_195_000,
                            stone: 2_875_000,
                            granite: 1_480_000,
                            iron: 2_345_000,
                            charcoal: 72_000,
                            tools: 52_000,
                            marble: 32_500,
                            gold: 680_000,
                            diamond: 305_000,
                        },
                        requires: {
                            builder: {
                                amount: 5,
                            },
                            mine: {
                                diversify: 1,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 12_095_000,
                            strongWood: 3_083_000,
                            woodenBeam: 3_395_000,
                            stone: 12_075_000,
                            granite: 5_480_000,
                            iron: 7_345_000,
                            charcoal: 96_200,
                            tools: 72_000,
                            marble: 42_500,
                            gold: 1_680_000,
                            diamond: 905_000,
                        },
                        requires: {
                            builder: {
                                amount: 10,
                            },
                        },
                    },
                    3: {
                        costs: {
                            wood: 302_375_000,
                            strongWood: 77_075_000,
                            woodenBeam: 84_875_000,
                            stone: 301_875_000,
                            granite: 137_000_000,
                            iron: 183_625_000,
                            charcoal: 2_005_000,
                            tools: 1_500_000,
                            marble: 962_500,
                            gold: 42_000_000,
                            copper: 42_000_000,
                            diamond: 22_625_000,
                            medallion: 225_000,
                        },
                        requires: {
                            builder: {
                                amount: 15,
                            },
                        },
                    },
                    4: {
                        costs: {
                            wood: 7_559_375_000,
                            strongWood: 1_926_875_000,
                            woodenBeam: 2_121_875_000,
                            stone: 7_546_875_000,
                            granite: 3_425_000_000,
                            iron: 4_590_625_000,
                            charcoal: 40_125_000,
                            tools: 35_000_000,
                            marble: 16_562_500,
                            gold: 1_050_000_000,
                            copper: 1_050_000_000,
                            diamond: 565_625_000,
                            medallion: 3_625_000,
                        },
                        requires: {
                            builder: {
                                amount: 20,
                            },
                        },
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1_795_000,
                            strongWood: 683_000,
                            woodenBeam: 795_000,
                            stone: 1_870_000,
                            granite: 880_000,
                            iron: 1_045_000,
                            charcoal: 32_000,
                            tools: 32_000,
                            marble: 12_500,
                            gold: 380_000,
                            diamond: 185_000,
                        },
                        requires: {
                            builder: {
                                amount: 5,
                            },
                            mine: {
                                diversify: 1,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 17_095_000,
                            strongWood: 3_583_000,
                            woodenBeam: 3_695_000,
                            stone: 18_075_000,
                            granite: 6_480_000,
                            iron: 9_345_000,
                            charcoal: 126_200,
                            tools: 92_000,
                            copper: 1_980_000,
                            marble: 49_500,
                            gold: 1_780_000,
                            diamond: 1_205_000,
                            medallion: 125_000,
                        },
                        requires: {
                            builder: {
                                amount: 10,
                            },
                        },
                    },
                },
            },
            tradingPost: {
                double: {
                    1: {
                        costs: {
                            wood: 3_500_000,
                            strongWood: 1_400_000,
                            woodenBeam: 1_395_000,
                            stone: 3_370_000,
                            granite: 1_480_000,
                            iron: 2_545_000,
                            charcoal: 92_000,
                            tools: 82_000,
                            marble: 62_500,
                            gold: 780_000,
                            diamond: 385_000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 4,
                            },
                        },
                        callback: this.trader.recalculateAutoMaxDeals.bind(this.trader),
                    },
                    2: {
                        costs: {
                            wood: 10_000_000,
                            strongWood: 4_400_000,
                            woodenBeam: 3_200_000,
                            stone: 7_500_000,
                            granite: 3_600_000,
                            iron: 6_245_000,
                            charcoal: 149_000,
                            tools: 138_000,
                            marble: 123_500,
                            gold: 2_180_000,
                            diamond: 905_000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 8,
                            },
                        },
                        callback: this.trader.recalculateAutoMaxDeals.bind(this.trader),
                    },
                    3: {
                        costs: {
                            wood: 50_000_000,
                            strongWood: 12_400_000,
                            woodenBeam: 13_200_000,
                            stone: 30_000_000,
                            granite: 12_600_000,
                            iron: 18_245_000,
                            charcoal: 289_000,
                            tools: 258_000,
                            marble: 203_500,
                            gold: 5_180_000,
                            diamond: 2_305_000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 12,
                            },
                        },
                        callback: this.trader.recalculateAutoMaxDeals.bind(this.trader),
                    },
                    4: {
                        costs: {
                            wood: 700_000_000,
                            strongWood: 173_600_000,
                            woodenBeam: 184_800_000,
                            stone: 420_000_000,
                            granite: 176_400_000,
                            iron: 255_430_000,
                            charcoal: 4_046_000,
                            tools: 3_612_000,
                            marble: 2_849_000,
                            gold: 72_520_000,
                            copper: 72_520_000,
                            diamond: 32_270_000,
                            medallion: 210_000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 16,
                            },
                        },
                        callback: this.trader.recalculateAutoMaxDeals.bind(this.trader),
                    },
                    5: {
                        costs: {
                            wood: 9_800_000_000,
                            strongWood: 2_430_400_000,
                            woodenBeam: 2_587_200_000,
                            stone: 5_880_000_000,
                            granite: 2_469_600_000,
                            iron: 3_576_020_000,
                            charcoal: 56_644_000,
                            tools: 23_568_000,
                            marble: 22_886_000,
                            gold: 1_015_280_000,
                            copper: 1_015_280_000,
                            diamond: 451_780_000,
                            medallion: 1_940_000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 20,
                            },
                        },
                        callback: this.trader.recalculateAutoMaxDeals.bind(this.trader),
                    },
                },
                // https://en.wikipedia.org/wiki/Trade_route#Historic_trade_routes
                routes: {
                    1: {
                        costs: {
                            wood: 3_900_000,
                            strongWood: 1_700_000,
                            woodenBeam: 1_495_000,
                            stone: 3_570_000,
                            granite: 1_680_000,
                            iron: 2_945_000,
                            charcoal: 102_000,
                            tools: 92_000,
                            marble: 72_500,
                            gold: 980_000,
                            diamond: 405_000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 4,
                            },
                        },
                        callback: this.trader.addRoute.bind(this.trader),
                    },
                    2: {
                        costs: {
                            wood: 9_000_000,
                            strongWood: 4_000_000,
                            woodenBeam: 3_000_000,
                            stone: 7_000_000,
                            granite: 3_100_000,
                            iron: 5_945_000,
                            charcoal: 142_000,
                            tools: 132_000,
                            marble: 122_500,
                            gold: 1_980_000,
                            diamond: 805_000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 8,
                            },
                        },
                        callback: this.trader.addRoute.bind(this.trader),
                    },
                },
            },
            academy: {
                double: {
                    1: {
                        costs: {
                            wood: 100_000,
                            strongWood: 60_000,
                            woodenBeam: 65_000,
                            stone: 90_000,
                            granite: 55_000,
                            iron: 70_000,
                            charcoal: 5_000,
                            marble: 3_500,
                            gold: 10_000,
                        },
                        requires: {
                            academy: {
                                amount: 4,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 9_000_000,
                            strongWood: 4_000_000,
                            woodenBeam: 3_000_000,
                            stone: 7_000_000,
                            granite: 3_100_000,
                            iron: 5_945_000,
                            charcoal: 142_000,
                            tools: 132_000,
                            marble: 122_500,
                            gold: 1_980_000,
                            diamond: 805_000,
                            knowledge: 1_500_000
                        },
                        requires: {
                            academy: {
                                amount: 8,
                            },
                        },
                    },
                    3: {
                        costs: {
                            wood: 27_000_000,
                            strongWood: 12_000_000,
                            woodenBeam: 9_000_000,
                            stone: 21_000_000,
                            granite: 9_300_000,
                            iron: 17_835_000,
                            charcoal: 426_000,
                            tools: 306_000,
                            marble: 287_500,
                            gold: 5_940_000,
                            diamond: 2_415_000,
                            knowledge: 6_000_000,
                        },
                        requires: {
                            academy: {
                                amount: 10,
                            },
                        },
                        callback: () => enableFactoryExtension('academy', 'managerAcademy'),
                    },
                },
                explore: {
                    1: {
                        fixCosts: true,
                        costs: {
                            knowledge: 25_000,
                        },
                        requires: {
                            academy: {
                                amount: 1,
                            },
                            stone: {
                                diversify: 3,
                            },
                        },
                        callback: (function () {
                            this.achievementController.checkAchievement(
                                this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.hydrolysis
                            );
                        }).bind(this),
                    },
                    2: {
                        fixCosts: true,
                        costs: {
                            knowledge: 155_000,
                        },
                        requires: {
                            academy: {
                                amount: 4,
                            },
                        },
                        callback: (function () {
                            this.achievementController.checkAchievement(
                                this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.fermentation
                            );
                        }).bind(this),
                    },
                    3: {
                        fixCosts: true,
                        costs: {
                            knowledge: 1_355_000,
                        },
                        callback: (function () {
                            this.achievementController.checkAchievement(
                                this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.degradation
                            );
                        }).bind(this),
                    },
                    4: {
                        fixCosts: true,
                        costs: {
                            knowledge: 24_550_000,
                        },
                        requires: {
                            academy: {
                                amount: 6,
                            },
                        },
                        callback: (function () {
                            this.achievementController.checkAchievement(
                                this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.carbonation
                            );
                        }).bind(this),
                    },
                    5: {
                        fixCosts: true,
                        costs: {
                            knowledge: 245_500_000,
                        },
                        requires: {
                            academy: {
                                amount: 8,
                            },
                        },
                        callback: (function () {
                            this.achievementController.checkAchievement(
                                this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.diastatic
                            );
                        }).bind(this),
                    },
                    6: {
                        fixCosts: true,
                        costs: {
                            knowledge: 845_500_000,
                        },
                        requires: {
                            academy: {
                                amount: 10,
                            },
                        },
                        callback: (function () {
                            this.achievementController.checkAchievement(
                                this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.amylase
                            );
                        }).bind(this),
                    },
                    7: {
                        fixCosts: true,
                        costs: {
                            knowledge: 1_691_000_000,
                        },
                        requires: {
                            academy: {
                                amount: 11,
                            },
                        },
                        callback: (function () {
                            $.each(this.state.getState().equippedBuildings, building => {
                                if (this.slot.isBuildingEquippedWith(building, EQUIPMENT_ITEM__DIASTATIC)) {
                                    this.buildQueue.addToQueue(BUILD_QUEUE__CONSTRUCT_SLOT, building, [], true);
                                }
                            });
                        }).bind(this),
                    },
                    8: {
                        fixCosts: true,
                        costs: {
                            knowledge: 3_382_000_000,
                        },
                        requires: {
                            academy: {
                                amount: 12,
                            },
                        },
                        callback: (function () {
                            $.each(this.state.getState().equippedBuildings, building => {
                                if (this.slot.isBuildingEquippedWith(building, EQUIPMENT_ITEM__AMYLASE)) {
                                    this.buildQueue.addToQueue(BUILD_QUEUE__CONSTRUCT_SLOT, building, [], true);
                                }
                            });
                        }).bind(this),
                    },
                    9: {
                        fixCosts: true,
                        costs: {
                            knowledge: 6_764_000_000,
                        },
                        requires: {
                            academy: {
                                amount: 13,
                            },
                        },
                        callback: () => this.state.checkAdvancedBuyControlEnable(),
                    },
                },
            },
            engineer: {
                construction: {
                    1: {
                        costs: {
                            wood: 1_200_000_000,
                            strongWood: 660_000_000,
                            woodenBeam: 660_000_000,
                            stone: 1_050_000_000,
                            granite: 450_000_000,
                            iron: 550_000_000,
                            gold: 90_000_000,
                            charcoal: 2_300_000,
                            tools: 2_100_000,
                            marble: 1_400_000,
                            diamond: 37_500_000,
                            copper: 43_200_000,
                            medallion: 840_000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            },
                        },
                        callback: () => this.uniqueBuild.unlockBuild('giza'),
                    },
                },
                calculation: {
                    1: {
                        costs: {
                            wood: 1_200_000_000,
                            strongWood: 660_000_000,
                            woodenBeam: 660_000_000,
                            stone: 1_050_000_000,
                            granite: 450_000_000,
                            iron: 550_000_000,
                            gold: 90_000_000,
                            charcoal: 2_300_000,
                            tools: 2_100_000,
                            marble: 1_400_000,
                            diamond: 37_500_000,
                            copper: 43_200_000,
                            medallion: 840_000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 24_000_000_000,
                            strongWood: 13_200_000_000,
                            woodenBeam: 13_200_000_000,
                            stone: 21_000_000_000,
                            granite: 9_000_000_000,
                            iron: 11_000_000_000,
                            gold: 1_800_000_000,
                            charcoal: 46_000_000,
                            tools: 42_000_000,
                            marble: 28_000_000,
                            diamond: 750_000_000,
                            copper: 864_000_000,
                            medallion: 16_800_000,
                        },
                        requires: {
                            stone: {
                                amount: 30,
                            },
                        },
                    },
                    3: {
                        costs: {
                            wood: 480_000_000_000,
                            strongWood: 264_000_000_000,
                            woodenBeam: 264_000_000_000,
                            stone: 420_000_000_000,
                            granite: 180_000_000_000,
                            iron: 220_000_000_000,
                            gold: 36_000_000_000,
                            charcoal: 920_000_000,
                            tools: 840_000_000,
                            marble: 560_000_000,
                            diamond: 15_000_000_000,
                            copper: 17_280_000_000,
                            medallion: 336_000_000,
                        },
                        requires: {
                            stone: {
                                amount: 35,
                            },
                        },
                    },
                },
            },
            backRoom: {
                lobbyist: {
                    1: {
                        costs: {
                            wood: 1_200_000_000,
                            strongWood: 660_000_000,
                            woodenBeam: 660_000_000,
                            stone: 1_050_000_000,
                            granite: 450_000_000,
                            iron: 550_000_000,
                            gold: 90_000_000,
                            charcoal: 230_000,
                            tools: 210_000,
                            marble: 140_000,
                            diamond: 37_500_000,
                            copper: 43_200_000,
                            medallion: 84_000,
                        },
                        requires: {
                            backRoom: {
                                amount: 1,
                            },
                        },
                        callback: addLobbyist,
                    },
                    2: {
                        costs: {
                            wood: 2_400_000_000,
                            strongWood: 1_320_000_000,
                            woodenBeam: 1_320_000_000,
                            stone: 2_100_000_000,
                            granite: 900_000_000,
                            iron: 1_100_000_000,
                            gold: 180_000_000,
                            charcoal: 460_000,
                            tools: 420_000,
                            marble: 280_000,
                            diamond: 75_000_000,
                            copper: 86_400_000,
                            medallion: 168_000,
                        },
                        requires: {
                            backRoom: {
                                amount: 3,
                            },
                        },
                        callback: addLobbyist,
                    },
                    3: {
                        costs: {
                            wood: 4_800_000_000,
                            strongWood: 2_640_000_000,
                            woodenBeam: 2_640_000_000,
                            stone: 4_200_000_000,
                            granite: 1_800_000_000,
                            iron: 2_200_000_000,
                            gold: 360_000_000,
                            charcoal: 920_000,
                            tools: 840_000,
                            marble: 560_000,
                            diamond: 150_000_000,
                            copper: 172_800_000,
                            medallion: 336_000,
                        },
                        requires: {
                            backRoom: {
                                amount: 6,
                            },
                        },
                        callback: addLobbyist,
                    },
                    4: {
                        costs: {
                            wood: 9_600_000_000,
                            strongWood: 5_280_000_000,
                            woodenBeam: 5_280_000_000,
                            stone: 8_400_000_000,
                            granite: 3_600_000_000,
                            iron: 4_400_000_000,
                            gold: 720_000_000,
                            charcoal: 1_840_000,
                            tools: 1_680_000,
                            marble: 1_120_000,
                            diamond: 300_000_000,
                            copper: 345_600_000,
                            medallion: 672_000,
                        },
                        requires: {
                            backRoom: {
                                amount: 9,
                            },
                        },
                        callback: addLobbyist,
                    },
                },
                influence: {
                    1: {
                        costs: {
                            wood: 1_200_000_000,
                            strongWood: 660_000_000,
                            woodenBeam: 660_000_000,
                            stone: 1_050_000_000,
                            granite: 450_000_000,
                            iron: 550_000_000,
                            gold: 100_000_000,
                            charcoal: 1_600_000,
                            tools: 1_500_000,
                            marble: 1_000_000,
                            diamond: 37_500_000,
                            copper: 43_200_000,
                            medallion: 540_000,
                        },
                        requires: {
                            backRoom: {
                                amount: 5,
                                lobbyist: 1,
                            },
                        },
                        callback: () => this.cache.resetProductionAmountCache(),
                    },
                    2: {
                        costs: {
                            wood: 3_600_000_000,
                            strongWood: 1_980_000_000,
                            woodenBeam: 1_980_000_000,
                            stone: 3_150_000_000,
                            granite: 1_350_000_000,
                            iron: 1_650_000_000,
                            gold: 300_000_000,
                            charcoal: 4_800_000,
                            tools: 4_500_000,
                            marble: 3_000_000,
                            diamond: 112_500_000,
                            copper: 129_600_000,
                            medallion: 1_620_000,
                        },
                        requires: {
                            backRoom: {
                                amount: 10,
                            },
                        },
                        callback: () => this.cache.resetProductionAmountCache(),
                    },
                },
            },
            // TODO: define double upgrade paths
            // TODO: translations for diversify updates
            // TODO: define costs for diversify upgrades
            // TODO: create factory extension icons
            crop: {
                double: {
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            crop: {
                                amount: 5,
                            },
                        },
                        callback: () => enableFactoryExtension('crop', 'bakery'),
                    },
                    2: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            crop: {
                                amount: 10,
                            },
                        },
                        requiresCallback: () => (new Minigames.BeerBlender()).isEnabled(),
                        callback: () => (new Minigames.BeerBlender()).unlockAdditionalIngredient('grainSchnapps'),
                    },
                },
            },
            orchard: {
                double: {
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            orchard: {
                                amount: 5,
                            },
                        },
                        callback: () => enableFactoryExtension('orchard', 'grandma'),
                    },
                    2: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            orchard: {
                                amount: 10,
                            },
                        },
                        requiresCallback: () => (new Minigames.BeerBlender()).isEnabled(),
                        callback: () => (new Minigames.BeerBlender()).unlockAdditionalIngredient('obstler'),
                    },
                },
            },
            greenhouse: {
                double: {
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            greenhouse: {
                                amount: 5,
                            },
                        },
                        callback: () => enableFactoryExtension('greenhouse', 'shed'),
                    },
                    2: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            greenhouse: {
                                amount: 10,
                            },
                        },
                        requiresCallback: () => (new Minigames.BeerBlender()).isEnabled(),
                        callback: () => (new Minigames.BeerBlender()).unlockAdditionalIngredient('melonLiqueur'),
                    },
                },
            },
            fisherman: {
                double: {
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            fisherman: {
                                amount: 5,
                            },
                        },
                        callback: () => enableFactoryExtension('fisherman', 'smokehouse'),
                    },
                    2: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            fisherman: {
                                amount: 10,
                            },
                        },
                        requiresCallback: () => (new Minigames.BeerBlender()).isEnabled(),
                        callback: () => (new Minigames.BeerBlender()).unlockAdditionalIngredient('fishWine'),
                    },
                },
            },
            cattle: {
                double: {
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            cattle: {
                                amount: 5,
                            },
                        },
                        callback: () => enableFactoryExtension('cattle', 'slaughter'),
                    },
                    2: {
                        costs: {
                            wood: 1,
                        },
                        requires: {
                            cattle: {
                                amount: 10,
                            },
                        },
                        requiresCallback: () => (new Minigames.BeerBlender()).isEnabled(),
                        callback: () => (new Minigames.BeerBlender()).unlockAdditionalIngredient('bacon'),
                    },
                },
            },
            // TODO: define upgrades
            restaurant: {
                double: {
                },
                diversify: {
                },
            },
        };
    };

    beerFactoryGame.Upgrade = Upgrade;
})(BeerFactoryGame);

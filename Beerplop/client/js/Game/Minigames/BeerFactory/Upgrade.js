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

        $.each(this.state.getBuildQueue(), function checkUpgradeForFactoryQueued() {
            if (this.action === BUILD_QUEUE__UPGRADE && this.item.factory === factory) {
                isAvailable = false;
                return false;
            }
        });

        if (!isAvailable) {
            return false;
        }

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

            enableFactoryExtension = (function (factory, extension) {
                factory = this.state.getFactory(factory);

                if ($.inArray(extension, factory.extensions) !== -1) {
                    console.log('Extension already unlocked');
                    return;
                }

                factory.extensions.push(extension);

                if (EXTENSIONS[extension].type === EXTENSION_TYPE__PROXY) {
                    this.state.getState().proxyExtension[extension] = {
                        extension: null,
                    };
                } else {
                    this.state.initExtensionStorage(extension, extension);

                    $.each(EXTENSIONS[extension].enableMaterial, (function (index, material) {
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
                            wood: 2000,
                            strongWood: 1000,
                            stone: 1000,
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
                            wood: 6500,
                            strongWood: 8000,
                            woodenBeam: 8000,
                            stone: 14000,
                            granite: 7000,
                            iron: 4500,
                            charcoal: 1750,
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
                            wood: 159000,
                            strongWood: 57000,
                            woodenBeam: 61000,
                            stone: 130000,
                            granite: 53000,
                            iron: 79000,
                            charcoal: 5900,
                            tools: 4550,
                            gold: 12750,
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
                            wood: 3500000,
                            strongWood: 1500000,
                            woodenBeam: 1500000,
                            stone: 3000000,
                            granite: 1900000,
                            iron: 2570000,
                            charcoal: 25000,
                            tools: 15500,
                            gold: 350000,
                            marble: 15000,
                            diamond: 120000,
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
                            wood: 35000000,
                            strongWood: 15000000,
                            woodenBeam: 15000000,
                            stone: 30000000,
                            granite: 17000000,
                            iron: 22700000,
                            charcoal: 110000,
                            tools: 105000,
                            gold: 3500000,
                            marble: 100000,
                            diamond: 1200000,
                            medallion: 10000,
                        },
                        requires: {
                            wood: {
                                amount: 30,
                            },
                        }
                    },
                    7: {
                        costs: {
                            wood: 525000000,
                            strongWood: 225000000,
                            woodenBeam: 225000000,
                            stone: 450000000,
                            granite: 255000000,
                            iron: 340500000,
                            charcoal: 1650000,
                            tools: 1575000,
                            gold: 52500000,
                            copper: 52500000,
                            marble: 1500000,
                            diamond: 18000000,
                            medallion: 150000,
                        },
                        requires: {
                            wood: {
                                amount: 35,
                            },
                        }
                    },
                    8: {
                        costs: {
                            wood: 7875000000,
                            strongWood: 3375000000,
                            woodenBeam: 3375000000,
                            stone: 6750000000,
                            granite: 3825000000,
                            iron: 5107500000,
                            charcoal: 24750000,
                            tools: 23625000,
                            gold: 787500000,
                            copper: 787500000,
                            marble: 22500000,
                            diamond: 270000000,
                            medallion: 2250000,
                        },
                        requires: {
                            wood: {
                                amount: 40,
                            },
                        }
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1000,
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
                            wood: 7500,
                            strongWood: 4000,
                            stone: 5000,
                            granite: 2500,
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
                            wood: 16000,
                            strongWood: 6000,
                            woodenBeam: 4000,
                            stone: 14000,
                            granite: 7000,
                            iron: 2000,
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
                            wood: 520000,
                            strongWood: 260000,
                            woodenBeam: 260000,
                            stone: 495000,
                            granite: 245000,
                            iron: 265000,
                            gold: 12500,
                            marble: 6500,
                            tools: 6000,
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
                            wood: 42000000,
                            strongWood: 18000000,
                            woodenBeam: 18000000,
                            stone: 36000000,
                            granite: 20400000,
                            iron: 27240000,
                            charcoal: 132000,
                            tools: 126000,
                            gold: 4200000,
                            copper: 4200000,
                            marble: 120000,
                            diamond: 1440000,
                            medallion: 12000,
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
                            wood: 490000000,
                            strongWood: 210000000,
                            woodenBeam: 210000000,
                            stone: 420000000,
                            granite: 238000000,
                            iron: 317800000,
                            charcoal: 1540000,
                            tools: 1470000,
                            gold: 49000000,
                            copper: 49000000,
                            marble: 1400000,
                            diamond: 16800000,
                            medallion: 140000,
                        },
                        requires: {
                            wood: {
                                amount: 35,
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
                            wood: 1000,
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
                            wood: 7000,
                            strongWood: 3500,
                            woodenBeam: 3500,
                            stone: 5000,
                            granite: 2500,
                            iron: 2250,
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
                            wood: 480000,
                            strongWood: 242000,
                            woodenBeam: 242000,
                            stone: 465000,
                            granite: 225000,
                            iron: 136500,
                            gold: 36000,
                            tools: 5500,
                            marble: 4000,
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
                            wood: 4000000,
                            strongWood: 2200000,
                            woodenBeam: 2200000,
                            stone: 3500000,
                            granite: 1500000,
                            iron: 1850000,
                            gold: 300000,
                            tools: 14000,
                            marble: 13000,
                            diamond: 125000,
                        },
                        requires: {
                            stone: {
                                amount: 20,
                            }
                        },
                    },
                    5: {
                        costs: {
                            wood: 40000000,
                            strongWood: 22000000,
                            woodenBeam: 22000000,
                            stone: 35000000,
                            granite: 15000000,
                            iron: 18500000,
                            gold: 3000000,
                            charcoal: 45000,
                            tools: 34000,
                            marble: 40000,
                            diamond: 1250000,
                            medallion: 8000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            }
                        },
                    },
                    6: {
                        costs: {
                            wood: 200000000,
                            strongWood: 120000000,
                            woodenBeam: 120000000,
                            stone: 170000000,
                            granite: 75000000,
                            iron: 95000000,
                            gold: 15000000,
                            charcoal: 230000,
                            tools: 200000,
                            marble: 200000,
                            diamond: 7000000,
                            medallion: 80000,
                        },
                        requires: {
                            stone: {
                                amount: 30,
                            }
                        },
                    },
                    7: {
                        costs: {
                            wood: 2600000000,
                            strongWood: 1560000000,
                            woodenBeam: 1560000000,
                            stone: 2210000000,
                            granite: 975000000,
                            iron: 1235000000,
                            gold: 195000000,
                            copper: 195000000,
                            charcoal: 2990000,
                            tools: 2600000,
                            marble: 2600000,
                            diamond: 91000000,
                            medallion: 1040000,
                        },
                        requires: {
                            stone: {
                                amount: 35,
                            }
                        },
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 1500,
                            strongWood: 750,
                            stone: 1000,
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
                            wood: 12500,
                            strongWood: 9500,
                            woodenBeam: 8500,
                            charcoal: 1000,
                            stone: 12000,
                            granite: 6000,
                            iron: 7000,
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
                            wood: 14000,
                            strongWood: 11000,
                            woodenBeam: 10000,
                            charcoal: 2000,
                            stone: 15000,
                            granite: 8000,
                            marble: 1500,
                            iron: 10000,
                            tools: 1500,
                            gold: 2000,
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
                            wood: 50000000,
                            strongWood: 23000000,
                            woodenBeam: 23000000,
                            stone: 42000000,
                            granite: 19000000,
                            iron: 26500000,
                            gold: 3900000,
                            charcoal: 55000,
                            tools: 36000,
                            marble: 42000,
                            diamond: 1550000,
                            medallion: 9000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            },
                        },
                    },
                    5: {
                        costs: {
                            wood: 500000000,
                            strongWood: 230000000,
                            woodenBeam: 230000000,
                            stone: 420000000,
                            granite: 190000000,
                            iron: 265000000,
                            gold: 39000000,
                            copper: 39000000,
                            charcoal: 550000,
                            tools: 360000,
                            marble: 420000,
                            diamond: 15500000,
                            medallion: 90000,
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
                            wood: 600000000,
                            strongWood: 276000000,
                            woodenBeam: 276000000,
                            stone: 504000000,
                            granite: 228000000,
                            iron: 318000000,
                            gold: 46800000,
                            copper: 46800000,
                            charcoal: 660000,
                            tools: 432000,
                            marble: 504000,
                            diamond: 18600000,
                            medallion: 108000,
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
                            wood: 6000000000,
                            strongWood: 2760000000,
                            woodenBeam: 2760000000,
                            stone: 5040000000,
                            granite: 2280000000,
                            iron: 3180000000,
                            gold: 468000000,
                            copper: 468000000,
                            charcoal: 6600000,
                            tools: 4320000,
                            marble: 5040000,
                            diamond: 186000000,
                            medallion: 1080000,
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
                            wood: 7200000000,
                            strongWood: 3312000000,
                            woodenBeam: 3312000000,
                            stone: 6048000000,
                            granite: 2736000000,
                            iron: 3816000000,
                            gold: 561600000,
                            copper: 561600000,
                            charcoal: 7920000,
                            tools: 5184000,
                            marble: 6048000,
                            diamond: 223200000,
                            medallion: 1296000,
                        },
                        requires: {
                            stone: {
                                amount: 37,
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
                            wood: 1150,
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
                            wood: 3000,
                            strongWood: 4000,
                            woodenBeam: 4000,
                            stone: 3000,
                            granite: 2500,
                            iron: 2000,
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
                            wood: 90000,
                            strongWood: 80000,
                            woodenBeam: 80000,
                            stone: 100000,
                            granite: 80000,
                            iron: 70000,
                            charcoal: 2000,
                            tools: 2500,
                            marble: 1550,
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
                            wood: 1500000,
                            strongWood: 600000,
                            woodenBeam: 600000,
                            stone: 1200000,
                            granite: 512000,
                            iron: 550000,
                            charcoal: 5400,
                            tools: 5300,
                            marble: 3500,
                            gold: 75000,
                            diamond: 55000,
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
                            wood: 40000000,
                            strongWood: 23000000,
                            woodenBeam: 23000000,
                            stone: 33000000,
                            granite: 14000000,
                            iron: 17500000,
                            gold: 2800000,
                            charcoal: 39000,
                            tools: 33000,
                            marble: 40000,
                            diamond: 1750000,
                            medallion: 8000,
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
                            wood: 360000000,
                            strongWood: 207000000,
                            woodenBeam: 207000000,
                            stone: 297000000,
                            granite: 126000000,
                            iron: 157500000,
                            gold: 25200000,
                            copper: 25200000,
                            charcoal: 351000,
                            tools: 297000,
                            marble: 360000,
                            diamond: 15750000,
                            medallion: 72000,
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
                            wood: 3240000000,
                            strongWood: 1863000000,
                            woodenBeam: 1863000000,
                            stone: 2673000000,
                            granite: 1134000000,
                            iron: 1417500000,
                            gold: 226800000,
                            copper: 226800000,
                            charcoal: 3159000,
                            tools: 2673000,
                            marble: 3240000,
                            diamond: 141750000,
                            medallion: 648000,
                        },
                        requires: {
                            storage: {
                                amount: 35,
                            },
                        },
                        callback: () => this.render.updateStockTable(),
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 2000,
                            strongWood: 950,
                            stone: 1300,
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
                            strongWood: 8000,
                            woodenBeam: 7000,
                            stone: 7000,
                            granite: 4000,
                            marble: 750,
                            iron: 3000,
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
                            wood: 100000,
                            strongWood: 40000,
                            woodenBeam: 45000,
                            stone: 90000,
                            granite: 45000,
                            iron: 60000,
                            marble: 7500,
                            tools: 4000,
                            gold: 10000,
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
                            wood: 2000000,
                            strongWood: 800000,
                            woodenBeam: 900000,
                            stone: 1800000,
                            granite: 900000,
                            iron: 1200000,
                            copper: 500000,
                            marble: 15000,
                            tools: 20000,
                            gold: 200000,
                            diamond: 90000,
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
                            wood: 30000000,
                            strongWood: 13000000,
                            woodenBeam: 13000000,
                            stone: 20000000,
                            granite: 9000000,
                            iron: 10500000,
                            gold: 1500000,
                            charcoal: 29000,
                            tools: 19000,
                            marble: 25000,
                            diamond: 1050000,
                            medallion: 7000,
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
                            wood: 270000000,
                            strongWood: 117000000,
                            woodenBeam: 117000000,
                            stone: 180000000,
                            granite: 81000000,
                            iron: 94500000,
                            gold: 13500000,
                            copper: 13500000,
                            charcoal: 261000,
                            tools: 171000,
                            marble: 225000,
                            diamond: 9450000,
                            medallion: 63000,
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
                            wood: 2430000000,
                            strongWood: 1053000000,
                            woodenBeam: 1053000000,
                            stone: 1620000000,
                            granite: 729000000,
                            iron: 850500000,
                            gold: 121500000,
                            copper: 121500000,
                            charcoal: 2349000,
                            tools: 1539000,
                            marble: 2025000,
                            diamond: 85050000,
                            medallion: 567000,
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
                            wood: 2500,
                            strongWood: 2000,
                            woodenBeam: 1850,
                            stone: 2750,
                            granite: 1800,
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
                            wood: 13500,
                            strongWood: 8000,
                            woodenBeam: 10000,
                            stone: 13500,
                            granite: 8000,
                            iron: 1500,
                            tools: 1000,
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
                            wood: 55000,
                            strongWood: 29000,
                            woodenBeam: 40000,
                            stone: 56000,
                            granite: 29000,
                            iron: 40000,
                            charcoal: 3000,
                            marble: 4000,
                            tools: 4000,
                            gold: 2300,
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
                            wood: 5750000,
                            strongWood: 3250000,
                            woodenBeam: 3300000,
                            stone: 5600000,
                            granite: 3300000,
                            iron: 4500000,
                            charcoal: 34000,
                            marble: 22000,
                            tools: 20000,
                            gold: 36000,
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
                            wood: 50000000,
                            strongWood: 27000000,
                            woodenBeam: 27000000,
                            stone: 39000000,
                            granite: 17000000,
                            iron: 20500000,
                            gold: 3300000,
                            charcoal: 49000,
                            tools: 39000,
                            marble: 45000,
                            diamond: 2050000,
                            medallion: 10000,
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
                            wood: 400000000,
                            strongWood: 216000000,
                            woodenBeam: 216000000,
                            stone: 312000000,
                            granite: 136000000,
                            iron: 164000000,
                            gold: 26400000,
                            copper: 26400000,
                            charcoal: 392000,
                            tools: 312000,
                            marble: 360000,
                            diamond: 16400000,
                            medallion: 80000,
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
                            wood: 3200000000,
                            strongWood: 1728000000,
                            woodenBeam: 1728000000,
                            stone: 2496000000,
                            granite: 1088000000,
                            iron: 1312000000,
                            gold: 211200000,
                            copper: 211200000,
                            charcoal: 3136000,
                            tools: 2496000,
                            marble: 2880000,
                            diamond: 131200000,
                            medallion: 640000,
                        },
                        requires: {
                            transport: {
                                amount: 34,
                            }
                        },
                        callback: this.cache.resetDeliverCapacityCache.bind(this.cache),
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 6000,
                            strongWood: 1500,
                            woodenBeam: 1750,
                            stone: 6000,
                            granite: 3500,
                            iron: 3000,
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
                            wood: 200000,
                            strongWood: 100000,
                            woodenBeam: 100000,
                            stone: 180000,
                            granite: 80000,
                            iron: 100000,
                            gold: 20000,
                            tools: 7000,
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
                            wood: 1700000,
                            strongWood: 900000,
                            woodenBeam: 900000,
                            stone: 1500000,
                            granite: 850000,
                            iron: 1100000,
                            gold: 200000,
                            tools: 11000,
                            marble: 10000,
                            charcoal: 13000,
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
                            wood: 440000000,
                            strongWood: 237600000,
                            woodenBeam: 237600000,
                            stone: 343200000,
                            granite: 149600000,
                            iron: 180400000,
                            gold: 29040000,
                            copper: 29040000,
                            charcoal: 431200,
                            tools: 343200,
                            marble: 396000,
                            diamond: 18040000,
                            medallion: 88000,
                        },
                        requires: {
                            transport: {
                                amount: 30,
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
                            wood: 10000,
                            strongWood: 10000,
                            woodenBeam: 7500,
                            stone: 8000,
                            granite: 4500,
                            iron: 3750,
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
                            wood: 500000,
                            strongWood: 250000,
                            woodenBeam: 235000,
                            stone: 400000,
                            granite: 250000,
                            iron: 175000,
                            charcoal: 13000,
                            tools: 9000,
                            marble: 10000,
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
                            wood: 1100000,
                            strongWood: 550000,
                            woodenBeam: 535000,
                            stone: 1200000,
                            granite: 650000,
                            iron: 850000,
                            copper: 150000,
                            charcoal: 40000,
                            tools: 25000,
                            marble: 30000,
                            gold: 300000,
                            diamond: 100000,
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
                            wood: 5000000,
                            strongWood: 2700000,
                            woodenBeam: 2700000,
                            stone: 3900000,
                            granite: 1700000,
                            iron: 2050000,
                            gold: 340000,
                            tools: 17000,
                            marble: 16000,
                            diamond: 185000,
                            copper: 150000,
                        },
                        requires: {
                            iron: {
                                amount: 22,
                            },
                        },
                    },
                    5: {
                        costs: {
                            wood: 50000000,
                            strongWood: 27000000,
                            woodenBeam: 27000000,
                            stone: 39000000,
                            granite: 17000000,
                            iron: 20500000,
                            gold: 3300000,
                            charcoal: 49000,
                            tools: 39000,
                            marble: 45000,
                            diamond: 2050000,
                            medallion: 10000,
                        },
                        requires: {
                            iron: {
                                amount: 26,
                            },
                        },
                    },
                    6: {
                        costs: {
                            wood: 400000000,
                            strongWood: 216000000,
                            woodenBeam: 216000000,
                            stone: 312000000,
                            granite: 136000000,
                            iron: 164000000,
                            gold: 26400000,
                            copper: 26400000,
                            charcoal: 392000,
                            tools: 312000,
                            marble: 360000,
                            diamond: 16400000,
                            medallion: 80000,
                        },
                        requires: {
                            iron: {
                                amount: 30,
                            },
                        },
                    },
                    7: {
                        costs: {
                            wood: 3840000000,
                            strongWood: 2073600000,
                            woodenBeam: 2073600000,
                            stone: 2995200000,
                            granite: 1305600000,
                            iron: 1574400000,
                            gold: 253440000,
                            copper: 253440000,
                            charcoal: 3763200,
                            tools: 2995200,
                            marble: 3456000,
                            diamond: 157440000,
                            medallion: 768000,
                        },
                        requires: {
                            iron: {
                                amount: 34,
                            },
                        },
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 17500,
                            strongWood: 7000,
                            woodenBeam: 8000,
                            stone: 16000,
                            granite: 7000,
                            iron: 9000,
                            charcoal: 2500,
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
                            wood: 175000,
                            strongWood: 83000,
                            woodenBeam: 95000,
                            stone: 170000,
                            granite: 80000,
                            iron: 145000,
                            charcoal: 2500,
                            tools: 4000,
                            marble: 2500,
                            gold: 35000,
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
                            wood: 400000000,
                            strongWood: 216000000,
                            woodenBeam: 216000000,
                            stone: 312000000,
                            granite: 136000000,
                            iron: 164000000,
                            gold: 26400000,
                            copper: 26400000,
                            charcoal: 392000,
                            tools: 312000,
                            marble: 360000,
                            diamond: 16400000,
                            medallion: 80000,
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
                            wood: 500000000,
                            strongWood: 230000000,
                            woodenBeam: 230000000,
                            stone: 420000000,
                            granite: 190000000,
                            iron: 265000000,
                            gold: 39000000,
                            copper: 39000000,
                            charcoal: 550000,
                            tools: 360000,
                            marble: 420000,
                            diamond: 15500000,
                            medallion: 90000,
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
                            wood: 8000,
                            strongWood: 3000,
                            woodenBeam: 4000,
                            stone: 7000,
                            granite: 4000,
                            iron: 3500,
                            charcoal: 1000,
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
                            wood: 80000,
                            strongWood: 30000,
                            woodenBeam: 40000,
                            stone: 70000,
                            granite: 40000,
                            iron: 35000,
                            charcoal: 8000,
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
                            wood: 6000000,
                            strongWood: 2400000,
                            woodenBeam: 1800000,
                            stone: 5800000,
                            granite: 2700000,
                            iron: 3600000,
                            copper: 1500000,
                            marble: 37000,
                            tools: 50000,
                            gold: 600000,
                            diamond: 270000,
                            medallion: 5000,
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
                            charcoal: 225000,
                            copper: 1500000,
                            diamond: 1000000,
                            gold: 2500000,
                            granite: 11750000,
                            iron: 17350000,
                            marble: 150000,
                            stone: 23650000,
                            strongWood: 11350000,
                            tools: 135000,
                            wood: 23100000,
                            woodenBeam: 11925000,
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
                            charcoal: 4500000,
                            copper: 30000000,
                            diamond: 20000000,
                            gold: 50000000,
                            granite: 235000000,
                            iron: 347000000,
                            marble: 3000000,
                            medallion: 440000,
                            stone: 473000000,
                            strongWood: 227000000,
                            tools: 2700000,
                            wood: 462000000,
                            woodenBeam: 238500000,
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
                            wood: 9000,
                            strongWood: 3000,
                            woodenBeam: 5000,
                            stone: 8000,
                            granite: 5000,
                            iron: 5000,
                            charcoal: 1000,
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
                            wood: 120000,
                            strongWood: 70000,
                            woodenBeam: 85000,
                            stone: 130000,
                            granite: 95000,
                            iron: 70000,
                            charcoal: 10000,
                            marble: 9000,
                            tools: 8000,
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
                            wood: 620000,
                            strongWood: 270000,
                            woodenBeam: 385000,
                            stone: 730000,
                            granite: 350000,
                            iron: 470000,
                            charcoal: 21000,
                            marble: 16000,
                            tools: 17000,
                            gold: 30000,
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
                            wood: 4620000,
                            strongWood: 2270000,
                            woodenBeam: 2385000,
                            stone: 4730000,
                            granite: 2350000,
                            iron: 3470000,
                            charcoal: 45000,
                            marble: 30000,
                            tools: 27000,
                            gold: 500000,
                            diamond: 200000,
                            copper: 300000,
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
                            wood: 100000,
                            strongWood: 50000,
                            woodenBeam: 50000,
                            stone: 90000,
                            granite: 60000,
                            iron: 50000,
                            charcoal: 10000,
                            marble: 8000,
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
                            wood: 1000000,
                            strongWood: 500000,
                            woodenBeam: 500000,
                            stone: 900000,
                            granite: 600000,
                            iron: 500000,
                            charcoal: 50000,
                            marble: 80000,
                            tools: 15000,
                            gold: 25000,
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
                            wood: 1200000000,
                            strongWood: 660000000,
                            woodenBeam: 660000000,
                            stone: 1050000000,
                            granite: 450000000,
                            iron: 550000000,
                            gold: 90000000,
                            charcoal: 2300000,
                            tools: 2100000,
                            marble: 1400000,
                            diamond: 37500000,
                            copper: 43200000,
                            medallion: 840000,
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
                            wood: 120000,
                            strongWood: 90000,
                            woodenBeam: 100000,
                            stone: 120000,
                            granite: 80000,
                            iron: 75000,
                            charcoal: 12000,
                            marble: 12000,
                            tools: 8000,
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
                            wood: 12000,
                            strongWood: 7000,
                            woodenBeam: 8500,
                            stone: 10000,
                            granite: 6500,
                            iron: 5000,
                            charcoal: 750,
                            gold: 1000,
                        },
                        requires: {
                            mine: {
                                amount: 5,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 200000,
                            strongWood: 80000,
                            woodenBeam: 75000,
                            stone: 180000,
                            granite: 86500,
                            marble: 15000,
                            iron: 115000,
                            charcoal: 10750,
                            tools: 5600,
                            gold: 35000,
                            diamond: 7500,
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
                            wood: 500000,
                            strongWood: 220000,
                            woodenBeam: 245000,
                            stone: 480000,
                            granite: 186500,
                            marble: 75000,
                            iron: 2115000,
                            charcoal: 80750,
                            tools: 18600,
                            gold: 135000,
                            diamond: 27500,
                            copper: 50000
                        },
                        requires: {
                            mine: {
                                amount: 15,
                            },
                        },
                    },
                    4: {
                        costs: {
                            wood: 65000000,
                            strongWood: 28600000,
                            woodenBeam: 31850000,
                            stone: 62400000,
                            granite: 24245000,
                            marble: 975000,
                            iron: 274950000,
                            charcoal: 1049750,
                            tools: 241800,
                            gold: 17550000,
                            diamond: 3575000,
                            copper: 6500000,
                            medallion: 26000,
                        },
                        requires: {
                            mine: {
                                amount: 20,
                            },
                        },
                    },
                    5: {
                        costs: {
                            wood: 845000000,
                            strongWood: 371800000,
                            woodenBeam: 414050000,
                            stone: 811200000,
                            granite: 315185000,
                            marble: 12675000,
                            iron: 3574350000,
                            charcoal: 13646750,
                            tools: 3143400,
                            gold: 228150000,
                            diamond: 46475000,
                            copper: 84500000,
                            medallion: 338000,
                        },
                        requires: {
                            mine: {
                                amount: 25,
                            },
                        },
                    },
                },
                diversify: {
                    1: {
                        costs: {
                            wood: 175000,
                            strongWood: 83000,
                            woodenBeam: 95000,
                            stone: 170000,
                            granite: 80000,
                            iron: 145000,
                            charcoal: 2500,
                            tools: 4000,
                            gold: 35000,
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
                            wood: 795000,
                            strongWood: 383000,
                            woodenBeam: 495000,
                            stone: 870000,
                            granite: 480000,
                            iron: 545000,
                            charcoal: 12000,
                            tools: 12000,
                            marble: 6500,
                            gold: 150000,
                            diamond: 80000,
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
                            wood: 52000000,
                            strongWood: 22880000,
                            woodenBeam: 25480000,
                            stone: 49920000,
                            granite: 19396000,
                            marble: 780000,
                            iron: 219960000,
                            charcoal: 839800,
                            tools: 193440,
                            gold: 14040000,
                            diamond: 2860000,
                            copper: 5200000,
                            medallion: 20800,
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
                            wood: 845000000,
                            strongWood: 371800000,
                            woodenBeam: 414050000,
                            stone: 811200000,
                            granite: 315185000,
                            marble: 12675000,
                            iron: 3574350000,
                            charcoal: 13646750,
                            tools: 3143400,
                            gold: 228150000,
                            diamond: 46475000,
                            copper: 84500000,
                            medallion: 338000,
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
                            wood: 2995000,
                            strongWood: 1083000,
                            woodenBeam: 1195000,
                            stone: 2875000,
                            granite: 1480000,
                            iron: 2345000,
                            charcoal: 72000,
                            tools: 52000,
                            marble: 32500,
                            gold: 680000,
                            diamond: 305000,
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
                            wood: 12095000,
                            strongWood: 3083000,
                            woodenBeam: 3395000,
                            stone: 12075000,
                            granite: 5480000,
                            iron: 7345000,
                            charcoal: 96200,
                            tools: 72000,
                            marble: 42500,
                            gold: 1680000,
                            diamond: 905000,
                        },
                        requires: {
                            builder: {
                                amount: 10,
                            },
                        },
                    },
                    3: {
                        costs: {
                            wood: 302375000,
                            strongWood: 77075000,
                            woodenBeam: 84875000,
                            stone: 301875000,
                            granite: 137000000,
                            iron: 183625000,
                            charcoal: 2005000,
                            tools: 1500000,
                            marble: 962500,
                            gold: 42000000,
                            copper: 42000000,
                            diamond: 22625000,
                            medallion: 225000,
                        },
                        requires: {
                            builder: {
                                amount: 15,
                            },
                        },
                    },
                    4: {
                        costs: {
                            wood: 7559375000,
                            strongWood: 1926875000,
                            woodenBeam: 2121875000,
                            stone: 7546875000,
                            granite: 3425000000,
                            iron: 4590625000,
                            charcoal: 40125000,
                            tools: 35000000,
                            marble: 16562500,
                            gold: 1050000000,
                            copper: 1050000000,
                            diamond: 565625000,
                            medallion: 3625000,
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
                            wood: 1795000,
                            strongWood: 683000,
                            woodenBeam: 795000,
                            stone: 1870000,
                            granite: 880000,
                            iron: 1045000,
                            charcoal: 32000,
                            tools: 32000,
                            marble: 12500,
                            gold: 380000,
                            diamond: 185000,
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
                            wood: 17095000,
                            strongWood: 3583000,
                            woodenBeam: 3695000,
                            stone: 18075000,
                            granite: 6480000,
                            iron: 9345000,
                            charcoal: 126200,
                            tools: 92000,
                            copper: 1980000,
                            marble: 49500,
                            gold: 1780000,
                            diamond: 1205000,
                            medallion: 125000,
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
                            wood: 3500000,
                            strongWood: 1400000,
                            woodenBeam: 1395000,
                            stone: 3370000,
                            granite: 1480000,
                            iron: 2545000,
                            charcoal: 92000,
                            tools: 82000,
                            marble: 62500,
                            gold: 780000,
                            diamond: 385000,
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
                            wood: 10000000,
                            strongWood: 4400000,
                            woodenBeam: 3200000,
                            stone: 7500000,
                            granite: 3600000,
                            iron: 6245000,
                            charcoal: 149000,
                            tools: 138000,
                            marble: 123500,
                            gold: 2180000,
                            diamond: 905000,
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
                            wood: 50000000,
                            strongWood: 12400000,
                            woodenBeam: 13200000,
                            stone: 30000000,
                            granite: 12600000,
                            iron: 18245000,
                            charcoal: 289000,
                            tools: 258000,
                            marble: 203500,
                            gold: 5180000,
                            diamond: 2305000,
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
                            wood: 700000000,
                            strongWood: 173600000,
                            woodenBeam: 184800000,
                            stone: 420000000,
                            granite: 176400000,
                            iron: 255430000,
                            charcoal: 4046000,
                            tools: 3612000,
                            marble: 2849000,
                            gold: 72520000,
                            copper: 72520000,
                            diamond: 32270000,
                            medallion: 210000,
                        },
                        requires: {
                            tradingPost: {
                                amount: 16,
                            },
                        },
                        callback: this.trader.recalculateAutoMaxDeals.bind(this.trader),
                    },
                },
                // https://en.wikipedia.org/wiki/Trade_route#Historic_trade_routes
                routes: {
                    1: {
                        costs: {
                            wood: 3900000,
                            strongWood: 1700000,
                            woodenBeam: 1495000,
                            stone: 3570000,
                            granite: 1680000,
                            iron: 2945000,
                            charcoal: 102000,
                            tools: 92000,
                            marble: 72500,
                            gold: 980000,
                            diamond: 405000,
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
                            wood: 9000000,
                            strongWood: 4000000,
                            woodenBeam: 3000000,
                            stone: 7000000,
                            granite: 3100000,
                            iron: 5945000,
                            charcoal: 142000,
                            tools: 132000,
                            marble: 122500,
                            gold: 1980000,
                            diamond: 805000,
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
                            wood: 100000,
                            strongWood: 60000,
                            woodenBeam: 65000,
                            stone: 90000,
                            granite: 55000,
                            iron: 70000,
                            charcoal: 5000,
                            marble: 3500,
                            gold: 10000,
                        },
                        requires: {
                            academy: {
                                amount: 4,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 9000000,
                            strongWood: 4000000,
                            woodenBeam: 3000000,
                            stone: 7000000,
                            granite: 3100000,
                            iron: 5945000,
                            charcoal: 142000,
                            tools: 132000,
                            marble: 122500,
                            gold: 1980000,
                            diamond: 805000,
                            knowledge: 1000000
                        },
                        requires: {
                            academy: {
                                amount: 8,
                            },
                        },
                    },
                },
                explore: {
                    1: {
                        fixCosts: true,
                        costs: {
                            knowledge: 25000,
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
                            knowledge: 155000,
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
                            knowledge: 1355000,
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
                            knowledge: 24550000,
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
                            knowledge: 245500000,
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
                            knowledge: 845500000,
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
                            knowledge: 1691000000,
                        },
                        requires: {
                            academy: {
                                amount: 11,
                            },
                        },
                        callback: (function () {
                            $.each(this.state.getState().equippedBuildings, (building) => {
                                if (this.slot.isBuildingEquippedWith(building, EQUIPMENT_ITEM__DIASTATIC)) {
                                    this.buildQueue.addToQueue(BUILD_QUEUE__CONSTRUCT_SLOT, building, [], true);
                                }
                            });
                        }).bind(this),
                    },
                    8: {
                        fixCosts: true,
                        costs: {
                            knowledge: 3382000000,
                        },
                        requires: {
                            academy: {
                                amount: 12,
                            },
                        },
                        callback: (function () {
                            $.each(this.state.getState().equippedBuildings, (building) => {
                                if (this.slot.isBuildingEquippedWith(building, EQUIPMENT_ITEM__AMYLASE)) {
                                    this.buildQueue.addToQueue(BUILD_QUEUE__CONSTRUCT_SLOT, building, [], true);
                                }
                            });
                        }).bind(this),
                    },
                },
            },
            engineer: {
                construction: {
                    1: {
                        costs: {
                            wood: 1200000000,
                            strongWood: 660000000,
                            woodenBeam: 660000000,
                            stone: 1050000000,
                            granite: 450000000,
                            iron: 550000000,
                            gold: 90000000,
                            charcoal: 2300000,
                            tools: 2100000,
                            marble: 1400000,
                            diamond: 37500000,
                            copper: 43200000,
                            medallion: 840000,
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
                            wood: 1200000000,
                            strongWood: 660000000,
                            woodenBeam: 660000000,
                            stone: 1050000000,
                            granite: 450000000,
                            iron: 550000000,
                            gold: 90000000,
                            charcoal: 2300000,
                            tools: 2100000,
                            marble: 1400000,
                            diamond: 37500000,
                            copper: 43200000,
                            medallion: 840000,
                        },
                        requires: {
                            stone: {
                                amount: 25,
                            },
                        },
                    },
                    2: {
                        costs: {
                            wood: 24000000000,
                            strongWood: 13200000000,
                            woodenBeam: 13200000000,
                            stone: 21000000000,
                            granite: 9000000000,
                            iron: 11000000000,
                            gold: 1800000000,
                            charcoal: 46000000,
                            tools: 42000000,
                            marble: 28000000,
                            diamond: 750000000,
                            copper: 864000000,
                            medallion: 16800000,
                        },
                        requires: {
                            stone: {
                                amount: 30,
                            },
                        },
                    },
                    3: {
                        costs: {
                            wood: 480000000000,
                            strongWood: 264000000000,
                            woodenBeam: 264000000000,
                            stone: 420000000000,
                            granite: 180000000000,
                            iron: 220000000000,
                            gold: 36000000000,
                            charcoal: 920000000,
                            tools: 840000000,
                            marble: 560000000,
                            diamond: 15000000000,
                            copper: 17280000000,
                            medallion: 336000000,
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
                            wood: 1200000000,
                            strongWood: 660000000,
                            woodenBeam: 660000000,
                            stone: 1050000000,
                            granite: 450000000,
                            iron: 550000000,
                            gold: 90000000,
                            charcoal: 230000,
                            tools: 210000,
                            marble: 140000,
                            diamond: 37500000,
                            copper: 43200000,
                            medallion: 84000,
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
                            wood: 2400000000,
                            strongWood: 1320000000,
                            woodenBeam: 1320000000,
                            stone: 2100000000,
                            granite: 900000000,
                            iron: 1100000000,
                            gold: 180000000,
                            charcoal: 460000,
                            tools: 420000,
                            marble: 280000,
                            diamond: 75000000,
                            copper: 86400000,
                            medallion: 168000,
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
                            wood: 4800000000,
                            strongWood: 2640000000,
                            woodenBeam: 2640000000,
                            stone: 4200000000,
                            granite: 1800000000,
                            iron: 2200000000,
                            gold: 360000000,
                            charcoal: 920000,
                            tools: 840000,
                            marble: 560000,
                            diamond: 150000000,
                            copper: 172800000,
                            medallion: 336000,
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
                            wood: 9600000000,
                            strongWood: 5280000000,
                            woodenBeam: 5280000000,
                            stone: 8400000000,
                            granite: 3600000000,
                            iron: 4400000000,
                            gold: 720000000,
                            charcoal: 1840000,
                            tools: 1680000,
                            marble: 1120000,
                            diamond: 300000000,
                            copper: 345600000,
                            medallion: 672000,
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
                            wood: 1200000000,
                            strongWood: 660000000,
                            woodenBeam: 660000000,
                            stone: 1050000000,
                            granite: 450000000,
                            iron: 550000000,
                            gold: 100000000,
                            charcoal: 1600000,
                            tools: 1500000,
                            marble: 1000000,
                            diamond: 37500000,
                            copper: 43200000,
                            medallion: 540000,
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
                            wood: 3600000000,
                            strongWood: 1980000000,
                            woodenBeam: 1980000000,
                            stone: 3150000000,
                            granite: 1350000000,
                            iron: 1650000000,
                            gold: 300000000,
                            charcoal: 4800000,
                            tools: 4500000,
                            marble: 3000000,
                            diamond: 112500000,
                            copper: 129600000,
                            medallion: 1620000,
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
        };
    };

    beerFactoryGame.Upgrade = Upgrade;
})(BeerFactoryGame);

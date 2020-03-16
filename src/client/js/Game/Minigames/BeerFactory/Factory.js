(function(beerFactoryGame) {
    'use strict';

    const REQUIRED_MATERIALS__FACTORY_CONSTRUCTION = {
        wood: {
            wood: 30,
        },
        storage: {
            wood: 75,
            strongWood: 30,
        },
        transport: {
            wood: 250,
            strongWood: 30,
            stone: 50
        },
        stone: {
            wood: 500,
            strongWood: 100,
        },
        iron: {
            wood: 2_000,
            strongWood: 1_000,
            woodenBeam: 1_000,
            stone: 1_500,
            granite: 1_000,
        },
        lodge: {
            wood: 10_000,
            strongWood: 2_000,
            woodenBeam: 3_000,
            iron: 4_000,
            stone: 10_000,
            granite: 5_000,
        },
        mine: {
            wood: 15_000,
            strongWood: 6_000,
            woodenBeam: 7_500,
            stone: 13_000,
            iron: 8_000,
            charcoal: 1_000,
            tools: 750,
        },
        academy: {
            wood: 150_000,
            strongWood: 80_000,
            woodenBeam: 80_000,
            stone: 130_000,
            granite: 60_000,
            iron: 75_000,
            tools: 8_000,
            marble: 6_500,
            gold: 12_500,
        },
        builder: {
            wood: 250_000,
            strongWood: 120_000,
            woodenBeam: 120_000,
            stone: 220_000,
            granite: 110_000,
            iron: 125_000,
            tools: 10_000,
            marble: 7_500,
            gold: 22_500,
            charcoal: 6_000,
        },
        tradingPost: {
            wood: 500_000,
            strongWood: 240_000,
            woodenBeam: 240_000,
            stone: 440_000,
            granite: 220_000,
            iron: 250_000,
            copper: 120_000,
            diamond: 35_000,
            tools: 11_000,
            marble: 8_500,
            gold: 82_500,
            charcoal: 7_000,
        },
        backRoom: {
            wood: 2_000_000,
            strongWood: 960_000,
            woodenBeam: 960_000,
            stone: 1_760_000,
            granite: 880_000,
            iron: 1_000_000,
            copper: 880_000,
            diamond: 340_000,
            tools: 44_000,
            marble: 34_000,
            gold: 630_000,
            charcoal: 28_000,
        },
    };

    Factory.prototype.state   = null;
    Factory.prototype.cache   = null;
    Factory.prototype.upgrade = null;
    Factory.prototype.render  = null;

    Factory.prototype.achievementController  = null;

    Factory.prototype.missingMaterials = {};
    Factory.prototype.averageFactoryExtensionProduction = {};

    function Factory(state, cache, achievementController) {
        this.state   = state;
        this.cache   = cache;

        this.achievementController = achievementController;
    }

    Factory.prototype.setRender = function (render) {
        this.render = render;
        return this;
    };

    Factory.prototype.setUpgrade = function (upgrade) {
        this.upgrade = upgrade;
        return this;
    };

    /**
     * Check if any extension associated with the given factory is currently missing any materials
     *
     * @param {string} factory
     *
     * @returns {boolean}
     * @private
     */
    Factory.prototype.hasFactoryExtensionMissingMaterials = function (factory) {
        if (!this.state.getFactory(factory).extensions) {
            return false;
        }

        let hasMissingMaterials = false;
        $.each(this.state.getFactory(factory).extensions, (function (index, extension) {
            if (!!this.missingMaterials[extension] &&
                !this.state.getExtensionStorage(extension).paused &&
                Object.values(this.missingMaterials[extension])
                    .reduce((total, material) => total || material > MISSING_MATERIAL_BUFFER, false)
            ) {
                hasMissingMaterials = true;
                return false;
            }
        }).bind(this));

        return hasMissingMaterials;
    };

    Factory.prototype.getMissingMaterials = function (extension) {
        return this.missingMaterials[extension];
    };

    /**
     * Get the material a factory produces
     *
     * @param factory
     * @returns {*}
     */
    Factory.prototype.getProducedMaterial = function (factory) {
        const producedMaterialCache = this.cache.getProducedMaterialCache(factory);

        return producedMaterialCache[Math.floor(Math.random() * producedMaterialCache.length)];
    };

    Factory.prototype.getAverageFactoryExtensionProduction = function (extension) {
        return this.averageFactoryExtensionProduction[extension];
    };

    /**
     * Get the maximum amount a factory extension can store
     *
     * @param {string} extension
     *
     * @returns {number}
     * @private
     */
    Factory.prototype.getFactoryExtensionStorageCapacity = function (extension) {
        if (extension === null) {
            return 0;
        }

        return Math.ceil(
            this.state.getState().extensionStorageCapacity
            * ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue()
            * Object.keys(EXTENSIONS[extension].consumes).length
            / 2
        );
    };

    /**
     * Calculate the required materials for a new factory construction job
     *
     * @param {string} factory The key of the requested factory
     *
     * @returns {Object}
     */
    Factory.prototype.getRequiredMaterialsForNextFactory = function (factory) {
        let requiredBaseMaterials = {};

        $.each(REQUIRED_MATERIALS__FACTORY_CONSTRUCTION[factory], (function mapRequiredMaterials(material, amount) {
            requiredBaseMaterials[material] = {
                name:      translator.translate('beerFactory.material.' + material),
                key:       material,
                required:  Math.ceil(
                    Math.pow(1.8, this.getFactoryAmount(factory))
                        * amount
                        * this.getBuilderReduction(BUILD_QUEUE__BUILD))
                        * this.getEngineerReduction(),
                delivered: 0,
            };
        }).bind(this));

        return Object.values(this._addRequiredMaterialsForUnlockedUpgrades(requiredBaseMaterials, factory));
    };

    /**
     * Add all materials to a given list of base materials which are required for already unlocked factory upgrades
     *
     * @param requiredBaseMaterials
     * @param factory
     *
     * @private
     */
    Factory.prototype._addRequiredMaterialsForUnlockedUpgrades = function (requiredBaseMaterials, factory) {
        let   additionalMaterials = {};

        // upgrading after the first invention is expensive
        const upgradeMultiplier = 3
            * this.getBuilderReduction(BUILD_QUEUE__BUILD)
            * this.getEngineerReduction();

        const factoryObject = this.state.getFactory(factory);

        if (!factoryObject) {
            (new Beerplop.ErrorReporter()).reportError(
                'DEBUG',
                '_addRequiredMaterialsForUnlockedUpgrades failed to fetch factory',
                factory
            );

            return requiredBaseMaterials;
        }

        $.each(factoryObject.upgrades, (function (upgrade, unlockedLevel) {
            // check if another upgrade is queued. In this case also add the materials for the queued entry
            $.each(this.state.getBuildQueue(), function (index, queueEntry) {
                if (queueEntry.action === BUILD_QUEUE__UPGRADE &&
                    queueEntry.item.factory === factory &&
                    queueEntry.item.upgrade === upgrade
                ) {
                    unlockedLevel++;
                    return false;
                }
            });

            // Add the materials for all unlocked levels
            for (let level = 1; level <= unlockedLevel; level++) {
                const upgradePath = this.upgrade.getUpgrade(factory, upgrade, level);

                // don't add the costs for fix priced upgrades to the building costs
                if (upgradePath.fixCosts) {
                    continue;
                }

                $.each(upgradePath.costs, function (material, amount) {
                    amount *= upgradeMultiplier;

                    additionalMaterials[material] ?
                        additionalMaterials[material] += amount :
                        additionalMaterials[material] = amount;
                });
            }
        }).bind(this));

        $.each(additionalMaterials, function (material, amount) {
            if (requiredBaseMaterials[material]) {
                requiredBaseMaterials[material].required += amount;
            } else {
                requiredBaseMaterials[material] = {
                    name:      translator.translate('beerFactory.material.' + material),
                    key:       material,
                    required:  amount,
                    delivered: 0,
                };
            }
        });

        $.each(requiredBaseMaterials, function (material) {
            requiredBaseMaterials[material].required = Math.ceil(requiredBaseMaterials[material].required);
        });

        return requiredBaseMaterials;
    };

    /**
     * Get the owned amount of a factory including the queued builds for the factory
     *
     * @param {string} factory
     *
     * @returns {int}
     */
    Factory.prototype.getFactoryAmount = function (factory) {
        let queuedBuilds = 0;

        $.each(this.state.getBuildQueue(), function getBuildJobsFromBuildQueueForFactory() {
            if (this.action === BUILD_QUEUE__BUILD && this.item === factory) {
                queuedBuilds++;
            }
        });

        return this.state.getFactory(factory).amount + queuedBuilds;
    };

    /**
     * Calculate the builder reduction for a given queue action.
     *
     * @param action
     * @returns {number}
     */
    Factory.prototype.getBuilderReduction = function (action) {
        const builder             = this.state.getFactory('builder'),
              defaultReductionMap = {
                  [BUILD_QUEUE__BUILD]: {
                      reduction: 0.02,
                      diversify: 0,
                  },
                  [BUILD_QUEUE__UPGRADE]: {
                      reduction: 0.01,
                      diversify: 1,
                  },
                  [BUILD_QUEUE__CONSTRUCT_SLOT]: {
                      reduction: 0.01,
                      diversify: 2,
                  },
              };

        // calculate with for each builder, add another 0.5% for each double upgrade
        const reduction = Math.pow(
            1 - (defaultReductionMap[action].reduction + 0.005 * builder.upgrades.double),
            builder.amount
        );

        // Check the reached upgrade level for diversify which unlocks the reduction for advanced actions
        if (builder.upgrades.diversify < defaultReductionMap[action].diversify) {
            return 1;
        }

        return reduction;
    };

    /**
     * Get the building reduction caused by engineering calculations
     *
     * @returns {number}
     */
    Factory.prototype.getEngineerReduction = function () {
        return Math.pow(0.9, this.state.getFactory('engineer').upgrades.calculation);
    };

    /**
     * Init the event listener to equip a proxy factory extension
     */
    Factory.prototype.initProxyFactoryExtensionEquipEventListener = function () {
        $('.beer-factory__proxy-extension-popover').on('click', (function (event) {
            const proxyExtensionKey = $(event.target)
                .closest('.beer-factory__proxy-extension-popover')
                .data('extensionKey');

            let proxiedExtension = this.state.getState().proxyExtension[proxyExtensionKey].extension;

            const modal           = $('#beer-factory__equip-proxy-extension-modal'),
                  modalBody       = $('#beer-factory__equip-proxy-extension-modal__body'),
                  renderModalBody = (function () {
                      modalBody.html(
                          Mustache.render(
                              TemplateStorage.get('beer-factory__equip-proxy-extension-modal__body-template'),
                              {
                                  equipped:        proxiedExtension !== null,
                                  equippedLabel:   proxiedExtension !== null
                                      ? translator.translate(`beerFactory.extension.${proxiedExtension}`)
                                      : '',
                                  equippedContent: proxiedExtension !== null
                                      ? translator.translate(`beerFactory.extension.${proxiedExtension}.description`)
                                      : '',
                                  equippedKey: proxiedExtension !== null ? proxiedExtension : 'proxy-extension',
                                  availableExtensions: Object.values(this.state.getFactories())
                                      // keep only factories with extensions
                                      .filter(factory => factory.extensions)
                                      // filter out the equipped extension
                                      .map(factory => factory.extensions.filter(
                                          extension => extension !== proxiedExtension && EXTENSIONS[extension].type !== EXTENSION_TYPE__PROXY
                                      ))
                                      // reduce the extensions of all factories into a single array
                                      .reduce((a, b) => a.concat(b), [])
                                      .map(extension => (
                                          {
                                              key:         extension,
                                              label:       translator.translate(`beerFactory.extension.${extension}`),
                                              description: translator.translate(`beerFactory.extension.${extension}.description`),
                                          }
                                      )),
                              }
                          )
                      );

                      modalBody.find('.beer-factory__slot').popover();

                      modalBody
                          .find('.beer-factory__slot:not(.beer-factory__slot--equipped)')
                          .on('click', (function (event) {
                              const selectedExtension = $(event.target)
                                  .closest('.beer-factory__slot')
                                  .data('extensionKey');

                              this.state.initExtensionStorage(proxyExtensionKey, selectedExtension);
                              this.state.getState().proxyExtension[proxyExtensionKey] = {
                                  extension: selectedExtension,
                                  factory:   this._getFactoryByExtension(selectedExtension),
                              };

                              delete this.averageFactoryExtensionProduction[proxyExtensionKey];

                              proxiedExtension = selectedExtension;

                              modalBody.find('.beer-factory__slot').popover('dispose');
                              renderModalBody();

                              this.render.updateFactoriesMap();

                              this.achievementController.checkAchievement(
                                  this.achievementController.getAchievementStorage().achievements.beerFactory.slots.equipProxy
                              );
                          }).bind(this));
                  }).bind(this);

            renderModalBody();

            modal.modal('show');
        }).bind(this));
    };


    /**
     * Get the key of the factory which has enabled the given extension
     *
     * @param {string} extension
     *
     * @returns {string|null}
     *
     * @private
     */
    Factory.prototype._getFactoryByExtension = function (extension) {
        let factory = null;

        $.each(this.state.getFactories(), function (factoryKey, factoryData) {
            if (factoryData.extensions && $.inArray(extension, factoryData.extensions) !== -1) {
                factory = factoryKey;

                return false;
            }
        });

        return factory;
    };

    beerFactoryGame.Factory = Factory;
})(BeerFactoryGame);

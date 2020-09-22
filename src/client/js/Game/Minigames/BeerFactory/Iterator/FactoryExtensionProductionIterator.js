(function(beerFactoryGame) {
    'use strict';

    FactoryExtensionProductionIterator.prototype.state   = null;
    FactoryExtensionProductionIterator.prototype.stock   = null;
    FactoryExtensionProductionIterator.prototype.render  = null;
    FactoryExtensionProductionIterator.prototype.factory = null;
    FactoryExtensionProductionIterator.prototype.cache   = null;

    FactoryExtensionProductionIterator.prototype.numberFormatter = null;
    FactoryExtensionProductionIterator.prototype.gameEventBus    = null;

    function FactoryExtensionProductionIterator(state, stock, render, factory, cache, numberFormatter, gameEventBus) {
        this.state   = state;
        this.stock   = stock;
        this.render  = render;
        this.factory = factory;
        this.cache   = cache;

        this.numberFormatter = numberFormatter;
        this.gameEventBus    = gameEventBus;
    }

    /**
     * Check the item production for a given factory extension.
     *
     * @param {string} factoryKey  The key of the factory
     * @param {object} factoryData The factory object
     * @param {string} extension   The extension which to check
     *
     * @returns {boolean}
     */
    FactoryExtensionProductionIterator.prototype.checkFactoryExtensionProduction = function (
        factoryKey,
        factoryData,
        extension
    ) {
        let extensionStorage = this.state.getExtensionStorage(extension),
            proxiedExtension = extension,
            state            = this.state.getState();

        if (state.proxyExtension[extension]) {
            proxiedExtension = state.proxyExtension[extension].extension;
            if (!proxiedExtension) {
                return false;
            }

            factoryData = this.state.getFactory(state.proxyExtension[extension].factory);
        }

        const params = [factoryKey, factoryData, extension, extensionStorage, proxiedExtension];

        return EXTENSIONS[proxiedExtension].productionType === EXTENSION_PRODUCTION__DIRECT
            ? this._checkFactoryExtensionProductionDirect(...params)
            : this._checkFactoryExtensionProductionProject(...params);
    };

    /**
     * Check the project production of items of a factory extension
     *
     * @param factoryKey
     * @param factoryData
     * @param extension
     * @param extensionStorage
     * @param proxiedExtensionKey
     *
     * @returns {boolean}
     *
     * @private
     */
    FactoryExtensionProductionIterator.prototype._checkFactoryExtensionProductionProject = function (
        factoryKey,
        factoryData,
        extension,
        extensionStorage,
        proxiedExtensionKey
    ) {
        if (proxiedExtensionKey === null || extensionStorage.paused) {
            return false;
        }

        if (!extensionStorage.project || extensionStorage.project.finished) {
            this._startExtensionProject(extensionStorage, proxiedExtensionKey);

            // no project to start
            if (!extensionStorage.project) {
                return false;
            }
        }

        let availableAmountToDeliver = factoryData.amount * 5 * ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue(),
            updateStockTable         = false,
            checkFinished            = false;

        $.each(extensionStorage.project.materials, (function (material, data) {
            if (data.delivered < 0) {
                (new Beerplop.ErrorReporter()).reportError(
                    'DEBUG',
                    'FactoryExtensionProductionIterator _checkFactoryExtensionProductionProject reset negative delivered',
                    proxiedExtensionKey + ' ' + material
                );

                data.delivered = 0;
            }

            if (data.delivered >= data.required) {
                checkFinished = true;
                return;
            }

            const deliveredMaterial = Math.min(
                availableAmountToDeliver,
                data.required - data.delivered,
                extensionStorage.materials[material]
            );

            if (deliveredMaterial <= 0) {
                return;
            }

            data.delivered                       += deliveredMaterial;
            extensionStorage.materials[material] -= deliveredMaterial;
            extensionStorage.stored              -= deliveredMaterial;
            availableAmountToDeliver             -= deliveredMaterial;

            updateStockTable = true;

            if (this.render.getVisibleExtensionPopover() === extension) {
                $('#beer-factory__extension-popover__storage-' + material).text(
                    this.numberFormatter.formatInt(extensionStorage.materials[material])
                );
                $('#beer-factory__extension-popover__production-progress-' + material).text(
                    this.numberFormatter.formatInt(data.delivered)
                );
            }

            if (availableAmountToDeliver === 0) {
                return false;
            }
        }).bind(this));

        if (updateStockTable && this.render.getVisibleExtensionPopover() === extension) {
            $('#beer-factory__extension-popover__storage-' + extension).text(
                this.numberFormatter.formatInt(extensionStorage.stored)
            );
        }

        if (checkFinished) {
            let finished = true;

            $.each(extensionStorage.project.materials, function (material, data) {
                if (data.delivered < data.required) {
                    finished = false;
                    return false;
                }
            });

            if (finished && this._finishExtensionProject(extensionStorage, proxiedExtensionKey)) {
                if (this.render.getVisibleExtensionPopover() === extension) {
                    $('.beer-factory__extension-popover__production-progress').text(0);
                }

                extensionStorage.project.finished = true;
            }
        }

        return updateStockTable;
    };

    FactoryExtensionProductionIterator.prototype._finishExtensionProject = function (
        extensionStorage,
        proxiedExtensionKey,
    ) {
        if (!EXTENSIONS[proxiedExtensionKey].hasProjectQueue) {
            // TODO: add with loop for project based extensions with multiple outputs
            // TODO: cache labels
            return this.stock.addToStock(
                Object.keys(EXTENSIONS[proxiedExtensionKey].produces)[0],
                ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue(),
                translator.translate('beerFactory.factory.' + factoryKey) + ': ' +
                translator.translate(`beerFactory.extension.${proxiedExtensionKey}`),
                false
            );
        }

        this.gameEventBus.emit(EVENTS.BEER_FACTORY.EXTENSION_QUEUE.FINISHED, [
            proxiedExtensionKey,
            extensionStorage.project,
        ]);

        (new Beerplop.Notification()).notify({
            content: translator.translate(`beerFactory.extension.${proxiedExtensionKey}`) + ': ' +
                translator.translate(
                    `beerFactory.projectQueue.${proxiedExtensionKey}.${extensionStorage.project.action}.finish`,
                    this.render.getFactoryExtensionProjectNotificationVariables(
                        proxiedExtensionKey,
                        extensionStorage.project,
                    ),
                ),
            style:   'snackbar-success',
            timeout: 5000,
            channel: 'beerFactory',
        });

        return true;
    };

    /**
     * Start a new project for a project-based factory extension
     *
     * @param {object} extensionStorage
     * @param {string} proxiedExtensionKey
     *
     * @private
     */
    FactoryExtensionProductionIterator.prototype._startExtensionProject = function (
        extensionStorage,
        proxiedExtensionKey,
    ) {
        extensionStorage.project = {
            materials: {},
            finished: false,
        };

        let requiredMaterials;

        // if the extension constructs projects from a queue with various materials pop an entry from the queue.
        // Otherwise use the consumption from the extension definition to determine the required materials
        if (EXTENSIONS[proxiedExtensionKey].productionType === EXTENSION_PRODUCTION__PROJECT &&
            EXTENSIONS[proxiedExtensionKey].hasProjectQueue
        ) {
            // the queue is hold centralized. Consequently a proxied extension must look up the queue from the mirrored
            // factory extension
            const queue = this.state.getExtensionStorage(proxiedExtensionKey).queue;

            if (!queue.length) {
                extensionStorage.project = null;
                return;
            }

            const nextProject = queue.shift();
            requiredMaterials = nextProject.materials;

            $.extend(true, extensionStorage.project, {action: nextProject.action}, nextProject.data || {});

            // TODO: UI

            (new Beerplop.Notification()).notify({
                content: translator.translate(`beerFactory.extension.${proxiedExtensionKey}`) + ': ' +
                    translator.translate(
                        `beerFactory.projectQueue.${proxiedExtensionKey}.${nextProject.action}.start`,
                        this.render.getFactoryExtensionProjectNotificationVariables(
                            proxiedExtensionKey,
                            extensionStorage.project,
                        ),
                    ),
                style:   'snackbar-info',
                timeout: 5000,
                channel: 'beerFactory',
            });
        } else {
            requiredMaterials = this.cache.getFactoryExtensionConsumption(proxiedExtensionKey);
        }

        $.each(requiredMaterials, function (material, required) {
            extensionStorage.project.materials[material] = {
                required: required,
                delivered: 0,
            }
        });
    }

    /**
     * Check the direct production of items of a factory extension
     *
     * @param factoryKey
     * @param factoryData
     * @param extension
     * @param extensionStorage
     * @param proxiedExtension
     *
     * @returns {boolean}
     *
     * @private
     */
    FactoryExtensionProductionIterator.prototype._checkFactoryExtensionProductionDirect = function (
        factoryKey,
        factoryData,
        extension,
        extensionStorage,
        proxiedExtension
    ) {
        if (proxiedExtension === null) {
            return false;
        }

        // TODO improve API to write to averageFactoryExtensionProduction
        if (!this.factory.averageFactoryExtensionProduction[extension]) {
            this.factory.averageFactoryExtensionProduction[extension] = {};
            $.each(EXTENSIONS[proxiedExtension].produces, (function (material) {
                this.factory.averageFactoryExtensionProduction[extension][material] = 0;
            }).bind(this));
        }

        if (extensionStorage.paused) {
            return false;
        }

        // determine how many items can be produced
        let availableMaterials = [this._getMaxFactoryExtensionProduction(proxiedExtension, factoryKey, factoryData)];
        $.each(
            this.cache.getFactoryExtensionConsumption(proxiedExtension),
            (function checkAvailableMaterialsForExtensionProduction(material, amount) {
                availableMaterials.push(Math.floor(extensionStorage.materials[material] / amount));
            }).bind(this)
        );

        const producedAmount = Math.min(...availableMaterials);

        if (producedAmount === 0) {
            $.each(EXTENSIONS[proxiedExtension].produces, (function updateAverageFactoryExtensionProduction(material) {
                this._updateAverageFactoryExtensionProduction(extension, material, 0);
            }).bind(this));

            return false;
        }

        let updateStockTable = false,
            consumedAmount   = 0;

        $.each(
            this.cache.getFactoryExtensionProduction(proxiedExtension),
            (function produceExtensionMaterial(material, production) {
                // TODO: cache labels
                const addedAmount = this.stock.addToStock(
                    material,
                    production.amount * production.boost * producedAmount,
                    translator.translate('beerFactory.factory.' + factoryKey) + ': ' +
                        translator.translate(`beerFactory.extension.${proxiedExtension}`),
                    false
                );

                updateStockTable = addedAmount > 0 || updateStockTable;
                consumedAmount   = Math.max(
                    consumedAmount,
                    Math.floor(addedAmount / production.boost / production.amount)
                );

                if (!extensionStorage.produced || !extensionStorage.produced[material]) {
                    extensionStorage.produced = {};
                    extensionStorage.produced[material] = 0;
                }
                extensionStorage.produced[material] += addedAmount;

                this._updateAverageFactoryExtensionProduction(extension, material, addedAmount);
            }).bind(this)
        );

        $.each(
            this.cache.getFactoryExtensionConsumption(proxiedExtension),
            (function removeConsumedMaterialsFromExtensionStorage(material, amount) {
                extensionStorage.materials[material] -= consumedAmount * amount;
                extensionStorage.stored              -= consumedAmount * amount;

                if (this.render.getVisibleExtensionPopover() === extension) {
                    $('#beer-factory__extension-popover__storage-' + material).text(
                        this.numberFormatter.formatInt(extensionStorage.materials[material])
                    );
                }
            }).bind(this)
        );

        if (this.render.getVisibleExtensionPopover() === extension) {
            $('#beer-factory__extension-popover__storage-' + extension).text(
                this.numberFormatter.formatInt(extensionStorage.stored)
            );
        }

        return updateStockTable;
    };

    /**
     * Determine how many items a factory extension can produce
     * TODO: lodges influence the extensions?
     *
     * @param {string} extension
     * @param {string} factoryKey
     * @param {object} factoryData
     *
     * @returns {number}
     * @private
     */
    FactoryExtensionProductionIterator.prototype._getMaxFactoryExtensionProduction = function (
        extension,
        factoryKey,
        factoryData
    ) {
        let multiplier = ComposedValueRegistry.getComposedValue(CV_FACTORY).getValue()
            * this.cache.getBackRoomMultiplier(factoryKey)
            * (this.state.getExtensionStorage(extension).boost || 1);

        if (factoryData.upgrades.double) {
            multiplier *= Math.pow(1.5, factoryData.upgrades.double);
        }

        // Three factories are required for a single production circle
        return Math.floor(factoryData.amount / 3 * multiplier);
    };

    /**
     * Track the average production of the extension
     *
     * @param {string} extension The extension
     * @param {string} material  The produced material
     * @param {int}    amount    The produced amount
     *
     * @private
     */
    FactoryExtensionProductionIterator.prototype._updateAverageFactoryExtensionProduction = function (
        extension,
        material,
        amount
    ) {
        this.factory.averageFactoryExtensionProduction[extension][material] =
            (this.factory.averageFactoryExtensionProduction[extension][material] * 3 + amount) / 4;

        if (this.render.getVisibleExtensionPopover() === extension) {
            $('#beer-factory__extension-popover__production-' + material).text(
                this.numberFormatter.formatInt(this.factory.averageFactoryExtensionProduction[extension][material])
            );
        }
    };

    beerFactoryGame.FactoryExtensionProductionIterator = FactoryExtensionProductionIterator;
})(BeerFactoryGame);

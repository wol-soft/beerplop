(function(beerFactoryGame) {
    'use strict';

    FactoryExtensionMaterialDeliveryIterator.prototype.internalCache = {
        missingMaterialsHintCache: {},
    };

    FactoryExtensionMaterialDeliveryIterator.prototype.state   = null;
    FactoryExtensionMaterialDeliveryIterator.prototype.stock   = null;
    FactoryExtensionMaterialDeliveryIterator.prototype.factory = null;
    FactoryExtensionMaterialDeliveryIterator.prototype.cache   = null;
    FactoryExtensionMaterialDeliveryIterator.prototype.render  = null;

    FactoryExtensionMaterialDeliveryIterator.prototype.numberFormatter  = null;

    function FactoryExtensionMaterialDeliveryIterator(state, stock, factory, cache, render, numberFormatter) {
        this.state   = state;
        this.stock   = stock;
        this.factory = factory;
        this.cache   = cache;
        this.render  = render;

        this.numberFormatter = numberFormatter;
    }

    /**
     * Loop over all enabled factory extensions and check the material delivery
     *
     * @returns {boolean}
     */
    FactoryExtensionMaterialDeliveryIterator.prototype.checkEnabledExtensionsMaterialDelivery = function () {
        let updateStockTable = false;

        $.each(this.state.getFactories(), (function checkFactoryExtensionMaterialDelivery(factory, factoryData) {
            if (factoryData.extensions && factoryData.extensions.length > 0)
                $.each(factoryData.extensions, (function checkFactoryExtensionMaterialDelivery(index, extension) {
                    if (this._checkFactoryExtensionMaterialDelivery(factory, extension)) {
                        updateStockTable = true;
                    }
                }).bind(this));
        }).bind(this));

        return updateStockTable;
    };

    /**
     * Deliver material to the given extension.
     *
     * @param {string} factoryKey   The factory the extension belongs to for providing missing material hints
     * @param {string} extensionKey The extension to deliver materials to
     *
     * @returns {boolean}
     * @private
     */
    FactoryExtensionMaterialDeliveryIterator.prototype._checkFactoryExtensionMaterialDelivery = function (
        factoryKey,
        extensionKey,
    ) {
        let state               = this.state,
            proxiedExtensionKey = state.getState().proxyExtension[extensionKey]
                ? state.getState().proxyExtension[extensionKey].extension
                : extensionKey;

        if (!proxiedExtensionKey) {
            return false;
        }

        let updateStockTable         = false,
            extensionStorage         = state.getExtensionStorage(extensionKey),
            extensionStorageCapacity = this.factory.getFactoryExtensionStorageCapacity(factoryKey, proxiedExtensionKey),
            maxTransportToExtension  = Math.min(
                Math.ceil(this.cache.getDeliverCapacity() / state.getState().extensionTransportDividend),
                extensionStorageCapacity - extensionStorage.stored
            );

        if (extensionStorage.paused) {
            return false;
        }

        const shuffleArray          = arr => arr.sort(() => Math.random() - 0.5),
              materials             = Object.keys(extensionStorage.materials),
              // avoid filling up the complete storage with a single material which would stuck the extension
              maxStoragePerMaterial = Math.floor(extensionStorageCapacity / materials.length);

        // gather materials for the extCension
        $.each(shuffleArray(materials), (function gatherMaterialsForFactoryExtension(index, material) {
            // if a larger amount than possible is stored reset the storage (possible eg. after a boost is disabled)
            if (extensionStorage.materials[material] > maxStoragePerMaterial) {
                extensionStorage.stored              = extensionStorage.stored - (extensionStorage.materials[material] - maxStoragePerMaterial);
                extensionStorage.materials[material] = maxStoragePerMaterial;
            }

            let requestedAmount = Math.min(
                    maxTransportToExtension,
                    maxStoragePerMaterial - extensionStorage.materials[material],
                ),

                // TODO: cache labels
                deliveredAmount = this.stock.removeFromStock(
                    material,
                    Math.min(
                        requestedAmount,
                        // TODO: make factory extension max transport percentage configurable
                        Math.floor(state.getMaterial(material).amount * 0.8),
                    ),
                    translator.translate('beerFactory.factory.' + factoryKey) + ': ' +
                        translator.translate(`beerFactory.extension.${proxiedExtensionKey}`),
                    false
                );

            if (deliveredAmount === 0) {
                if (requestedAmount > 0) {
                    if (!this.factory.missingMaterials[extensionKey]) {
                        this.factory.missingMaterials[extensionKey] = {};
                        $.each(this.cache.getFactoryExtensionConsumption(proxiedExtensionKey), (function (material) {
                            this.factory.missingMaterials[extensionKey][material] = 0;
                        }).bind(this));
                    }

                    this.factory.missingMaterials[extensionKey][material]++;
                    if (!this.internalCache.missingMaterialsHintCache[extensionKey + '-' + material] &&
                        this.factory.missingMaterials[extensionKey][material] > MISSING_MATERIAL_BUFFER &&
                        extensionStorage.materials[material] < this.cache.getFactoryExtensionConsumption(proxiedExtensionKey)[material]
                    ) {
                        $('#beer-factory__extension__missing-resource-' + extensionKey + '-' + material)
                            .removeClass('d-none');

                        this.render.getFactoryMissingMaterialHintElement(factoryKey).removeClass('d-none');
                        this.internalCache.missingMaterialsHintCache[extensionKey + '-' + material] = true;
                    }
                }

                return;
            }

            maxTransportToExtension              -= deliveredAmount;
            extensionStorage.materials[material] += deliveredAmount;
            extensionStorage.stored              += deliveredAmount;
            updateStockTable = true;

            if (this.render.getVisibleExtensionPopover() === extensionKey) {
                $('#beer-factory__extension-popover__storage-' + material).text(
                    this.numberFormatter.formatInt(extensionStorage.materials[material])
                );
            }

            // TODO: better API to handle missing materials storage
            if (this.factory.missingMaterials[extensionKey] &&
                this.factory.missingMaterials[extensionKey][material] > 0
            ) {
                if (this.factory.missingMaterials[extensionKey][material] > MISSING_MATERIAL_BUFFER) {
                    $('#beer-factory__extension__missing-resource-' + extensionKey + '-' + material)
                        .addClass('d-none');
                }

                this.factory.missingMaterials[extensionKey][material] = 0;
                this.internalCache.missingMaterialsHintCache[extensionKey + '-' + material] = false;

                if (!this.factory.hasFactoryExtensionMissingMaterials(factoryKey)) {
                    this.render.getFactoryMissingMaterialHintElement(factoryKey).addClass('d-none');
                }
            }
        }).bind(this));

        if (updateStockTable && this.render.getVisibleExtensionPopover() === extensionKey) {
            $('#beer-factory__extension-popover__storage-' + extensionKey).text(
                this.numberFormatter.formatInt(extensionStorage.stored)
            );
        }

        return updateStockTable;
    };

    beerFactoryGame.FactoryExtensionMaterialDeliveryIterator = FactoryExtensionMaterialDeliveryIterator;
})(BeerFactoryGame);

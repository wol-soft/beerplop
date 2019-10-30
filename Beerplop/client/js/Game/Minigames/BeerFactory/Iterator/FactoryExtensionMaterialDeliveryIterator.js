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
     * @param {string} factory   The factory the extension belongs to for providing missing material hints
     * @param {string} extension The extension to deliver materials to
     *
     * @returns {boolean}
     * @private
     */
    FactoryExtensionMaterialDeliveryIterator.prototype._checkFactoryExtensionMaterialDelivery = function (
        factory,
        extension
    ) {
        let state            = this.state,
            proxiedExtension = state.getState().proxyExtension[extension]
                ? state.getState().proxyExtension[extension].extension
                : extension;

        if (!proxiedExtension) {
            return false;
        }

        let updateStockTable         = false,
            extensionStorage         = state.getExtensionStorage(extension),
            extensionStorageCapacity = this.factory.getFactoryExtensionStorageCapacity(proxiedExtension),
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
              maxStoragePerMaterial = Math.floor(extensionStorageCapacity * .9 / materials.length);

        // gather materials for the extension
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
                    translator.translate('beerFactory.factory.' + factory) + ': ' +
                        translator.translate(`beerFactory.extension.${proxiedExtension}`),
                    false
                );

            if (deliveredAmount === 0) {
                if (requestedAmount > 0) {
                    if (!this.factory.missingMaterials[extension]) {
                        this.factory.missingMaterials[extension] = {};
                        $.each(this.cache.getFactoryExtensionConsumption(proxiedExtension), (function (material) {
                            this.factory.missingMaterials[extension][material] = 0;
                        }).bind(this));
                    }

                    this.factory.missingMaterials[extension][material]++;
                    if (!this.internalCache.missingMaterialsHintCache[extension + '-' + material] &&
                        this.factory.missingMaterials[extension][material] > MISSING_MATERIAL_BUFFER &&
                        extensionStorage.materials[material] < this.cache.getFactoryExtensionConsumption(proxiedExtension)[material]
                    ) {
                        $('#beer-factory__extension__missing-resource-' + extension + '-' + material)
                            .removeClass('d-none');

                        this.render.getFactoryMissingMaterialHintElement(factory).removeClass('d-none');
                        this.internalCache.missingMaterialsHintCache[extension + '-' + material] = true;
                    }
                }

                return;
            }

            maxTransportToExtension              -= deliveredAmount;
            extensionStorage.materials[material] += deliveredAmount;
            extensionStorage.stored              += deliveredAmount;
            updateStockTable = true;

            if (this.render.getVisibleExtensionPopover() === extension) {
                $('#beer-factory__extension-popover__storage-' + material).text(
                    this.numberFormatter.formatInt(extensionStorage.materials[material])
                );
            }

            // TODO: better API to handle missing materials storage
            if (this.factory.missingMaterials[extension] &&
                this.factory.missingMaterials[extension][material] > 0
            ) {
                if (this.factory.missingMaterials[extension][material] > MISSING_MATERIAL_BUFFER) {
                    $('#beer-factory__extension__missing-resource-' + extension + '-' + material)
                        .addClass('d-none');
                }

                this.factory.missingMaterials[extension][material] = 0;
                this.internalCache.missingMaterialsHintCache[extension + '-' + material] = false;

                if (!this.factory.hasFactoryExtensionMissingMaterials(factory)) {
                    this.render.getFactoryMissingMaterialHintElement(factory).addClass('d-none');
                }
            }
        }).bind(this));

        if (updateStockTable && this.render.getVisibleExtensionPopover() === extension) {
            $('#beer-factory__extension-popover__storage-' + extension).text(
                this.numberFormatter.formatInt(extensionStorage.stored)
            );
        }

        return updateStockTable;
    };

    beerFactoryGame.FactoryExtensionMaterialDeliveryIterator = FactoryExtensionMaterialDeliveryIterator;
})(BeerFactoryGame);

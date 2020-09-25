(function(beerFactoryGame) {
    'use strict';

    FactoryProductionIterator.prototype.state   = null;
    FactoryProductionIterator.prototype.stock   = null;
    FactoryProductionIterator.prototype.render  = null;
    FactoryProductionIterator.prototype.factory = null;
    FactoryProductionIterator.prototype.cache   = null;

    FactoryProductionIterator.prototype.factoryExtensionProductionIterator       = null;
    FactoryProductionIterator.prototype.factoryExtensionMaterialDeliveryIterator = null;

    function FactoryProductionIterator(
        state,
        stock,
        render,
        factory,
        cache,
        factoryExtensionProductionIterator,
        factoryExtensionMaterialDeliveryIterator,
    ) {
        this.state   = state;
        this.stock   = stock;
        this.render  = render;
        this.factory = factory;
        this.cache   = cache;

        this.factoryExtensionProductionIterator       = factoryExtensionProductionIterator;
        this.factoryExtensionMaterialDeliveryIterator = factoryExtensionMaterialDeliveryIterator;
    }

    /**
     * Iterate over factories and add the production to the storage
     */
    FactoryProductionIterator.prototype.checkProduction = function () {
        let updateStockTable = false;

        $.each(this.state.getFactories(), (function checkFactoryProduction(factory, factoryData) {
            // check if items should be produced
            if (factoryData.amount > 0 && factoryData.production !== false) {
                updateStockTable = this.stock.addToStock(
                    factoryData.production ? this.factory.getProducedMaterial(factory) : factory,
                    this.cache.getProducedAmount(factory),
                    translator.translate('beerFactory.factory.' + factory),
                    false
                ) > 0 || updateStockTable;
            }

            // factories may have extensions even if they aren't producing factories (proxy extensions)
            $.each((factoryData.extensions || []), (function checkFactoryExtensionProduction(index, extension) {
                if (this.factoryExtensionProductionIterator
                        .checkFactoryExtensionProduction(factory, factoryData, extension)
                ) {
                    updateStockTable = true;
                }
            }).bind(this));
        }).bind(this));

        // if the delivery to the factory extensions is preferred over the build queue check the
        // delivery directly after the item production.
        if (!this.state.getState().deliveryPreferQueue) {
            updateStockTable = this
                .factoryExtensionMaterialDeliveryIterator
                .checkEnabledExtensionsMaterialDelivery()
                    || updateStockTable;
        }

        if (updateStockTable && this.render.isOverlayVisible()) {
            this.stock.updateStock();
        }
    };

    beerFactoryGame.FactoryProductionIterator = FactoryProductionIterator;
})(BeerFactoryGame);

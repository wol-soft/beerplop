(function(beerFactoryGame) {
    'use strict';

    TraderIterator.prototype.state  = null;
    TraderIterator.prototype.stock  = null;
    TraderIterator.prototype.trader = null;

    TraderIterator.prototype.routeSourceLabel = {};

    function TraderIterator(
        state,
        stock,
        trader,
    ) {
        this.state  = state;
        this.stock  = stock;
        this.trader = trader;
    }

    TraderIterator.prototype.iterate = function () {
        $.each(this.trader.getRoutes(), (function iterateTradingRoute(index, route) {
            if (!route.active || !route.sell || !route.amount) {
                return;
            }

            const sellMaterial     = this.state.getMaterial(route.sell),
                  purchaseMaterial = this.state.getMaterial(route.purchase);

            let possibleSellAmount     = Math.min(route.amount, sellMaterial.amount),
                possiblePurchaseAmount = this.trader.getTradedAmount(route.sell, route.purchase, possibleSellAmount),
                purchaseAmount         = Math.min(
                    possiblePurchaseAmount,
                    this.stock.getMaterialStockCapacity(route.purchase) - purchaseMaterial.amount
                ),
                sellAmount             = possiblePurchaseAmount > 0
                    ? Math.floor(possibleSellAmount / possiblePurchaseAmount * purchaseAmount)
                    : possibleSellAmount;

            if (sellAmount > 0) {
                this.stock.removeFromStock(
                    route.sell,
                    sellAmount,
                    this._getRouteSourceLabel(index, route),
                    false,
                );

                this.trader.registerTrade('sold', route.sell, sellAmount);
            }

            if (purchaseAmount > 0) {
                this.stock.addToStock(
                    route.purchase,
                    purchaseAmount,
                    this._getRouteSourceLabel(index, route),
                    false,
                );

                this.trader.registerTrade('purchased', route.purchase, purchaseAmount);
            }
        }).bind(this));
    };

    /**
     * Get the label for a trading route. Cache the labels to not translate the route labels on each iteration
     *
     * @param {int}    index The index of the route
     * @param {Object} route The trading route object
     *
     * @returns {string}
     *
     * @private
     */
    TraderIterator.prototype._getRouteSourceLabel = function (index, route) {
        const key = `${index}_${route.name}`;

        if (!this.routeSourceLabel[key]) {
            this.routeSourceLabel[key] = translator.translate(
                'beerFactory.tradingRoute.name',
                {
                    __ROUTE__: route.name,
                }
            );
        }

        return this.routeSourceLabel[key];
    };

    beerFactoryGame.TraderIterator = TraderIterator;
})(BeerFactoryGame);

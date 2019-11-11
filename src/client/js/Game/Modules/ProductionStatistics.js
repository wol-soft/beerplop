(function(beerplop) {
    'use strict';

    ProductionStatistics.prototype.indexedDB = null;

    ProductionStatistics.prototype.buildingProductionStats = {};

    ProductionStatistics.prototype._instance = null;

    /**
     * @constructor
     */
    function ProductionStatistics(indexedDB) {
        if (ProductionStatistics.prototype._instance) {
            return ProductionStatistics.prototype._instance;
        }

        this.indexedDB = indexedDB;

        ProductionStatistics.prototype._instance = this;
    }

    /**
     * Take a statistics snapshot
     *
     * @param {string} building
     * @param {number} productionPerSecond
     * @param {number} totalProduction
     * @param {number} amount
     *
     * @private
     */
    ProductionStatistics.prototype.statisticsSnapshot = function (
        building,
        productionPerSecond,
        totalProduction,
        amount
    ) {
        if (!this.indexedDB.getState()) {
            if (!this.buildingProductionStats[building]) {
                this.buildingProductionStats[building] = {
                    perSecond: [],
                    total: [],
                    owned: [],
                };
            }

            const timestamp = +new Date();
            this.buildingProductionStats[building].perSecond.push([timestamp, productionPerSecond]);
            this.buildingProductionStats[building].total.push([timestamp, totalProduction]);
            this.buildingProductionStats[building].owned.push([timestamp, amount]);

            return;
        }

        this.indexedDB.addToStorage(
            `buildingProduction-${building}`,
            {
                timestamp: +new Date(),
                perSecond: productionPerSecond,
                total:     totalProduction,
                owned:     amount,
            }
        );
    };

    /**
     * Fetch the statistics for a given building
     *
     * @param {string} building
     *
     * @return {Promise<any>}
     */
    ProductionStatistics.prototype.getBuildingStats = function (building) {
        return new Promise(resolve => {
            if (!this.indexedDB.getState()) {
                resolve(this.buildingProductionStats[building] || null);
            }

            let request = this.indexedDB.fetchAll(`buildingProduction-${building}`);

            request.onsuccess = (function (response) {
                let result = {
                    perSecond: [],
                    total: [],
                    owned: [],
                };

                if (!response.target.result) {
                    resolve(this.buildingProductionStats[building] || null);
                }

                $.each(response.target.result, function (index, entry) {
                    result.perSecond.push([entry.timestamp, entry.perSecond]);
                    result.total.push([entry.timestamp, entry.total]);
                    result.owned.push([entry.timestamp, entry.owned]);
                });

                resolve(result);
            }).bind(this);
        });
    };

    beerplop.ProductionStatistics = ProductionStatistics;
})(Beerplop);

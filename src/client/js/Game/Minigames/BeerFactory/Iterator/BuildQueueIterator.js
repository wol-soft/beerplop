(function(beerFactoryGame) {
    'use strict';

    BuildQueueIterator.prototype.state      = null;
    BuildQueueIterator.prototype.stock      = null;
    BuildQueueIterator.prototype.render     = null;
    BuildQueueIterator.prototype.cache      = null;
    BuildQueueIterator.prototype.buildQueue = null;

    BuildQueueIterator.prototype.numberFormatter = null;
    BuildQueueIterator.prototype.gameEventBus    = null;

    function BuildQueueIterator(
        state,
        stock,
        render,
        cache,
        buildQueue,
        numberFormatter,
        gameEventBus,
    ) {
        this.state      = state;
        this.stock      = stock;
        this.render     = render;
        this.cache      = cache;
        this.buildQueue = buildQueue;

        this.numberFormatter = numberFormatter;
        this.gameEventBus    = gameEventBus;
    }


    /**
     * Deliver materials to the jobs in the build queue and check afterwards if a job was finished
     */
    BuildQueueIterator.prototype.checkBuildQueue = function () {
        let materialsCarriedToQueue = 0,
            updateStockTable        = false,
            checkQueueItemsFinished = [];

        $.each(this.state.getBuildQueue(), (function checkBuildQueueItem(id, item) {
            if (item.paused) {
                return;
            }

            let materialsCarriedToItem = false;

            $.each(item.materials, (function checkBuildQueueItemMaterial(index, material) {
                if (material.paused || material.delivered >= material.required) {
                    return;
                }

                const baseItemId      = '#build-queue__item-' + id + '__material-' + material.key,
                      deliveredAmount = this.stock.removeFromStock(
                          material.key,
                          Math.min(
                              material.required - material.delivered,
                              this.cache.getDeliverCapacity() - materialsCarriedToQueue
                          ),
                          this.buildQueue.getQueueJobLabel(item.action, item.item),
                          false
                      );

                if (deliveredAmount <= 0) {
                    return;
                }

                material.delivered  += deliveredAmount;
                item.deliveredItems += deliveredAmount;

                materialsCarriedToQueue += deliveredAmount;
                updateStockTable         = true;
                materialsCarriedToItem   = true;

                if (this.render.isOverlayVisible()) {
                    $(baseItemId + '__delivered').text(this.numberFormatter.formatInt(material.delivered));
                }

                if (material.delivered >= material.required) {
                    checkQueueItemsFinished.push(id);

                    if (this.render.isOverlayVisible()) {
                        if (this.state.getState().hideCompletedMaterials) {
                            $(baseItemId + '__container').remove();
                        } else {
                            $(baseItemId + '__container').toggleClass(
                                'item__material-delivery__in-progress item__material-delivery__complete'
                            );
                        }
                    }

                    this.gameEventBus.emit(EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED, [id, material.key]);
                }
            }).bind(this));

            if (materialsCarriedToItem && this.render.isOverlayVisible()) {
                const progress = item.deliveredItems / item.requiredItems * 100;
                $('#build-queue__item-' + id + '__progress').css('width', progress + '%');

                $('#build-queue__item-' + id + '__progress-label').text(
                    this.numberFormatter.format(Math.min(progress, 99.9)) + '%'
                );
            }

            if (this.cache.getDeliverCapacity() === materialsCarriedToQueue) {
                return false;
            }
        }).bind(this));

        if (updateStockTable && this.render.isOverlayVisible()) {
            this.stock.updateStock();
        }

        if (checkQueueItemsFinished.length > 0) {
            this.buildQueue.checkQueueItemsFinished([...new Set(checkQueueItemsFinished)]);
        }

        if (this.render.isOverlayVisible()) {
            const now = new Date();

            $.each(this.state.getBuildQueue(), (function (id, item) {
                $('#build-queue__item-' + id + '__running')
                    .text(this.numberFormatter.formatTimeSpan(now - item.startedAt, true));
            }).bind(this));
        }
    };

    beerFactoryGame.BuildQueueIterator = BuildQueueIterator;
})(BeerFactoryGame);

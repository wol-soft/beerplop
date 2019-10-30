(function(beerplop) {
    'use strict';

    GameEventBus.prototype.eventBus = {};

    GameEventBus.prototype._instance = null;

    /**
     * Initialize the game event bus
     *
     * @constructor
     */
    function GameEventBus() {
        if (GameEventBus.prototype._instance) {
            return GameEventBus.prototype._instance;
        }

        GameEventBus.prototype._instance = this;
    }

    GameEventBus.prototype.on = function (event, callback) {
        $(this.eventBus).on(event, callback);
    };

    GameEventBus.prototype.off = function (event, callback) {
        $(this.eventBus).off(event, callback);
    };

    GameEventBus.prototype.emit = function (event, data) {
        $(this.eventBus).trigger(event, data);
    };

    beerplop.GameEventBus = GameEventBus;
})(Beerplop);
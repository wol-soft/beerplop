(function(beerplop) {
    'use strict';

    function InfinitySacrificeController(gameEventBus, gameState) {
        gameState.setCoreIterationLock();

        gameEventBus.on(EVENTS.CORE.INFINITY_SACRIFICE, () => {
            (new Beerplop.OverlayController()).openOverlay('infinity-sacrifice-overlay', 'infinity-sacrifice');
            $('.toggle-minigame').addClass('d-none');
        });

        (new Beerplop.OverlayController()).addCallback(
            'infinity-sacrifice',
            this._renderInfinitySacrificeOverlay.bind(this),
            () => {
                $('#infinity-sacrifice-overlay-container').html('');
                gameState.releaseCoreIterationLock();
            },
        );
    }

    InfinitySacrificeController.prototype._renderInfinitySacrificeOverlay = function () {
        const container = $('#infinity-sacrifice-overlay-container');
        container.html('Game Over');
    };

    beerplop.InfinitySacrificeController = InfinitySacrificeController;
})(Beerplop);

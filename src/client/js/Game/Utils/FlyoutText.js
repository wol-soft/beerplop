(function(beerplop) {
    'use strict';

    FlyoutText.prototype.gameOptions = null;

    FlyoutText.prototype._instance = null;

    FlyoutText.prototype.idCounter = 0;

    /**
     * Initialize the plop main controller
     *
     * @constructor
     */
    function FlyoutText() {
        if (FlyoutText.prototype._instance) {
            return FlyoutText.prototype._instance;
        }

        FlyoutText.prototype._instance = this;

        this.gameOptions = new Beerplop.GameOptions();
    }

    FlyoutText.prototype.spawnFlyoutText = function (
        text,
        x,
        y,
        elementClass = 'buff-text',
        flyOutClass = 'buff-text-top',
        fadeOutTime = 2000,
        removeTime = 2500
    ) {
        const id = 'flyout-text__' + (++this.idCounter);

        $('body').append(
            '<div id="' + id + '" class="' + elementClass + '" style="left:' + x + 'px;top:' + y + 'px">' +
                text +
            '</div>'
        );

        const element = $('#' + id);
        element.css('opacity');

        if (!this.gameOptions.hasDisabledFlyoutLabels()) {
            element.addClass(flyOutClass);

            window.setTimeout(
                () => element.addClass('fade-out'),
                fadeOutTime
            );
        }

        window.setTimeout(
            () => element.remove(),
            removeTime
        );
    };

    beerplop.FlyoutText = FlyoutText;
})(Beerplop);

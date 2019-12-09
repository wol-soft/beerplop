(function(beerplop) {
    'use strict';

    OverlayController.prototype._instance = null;
    OverlayController.prototype.callbacks = [];

    OverlayController.prototype._openedOverlays = 0;

    /**
     * Initialize the overlay controller
     *
     * @constructor
     */
    function OverlayController() {
        if (OverlayController.prototype._instance) {
            return OverlayController.prototype._instance;
        }

        OverlayController.prototype._instance = this;

        this.initContainer($('body'));
    }

    /**
     * Initialize all elements with the class "toggle-overlay" to open an overlay
     *
     * @param element
     */
    OverlayController.prototype.initContainer = function (element) {
        element.find('.toggle-overlay').on(
            'click',
            event => {
                const element = $(event.target).closest('.toggle-overlay');
                this.openOverlay(element.data('target'), element.data('callback'));
            },
        );
    };

    /**
     * Add callbacks for an overlay
     *
     * @param {string}   key           The key of the overlay (data-callback attribute of the toggle-overview element)
     * @param {function} openCallback  The callback to execute when opening the overlay (eg. rendering)
     * @param {function} closeCallback [optional] The callback to execute when closing the overlay
     */
    OverlayController.prototype.addCallback = function (key, openCallback, closeCallback = null) {
        this.callbacks[key] = {
            open:  openCallback,
            close: closeCallback,
        };
    };

    /**
     * Generic operations to open an overlay
     *
     * @param {string} overlay  The key of the overlay (data-overlay attribute of the toggle-overview element)
     * @param {string} callback The key for the registered callback function of the overlay
     */
    OverlayController.prototype.openOverlay = function (overlay, callback = null) {
        const element           = $('div[data-overlay="' + overlay + '"]'),
              overlayBackground = $('.overlay-bg');

        element.addClass('active-overlay');
        overlayBackground.addClass('active-overlay');

        element.css('opacity');
        overlayBackground.css('opacity');

        element.addClass('fade-overlay-in');
        overlayBackground.addClass('fade-overlay-in');

        if (callback && this.callbacks[callback].open) {
            this.callbacks[callback].open();
        }

        this._openedOverlays++;

        const closeButton       = element.find('.close-overlay').find('button'),
              overlayController = this,
              checkKeyUp        = function(event) {
                  if (event.key === 'Escape') {
                      overlayController.closeOverlay(overlay, callback);
                      $(document).off('keyup', checkKeyUp);
                  }
              };

        $(document).on('keyup', checkKeyUp);

        closeButton.off('click');
        closeButton.on('click', function () {
            overlayController.closeOverlay(overlay, callback);
            $(document).off('keyup', checkKeyUp);
        });
    };

    /**
     * Generic operations to close an overlay
     *
     * @param {string} overlay  The key of the overlay (data-overlay attribute of the toggle-overview element)
     * @param {string} callback The key for the registered callback function of the overlay
     */
    OverlayController.prototype.closeOverlay = function (overlay, callback = null) {
        const element           = $('div[data-overlay="' + overlay + '"]'),
              overlayBackground = $('.overlay-bg');

        this._openedOverlays--;

        element.removeClass('fade-overlay-in');
        if (this._openedOverlays === 0) {
            overlayBackground.removeClass('fade-overlay-in');
        }

        window.setTimeout(
            (function () {
                element.removeClass('active-overlay');
                if (this._openedOverlays === 0) {
                    overlayBackground.removeClass('active-overlay');
                }

                if (callback && this.callbacks[callback].close) {
                    this.callbacks[callback].close();
                }
            }).bind(this),
            500
        );
    };

    beerplop.OverlayController = OverlayController;
})(Beerplop);
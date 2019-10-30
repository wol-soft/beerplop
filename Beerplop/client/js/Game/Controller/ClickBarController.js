(function(beerplop) {
    'use strict';

    ClickBarController.prototype.enabled  = false;
    ClickBarController.prototype.glasses  = 0;
    ClickBarController.prototype.interval = null;

    ClickBarController.prototype.values = {
        1: 50,
        2: 50,
        3: 50,
        4: 50,
        5: 50,
        6: 50
    };

    ClickBarController.prototype.directions = {
        1: 1,
        2: -1,
        3: 1,
        4: -1,
        5: 1,
        6: -1
    };

    function ClickBarController(gameEventBus) {
        gameEventBus.on(EVENTS.CORE.SACRIFICE, (function () {
            $('#click-bar-container, .click-bar-glass').addClass('d-none');

            this.enabled = false;
            this.glasses = 0;

            for (let i = 0; i < 3; i++) {
                this.addGlass();
            }

            window.clearInterval(this.interval);
        }).bind(this));

        const glasses = $('.click-bar-glass');
        glasses.on('click', (function (event) {
            const glassId         = $(event.target).closest('.click-bar-glass').data('glassId');
            this.values[glassId] += 5;

            $('#click-bar-glass-' + glassId).css('height', 100 - this.values[glassId] + '%');
        }).bind(this));

        glasses.on('contextmenu', (function (event) {
            const glassId         = $(event.target).closest('.click-bar-glass').data('glassId');
            this.values[glassId] -= 5;

            $('#click-bar-glass-' + glassId).css('height', 100 - this.values[glassId] + '%');
            event.preventDefault();
        }).bind(this));

        for (let i = 0; i < 3; i++) {
            this.addGlass();
        }
    }

    ClickBarController.prototype.enable = function () {
        this.enabled = true;
        $('#click-bar-container').removeClass('d-none');

        this.interval = window.setInterval((function () {
            for (let i = 1; i <= this.glasses; i++) {
                this.values[i] += Math.random() * this.directions[i];

                if (this.values[i] >= 100) {
                    this.values[i]     = 100;
                    this.directions[i] = (-1 - Math.random()) / 10;
                }

                if (this.values[i] <= 0) {
                    this.values[i]     = 0;
                    this.directions[i] = (1 + Math.random()) / 10;
                }

                $('#click-bar-glass-' + i).css('height', 100 - this.values[i] + '%');
            }
        }).bind(this), 1);

        ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP).addModifier(
            'ClickBar',
            () => Math.pow(0.55 + this.getAverageFillHeight() / 100, this.getGlasses() / 3),
            false,
        );
    };

    ClickBarController.prototype.getAverageFillHeight = function () {
        let totalFillHeight = 0;

        for (let i = 1; i <= this.glasses; i++) {
            totalFillHeight += this.values[i];
        }

        return totalFillHeight / this.glasses;
    };

    ClickBarController.prototype.addGlass = function () {
        this.glasses++;
        $('#click-bar-glass-' + this.glasses).closest('.click-bar-glass').removeClass('d-none');
    };

    ClickBarController.prototype.getGlasses = function () {
        return this.glasses;
    };

    ClickBarController.prototype.isEnabled = function () {
        return this.enabled;
    };

    beerplop.ClickBarController = ClickBarController;
})(Beerplop);

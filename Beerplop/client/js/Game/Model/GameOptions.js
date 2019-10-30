(function(beerplop) {
    'use strict';

    GameOptions.prototype._instance = null;

    GameOptions.prototype.gameEventBus = null;

    GameOptions.prototype.state = {
        disableFlyoutLabels:    false,
        sliderOverfading:       false,
        scientificNotation:     false,
        iftttNotifications:     false,
        ifttt_beerFactory:      true,
        ifttt_system:           false,
        ifttt_beerwarts:        true,
        ifttt_stockMarket:      true,
        ifttt_research:         true,
        ifttt_beerBank:         true,
        ifttt_buildingMinigame: true,
    };

    GameOptions.pollIFTTTAuthorization = null;

    /**
     * Initialize the overlay controller
     *
     * @constructor
     */
    function GameOptions() {
        if (GameOptions.prototype._instance) {
            return GameOptions.prototype._instance;
        }

        GameOptions.prototype._instance = this;

        this.gameEventBus = new Beerplop.GameEventBus();

        (new Beerplop.GamePersistor()).registerModule(
            'GameOptions',
            (function getGameOptionsData() {
                return this.state;
            }.bind(this)),
            (function setGameOptionsData(loadedData) {
                this.state = $.extend(true, {}, this.state, loadedData);

                if (typeof(Storage) !== 'undefined') {
                    let item = localStorage.getItem('scientificNotation');

                    if (item !== null && item !== this.state.scientificNotation.toString()) {
                        localStorage.setItem('scientificNotation', this.state.scientificNotation);
                        this.gameEventBus.on(EVENTS.SAVE.LOAD.FINISHED, () => location.reload());
                    }
                }
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.CORE.INITIALIZED.GAME, this._setCheckboxState.bind(this));

        (new Beerplop.Notification()).updateAuthorized((authorized) => {
            if (authorized) {
                $('.ifttt-toggle').toggleClass('d-none');
            }
        });

        this._initGameOptionsEventListener();
    }

    GameOptions.prototype._initGameOptionsEventListener = function () {
        $('#open-game-options-modal').on('click', (function () {
            $('#ifttt-container').toggleClass('d-none', !this.state.iftttNotifications);
            $('#game-options-modal').modal('show');
        }).bind(this));

        $('#ifttt-connect').on('click', function () {
            if ($('.login-form').length > 0) {
                $('#login-modal').modal('show');
                return;
            }

            window.open('https://ifttt.com/applets/BSHJAWiz-beerplop-telegram', '_blank');
            this.pollIFTTTAuthorization = window.setInterval(
                () => (new Beerplop.Notification()).updateAuthorized((authorized) => {
                    if (authorized) {
                        $('.ifttt-toggle').toggleClass('d-none');
                        window.clearInterval(this.pollIFTTTAuthorization);
                    }
                }),
                1000 * 5
            );

            $('#game-options-modal').on('hidden.bs.modal.ifttt', () => {
                window.clearInterval(this.pollIFTTTAuthorization);
                $('#game-options-modal').off('hidden.bs.modal.ifttt');
            })
        });

        $('#game-options-modal').find('.game-option-checkbox').on('change', (function (event) {
            const option = $(event.target).prop('name');

            this.state[option] = $(event.target).is(':checked');

            this.gameEventBus.emit(EVENTS.CORE.OPTION_CHANGED, option);
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.OPTION_CHANGED, (event, option) => {
            if (option === 'scientificNotation' && typeof(Storage) !== 'undefined') {
                localStorage.setItem('scientificNotation', this.state.scientificNotation);
                (new Beerplop.GamePersistor()).setLocalSaveState();
                location.reload();
            }

            if (option === 'iftttNotifications') {
                if ((new Beerplop.Notification()).isAuthorized() !== null)
                $('#ifttt-container').toggleClass('d-none');
            }

            if (option.startsWith('ifttt_')) {
                (new Beerplop.Notification()).notify({
                    content: translator.translate(
                        this.state[option] ? 'option.ifttt.enabled' : 'option.ifttt.disabled',
                        {__CHANNEL__: translator.translate(`options.${option}`)}
                    ),
                    style:   'snackbar-info',
                    timeout: 3000,
                    channel: 'notifications',
                })
            }
        });
    };

    GameOptions.prototype._setCheckboxState = function () {
        $.each(
            this.state,
            (option, checked) => $('#game-options-modal')
                .find(`.game-option-checkbox[name="${option}"]`)
                .prop('checked', checked)
        );
    };

    GameOptions.prototype.hasDisabledFlyoutLabels = function () {
        return this.state.disableFlyoutLabels;
    };

    GameOptions.prototype.allowSliderOverfading = function () {
        return this.state.sliderOverfading;
    };

    GameOptions.prototype.isIFTTTChannelActive = function (channel) {
        if (channel === 'notifications') {
            return true;
        }

        return this.state.iftttNotifications && this.state[`ifttt_${channel}`];
    };

    beerplop.GameOptions = GameOptions;
})(Beerplop);

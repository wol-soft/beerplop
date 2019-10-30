(function(minigames) {
    'use strict';

    BeerBank.prototype._instance = null;

    BeerBank.prototype.gameState       = null;
    BeerBank.prototype.gameOptions     = null;
    BeerBank.prototype.gameEventBus    = null;
    BeerBank.prototype.numberFormatter = null;
    BeerBank.prototype.beerBlender     = null;

    BeerBank.prototype.isBeerBankEnabled = false;

    BeerBank.prototype.beerBankInvestmentMultiplier = 0;
    BeerBank.prototype.permanentInvestmentBoost = 1;

    BeerBank.prototype.state = {
        invested: 0,
        percentage: 0,
    };

    /**
     * Initialize the beer bank mini game
     *
     * @constructor
     */
    function BeerBank(gameState, gameEventBus, beerBlender) {
        if (BeerBank.prototype._instance) {
            return BeerBank.prototype._instance;
        }

        BeerBank.prototype._instance = this;

        this.gameState       = gameState;
        this.gameEventBus    = gameEventBus;
        this.beerBlender     = beerBlender;
        this.gameOptions     = new Beerplop.GameOptions();
        this.numberFormatter = new Beerplop.NumberFormatter();

        const initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'BeerBank',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(true, {}, initialState, loadedData);

                this._updateBeerBankInvestment();
            }.bind(this))
        );
    }

    BeerBank.prototype.unlockBeerBank = function () {
        if (this.isBeerBankEnabled) {
            return;
        }

        this.isBeerBankEnabled = true;

        const achievementController = new Beerplop.AchievementController();
        achievementController.checkAchievement(
            achievementController.getAchievementStorage().achievements.beerBank.unlocked
        );

        $('#beer-bank-control').removeClass('d-none');

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function () {
            if (this.state.percentage == 0) {
                return;
            }

            this.addPlops(
                this.gameState.getAutoPlopsPerSecond()
                    * (this.beerBankInvestmentMultiplier > 0 ? this.beerBankInvestmentMultiplier : 1)
                    * this.permanentInvestmentBoost
                    * this.state.percentage / 100
                    * this.beerBlender.getEffect('beerBank')
            );
        }).bind(this));

        const slider = $('#beer-bank-investment').bootstrapSlider();
        slider.on('change', (function (event) {
            const researchProject     = new Minigames.ResearchProject(),
                  availablePercentage = 100 - researchProject.getResearchPercentage();

            let newValue = $(event.target).val();

            if (newValue > availablePercentage) {
                if (this.gameOptions.allowSliderOverfading()) {
                    researchProject.lowerInvestmentPercentage(newValue - availablePercentage);
                } else {
                    newValue = availablePercentage;
                }
            }

            slider.bootstrapSlider('setValue', newValue);
            this.state.percentage = newValue;

            $('.beer-bank-investment-percentage').text(newValue);
        }).bind(this));

        slider.bootstrapSlider('setValue', this.state.percentage);
        $('.beer-bank-investment-percentage').text(this.state.percentage);
    };

    BeerBank.prototype.lowerInvestmentPercentage = function (percentage) {
        const removedPercentage = Math.min(this.state.percentage, percentage);

        this.state.percentage -= removedPercentage;

        $('#beer-bank-investment').bootstrapSlider('setValue', this.state.percentage);
        $('.beer-bank-investment-percentage').text(this.state.percentage);

        return removedPercentage;
    };

    BeerBank.prototype.addBeerBankInvestmentMultiplier = function (multiplier) {
        this.beerBankInvestmentMultiplier += multiplier;
    };

    BeerBank.prototype.removeBeerBankInvestmentMultiplier = function (multiplier) {
        this.beerBankInvestmentMultiplier -= multiplier;
    };

    BeerBank.prototype.getInvestmentPercentage = function () {
        return this.state.percentage;
    };

    BeerBank.prototype.getInvestedPlops = function () {
        return this.state.invested;
    };

    BeerBank.prototype.isEnabled = function () {
        return this.isBeerBankEnabled;
    };

    BeerBank.prototype.getAutoPlopBoost = function () {
        return Math.sqrt(
            Math.sqrt(
                Math.sqrt(
                    this.state.invested /
                    Math.max(1e13, Math.sqrt(Math.pow(this.state.invested, 1 - 1 / this.state.invested)))
                )
            )
        ) / 100;
    };

    BeerBank.prototype.addPermanentBeerBankInvestmentBoost = function (boost) {
        this.permanentInvestmentBoost = this.permanentInvestmentBoost * (1 + boost);
    };

    BeerBank.prototype.removePlops = function (plops) {
        if (this.state.invested < plops) {
            return false;
        }

        this.state.invested -= plops;
        this._updateBeerBankInvestment();
        return true;
    };

    BeerBank.prototype.addPlops = function (plops) {
        this.state.invested += plops;

        if (!isFinite(this.state.invested)) {
            this.state.invested = Number.MAX_VALUE;
        }

        this._updateBeerBankInvestment();
    };

    BeerBank.prototype._updateBeerBankInvestment = function () {
        $('.beer-bank-account').html(this.numberFormatter.format(this.state.invested));
        $('.beer-bank-boost').html(this.numberFormatter.formatFraction(this.getAutoPlopBoost() * 100, 3));

        // TODO: remove external forced update
        this.gameState.updatePlopsPerSecond();
    };

    minigames.BeerBank = BeerBank;
})(Minigames);

(function(beerplop) {
    'use strict';

    LevelController.prototype._instance = null;

    LevelController.prototype.gameState       = null;
    LevelController.prototype.gameEventBus    = null;
    LevelController.prototype.numberFormatter = null;

    LevelController.prototype.currentLevel = 0;

    LevelController.prototype.state = {
        sacrifiedLevel: 0,
        levelBonus: 0,
        levelBonusLastPeriod: 0,
        levelLastPeriod: 0,
        beermats: 0,
        sacrificed: 0,
        lastSacrifice: new Date(),
        autoPlopsLastPeriod: null,
    };

    function LevelController(gameState, gameEventBus) {
        if (LevelController.prototype._instance) {
            return LevelController.prototype._instance;
        }

        LevelController.prototype._instance = this;

        this.gameState       = gameState;
        this.gameEventBus    = gameEventBus;
        this.numberFormatter = new Beerplop.NumberFormatter();

        (new Beerplop.GamePersistor()).registerModule(
            'LevelController',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(true, this.state, loadedData);
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function () {
            const levelValue      = (new Decimal(gameState.getAllTimePlops()))
                    .div(1000000)
                    .pow(0.4)
                    .sub(this.state.sacrifiedLevel),
                  level           = levelValue.floor(),
                  reached         = levelValue.sub(level).mul(100).toNumber(),
                  levelProgress   = $('#level-progress-bar');

            let levelNumber = Math.max(0, level.toNumber());

            levelProgress.find('.progress-bar').css('width', reached + '%');

            if (!isFinite(levelNumber)) {
                levelNumber = Number.MAX_VALUE;
            }

            if (levelNumber < 1000 && gameState.getAllTimePlops() === Number.MAX_VALUE) {
                levelNumber = 1000;
            }

            if (this.currentLevel !== levelNumber) {
                $('#sacrifice__level-value').text(this.numberFormatter.formatInt(levelNumber));
                gameEventBus.emit(EVENTS.CORE.LEVEL_UP, levelNumber);

                this.currentLevel = levelNumber;
            }
        }).bind(this));

        this._initPopover();
        this._initSacrifice();
    }

    LevelController.prototype.sacrifice = function () {
        this.state.sacrificed++;
        this.state.lastSacrifice = new Date();

        if (this.currentLevel === 1337) {
            const achievementController = new Beerplop.AchievementController();
            achievementController.checkAchievement(
                achievementController.getAchievementStorage().achievements.special[1337]
            );
        }

        this.state.levelBonusLastPeriod = this.getLevelBonus();
        this.state.levelLastPeriod      = this.currentLevel;

        this.state.beermats            = Math.min(this.state.beermats + this.currentLevel, Number.MAX_VALUE);
        this.state.sacrifiedLevel      = Math.min(this.state.sacrifiedLevel + this.currentLevel, Number.MAX_VALUE);
        this.state.levelBonus          = Math.min(this.state.levelBonus + this.currentLevel / 1e3, Number.MAX_VALUE);
        this.state.autoPlopsLastPeriod = this.gameState.getAutoPlopsPerSecondWithoutBuffMultiplier();

        this.gameEventBus.emit(EVENTS.CORE.SACRIFICE, this.state.sacrificed);

        this.currentLevel = 0;
        $('#sacrifice__level-value').text(0);

        window.setTimeout(
            () => (new beerplop.GamePersistor()).setLocalSaveState(),
            10
        );
    };

    LevelController.prototype._initSacrifice = function () {
        $('#level-progress-bar').on('click', (function () {
            if (this.currentLevel < 1000) {
                return;
            }

            const modal = $('#sacrifice-hint-modal');
            modal.find('.modal-body').text(translator.translate('sacrifice.warning'));
            $('#sacrifice').data('role', 'main');
            modal.modal('show');
        }).bind(this));

        assetPromises['modals'].then(() => {
            const sacrificeButton = $('#sacrifice');

            sacrificeButton.on('click', (function () {
                $('#sacrifice-hint-modal').modal('hide');

                if (sacrificeButton.data('role') !== 'main' || this.currentLevel < 1000) {
                    return;
                }

                sacrificeButton.data('role', '');
                this.sacrifice();
            }).bind(this));
        });
    };

    LevelController.prototype._initPopover = function () {
        $('#level-progress-bar').popover({
            content: (function() {
                return Mustache.render(
                    TemplateStorage.get('level-status-template'),
                    {
                        level:            this.numberFormatter.formatInt(this.currentLevel),
                        beermats:         this.numberFormatter.formatInt(this.state.beermats),
                        minimumLevel:     this.numberFormatter.formatInt(1000),
                        sacrificeEnabled: this.currentLevel >= 1000,
                        levelBonus:       this.numberFormatter.format(
                            (this.state.levelBonus > 0 ? this.getLevelBonus() : 0) * 100
                        )
                    }
                );
            }).bind(this)
        });
    };

    LevelController.prototype.getLevelBonus = function () {
        return Math.sqrt(Math.pow(this.state.levelBonus + 1, 1.85));
    };

    LevelController.prototype.getLevelBonusLastPeriod = function () {
        return this.state.levelBonusLastPeriod;
    };

    LevelController.prototype.getLevelLastPeriod = function () {
        return this.state.levelLastPeriod;
    };

    LevelController.prototype.getAvailableBeerMats = function () {
        return this.state.beermats;
    };

    LevelController.prototype.getAgeStartTime = function () {
        return new Date(this.state.lastSacrifice);
    };

    LevelController.prototype.getSacrified = function () {
        return this.state.sacrificed;
    };

    LevelController.prototype.getAutoPlopsLastPeriod = function () {
        return this.state.autoPlopsLastPeriod;
    };

    LevelController.prototype.removeBeermats = function (beermats) {
        this.state.beermats -= beermats;
        $('#sacrifice-beermats').html((new Beerplop.NumberFormatter()).formatInt(this.state.beermats));
    };

    beerplop.LevelController = LevelController;
})(Beerplop);

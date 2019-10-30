(function(beerplop) {
    'use strict';

    AchievementController.prototype._instance = null;

    AchievementController.prototype.achievementStorage   = null;

    AchievementController.prototype.gameEventBus    = null;
    AchievementController.prototype.gameState       = null;
    AchievementController.prototype.beerBank        = null;
    AchievementController.prototype.numberFormatter = null;

    AchievementController.prototype.achievementSemaphore = false;

    AchievementController.prototype.state = {
        missedBuffs: 0,
    };

    /**
     * Initialize the achievement controller
     *
     * @constructor
     */
    function AchievementController(gameState, gameEventBus, beerBank) {
        if (AchievementController.prototype._instance) {
            return AchievementController.prototype._instance;
        }

        this.achievementStorage = new Beerplop.AchievementStorage();
        this.beerBank           = beerBank;
        this.gameEventBus       = gameEventBus;
        this.gameState          = gameState;
        this.numberFormatter    = new Beerplop.NumberFormatter();

        const initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'AchievementController',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(true, {}, initialState, loadedData);
            }.bind(this))
        );

        this._initAchievementSemaphore();

        window.requestIdleCallback
            ? window.requestIdleCallback(() => this._setUpAchievementImages())
            : this._setUpAchievementImages();

        // catch all events which can lead to an achievement
        this.gameEventBus.on(EVENTS.CORE.CLICK, (function checkManualClickAchievements(event, clicks, manualPlops) {
            this.checkAmountAchievement(
                this.achievementStorage.achievements.manual.clicks,
                clicks
            );

            this.checkAmountAchievement(
                this.achievementStorage.achievements.manual.production,
                manualPlops
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function checkCoreIterationAchievements() {
            this.checkAmountAchievement(
                this.achievementStorage.achievements.totalPlopProduction,
                this.gameState.getTotalPlops()
            );

            if (this.beerBank.isEnabled()) {
                this.checkAmountAchievement(
                    this.achievementStorage.achievements.beerBank.invested,
                    this.beerBank.getInvestedPlops()
                );
            }

            this.checkAmountAchievement(
                this.achievementStorage.achievements.bottleCap.production,
                this.gameState.getBuildingLevelController().getTotalBottleCaps()
            );

            $.each(
                this.achievementStorage.achievements.buildingProduction,
                (function checkBuildingProductionAchievements(building, achievements) {
                    this.checkAmountAchievement(
                        achievements,
                        this.gameState.getTotalBuildingProduction(building)
                    );
                }).bind(this)
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, (function (event, purchase) {
            this.checkAmountAchievement(
                this.achievementStorage.achievements.buildingAmount[purchase.building],
                this.gameState.getBuildingData(purchase.building).amount
            );

            this.checkAmountAchievement(
                this.achievementStorage.achievements.buildingSum,
                this.gameState.getOwnedBuildingsAmount()
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BOTTLE_CAP.PURCHASED, (function (event, factories) {
            this.checkAmountAchievement(
                this.achievementStorage.achievements.bottleCap.factories,
                factories.amount
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUFF.CLICKED, (function (event, data) {
            this.state.missedBuffs = 0;
            this.checkAmountAchievement(
                this.achievementStorage.achievements.buff.clicked,
                data.buffBottlesClicked
            );

            if (data.autoClick) {
                this.checkAchievement(
                    this.achievementStorage.achievements.special.frankBottleCollector
                );
            }
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUFF.MISSED, (function () {
            if (++this.state.missedBuffs >= 10) {
                this.checkAchievement(
                    this.achievementStorage.achievements.special.missedBuffs
                );
            }
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.PLOPS.AUTO_PLOPS_UPDATED, (function () {
            // check the auto plop achievements without current buffs
            this.checkAmountAchievement(
                this.achievementStorage.achievements.plopsPerSecond,
                this.gameState.getAutoPlopsPerSecondWithoutBuffMultiplier()
            );

            if (!this.achievementStorage.achievements.special.schnapps.reached &&
                /^(.)\1{5}$/.test($('#auto-plops').text().replace(/\D/g,''))
            ) {
                this.checkAchievement(
                    this.achievementStorage.achievements.special.schnapps
                );
            }
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BOTTLE_CAP.PRODUCTION_UPDATED, (function (event, bottleCapProduction) {
            // check the auto plop achievements without current buffs
            this.checkAmountAchievement(
                this.achievementStorage.achievements.bottleCap.perSecond,
                bottleCapProduction
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.LEVEL_UP, (function (event, level) {
            // check the level achievements
            this.checkAmountAchievement(
                this.achievementStorage.achievements.level,
                level
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function (event, sacrificed) {
            // check the sacrificed achievements
            this.checkAmountAchievement(
                this.achievementStorage.achievements.special.sacrificed,
                sacrificed
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.RESEARCH.STARTED, (function (event, project) {
            // check the achievement for a started project
            this.checkAchievement(this.achievementStorage.achievements.researchProjects.started[project]);
        }).bind(this));

        this.gameEventBus.on(EVENTS.RESEARCH.FINISHED, (function (event, project, stage) {
            // check the achievement for a completed project
            this.checkAchievement(this.achievementStorage.achievements.researchProjects.completed[project]);

            if (stage > 0) {
                for (let i = 1; i <= stage; i++) {
                    if (this.achievementStorage.achievements.researchProjects.stage[i]) {
                        this.checkAchievement(this.achievementStorage.achievements.researchProjects.stage[i]);
                    }
                }
            }
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUILDING.LEVEL_UP, (function (event, building, level) {
            if (building === 'bottleCapFactory') {
                this.checkAmountAchievement(
                    this.achievementStorage.achievements.bottleCap.level,
                    level
                );

                return;
            }

            this.checkAmountAchievement(
                this.achievementStorage.achievements.buildingLevel,
                level
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.ACHIEVEMENT_REACHED, (function (event, achievement) {
            this._showReachedAchievement(achievement.title, achievement.description);

            if (this.achievementStorage.getReachedAchievements() >= 500) {
                this.checkAchievement(this.achievementStorage.achievements.special.collector);
            }
            if (this.achievementStorage.getReachedAchievements() >= 1000) {
                this.checkAchievement(this.achievementStorage.achievements.special.magnet);
            }
        }).bind(this));

        $('.close-achievements').on('click', (function () {
            this._closeAchievements();
        }).bind(this));

        this._initAchievementRendering();

        AchievementController.prototype._instance = this;
    }

    /**
     * Check an amount achievement
     *
     * @param {Object}  achievementList The list of available achievements
     * @param {number}  currentAmount   The current amount to compare with
     * @param {boolean} negativeAmounts Negative amount check
     */
    AchievementController.prototype.checkAmountAchievement = function (
        achievementList,
        currentAmount,
        negativeAmounts = false
    ) {
        if (this.achievementSemaphore) {
            return;
        }

        $.each(
            achievementList,
            (function (requiredAmount, achievement) {
                if ((currentAmount >= requiredAmount || (negativeAmounts && currentAmount <= -requiredAmount))
                    && !achievement.reached
                ) {
                    achievementList[requiredAmount].reached = true;
                    this.achievementStorage.reachedAchievements++;

                    this.gameEventBus.emit(
                        EVENTS.CORE.ACHIEVEMENT_REACHED,
                        {
                            title:       translator.translate(`achievements.${achievementList[requiredAmount].key}.title`),
                            description: translator.translate(`achievements.${achievementList[requiredAmount].key}.description`),
                            key:         achievementList[requiredAmount].key
                        }
                    );
                }
            }).bind(this)
        );
    };

    /**
     * unlock all achievements
     *
     * @param {Object} data
     *
     * @private
     */
    AchievementController.prototype.unlockAllAchievements = function(data = null) {
        if (data === null) {
            data = this.achievementStorage.achievements;
        }

        $.each(data, (function (key, value) {
            if (typeof value.reached === 'undefined') {
                this.unlockAllAchievements(value);
                return;
            }

            this.checkAchievement(value);
        }).bind(this));
    };

    /**
     * Check a single achievement
     *
     * @param {Object} achievement
     */
    AchievementController.prototype.checkAchievement = function (achievement) {
        if (this.achievementSemaphore || achievement.reached) {
            return;
        }

        achievement.reached = true;
        this.achievementStorage.reachedAchievements++;

        this.gameEventBus.emit(
            EVENTS.CORE.ACHIEVEMENT_REACHED,
            {
                title:       translator.translate(`achievements.${achievement.key}.title`),
                description: translator.translate(`achievements.${achievement.key}.description`),
                key:         achievement.key
            }
        );
    };

    AchievementController.prototype.getAchievementStorage = function () {
        return this.achievementStorage;
    };

    /**
     * Close the achievement container
     */
    AchievementController.prototype._closeAchievements = function() {
        const container = $('#achievements-container');

        container.hide();
        container.find('.achievements-list').html('');
    };

    /**
     * Show a message for a reached achievement
     *
     * @param {string} title
     * @param {string} message
     *
     * @private
     */
    AchievementController.prototype._showReachedAchievement = function(title, message) {
        const container = $('#achievements-container');

        container.find('.achievements-list').append(`<div class="achievement"><b>${title}</b><br />${message}</div>`);
        container.show()
    };

    /**
     * Add the callback to render the achievement screen
     *
     * @private
     */
    AchievementController.prototype._initAchievementRendering = function () {
        (new Beerplop.OverlayController()).addCallback(
            'achievements',
            (function () {
                const container          = $('#achievement-overview-container'),
                      achievementStorage = this.achievementStorage;

                let achievementGroups = {};

                const getAchievements = function (data, topLevelKey) {
                    $.each(data, function (key, value) {
                        if (topLevelKey === null && !achievementGroups[key]) {
                            achievementGroups[key] = {
                                name:         translator.translate('achievements.group.' + key),
                                achievements: [],
                                reached:      0,
                            };
                        }

                        if (typeof value.reached === 'undefined') {
                            return getAchievements(value, topLevelKey || key);
                        }

                        achievementGroups[topLevelKey].achievements.push(value);
                        value.reached ? achievementGroups[topLevelKey].reached++ : null;
                    });
                };

                getAchievements(achievementStorage.achievements, null);

                container.html(
                    Mustache.render(
                        TemplateStorage.get('achievement-overview-template'),
                        {
                            achievementGroups: Object
                                .values(achievementGroups)
                                .map(group => $.extend({total: group.achievements.length}, group)),
                            reached:           this.numberFormatter.formatInt(achievementStorage.getReachedAchievements()),
                            total:             this.numberFormatter.formatInt(achievementStorage.getTotalAchievements()),
                            replaceDots:       function () {
                                return function (text, render) {
                                    const renderedText = render(text);
                                    return renderedText.replace(/\./g, '-');
                                }
                            }
                        }
                    )
                );

                container.find('.achievement-item').tooltip({
                    title: function () {
                        const key         = $(this).data('key'),
                              achievement = achievementStorage.getAchievementByKey(key),
                              title       = achievement.reached ? translator.translate(`achievements.${key}.title`) : '???',
                              description = achievement.reached ? translator.translate(`achievements.${key}.description`) : '???';

                        return `<b>${title}</b><br />${description}`;
                    }
                });
            }).bind(this),
            () => {
                const container = $('#achievement-overview-container');

                container.find('.achievement-item').tooltip('dispose');
                container.html('');
            },
        );
    };

    /**
     * Set the achievement semaphore during a loading process
     *
     * @private
     */
    AchievementController.prototype._initAchievementSemaphore = function () {
        this.gameEventBus.on(EVENTS.SAVE.LOAD.STARTED, () => this.achievementSemaphore = true);
        this.gameEventBus.on(EVENTS.SAVE.LOAD.FINISHED, () => this.achievementSemaphore = false);
    };

    AchievementController.prototype._setUpAchievementImages = function () {
        const achievementAmounts = Object.keys(this.achievementStorage.achievements.buildingAmount.opener);

        $.each(this.gameState.getBuildings(), function (index, building) {
            const baseElement = $('#svg-buildingAmount-' + building + '-base');

            $.each(achievementAmounts, function (index, amount) {
                let opener = baseElement.clone();
                opener.addClass('amount-' + amount);
                opener.attr('id', 'svg-buildingAmount-' + building + '-' + amount);
                opener.insertAfter(baseElement);
            });
        });
    };

    beerplop.AchievementController = AchievementController;
})(Beerplop);

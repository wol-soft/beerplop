(function(beerplop) {
    'use strict';

    /**
     * Provide updates for the save state. Either apply an update on the save state before the save state gets loaded
     * or modify the state afterwards. Updates will be executed once if a save with a lower version number is loaded.
     *
     * @constructor
     */
    function Updates() {
    }

    Updates.prototype.getPreSaveStateApplyUpdates = function () {
        return {
            '1.25.0': function (saveState) {
                let achievements = saveState['AchievementStorage'].achievements;

                achievements.special             = achievements.specialAchievements || {};
                achievements.stockMarket         = achievements.stockMarketAchievements || {};
                achievements.totalPlopProduction = achievements.totalCookieProductionAchievements || {};
                achievements.abstinence          = achievements.abstinenceAchievements || {};
                achievements.beerwarts           = achievements.beerwartsAchievements || {};
                achievements.level               = achievements.levelAchievements || {};
                achievements.plopsPerSecond      = achievements.plopsPerSecondAchievements || {};
                achievements.bottleCap           = achievements.bottleCapAchievements || {};
                achievements.buildingAmount      = achievements.buildingAmountAchievements || {};
                achievements.buildingSum         = achievements.buildingSumAchievements || {};
                achievements.buildingLevel       = achievements.buildingLevelAchievements || {};
                achievements.buildingProduction  = achievements.buildingProductionAchievements || {};

                achievements.manual = {
                    clicks:     achievements.manualClicksAchievements,
                    production: achievements.manualCookieProductionAchievements,
                };

                if (achievements.beerBlender) {
                    achievements.special.beerBlender = {
                        unlocked: achievements.special.beerBlender,
                        equipped: achievements.beerBlender.equipped,
                    };
                }

                achievements.buff = {
                    clicked: achievements.buffsClicked || {},
                    upgrade: achievements.beerAchievements || {},
                };

                achievements.beerBank = {
                    invested: achievements.beerBank || {},
                    banker:   achievements.beerBanker || {},
                };

                achievements.buyAmount = {
                    upgrades:  achievements.buyUpgradesAchievements || {},
                    buildings: achievements.buildingBuyAchievements || {},
                };

                if (achievements.beerBank && achievements.beerBank.banker && achievements.beerBank.banker.special) {
                    achievements.beerBank.banker.special.unlock = achievements.special.beerBanker;
                    achievements.beerBank.unlocked              = achievements.special.beerBank;
                }

                if (achievements.sacrificeAchievements) {
                    achievements.special.sacrificed = achievements.sacrificeAchievements.sacrificed || {};
                }

                if (achievements.researchProjects) {
                    achievements.researchProjects.restart = achievements.special.researchRestart;
                }

                achievements.bottleCap.level = achievements.bottleCapFactoryLevelAchievements || {};

                if (achievements.stockMarket) {
                    achievements.stockMarket.unlocked = achievements.special.stockMarket;
                }

                if (achievements.beerFactory) {
                    achievements.beerFactory.unlocked.beerFactory = achievements.special.beerFactory;
                }

                if (achievements.beerwarts) {
                    achievements.beerwarts.unlocked       = achievements.special.beerwarts;
                    achievements.beerwarts.magicianSchool = achievements.special.magicianSchool;
                }

                const cleanUpNonExistingKeys = function (data, structure) {
                          $.each(data, function (key, value) {
                              if (!structure[key]) {
                                  delete data[key];
                                  return;
                              }

                              if (typeof value !== 'boolean') {
                                  cleanUpNonExistingKeys(value, structure[key]);
                              }
                          });
                      };

                cleanUpNonExistingKeys(
                    achievements,
                    (new Beerplop.AchievementController()).getAchievementStorage().achievements
                );

                saveState['AchievementStorage'] = achievements;

                return saveState;
            },
            '1.26.0': function (saveState) {
                let beerwarts = saveState['Beerwarts'];

                if (beerwarts) {
                    $.each(beerwarts.magicians, (function (magicianId, magician) {
                        if (magician.inTraining > 0) {
                            let trainingFinished = new Date();
                            trainingFinished.setSeconds(trainingFinished.getSeconds() + magician.inTraining);

                            magician.trainingFinished = trainingFinished;
                            magician.inTraining = true;
                        } else {
                            magician.trainingFinished = null;
                            magician.inTraining = false;
                        }
                    }).bind(this));

                    saveState['Beerwarts'] = beerwarts;
                }

                let beerBankBanker = saveState['BeerBankBanker'];

                if (beerBankBanker) {
                    $.each(beerBankBanker.banker, (function (bankerId, banker) {
                        if (banker.inTraining > 0) {
                            let trainingFinished = new Date();
                            trainingFinished.setSeconds(trainingFinished.getSeconds() + banker.inTraining);

                            banker.trainingFinished = trainingFinished;
                            banker.inTraining = true;
                        } else {
                            banker.trainingFinished = null;
                            banker.inTraining = false;
                        }
                    }).bind(this));

                    saveState['BeerBankBanker'] = beerBankBanker;
                }

                return saveState;
            },
            '1.27.0': (function (saveState) {
                return this._drinkerUpgradeShift(saveState, 40, 50);
            }).bind(this),
            '1.30.0': saveState => {
                if (saveState.BeerFactory) {
                    // values are calculated on the fly, so no need to store them any longer
                    try {
                        delete saveState.BeerFactory.factories.lodge.transportMultiplier;
                        delete saveState.BeerFactory.deliverCapacity;
                        delete saveState.BeerFactory.stock.capacity;
                    } catch (e) {
                        console.log(e);
                    }
                }

                return saveState;
            },
            '1.50.0': saveState => {
                // values are calculated on the fly, so no need to store them any longer
                try {
                    delete saveState.BeerFactory.stock;
                } catch (e) {
                    console.log(e);
                }

                return saveState;
            },
            '1.66.0': saveState => {
                try {
                    $.each(saveState.BeerFactory.buildQueue, function (index, item) {
                        delete item.label;
                    });
                } catch (e) {
                    console.log(e);
                }

                return saveState;
            }
        };
    };

    Updates.prototype.getPostSaveStateApplyUpdates = function () {
        return {
            '1.2.0': function () {
                let beerBankBankerState = (new Minigames.BeerBankBanker()).state;

                $.each(beerBankBankerState.banker, function (index) {
                    beerBankBankerState.banker[index].investmentLimit *= 10;
                });
            },
            '1.5.0': function () {
                let levelControllerState = (new Beerplop.LevelController()).state;

                if (levelControllerState.levelBonus > 0 && levelControllerState.sacrifiedLevel === 0) {
                    levelControllerState.sacrifiedLevel = levelControllerState.levelBonus * 1e3;
                }
            },
            '1.14.0': function () {
                let researchProjectState = (new Minigames.ResearchProject()).state;

                if (researchProjectState.projects.stargazer.stage > 12) {
                    (new Beerplop.GameEventBus()).emit(
                        EVENTS.RESEARCH.FINISHED,
                        ['stargazer', 13]
                    );
                }

                let beerFactoryState = (new Minigames.BeerFactory()).state;

                $.each(beerFactoryState.buildQueue, function (id, item) {
                    item.startedAt = new Date();
                });
            },
            '1.19.0': function () {
                const beerwarts      = new Minigames.Beerwarts(),
                      beerBankBanker = new Minigames.BeerBankBanker();

                $.each(beerwarts.state.magicians, function (index, magician) {
                    magician.birth = new Date();
                });
                $.each(beerBankBanker.state.banker, function (index, banker) {
                    banker.birth = new Date();
                });
            },
            '1.22.1': function () {
                let beerFactoryState = (new Minigames.BeerFactory()).state;

                $.each(beerFactoryState.buildQueue, function (id, item) {
                    $.each(item.materials, function (material, data) {
                        data.required = Math.ceil(data.required);
                    });
                });
            },
            '1.43.0': function () {
                const blender = new Minigames.BeerBlender();
                blender.state.slots = Object.values(blender.state.slots);
                blender._renderBeerBlender();

            },
            '1.45.0': function () {
                if ((new Minigames.BeerFactory()).uniqueBuild.state.builds.giza.buildFinished) {
                    const achievementController = new Beerplop.AchievementController();

                    (new Beerplop.GameEventBus()).on(EVENTS.SAVE.LOAD.FINISHED, () => window.setTimeout(
                        () => achievementController.checkAchievement(
                            achievementController.getAchievementStorage().achievements.beerFactory.uniqueBuild.completed.giza
                        ),
                        0
                    ));
                }
            },
            '1.46.0': function () {
                $.each((new Minigames.BeerFactory()).state.getBuildQueue(), function (index, job) {
                    $.each(job.materials, function (key, material) {
                        if (material.delivered < 0) {
                            material.delivered = material.required - 100;
                        }
                    });
                });
            },
            '1.48.0': function () {
                (new Beerplop.GameEventBus()).on(EVENTS.SAVE.LOAD.FINISHED, () => window.setTimeout(
                    () => (new Minigames.Beerwarts())._checkSacrificeOnEachBuildingAchievements(),
                    0
                ));
            },
            '1.55.0': function () {
                (new Beerplop.GameEventBus()).on(EVENTS.SAVE.LOAD.FINISHED, () => window.setTimeout(
                    () => {
                        const achievementController = new Beerplop.AchievementController(),
                              automatedBar          = new BuildingMinigames.AutomatedBar();

                        achievementController.checkAmountAchievement(
                            achievementController.getAchievementStorage().achievements.buildingMG.automatedBar.gameLevel,
                            automatedBar.state.level
                        );
                    },
                    0
                ));
            },
        };
    };

    Updates.prototype._drinkerUpgradeShift = function (saveState, from, to) {
        const mapUpgrades = upgradeList => {
            $.each(upgradeList, function (index, upgrade) {
                const upgradeKey  = upgrade.split('.');

                if (upgradeKey[0] === 'achievementUpgrades') {
                    upgradeList[index] = 'achievementUpgrades.' + Math.round(upgradeKey[1] / from * to);
                }
            });

            return upgradeList;
        };

        saveState['UpgradeStorage']['reached']   = mapUpgrades(saveState['UpgradeStorage']['reached']);
        saveState['UpgradeStorage']['available'] = mapUpgrades(saveState['UpgradeStorage']['available']);

        return saveState;
    };

    beerplop.Updates = Updates;
})(Beerplop);

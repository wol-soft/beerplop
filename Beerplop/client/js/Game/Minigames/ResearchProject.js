(function(minigames) {
    'use strict';

    const TRAINING_CENTER_EFFECT = 0.25;

    ResearchProject.prototype._instance = null;

    ResearchProject.prototype.gameState         = null;
    ResearchProject.prototype.gameEventBus      = null;
    ResearchProject.prototype.numberFormatter   = null;
    ResearchProject.prototype.upgradeController = null;
    ResearchProject.prototype.beerBankBanker    = null;
    ResearchProject.prototype.beerwarts         = null;
    ResearchProject.prototype.gameOptions       = null;

    ResearchProject.prototype.researchProjectInvestmentMultiplier = 0;
    ResearchProject.prototype.autoRestartEnabled                  = false;

    ResearchProject.prototype.sliderList = {};

    ResearchProject.prototype.projects = {
        beerOceans: {
            costs: 25e18,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: true,
            maxStage: Infinity,
            costMultiplier: 300,
        },
        beerCore: {
            costs: 15e19,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: true,
            maxStage: 3,
            costMultiplier: 500,
        },
        beerLaser: {
            costs: 1e22,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: true,
            maxStage: 4,
            costMultiplier: 1000,
        },
        beerPark: {
            costs: 15e19,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: false,
        },
        beerdedNation: {
            costs: 1e22,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: false,
        },
        refillingCaps: {
            costs: 1e22,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: true,
            maxStage: Infinity,
            costMultiplier: 400,
        },
        stargazer: {
            costs: 1e27,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: true,
            maxStage: 13,
            costMultiplier: 10,
        },
        training: {
            costs: 1e33,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: true,
            maxStage: Infinity,
            costMultiplier: 1e4,
        },
        clonedike: {
            costs: 5e36,
            completedCallback: null,
            additionalInfoText: null,
            repeatable: true,
            maxStage: Infinity,
            costMultiplier: 1337,
        },
    };

    ResearchProject.prototype.state = {
        projects: {
            beerOceans: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                stage: 0,
                startedAt: null,
            },
            beerCore: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                stage: 0,
                startedAt: null,
            },
            beerLaser: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                stage: 0,
                startedAt: null,
            },
            beerPark: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                startedAt: null,
            },
            beerdedNation: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                startedAt: null,
            },
            refillingCaps: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                stage: 0,
                startedAt: null,
            },
            stargazer: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                stage: 0,
                startedAt: null,
            },
            training: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                stage: 0,
                startedAt: null,
            },
            clonedike: {
                running: false,
                percentage: 20,
                invested: 0,
                completed: false,
                stage: 0,
                startedAt: null,
            },
        },
        totalPercentage: 0,
        hideCompleted: false,
        autoRestart: false,
    };

    ResearchProject.prototype.cache = {
        projectCosts: {}
    };

    /**
     * Initialize the research project mini game
     *
     * @constructor
     */
    function ResearchProject(gameState, gameEventBus, upgradeController, beerBankBanker, beerwarts) {
        if (ResearchProject.prototype._instance) {
            return ResearchProject.prototype._instance;
        }

        ResearchProject.prototype._instance = this;

        this.gameState         = gameState;
        this.gameEventBus      = gameEventBus;
        this.upgradeController = upgradeController;
        this.beerBankBanker    = beerBankBanker;
        this.beerwarts         = beerwarts;
        this.gameOptions       = new Beerplop.GameOptions();
        this.numberFormatter   = new Beerplop.NumberFormatter();

        this._initCompletedCallbacks();
        this._initAdditionalInfoTextCallbacks();

        const initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'ResearchProject',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(true, {}, initialState, loadedData);

                $.each(this.state.projects, (function (project, projectData) {
                    if (projectData.startedAt !== null) {
                        this.state.projects[project].startedAt = new Date(projectData.startedAt);
                    }
                }).bind(this));

                window.setTimeout(
                    (function () {
                        let hasResearchProjects    = false;
                        this.state.totalPercentage = 0;

                        $.each(this.state.projects, (function (project, projectData) {
                            if (projectData.completed || projectData.running) {
                                hasResearchProjects = true;
                            }

                            if (projectData.completed || (projectData.stage && projectData.stage > 0)) {
                                this._executeProjectCallback(project, projectData);
                                if (!projectData.running) {
                                    this.state.projects[project].percentage = 0;
                                }
                            }

                            if (projectData.running) {
                                this.state.projects[project].percentage = parseInt(this.state.projects[project].percentage);
                                this.state.totalPercentage += this.state.projects[project].percentage;
                            }
                        }).bind(this));

                        if (hasResearchProjects) {
                            $('#research-project-control').removeClass('d-none');
                            this._updateResearchProjectView();
                        }
                    }).bind(this),
                    0
                );
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function () {
            this._iterate();
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function () {
            window.setTimeout(
                (function () {
                    $.each(this.state.projects, (function (project, projectData) {
                        this._executeProjectCallback(project, projectData);
                    }).bind(this));
                }).bind(this),
                0
            );
        }).bind(this));
    }

    /**
     * Execute a project callback. If a higher stage was reached execute the callback multiple times
     *
     * @param {string} project
     * @param {Object} projectData
     *
     * @private
     */
    ResearchProject.prototype._executeProjectCallback = function (project, projectData) {
        // if a research project was completed execute the callback as often as the reached stage
        // (one execution for non repeatable research projects)
        if (projectData.completed || (projectData.stage && projectData.stage > 0)) {
            for (let stage = 1; stage <= (this.projects[project].repeatable ? projectData.stage : 1); stage++) {
                this.projects[project].completedCallback(stage);
            }
        }
    };

    /**
     * Start a research project
     *
     * @param {string}  project         The key of the project to start
     * @param {boolean} restartResearch [optional] is it an explicit restart
     * @param {boolean} update          [optional] update the research project view after starting the project
     *
     * @return {boolean} Whether the project got started or not
     */
    ResearchProject.prototype.startResearch = function (project, restartResearch = false, update = true) {
        $('#research-project-control').removeClass('d-none');

        // skip a start of the research project if
        // - the research project is running already
        // - the research project is completed and it's not an explicit restart initiated by the user
        // - the research project is completed and is not repeatable
        // - the research project has reached it's maximum stage
        // - the costs for the next stage aren't finite
        if (this.state.projects[project].running
            || (this.state.projects[project].completed && !restartResearch)
            || (this.state.projects[project].completed && !this.projects[project].repeatable)
            || (this.projects[project].repeatable && this.state.projects[project].stage === this.projects[project].maxStage)
            || !isFinite(this._getProjectCosts(project))
        ) {
            return false;
        }

        this.state.projects[project].invested  = 0;
        this.state.projects[project].completed = false;
        this.state.projects[project].running   = true;
        this.state.projects[project].startedAt = new Date();

        const beerBankInvestment = (new Minigames.BeerBank()).getInvestmentPercentage();

        if (this.state.totalPercentage + this.state.projects[project].percentage + beerBankInvestment > 100) {
            this.state.projects[project].percentage = 100 - this.state.totalPercentage - beerBankInvestment;
        }

        this.state.totalPercentage += this.state.projects[project].percentage;

        if (update) {
            this._updateResearchProjectView();
        }

        this.gameEventBus.emit(EVENTS.RESEARCH.STARTED, project);

        return true;
    };

    ResearchProject.prototype.getResearchPercentage = function () {
        return this.state.totalPercentage;
    };

    ResearchProject.prototype.lowerInvestmentPercentage = function (percentage, exclude = null) {
        const updateProjectView = (projectKey, projectPercentage) => {
            this._updateRemainingTime(projectKey, this._getResearchInvestmentPerSecond(projectKey));
            $('#research-project-' + projectKey + '-percentage').text(projectPercentage);
            this.sliderList[projectKey].bootstrapSlider('setValue', projectPercentage);
        };

        $.each(this.state.projects, (function (projectKey, project) {
            if (project.percentage === 0 || projectKey === exclude) {
                return;
            }

            if (project.percentage >= percentage) {
                project.percentage         -= percentage;
                this.state.totalPercentage -= percentage;

                updateProjectView(projectKey, project.percentage);

                return false;
            }

            percentage                 -= project.percentage;
            this.state.totalPercentage -= project.percentage;
            project.percentage          = 0;

            updateProjectView(projectKey, 0);
        }).bind(this));

        this._updateHead();
    };

    ResearchProject.prototype.getStage = function (project) {
        return this.state.projects[project].stage;
    };

    /**
     * Calculate the amount of plops which are invested into a project in one second
     *
     * @param {String} project
     *
     * @return {Number}
     *
     * @private
     */
    ResearchProject.prototype._getResearchInvestmentPerSecond = function (project) {
        return this.gameState.getAutoPlopsPerSecond()
            * (this.researchProjectInvestmentMultiplier > 0 ? this.researchProjectInvestmentMultiplier : 1)
            * (this.state.projects[project].percentage / 100);
    };

    /**
     * Calculate the research project investments during a core iteration
     *
     * @private
     */
    ResearchProject.prototype._iterate = function () {
        let hasActiveProjects = false;

        $.each(this.state.projects, (function (project, projectData) {
            if (!projectData.running) {
                return;
            }

            hasActiveProjects = true;

            const projectInvestmentPerSecond = this._getResearchInvestmentPerSecond(project),
                  duration                   = this.numberFormatter.formatTimeSpan(
                      (new Date()) - this.state.projects[project].startedAt,
                      true
                  );

            this.state.projects[project].invested += projectInvestmentPerSecond;

            // update the research project view
            // TODO: only if opened
            $('#research-project-' + project + '-invested').text(
                this.numberFormatter.format(this.state.projects[project].invested)
            );
            $('#research-project-' + project + '-completed').text(
                this.numberFormatter.format(
                    this.state.projects[project].invested / this._getProjectCosts(project) * 100
                )
            );
            $('#research-project-' + project + '-started-at').text(duration);

            this._updateRemainingTime(project, projectInvestmentPerSecond);

            if (this.state.projects[project].invested >= this._getProjectCosts(project)) {
                this.state.totalPercentage -= this.state.projects[project].percentage;

                this.state.projects[project].running   = false;
                this.state.projects[project].completed = true;
                this.state.projects[project].startedAt = null;

                if (this.projects[project].repeatable) {
                    this.state.projects[project].stage++;
                }

                this.cache.projectCosts[project] = null;

                this.projects[project].completedCallback();
                this.gameEventBus.emit(
                    EVENTS.RESEARCH.FINISHED,
                    [project, this.projects[project].repeatable ? this.state.projects[project].stage : 0]
                );

                (new Beerplop.Notification()).notify({
                    content: translator.translate(
                        'research.finished',
                        {
                            __PROJECT__:  translator.translate(`holyUpgrade.${project}.title`),
                            __DURATION__: duration,
                        }
                    ),
                    style:   'snackbar-success',
                    timeout: 5000,
                    channel: 'research',
                });

                if (this.autoRestartEnabled
                    && this.state.autoRestart
                    && this.projects[project].repeatable
                    && this.startResearch(project, true, false)
                ) {
                    this._autoRestarted(project)
                } else {
                    this.state.projects[project].percentage = 0;
                }

                this._updateResearchProjectView();
            }
        }).bind(this));
    };

    ResearchProject.prototype._autoRestarted = function (project) {
        (new Beerplop.Notification()).notify({
            content: translator.translate(
                'research.started',
                {
                    __PROJECT__:    translator.translate(`holyUpgrade.${project}.title`),
                    __PERCENTAGE__: this.numberFormatter.formatInt(this.state.projects[project].percentage),
                    __DURATION__:   this._getRemainingTime(
                        project,
                        this._getResearchInvestmentPerSecond(project)
                    ),
                }
            ),
            style:   'snackbar-success',
            timeout: 5000,
            channel: 'research',
        });

        const achievementController = new Beerplop.AchievementController();
        achievementController.checkAchievement(
            achievementController.getAchievementStorage().achievements.researchProjects.autoRestart
        );
    };

    /**
     * Initialize the callback function which are executed after a research project was completed
     *
     * @private
     */
    ResearchProject.prototype._initCompletedCallbacks = function () {
        const enableResearchProjectTriggeredUpgrades = (function (project, stage) {
            const upgradeStorage = this.upgradeController.getUpgradeStorage();

            if (this.projects[project].repeatable) {
                project += stage !== -1 ? stage : this.state.projects[project].stage;
            }

            $.each(upgradeStorage.upgrades[project], (function (index, upgradeData) {
                const key = project + '.' + index;

                if (upgradeData.reached || $.inArray(key, upgradeStorage.availableUpgrades) !== -1) {
                    return;
                }

                upgradeStorage.addAvailableUpgrade(key);
            }).bind(this));
        }).bind(this);

        this.projects.beerOceans.completedCallback = (function () {
            this.gameState.addUpgradeAutoPlopMultiplier(0.5, 'beerOceans');
        }).bind(this);

        this.projects.refillingCaps.completedCallback = (function () {
            this.gameState.getBuildingLevelController().addBottleCapProductionMultiplier(1);
        }).bind(this);

        this.projects.beerCore.completedCallback = (function () {
            this.gameState.addBuildingReductionFromResearchProject(0.1);
        }).bind(this);

        $.each(
            ['beerLaser', 'beerPark', 'beerdedNation'],
            (function(index, project) {
                this.projects[project].completedCallback = function (stage = -1) {
                    enableResearchProjectTriggeredUpgrades(project, stage);
                };
            }).bind(this)
        );

        this.projects.stargazer.completedCallback = (function () {
            this.gameState.recalculateAutoPlopsPerSecond();
        }).bind(this);

        this.projects.clonedike.completedCallback = (function () {
            this.gameState.recalculateAutoPlopsPerSecond();
        }).bind(this);

        this.projects.training.completedCallback = (function () {
            this.beerwarts.addTrainingShortener(TRAINING_CENTER_EFFECT);
            this.beerBankBanker.addTrainingShortener(TRAINING_CENTER_EFFECT);
        }).bind(this);
    };

    ResearchProject.prototype._initAdditionalInfoTextCallbacks = function () {
        this.projects.beerOceans.additionalInfoText = (function () {
            if (this.state.projects.beerOceans.stage === 0) {
                return '';
            }

            return translator.translate(
                'research.beerOceans.effectTooltip',
                {
                    __STAGE__: this.state.projects.beerOceans.stage,
                    __EFFECT__: this.numberFormatter.formatInt(this.state.projects.beerOceans.stage * 50),
                }
            );
        }).bind(this);

        this.projects.beerCore.additionalInfoText = (function () {
            if (this.state.projects.beerCore.stage === 0) {
                return '';
            }

            return translator.translate(
                'research.beerCore.effectTooltip',
                {
                    __STAGE__: this.state.projects.beerCore.stage,
                    __EFFECT__: this.numberFormatter.formatInt(this.state.projects.beerCore.stage * 10),
                }
            );
        }).bind(this);

        this.projects.beerLaser.additionalInfoText = (function () {
            if (this.state.projects.beerLaser.stage === 0) {
                return '';
            }

            return translator.translate('research.beerLaser.effectTooltip.' + this.state.projects.beerLaser.stage);
        }).bind(this);

        this.projects.refillingCaps.additionalInfoText = (function () {
            if (this.state.projects.refillingCaps.stage === 0) {
                return '';
            }

            return translator.translate(
                'research.refillingCaps.effectTooltip',
                {
                    __STAGE__: this.state.projects.refillingCaps.stage,
                    __EFFECT__: this.numberFormatter.formatInt(this.state.projects.refillingCaps.stage * 100),
                }
            );
        }).bind(this);

        this.projects.stargazer.additionalInfoText = (function () {
            let boostedBuildings = [];

            $.each(this.gameState.state.buildings, (function (building, buildingData) {
                if (buildingData.tier + this.state.projects.stargazer.stage > this.gameState.getBuildings().length) {
                    boostedBuildings.push(building);
                }
            }).bind(this));

            return Mustache.render(
                TemplateStorage.get('stargazer-additional-info-template'),
                {
                    stage:     this.state.projects.stargazer.stage,
                    buildings: boostedBuildings,
                }
            );
        }).bind(this);

        this.projects.training.additionalInfoText = (function () {
            if (this.state.projects.training.stage === 0) {
                return '';
            }

            const effect = (1 - Math.pow(1 - TRAINING_CENTER_EFFECT, this.state.projects.training.stage)) * 100;

            return translator.translate(
                'research.training.effectTooltip',
                {
                    __STAGE__:  this.state.projects.training.stage,
                    __EFFECT__: this.numberFormatter.formatFraction(effect, effect > 95 ? 3 : 0),
                }
            );
        }).bind(this);

        this.projects.clonedike.additionalInfoText = (function () {
            if (this.state.projects.clonedike.stage === 0) {
                return '';
            }

            return translator.translate(
                'research.clonedike.effectTooltip',
                {
                    __STAGE__:  this.state.projects.clonedike.stage,
                    __EFFECT__: this.numberFormatter.formatInt(
                        (Math.pow(1.1, this.state.projects.clonedike.stage) - 1) * 100
                    ),
                }
            );
        }).bind(this);
    };

    /**
     * Update the view for the research project area and initialize the event listener
     *
     * @private
     */
    ResearchProject.prototype._updateResearchProjectView = function () {
        let projects = [];

        $.each(this.state.projects, (function (project, projectData) {
            if (projectData.running || projectData.completed) {
                const projectCosts = this._getProjectCosts(project);

                projects.push($.extend(
                    {
                        key:         project,
                        title:       translator.translate(`holyUpgrade.${project}.title`),
                        description: translator.translate(`holyUpgrade.${project}.description`),
                        effect:      translator.translate(`research.${project}.effect`),
                    },
                    projectData,
                    this.projects[project],
                    {
                        costs:               this.numberFormatter.format(projectCosts),
                        invested:            this.numberFormatter.format(projectData.invested),
                        percentage:          projectData.percentage,
                        startedAt:           this.numberFormatter.formatTimeSpan(
                                                (new Date()) - projectData.startedAt,
                                                true
                                             ),
                        possibleNextStage:   projectData.completed
                                                && this.projects[project].repeatable
                                                && (projectData.stage < this.projects[project].maxStage)
                                                && isFinite(projectCosts),
                        completedPercentage: this.numberFormatter.format(
                                                projectData.invested / this.projects[project].costs * 100
                                             ),
                        additionalText:      this.projects[project].additionalInfoText
                                                ? this.projects[project].additionalInfoText()
                                                : '',
                        hidden:              projectData.completed && this.state.hideCompleted,
                    }
                ));
            }
        }).bind(this));

        const container = $('#research-project');
        container.find('.research-project-popover').popover('dispose');
        container.html(
            Mustache.render(
                TemplateStorage.get('research-project-template'),
                {
                    showHideControl: projects.length > 1,
                    hideCompleted:   this.state.hideCompleted,
                    showAutoRestart: this.autoRestartEnabled,
                    autoRestart:     this.state.autoRestart,
                    stages:          Array
                        .from({length: this.gameState.getBuildings().length}, (v, k) => k + 1)
                        .map(v => { return {stage: v}}),
                    projects: projects.sort(
                        (function (project1, project2) {
                            if ((project1.running && project2.running) || (!project1.running && !project2.running)) {
                                return this._getProjectCosts(project1.key) < this._getProjectCosts(project2.key)
                                    ? -1
                                    : 1;
                            }

                            if (project1.running) {
                                return -1;
                            }

                            return 1;
                        }).bind(this)
                    )
                }
            )
        );

        this.sliderList = {};
        $.each(container.find('.research-slider'), (function (index, slider) {
            slider = $(slider);

            const project = slider.closest('.research-project-container').data('projectKey');

            this.sliderList[project] = slider.bootstrapSlider();

            slider.on('change', (function (event) {
                const project             = $(event.target).closest('.research-project-container').data('projectKey'),
                      beerBank            = new Minigames.BeerBank(),
                      availablePercentage = 100
                          - beerBank.getInvestmentPercentage()
                          - this.state.totalPercentage
                          + parseInt(this.state.projects[project].percentage);

                let newValue = parseInt($(event.target).val());

                if (newValue > availablePercentage) {
                    if (this.gameOptions.allowSliderOverfading()) {
                        // first try to lower the beer bank investment
                        const percentageToRemove        = newValue - availablePercentage,
                              beerBankRemovedPercentage = beerBank.lowerInvestmentPercentage(percentageToRemove);

                        // if not enough investment-lowering was available lower the research project investment
                        if (beerBankRemovedPercentage < percentageToRemove) {
                            this.lowerInvestmentPercentage(percentageToRemove - beerBankRemovedPercentage, project);
                        }
                    } else {
                        this.sliderList[project].bootstrapSlider('setValue', availablePercentage);
                        newValue = availablePercentage;
                    }
                }

                this.state.totalPercentage += newValue - this.state.projects[project].percentage;
                this.state.projects[project].percentage = newValue;

                $('#research-project-' + project + '-percentage').text(newValue);

                this._updateRemainingTime(project, this._getResearchInvestmentPerSecond(project));
                this._updateHead();
            }).bind(this));

            this.sliderList[project].bootstrapSlider('setValue', this.state.projects[project].percentage);
            $('#research-project-' + project + '-percentage').text(this.state.projects[project].percentage);
        }).bind(this));

        container.find('.restart-research-project').on('click', (function (event) {
            this.startResearch($(event.target).closest('.research-project-container').data('projectKey'), true);

            const achievementController = new Beerplop.AchievementController();
            achievementController.checkAchievement(
                achievementController.getAchievementStorage().achievements.researchProjects.restart
            );
        }).bind(this));

        container.find('.research-project-popover').popover();

        $('#research-project__hide-completed').on('change', (function (event) {
            this.state.hideCompleted = $(event.target).is(':checked');
            container.find('.research-project-completed').closest('.research-project-container').toggleClass('d-none');
        }).bind(this));

        $('#research-project__auto-restart').on(
            'change',
            () => {
                this.state.autoRestart = $(event.target).is(':checked');

                if (this.state.autoRestart) {
                    $.each(this.state.projects, (function (projectKey, project) {
                        if (project.completed
                            && this.projects[projectKey].repeatable
                            && this.startResearch(projectKey, true)
                        ) {
                            this._autoRestarted(projectKey);
                        }
                    }).bind(this));
                }
            }
        );

        this._updateHead();
    };

    /**
     * Update the head area to show the amount of active projects and the current total investment rate
     * @private
     */
    ResearchProject.prototype._updateHead = function () {
        $('#research-project__active').text(
            Object.values(this.state.projects).reduce(
                (active, project) => active + (project.running && project.percentage > 0),
                0
            )
        );
        $('#research-project__investment-percentage').text(this.state.totalPercentage);
    };

    /**
     * TODO: store if research project view is opened, only update if open to save some performance
     *
     * Update the remaining time of a research project
     *
     * @param {string} project
     * @param {Number} investment
     *
     * @private
     */
    ResearchProject.prototype._updateRemainingTime = function (project, investment) {
        $('#research-project-' + project + '-remaining').text(this._getRemainingTime(project, investment));
    };

    /**
     * Get a string representing the remaining time of the given research project
     *
     * @param {string} project
     * @param {Number} investment
     *
     * @return {string}
     *
     * @private
     */
    ResearchProject.prototype._getRemainingTime = function (project, investment) {
        if (investment > 0) {
            const timespan = (this._getProjectCosts(project) - this.state.projects[project].invested) / investment;

            if (timespan < 60 * 60 * 24 * 9999) {
                return this.numberFormatter.formatTimeSpan(timespan * 1000, true);
            }
        }

        return '∞';
    };

    /**
     * Calculate the costs for a research project using the reached stage of the project and the base costs
     *
     * @param {string} project
     *
     * @returns {number}
     * @private
     */
    ResearchProject.prototype._getProjectCosts = function (project) {
        if (this.cache.projectCosts[project]) {
            return this.cache.projectCosts[project];
        }

        this.cache.projectCosts[project] = this.projects[project].costs
            * (this.projects[project].repeatable
                ? Math.pow(this.projects[project].costMultiplier, this.state.projects[project].stage)
                    * Math.pow(
                        Math.pow(1.5, Math.sqrt(this.state.projects[project].stage)),
                        this.state.projects[project].stage
                    )
                : 1
            );

        return this.cache.projectCosts[project];
    };

    /**
     * Get the amount of plops which was invested in total into research projects
     *
     * @returns {number}
     */
    ResearchProject.prototype.getTotalInvestedPlops = function () {
        let investment = 0;

        $.each(this.state.projects, (function (project, projectData) {
            if (this.projects[project].repeatable && projectData.stage > 0) {
                for (let stage = 0; stage < projectData.stage; stage++) {
                    investment += this.projects[project].costs * Math.pow(this.projects[project].costMultiplier, stage);
                }
            }

            if (!this.projects[project].repeatable && projectData.completed) {
                investment += this.projects[project].costs;
            }

            if (!projectData.completed) {
                investment += projectData.invested;
            }
        }).bind(this));

        return investment;
    };

    /**
     * Get the amount of completed research projects
     *
     * @returns {number}
     */
    ResearchProject.prototype.getCompletedResearchProjectAmount = function () {
        let completed = 0;

        $.each(this.state.projects, (function (project, projectData) {
            if (this.projects[project].repeatable) {
                completed += projectData.stage;
                return;
            }

            if (projectData.completed) {
                completed++;
            }
        }).bind(this));

        return completed;
    };

    ResearchProject.prototype.addResearchProjectInvestmentMultiplier = function (multiplier) {
        this.researchProjectInvestmentMultiplier += multiplier;
    };

    ResearchProject.prototype.removeResearchProjectInvestmentMultiplier = function (multiplier) {
        this.researchProjectInvestmentMultiplier -= multiplier;
    };

    ResearchProject.prototype.enableAutoRestart = function () {
        this.autoRestartEnabled = true;
        this._updateResearchProjectView();
    };

    minigames.ResearchProject = ResearchProject;
})(Minigames);

(function(minigames) {
    'use strict';

    const MAGICIAN_BASE_PRICE = 1e24;

    Beerwarts.prototype._instance = null;

    Beerwarts.prototype.gameState             = null;
    Beerwarts.prototype.gameEventBus          = null;
    Beerwarts.prototype.numberFormatter       = null;
    Beerwarts.prototype.achievementController = null;

    Beerwarts.prototype.isMagicianOverlayVisible        = false;
    Beerwarts.prototype.autoTrainingUnlocked            = false;
    Beerwarts.prototype.groupTrainingShortenerEnabled   = false;
    Beerwarts.prototype.cribReductionMultiplier         = 1;
    Beerwarts.prototype.manaProductionMultiplier        = 0;
    Beerwarts.prototype.manaProductionUpgradeMultiplier = 1;

    Beerwarts.prototype.updateEnchantmentButtonsForBuilding = null;

    Beerwarts.prototype.levelMapping = {
        2: 2,
        3: 5,
        4: 10
    };

    Beerwarts.prototype.trainingShortener = 1;
    Beerwarts.prototype.enabled           = false;
    Beerwarts.prototype.sacrificeEnabled  = false;

    Beerwarts.prototype.skills = {
        spells: {
            baseCost: 1e24,
            baseTrainingTime: 120,
            trainingTimeMultiplier: 2,
            multiplier: 10,
            requiredLevel: 2,
            manaMultiplier: 2,
        },
        equipment: {
            baseCost: 5e25,
            baseTrainingTime: 360,
            trainingTimeMultiplier: 3.5,
            multiplier: 50,
            requiredLevel: 3,
            manaMultiplier: 5,
        },
        darkness: {
            baseCost: 1e27,
            baseTrainingTime: 1200,
            trainingTimeMultiplier: 4.25,
            multiplier: 100,
            requiredLevel: 4,
            manaMultiplier: 20,
        }
    };

    Beerwarts.prototype.state = {
        magicians: [],
        buildingEnchantments: {},
        mana: 0,
        manaTotal: 0,
        level: 1,
        school: {
            enabled: true,
            maxLevel: {
                spells: 0,
                equipment: 0,
                darkness: 0,
            },
        },
    };

    Beerwarts.prototype.enchantmentsAvailable = {};
    // A multiplier which defines a reduction multiplier for the time an automatically started training takes
    Beerwarts.prototype.autoTrainingReductionMultiplier = 1;

    Beerwarts.prototype.cache = {
        buildingMultiplier: {},
    };

    Beerwarts.prototype.magicianTrainingStartedName      = null;
    Beerwarts.prototype.magicianTrainingStartedSkill     = null;
    Beerwarts.prototype.magicianTrainingStartedAmount    = 0;
    Beerwarts.prototype.magicianTrainingStartedShortened = 0;

    Beerwarts.prototype.hasAutoLevelAchievement = false;

    /**
     * Initialize the Beerwarts mini game
     *
     * @constructor
     */
    function Beerwarts(gameState, gameEventBus) {
        if (Beerwarts.prototype._instance) {
            return Beerwarts.prototype._instance;
        }

        Beerwarts.prototype._instance = this;

        this.gameState       = gameState;
        this.gameEventBus    = gameEventBus;
        this.numberFormatter = new Beerplop.NumberFormatter();

        const initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'Beerwarts',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(true, {}, initialState, loadedData);

                $.each(this.state.magicians, (function (magicianId, magician) {
                    if (magician.trainingFinished) {
                        magician.trainingFinished = new Date(magician.trainingFinished);
                    }
                    if (magician.cooldown) {
                        magician.cooldown = new Date(magician.cooldown);
                    }
                }).bind(this));
            }.bind(this))
        );

        assetPromises['modals'].then(this._initBeerwartsSacrifice.bind(this));

        // make sure the base production is set to 0 by default. On unlock the base production callback is changed to
        // start the production. Otherwise mana might be produced via external modifiers even before Beerwarts unlock
        ComposedValueRegistry.getComposedValue(CV_MANA).addModifier('Beerwarts_BaseProduction', () => 0);
    }

    Beerwarts.prototype._initBeerwartsSacrifice = function () {
        const sacrificeButton = $('#sacrifice');

        sacrificeButton.on('click.beerwarts', (function () {
            if (sacrificeButton.data('role') !== 'beerwarts') {
                return;
            }

            const building    = sacrificeButton.data('building'),
                  enchantment = this.state.buildingEnchantments[building];

            sacrificeButton.data('role', '');
            sacrificeButton.data('building', '');

            this.cache.buildingMultiplier = {};

            enchantment.buildingBoost = 0;
            enchantment.totalBoost = 0;
            enchantment.buildingReduction = 0;
            enchantment.level = 0;

            enchantment.sacrifice ? enchantment.sacrifice++ : enchantment.sacrifice = 1;

            if (building === 'bottleCapFactory') {
                this.gameState.getBuildingLevelController().updateCostNext(true);
                ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).triggerModifierChange('Beerwarts');
            } else {
                this.gameState.updateCosts(building);
                this.gameState.recalculateAutoPlopsPerSecond();
            }

            this._updateUIAfterEnchantment(building);

            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerwarts.sacrifice,
                enchantment.sacrifice
            );

            this._checkSacrificeOnEachBuildingAchievements();
        }).bind(this));
    };

    Beerwarts.prototype.unlockBeerwarts = function () {
        if (this.enabled) {
            return;
        }
        this.enabled = true;

        this.achievementController.checkAchievement(
            this.achievementController.getAchievementStorage().achievements.beerwarts.unlocked
        );

        $.each(this._getEnchantableBuildings(), (function (index, building) {
            this.enchantmentsAvailable[building] = {
                available:           false,
                costNextEnchantment: this._getCheapestNextEnchantment(building),
            }
        }).bind(this));

        $('#beerwarts-control, .beerwarts__enchant-building-container').removeClass('d-none');

        (new Beerplop.OverlayController()).addCallback(
            'beerwarts',
            this._renderMagicianOverview.bind(this),
            () => {
                this.isMagicianOverlayVisible = false;

                const container = $('#beerwarts-overlay');
                container.find('.beerwarts__skill-level-up').tooltip('dispose');
                container.html('');
            },
        );

        this.gameEventBus.on(EVENTS.CORE.ITERATION, this._iterate.bind(this));

        this.gameEventBus.on(EVENTS.CORE.ITERATION_LONG, (function () {
            this._checkAutoTrainingForAllMagicians();
        }).bind(this));

        // check if there are enough plops available to hire another magician
        this.gameEventBus.on(EVENTS.CORE.PLOPS.UPDATED, (function (event, amount) {
            $('#beerwarts__hire-magician')
                .closest('fieldset')
                .prop('disabled', amount < this._getCostsForNextMagician());
        }).bind(this));

        $('#beerwarts__hire-magician').on('click', this._hireMagician.bind(this));
        this._initBuildingEnchantment();
        this._updateBeerwartsView();

        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function handleSacrificeForBeerwarts() {
            this.manaProductionUpgradeMultiplier = 1;
            this.autoTrainingReductionMultiplier = 1;
            this.cribReductionMultiplier         = 1;

            ComposedValueRegistry
                .getComposedValue(CV_MANA)
                .triggerModifierChange('Beerwarts_manaProductionUpgradeMultiplier');
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, () => this.cache.buildingMultiplier = {});
        this.gameEventBus.on(EVENTS.CORE.BOTTLE_CAP.PURCHASED, () => {
            this.cache.buildingMultiplier = {};
            ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).triggerModifierChange('Beerwarts');
        });

        ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).addModifier(
            'Beerwarts',
            () => this.getBuildingMultiplier('bottleCapFactory').totalMultiplier
        );

        ComposedValueRegistry.getComposedValue(CV_MANA)
            .onValueChange(this._updateBeerwartsView.bind(this))
            .addModifier('Beerwarts_BaseProduction',                  this._getBaseManaProduction.bind(this))
            .addModifier('Beerwarts_GameSpeed',                       () => this.gameState.getGameSpeed())
            .addModifier('Beerwarts_manaProductionMultiplier',        () => (this.manaProductionMultiplier || 1))
            .addModifier('Beerwarts_manaProductionUpgradeMultiplier', () => this.manaProductionUpgradeMultiplier)
    };

    Beerwarts.prototype.unlockAutoTraining = function () {
        this.autoTrainingUnlocked = true;

        this.achievementController.checkAchievement(
            this.achievementController.getAchievementStorage().achievements.beerwarts.magicianSchool
        );

        $('#beerwarts__magician-school-container').removeClass('d-none');
        this._updateMagicianSchoolView();
    };

    Beerwarts.prototype.enableGroupTrainingShortener = function () {
        this.groupTrainingShortenerEnabled = true;
    };

    Beerwarts.prototype.addCribReduction = function (amount) {
        this.cribReductionMultiplier -= amount;
    };

    /**
     * Add the given mana amount to the currently owned mana. Returns the amount of owned mana
     *
     * @param {number} mana
     *
     * @returns {number}
     */
    Beerwarts.prototype.addMana = function (mana) {
        this.state.mana      += mana;
        this.state.manaTotal += mana;

        if (!isFinite(this.state.mana)) {
            this.state.mana = Number.MAX_VALUE;
        }
        if (!isFinite(this.state.manaTotal)) {
            this.state.manaTotal = Number.MAX_VALUE;
        }

        this._updateEnchantmentAvailableHints();

        return this.state.mana;
    };

    Beerwarts.prototype._removeMana = function (mana) {
        if (this.state.mana < mana) {
            return false;
        }

        this.state.mana -= mana;
        $('#beerwarts-control').find('.beerwarts__mana').text(this.numberFormatter.format(this.state.mana));
        this._updateEnchantmentAvailableHints();

        return true;
    };

    Beerwarts.prototype._iterate = function () {
        const externalManaProductionMultiplier = ComposedValueRegistry.getComposedValue(CV_MANA).getValueExcludingModifier(['Beerwarts_BaseProduction']),
              now                              = new Date();
        let   magicianFinishedName             = null,
              magicianFinishedAmount           = 0,
              skill,
              skills = {
                  spells:    0,
                  equipment: 0,
                  darkness:  0,
              };

        this.addMana(ComposedValueRegistry.getComposedValue(CV_MANA).getValue());

        $('#beerwarts-control').find('.beerwarts__mana').text(this.numberFormatter.format(this.state.mana));
        $('#beerwarts__mana-total').text(this.numberFormatter.format(this.state.manaTotal));

        $.each(this.state.magicians, (function (magicianId, magician) {
            if (magician.inTraining) {
                if (magician.trainingFinished < now) {
                    this._finishTraining(magicianId);

                    magicianFinishedName = magicianFinishedName || magician.name;
                    magicianFinishedAmount++;

                    if (skill = this._checkAutoTraining(magicianId)) {
                        skills[skill]++;
                    }
                }
            } else {
                magician.production += (magician.manaProduction || 0) * externalManaProductionMultiplier;

                if (magician.cooldown && magician.cooldown < now) {
                    const row = $('#beerwarts__magician-row__id-' + magicianId);

                    row.removeClass('beerwarts__magician-row__cooldown');
                    row.find('.beerwarts__magician-row__cooldown-info').addClass('d-none');

                    delete magician.cooldown;

                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerwarts.special.cancelComplete
                    );
                }
            }
        }).bind(this));

        if (magicianFinishedAmount > 0) {
            (new Beerplop.Notification()).notify({
                content: translator.translate(
                    magicianFinishedAmount === 1
                        ? 'beerwarts.message.trainingFinished'
                        : 'beerwarts.message.multipleTrainingFinished',
                    {
                        __NAME__:   `<i>${magicianFinishedName}</i>`,
                        __AMOUNT__: this.numberFormatter.formatInt(magicianFinishedAmount),
                    }
                ),
                style: 'snackbar-success',
                timeout: 5000,
                channel: 'beerwarts',
            });
        }

        // magicians have started a new training session
        if (this.magicianTrainingStartedAmount) {
            this._checkBatchedGroupTrainingShortener(skills);

            this._updateBeerwartsView();
            this._updateMagicianSchoolView();

            this._showTrainingStartedMessage();
        }

        if (this.isMagicianOverlayVisible) {
            $.each(this.state.magicians, (function (magicianId, magician) {
                const row = $('#beerwarts__magician-row__id-' + magicianId);

                row.find('.beerwarts__magician-row__total')
                    .text(this.numberFormatter.format(magician.production));

                row.find('.beerwarts__magician-row__age')
                    .text(this.numberFormatter.formatTimeSpan(now - new Date(magician.birth)));

                if (magician.inTraining) {
                    row.find('.beerwarts__magician-row__remaining-training-time')
                        .text(this.numberFormatter.formatTimeSpan(magician.trainingFinished - now, true));
                }

                if (magician.cooldown) {
                    row.find('.beerwarts__magician-row__remaining-cooldown-time')
                        .text(this.numberFormatter.formatTimeSpan(magician.cooldown - now, true));
                }
            }).bind(this));

            $.each($('.beerwarts__skill-level-up'), (function (index, element) {
                element = $(element);
                element.closest('fieldset').prop(
                    'disabled',
                    this._getNextSkillLevelCost(
                        element.data('skill'),
                        element.data('skill-level')
                    ) > this.gameState.getPlops() || element.hasClass('in-training')
                );
            }).bind(this));

            $('#beerwarts__level-up-tooltip').closest('fieldset').prop(
                'disabled',
                this.gameState.getPlops() < this._getNextBeerwartsLevelCost() ||
                    this.levelMapping[this.state.level + 1] > this.state.magicians.length
            );
        }

        if (this.updateEnchantmentButtonsForBuilding) {
            $('#beerwarts__enchantment-modal__available-mana').text(this.numberFormatter.format(this.state.mana));
            this._updateEnchantmentButtons();
        }

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerwarts.manaTotal,
            this.state.manaTotal
        );
    };

    Beerwarts.prototype._updateEnchantmentButtons = function () {
        $.each($('.beerwarts__enchant'), (function (index, element) {
            element = $(element);
            element.closest('fieldset').prop(
                'disabled',
                this.state.mana < this._getEnchantmentCost(
                    this.updateEnchantmentButtonsForBuilding,
                    element.data('enchantment')
                )
            );
        }).bind(this));
    };

    Beerwarts.prototype._updateEnchantmentAvailableHints = function () {
        $.each(this.enchantmentsAvailable, (function (building, data) {
            if (data.available && this.state.mana < data.costNextEnchantment) {
                $('.beerwarts__enchant-building[data-building-key="' + building + '"]')
                    .removeClass('enchantment-available');
                data.available = false;
            }
            if (!data.available && this.state.mana >= data.costNextEnchantment) {
                $('.beerwarts__enchant-building[data-building-key="' + building + '"]')
                    .addClass('enchantment-available');
                data.available = true;
            }
        }).bind(this));
    };

    Beerwarts.prototype._hireMagician = function () {
        if (!this.gameState.removePlops(this._getCostsForNextMagician())) {
            return;
        }

        this.state.magicians.push({
            skills: {
                spells:    0,
                equipment: 0,
                darkness:  0,
            },
            production:       0,
            name:             chance.name({ middle: true }),
            inTraining:       false,
            trainingFinished: null,
            trainedSkill:     null,
            birth:            new Date(),
        });

        ComposedValueRegistry.getComposedValue(CV_MANA).triggerModifierChange('Beerwarts_BaseProduction');
        this._updateBeerwartsView();
        let skill = this._checkAutoTraining(this.state.magicians.length - 1);

        if (skill) {
            this._updateBeerwartsView();
            this._updateMagicianSchoolView();

            this.magicianTrainingStartedShortened += this._checkGroupTrainingShortener(skill);
            this._showTrainingStartedMessage();
        }

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerwarts.magicians,
            this.state.magicians.length
        );
    };

    Beerwarts.prototype._getCostsForNextMagician = function () {
        return Math.ceil(MAGICIAN_BASE_PRICE * Math.pow(3, this.state.magicians.length || 0));
    };

    Beerwarts.prototype._getNextSkillLevelCost = function (skill, currentLevel) {
        return this.skills[skill].baseCost
            * Math.pow(
                Math.pow(this.skills[skill].multiplier, currentLevel / 10) + 1,
                currentLevel
            );
    };

    Beerwarts.prototype._getNextBeerwartsLevelCost = function () {
        return 1e25 * Math.pow(100, this.state.level - 1);
    };

    Beerwarts.prototype._getAvailableAutoTrainingLevel = function (skill) {
        let highestLevel   = Math.max(...this.state.magicians.map(magician => magician.skills[skill])),
            availableLevel = [];

        for (let level = 1; level <= highestLevel; level++) {
            availableLevel.push({
                value: level,
                label: translator.translate(
                    'beerwarts.school.autoTrain',
                    {
                        __LEVEL__: this.numberFormatter.romanize(level),
                        __COST__:  this.numberFormatter.format(this._getNextSkillLevelCost(skill, level - 1)),
                    }
                ),
                selected: this.state.school.maxLevel[skill] === level,
            });
        }

        return availableLevel;
    };

    /**
     * Check if the given magician can start a training session automatically. Returns the started skill or null if no
     * training session was started
     *
     * @param {Number} magicianId The ID of the magician
     *
     * @return {string|null}
     *
     * @private
     */
    Beerwarts.prototype._checkAutoTraining = function (magicianId) {
        if (!this.autoTrainingUnlocked ||
            !this.state.school.enabled ||
            this.state.magicians[magicianId].inTraining ||
            this.state.magicians[magicianId].cooldown
        ) {
            return null;
        }

        let startedSkill = null;

        $.each(this.state.magicians[magicianId].skills, (function (skill, currentLevel) {
            if (currentLevel < this.state.school.maxLevel[skill] && this._startTraining(magicianId, skill, true)) {
                if (!this.hasAutoLevelAchievement) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerwarts.special.auto
                    );

                    this.hasAutoLevelAchievement = true;
                }

                startedSkill = skill;

                return false;
            }
        }).bind(this));

        return startedSkill;
    };

    Beerwarts.prototype._checkAutoTrainingForAllMagicians = function () {
        let skill,
            skills = {
            spells:    0,
            equipment: 0,
            darkness:  0,
        };

        $.each(this.state.magicians, (function (magicianId) {
            if (skill = this._checkAutoTraining(magicianId)) {
                skills[skill]++;
            }
        }).bind(this));

        this._checkBatchedGroupTrainingShortener(skills);
        this._showTrainingStartedMessage();
    };

    Beerwarts.prototype._checkBatchedGroupTrainingShortener = function (startedSkills) {
        $.each(
            Object.entries(startedSkills).filter(skill => skill[1] > 0),
            (index, [skill, startedTrainings]) =>
                this.magicianTrainingStartedShortened += this._checkGroupTrainingShortener(skill, startedTrainings)
        );
    };

    Beerwarts.prototype._getBaseManaProduction = function () {
        let manaProduction = 0;

        $.each(this.state.magicians, (function (index, magician) {
            let production = 1;

            $.each(magician.skills, (function (skill, level) {
                if (level > 0) {
                    production *= Math.pow(this.skills[skill].manaMultiplier, level);
                }
            }).bind(this));

            if (magician.inTraining) {
                production = 0;
            }

            this.state.magicians[index].manaProduction = isFinite(production) ? production : Number.MAX_VALUE;

            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerwarts.magicianManaPerSecond,
                production
            );

            manaProduction += production;
        }).bind(this));

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerwarts.manaPerSecond,
            manaProduction
        );

        return manaProduction;
    };

    Beerwarts.prototype._updateBeerwartsView = function (newValue = null) {
        const magiciansInTraining = this._getMagiciansInTraining();

        if (magiciansInTraining > 0) {
            $('#beerwarts__magician-in-training__container').removeClass('d-none');
        } else {
            $('#beerwarts__magician-in-training__container').addClass('d-none');
        }

        if (newValue === null) {
            newValue = ComposedValueRegistry.getComposedValue(CV_MANA).getValue();
        }

        $('#beerwarts__magician').text(this.numberFormatter.formatInt(this.state.magicians.length));
        $('#beerwarts__magician-in-training').text(this.numberFormatter.formatInt(magiciansInTraining));
        $('#beerwarts__cost-next-magician').text(this.numberFormatter.format(this._getCostsForNextMagician()));
        $('#beerwarts__mana-per-second').text(this.numberFormatter.format(newValue));
        $('#beerwarts__mana-total').text(this.numberFormatter.format(this.state.manaTotal));
        $('.beerwarts__mana').text(this.numberFormatter.format(this.state.mana));

        if (this.state.magicians.length > 0) {
            $('#beerwarts-overlay-container__empty-state').addClass('d-none');
            $('#beerwarts-overlay-container').removeClass('d-none');
        }

        $.each(this._getEnchantableBuildings(), (function (index, building) {
            $('.enchantment-level__' + building).text(this.numberFormatter.romanize(
                this.state.buildingEnchantments[building] ? this.state.buildingEnchantments[building].level : 0
            ));
        }).bind(this));
    };

    /**
     * Get a list of all buildings which may be enchanted
     *
     * @returns {string[]}
     *
     * @private
     */
    Beerwarts.prototype._getEnchantableBuildings = function () {
        return [...Object.keys(this.gameState.state.buildings), 'bottleCapFactory'];
    };

    /**
     * Get the amount of magicians which are currently in training
     *
     * @returns {*}
     *
     * @private
     */
    Beerwarts.prototype._getMagiciansInTraining = function () {
        return this.state.magicians.reduce((amount, magician) => magician.inTraining ? amount + 1 : amount, 0);
    };

    Beerwarts.prototype._updateMagicianSchoolView = function () {
        if (!this.autoTrainingUnlocked) {
            return;
        }

        let enabledSkills = [];

        $.each(this.skills, (function filterSkills(key, skill) {
            let availableLevel = this._getAvailableAutoTrainingLevel(key);

            if (skill.requiredLevel <= this.state.level && availableLevel.length !== 0) {
                availableLevel.unshift({
                    value:    0,
                    label:    translator.translate('beerwarts.school.disableAutoTrain'),
                    selected: this.state.school.maxLevel[skill] === 0,
                });

                enabledSkills.push({
                    key:   key,
                    level: availableLevel,
                });
            }
        }).bind(this));

        const container = $('#beerwarts__magician-school__control');
        container.html(
            Mustache.render(
                TemplateStorage.get('beerwarts__magician-school-template'),
                {
                    skills:  enabledSkills,
                    enabled: this.state.school.enabled,
                }
            )
        );

        $('#beerwarts__magician-school__enabled').on('change', (function (event) {
            this.state.school.enabled = $(event.target).is(':checked');

            this._checkAutoTrainingForAllMagicians();
            this._updateBeerwartsView();
        }).bind(this));

        container.find('.beerwarts__auto-training-control').on('change', (function (event) {
            this.state.school.maxLevel[$(event.target).data('skill')] = parseInt($(event.target).val());

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.beerwarts.special.material
            );

            this._checkAutoTrainingForAllMagicians();
            this._updateBeerwartsView();
        }).bind(this));
    };

    Beerwarts.prototype._renderMagicianOverview = function () {
        let enabledSkills = [];

        const externalManaProductionMultiplier = ComposedValueRegistry.getComposedValue(CV_MANA).getValueExcludingModifier(['Beerwarts_BaseProduction']),
              now                              = new Date();

        this.isMagicianOverlayVisible = true;

        $.each(this.skills, (function filterSkills(key, skill) {
            if (skill.requiredLevel > this.state.level) {
                return;
            }

            enabledSkills.push({
                key:        key,
                multiplier: skill.manaMultiplier,
                sessions:   this.numberFormatter.formatInt(this._getCurrentSessions(key)),
            })
        }).bind(this));

        const container = $('#beerwarts-overlay');
        container.find('.beerwarts__skill-level-up').tooltip('dispose');
        container.html(
            Mustache.render(
                TemplateStorage.get('beerwarts-overlay-template'),
                {
                    enabledSkills: enabledSkills,
                    skillLevel:    this.numberFormatter.romanize(this.state.level),
                    skillLevelMax: this.state.level === 4,
                    amount:        this.state.magicians.length,
                    filter:        this.state.magicians.length >= 10 && enabledSkills.length,
                    magicians:     this.state.magicians.map((function mapMagicianData(magician, magicianId) {
                        let skills = [];
                        $.each(enabledSkills, (function (index, skill) {
                            skills.push({
                                name:       skill.key,
                                level:      magician.skills[skill.key],
                                levelLabel: this.numberFormatter.romanize(magician.skills[skill.key]),
                                cost:       this.numberFormatter.format(
                                    this._getNextSkillLevelCost(skill.key, magician.skills[skill.key])
                                ),
                            });
                        }).bind(this));

                        return {
                            production:   this.numberFormatter.format(magician.production),
                            perSecond:    this.numberFormatter.format(
                                magician.manaProduction * externalManaProductionMultiplier
                            ),
                            skills:       skills,
                            id:           magicianId,
                            name:         magician.name,
                            inTraining:   magician.inTraining,
                            trainedSkill: magician.trainedSkill,
                            cooldown:     magician.cooldown,
                            cooldownTime: this.numberFormatter.formatTimeSpan(magician.cooldown - now, true),
                            age:          this.numberFormatter.formatTimeSpan(now - new Date(magician.birth)),
                            trainingTime: this.numberFormatter.formatTimeSpan(magician.trainingFinished - now, true),
                        }
                    }).bind(this)),
                    ucfirst: function () {
                        return function (text, render) {
                            const renderedText = render(text);
                            return renderedText.charAt(0).toUpperCase() + renderedText.slice(1);
                        }
                    }
                }
            )
        );

        // apply the material design manually as it's dynamically generated content
        container.find('.beerwarts__magician-table__filter').bootstrapMaterialDesign();

        this._initMagicianLevelUpButtons();

        new Beerplop.ObjectNaming(
            $('.beerwarts__magician-name'),
            (magicianId, name) => this.state.magicians[magicianId].name = name,
            'beerwarts.special.naming'
        );

        $('.beerwarts__level-up-tooltip').tooltip({
            title: (function renderBeerwartsLevelUpTooltip() {
                const requiredPlops = this._getNextBeerwartsLevelCost();

                return Mustache.render(
                    TemplateStorage.get('level-up-beerwarts-tooltip-template'),
                    {
                        magicians:        this.levelMapping[this.state.level + 1],
                        magiciansReached: this.levelMapping[this.state.level + 1] <= this.state.magicians.length,
                        plops:            this.numberFormatter.format(requiredPlops),
                        plopsReached:     requiredPlops <= this.gameState.getPlops()
                    }
                );
            }).bind(this)
        });

        $('#beerwarts__level-up-tooltip').on('click', (function () {
            if (this.levelMapping[this.state.level + 1] > this.state.magicians.length ||
                !this.gameState.removePlops(this._getNextBeerwartsLevelCost())
            ) {
                return;
            }

            $('.beerwarts__level-up-tooltip').tooltip('dispose');

            this.state.level++;
            this._renderMagicianOverview();
            this._updateMagicianSchoolView();

            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerwarts.level,
                this.state.level
            );
        }).bind(this));

        $('#beerwarts__magician-table__filter-producing').on(
            'change',
            () => container
                .find('.beerwarts__magician-row:not(.beerwarts__magician-row__training-active)')
                .toggleClass('d-none')
        );

        $('#beerwarts__magician-table__filter-training').on(
            'change',
            () => container.find('.beerwarts__magician-row__training-active').toggleClass('d-none')
        );
    };

    /**
     * Count the amount of active training sessions with the given skill
     *
     * @param {string} skill
     *
     * @returns {int}
     *
     * @private
     */
    Beerwarts.prototype._getCurrentSessions = function (skill) {
        return this.state.magicians.reduce((carry, magician) => carry + (magician.trainedSkill === skill), 0);
    };

    Beerwarts.prototype._updateCurrentSessionsForSkill = function (skill) {
        if (this.isMagicianOverlayVisible) {
            $('#beerwarts__magician-table__sessions-' + skill)
                .text(this.numberFormatter.formatInt(this._getCurrentSessions(skill)));
        }
    };

    Beerwarts.prototype._initMagicianLevelUpButtons = function () {
        $.each(this.state.magicians, function addInTrainingClass(magicianId, magician) {
            if (magician.inTraining) {
                $('#beerwarts__magician-row__id-' + magicianId)
                    .find('.beerwarts__skill-level-up')
                    .addClass('in-training');
            }
        });

        const overlay       = $('#beerwarts-overlay'),
              buttons       = overlay.find('.beerwarts__skill-level-up'),
              cancelButtons = overlay.find('.beerwarts__skill-cancel');

        buttons.on('click', (function levelUpMagicianSkill(event) {
            const button     = $(event.target),
                  magicianId = button.data('magician-id'),
                  skill      = button.data('skill');

            if (this._startTraining(magicianId, skill)) {
                this._updateBeerwartsView();
                this._updateMagicianSchoolView();

                this.magicianTrainingStartedShortened += this._checkGroupTrainingShortener(skill);
                this._showTrainingStartedMessage();
            }
            button.tooltip('dispose');
        }).bind(this));

        const beerwarts = this;
        buttons.tooltip({
            title: function renderBeerwartsLevelUpTooltip() {
                const magicianId = $(this).data('magician-id'),
                      skill      = $(this).data('skill');

                return Mustache.render(
                    TemplateStorage.get('level-up-beerwarts-magician-tooltip-template'),
                    {
                        duration:             beerwarts.numberFormatter.formatTimeSpan(
                            beerwarts._getTrainingDuration(magicianId, skill) * 1000,
                            true
                        ),
                        autoTraining:         beerwarts.autoTrainingReductionMultiplier !== 1,
                        durationAutoTraining: beerwarts.numberFormatter.formatTimeSpan(
                            beerwarts._getTrainingDuration(magicianId, skill, true) * 1000,
                            true
                        ),
                        groupTraining:        beerwarts.groupTrainingShortenerEnabled,
                        supported:            beerwarts.numberFormatter.formatInt(
                            beerwarts.state.magicians.reduce(
                                (total, magician) => total + (magician.trainedSkill === skill ? 1 : 0),
                                0
                            )
                        ),
                    }
                );
            }
        });

        cancelButtons.tooltip();

        cancelButtons.on('click', (function levelUpMagicianSkill(event) {
            const button     = $(event.target),
                  magicianId = button.data('magician-id'),
                  magician   = this.state.magicians[magicianId],
                  skill      = magician.trainedSkill;

            let cooldown = new Date();
            cooldown.setSeconds(cooldown.getSeconds() + 60 * 60 * 24 * 7);

            magician.skills[skill]--;
            magician.cooldown = cooldown;

            this._finishTraining(magicianId);
            this._updateMagicianRow(magicianId, skill);

            const row = $('#beerwarts__magician-row__id-' + magicianId);
            row.addClass('beerwarts__magician-row__cooldown');
            row.find('.beerwarts__magician-row__remaining-cooldown-time')
                .text(this.numberFormatter.formatTimeSpan(magician.cooldown - new Date(), true));
            row.find('.beerwarts__magician-row__cooldown-info').removeClass('d-none');

            button.tooltip('dispose');

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.beerwarts.special.cancel
            );
        }).bind(this));
    };

    /**
     * Finish the training of the given magician
     *
     * @param {int} magicianId
     *
     * @private
     */
    Beerwarts.prototype._finishTraining = function (magicianId) {
        const magician = this.state.magicians[magicianId],
              skill    = magician.trainedSkill;

        magician.inTraining       = false;
        magician.trainingFinished = null;
        magician.trainedSkill     = null;

        ComposedValueRegistry.getComposedValue(CV_MANA).triggerModifierChange('Beerwarts_BaseProduction');

        if (this.isMagicianOverlayVisible) {
            this._updateCurrentSessionsForSkill(skill);

            const row = $('#beerwarts__magician-row__id-' + magicianId);

            row.find('.beerwarts__magician-row__training').addClass('d-none');
            row.find('.beerwarts__skill-level-up').removeClass('in-training');
            row.find('.beerwarts__magician-row__per-second')
                .text(this.numberFormatter.format(magician.manaProduction));

            row.removeClass('beerwarts__magician-row__training-' + skill);
        }
    };

    /**
     * Start a new training session for a given magician
     *
     * @param {int}     magicianId   The ID of the magician who should start a training session
     * @param {string } skill        The key of the skill the magician should train
     * @param {boolean} autoTraining Is it an automatically started training?
     *
     * @returns {boolean}
     *
     * @private
     */
    Beerwarts.prototype._startTraining = function (magicianId, skill, autoTraining = false) {
        const row      = $('#beerwarts__magician-row__id-' + magicianId),
              magician = this.state.magicians[magicianId];

        if (magician.inTraining ||
            magician.cooldown ||
            !this.gameState.removePlops(
                this._getNextSkillLevelCost(skill, this.state.magicians[magicianId].skills[skill]),
                !autoTraining,
            )
        ) {
            return false;
        }

        let trainingFinished = new Date();
        trainingFinished.setSeconds(
            trainingFinished.getSeconds() + this._getTrainingDuration(magicianId, skill, autoTraining)
        );

        this.state.magicians[magicianId].inTraining       = true;
        this.state.magicians[magicianId].trainingFinished = trainingFinished;
        this.state.magicians[magicianId].trainedSkill     = skill;
        this.state.magicians[magicianId].skills[skill]++;

        ComposedValueRegistry.getComposedValue(CV_MANA).triggerModifierChange('Beerwarts_BaseProduction');

        if (this.isMagicianOverlayVisible) {
            row.find('.beerwarts__magician-row__remaining-training-time').text(
                this.numberFormatter.formatTimeSpan(trainingFinished - new Date(), true)
            );
            row.find('.beerwarts__magician-row__training').removeClass('d-none');
            row.find('.beerwarts__skill-level-up').addClass('in-training');
            row.addClass('beerwarts__magician-row__training-' + skill);

            this._updateCurrentSessionsForSkill(skill);
            this._updateMagicianRow(magicianId, skill);
        }

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerwarts.skillLevel,
            this.state.magicians[magicianId].skills[skill]
        );

        // collect data about started training sessions and display them as a batch message later
        this.magicianTrainingStartedName  = this.magicianTrainingStartedName || this.state.magicians[magicianId].name;
        this.magicianTrainingStartedSkill = skill;
        this.magicianTrainingStartedAmount++;

        return true;
    };

    Beerwarts.prototype._showTrainingStartedMessage = function () {
        if (!this.magicianTrainingStartedAmount) {
            return;
        }

        (new Beerplop.Notification()).notify({
            content: translator.translate(
                this.magicianTrainingStartedAmount === 1
                    ? 'beerwarts.message.trainingStarted'
                    : 'beerwarts.message.multipleTrainingStarted',
                {
                    __NAME__:   `<i>${this.magicianTrainingStartedName}</i>`,
                    __SKILL__:  translator.translate('beerwarts.skill.' + this.magicianTrainingStartedSkill),
                    __AMOUNT__: this.numberFormatter.formatInt(this.magicianTrainingStartedAmount),
                }
            ) + (
                this.magicianTrainingStartedShortened === 0 ? '' : ` (${translator.translate(
                    'beerwarts.message.shortened',
                    {
                        __AMOUNT__: this.numberFormatter.formatInt(this.magicianTrainingStartedShortened)
                    }
                )})`
            ),
            style: 'snackbar-info',
            timeout: 5000,
            channel: 'beerwarts',
        });

        this.magicianTrainingStartedAmount    = 0;
        this.magicianTrainingStartedShortened = 0;
        this.magicianTrainingStartedName      = null;
        this.magicianTrainingStartedSkill     = null;
    };

    Beerwarts.prototype._updateMagicianRow = function (magicianId, skill) {
        const row           = $('#beerwarts__magician-row__id-' + magicianId),
              magician      = this.state.magicians[magicianId],
              costNextLevel = this._getNextSkillLevelCost(skill, magician.skills[skill]);

        row.find('.beerwarts__magician-row__per-second')
            .text(this.numberFormatter.format(magician.manaProduction));

        row.find('.beerwarts__magician-row__current-level__' + skill)
            .text(this.numberFormatter.romanize(magician.skills[skill]));

        row.find('.beerwarts__magician-row__cost-next__' + skill)
            .text(this.numberFormatter.format(costNextLevel));

        row.find(`button[data-skill="${skill}"]`).data('skill-level', magician.skills[skill]);
        row.find('button').closest('fieldset').prop('disabled', true);
    };

    /**
     * Shorten all trainings by a given percentage
     *
     * @param {Number}      percentage How many percentages shall the training be shortened
     * @param {string|null} skill      Limit to a given trained skill
     * @param {Number}      amount     How often shall the percentage be calculated
     *
     * @returns {number}
     */
    Beerwarts.prototype.shortenTrainings = function (percentage, skill = null, amount = 1) {
        let shortenedTrainings = 0;
        const now          = new Date(),
              timeModifier = Math.pow((100 - percentage) / 100, amount) / 1000;

        $.each(this.state.magicians, (function (magicianId, magician) {
            if (!magician.trainingFinished || (skill !== null && magician.trainedSkill !== skill)) {
                return;
            }

            let newDate = new Date();
            newDate.setSeconds((magician.trainingFinished - now) * timeModifier);
            magician.trainingFinished = newDate;

            if (this.isMagicianOverlayVisible) {
                $('#beerwarts__magician-row__id-' + magicianId)
                    .find('.beerwarts__magician-row__remaining-training-time')
                    .text(this.numberFormatter.formatTimeSpan(magician.trainingFinished - now, true));
            }

            shortenedTrainings += amount;
        }).bind(this));

        return shortenedTrainings;
    };

    /**
     * Check if running trainings for the given spell must be shortened due to group effects. Returns the amount of
     * shortened trainings.
     *
     * @param {string} skill  The skill to shorten
     * @param {Number} amount How often shall the trainings be shortened
     *
     * @returns {number}
     *
     * @private
     */
    Beerwarts.prototype._checkGroupTrainingShortener = function (skill, amount = 1) {
        if (!this.groupTrainingShortenerEnabled) {
            return 0;
        }

        let shortenedTrainings = this.shortenTrainings(5, skill, amount);

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerwarts.groupTraining,
            shortenedTrainings
        );

        return shortenedTrainings;
    };

    /**
     * Get the duration for a training session in seconds
     *
     * @param {int}     magicianId   The ID of the magician who should train
     * @param {string}  skill        The skill which should be trained
     * @param {boolean} autoTraining Is the requested training an automatically started training
     *
     * @returns {number}
     *
     * @private
     */
    Beerwarts.prototype._getTrainingDuration = function (magicianId, skill, autoTraining = false) {
        return Math.min(
            this.skills[skill].baseTrainingTime
                * Math.pow(
                    this.skills[skill].trainingTimeMultiplier,
                    this.state.magicians[magicianId].skills[skill] * 0.8
                )
                * this.trainingShortener
                * (autoTraining ? this.autoTrainingReductionMultiplier : 1)
                * Math.pow(this.cribReductionMultiplier, this._getCurrentSessions(skill)),
            // limit the training duration to a max of 1000 days
            86_400_000
        );
    };

    Beerwarts.prototype._initBuildingEnchantment = function () {
        $('.beerwarts__enchant-building').on('click', (function showBuildingEnchantmentModal(event) {
            this._renderBuildingEnchantmentModal($(event.target).data('buildingKey'));
        }).bind(this));
    };

    Beerwarts.prototype._renderBuildingEnchantmentModal = function (building) {
        const buildingLabel = translator.translate('building.' + building, null, '', 2);

        if (!this.state.buildingEnchantments[building]) {
            this.state.buildingEnchantments[building] = {
                buildingBoost: 0,
                totalBoost: 0,
                buildingReduction: 0,
                level: 0,
            };
        }

        const enchantment   = this.state.buildingEnchantments[building],
              nextSacrifice = ((enchantment.sacrifice || 0) + 1) * 10;

        $('#beerwarts__enchant-modal__body').html(
            Mustache.render(
                TemplateStorage.get('beerwarts__enchant-modal__body-template'),
                {
                    building:         `<b>${buildingLabel}</b>`,
                    buildingKey:      building,
                    buildingLevel:    this.numberFormatter.romanize(enchantment.level),
                    availableMana:    this.numberFormatter.format(this.state.mana),
                    buildingBoost:    this.numberFormatter.format((this.getBuildingMultiplier(building).buildingBoost - 1) * 100),
                    boostOthers:      this.numberFormatter.format((this._getAffectedBuildingsBoost(building) - 1) * 100),
                    reduction:        this.numberFormatter.format((1 - this.getBuildingReduction(building)) * 100),
                    sacrificeEnabled: this.sacrificeEnabled,
                    sacrifice:        enchantment.level >= nextSacrifice,
                    nextSacrifice:    this.numberFormatter.romanize(nextSacrifice),
                    sacrificeLevel:   this.numberFormatter.romanize(enchantment.sacrifice || 0),
                    enchantments: [
                        {
                            title: translator.translate('beerwarts.enchantment.buildingBoost.title', {__BUILDING__: buildingLabel}),
                            description: translator.translate(
                                'beerwarts.enchantment.buildingBoost.description',
                                {
                                    __BUILDING__: buildingLabel,
                                    __BOOST__:    this.numberFormatter.format((this._getBuildingBoost(enchantment) - 1) * 100),
                                }
                            ),
                            key: 'buildingBoost',
                            level: this.numberFormatter.romanize(enchantment.buildingBoost),
                            cost: this.numberFormatter.format(this._getEnchantmentCost(building, 'buildingBoost')),
                        },
                        {
                            title: translator.translate('beerwarts.enchantment.totalBoost.title'),
                            description: translator.translate('beerwarts.enchantment.totalBoost.description', {__BUILDING__: buildingLabel}),
                            key: 'totalBoost',
                            level: this.numberFormatter.romanize(enchantment.totalBoost),
                            cost: this.numberFormatter.format(this._getEnchantmentCost(building, 'totalBoost')),
                        },
                        {
                            title: translator.translate('beerwarts.enchantment.buildingReduction.title', {__BUILDING__: buildingLabel}),
                            description: translator.translate(
                                'beerwarts.enchantment.buildingReduction.description',
                                {
                                    __BUILDING__: buildingLabel,
                                    __BOOST__:    this.numberFormatter.format((1 - this._getReductionBoost(enchantment)) * 100),
                                }
                            ),
                            key: 'buildingReduction',
                            level: this.numberFormatter.romanize(enchantment.buildingReduction),
                            cost: this.numberFormatter.format(this._getEnchantmentCost(building, 'buildingReduction')),
                        },
                    ],
                    getSpell: function () {
                        return function () {
                            return translator.translate('beerwarts.spell.' + (Math.floor(Math.random() * 24) + 1));
                        }
                    }
                }
            )
        );

        this.updateEnchantmentButtonsForBuilding = building;
        this._updateEnchantmentButtons();

        const modal = $('#beerwarts__enchant-modal');

        // remove the totalBoost enchantment for bottle cap factories
        if (building === 'bottleCapFactory') {
            modal.find('.enchantment-container')[1].remove();
            modal.find('li')[1].remove();
        }

        modal.modal('show');
        modal.on('hidden.bs.modal', (function () {
            this.updateEnchantmentButtonsForBuilding = null;
        }).bind(this));

        $('.beerwarts__enchant').on('click', (function (event) {
            const button         = $(event.target).closest('button'),
                  enchantmentKey = button.data('enchantment'),
                  building       = button.closest('.enchantment-options').data('buildingKey');

            if (!this._removeMana(this._getEnchantmentCost(building, enchantmentKey))) {
                return;
            }

            enchantment[enchantmentKey]++;
            enchantment.level++;

            this.cache.buildingMultiplier = {};

            if (enchantmentKey === 'buildingReduction') {
                building === 'bottleCapFactory'
                    ? this.gameState.getBuildingLevelController().updateCostNext(true)
                    : this.gameState.updateCosts(building);
            } else {
                if (building === 'bottleCapFactory') {
                    ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).triggerModifierChange('Beerwarts');
                } else {
                    this.gameState.recalculateAutoPlopsPerSecond();
                }
            }

            this._updateUIAfterEnchantment(building);

            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerwarts.buildingLevel,
                enchantment.level
            );
            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerwarts.buildingLevelTotal,
                this._getTotalEnchantments()
            );

            // all main buildings + bottle cap factories
            if (Object.keys(this.state.buildingEnchantments).length ===
                Object.keys(this.gameState.getBuildings()).length + 1
            ) {
                let hasEachBuildingEnchanted = true;
                $.each(this.state.buildingEnchantments, function (building, enchantmentData) {
                    if (enchantmentData.level === 0) {
                        hasEachBuildingEnchanted = false;
                        return false;
                    }
                });

                if (hasEachBuildingEnchanted) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerwarts.special.onAllBuildings
                    );
                }
            }

            this._renderBuildingEnchantmentModal(building);
        }).bind(this));

        $('.beerwarts_sacrifice').on('click', (function () {
            const sacrificeModal  = $('#sacrifice-hint-modal'),
                  sacrificeButton = $('#sacrifice');

            sacrificeModal.find('.modal-body').text(
                translator.translate('beerwarts.sacrifice.warning', {__BUILDING__: buildingLabel})
            );
            sacrificeButton.data('role', 'beerwarts');
            sacrificeButton.data('building', building);

            modal.modal('hide');
            sacrificeModal.modal('show');

            sacrificeModal.off('hidden.bs.modal.beerwarts');
            sacrificeModal.on('hidden.bs.modal.beerwarts', () => {
                sacrificeModal.off('hidden.bs.modal.beerwarts');
                this._renderBuildingEnchantmentModal(building);
            });
        }).bind(this));
    };

    Beerwarts.prototype._checkSacrificeOnEachBuildingAchievements = function () {
        let minLevel = Number.MAX_VALUE;

        // all main buildings + bottle cap factories
        if (Object.keys(this.state.buildingEnchantments).length ===
            Object.keys(this.gameState.getBuildings()).length + 1
        ) {
            $.each(this.state.buildingEnchantments, function (building, enchantmentData) {
                minLevel = Math.min(minLevel, (enchantmentData.sacrifice || 0))
            });

            if (minLevel > 0) {
                this.achievementController.checkAmountAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerwarts.sacrificeEach,
                    minLevel
                );
            }
        }
    };

    Beerwarts.prototype._updateUIAfterEnchantment = function (building) {
        $('.enchantment-level__' + building).text(
            this.numberFormatter.romanize(this.state.buildingEnchantments[building].level)
        );

        const buildingContainer = $('#building-container-' + building).closest('.building-container');
        buildingContainer.addClass('enchanted');
        window.setTimeout(
            () => buildingContainer.removeClass('enchanted'),
            1000
        );

        $.each(this.enchantmentsAvailable, (function (building) {
            this.enchantmentsAvailable[building].costNextEnchantment = this._getCheapestNextEnchantment(building);
        }).bind(this));
        this._updateEnchantmentAvailableHints();
    };

    /**
     * Get a multiplier how much the production of a building is boosted by the applied enchantments
     *
     * @param {string} building The key of the building
     *
     * @returns {Object}
     */
    Beerwarts.prototype.getBuildingMultiplier = function (building) {
        if (this.cache.buildingMultiplier[building]) {
            return this.cache.buildingMultiplier[building];
        }

        let result = {
            // the aggregated multiplier for the building
            totalMultiplier: 1,
            // the boost achieved by own enchantments
            buildingBoost: 1,
            // the boost achieved by enchantments of other buildings
            totalBoost: 1,
        };

        const enchantment = this.state.buildingEnchantments[building];
        if (enchantment) {
            result.buildingBoost = Math.pow(this._getBuildingBoost(enchantment), enchantment.buildingBoost);
        }

        if (building !== 'bottleCapFactory') {
            $.each(
                this.state.buildingEnchantments,
                (function calculateBeerwartsTotalBoostMultiplier(enchantedBuilding) {
                    result.totalBoost *= this._getAffectedBuildingsBoost(enchantedBuilding);
                }).bind(this)
            );
        }

        result.totalMultiplier                  = result.buildingBoost * result.totalBoost;
        this.cache.buildingMultiplier[building] = result;

        return result;
    };

    Beerwarts.prototype._getBuildingBoost = function (enchantment) {
        return 1.05 + (enchantment.sacrifice || 0) * 0.005;
    };

    /**
     * Get the multiplier for boosting all other buildings
     *
     * @param {string} building The key of the requested building
     *
     * @returns {number}
     *
     * @private
     */
    Beerwarts.prototype._getAffectedBuildingsBoost = function (building) {
        const enchantment = this.state.buildingEnchantments[building];

        if (!enchantment || building === 'bottleCapFactory') {
            return 1;
        }

        return Math.pow(
            1 + (
                this.gameState.getBuildingData(building).amount /
                ((2 - (enchantment.sacrifice || 0) * 0.05) * 1e4)
            ),
            enchantment.totalBoost
        );
    };

    /**
     * Get a multiplier how much the price of a building is reduced by the applied enchantments
     * (1.5% for each enchantment level)
     *
     * @param {string} building The key of the building
     *
     * @returns {number}
     */
    Beerwarts.prototype.getBuildingReduction = function (building) {
        const enchantment = this.state.buildingEnchantments[building];

        if (!enchantment) {
            return 1;
        }

        return Math.pow(this._getReductionBoost(enchantment), enchantment.buildingReduction);
    };

    Beerwarts.prototype._getReductionBoost = function (enchantment) {
        return 0.985 - (enchantment.sacrifice || 0) * 0.005;
    };

    /**
     * Get the costs for the next level of the requested enchantment
     *
     * @param {string} building
     * @param {string} enchantment
     *
     * @returns {number}
     * @private
     */
    Beerwarts.prototype._getEnchantmentCost = function (building, enchantment) {
        if (building === 'bottleCapFactory' && enchantment === 'totalBoost') {
            return Infinity;
        }

        const baseCostMap = {
            'buildingBoost':     1e4,
            'totalBoost':        25e3,
            'buildingReduction': 2e4,
        };

        return baseCostMap[enchantment]
            * Math.pow(5, this.state.buildingEnchantments[building] ? this.state.buildingEnchantments[building][enchantment] || 0 : 0)
            * Math.pow(3, this.state.buildingEnchantments[building] ? this.state.buildingEnchantments[building].level : 0)
            * Math.pow(10, this.state.buildingEnchantments[building] ? this.state.buildingEnchantments[building].sacrifice || 0 : 0)
            * Math.pow(1.075, this._getTotalEnchantments());
    };

    Beerwarts.prototype._getCheapestNextEnchantment = function (building) {
        return Math.min(
            ...(['buildingBoost', 'totalBoost', 'buildingReduction'].map((function (enchantment) {
                return this._getEnchantmentCost(building, enchantment);
            }).bind(this)))
        );
    };

    Beerwarts.prototype.addManaProductionUpgradeMultiplier = function (manaProductionUpgradeMultiplier) {
        this.manaProductionUpgradeMultiplier *= 1 + manaProductionUpgradeMultiplier;

        ComposedValueRegistry
            .getComposedValue(CV_MANA)
            .triggerModifierChange('Beerwarts_manaProductionUpgradeMultiplier');
    };

    Beerwarts.prototype.addManaProductionMultiplier = function (manaProductionMultiplier) {
        this.manaProductionMultiplier += manaProductionMultiplier;
        ComposedValueRegistry.getComposedValue(CV_MANA).triggerModifierChange('Beerwarts_manaProductionMultiplier');
    };

    Beerwarts.prototype.removeManaProductionMultiplier = function (manaProductionMultiplier) {
        this.manaProductionMultiplier -= manaProductionMultiplier;
        ComposedValueRegistry.getComposedValue(CV_MANA).triggerModifierChange('Beerwarts_manaProductionMultiplier');
    };

    Beerwarts.prototype.setAutoTrainingReductionMultiplier = function (multiplier) {
        this.autoTrainingReductionMultiplier = multiplier;
    };

    /**
     * Sum up how many enchantments were used
     *
     * @returns {number}
     */
    Beerwarts.prototype._getTotalEnchantments = function () {
        let enchantments = 0;

        $.each(this.state.buildingEnchantments, function () {
            enchantments += this.level;
        });

        return enchantments;
    };

    Beerwarts.prototype.setAchievementController = function (achievementController) {
        this.achievementController = achievementController;
    };

    /**
     * Interpolate the mana generated during an abstinence
     *
     * @param duration   The duration in seconds
     * @param percentage The production percentage
     */
    Beerwarts.prototype.interpolateGameBreakMana = function (duration, percentage) {
        this.addMana(ComposedValueRegistry.getComposedValue(CV_MANA).getValue() * duration * percentage);
    };

    Beerwarts.prototype.addTrainingShortener = function (shortener) {
        this.trainingShortener *= 1 - shortener;
    };

    Beerwarts.prototype.enableSacrifice = function () {
        this.sacrificeEnabled = true;
    };

    minigames.Beerwarts = Beerwarts;
})(Minigames);

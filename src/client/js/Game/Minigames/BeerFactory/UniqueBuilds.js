(function(beerFactoryGame) {
    'use strict';

    const BUILDS = {
        giza: {
            parts: [
                {
                    key: 'obelisk',
                    materials: {
                        wood: 30000000,
                        stone: 350000000,
                        granite: 200000000,
                        tools: 1100000,
                        marble: 1500000,
                        diamond: 27500000,
                    },
                },
                {
                    key: 'sphinx',
                    materials: {
                        copper: 13200000,
                        wood: 600000000,
                        stone: 750000000,
                        granite: 400000000,
                        tools: 2100000,
                        marble: 1400000,
                    },
                },
                {
                    key: 'pyramid',
                    materials: {
                        wood: 600000000,
                        stone: 1050000000,
                        granite: 450000000,
                        gold: 30000000,
                    },
                },
                {
                    key: 'pyramidion',
                    materials: {
                        gold: 150000000,
                        diamond: 27500000,
                    },
                },
            ]
        }
    };

    UniqueBuilds.prototype.buildQueue            = null;
    UniqueBuilds.prototype.gameEventBus          = null;
    UniqueBuilds.prototype.numberFormatter       = null;
    UniqueBuilds.prototype.achievementController = null;

    UniqueBuilds.prototype.state = {
        builds: {
            giza: {
                progress: 0,
                inQueue: null,
                unlocked: false,
                buildStarted: null,
                buildFinished: null,
                spells: [],
            },
        },
        // https://www.ancient.eu/article/1011/ancient-egyptian-symbols/
        spells: ['ankh', 'djed', 'was']
    };

    UniqueBuilds.prototype.initialState = null;
    UniqueBuilds.prototype.modalOpened  = false;

    function UniqueBuilds(buildQueue, gameEventBus, numberFormatter, achievementController) {
        this.initialState = $.extend(true, {}, this.state);

        this.buildQueue            = buildQueue;
        this.gameEventBus          = gameEventBus;
        this.numberFormatter       = numberFormatter;
        this.achievementController = achievementController;

        (new Beerplop.GamePersistor()).registerModule(
            'BeerFactory__UniqueBuilds',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedState) {
                this.state = $.extend(true, {}, this.initialState, loadedState);

                $.each (this.state.builds, function (key, data) {
                    if (data.buildStarted !== null) {
                        data.buildStarted = new Date(data.buildStarted);
                    }
                    if (data.buildFinished !== null) {
                        data.buildFinished = new Date(data.buildFinished);
                    }
                });
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.BEER_FACTORY.QUEUE.FINISHED, (function (event, id, action, item) {
            if (action === BUILD_QUEUE__UNIQUE_BUILD) {
                this.state.builds[item.build].inQueue = null;

                if (++this.state.builds[item.build].progress === BUILDS[item.build].parts.length) {
                    this.state.builds[item.build].buildFinished = new Date();

                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerFactory.uniqueBuild.completed[item.build]
                    );
                }

                if (this.modalOpened) {
                    this._renderUniqueBuildOverviewModal();
                }
            }
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function updateUniqueBuildsTimeSpans () {
            if (!this.modalOpened) {
                return;
            }

            $.each(this.state.builds, (function updateUniqueBuildTimeSpans (build, data) {
                if (!data.unlocked) {
                    return;
                }

                data.progress === BUILDS[build].parts.length
                    ? $('#beer-factory__unique-build__lifetime__' + build).text(
                            this.numberFormatter.formatTimeSpan(new Date() - data.buildFinished, true)
                        )
                    : $('#beer-factory__unique-build__duration__' + build).text(
                            this.numberFormatter.formatTimeSpan(new Date() - data.buildStarted, true)
                        );
            }).bind(this));
        }).bind(this));

        ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).addModifier(
            'BeerFactory_UniqueBuild',
            () => this.getMultiplier('djed')
        );
    }

    UniqueBuilds.prototype.unlockBuild = function (build) {
        this.achievementController.checkAchievement(
            this.achievementController.getAchievementStorage().achievements.beerFactory.uniqueBuild.unlocked[build]
        );

        this.state.builds[build].unlocked     = true;
        this.state.builds[build].buildStarted = new Date();
    };

    UniqueBuilds.prototype.initUniqueBuildEventListener = function () {
        $('#beer-factory__unique-builds__enter').on('click', this._renderUniqueBuildOverviewModal.bind(this));
    };

    UniqueBuilds.prototype._renderUniqueBuildOverviewModal = function () {
        const modal = $('#beer-factory__unique-builds-modal');

        $('#beer-factory__unique-builds-modal__body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__unique-builds-modal__body-template'),
                {
                    builds: Object.entries(this.state.builds)
                        .filter(build => build[1].unlocked)
                        .map(
                            build => {
                                const state = build[1].progress === BUILDS[build[0]].parts.length
                                    // finished build
                                    ? translator.translate(
                                        'beerFactory.uniqueBuilds.state.finished',
                                        {
                                            __BUILD_DURATION__: this.numberFormatter.formatTimeSpan(
                                                    build[1].buildFinished - build[1].buildStarted,
                                                    true
                                                ),
                                            __LIFETIME__: `<span id="beer-factory__unique-build__lifetime__${build[0]}">${
                                                this.numberFormatter.formatTimeSpan(
                                                    new Date() - build[1].buildFinished,
                                                    true
                                                )}</span>`,
                                        }
                                    )
                                    // active build
                                    : translator.translate(
                                        'beerFactory.uniqueBuilds.state.constructing',
                                        {
                                            __BUILD_DURATION__: `<span id="beer-factory__unique-build__duration__${build[0]}">${
                                                this.numberFormatter.formatTimeSpan(
                                                    new Date() - build[1].buildStarted,
                                                    true
                                                )}</span>`,
                                        }
                                    );

                                return $.extend(
                                    true,
                                    {
                                        key:         build[0],
                                        classes:     this.getSVGContainerClass(build[0]),
                                        state:       state,
                                        title:       translator.translate(`beerFactory.uniqueBuilds.${build[0]}.title`),
                                        nextStep:    build[1].inQueue === null && build[1].progress < BUILDS[build[0]].parts.length,
                                        queuedKey:   build[1].inQueue ? BUILDS[build[0]].parts[build[1].inQueue - 1].key : false,
                                        completed:   build[1].progress === BUILDS[build[0]].parts.length,
                                        spells:      build[1].spells,
                                        selectSpell: build[1].spells.length === 0,
                                    },
                                    build[1]
                                )
                            }
                        ),
                }
            )
        );

        $.each($('.beer-factory__unique-build__svg'), function () {
            $(this).html($('#' + $(this).data('svgKey')).html());
        });

        this._initModalEventListener();
        modal.modal('show');
        this.modalOpened = true;

        modal.off('hidden.bs.modal');
        modal.on('hidden.bs.modal', (function () {
            this.modalOpened = false;
        }).bind(this));
    };

    UniqueBuilds.prototype._initModalEventListener = function () {
        const uniqueBuilds = this,
              container    = $('#beer-factory__unique-builds-modal__body');

        container.find('.beer-factory__unique-build__next-step-tooltip').tooltip({
            title: function renderUniqueBuildsRequiredMaterialsTooltip() {
                const build = $(this).closest('.row').data('buildKey');

                return Mustache.render(
                    TemplateStorage.get('beer-factory__unique-builds__required-materials-tooltip'),
                    {
                        buildKey:  build,
                        stageKey:  BUILDS[build].parts[uniqueBuilds.state.builds[build].progress].key,
                        materials: Object
                            .entries(BUILDS[build].parts[uniqueBuilds.state.builds[build].progress].materials)
                            .map(material => {
                                return {
                                    name:   translator.translate(`beerFactory.material.${material[0]}`),
                                    amount: uniqueBuilds.numberFormatter.formatInt(material[1]),
                                }
                            }),
                    }
                );
            }
        });

        container.find('.beer-factory__unique-build__construct').on('click', (function constructUniqueBuildNextStep (event) {
            const build = $(event.target).closest('.row').data('buildKey');
            $(event.target).closest('.beer-factory__unique-build__next-step-tooltip').tooltip('dispose');

            if (this.state.builds[build].inQueue !== null ||
                this.state.builds[build].progress === BUILDS[build].parts.length
            ) {
                return;
            }

            let requiredBaseMaterials = [];

            $.each(
                BUILDS[build].parts[this.state.builds[build].progress].materials,
                function mapRequiredMaterials(material, amount) {
                    requiredBaseMaterials.push({
                        name:      translator.translate('beerFactory.material.' + material),
                        key:       material,
                        required:  amount,
                        delivered: 0,
                    });
                }
            );

            if (this.buildQueue.addToQueue(
                BUILD_QUEUE__UNIQUE_BUILD,
                {
                    build: build,
                    stage: this.state.builds[build].progress + 1,
                },
                requiredBaseMaterials
            )
            ) {
                this.state.builds[build].inQueue = this.state.builds[build].progress + 1;
                this._renderUniqueBuildOverviewModal();
            }
        }).bind(this));

        container.find('.beer-factory__unique-build__select-spell').on('click', (function showSelectSpellModal (event) {
            this.showAltarEquipDialog($(event.target).closest('.row').data('buildKey'), 0);
        }).bind(this));

        this._initSpellPopover(container.find('.beer-factory__slot'), false);
    };

    UniqueBuilds.prototype.getSVGContainerClass = function (build) {
        let classes = [];

        for (let i = 0; i <= this.state.builds[build].progress; i++) {
            classes.push('unique-builds__container-progress-' + i);
        }

        if (this.state.builds[build].inQueue !== null) {
            classes.push('unique-builds__container-work-' + this.state.builds[build].inQueue);
            classes.push('unique-builds__container-progress-' + this.state.builds[build].inQueue);
        }

        return classes.join(' ');
    };

    /**
     * Show the dialog to equip an altar of an unique build
     *
     * @param {string} build      key of the unique build
     * @param {int}    altarIndex The altar to edit
     */
    UniqueBuilds.prototype.showAltarEquipDialog = function (build, altarIndex) {
        const modal           = $('#equip-modal'),
              modalBody       = $('#equip-modal__body');

        modalBody.html(
            Mustache.render(
                TemplateStorage.get('beer-factory__unique-builds__equip-altar-modal__body-template'),
                {
                    availableSpells: this.state.spells,
                }
            )
        );

        modal.find('.modal-title').text(translator.translate('beerFactory.uniqueBuilds.spell.title'));

        const availableSpells = modalBody.find('.beer-factory__slot');
        this._initSpellPopover(availableSpells);

        availableSpells.on('click', (function (event) {
            this.state.builds[build].spells[altarIndex] = $(event.target)
                .closest('.beer-factory__slot')
                .data('spell');

            modal.modal('hide');
            this._renderUniqueBuildOverviewModal();

            this.gameEventBus.emit(EVENTS.BEER_FACTORY.UNIQUE_BUILD.UPDATED);

            ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).triggerModifierChange('BeerFactory_UniqueBuild');
        }).bind(this));

        const parentModal = $('#beer-factory__unique-builds-modal');

        parentModal.addClass('modal__dynamic-content__lock');
        parentModal.modal('hide');

        modal.modal('show');
        modal.on('hide.bs.modal.openParent', (function () {
            parentModal.modal('show');
            parentModal.removeClass('modal__dynamic-content__lock');

            modal.off('hide.bs.modal.openParent');
        }).bind(this));
    };

    UniqueBuilds.prototype._initSpellPopover = function (elements, showClickHint = true) {
        elements.popover({
            content: function () {
                return Mustache.render(
                    TemplateStorage.get('beer-factory__unique-builds__spell-popover-template'),
                    {
                        spell:     $(this).data('spell'),
                        clickHint: showClickHint
                    }
                );
            }
        });
    };

    /**
     * Get the multiplier for a given spell
     *
     * @param {string} spell The key of the requested spell
     *
     * @returns {number}
     */
    UniqueBuilds.prototype.getMultiplier = function (spell) {
        const multiplierMap = {
            ankh: 2,
            djed: 4,
            was:  2,
        };

        return Math.pow(
            multiplierMap[spell],
            Object.values(this.state.builds).reduce(
                (amount, build) => build.spells.filter(equip => equip === spell).length + amount,
                0
            )
        );
    };

    beerFactoryGame.UniqueBuilds = UniqueBuilds;
})(BeerFactoryGame);

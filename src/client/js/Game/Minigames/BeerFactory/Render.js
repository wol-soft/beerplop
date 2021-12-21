(function(beerFactoryGame) {
    'use strict';

    // store UI state to recreate on redraw
    Render.prototype._isOverlayVisible       = false;
    Render.prototype.expandedFactoryViews    = {};
    Render.prototype.visibleExtensionPopover = null;
    Render.prototype.buildQueueExpanded      = true;

    Render.prototype.state       = null;
    Render.prototype.stock       = null;
    Render.prototype.buildQueue  = null;
    Render.prototype.factory     = null;
    Render.prototype.upgrade     = null;
    Render.prototype.cache       = null;
    Render.prototype.trader      = null;
    Render.prototype.manager     = null;
    Render.prototype.uniqueBuild = null;

    Render.prototype.numberFormatter       = null;
    Render.prototype.achievementController = null;
    Render.prototype.flyoutText            = null;

    function Render(
        numberFormatter,
        state,
        stock,
        buildQueue,
        upgrade,
        factory,
        cache,
        achievementController,
        flyoutText,
        trader,
        manager,
        uniqueBuild,
    ) {
        this.state       = state;
        this.stock       = stock;
        this.buildQueue  = buildQueue;
        this.upgrade     = upgrade;
        this.factory     = factory;
        this.cache       = cache;
        this.trader      = trader;
        this.manager     = manager;
        this.uniqueBuild = uniqueBuild;

        this.numberFormatter       = numberFormatter;
        this.achievementController = achievementController;
        this.flyoutText            = flyoutText;

        (new Beerplop.OverlayController()).addCallback(
            'beer-factory-overlay',
            this.renderOverlay.bind(this),
            () => {
                this._isOverlayVisible = false;
                this.destroyPopover();
                $('#beer-factory-container').html('');
            },
        );
    }

    /**
     * Render the main overlay for beer factories including all partial content containers
     *
     * @private
     */
    Render.prototype.renderOverlay = function () {
        this._isOverlayVisible = true;

        this.stock.resetProductionBalanceDOMCache();

        $('#beer-factory-container').html(
            Mustache.render(
                TemplateStorage.get('beer-factory-template'),
                {
                    stockTable :            this.renderStockTable(),
                    factoriesMap:           this.renderFactoriesMap(),
                    buildQueue:             this.renderBuildQueue(),
                    buildQueueExpanded:     this.buildQueueExpanded,
                    hideCompletedMaterials: this.state.getState().hideCompletedMaterials,
                }
            )
        );

        this.buildQueue.initBuildQueueEventListener();
        this.stock.initStockTableEventListener();
        this._initFactoriesMapEventListener();

        $('.build-queue__toggle-queue').on('click', (function toggleBuildQueueVisibility(event) {
            const element = $(event.target).find('i');

            element.toggleClass('fa-angle-double-right fa-angle-double-left');
            $('.build-queue__content-container').animate({width: 'toggle'});

            this.buildQueueExpanded = element.hasClass('fa-angle-double-right');
        }).bind(this));

        $('#beer-factory__build-queue__hide-completed-materials').on('change', (function (event) {
            this.state.getState().hideCompletedMaterials = $(event.target).is(':checked');

            $('#beer-factory__build-queue').html(this.renderBuildQueue());
            this.buildQueue.initBuildQueueEventListener();
        }).bind(this));

        $('#build-queue__queued-jobs').text(this.buildQueue.getQueueLength());
        $('#build-queue__max-jobs').text(this.state.getState().maxActionsInQueue);
    };

    Render.prototype.updateStockTable = function () {
        $('#beer-factory__stock').html(this.renderStockTable());

        this.stock.resetProductionBalanceDOMCache();
        this.stock.initStockTableEventListener();
    };

    Render.prototype.renderBuildQueue = function () {
        const now                    = new Date(),
              hideCompletedMaterials = this.state.getState().hideCompletedMaterials;

        return Mustache.render(
            TemplateStorage.get('beer-factory__build-queue-template'),
            {
                buildQueue: this.state.getBuildQueue()
                    .filter(item => !item.hiddenJob)
                    .map((function createQueueItemList(item, id) {
                        const progress = item.deliveredItems / item.requiredItems * 100;
                        return $.extend(
                            // start with an empty object to avoid modifications of the item object! (compare issue #78)
                            {},
                            item,
                            {
                                id:                id,
                                label:             this.buildQueue.getQueueJobLabel(item.action, item.item),
                                progress:          progress,
                                collapsed:         !!item.collapsed,
                                formattedProgress: this.numberFormatter.format(Math.min(progress, 99.9)),
                                running:           this.numberFormatter.formatTimeSpan(now - item.startedAt, true),
                                details:           item.action === BUILD_QUEUE__UPGRADE
                                    ? '<i>' + translator.translate(`beerFactory.upgrade.${item.item.factory}.${item.item.upgrade}.${item.item.level}.effect`) + '</i>'
                                    : false,
                                materials:         item.materials.map((function createQueueItemRequiredMaterialsList(material) {
                                    const completed = material.delivered >= material.required;

                                    return $.extend(
                                        {
                                            completed: completed,
                                            hidden:    completed && hideCompletedMaterials,
                                        },
                                        material,
                                        {
                                            required:       this.numberFormatter.formatInt(material.required),
                                            delivered:      this.numberFormatter.formatInt(material.delivered),
                                            materialPaused: material.paused,
                                        },
                                    );
                                }).bind(this))
                            }
                        );
                    }
                ).bind(this))
            }
        );
    };

    Render.prototype.renderStockTable = function () {
        const state = this.state.getState();
        const sections = Object.keys(state.materials)
            .map(
                (function createMaterialsList(material) {
                    return $.extend(
                        {
                            key:  material,
                            name: translator.translate('beerFactory.material.' + material),
                        },
                        this.state.getMaterial(material),
                        MATERIAL_DATA_CONST[material] || {},
                        {
                            amount:   this.numberFormatter.formatInt(this.state.getMaterial(material).amount),
                            capacity: this.numberFormatter.formatInt(this.stock.getMaterialStockCapacity(material)),
                        }
                    );
                }).bind(this)
            ).reduce(
                (function groupMaterialsBySection(groupedMaterials, material) {
                    let key = material.section || MATERIAL_SECTION__BASE;

                    if (!groupedMaterials[key]) {
                        groupedMaterials[key] = {
                            key: key,
                            materials: [],
                            collapsed: this.state.getState().collapsedMaterialSections[key],
                        };
                    }

                    groupedMaterials[key].materials.push(material);

                    return groupedMaterials;
                }).bind(this),
                {}
            );

        return Mustache.render(
            TemplateStorage.get('beer-factory__stock-template'),
            {
                hasFactoryExtensions: state.hasFactoryExtensions,
                deliveryPreferQueue:  state.deliveryPreferQueue,
                currentStock:         this.numberFormatter.formatInt(this.stock.amount),
                deliveryCapacity:     this.numberFormatter.formatInt(this.cache.getDeliverCapacity()),
                sections:             Object.values(sections),
            }
        )
    };

    Render.prototype.renderFactoriesMap = function () {
        const queuedBuilds = this.buildQueue.getQueuedBuilds();
        const sections = Object.keys(this.state.getFactories()).map((function createFactoriesList(factoryKey) {
            const upgradePaths = this.upgrade.getUpgradePaths(factoryKey),
                  factory      = this.state.getFactory(factoryKey),
                  managers     = this.manager.getFactoryManagers(factoryKey);

            return $.extend(
                {
                    key:                factoryKey,
                    name:               translator.translate('beerFactory.factory.' + factoryKey),
                    queuedBuilds:       queuedBuilds[factoryKey] || false,
                    queuedBuildsPlural: queuedBuilds[factoryKey] > 1,
                    expanded:           this.expandedFactoryViews[factoryKey],
                    level:              this.numberFormatter.romanize(
                        Object.values(factory.upgrades).reduce((a, b) => a + b, 0)
                    ),
                },
                factory,
                FACTORY_DATA_FIX[factoryKey],
                // manager data
                {
                    managersEnabled: this.state.getFactory('academy').upgrades.double >= 3,
                    hiredManagers:   managers.length,
                    managerLevel:    managers.reduce((level, manager) => level + manager.level, 0),
                },
                {
                    description:   this._descriptionDecorator(factoryKey),
                    maxProduction: this.numberFormatter.formatInt(
                        this.cache.getProducedAmount(factoryKey)
                    ),
                    producedMaterials: factory.production
                        ? Object.entries(factory.production).map((function (entry) {
                            return {
                                name:       translator.translate('beerFactory.material.' + entry[0]),
                                percentage: this.numberFormatter.formatInt(
                                    entry[1] / this.cache.getProducedMaterialCache(factoryKey).length * 100
                                ),
                            };
                        }).bind(this))
                        : false,
                    amount:           this.numberFormatter.formatInt(factory.amount),
                    upgradePaths:     upgradePaths,
                    hasUpgradePaths:  upgradePaths.length > 0,
                    upgradeAvailable: upgradePaths.length > 0 &&
                        upgradePaths.reduce(
                            (availablePath, upgradePath) => availablePath || !(upgradePath.completed || upgradePath.locked),
                            false
                        ),
                    materialMissing: this.factory.hasFactoryExtensionMissingMaterials(factoryKey),
                    hasExtensions:   (factory.extensions || []).length > 0,
                    extensions:      (factory.extensions || []).map((function (extensionKey) {
                        let proxiedExtensionKey = this.state.getState().proxyExtension[extensionKey]
                                ? this.state.getState().proxyExtension[extensionKey].extension
                                : extensionKey;

                        if (!proxiedExtensionKey) {
                            proxiedExtensionKey = extensionKey;
                        }

                        let data = {
                            storageLimit:             this.state.getState().extensionStorageCapacity,
                            key:                      extensionKey,
                            isProxyExtension:         EXTENSIONS[extensionKey].type === EXTENSION_TYPE__PROXY,
                            isEquippedProxyExtension: EXTENSIONS[extensionKey].type === EXTENSION_TYPE__PROXY
                                && this.state.getState().proxyExtension[extensionKey].extension,
                            isProjectQueueExtension:  EXTENSIONS[proxiedExtensionKey].hasProjectQueue,
                            queueEntries: EXTENSIONS[proxiedExtensionKey].hasProjectQueue
                                ? this.state.getExtensionStorage(proxiedExtensionKey).queue.length
                                : 0,
                            proxyKey:        proxiedExtensionKey,
                            activeExtension: false,
                            name:            translator.translate(`beerFactory.extension.${extensionKey}`),
                            description:     translator.translate(`beerFactory.extension.${extensionKey}.description`),
                        };

                        if (proxiedExtensionKey) {
                            const extensionStorage = this.state.getExtensionStorage(extensionKey);

                            data = $.extend(
                                true,
                                data,
                                {
                                    activeExtension: true,
                                    storage:         extensionStorage.stored,
                                    materials:       extensionStorage.materials,
                                    paused:          extensionStorage.paused,
                                }
                            );
                        }

                        return $.extend(
                            data,
                            EXTENSIONS[extensionKey],
                            {
                                consumes: proxiedExtensionKey === null ? [] : Object
                                    .entries(this.cache.getFactoryExtensionConsumption(proxiedExtensionKey))
                                    .map((function (entry) {
                                        const missingMaterials = this.factory.getMissingMaterials(extensionKey);

                                        return {
                                            material:    translator.translate('beerFactory.material.' + entry[0]),
                                            amount:      entry[1] > 0 ? this.numberFormatter.formatInt(entry[1]) : '-',
                                            materialKey: entry[0],
                                            missing:     !!missingMaterials && missingMaterials[entry[0]] > MISSING_MATERIAL_BUFFER,
                                        };
                                    }).bind(this)),
                                produces: proxiedExtensionKey === null ? [] : Object
                                    .entries(this.cache.getFactoryExtensionProduction(proxiedExtensionKey))
                                    .map((function (entry) {
                                        return {
                                            material: translator.translate('beerFactory.material.' + entry[0]),
                                            amount:   this.numberFormatter.formatInt(entry[1].amount * entry[1].boost),
                                        };
                                    }).bind(this)),
                            }
                        );
                    }).bind(this)),
                },
            );
        }).bind(this))
        // filter out all locked factories
        .filter((factory) => factory.enabled)
        .reduce(function groupFactoriesBySection(groupedFactories, factory) {
            let key = 0;

            if (factory.section) {
                if (!groupedFactories[factory.section]) {
                    groupedFactories[factory.section] = {key: factory.section, factories: []};
                }
                key = factory.section;
            }

            groupedFactories[key].factories.push(factory);

            return groupedFactories;
        }, {0: {key: null, factories: []}});

        return Mustache.render(
            TemplateStorage.get('beer-factory__factories-map-template'),
            {
                sections: Object.values(sections),
            }
        )
    };

    /**
     * Adds a description to the expanded view of a factory
     *
     * @param {string} factory The key of the requested factory
     *
     * @return {string}
     *
     * @private
     */
    Render.prototype._descriptionDecorator = function (factory) {
        let description = translator.translate(`beerFactory.factory.${factory}.description`);

        switch (factory) {
            case 'lodge':
                const lodge = this.state.getFactory('lodge');

                let key  = 1,
                    data = {
                        __PRODUCTION_BOOST__: this.numberFormatter.formatInt(
                            (Math.pow(lodge.productionMultiplier, lodge.amount) - 1) * 100,
                        ),
                    };

                if (lodge.upgrades.comfort) {
                    data['__TRANSPORT_BOOST__'] = this.numberFormatter.formatInt(
                        (Math.pow(1 + lodge.upgrades.comfort * 0.05, lodge.amount) - 1) * 100,
                    );

                    key = 2;
                }

                description += '</p><p>' + translator.translate('beerFactory.factory.lodge.boost.' + key, data);

                break;
            case 'builder':
                const reductionMapping = [
                    {
                        key:         BUILD_QUEUE__BUILD,
                        translation: 'buildings',
                        diversify:   0,
                    },
                    {
                        key:         BUILD_QUEUE__UPGRADE,
                        translation: 'upgrades',
                        diversify:   1,
                    },
                    {
                        key:         BUILD_QUEUE__CONSTRUCT_SLOT,
                        translation: 'slots',
                        diversify:   2,
                    },
                ];

                $.each(reductionMapping, (function (index, reduction) {
                    if (this.state.getFactory('builder').upgrades.diversify >= reduction.diversify) {
                        description += '</p><p>' + translator.translate(
                            'beerFactory.factory.builder.boost.' + reduction.translation,
                            {
                                __BOOST__: this.numberFormatter.format(
                                    (1 - this.factory.getBuilderReduction(reduction.key)) * 100
                                )
                            }
                        );
                    }
                }).bind(this));

                break;
            case 'tradingPost':
                if (this.state.getFactory('tradingPost').amount > 0) {
                    description += '</p><p class="clearfix">' +
                        '<button id="beer-factory__trading-route-statistics"' +
                               ' type="button"' +
                               ' class="btn btn-raised btn-secondary float-left">' +
                            translator.translate('stats') +
                        '</button>' +
                        '<button id="beer-factory__manage-trading-routes"' +
                               ' type="button"' +
                               ' class="btn btn-raised btn-secondary float-right">' +
                            translator.translate('beerFactory.tradingRoute.enterManage') +
                        '</button>';
                }

                break;
            case 'engineer':
                description += '</p><p class="clearfix">' +
                    '<button id="beer-factory__unique-builds__enter"' +
                           ' type="button"' +
                           ' class="btn btn-raised btn-secondary float-right">' +
                        translator.translate('beerFactory.uniqueBuilds.enter') +
                    '</button>';

                break;
            case 'backRoom':
                if (this.state.getFactory('backRoom').upgrades.lobbyist > 0) {
                    description += '</p><p class="clearfix">' +
                        '<button id="beer-factory__back-room__enter"' +
                               ' type="button"' +
                               ' class="btn btn-raised btn-secondary float-right">' +
                            translator.translate('beerFactory.backRoom.enter') +
                        '</button>';
                }

                break;
        }

        return description;
    };

    /**
     * Adds all event listeners required for the factories map
     * TODO: detach popovers/tooltips to avoid console errors
     * TODO: split up
     *
     * @private
     */
    Render.prototype._initFactoriesMapEventListener = function () {
        const container = $('#beer-factory__factories-map');

        $.each($('.beer-factory__building__svg'), function addSVGImageToFactoryContainer() {
            $(this).html($('#' + $(this).data('svgKey')).html());
        });

        container.find('.beer-factory__manual-harvest').on('click', (function manualHarvestItem(event) {
            const factory       = $(event.target).closest('.beer-factory__building-container').data('factory'),
                  material      = this.factory.getProducedMaterial(factory),
                  addedMaterial = this.stock.addToStock(
                      material,
                      Math.ceil(this.cache.getProducedAmount(factory) / 6) + 1,
                      'Manual harvest'
                  );

            if (addedMaterial > 0) {
                if (material === 'wood' &&
                    this.state.getMaterial('wood').amount > 10 &&
                    !this.state.getFactory('wood').factory
                ) {
                    $('#beer-factory__wood').addClass('beer-factory__factory-enabled card');
                    this.state.getFactory('wood').factory = true;

                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked.wood
                    );
                }

                this.flyoutText.spawnFlyoutText(
                    '+ ' + this.numberFormatter.formatInt(addedMaterial) + ' ' + translator.translate('beerFactory.material.' + material),
                    event.clientX,
                    event.clientY - 25,
                    'manual-plop',
                    'manual-plop-top',
                    1000,
                    1500
                );
            }
        }).bind(this));

        container.find('.beer-factory__queue-build').on('click', (function queueFactoryBuild(event) {
            $(event.target).closest('.beer-factory__queue-build').tooltip('hide');

            const factory = $(event.target).data('factory');

            if (this.buildQueue.addToQueue(
                    BUILD_QUEUE__BUILD,
                    factory,
                    this.factory.getRequiredMaterialsForNextFactory(factory)
                )
            ) {
                this.updateFactoriesMap();
            }
        }).bind(this));

        container.find('.collapse').on(
            'show.bs.collapse hide.bs.collapse',
            (function toggleFactoryDetailViewVisibility(event) {
                const container = $(event.target).closest('.beer-factory__building-container'),
                      icon      = container.find('.beer-factory__toggle-collapsable-body__icon');

                icon.toggleClass('fa-angle-double-down fa-angle-double-up');

                this.expandedFactoryViews[container.data('factory')] = icon.hasClass('fa-angle-double-up');
            }).bind(this),
        );

        container.find('.beer-factory__extension__manage-queue').on(
            'click',
            (function openFactoryExtensionQueueProjectManagementModal(event) {
                (new BeerFactoryGame.FactoryExtensionProjectQueueManagementModal(this.state)).render(
                    $(event.target).data('extensionKey'),
                );
            }).bind(this),
        );

        container.find('.beer-factory__extension__toggle-pause').on(
            'click',
            (function toggleFactoryExtensionProductionPause(event) {
                const button             = $(event.target).closest('.beer-factory__extension__toggle-pause'),
                      extension          = button.data('extension'),
                      factory            = button.closest('.beer-factory__building-container').data('factory'),
                      extensionContainer = button.closest('.beer-factory__building-container__extension'),
                      extensionStorage   = this.state.getExtensionStorage(extension);

                extensionStorage.paused = !extensionStorage.paused;

                this.factory.hasFactoryExtensionMissingMaterials(factory)
                    ? this.getFactoryMissingMaterialHintElement(factory).removeClass('d-none')
                    : this.getFactoryMissingMaterialHintElement(factory).addClass('d-none');

                extensionStorage.paused
                    ? extensionContainer.addClass('extension-paused')
                    : extensionContainer.removeClass('extension-paused');

                button.toggleClass('btn-info btn-success');
            }).bind(this),
        );

        container.find('.beer-factory__upgrade').on('click', (function initFactoryUpgrade(event) {
            const upgradeContainer = $(event.target).closest('.beer-factory__upgrade'),
                  factory          = upgradeContainer.data('factory'),
                  upgrade          = upgradeContainer.data('upgrade'),
                  requestedLevel   = this.state.getFactory(factory).upgrades[upgrade] + 1;

            if (!this.upgrade.isUpgradePathAvailable(factory, upgrade, requestedLevel)) {
                return;
            }

            const jobAdded = this.buildQueue.addToQueue(
                BUILD_QUEUE__UPGRADE,
                {
                    factory: factory,
                    upgrade: upgrade,
                    level:   requestedLevel,
                },
                this.upgrade.getRequiredMaterialsForUpgrade(factory, upgrade, requestedLevel),
            );

            if (jobAdded) {
                this.updateFactoriesMap();
            }
        }).bind(this));

        container.find('.beer-factory__reached-upgrades').on('click', (function showBeerFactoryUpgradesModal(event) {
            (new BeerFactoryGame.ReachedUpgradesModal(this.state)).render(
                $(event.target).closest('.beer-factory__building-container').data('factory'),
            );
        }).bind(this));

        container.find('.beer-factory__manage-managers').on('click', (function showManagerManagementModal(event) {
            this.manager.showManagerManagementModal(
                $(event.target).closest('.beer-factory__building-container').data('factory'),
            );
        }).bind(this));

        const render = this;

        const tooltips = container.find('.beer-factory__material-tooltip:not(.d-none)');
        tooltips.tooltip({
            title: function renderRequredMaterialsTooltip() {
                const element           = $(this);
                let   requiredMaterials = [];

                switch (element.data('jobType')) {
                    case 'factory':
                        requiredMaterials = render.factory.getRequiredMaterialsForNextFactory(
                            element.closest('.beer-factory__building-container').data('factory')
                        );
                        break;
                    case 'upgrade':
                        const upgradeContainer = element.closest('.beer-factory__upgrade'),
                              factory          = upgradeContainer.data('factory'),
                              upgrade          = upgradeContainer.data('upgrade');

                        requiredMaterials = render.upgrade.getRequiredMaterialsForUpgrade(
                            factory,
                            upgrade,
                            render.state.getFactory(factory).upgrades[upgrade] + 1,
                        );
                        break;
                }

                return Mustache.render(
                    TemplateStorage.get('beer-factory__required-materials-tooltip-template'),
                    {
                        materials: Object.values(requiredMaterials).map(function mapMaterialProduction(material) {
                            return {
                                name:   material.name,
                                amount: render.numberFormatter.formatInt(material.required),
                            }
                        }),
                    }
                );
            }
        });

        container.find('.beer-factory__building__action-hint').on('click', function (event) {
            $(event.target)
                .closest('.factory-component')
                .find('.beer-factory__toggle-collapsable-body')
                .trigger('click');
        });

        $('#beer-factory__back-room__enter').on(
            'click',
            () => (new BeerFactoryGame.BackRoomModal(this.state, this.cache)).render(),
        );

        this._initFactoryExtensionPopover();
        this.factory.initProxyFactoryExtensionEquipEventListener();
        this.trader.initTradingRouteEventListener();
        this.uniqueBuild.initUniqueBuildEventListener();
    };

    Render.prototype.destroyPopover = function () {
        const container = $('#beer-factory__factories-map');

        // destroy popovers and tooltips
        container.find('.beer-factory__material-tooltip:not(.d-none)').tooltip('dispose');
        container.find('.beer-factory__extension-popover').popover('dispose');
    };

    Render.prototype.updateFactoriesMap = function () {
        this.destroyPopover();

        $('#beer-factory__factories-map').html(this.renderFactoriesMap());
        this._initFactoriesMapEventListener();
    };

    Render.prototype.getFactoryMissingMaterialHintElement = function (factory) {
        return $($('#beer-factory__' + factory).find('.beer-factory__building__missing-resource__head')[0]);
    };

    /**
     * Init all event listeners to display a factory extension popover
     *
     * @private
     */
    Render.prototype._initFactoryExtensionPopover = function () {
        const render          = this,
              state           = this.state,
              numberFormatter = this.numberFormatter,
              popoverElements = $('#beer-factory__factories-map').find('.beer-factory__extension-popover');

        popoverElements.popover({
            content: function () {
                const extensionKey        = $(this).data('extensionKey'),
                      factoryKey          = $(this).closest('.beer-factory__building-container').data('factory'),
                      proxiedExtensionKey = state.getState().proxyExtension[extensionKey]
                          ? state.getState().proxyExtension[extensionKey].extension
                          : extensionKey;

                let data = {
                    extension:       extensionKey,
                    activeExtension: false,
                };

                if (proxiedExtensionKey) {
                    data = $.extend(
                        true,
                        data,
                        {
                            activeExtension:   true,
                            isProxyExtension:  state.getState().proxyExtension[extensionKey],
                            mirroredExtension: translator.translate(`beerFactory.extension.${proxiedExtensionKey}`),
                            storageCapacity:   numberFormatter.formatInt(
                                render.factory.getFactoryExtensionStorageCapacity(factoryKey, proxiedExtensionKey)
                            ),
                            storedItems: numberFormatter.formatInt(
                                state.getExtensionStorage(extensionKey).stored
                            ),
                            storage: Object.entries(state.getExtensionStorage(extensionKey).materials).map(
                                (function (entry) {
                                    return {
                                        name:   translator.translate('beerFactory.material.' + entry[0]),
                                        amount: numberFormatter.formatInt(entry[1]),
                                        key:    entry[0],
                                    };
                                }).bind(this)
                            ),
                            listProductionPerSecond: EXTENSIONS[proxiedExtensionKey].productionType === EXTENSION_PRODUCTION__DIRECT,
                            production: EXTENSIONS[proxiedExtensionKey].productionType === EXTENSION_PRODUCTION__DIRECT
                                ? Object.entries(render.factory.getAverageFactoryExtensionProduction(extensionKey)).map(
                                    function (entry) {
                                        return {
                                            key:    entry[0],
                                            name:   translator.translate('beerFactory.material.' + entry[0]),
                                            amount: state.getExtensionStorage(extensionKey).paused
                                                ? 0
                                                : numberFormatter.formatInt(entry[1]),
                                        };
                                    }
                                )
                                : false,
                            // TODO: show like in build queue. CONST class remove
                            progressClass: 'beer-factory__extension-popover__production-progress',
                            // if the production is project-based and a project is running get the production progress
                            projectProgress: EXTENSIONS[proxiedExtensionKey].productionType === EXTENSION_PRODUCTION__PROJECT
                                                && state.getExtensionStorage(extensionKey).project
                                ? Object.entries(state.getExtensionStorage(extensionKey).project.materials).map(
                                    function (entry) {
                                        return {
                                            name:      translator.translate('beerFactory.material.' + entry[0]),
                                            required:  numberFormatter.formatInt(entry[1].required),
                                            delivered: numberFormatter.formatInt(entry[1].delivered),
                                            key:       entry[0],
                                        };
                                    }
                                )
                                : false,
                            runningProject: EXTENSIONS[proxiedExtensionKey].productionType === EXTENSION_PRODUCTION__PROJECT
                                && state.getExtensionStorage(extensionKey).project,
                            // project queue data
                            hasQueue:     EXTENSIONS[proxiedExtensionKey].hasProjectQueue,
                            queueEntries: EXTENSIONS[proxiedExtensionKey].hasProjectQueue
                                ? state.getExtensionStorage(proxiedExtensionKey).queue.length
                                : 0
                        }
                    );
                }

                return Mustache.render(TemplateStorage.get('beer-factory__extension-popover-template'), data);
            }
        });

        popoverElements.on('shown.bs.popover', (function (event) {
            this.visibleExtensionPopover = $(event.target).data('extensionKey');
        }).bind(this));

        popoverElements.on('hidden.bs.popover', (function () {
            this.visibleExtensionPopover = null;
        }).bind(this));
    };

    /**
     * Get all variables required to render a notification for a project handled by a factory extension
     *
     *  @param {string} extensionKey
     * @param {object} data
     *
     * @return {object}
     */
    Render.prototype.getFactoryExtensionProjectNotificationVariables = function (extensionKey, data) {
        switch (extensionKey) {
            case 'managerAcademy': return {
                __FACTORY__: translator.translate(
                    `beerFactory.${data.isExtension ? 'extension' : 'factory'}.${data.key}`
                ),
            };
        }
    }

    Render.prototype.isOverlayVisible = function () {
        return this._isOverlayVisible;
    };

    Render.prototype.getVisibleExtensionPopover = function() {
        return this.visibleExtensionPopover;
    };

    beerFactoryGame.Render = Render;
})(BeerFactoryGame);

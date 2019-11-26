(function(beerFactoryGame) {
    'use strict';

    const FACTORY_ENABLE_LIMITS = {
        storage: {
            wood: 3,
        },
        transport: {
            wood: 4,
            storage: 3,
        },
        stone: {
            wood: 4,
            storage: 3,
        },
        iron: {
            wood: 10,
            stone: 5,
        },
        lodge: {
            iron: 5,
        },
        mine: {
            wood: 15,
            iron: 8,
        },
        queue: {
            transport: 10,
            storage: 10,
            wood: 13,
            stone: 12,
            iron: 7,
        },
        academy: {
            mine: 4,
        },
        builder: {
            wood: 20,
            stone: 15,
        },
        tradingPost: {
            storage: 20,
            transport: 20,
            academy: 5,
        },
        engineer: {
            stone: 25,
        },
        backRoom: {
            tradingPost: 5,
        },
    };

    BuildQueue.prototype.state                 = null;
    BuildQueue.prototype.stock                 = null;
    BuildQueue.prototype.render                = null;
    BuildQueue.prototype.cache                 = null;
    BuildQueue.prototype.upgrade               = null;
    BuildQueue.prototype.gameState             = null;
    BuildQueue.prototype.achievementController = null;
    BuildQueue.prototype.gameEventBus          = null;

    function BuildQueue(state, stock, cache, upgrade, gameState, achievementController, gameEventBus) {
        this.state                 = state;
        this.stock                 = stock;
        this.cache                 = cache;
        this.upgrade               = upgrade;
        this.gameState             = gameState;
        this.achievementController = achievementController;
        this.gameEventBus          = gameEventBus;

        assetPromises['modals'].then(() =>
            $('#beer-factory__build-queue-item__delete').on('click', (function confirmBuildQueueItemDeletion(event) {
                const queueItemId = $(event.target).data('itemId'),
                      queueItem   = this.state.getBuildQueueItem(queueItemId);

                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.delete
                );

                if (queueItem.deliveredItems / queueItem.requiredItems >= 0.9) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.delete90
                    );
                }

                this._deleteItemFromBuildQueue(queueItemId);
            }).bind(this))
        );

        this.gameEventBus.on(EVENTS.CORE.INITIALIZED.GAME, (function () {
            if (this.getQueueLength()) {
                this.checkQueueItemsFinished([...Object.keys(this.state.getBuildQueue())]);
            }

            this._checkUnlockFactory();

            if (this.render.isOverlayVisible()) {
                this.stock.updateStock();
                this.render.updateFactoriesMap();
            }
        }).bind(this));
    }

    /**
     * Count all non hidden build queue jobs
     *
     * @returns {Number}
     */
    BuildQueue.prototype.getQueueLength = function () {
        return this.state.getBuildQueue().reduce((carry, job) => carry + (!job.hiddenJob), 0);
    };

    BuildQueue.prototype.setRender = function (render) {
        this.render = render;
        return this;
    };

    BuildQueue.prototype.reIndexBuildQueue = function () {
        this.state.setBuildQueue(this.state.getBuildQueue().filter(Boolean));
    };

    BuildQueue.prototype.updateQueuedJobsAmount = function () {
        $('#enter-beer-factory__queued-jobs').text(this.getQueueLength());

        if (this.render.isOverlayVisible()) {
            $('#build-queue__queued-jobs').text(this.getQueueLength());
        }
    };

    /**
     * Add a new job to the queue. Returns true if the job was added, false otherwise
     *
     * @param {Number}        action    The action of the job (BUILD_QUEUE__* constants)
     * @param {String|Object} item      Specific information about the job
     * @param {Array}         materials A list of required materials to complete the job
     * @param {Boolean}       hiddenJob It's a hidden job without user interactions
     *
     * @returns {boolean}
     */
    BuildQueue.prototype.addToQueue = function (action, item, materials, hiddenJob = false) {
        try {
            if (!hiddenJob) {
                this._isValidQueueAdd(action, item);
            }
        } catch (errorMessage) {
            (new Beerplop.Notification()).notify({
                content: errorMessage,
                style: 'snackbar-info',
                timeout: 3000,
            });

            return false;
        }

        const queueItemId = this.state.getBuildQueue().push({
            materials:      this.stock.orderMaterialListByProductionBalance(materials),
            requiredItems:  materials.reduce((total, material) => total + material.required, 0),
            deliveredItems: 0,
            action:         action,
            item:           item,
            startedAt:      new Date(),
            hiddenJob:      hiddenJob,
        }) - 1;

        this._addedJobToQueue(action, item);

        // don't update the UI for a hidden job
        if (hiddenJob) {
            this.checkQueueItemsFinished([queueItemId]);
            return true;
        }

        this.state.getState().totalQueuedJobs++;
        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.amount,
            this.state.getState().totalQueuedJobs
        );

        $('#beer-factory__build-queue').html(this.render.renderBuildQueue());
        this.initBuildQueueEventListener();

        this.updateQueuedJobsAmount();

        return true;
    };

    /**
     * Loop over the provided queue items and check if the items are finished completely
     *
     * @param queueItems
     */
    BuildQueue.prototype.checkQueueItemsFinished = function (queueItems) {
        let finishedQueueItems = [];

        $.each(queueItems, (function checkBuildQueueItemFinished(index, queueItemId) {
            let itemFinished = true;

            $.each(
                this.state.getBuildQueueItem(queueItemId).materials,
                function checkBuildQueueItemMaterialFinished () {
                    if (this.delivered < this.required) {
                        itemFinished = false;
                        return false;
                    }
                }
            );

            if (itemFinished) {
                this._queueItemFinished(queueItemId);
                finishedQueueItems.push(queueItemId);
            }
        }).bind(this));

        if (finishedQueueItems.length > 0) {
            $.each(finishedQueueItems, (function deleteFinishedQueueItems (index, queueItemId) {
                delete this.state.getState().buildQueue[queueItemId];
            }).bind(this));

            this.reIndexBuildQueue();
            this.updateQueuedJobsAmount();

            if (this.render.isOverlayVisible()) {
                $('#beer-factory__build-queue').html(this.render.renderBuildQueue());
                this.initBuildQueueEventListener();
                this.render.updateFactoriesMap();
            }
        }
    };

    /**
     * Perform an action after a queue item is finished
     *
     * @param {Number} queueItemId
     *
     * @private
     */
    BuildQueue.prototype._queueItemFinished = function (queueItemId) {
        const queueItem = this.state.getBuildQueueItem(queueItemId),
              item      = queueItem.item,
              now       = new Date();

        this.state.getState().buildQueueHistory.unshift({
            label: this.getQueueJobLabel(queueItem.action, item),
            ts:    now,
        });

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.duration,
            Math.floor((now - queueItem.startedAt) / (1000 * 60 * 60 * 24))
        );

        switch (queueItem.action) {
            case BUILD_QUEUE__BUILD:
                const factory = this.state.getFactory(item);

                factory.amount++;
                this._checkUnlockFactory();

                if (factory.production === false) {
                    this._nonProducingFactoryConstructed(item);
                }

                // reset all production amount caches to recalculate them to cover dependencies between buildings
                // (eg. lodges boost other building productions)
                this.cache.resetProductionAmountCache();
                this.cache.resetDeliverCapacityCache();

                if (this.render.isOverlayVisible()) {
                    this.stock.updateStock();
                    this.render.updateFactoriesMap();
                }

                if (this.achievementController.getAchievementStorage().achievements.beerFactory.factories[item]) {
                    this.achievementController.checkAmountAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerFactory.factories[item],
                        factory.amount
                    );
                }

                break;
            case BUILD_QUEUE__UPGRADE:
                const upgrade = this.upgrade.getUpgrade(item.factory, item.upgrade, item.level);

                this.state.getFactory(item.factory).upgrades[item.upgrade]++;

                if (upgrade.callback) {
                    upgrade.callback();
                }

                // reset all production amount caches to recalculate them to cover dependencies between buildings
                // (eg. lodges boost other building productions)
                this.cache.resetProductionAmountCache();

                break;
            case BUILD_QUEUE__CONSTRUCT_SLOT:
                const state = this.state.getState();

                if (!state.equippedBuildings[item]) {
                    break;
                }

                state.equippedBuildings[item].slots.push(null);

                this.achievementController.checkAmountAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerFactory.slots.constructed,
                    state.equippedBuildings[item].slots.length
                );

                if (Object.keys(state.equippedBuildings).length === Object.keys(this.gameState.getBuildings()).length) {
                    let hasSlotOnEachBuilding = true;
                    $.each(state.equippedBuildings, function (building, equipmentData) {
                        if (equipmentData.slots.length === 0) {
                            hasSlotOnEachBuilding = false;
                            return false;
                        }
                    });

                    if (hasSlotOnEachBuilding) {
                        this.achievementController.checkAchievement(
                            this.achievementController.getAchievementStorage().achievements.beerFactory.slots.onAllBuildings
                        );
                    }
                }

                break;
            case BUILD_QUEUE__EQUIP_SLOT:
                const slot = this.state.getState().equippedBuildings[item.building].slots[item.slot];
                slot.state = EQUIPMENT_STATE__FINISHED;

                switch (slot.equip) {
                    case EQUIPMENT_ITEM__DIASTATIC:
                        this.state.checkAdvancedBuyControlEnable();

                        // construct a free slot if the corresponding upgrade is reached
                        if (this.state.getFactory('academy').upgrades.explore >= 7) {
                            this.addToQueue(BUILD_QUEUE__CONSTRUCT_SLOT, item.building, [], true);
                        }

                        break;
                    case EQUIPMENT_ITEM__AMYLASE:
                        this.state.checkAdvancedBuyControlEnable();

                        // construct a free slot if the corresponding upgrade is reached
                        if (this.state.getFactory('academy').upgrades.explore >= 8) {
                            this.addToQueue(BUILD_QUEUE__CONSTRUCT_SLOT, item.building, [], true);
                        }

                        break;
                }

                // manage updating the game state with the new equipment
                this.cache.resetCarbonationBuildingAmountCache();
                this.gameState.recalculateAutoPlopsPerSecond();
                ComposedValueRegistry
                    .getComposedValue(CV_BOTTLE_CAP)
                    .triggerModifierChange(SLOT__COMPOSED_VALUE_KEY);

                break;
        }

        // emit the event on the next tick to make sure the item isn't present in the build queue any longer
        window.setTimeout(
            () => this.gameEventBus.emit(EVENTS.BEER_FACTORY.QUEUE.FINISHED, [queueItemId, queueItem.action, item]),
            0
        );

        // don't show a notification for hidden jobs
        if (queueItem.hiddenJob) {
            return;
        }

        (new Beerplop.Notification()).notify({
            content: translator.translate(
                'beerFactory.queue.finished',
                {
                    __JOB__: this.getQueueJobLabel(queueItem.action, queueItem.item)
                }
            ),
            style:   'snackbar-success',
            timeout: 4000,
            channel: 'beerFactory',
        });
    };

    /**
     * Check if the requirements for unlocking a new factory are fulfilled
     *
     * @private
     */
    BuildQueue.prototype._checkUnlockFactory = function () {
        $.each(this.state.getFactories(), (function checkUnlockNewFactory(factory, factoryData) {
            if (factoryData.enabled) {
                return;
            }

            let requirementsReached = true;
            $.each(FACTORY_ENABLE_LIMITS[factory], (function checkFactoryRequirements(requiredFactory, requiredAmount) {
                if (this.state.getFactory(requiredFactory).amount < requiredAmount) {
                    requirementsReached = false;
                    return false;
                }
            }).bind(this));

            if (requirementsReached) {
                this.state.getFactory(factory).enabled = true;

                if (FACTORY_DATA_FIX[factory].enableMaterial) {
                    $.each(FACTORY_DATA_FIX[factory].enableMaterial, (function enableMaterials(index, material) {
                        this.state.getMaterial(material).enabled = true;
                    }).bind(this));
                }

                if (this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked[factory]) {
                    this.achievementController.checkAchievement(
                        this.achievementController.getAchievementStorage().achievements.beerFactory.unlocked[factory]
                    );
                }
            }
        }).bind(this));
    };

    /**
     * Perform specific game state changing actions if a non producing factory was finished
     *
     * @param factory
     * @private
     */
    BuildQueue.prototype._nonProducingFactoryConstructed = function (factory) {
        switch (factory) {
            case 'storage':
                if (this.state.getFactory('storage').upgrades.diversify > 0) {
                    this.cache.resetDeliverCapacityCache();
                }

                this.render.updateStockTable();
                break;
            case 'transport':
                this.cache.resetDeliverCapacityCache();
                this.render.updateStockTable();
        }
    };

    /**
     * Perform state changes after a job has been added to the queue
     *
     * @param action The action of the job (BUILD_QUEUE__* constants)
     * @param item   Specific information about the job
     *
     * @private
     */
    BuildQueue.prototype._addedJobToQueue = function (action, item) {
        switch (action) {
            case BUILD_QUEUE__EQUIP_SLOT:
                const slot = this.state.getState().equippedBuildings[item.building].slots[item.slot];
                if (slot) {
                    // manage updating the game state with the new equipment as maybe an item was equipped before which
                    // affects the game state
                    switch (slot.equip) {
                        case EQUIPMENT_ITEM__CARBONATION:
                            this.cache.resetCarbonationBuildingAmountCache();
                            break;
                        case EQUIPMENT_ITEM__DIASTATIC:
                            this.state.getState().equippedBuildings[item.building].autoBuyer = false;
                            break;
                        case EQUIPMENT_ITEM__AMYLASE:
                            this.state.getState().equippedBuildings[item.building].autoLevelUp = false;
                            break;
                    }

                    this.gameState.recalculateAutoPlopsPerSecond();
                    ComposedValueRegistry
                        .getComposedValue(CV_BOTTLE_CAP)
                        .triggerModifierChange(SLOT__COMPOSED_VALUE_KEY);
                }

                this.state.getState().equippedBuildings[item.building].slots[item.slot] = {
                    state: EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                    equip: item.equipment,
                };

                break;
        }
    };

    /**
     * Check if an action can be added to the queue. If the queue holds too many items or actions of the same type the
     * add is not permitted and an error message will be thrown.
     *
     * @param {int}    action
     * @param {string} item
     *
     * @throws {string}
     * @private
     */
    BuildQueue.prototype._isValidQueueAdd = function (action, item) {
        const state = this.state.getState();

        if (state.buildQueue.length >= state.maxActionsInQueue) {
            throw translator.translate('beerFactory.queue.limit.max', {__AMOUNT__: state.maxActionsInQueue});
        }

        let sameActionInQueue = 0;
        $.each(state.buildQueue, function countIdenticalActionsInBuildQueue(index, job) {
            if (job.action === action && job.item === item) {
                sameActionInQueue++;
            }
        });

        if (sameActionInQueue >= state.maxSameActionsInQueue) {
            throw translator.translate('beerFactory.queue.limit.identic', {__AMOUNT__: state.maxSameActionsInQueue});
        }
    };


    /**
     * Get the label for a queue job
     *
     * @param action
     * @param item
     *
     * @returns {string}
     */
    BuildQueue.prototype.getQueueJobLabel = function (action, item) {
        let translationData = {};

        switch (action) {
            case BUILD_QUEUE__BUILD:
            case BUILD_QUEUE__UPGRADE:
                translationData = {
                    __FACTORY__: translator.translate('beerFactory.factory.' + (item.factory || item)),
                };
                break;
            case BUILD_QUEUE__CONSTRUCT_SLOT:
                translationData = {
                    __BUILDING__: translator.translate('building.' + item, null, '', 2),
                };
                break;
            case BUILD_QUEUE__EQUIP_SLOT:
                translationData = {
                    __BUILDING__: translator.translate('building.' + item.building, null, '', 2),
                    __ITEM__    : translator.translate('beerFactory.equipment.' + item.equipment),
                };
                break;
            case BUILD_QUEUE__UNIQUE_BUILD:
                translationData = {
                    __BUILD__: translator.translate(`beerFactory.uniqueBuilds.${item.build}.title`),
                };
                break;
        }

        return translator
            .translate('beerFactory.queueLabel.' + action, translationData)
            .replace(/\sa\s([aeiou])/gi, " an $1"); // at least correct grammar :)
    };

    /**
     * Count the amount of queued builds for each factory
     *
     * @returns {Object}
     * @private
     */
    BuildQueue.prototype.getQueuedBuilds = function () {
        let queuedBuilds = {};

        $.each(this.state.getBuildQueue(), function () {
            if (this.action === BUILD_QUEUE__BUILD) {
                queuedBuilds[this.item] ? queuedBuilds[this.item]++ : queuedBuilds[this.item] = 1;
            }
        });

        return queuedBuilds;
    };

    /**
     * Init the event listeners for the build queue partial view
     *
     * @private
     */
    BuildQueue.prototype.initBuildQueueEventListener = function () {
        const container     = $('#beer-factory__build-queue-container'),
              historyButton = $('#beer-factory__build-queue__history');

        if (this.state.getState().buildQueueHistory.length > 0) {
            historyButton.removeClass('d-none');
        }

        historyButton.on('click', (function () {
            const renderHistoryModalBody = (function () {
                $('#beer-factory__build-queue__history-modal__body').html(
                    Mustache.render(
                        TemplateStorage.get('beer-factory__build-queue__history-modal__body-template'),
                        {
                            jobs:     this.state.getState().buildQueueHistory,
                            formatTs: function () {
                                return function (input, render) {
                                    return (new Date(render(input))).toLocaleString();
                                }
                            }
                        }
                    )
                );
            }).bind(this);

            renderHistoryModalBody();

            $('#beer-factory__build-queue__history-modal').modal('show');
            $('.beer-factory__build-queue__clear-history').on('click', (function () {
                this.state.getState().buildQueueHistory = [];
                renderHistoryModalBody();
            }).bind(this));
        }).bind(this));

        container.find('.build-queue__item__toggle-collapse').on('click', (function collapseJob(event) {
            const queueItemContainer = $(event.target).closest('.build-queue__item-container'),
                  queueItemId        = queueItemContainer.data('itemId'),
                  queueItem          = this.state.getBuildQueueItem(queueItemId);

            queueItem.collapsed = !queueItem.collapsed;

            queueItemContainer
                .find('.build-queue__item__toggle-collapse__icon')
                .toggleClass('fa-angle-down fa-angle-right');
        }).bind(this));

        container.find('.build-queue__manage-item').on('click', (function openManageItemModal(event) {
            const queueItemId = $(event.target).closest('.build-queue__item-container').data('itemId'),
                  queueItem   = this.state.getBuildQueueItem(queueItemId);

            this._renderItemManagementModal(queueItem);

            const modal = $('#beer-factory__build-queue__manage-item-modal');

            modal.modal('show');

            // attach an event listener to update the modal if a material is finished
            this.gameEventBus.on(
                EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED + '.management-modal',
                () => this._renderItemManagementModal(queueItem)
            );

            this._closeModalOnQueueItemFinished(modal, queueItemId);
        }).bind(this));

        container.find('.build-queue__toggle-pause').on('click', (function toggleBuildQueueItemPause(event) {
            const queueItem = this.state.getBuildQueueItem(
                $(event.target).closest('.build-queue__item-container').data('itemId')
            );

            queueItem.paused = !queueItem.paused;

            const abbrElement = $(event.target).closest('abbr');

            abbrElement.prop(
                'title',
                translator.translate('beerFactory.queue.job.' + (queueItem.paused ? 'start' : 'pause'))
            );
            abbrElement.find('i').toggleClass('fa-pause fa-play');

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.pause
            );
        }).bind(this));

        container.find('.build-queue__move-item').on('click', (function (event) {
            const queueItemId = $(event.target).closest('.build-queue__item-container').data('itemId'),
                  direction   = $(event.target).closest('.build-queue__move-item').data('direction');

            // cancel invalid moves
            if ((direction === 'up' && queueItemId === 0) ||
                (direction === 'down' && queueItemId === this.getQueueLength() - 1)
            ) {
                return;
            }

            const buildQueue       = this.state.getBuildQueue(),
                  sourceElement    = buildQueue[queueItemId],
                  destinationIndex = direction === 'up' ? queueItemId - 1 : queueItemId + 1;

            buildQueue[queueItemId]      = buildQueue[destinationIndex];
            buildQueue[destinationIndex] = sourceElement;

            $('#beer-factory__build-queue').html(this.render.renderBuildQueue());
            this.initBuildQueueEventListener();

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.rearrange
            );
        }).bind(this));

        container.find('.build-queue__drop-job').on('click', (function dropItemFromBuildQueue(event) {
            const queueItemId = $(event.target).closest('.build-queue__item-container').data('itemId');

            if (this.state.getBuildQueueItem(queueItemId).deliveredItems === 0) {
                this._deleteItemFromBuildQueue(queueItemId);
                return;
            }

            const modal = $('#beer-factory__build-queue-item__delete-warn-modal');

            modal.modal('show');

            $('#beer-factory__build-queue-item__delete').data('itemId', queueItemId);

            this._closeModalOnQueueItemFinished(modal, queueItemId);
        }).bind(this));

        $('#beer-factory__build-queue').sortable({
            containment: '#beer-factory__build-queue-container',
            scroll:      true,
            update:      (function (event, ui) {
                const oldPosition = ui.item.data('itemId'),
                      newPosition = ui.item.index(),
                      buildQueue  = this.state.getBuildQueue();

                buildQueue.splice(newPosition, 0, buildQueue.splice(oldPosition, 1)[0]);

                $('#beer-factory__build-queue').html(this.render.renderBuildQueue());
                this.initBuildQueueEventListener();

                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.rearrange
                );
            }).bind(this)
        });
    };

    BuildQueue.prototype._renderItemManagementModal = function (queueItem) {
        $('#beer-factory__build-queue__manage-item-modal__body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__build-queue__manage-item__body-template'),
                {
                    job:       this.getQueueJobLabel(queueItem.action, queueItem.item),
                    materials: queueItem.materials.filter(material => material.delivered < material.required),
                }
            )
        );

        let startIndex;
        $('#beer-factory__build-queue__manage-item__material-table').find('tbody').sortable({
            containment: '#beer-factory__build-queue__manage-item-modal',
            scroll:      true,
            start: function(event, ui) {
                // find the current index of the selected material
                startIndex = queueItem.materials
                    .findIndex(material => material.key === $(ui.item).data('materialKey'));
            },
            update: (function (event, ui) {
                let newPosition = ui.item.index();

                // if the material shouldn't be set to the top of the list move it after the material which is
                // in the management modal above the selected list index. It can't be moved to the ui index as
                // various already finished materials may lay in between which increase the 'real' index
                if (newPosition !== 0) {
                    const previousMaterial = $(
                        $('#beer-factory__build-queue__manage-item__material-table').find('tr')[newPosition - 1]
                    ).data('materialKey');

                    newPosition = queueItem.materials
                        .findIndex(material => material.key === previousMaterial) + 1;
                }

                queueItem.materials.splice(newPosition, 0, queueItem.materials.splice(startIndex, 1)[0]);

                $('#beer-factory__build-queue').html(this.render.renderBuildQueue());
                this.initBuildQueueEventListener();

                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.micro.rearrange
                );
            }).bind(this),
        });

        $('.build-queue__manage-item__material__toggle-pause').on('click', (function (event) {
            const materialKey = $(event.target).closest('tr').data('materialKey'),
                abbrElement = $(event.target).closest('abbr');

            $.each(queueItem.materials, function () {
                if (this.key === materialKey) {
                    this.paused = !this.paused;
                    abbrElement.prop(
                        'title',
                        translator.translate('beerFactory.modal.jobManagement.' + (this.paused ? 'start' : 'pause'))
                    );
                    abbrElement.find('i').toggleClass('fa-pause fa-play');

                    return false;
                }
            });

            $('#beer-factory__build-queue').html(this.render.renderBuildQueue());
            this.initBuildQueueEventListener();

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.beerFactory.jobs.micro.pause
            );
        }).bind(this));
    };

    BuildQueue.prototype._closeModalOnQueueItemFinished = function (modal, queueItemId) {
        this.gameEventBus.on(
            EVENTS.BEER_FACTORY.QUEUE.FINISHED + '.management-modal',
            (event, id) => {
                if (id == queueItemId) {
                    modal.modal('hide');
                }
            }
        );

        modal.off('hidden.bs.modal');
        modal.on('hidden.bs.modal', (function () {
            this.gameEventBus.off(EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED + '.management-modal');
            this.gameEventBus.off(EVENTS.BEER_FACTORY.QUEUE.FINISHED + '.management-modal');
        }).bind(this));
    };

    /**
     * Delete a job from the build queue
     *
     * @param queueItemId
     * @private
     */
    BuildQueue.prototype._deleteItemFromBuildQueue = function (queueItemId) {
        const queueItem = this.state.getBuildQueueItem(queueItemId);

        if (!queueItem) {
            return;
        }

        const updateFactoryView = queueItem.action === BUILD_QUEUE__UPGRADE || queueItem.action === BUILD_QUEUE__BUILD;

        if (queueItem.action === BUILD_QUEUE__EQUIP_SLOT) {
            // unset the under construction slot
            this.state.getState().equippedBuildings[queueItem.item.building].slots[queueItem.item.slot] = null;
        }

        delete this.state.getState().buildQueue[queueItemId];
        this.reIndexBuildQueue();

        $('#beer-factory__build-queue').html(this.render.renderBuildQueue());
        this.initBuildQueueEventListener();

        if (updateFactoryView) {
            this.render.updateFactoriesMap();
        }

        this.updateQueuedJobsAmount();
    };

    beerFactoryGame.BuildQueue = BuildQueue;
})(BeerFactoryGame);

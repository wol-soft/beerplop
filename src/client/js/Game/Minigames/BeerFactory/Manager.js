(function(beerFactoryGame) {
    'use strict';

    const BASE_PRICE__HIRE_MANAGER = 1e5;

    Manager.prototype.beerFactoryState = null;
    Manager.prototype.cache            = null;
    Manager.prototype.factory          = null;

    Manager.prototype.numberFormatter = null;
    Manager.prototype.gameEventBus    = null;

    Manager.prototype.initialState = null;
    Manager.prototype.managerInHiringProcessCache = {};

    Manager.prototype.state = {
        managers: {},
    };

    function Manager(state, cache, factory, gameEventBus) {
        this.initialState = $.extend(true, {}, this.state);

        this.beerFactoryState = state;
        this.cache            = cache;
        this.factory          = factory;

        this.gameEventBus    = gameEventBus;
        this.numberFormatter = new Beerplop.NumberFormatter();

        (new Beerplop.GamePersistor()).registerModule(
            'BeerFactory__Manager',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedState) {
                this.state = $.extend(true, {}, this.initialState, loadedState);
            }.bind(this))
        );

        gameEventBus.on(
            [
                EVENTS.BEER_FACTORY.EXTENSION_QUEUE.ADDED,
                EVENTS.BEER_FACTORY.EXTENSION_QUEUE.STARTED,
                EVENTS.BEER_FACTORY.EXTENSION_QUEUE.FINISHED,
            ].join(' '),
            (function clearManagerInHiringProcessCache(event, extensionKey, project) {
                if (extensionKey === 'managerAcademy' && project.action === MANAGER_ACADEMY__HIRE) {
                    delete this.managerInHiringProcessCache[project.key];
                }
            }).bind(this),
        );

        gameEventBus.on(
            EVENTS.BEER_FACTORY.EXTENSION_QUEUE.FINISHED,
            (function finishEducation(event, extensionKey, project) {
                if (extensionKey !== 'managerAcademy') {
                    return;
                }

                switch (project.action) {
                    case MANAGER_ACADEMY__HIRE:
                        if (!this.state.managers[project.key]) {
                            this.state.managers[project.key] = [];
                        }

                        this.state.managers[project.key].push({
                            level: 1,
                            name:  chance.name({ middle: true }),
                        });

                        break;
                    case MANAGER_ACADEMY__LEVEL_UP:
                        this.state.managers[project.key][project.managerId].level++;
                        break;
                }

                // force recalculation of the various manager effects
                this.cache.resetCache();
            }).bind(this)
        );
    }

    Manager.prototype.showManagerManagementModal = function (factoryKey) {
        const modal    = $('#beer-factory__manager-management-modal'),
              managers = Object.values(
                  this.getFactoryManagers(factoryKey)
                      .reduce(function groupManagersByFactory(groupedManagers, manager) {
                              groupedManagers[manager.factory].managers.push(manager);

                              return groupedManagers;
                          },
                          $.extend(
                              {[factoryKey]: {managers: []}},
                              (this.beerFactoryState.getFactory(factoryKey).extensions || [])
                                  .reduce(
                                      (carry, extensionKey) => (
                                          {...carry, [extensionKey]: {managers: [], extensionKey: extensionKey}}
                                      ),
                                      {},
                                  ),
                          ),
                      ),
              );

        modal.find('.modal-body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__manager-management-modal-template'),
                {
                    factoryKey:        factoryKey,
                    managers:          this._mapManagersForView(managers.shift().managers),
                    inHire:            this._getManagersInHiringProcess(factoryKey),
                    costNext:          this.numberFormatter.formatInt(
                        this._getRequiredKnowledgeForHiringManager(factoryKey)
                    ),
                    extensionManagers: managers.map((extensionManagers) => {
                        extensionManagers.managers = this._mapManagersForView(extensionManagers.managers);
                        extensionManagers.inHire   = this._getManagersInHiringProcess(extensionManagers.extensionKey);
                        extensionManagers.costNext = this.numberFormatter.formatInt(
                            this._getRequiredKnowledgeForHiringManager(extensionManagers.extensionKey)
                        );

                        return extensionManagers;
                    }),
                },
            )
        );

        modal.modal('show');

        this._initEventListener(modal);
    };

    /**
     * Returns an array containing all managers of the provided factory key (including the managers of the factory
     * extensions of the requested factory)
     *
     * @param {string} factoryKey
     *
     * @return {array}
     */
    Manager.prototype.getFactoryManagers = function (factoryKey) {
        const result = [];

        result.push(
            ...(this.state.managers[factoryKey] || [])
                .map((manager) => $.extend(manager, {factory: factoryKey}))
        );

        $.each((this.beerFactoryState.getFactory(factoryKey).extensions || []), (index, extensionKey) => {
            result.push(
                ...(this.state.managers[extensionKey] || [])
                    .map((manager) => $.extend(manager, {factory: extensionKey, extensionManager: true}))
            );
        });

        return result;
    };

    Manager.prototype._mapManagersForView = function (managers) {
        let index = 0;

        return managers.map(manager => {
            return {
                id:    index++,
                name:  manager.name,
                level: this.numberFormatter.romanize(manager.level),
            };
        });
    };

    Manager.prototype._initEventListener = function (modal) {
        modal.find('.beer-factory__manager-management__hire').on('click', (function hireNewManager (event) {
            const button      = $(event.target),
                  isExtension = !!button.data('extensionKey'),
                  key         = button.data('extensionKey') || button.data('factoryKey');

            this.factory.addProjectToExtensionQueue('managerAcademy', {
                action: MANAGER_ACADEMY__HIRE,
                key: key,
                isExtension: isExtension,
                materials: {
                    knowledge: this._getRequiredKnowledgeForHiringManager(key),
                },
            });
        }).bind(this));

        new Beerplop.ObjectNaming(
            modal.find('.beer-factory__manager__name'),
            (id, name) => {
                let [key, managerId] = id.split('-');

                this.state.managers[key][managerId].name = name;
            },
            'beerFactory.manager.naming',
        );
    };

    Manager.prototype._getRequiredKnowledgeForHiringManager = function (key) {
        return Math.ceil(
            BASE_PRICE__HIRE_MANAGER * Math.pow(
                3,
                this._getManagersInHiringProcess(key) + (this.state.managers[key] || []).length,
            ),
        );
    };

    /**
     * Count how many managers are currently in the manager academy to be hired for the given factory/extension key.
     * This includes running educations as well as educations in the project queue of the manager academy.
     *
     * @param {string} key
     *
     * @return {number}
     *
     * @private
     */
    Manager.prototype._getManagersInHiringProcess = function (key) {
        if (!this.managerInHiringProcessCache[key]) {
            const extension = this.beerFactoryState.getExtensionStorage('managerAcademy');

            this.managerInHiringProcessCache[key] = (
                (
                    extension.project
                    && extension.project.action === MANAGER_ACADEMY__HIRE
                    && extension.project.key === key
                ) ? 1 : 0
            ) + extension.queue.reduce(
                (managers, project) => managers + (
                    project.action === MANAGER_ACADEMY__HIRE
                    && project.key === key
                ),
                0,
            );
        }

        return this.managerInHiringProcessCache[key];
    };

    beerFactoryGame.Manager = Manager;
})(BeerFactoryGame);

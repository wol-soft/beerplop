(function(beerFactoryGame) {
    'use strict';

    ManagerManagementModal.prototype.state   = null;
    ManagerManagementModal.prototype.cache   = null;
    ManagerManagementModal.prototype.factory = null;

    function ManagerManagementModal(state, cache, factory) {
        this.state   = state;
        this.cache   = cache;
        this.factory = factory;

        this.numberFormatter = new Beerplop.NumberFormatter();
    }

    ManagerManagementModal.prototype.render = function (factoryKey) {
        const modal    = $('#beer-factory__manager-management-modal'),
              managers = Object.values(
                  this.state.getFactoryManagers(factoryKey)
                      .reduce(function groupManagersByFactory(groupedManagers, manager) {
                              groupedManagers[manager.factory].managers.push(manager);

                              return groupedManagers;
                          },
                          $.extend(
                              {[factoryKey]: {managers: []}},
                              (this.state.getFactory(factoryKey).extensions || [])
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
                    factoryManagers:   this._mapManagersForView(managers.shift().managers),
                    extensionManagers: managers.map((extensionManagers) => {
                        extensionManagers.managers = this._mapManagersForView(extensionManagers.managers);
                        return extensionManagers;
                    }),
                },
            )
        );

        modal.modal('show');

        this._initEventListener(modal);
    };

    ManagerManagementModal.prototype._mapManagersForView = function (managers) {
        let index = 0;

        return managers.map(manager => {
            return {
                id:    index++,
                name:  manager.name,
                level: this.numberFormatter.romanize(manager.level),
            };
        });
    };

    ManagerManagementModal.prototype._initEventListener = function (modal) {
        modal.find('.beer-factory__manager-management__hire').on('click', (function hireNewManager (event) {
            const button      = $(event.target),
                  isExtension = !!button.data('extensionKey'),
                  key         = isExtension ? button.data('extensionKey') : button.data('factoryKey');

            this.factory.addProjectToExtensionQueue('managerAcademy', {
                action: MANAGER_ACADEMY__HIRE,
                materials: {
                    knowledge: this._getRequiredKnowledgeForHiringManager(key, isExtension),
                },
                data: {
                    isExtension: isExtension,
                    key: key,
                },
            });
        }).bind(this));

        new Beerplop.ObjectNaming(
            modal.find('.beer-factory__manager__name'),
            (id, name) => {
                let [isExtension, key, managerId] = id.split('-');

                (!!parseInt(isExtension)
                    ? this.state.getExtensionStorage(key)
                    : this.state.getFactory(key)
                ).managers[managerId].name = name;
            },
            'beerFactory.manager.naming',
        );
    };

    ManagerManagementModal.prototype._getRequiredKnowledgeForHiringManager = function (key, isExtension) {
        return 1000;
    };

    beerFactoryGame.ManagerManagementModal = ManagerManagementModal;
})(BeerFactoryGame);

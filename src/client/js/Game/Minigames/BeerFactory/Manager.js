(function(beerFactoryGame) {
    'use strict';

    Manager.prototype.state = null;

    function Manager(state, cache, gameEventBus) {
        this.state = state;
        this.cache = cache;

        gameEventBus.on(
            EVENTS.BEER_FACTORY.EXTENSION_QUEUE.FINISHED,
            (function finishEducation(event, extensionKey, project) {
                if (extensionKey !== 'managerAcademy') {
                    return;
                }

                switch (project.action) {
                    case MANAGER_ACADEMY__HIRE:
                        const object = this._getManageableObjectByProject(project);

                        if (!object.managers) {
                            object.managers = [];
                        }

                        object.managers.push({
                            level: 1,
                            name:  chance.name({ middle: true }),
                        });

                        break;
                    case MANAGER_ACADEMY__LEVEL_UP:
                        this._getManageableObjectByProject(project).managers[project.managerId].level++;
                        break;
                }

                // force recalculation of the various manager effects
                this.cache.resetCache();
            }).bind(this)
        );
    }

    Manager.prototype._getManageableObjectByProject = function (project) {
        return project.isExtension
            ? this.state.getExtensionStorage(project.key)
            : this.state.getFactory(project.key);
    };

    beerFactoryGame.Manager = Manager;
})(BeerFactoryGame);

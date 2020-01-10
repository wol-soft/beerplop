(function(beerplop) {
    'use strict';

    ConsoleController.prototype.gameState             = null;
    ConsoleController.prototype.buffController        = null;
    ConsoleController.prototype.upgradeController     = null;
    ConsoleController.prototype.achievementController = null;

    function ConsoleController(gameState, buffController, upgradeController, achievementController) {
        this.gameState             = gameState;
        this.buffController        = buffController;
        this.upgradeController     = upgradeController;
        this.achievementController = achievementController;

        window.plop = (function (...a) {
            return this.plop.apply(this, a);
        }).bind(this);
    }

    ConsoleController.prototype.plop = function (command, ...args) {
        switch (command) {
            case 'console':
                this.showConsole();
                break;
            case 'add':
                return this.gameState.addPlops(args[0]);
            case 'debug':
                this.gameState.debug();
                return;
            case 'caps':
                return this.gameState.buildingLevelController.addBottleCaps(args[0]);
            case 'mana':
                return (new Minigames.Beerwarts()).addMana(args[0]);
            case 'save':
                return (new beerplop.GamePersistor()).setLocalSaveState();
            case 'buff':
                for (let i = 0; i < (args[0] || 1); i++) {
                    this.buffController.spawnBuffBottle(null, null, null, args[1] || '');
                }
                break;
            case 'unlockAll':
                this.achievementController.unlockAllAchievements();
                this.upgradeController.unlockAllUpgrades();
                break;
            case 'factory-clear':
                (new Minigames.BeerFactory()).clearStorages();
                break;
            case 'factory-speedup':
                this.gameState.state.gameSpeed = 250;
                ComposedValueRegistry.getComposedValue(CV_FACTORY).triggerModifierChange('GameSpeed');

                (new Minigames.BeerFactory()).cache.cache = {
                    productionAmountCache: {},
                    producedMaterialCache: {},
                    deliverCapacity: 0,
                    factoryExtensionConsumptionCache: {},
                    carbonationBuildingAmountCache: null,
                };

                break;
            case 'factory-queue-complete':
                $.each(
                    (new Minigames.BeerFactory()).state.state.buildQueue[args[0]].materials,
                    (index, material) => material.delivered = material.required
                );

                (new Minigames.BeerFactory()).buildQueue.checkQueueItemsFinished([args[0]]);
                break;
            default:
                return translator.translate('cheers');
        }
    };

    ConsoleController.prototype.showConsole = function () {
        console.log('CONSOLE opened');
    };

    beerplop.ConsoleController = ConsoleController;
})(Beerplop);

(function(beerplop) {
    'use strict';

    /**
     * Initialize the plop main controller
     *
     * @constructor
     */
    function PlopController() {
        const gameEventBus          = new Beerplop.GameEventBus(),
              beerBlender           = new Minigames.BeerBlender(gameEventBus),
              gameState             = new Beerplop.GameState(gameEventBus, beerBlender),
              beerBank              = new Minigames.BeerBank(gameState, gameEventBus, beerBlender),
              achievementController = new Beerplop.AchievementController(gameState, gameEventBus, beerBank),
              stockMarket           = new Minigames.StockMarket(gameState, gameEventBus),
              beerFactory           = new Minigames.BeerFactory(gameState, gameEventBus),
              buffController        = new Beerplop.BuffController(gameState, gameEventBus, beerBlender, beerFactory, beerBank),
              beerBankBanker        = new Minigames.BeerBankBanker(gameState, gameEventBus, beerBank),
              beerwarts             = new Minigames.Beerwarts(gameState, gameEventBus),
              levelController       = new Beerplop.LevelController(gameState, gameEventBus),
              clickBarController    = new Beerplop.ClickBarController(gameEventBus),
              upgradeController     = new Beerplop.UpgradeController(gameState, gameEventBus, buffController, levelController, clickBarController, beerFactory),
              saveStateController   = new Beerplop.SaveStateController(gameState, gameEventBus),
              researchProject       = new Minigames.ResearchProject(gameState, gameEventBus, upgradeController, beerBankBanker, beerwarts),
              beerCloner            = new BuildingMinigames.BeerCloner(gameState, gameEventBus, achievementController, researchProject),
              automatedBar          = new BuildingMinigames.AutomatedBar(gameEventBus, achievementController);

        new Beerplop.ConsoleController(gameState, buffController, upgradeController, achievementController);

        gameState
            .setAchievementController(achievementController)
            .setUpgradeController(upgradeController)
            .setLevelController(levelController)
            .setSlotController(beerFactory.getSlotController())
            .setResearchProject(researchProject)
            .setBeerBank(beerBank)
            .setBeerwarts(beerwarts)
            .setBeerCloner(beerCloner)
            .setBeerFactory(beerFactory)
            .setAutomatedBar(automatedBar);

        new Beerplop.TooltipController(gameState, beerFactory).initPopover();
        new Beerplop.OverlayController();

        beerBlender.setAchievementController(achievementController);
        beerwarts.setAchievementController(achievementController);
        beerBankBanker
            .setAchievementController(achievementController)
            .setStockMarket(stockMarket);

        const gamePersistor = (new Beerplop.GamePersistor()).setEventBus(gameEventBus),
              saveStateId   = $('body').data('savestateId');

        new Beerplop.GameOptions();

        assetPromises['client-templates'].then(() => {
            try {
                if (saveStateId) {
                    saveStateController.loadSaveState(saveStateId, 1000);
                } else {
                    gamePersistor.loadLocalSaveState();
                }
            } catch (error) {
                gamePersistor.disableSave();
                saveStateController.disableSave();

                alert(translator.translate('error.applySaveState') + "\n\n" + error);
                console.log(error);

                (new Beerplop.ErrorReporter()).reportError(
                    'SAVE STATE FATAL! [Save state version: ' + gamePersistor.saveStateVersion + '] ' + error.name,
                    error.message,
                    error.stack
                );
            }

            (new Beerplop.GameEventBus()).emit(EVENTS.CORE.INITIALIZED.GAME);
        });

        new Beerplop.StatisticsController(gameState, buffController, levelController);
    }

    beerplop.PlopController = PlopController;
})(Beerplop);

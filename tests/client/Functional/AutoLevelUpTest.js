
describe('Auto Level Up', function () {
    let gameState        = new Beerplop.GameState(),
        gameEventBus     = new Beerplop.GameEventBus(),
        beerFactory      = new Minigames.BeerFactory(),
        beerFactoryState = beerFactory.state.getState(),
        slotController   = beerFactory.getSlotController();

    describe('The global auto level up switch', function () {
        let gameEventBusAutoLevelUpSwitch = sinon.spy();

        it('should be invisible if no building is equipped with an auto level up', function () {
            beerFactoryState.equippedBuildings   = {};
            beerFactoryState.autoLevelUpDisabled = false;

            beerFactory.state.checkAdvancedBuyControlEnable();

            expect($('.buy-control__advanced').hasClass('d-none')).to.equal(true);
            expect($('.buy-control__advanced--auto-level-up').hasClass('d-none')).to.equal(true);
        });

        it('should be visible if any building is equipped with an auto level up', function () {
            beerFactoryState.equippedBuildings['automatedBar'] = {
                slots: [{
                    equip: EQUIPMENT_ITEM__AMYLASE,
                    state: EQUIPMENT_STATE__FINISHED,
                }],
            };

            beerFactory.state.checkAdvancedBuyControlEnable();

            expect($('.buy-control__advanced').hasClass('d-none')).to.equal(false);
            expect($('.buy-control__advanced--auto-level-up').hasClass('d-none')).to.equal(false);
        });

        it('should trigger the EVENTS.BEER_FACTORY.AUTO_LEVEL_UP event when being disabled', function () {
            gameEventBus.on(EVENTS.BEER_FACTORY.AUTO_LEVEL_UP, gameEventBusAutoLevelUpSwitch);

            $('#buy-advanced__toggle-auto-level-up').trigger('change');

            expect(beerFactoryState.autoLevelUpDisabled).to.equal(true);
            expect(gameEventBusAutoLevelUpSwitch.callCount).to.equal(1);
            expect(gameEventBusAutoLevelUpSwitch.getCall(0).args[1].enabled).to.equal(false);
            expect(gameEventBusAutoLevelUpSwitch.getCall(0).args[1].building).to.equal('global');
        });

        it('should trigger the EVENTS.BEER_FACTORY.AUTO_LEVEL_UP event when being enabled', function () {
            $('#buy-advanced__toggle-auto-level-up').trigger('change');

            expect(beerFactoryState.autoLevelUpDisabled).to.equal(false);
            expect(gameEventBusAutoLevelUpSwitch.callCount).to.equal(2);
            expect(gameEventBusAutoLevelUpSwitch.getCall(1).args[1].enabled).to.equal(true);
            expect(gameEventBusAutoLevelUpSwitch.getCall(1).args[1].building).to.equal('global');

            gameEventBus.off(EVENTS.BEER_FACTORY.AUTO_LEVEL_UP, gameEventBusAutoLevelUpSwitch);
        });
    });

    describe('A building without an equipped auto level up', function () {
        let gameEventBusLevelUpBuildingSpy = sinon.spy();

        it('should be disabled when the global switch is disabled', function () {
            gameState.resetInitialState();
            gameEventBus.on(EVENTS.CORE.BUILDING.LEVEL_UP, gameEventBusLevelUpBuildingSpy);

            gameState.getBuildingData('opener').amount = 15;
            gameState.getBuildingData('dispenser').amount = 15;
            gameState.getBuildingData('serviceAssistant').amount = 15;
            gameState.buildingLevelController.state.factories = 7;
            beerFactoryState.autoLevelUpDisabled = true;

            expect(slotController.isAutoLevelUpEnabled('opener'), 'Auto level up for openers active').to.equal(false);
            expect(slotController.isAutoLevelUpEnabled('bottleCapFactory', 'Auto level up for Bottle Cap Factories active')).to.equal(false);
        });

        it('should be disabled when the global switch is enabled', function () {
            beerFactoryState.autoLevelUpDisabled = false;

            expect(slotController.isAutoLevelUpEnabled('opener'), 'Auto level up for openers active').to.equal(false);
            expect(slotController.isAutoLevelUpEnabled('bottleCapFactory', 'Auto level up for Bottle Cap Factories active')).to.equal(false);
        });

        it('should not level up if all requirements are fulfilled', function () {
            gameState.buildingLevelController.addBottleCaps(50);
            gameState.addPlops(1000);

            expect(gameState.getBuildingData('opener').level, 'Openers leveled up').to.equal(1);
            expect(gameState.buildingLevelController.state.level, 'Bottle Cap Factories leveled up').to.equal(1);
            expect(gameEventBusLevelUpBuildingSpy.callCount).to.equal(0);

            gameEventBus.off(EVENTS.CORE.BUILDING.LEVEL_UP, gameEventBusLevelUpBuildingSpy);
        });
    });

    describe('A building with an equipped auto level up', function () {
        let gameEventBusBuyBuildingSpy  = sinon.spy(),
            gameEventBusAutoLevelUpSwitch = sinon.spy();

        it('should be disabled when auto level up is under construction', function () {
            gameState.resetInitialState();

            beerFactoryState.autoLevelUpDisabled = false;
            beerFactoryState.equippedBuildings = {};
            beerFactoryState.equippedBuildings['opener'] = {
                autoLevelUp: true,
                slots: [{
                    equip: EQUIPMENT_ITEM__AMYLASE,
                    state: EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                }],
            };
            beerFactoryState.equippedBuildings['bottleCapFactory'] = {
                autoLevelUp: true,
                slots: [{
                    equip: EQUIPMENT_ITEM__AMYLASE,
                    state: EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                }],
            };

            expect(slotController.isAutoLevelUpEnabled('opener')).to.equal(false);
            expect(slotController.isAutoLevelUpEnabled('bottleCapFactory')).to.equal(false);
        });

        it('should be disabled when the global switch is disabled', function () {
            beerFactoryState.autoLevelUpDisabled = true;

            beerFactoryState.equippedBuildings['opener'].slots[0].state           = EQUIPMENT_STATE__FINISHED;
            beerFactoryState.equippedBuildings['bottleCapFactory'].slots[0].state = EQUIPMENT_STATE__FINISHED;

            expect(slotController.isAutoLevelUpEnabled('opener')).to.equal(false);
            expect(slotController.isAutoLevelUpEnabled('bottleCapFactory')).to.equal(false);

        });

        it('should be enabled when the global and the local switch is enabled', function () {
            beerFactoryState.autoLevelUpDisabled = false;
            expect(slotController.isAutoLevelUpEnabled('opener')).to.equal(true);
            expect(slotController.isAutoLevelUpEnabled('bottleCapFactory')).to.equal(true);
        });

        it('should be disabled when the local switch is disabled', function () {
            beerFactoryState.equippedBuildings['opener'].autoLevelUp = false;
            beerFactoryState.equippedBuildings['bottleCapFactory'].autoLevelUp = false;

            expect(slotController.isAutoLevelUpEnabled('opener')).to.equal(false);
            expect(slotController.isAutoLevelUpEnabled('bottleCapFactory')).to.equal(false);
        });

        const autoLevelUpTestDataProvider = [
            {
                building: 'opener',
                initialPlops: 135,
                initialBottleCaps: 125,
                expectedPlops: 135,
                // cost of the first level up: 50 bottle caps
                expectedBottleCaps: 75,
                getLevelCallback: () => gameState.getBuildingData('opener').level,
                event: EVENTS.CORE.BUILDING.LEVEL_UP,
            },
            {
                building: 'bottleCapFactory',
                initialPlops: 1035,
                initialBottleCaps: 25,
                // cost of the first level up: 1000 plops
                expectedPlops: 35,
                expectedBottleCaps: 25,
                getLevelCallback: () => gameState.buildingLevelController.state.level,
                event: EVENTS.CORE.BUILDING.LEVEL_UP,
            }
        ];

        autoLevelUpTestDataProvider.forEach(({
              building,
              initialPlops,
              initialBottleCaps,
              expectedPlops,
              expectedBottleCaps,
              getLevelCallback,
              event
        }) => {
            const testedObject = ` [${building}]`;
            const resetLevelUpInitialState = function () {
                gameState.resetInitialState();

                gameState.getBuildingData('opener').amount = 15;
                gameState.getBuildingData('dispenser').amount = 15;
                gameState.getBuildingData('serviceAssistant').amount = 15;
                gameState.buildingLevelController.state.factories = 7;
            };

            it('should level up if all requirements are fulfilled ' + testedObject, function () {
                gameEventBusBuyBuildingSpy = sinon.spy();
                gameEventBus.on(event, gameEventBusBuyBuildingSpy);
                resetLevelUpInitialState();

                beerFactoryState.autoLevelUpDisabled = false;
                beerFactoryState.equippedBuildings[building].autoLevelUp = true;

                gameState.addPlops(initialPlops);
                gameState.buildingLevelController.addBottleCaps(initialBottleCaps);

                expect(getLevelCallback(), 'Auto level up didn\'t level up').to.equal(2);

                expect(gameState.getPlops(), 'wrong plops').to.be.closeTo(expectedPlops, 0.1);
                expect(getPlopsFromLabel($('#current-plops')), 'wrong plops displayed').to.be.closeTo(expectedPlops, 0.1);

                expect(gameState.buildingLevelController.getBottleCaps(), 'wrong bottle caps').to.be.closeTo(expectedBottleCaps, 0.1);
                expect(getPlopsFromLabel($('#panel-bottle-cap-factory').find('.bottle-caps-amount')), 'wrong bottle caps displayed').to.be.closeTo(expectedBottleCaps, 0.1);
            });

            it('should trigger the ' + event + ' event after level up buildings' + testedObject, function () {
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(1);

                const levelUp = gameEventBusBuyBuildingSpy.getCall(0).args[1];

                expect(levelUp.building, 'leveled up the wrong building').to.equal(building);
                expect(levelUp.level, 'leveled up the wrong amount').to.equal(2);
            });

            it('should not level up buildings if the global switch is disabled' + testedObject, function () {
                resetLevelUpInitialState();
                beerFactoryState.autoLevelUpDisabled = true;

                gameState.addPlops(initialPlops);
                gameState.buildingLevelController.addBottleCaps(initialBottleCaps);

                expect(getLevelCallback()).to.equal(1);
                expect(gameState.getPlops()).to.equal(initialPlops);
                expect(gameState.buildingLevelController.getBottleCaps()).to.equal(initialBottleCaps);
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(1);
            });

            it('should level up buildings if the global switch is enabled' + testedObject, function () {
                beerFactory.state.checkAdvancedBuyControlEnable();

                $('#buy-advanced__toggle-auto-level-up').trigger('change');

                expect(getLevelCallback(), 'Auto level up didn\'t level up').to.equal(2);

                expect(gameState.getPlops(), 'wrong plops').to.be.closeTo(expectedPlops, 0.1);
                expect(getPlopsFromLabel($('#current-plops')), 'wrong plops displayed').to.be.closeTo(expectedPlops, 0.1);

                expect(gameState.buildingLevelController.getBottleCaps(), 'wrong bottle caps').to.be.closeTo(expectedBottleCaps, 0.1);
                expect(getPlopsFromLabel($('#panel-bottle-cap-factory').find('.bottle-caps-amount')), 'wrong bottle caps displayed').to.be.closeTo(expectedBottleCaps, 0.1);

                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(2);

                const levelUp = gameEventBusBuyBuildingSpy.getCall(1).args[1];

                expect(levelUp.building, 'leveled up the wrong building').to.equal(building);
                expect(levelUp.level, 'leveled up the wrong amount').to.equal(2);
            });

            it('should not level up buildings if the local switch is disabled' + testedObject, function () {
                resetLevelUpInitialState();
                beerFactoryState.autoLevelUpDisabled = false;
                beerFactoryState.equippedBuildings[building].autoLevelUp = false;

                gameState.addPlops(initialPlops);
                gameState.buildingLevelController.addBottleCaps(initialBottleCaps);

                expect(getLevelCallback()).to.equal(1);
                expect(gameState.getPlops()).to.equal(initialPlops);
                expect(gameState.buildingLevelController.getBottleCaps()).to.equal(initialBottleCaps);
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(2);
            });

            it('should have a local configuration' + testedObject, function (done) {
                // base plates must be enabled for the slot control inside the building details modal
                beerFactoryState.materials.basePlate.enabled = true;

                const modal = $('#building-details-modal');

                modal.on('shown.bs.modal', () => {
                    expect($('#beer-factory__toggle-auto-level-up').length, 'local toggle not present').to.equal(1);
                    expect(
                        modal.find('.beer-factory__slot').hasClass('beer-factory__slot--active'),
                        'local toggle is active'
                    ).to.equal(false);

                    modal.off('shown.bs.modal');

                    done();
                });

                $('#building-container-popover-' + building).trigger('click');
            }).timeout(40000);

            it('should level up buildings if the local switch is enabled' + testedObject, function () {
                gameEventBusAutoLevelUpSwitch = sinon.spy();
                gameEventBus.on(EVENTS.BEER_FACTORY.AUTO_LEVEL_UP, gameEventBusAutoLevelUpSwitch);

                $('#beer-factory__toggle-auto-level-up').trigger('change');

                expect(getLevelCallback()).to.equal(2);

                expect(gameState.getPlops(), 'wrong plops').to.be.closeTo(expectedPlops, 0.1);
                expect(getPlopsFromLabel($('#current-plops')), 'wrong plops displayed').to.be.closeTo(expectedPlops, 0.1);

                expect(gameState.buildingLevelController.getBottleCaps(), 'wrong bottle caps').to.be.closeTo(expectedBottleCaps, 0.1);
                expect(getPlopsFromLabel($('#panel-bottle-cap-factory').find('.bottle-caps-amount')), 'wrong bottle caps displayed').to.be.closeTo(expectedBottleCaps, 0.1);

                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(3);

                const levelUp = gameEventBusBuyBuildingSpy.getCall(2).args[1];

                expect(levelUp.building, 'leveled up the wrong building').to.equal(building);
                expect(levelUp.level, 'leveled up the wrong amount').to.equal(2);

                expect(
                    $('#building-details-modal').find('.beer-factory__slot').hasClass('beer-factory__slot--active'),
                    'local toggle is not active'
                ).to.equal(true);
            });

            it('should trigger the EVENTS.BEER_FACTORY.AUTO_LEVEL_UP event when the local switch is enabled' + testedObject, function () {
                expect(beerFactoryState.equippedBuildings[building].autoLevelUp).to.equal(true);
                expect(gameEventBusAutoLevelUpSwitch.callCount).to.equal(1);
                expect(gameEventBusAutoLevelUpSwitch.getCall(0).args[1].enabled).to.equal(true);
                expect(gameEventBusAutoLevelUpSwitch.getCall(0).args[1].building).to.equal(building);
            });

            it('should trigger the EVENTS.BEER_FACTORY.AUTO_LEVEL_UP event when the local switch is disabled' + testedObject, function (done) {
                $('#beer-factory__toggle-auto-level-up').trigger('change');

                expect(beerFactoryState.equippedBuildings[building].autoLevelUp).to.equal(false);
                expect(gameEventBusAutoLevelUpSwitch.callCount).to.equal(2);
                expect(gameEventBusAutoLevelUpSwitch.getCall(1).args[1].enabled).to.equal(false);
                expect(gameEventBusAutoLevelUpSwitch.getCall(1).args[1].building).to.equal(building);

                gameEventBus.off(event, gameEventBusBuyBuildingSpy);
                gameEventBus.off(EVENTS.BEER_FACTORY.AUTO_LEVEL_UP, gameEventBusAutoLevelUpSwitch);

                beerFactoryState.equippedBuildings[building].autoLevelUp = false;

                const modal = $('#building-details-modal');

                modal.on('hidden.bs.modal', () => {
                    modal.off('hidden.bs.modal');
                    done();
                });

                modal.modal('hide');
            }).timeout(4000);
        });
    });

    after(function () {
        beerFactoryState.equippedBuildings = {};
    })
});

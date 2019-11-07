
describe('Auto Buyer', function () {
    let gameState        = new Beerplop.GameState(),
        gameEventBus     = new Beerplop.GameEventBus(),
        beerFactory      = new Minigames.BeerFactory(),
        beerFactoryState = beerFactory.state.getState(),
        slotController   = beerFactory.getSlotController();

    describe('The global auto buyer switch', function () {
        let gameEventBusAutoBuyerSwitch = sinon.spy();

        it('should be invisible if no building is equipped with an auto buyer', function () {
            beerFactoryState.equippedBuildings = {};
            beerFactoryState.autoBuyerDisabled = false;

            beerFactory.state.checkAdvancedBuyControlEnable();

            expect($('.buy-control__advanced').hasClass('d-none')).to.equal(true);
            expect($('.buy-control__advanced--auto-buyer').hasClass('d-none')).to.equal(true);
        });

        it('should be visible if any building is equipped with an auto buyer', function () {
            beerFactoryState.equippedBuildings['automatedBar'] = {
                slots: [{
                    equip: EQUIPMENT_ITEM__DIASTATIC,
                    state: EQUIPMENT_STATE__FINISHED,
                }],
            };

            beerFactory.state.checkAdvancedBuyControlEnable();

            expect($('.buy-control__advanced').hasClass('d-none')).to.equal(false);
            expect($('.buy-control__advanced--auto-buyer').hasClass('d-none')).to.equal(false);
        });

        it('should trigger the EVENTS.BEER_FACTORY.AUTO_BUYER event when being disabled', function () {
            gameEventBus.on(EVENTS.BEER_FACTORY.AUTO_BUYER, gameEventBusAutoBuyerSwitch);

            $('#buy-advanced__toggle-auto-buyer').trigger('change');

            expect(beerFactoryState.autoBuyerDisabled).to.equal(true);
            expect(gameEventBusAutoBuyerSwitch.callCount).to.equal(1);
            expect(gameEventBusAutoBuyerSwitch.getCall(0).args[1].enabled).to.equal(false);
            expect(gameEventBusAutoBuyerSwitch.getCall(0).args[1].building).to.equal('global');
        });

        it('should trigger the EVENTS.BEER_FACTORY.AUTO_BUYER event when being enabled', function () {
            $('#buy-advanced__toggle-auto-buyer').trigger('change');

            expect(beerFactoryState.autoBuyerDisabled).to.equal(false);
            expect(gameEventBusAutoBuyerSwitch.callCount).to.equal(2);
            expect(gameEventBusAutoBuyerSwitch.getCall(1).args[1].enabled).to.equal(true);
            expect(gameEventBusAutoBuyerSwitch.getCall(1).args[1].building).to.equal('global');

            gameEventBus.off(EVENTS.BEER_FACTORY.AUTO_BUYER, gameEventBusAutoBuyerSwitch);
        });
    });

    describe('A building without an equipped auto buyer', function () {
        let gameEventBusBuyBuildingSpy = sinon.spy();

        it('should be disabled when the global switch is disabled', function () {
            gameState.resetInitialState();
            gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);

            expect(slotController.isAutoBuyerEnabled('opener')).to.equal(false);
        });

        it('should be disabled when the global switch is enabled', function () {
            beerFactoryState.autoBuyerDisabled = false;
            expect(slotController.isAutoBuyerEnabled('opener')).to.equal(false);
        });

        it('should not purchase buildings if enough plops are available', function () {
            gameState.addPlops(10);

            expect(gameState.getBuildingData('opener').amount).to.equal(0);
            expect(gameEventBusBuyBuildingSpy.callCount).to.equal(0);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);
        });
    });

    describe('A building with an equipped auto buyer', function () {
        let gameEventBusBuyBuildingSpy  = sinon.spy(),
            gameEventBusAutoBuyerSwitch = sinon.spy();

        it('should be disabled when auto buyer is under construction', function () {
            gameState.resetInitialState();

            beerFactoryState.autoBuyerDisabled = false;
            beerFactoryState.equippedBuildings = {};
            beerFactoryState.equippedBuildings['opener'] = {
                autoBuyer: true,
                slots: [{
                    equip: EQUIPMENT_ITEM__DIASTATIC,
                    state: EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                }],
            };
            beerFactoryState.equippedBuildings['bottleCapFactory'] = {
                autoBuyer: true,
                slots: [{
                    equip: EQUIPMENT_ITEM__DIASTATIC,
                    state: EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                }],
            };

            expect(slotController.isAutoBuyerEnabled('opener')).to.equal(false);
            expect(slotController.isAutoBuyerEnabled('bottleCapFactory')).to.equal(false);
        });

        it('should be disabled when the global switch is disabled', function () {
            beerFactoryState.autoBuyerDisabled = true;

            beerFactoryState.equippedBuildings['opener'].slots[0].state           = EQUIPMENT_STATE__FINISHED;
            beerFactoryState.equippedBuildings['bottleCapFactory'].slots[0].state = EQUIPMENT_STATE__FINISHED;

            expect(slotController.isAutoBuyerEnabled('opener')).to.equal(false);
            expect(slotController.isAutoBuyerEnabled('bottleCapFactory')).to.equal(false);

        });

        it('should be enabled when the global and the local switch is enabled', function () {
            beerFactoryState.autoBuyerDisabled = false;
            expect(slotController.isAutoBuyerEnabled('opener')).to.equal(true);
            expect(slotController.isAutoBuyerEnabled('bottleCapFactory')).to.equal(true);
        });

        it('should be disabled when the local switch is disabled', function () {
            beerFactoryState.equippedBuildings['opener'].autoBuyer = false;
            beerFactoryState.equippedBuildings['bottleCapFactory'].autoBuyer = false;

            expect(slotController.isAutoBuyerEnabled('opener')).to.equal(false);
            expect(slotController.isAutoBuyerEnabled('bottleCapFactory')).to.equal(false);
        });

        const purchaseTestDataProvider = [
            {
                building: 'opener',
                initialPlops: 25,
                getAmountCallback: () => gameState.getBuildingData('opener').amount,
                event: EVENTS.CORE.BUILDING.PURCHASED,
            },
            {
                building: 'bottleCapFactory',
                initialPlops: 254,
                getAmountCallback: () => gameState.buildingLevelController.getBottleCapFactoriesAmount(),
                event: EVENTS.CORE.BOTTLE_CAP.PURCHASED,
            }
        ];

        purchaseTestDataProvider.forEach(({building, initialPlops, getAmountCallback, event}) => {
            const testedObject = ` [${building}]`;

            it('should purchase buildings if enough plops are added' + testedObject, function () {
                gameEventBusBuyBuildingSpy = sinon.spy();
                gameEventBus.on(event, gameEventBusBuyBuildingSpy);
                gameState.resetInitialState();

                beerFactoryState.equippedBuildings[building].autoBuyer = true;

                gameState.addPlops(initialPlops);

                expect(getAmountCallback()).to.equal(2);

                expect(gameState.getPlops()).to.equal(4);
                expect(getPlopsFromLabel($('#current-plops'))).to.equal(4);
            });

            it('should trigger the ' + event + ' event after purchasing buildings' + testedObject, function () {
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(1);

                const purchase = gameEventBusBuyBuildingSpy.getCall(0).args[1];

                expect(purchase.building, 'purchased the wrong building').to.equal(building);
                expect(purchase.amount, 'purchased the wrong amount').to.equal(2);
            });

            it('should not purchase buildings if the global switch is disabled' + testedObject, function () {
                gameState.resetInitialState();
                beerFactoryState.autoBuyerDisabled = true;

                gameState.addPlops(initialPlops);

                expect(getAmountCallback()).to.equal(0);
                expect(gameState.getPlops()).to.equal(initialPlops);
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(1);
            });

            it('should purchase buildings if the global switch is enabled' + testedObject, function () {
                $('#buy-advanced__toggle-auto-buyer').trigger('change');

                expect(getAmountCallback()).to.equal(2);

                expect(gameState.getPlops()).to.equal(4);
                expect(getPlopsFromLabel($('#current-plops'))).to.equal(4);
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(2);

                const purchase = gameEventBusBuyBuildingSpy.getCall(1).args[1];

                expect(purchase.building, 'purchased the wrong building').to.equal(building);
                expect(purchase.amount, 'purchased the wrong amount').to.equal(2);
            });

            it('should not purchase buildings if the local switch is disabled' + testedObject, function () {
                gameState.resetInitialState();
                beerFactoryState.autoBuyerDisabled = false;
                beerFactoryState.equippedBuildings[building].autoBuyer = false;

                gameState.addPlops(initialPlops);

                expect(getAmountCallback()).to.equal(0);
                expect(gameState.getPlops()).to.equal(initialPlops);
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(2);
            });

            it('should have a local configuration' + testedObject, function (done) {
                // base plates must be enabled for the slot control inside the building details modal
                beerFactoryState.materials.basePlate.enabled = true;

                $('#building-container-popover-' + building).trigger('click');

                const modal = $('#building-details-modal');

                modal.on('shown.bs.modal', () => {
                    expect($('#beer-factory__toggle-auto-buyer').length, 'local toggle not present').to.equal(1);
                    expect(
                        modal.find('.beer-factory__slot').hasClass('beer-factory__slot--active'),
                        'local toggle is active'
                    ).to.equal(false);

                    modal.off('shown.bs.modal');

                    done();
                });
            }).timeout(4000);

            it('should purchase buildings if the local switch is enabled' + testedObject, function () {
                gameEventBusAutoBuyerSwitch = sinon.spy();
                gameEventBus.on(EVENTS.BEER_FACTORY.AUTO_BUYER, gameEventBusAutoBuyerSwitch);

                $('#beer-factory__toggle-auto-buyer').trigger('change');

                expect(getAmountCallback()).to.equal(2);

                expect(gameState.getPlops()).to.equal(4);
                expect(getPlopsFromLabel($('#current-plops'))).to.equal(4);
                expect(gameEventBusBuyBuildingSpy.callCount).to.equal(3);

                const purchase = gameEventBusBuyBuildingSpy.getCall(2).args[1];

                expect(purchase.building, 'purchased the wrong building').to.equal(building);
                expect(purchase.amount, 'purchased the wrong amount').to.equal(2);

                expect(
                    $('#building-details-modal').find('.beer-factory__slot').hasClass('beer-factory__slot--active'),
                    'local toggle is not active'
                ).to.equal(true);
            });

            it('should trigger the EVENTS.BEER_FACTORY.AUTO_BUYER event when the local switch is enabled' + testedObject, function () {
                expect(beerFactoryState.equippedBuildings[building].autoBuyer).to.equal(true);
                expect(gameEventBusAutoBuyerSwitch.callCount).to.equal(1);
                expect(gameEventBusAutoBuyerSwitch.getCall(0).args[1].enabled).to.equal(true);
                expect(gameEventBusAutoBuyerSwitch.getCall(0).args[1].building).to.equal(building);
            });

            it('should trigger the EVENTS.BEER_FACTORY.AUTO_BUYER event when the local switch is disabled' + testedObject, function (done) {
                $('#beer-factory__toggle-auto-buyer').trigger('change');

                expect(beerFactoryState.equippedBuildings[building].autoBuyer).to.equal(false);
                expect(gameEventBusAutoBuyerSwitch.callCount).to.equal(2);
                expect(gameEventBusAutoBuyerSwitch.getCall(1).args[1].enabled).to.equal(false);
                expect(gameEventBusAutoBuyerSwitch.getCall(1).args[1].building).to.equal(building);

                gameEventBus.off(event, gameEventBusBuyBuildingSpy);
                gameEventBus.off(EVENTS.BEER_FACTORY.AUTO_BUYER, gameEventBusAutoBuyerSwitch);

                beerFactoryState.equippedBuildings[building].autoBuyer = false;

                const modal = $('#building-details-modal');

                modal.modal('hide');
                modal.on('hidden.bs.modal', () => {
                    modal.off('hidden.bs.modal');
                    done();
                });
            }).timeout(4000);
        });
    });
});

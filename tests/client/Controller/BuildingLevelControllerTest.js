
describe('BuildingLevelController', function () {
    let gameState    = new Beerplop.GameState(),
        gameEventBus = new Beerplop.GameEventBus();

    describe('The Bottle Cap Factory panel', function () {
        it('should be expanded initial', function () {
            expect(
                $('#panel-bottle-cap-factory').find('a').hasClass('collapsed'),
                'Panel should be expanded initial'
            ).to.equal(false);
        });

        it('should display the correct price for the first Bottle Cap Factory', function () {
            expect(getPlopsFromLabel($('#special-building-bottle-cap-factory').find('.cost-next-bottle-cap-factory')))
                .to.equal(100);
        });
    });

    describe('The buy bottle cap factory button', function () {
        const container = $('#special-building-bottle-cap-factory');

        let gameEventBusBuyBottleCapFactorySpy       = sinon.spy(),
            gameEventBusUpdateBottleCapProductionSpy = sinon.spy();

        it('should be disabled when not enough plops are available', function () {
            gameEventBus.on(EVENTS.CORE.BOTTLE_CAP.PURCHASED, gameEventBusBuyBottleCapFactorySpy);
            gameEventBus.on(EVENTS.CORE.BOTTLE_CAP.PRODUCTION_UPDATED, gameEventBusUpdateBottleCapProductionSpy);

            gameState.resetInitialState();
            gameState.getBuildingLevelController().resetInitialState();

            expect($('#buy-bottle-cap-factory').closest('.fieldset-buy').prop('disabled')).to.equal(true);
        });

        it('should not purchase a Bottle Cap Factory when disabled', function () {
            $('#buy-bottle-cap-factory').trigger('click');

            expect(gameState.getBuildingLevelController().getBottleCapFactoriesAmount()).to.equal(0);
            expect(container.find('.bottle-cap-factories').text()).to.equal('0');
        });

        it('should be an enabled button after purchasing enough plops', function () {
            gameState.addPlops(100);

            expect($('#buy-bottle-cap-factory').closest('.fieldset-buy').prop('disabled')).to.equal(false);
        });

        it('should purchase one Bottle Cap Factory when enabled', function () {
            $('#buy-bottle-cap-factory').trigger('click');

            expect(gameState.getBuildingLevelController().getBottleCapFactoriesAmount()).to.equal(1);
            expect(container.find('.bottle-cap-factories').text()).to.equal('1');
            expect(gameState.getPlops()).to.equal(0);
        });

        it('should raise the price for the next Bottle Cap Factory', function () {
            expect(getPlopsFromLabel(container.find('.cost-next-bottle-cap-factory'))).to.equal(150);
        });

        it('should be disabled when not enough plops are available', function () {
            expect($('#buy-bottle-cap-factory').closest('.fieldset-buy').prop('disabled')).to.equal(true);
        });

        it('should trigger the EVENTS.CORE.BOTTLE_CAP.PURCHASED event', function () {
            expect(gameEventBusBuyBottleCapFactorySpy.callCount).to.equal(1);
            expect(gameEventBusBuyBottleCapFactorySpy.getCall(0).args[1].amount).to.equal(1);
            gameEventBus.off(EVENTS.CORE.BOTTLE_CAP.PURCHASED, gameEventBusBuyBottleCapFactorySpy);
        });

        it('should trigger the bottle-cap-production-updated event', function () {
            expect(gameEventBusUpdateBottleCapProductionSpy.callCount).to.equal(1);
            expect(gameEventBusUpdateBottleCapProductionSpy.getCall(0).args[1]).to.equal(0.1);
            gameEventBus.off(EVENTS.CORE.BOTTLE_CAP.PRODUCTION_UPDATED, gameEventBusUpdateBottleCapProductionSpy);
        });
    });

    describe('Setting the buy amount to 10 and buy bottle cap factories', function () {
        it('should be disabled when not enough plops are available', function () {
            const buyButton = $('#buy-bottle-cap-factory');
            gameState.addPlops(1000);
            expect(buyButton.closest('.fieldset-buy').prop('disabled'), 'Buy 1 should be enabled').to.equal(false);

            $('#buy-amount-10').trigger('click');
            expect(buyButton.closest('.fieldset-buy').prop('disabled'), 'Buy 10 should be disabled').to.equal(true);
        });

        it('should not purchase a Bottle Cap Factory when disabled', function () {
            $('#buy-bottle-cap-factory').trigger('click');
            expect(gameState.getBuildingLevelController().getBottleCapFactoriesAmount()).to.equal(1);
        });

        it('should be an enabled button after purchasing enough plops', function () {
            gameState.addPlops(20000);

            expect($('#buy-bottle-cap-factory').closest('.fieldset-buy').prop('disabled')).to.equal(false);
            $('#buy-amount-1').trigger('click');
        });
    });
});
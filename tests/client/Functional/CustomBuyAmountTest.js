
describe('CustomBuyAmount', function () {
    let gameState    = new Beerplop.GameState(),
        gameEventBus = new Beerplop.GameEventBus();

    describe('Switch to a custom buy charge', function () {
        let gameEventBusUpdateBuyAmountSpy = sinon.spy();

        it('should be preconfigured', function () {
            gameState.resetInitialState();
            const button = $('#buy-amount-custom');
            expect(button.data('amount')).to.equal(50);
            expect(button.text()).to.equal('50');
        });

        it('should raise the price for the next opener', function () {
            gameEventBus.on(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameEventBusUpdateBuyAmountSpy);

            $('#buy-amount-custom').trigger('click');
            expect(getPlopsFromLabel($('#cost-next-opener'))).to.equal(11665);
        });

        it ('should update the buy amount', function () {
            expect(gameState.getBuyAmount()).to.equal(50);
            expect(gameState.isBuyChargeOnMaxBuyAmount()).to.equal(false);
        });

        it('should trigger the update-buy-amount event', function () {
            expect(gameEventBusUpdateBuyAmountSpy.callCount).to.equal(1);
            expect(gameEventBusUpdateBuyAmountSpy.getCall(0).args[1]).to.equal(50);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusUpdateBuyAmountSpy);
        });

        it('should purchase the configured custom buy amount', function () {
            gameState.addPlops(11670);

            $('#buy-building-opener').trigger('click');
            expect(gameState.getBuildingData('opener').amount).to.equal(50);
            expect(parseInt($('#building-container-opener').find('.amount-opener').text())).to.equal(50);
            expect(gameState.getPlops()).to.equal(5);
        });
    });

    describe('Configure a custom buy charge while the custom buy charge is active', function () {
        let gameEventBusUpdateBuyAmountSpy = sinon.spy();

        it('should be available via the configure button', function (done) {
            gameState.resetInitialState();
            $('#buy-amount-custom__configure').trigger('click');

            $('#buy-amount-configure-modal').on('shown.bs.modal', () => {
                $('#buy-amount-configure-modal').off('shown.bs.modal');
                done();
            });
        }).timeout(2000);

        it('should be prefilled with the currently configured custom buy charge', function () {
            expect($('#buy-amount-configure').val()).to.equal('50');
        });

        it('should update the custom buy charge button', function (done) {
            gameEventBus.on(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameEventBusUpdateBuyAmountSpy);

            const modal  = $('#buy-amount-configure-modal'),
                  button = $('#buy-amount-custom');

            $('#buy-amount-configure').val(2);
            modal.find('.btn-success').trigger('click');

            expect(button.data('amount')).to.equal(2);
            expect(button.text()).to.equal('2');

            modal.on('hidden.bs.modal', () => {
                modal.off('hidden.bs.modal');
                done();
            });
        }).timeout(2000);

        it('should update the price for openers', function () {
            expect(getPlopsFromLabel($('#cost-next-opener'))).to.equal(21);
        });

        it ('should update the buy amount', function () {
            expect(gameState.getBuyAmount()).to.equal(2);
        });

        it('should trigger the update-buy-amount event', function () {
            expect(gameEventBusUpdateBuyAmountSpy.callCount).to.equal(1);
            expect(gameEventBusUpdateBuyAmountSpy.getCall(0).args[1]).to.equal(2);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusUpdateBuyAmountSpy);
        });

        it('should purchase the configured custom buy amount', function () {
            gameState.addPlops(30);

            $('#buy-building-opener').trigger('click');
            expect(gameState.getBuildingData('opener').amount).to.equal(2);
            expect(parseInt($('#building-container-opener').find('.amount-opener').text())).to.equal(2);
            expect(gameState.getPlops()).to.equal(9);
        });

        it('should update the price for the next purchase', function () {
            expect(getPlopsFromLabel($('#cost-next-opener'))).to.equal(27);
        });
    });

    describe("Changing the custom buy charge while it's inactive", function() {
        let gameEventBusUpdateBuyAmountSpy = sinon.spy();

        it('should open the configuration if another buy charge is selected', function (done) {
            gameState.resetInitialState();

            $('#buy-amount-1').trigger('click');
            expect(parseInt($('#cost-next-opener').text())).to.equal(10);

            $('#buy-amount-custom__configure').trigger('click');

            $('#buy-amount-configure-modal').on('shown.bs.modal', () => {
                $('#buy-amount-configure-modal').off('shown.bs.modal');
                done();
            });
        });

        it('should update the custom buy charge button', function (done) {
            gameEventBus.on(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameEventBusUpdateBuyAmountSpy);

            const modal  = $('#buy-amount-configure-modal'),
                  button = $('#buy-amount-custom');

            $('#buy-amount-configure').val(20);
            modal.find('.btn-success').trigger('click');

            expect(button.data('amount')).to.equal(20);
            expect(button.text()).to.equal('20');

            modal.on('hidden.bs.modal', () => {
                modal.off('shown.bs.modal');
                done();
            });
        }).timeout(2000);

        it('should not update the buy amount', function () {
            expect(parseInt($('#cost-next-opener').text())).to.equal(10);
            expect(gameState.getBuyAmount()).to.equal(1);
        });

        it('should not trigger the update-buy-amount event', function () {
            expect(gameEventBusUpdateBuyAmountSpy.callCount).to.equal(0);
            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusUpdateBuyAmountSpy);
        });

        it('should purchase the selected buy charge amount', function () {
            gameState.addPlops(15);

            $('#buy-building-opener').trigger('click');
            expect(gameState.getBuildingData('opener').amount).to.equal(1);
            expect(parseInt($('#building-container-opener').find('.amount-opener').text())).to.equal(1);
            expect(gameState.getPlops()).to.equal(5);
        });
    });
});

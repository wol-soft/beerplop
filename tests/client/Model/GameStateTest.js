
describe('GameState', function () {
    let gameState    = new Beerplop.GameState(),
        gameEventBus = new Beerplop.GameEventBus();

    describe('The initial game state', function () {
        it('should be set to 0', function () {
            gameState.resetInitialState();
            (new Beerplop.AchievementController()).reset();

            gameState.updatePlopsPerSecond();

            expect(gameState.getAutoPlopsPerSecond()).to.equal(0);
            expect(gameState.getPlops()).to.equal(0);
            expect(gameState.getTotalPlops()).to.equal(0);

            expect(gameState.getBeerClicks()).to.equal(0);
            expect(gameState.getAllTimeBeerClicks()).to.equal(0);
        });

        it('should display the correct price for the first Opener', function () {
            expect(getPlopsFromLabel($('#cost-next-opener'))).to.equal(10);
        });
    });
    describe('A click on the beer without buildings', function () {
        let gameEventBusManualClickSpy = sinon.spy();

        it('should give one plop', function () {
            $('.manual-plop').remove();

            gameEventBus.on(EVENTS.CORE.CLICK, gameEventBusManualClickSpy);
            $('#beer').find('use').trigger('click');

            expect(ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP).getValue()).to.equal(1);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(0);
            expect(gameState.getPlops()).to.equal(1);
            expect(gameState.getAllTimePlops()).to.equal(1);

            expect(getPlopsFromLabel($('#current-plops'))).to.equal(1);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(1);
        });

        it('should increase the manual plops', function () {
            expect(gameState.getManualPlops()).to.equal(1);

            expect(gameState.getBeerClicks()).to.equal(1);
            expect(gameState.getAllTimeBeerClicks()).to.equal(1);

            expect(getPlopsFromLabel($('#manual-plops'))).to.equal(1);
        });

        it('should spawn a plop flyout label', function () {
            const plopLabel = $('.manual-plop');
            expect(plopLabel.length).to.equal(1);
            expect(getPlopsFromLabel(plopLabel)).to.equal(1);
        });

        it('should trigger the manual-click event', function () {
            expect(gameEventBusManualClickSpy.callCount).to.equal(1);

            const spyCall = gameEventBusManualClickSpy.getCall(0);

            // test two sent data arguments set to 1 (allTimeClicks, manualPlops)
            expect(spyCall.args[1]).to.equal(1);
            expect(spyCall.args[2]).to.equal(1);

            gameEventBus.off(EVENTS.CORE.CLICK, gameEventBusManualClickSpy);
        });
    });

    describe('Buy one opener', function () {
        let gameEventBusBuyBuildingSpy = sinon.spy();

        it('should be a disabled button to buy a building', function () {
            gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);

            expect($('#buy-building-opener').closest('.fieldset-buy').prop('disabled')).to.equal(true);
        });

        it('should not add an opener if there are not enough plops available', function () {
            gameState.addPlops(8);
            $('#buy-building-opener').trigger('click');

            expect(gameState.getAutoPlopsPerSecond()).to.equal(0);
            expect(gameState.getPlops()).to.equal(9);
            expect(gameState.getBuildingData('opener').amount).to.equal(0);
        });

        it('should be an enabled button to buy a building after earning enough plops', function () {
            $('#beer').find('use').trigger('click');
            gameState.iterate();
            expect($('#buy-building-opener').closest('.fieldset-buy').prop('disabled')).to.equal(false);

            gameState.addPlops(11);
        });

        it('should add an opener if enough plops are available', function () {
            $('#buy-building-opener').trigger('click');
            expect(gameState.getBuildingData('opener').amount).to.equal(1);
            expect(parseInt($('#building-container-opener').find('.amount-opener').text())).to.equal(1);
        });
        
        it('should increase the auto plop rate', function () {
            expect(gameState.getAutoPlopsPerSecond()).to.be.closeTo(0.1, 0.1);
            expect(getPlopsFromLabel($('#auto-plops'))).to.equal(0.1);
        });
        
        it('should remove plops from the available plops', function () {
            expect(gameState.getPlops()).to.equal(11);
        });

        it('should raise the price for the next opener', function () {
            expect(parseInt($('#cost-next-opener').text())).to.equal(11);
        });

        it('should trigger the building-bought event', function () {
            expect(gameEventBusBuyBuildingSpy.callCount).to.equal(1);

            const purchase = gameEventBusBuyBuildingSpy.getCall(0).args[1];

            expect(purchase.building).to.equal('opener');
            expect(purchase.amount).to.equal(1);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);
        });
    });

    describe('Set the buy amount to ten and buy openers', function () {
        let gameEventBusBuyBuildingSpy = sinon.spy(),
            gameEventBusUpdateBuyAmountSpy = sinon.spy();

        it('should raise the price for one transaction', function () {
            gameEventBus.on(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameEventBusUpdateBuyAmountSpy);

            $('#buy-amount-10').trigger('click');
            expect(parseInt($('#cost-next-opener').text())).to.equal(180);
        });

        it('should trigger the update-buy-amount event', function () {
            expect(gameEventBusUpdateBuyAmountSpy.callCount).to.equal(1);
            expect(gameEventBusUpdateBuyAmountSpy.getCall(0).args[1]).to.equal(10);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusUpdateBuyAmountSpy);
        });

        it('should not add ten openers if there are not enough plops available', function () {
            gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);

            $('#buy-building-opener').trigger('click');
            expect(gameState.getBuildingData('opener').amount).to.equal(1);
        });

        it('should add ten openers', function () {
            gameState.addPlops(200);
            $('#buy-building-opener').trigger('click');
            expect(gameState.getBuildingData('opener').amount).to.equal(11);
            expect(parseInt($('#building-container-opener').find('.amount-opener').text())).to.equal(11);
        });

        it('should increase the auto plop rate', function () {
            expect(gameState.getAutoPlopsPerSecond()).to.be.closeTo(1.2, 0.1);
            expect(getPlopsFromLabel($('#auto-plops'))).to.equal(1.2);
        });

        it('should remove plops from the available plops', function () {
            expect(gameState.getPlops()).to.equal(31);
        });

        it('should raise the price for the next ten openers', function () {
            expect(parseInt($('#cost-next-opener').text())).to.equal(459);
        });

        it('should trigger the building-bought event', function () {
            expect(gameEventBusBuyBuildingSpy.callCount).to.equal(1);

            const purchase = gameEventBusBuyBuildingSpy.getCall(0).args[1];

            expect(purchase.building).to.equal('opener');
            expect(purchase.amount).to.equal(10);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);
        });

        it ('should update the buy amount', function () {
            expect(gameState.getBuyAmount()).to.equal(10);
        });
    });

    describe('Reset the buy amount to 1', function () {
        let gameEventBusUpdateBuyAmountSpy = sinon.spy();

        it('should lower the price for the next opener', function () {
            gameEventBus.on(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameEventBusUpdateBuyAmountSpy);

            $('#buy-amount-1').trigger('click');
            expect(parseInt($('#cost-next-opener').text())).to.equal(29);
        });

        it('should trigger the update-buy-amount event', function () {
            expect(gameEventBusUpdateBuyAmountSpy.callCount).to.equal(1);
            expect(gameEventBusUpdateBuyAmountSpy.getCall(0).args[1]).to.equal(1);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusUpdateBuyAmountSpy);
        });

        it ('should update the buy amount', function () {
            expect(gameState.getBuyAmount()).to.equal(1);
        });
    });

    describe('Set the buy amount to MAX and buy openers', function () {
        let amount = 0, cost = 0,
            gameEventBusBuyBuildingSpy = sinon.spy(),
            gameEventBusUpdateBuyAmountSpy = sinon.spy();

        const label     = $('#available-buildings-opener'),
              fetchData = () => [amount, cost] = label.text()
                .match(/([\d,.]+)/g)
                .map(n => parseFloat(n.replace(',', '.')));

        it('should exchange the cost label with an amount label', function () {
            gameEventBus.on(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameEventBusUpdateBuyAmountSpy);

            gameState.updatePlops(50);
            $('#buy-amount-max').trigger('click');
            expect(
                $('#cost-next-opener').closest('.building-container__costs-label').hasClass('d-none')
            ).to.equal(true);

            expect(
                $('#available-buildings-opener').closest('.building-container__costs-label').hasClass('d-none')
            ).to.equal(false);
        });

        it('should switch the buy charge', function () {
            expect(gameState.isBuyChargeOnMaxBuyAmount()).to.equal(true);
        });

        it('should trigger the update-buy-amount event', function () {
            expect(gameEventBusUpdateBuyAmountSpy.callCount).to.equal(1);
            expect(gameEventBusUpdateBuyAmountSpy.getCall(0).args[1]).to.equal('max');

            gameEventBus.off(EVENTS.CORE.BUY_AMOUNT_UPDATED, gameEventBusUpdateBuyAmountSpy);
        });

        it ('should update the buy amount', function () {
            expect(gameState.getBuyAmount()).to.equal('max');
        });

        it('should be an enabled button if at least one building is available', function () {
            expect($('#buy-building-opener').closest('.fieldset-buy').prop('disabled')).to.equal(false);
        });

        it('should calculate the available amount and the costs', function () {
            fetchData();
            expect(amount).to.equal(1);
            expect(cost).to.equal(29);

            gameState.updatePlops(300);

            fetchData();
            expect(amount).to.equal(7);
            expect(cost).to.equal(273);
        });

        it('should add the max available building amount', function () {
            gameEventBus.on(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);

            $('#buy-building-opener').trigger('click');
            expect(gameState.getBuildingData('opener').amount).to.equal(18);
            expect(parseInt($('#building-container-opener').find('.amount-opener').text())).to.equal(18);
        });

        it('should increase the auto plop rate', function () {
            expect(gameState.getAutoPlopsPerSecond()).to.be.closeTo(1.9, 0.1);
        });

        it('should remove plops from the available plops', function () {
            expect(gameState.getPlops()).to.equal(27);
        });

        it('should update the available amount and the costs for the available opener to zero', function () {
            fetchData();
            expect(amount).to.equal(0);
            expect(cost).to.equal(0);
        });

        it('should be a disabled button after purchasing the max amount', function () {
            expect($('#buy-building-opener').closest('.fieldset-buy').prop('disabled')).to.equal(true);
        });

        it('should trigger the building-bought event', function () {
            expect(gameEventBusBuyBuildingSpy.callCount).to.equal(1);

            const purchase = gameEventBusBuyBuildingSpy.getCall(0).args[1];

            expect(purchase.building).to.equal('opener');
            expect(purchase.amount).to.equal(7);

            gameEventBus.off(EVENTS.CORE.BUILDING.PURCHASED, gameEventBusBuyBuildingSpy);
        });
    });

    describe('Reset the buy amount to 1', function () {
        it('should exchange the amount label with a cost label', function () {
            $('#buy-amount-1').trigger('click');
            expect(
                $('#cost-next-opener').closest('.building-container__costs-label').hasClass('d-none')
            ).to.equal(false);

            expect(
                $('#available-buildings-opener').closest('.building-container__costs-label').hasClass('d-none')
            ).to.equal(true);
        });

        it('should switch the buy charge', function () {
            expect(gameState.isBuyChargeOnMaxBuyAmount()).to.equal(false);
        });
    });

    describe('A click on the beer with buildings', function () {
        it('should produce more plops', function () {
            gameState.updatePlops(0);
            $('#beer').find('use').trigger('click');
            expect(gameState.getPlops()).to.be.closeTo(1.38, 0.01);
            expect(ComposedValueRegistry.getComposedValue(CV_MANUAL_PLOP).getValue()).to.be.closeTo(1.38, 0.01);
        });
    });

    describe('Changing the plop amount', function () {
        it('should update after calling addPlops', function () {
            gameState.resetInitialState();
            gameState.addPlops(100);

            expect(gameState.getPlops()).to.equal(100);
            expect(gameState.getAllTimePlops()).to.equal(100);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(100);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(100);
        });

        it('should not affect the manual plops', function () {
            expect(gameState.getManualPlops()).to.equal(0);
        });

        it('should update after calling removePlops', function () {
            expect(gameState.removePlops(50)).to.equal(true);

            expect(gameState.getPlops()).to.equal(50);
            expect(gameState.getAllTimePlops()).to.equal(100);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(50);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(100);
        });

        it('should be cancelled if not enough plops are available to remove', function () {
            expect(gameState.removePlops(51)).to.equal(false);
            expect(gameState.removePlops(50)).to.equal(true);
        });
    });

    describe('Changing external auto plop multiplier', function () {
        it('should update after adding a upgrade multiplier', function () {
            gameState.resetInitialState();
            gameState.updatePlopsPerSecond();

            expect(gameState.getPlops()).to.equal(0);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(0);

            gameState.addBuildings('opener', 10);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(1);

            // add 200% upgrade boost
            gameState.addUpgradeAutoPlopMultiplier(2);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(3);
            // test upgrade multiplier is multiplicative
            gameState.addUpgradeAutoPlopMultiplier(2);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(9);
        });

        it('should update after removing a upgrade multiplier', function () {
            gameState.removeUpgradeAutoPlopMultiplier(2);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(3);
            gameState.removeUpgradeAutoPlopMultiplier(2);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(1);
        });

        it('should update after adding a buff multiplier', function () {
            // triple by buff
            gameState.addBuffAutoPlopsMultiplier(3);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(3);
            // test buff multiplier is additive
            gameState.addBuffAutoPlopsMultiplier(3);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(6);
        });

        it('should update after removing a buff multiplier', function () {
            gameState.removeBuffAutoPlopsMultiplier(3);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(3);
            gameState.removeBuffAutoPlopsMultiplier(3);
            expect(gameState.getAutoPlopsPerSecond()).to.equal(1);
        });

        it('should update after adding an achievement multiplier', function () {
            gameState.state.achievementMultiplier = 4;
            gameState.updatePlopsPerSecond();
            expect(gameState.getAutoPlopsPerSecond()).to.equal(4);
        });

        it('should update after adding an achievement upgrade multiplier combined with an achievement multiplier', function () {
            gameState.addAchievementUpgradeMultiplier(3);
            expect(gameState.getAutoPlopsPerSecond()).to.be.closeTo(13, 0.1);
        });

        it('should update after removing an achievement multiplier', function () {
            // remove achievement multiplier. Now also the achievement upgrade multiplier must not be considered
            gameState.state.achievementMultiplier = 1;
            gameState.updatePlopsPerSecond();
            expect(gameState.getAutoPlopsPerSecond()).to.equal(1);
        });
    });

    describe('A manual click multiplier', function () {
        it('should affect the plops produced by a click', function () {
            gameState.resetInitialState();
            gameState.updatePlopsPerSecond();
            gameState.addManualClicksMultiplier(10);

            $('#beer').find('use').trigger('click');

            expect(gameState.getPlops()).to.equal(10);
            expect(gameState.getManualPlops()).to.equal(10);
            expect(gameState.getBeerClicks()).to.equal(1);
        });

        it('should be additive when multiple multipliers are added', function () {
            gameState.addManualClicksMultiplier(10);

            $('#beer').find('use').trigger('click');

            expect(gameState.getPlops()).to.equal(30);
            expect(gameState.getManualPlops()).to.equal(30);
            expect(gameState.getBeerClicks()).to.equal(2);
        });

        it('should not affect the plops produced by a click after being removed', function () {
            gameState.removeManualClicksMultiplier(20);

            $('#beer').find('use').trigger('click');

            expect(gameState.getPlops()).to.equal(31);
            expect(gameState.getManualPlops()).to.equal(31);
            expect(gameState.getBeerClicks()).to.equal(3);
        });
    });

    describe('The function addPlops', function () {
        let gameEventBusAddPlopsSpy    = sinon.spy(),
            gameEventBusUpdatePlopsSpy = sinon.spy();

        it('should add plops', function () {
            gameEventBus.on(EVENTS.CORE.PLOPS.ADDED, gameEventBusAddPlopsSpy);
            gameEventBus.on(EVENTS.CORE.PLOPS.UPDATED, gameEventBusUpdatePlopsSpy);
            gameState.resetInitialState();
            gameState.updatePlopsPerSecond();

            gameState.addPlops(3);

            expect(gameState.getPlops()).to.equal(3);
            expect(gameState.getAllTimePlops()).to.equal(3);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(3);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(3);
        });

        it('should add a custom amount to total plops if a custom amount is given', function () {
            gameState.addPlops(10, 3);

            expect(gameState.getPlops()).to.equal(13);
            expect(gameState.getAllTimePlops()).to.equal(6);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(13);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(6);
        });

        it('should trigger the EVENTS.CORE.PLOPS.ADDED event', function () {
            expect(gameEventBusAddPlopsSpy.callCount).to.equal(2);
            expect(gameEventBusAddPlopsSpy.getCall(0).args[1]).to.equal(3);
            expect(gameEventBusAddPlopsSpy.getCall(1).args[1]).to.equal(10);
        });

        it('should trigger the EVENTS.CORE.PLOPS.UPDATED event', function () {
            expect(gameEventBusUpdatePlopsSpy.callCount).to.equal(2);
            expect(gameEventBusUpdatePlopsSpy.getCall(0).args[1]).to.equal(3);
            expect(gameEventBusUpdatePlopsSpy.getCall(1).args[1]).to.equal(13);
        });

        it('should add plops with disabled update', function () {
            gameState.addPlops(5, 0, false);

            expect(gameState.getPlops()).to.equal(18);
            expect(gameState.getAllTimePlops()).to.equal(11);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(18);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(11);
        });

        it('should add a custom amount to total plops if a custom amount is given with disabled update', function () {
            gameState.addPlops(1, 3, false);

            expect(gameState.getPlops()).to.equal(19);
            expect(gameState.getAllTimePlops()).to.equal(14);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(19);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(14);
        });

        it('should not trigger the EVENTS.CORE.PLOPS.ADDED event with disabled update', function () {
            expect(gameEventBusAddPlopsSpy.callCount).to.equal(2);
        });

        it('should not trigger the EVENTS.CORE.PLOPS.UPDATED event with disabled update', function () {
            expect(gameEventBusUpdatePlopsSpy.callCount).to.equal(2);
        });

        it('should not trigger events when the plop amount wasn\'t changed', function () {
            gameState.addPlops(0);

            expect(gameEventBusUpdatePlopsSpy.callCount).to.equal(2);
            expect(gameEventBusAddPlopsSpy.callCount).to.equal(2);

            expect(gameState.getPlops()).to.equal(19);
            expect(gameState.getAllTimePlops()).to.equal(14);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(19);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(14);
        });

        it('should not trigger events when only a custom amount is given', function () {
            gameState.addPlops(0, 2);

            expect(gameEventBusUpdatePlopsSpy.callCount).to.equal(2);
            expect(gameEventBusAddPlopsSpy.callCount).to.equal(2);

            expect(gameState.getPlops()).to.equal(19);
            expect(gameState.getAllTimePlops()).to.equal(16);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(19);
            expect(getPlopsFromLabel($('#total-plops'))).to.equal(16);

            gameEventBus.off(EVENTS.CORE.PLOPS.ADDED, gameEventBusAddPlopsSpy);
            gameEventBus.off(EVENTS.CORE.PLOPS.UPDATED, gameEventBusUpdatePlopsSpy);
        });
    });

    describe('The function removePlops', function () {
        let gameEventBusRemovedPlopsSpy = sinon.spy(),
            gameEventBusUpdatePlopsSpy  = sinon.spy();

        it('should return false if not enough plops are available', function () {
            gameEventBus.on(EVENTS.CORE.PLOPS.REMOVED, gameEventBusRemovedPlopsSpy);
            gameEventBus.on(EVENTS.CORE.PLOPS.UPDATED, gameEventBusUpdatePlopsSpy);

            gameState.resetInitialState();
            gameState.updatePlopsPerSecond();

            expect(gameState.removePlops(1)).to.equal(false);
        });

        it('should not trigger events if not enough plops are available', function () {
            expect(gameEventBusRemovedPlopsSpy.callCount).to.equal(0);
            expect(gameEventBusUpdatePlopsSpy.callCount).to.equal(0);
        });

        it('should remove the requested amount of plops', function () {
            // call without update to avoid triggering the EVENTS.CORE.PLOPS.UPDATED event
            gameState.addPlops(10, 0, false);

            expect(gameState.removePlops(4)).to.equal(true);
            expect(gameState.getPlops()).to.equal(6);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(6);
        });

        it('should trigger the EVENTS.CORE.PLOPS.REMOVED event', function () {
            expect(gameEventBusRemovedPlopsSpy.callCount).to.equal(1);
            expect(gameEventBusRemovedPlopsSpy.getCall(0).args[1]).to.equal(4);
        });

        it('should trigger the EVENTS.CORE.PLOPS.UPDATED event', function () {
            expect(gameEventBusUpdatePlopsSpy.callCount).to.equal(1);
            expect(gameEventBusUpdatePlopsSpy.getCall(0).args[1]).to.equal(6);
        });

        it('should remove the requested amount of plops with disabled update', function () {
            expect(gameState.removePlops(6, false)).to.equal(true);
            expect(gameState.getPlops()).to.equal(0);
            expect(getPlopsFromLabel($('#current-plops'))).to.equal(0);
        });

        it('should not trigger events with disabled update', function () {
            expect(gameEventBusRemovedPlopsSpy.callCount).to.equal(1);
            expect(gameEventBusUpdatePlopsSpy.callCount).to.equal(1);

            gameEventBus.off(EVENTS.CORE.PLOPS.REMOVED, gameEventBusRemovedPlopsSpy);
            gameEventBus.off(EVENTS.CORE.PLOPS.UPDATED, gameEventBusUpdatePlopsSpy);
        });
    });

    describe('Reaching an achievement', function () {
        it('should increase the achievementMultiplier', function () {
            gameState.resetInitialState();
            gameState.updatePlopsPerSecond();

            gameEventBus.emit(EVENTS.CORE.ACHIEVEMENT_REACHED, {title:'test', key:'test', description:'test'});

            expect(gameState.state.achievementMultiplier).to.equal(1.01);
        });
    });

    // TODO: test: add plops
    describe('A core iteration', function () {
        let coreIterationSpy     = sinon.spy(),
            coreIterationLongSpy = sinon.spy();

        it('increases the core iteration counter', function () {
            gameState.resetInitialState();

            gameEventBus.on(EVENTS.CORE.ITERATION, coreIterationSpy);
            gameEventBus.on(EVENTS.CORE.ITERATION_LONG, coreIterationLongSpy);

            expect(gameState.coreIterations).to.equal(0);
            gameState.iterate();
            expect(gameState.coreIterations).to.equal(1);
        });

        it('triggers the core iteration event', function () {
            expect(coreIterationSpy.callCount).to.equal(1);
        });

        it('does not trigger the core iteration long event', function () {
            expect(coreIterationLongSpy.callCount).to.equal(0);
        });

        it('triggers the core iteration long event each 60 core iterations', function () {
            gameState.coreIterations = 59;
            gameState.iterate();
            expect(gameState.coreIterations).to.equal(60);
            expect(coreIterationLongSpy.callCount).to.equal(1);
        });

        it('triggers the core iteration event additionally to the core iteration long event', function () {
            expect(coreIterationSpy.callCount).to.equal(2);
        });
    });

    // TODO: Building cost modifier tests
});


describe('Beer Factories', function () {
    let gameEventBus = new Beerplop.GameEventBus(),
        beerFactory = new Minigames.BeerFactory();

    describe('The Beer Factories overlay toggle', function () {
        it('should be disabled by default', function () {
            beerFactory.state.extendState({});
            expect($('#enter-beer-factory').hasClass('d-none')).to.equal(true);
        });

        it('should be visible after unlocking the Beer Factories', function () {
            beerFactory.unlockBeerFactory();
            expect($('#enter-beer-factory').hasClass('d-none')).to.equal(false);
            expect($('#enter-beer-factory__queued-jobs').text()).to.equal('0');
            expect($('#beer-factory-container').text().trim()).to.equal('');
        });

        it('should open the Beer Factories overlay when being clicked', function () {
            $('#enter-beer-factory').trigger('click');
            expect($('#beer-factory-overlay__container').hasClass('active-overlay'));
            expect($('#beer-factory-container').text().trim()).to.not.equal('');
        });
    });

    describe('The initial Beer Factory state', function () {
        it('Should have no jobs in the build queue', function () {
            expect($('#build-queue__queued-jobs').text()).to.equal('0');
            expect($('#build-queue__max-jobs').text()).to.equal('5');
            expect(beerFactory.state.getBuildQueue().length).to.equal(0);
        });

        it('Should have unlocked the materials wood and strong wood', function () {
            expect($('#beer-factory__stock').find('.beer-factory__stock__container').length).to.equal(2);
        });

        it('Should have no materials in the stock', function () {
            expect($('#beer-factory__stock__amount-wood').text()).to.equal('0');
            expect($('#beer-factory__stock__amount-strongWood').text()).to.equal('0');
            expect($('#beer-factory__stock__total').text()).to.equal('0');
        });

        it('Should have unlocked the manual wood production', function () {
            const container = $('#beer-factory__wood');

            expect($('.beer-factory__building-container').length).to.equal(1);
            expect(container.hasClass('beer-factory__factory-enabled')).to.equal(false);

            container.find('.beer-factory__manual-harvest').trigger('click');
            expect($('#beer-factory__stock__total').text()).to.equal('1');

            // it's random which of the materials is produced
            expect(
                parseInt($('#beer-factory__stock__amount-wood').text()) +
                parseInt($('#beer-factory__stock__amount-strongWood').text())
            ).to.equal(1);
        });
    });

    describe('The wood factory', function () {
        const gameEventBusQueueAdd = sinon.spy();

        it('Should unlock after enough wood is added', function () {
            const container = $('#beer-factory__wood');

            do {
                container.find('.beer-factory__manual-harvest').trigger('click');
            } while (parseInt($('#beer-factory__stock__amount-wood').text()) < 11);

            expect(container.hasClass('beer-factory__factory-enabled')).to.equal(true);
        });

        it('Should add an entry to the build queue after clicking the queue build button', function () {
            gameEventBus.on(EVENTS.BEER_FACTORY.QUEUE.ADDED, gameEventBusQueueAdd);

            const container = $('#beer-factory__wood');

            container.find('.beer-factory__queue-build').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect($('#build-queue__queued-jobs').text()).to.equal('1');
            expect(buildQueue.length).to.equal(1);
            expect($('#enter-beer-factory__queued-jobs').text()).to.equal('1');

            expect(buildQueue[0].item).to.equal('wood');
            expect(buildQueue[0].action).to.equal(BUILD_QUEUE__BUILD);
            expect(buildQueue[0].hiddenJob).to.equal(false);
            expect(buildQueue[0].requiredItems).to.equal(30);

            expect(buildQueue[0].materials.length).to.equal(1);
            expect(buildQueue[0].materials[0].key).to.equal('wood');
            expect(buildQueue[0].materials[0].required).to.equal(30);
        });

        it('Should trigger the EVENTS.BEER_FACTORY.QUEUE.ADDED event', function () {
            expect(gameEventBusQueueAdd.callCount).to.equal(1);
            expect(gameEventBusQueueAdd.getCall(0).args[1]).to.equal(0);
        });

        it('Should be possible to add two wood factories to the build queue', function () {
            $('#beer-factory__wood').find('.beer-factory__queue-build').trigger('click');

            expect(gameEventBusQueueAdd.callCount).to.equal(2);
            expect(gameEventBusQueueAdd.getCall(1).args[1]).to.equal(1);

            const buildQueue = beerFactory.state.getBuildQueue();

            expect($('#build-queue__queued-jobs').text()).to.equal('2');
            expect(buildQueue.length).to.equal(2);
            expect($('#enter-beer-factory__queued-jobs').text()).to.equal('2');

            expect(buildQueue[1].item).to.equal('wood');
            expect(buildQueue[1].action).to.equal(BUILD_QUEUE__BUILD);
            expect(buildQueue[1].hiddenJob).to.equal(false);
            expect(buildQueue[1].requiredItems).to.equal(54);

            expect(buildQueue[1].materials.length).to.equal(1);
            expect(buildQueue[1].materials[0].key).to.equal('wood');
            expect(buildQueue[1].materials[0].required).to.equal(54);
        });

        it('Should not be possible to add three wood factories to the build queue', function () {
            $('#beer-factory__wood').find('.beer-factory__queue-build').trigger('click');

            expect($('#build-queue__queued-jobs').text()).to.equal('2');
            expect(beerFactory.state.getBuildQueue().length).to.equal(2);
            expect($('#enter-beer-factory__queued-jobs').text()).to.equal('2');

            expect($('#snackbar-container').find('.snackbar').slice(-1)[0].innerText)
                .to.equal("Queue limit reached. The requested job can't be queued more than 2 times");
        });

        it('Should not trigger the EVENTS.BEER_FACTORY.QUEUE.ADDED event if the queue limit is reached', function () {
            expect(gameEventBusQueueAdd.callCount).to.equal(2);
        });
    });
});

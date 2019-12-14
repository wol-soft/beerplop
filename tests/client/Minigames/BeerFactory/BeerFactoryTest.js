
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
            expect($('.beer-factory__building-container').length).to.equal(1);
            expect($('#beer-factory__wood').hasClass('beer-factory__factory-enabled')).to.equal(false);
        });

        it("Should add materials for manual production", function () {
            $('#beer-factory__wood').find('.beer-factory__manual-harvest').trigger('click');
            expect($('#beer-factory__stock__total').text()).to.equal('1');

            // it's random which of the materials is produced
            expect(
                parseInt($('#beer-factory__stock__amount-wood').text()) +
                parseInt($('#beer-factory__stock__amount-strongWood').text()),
                "Displayed amount doesn't match"
            ).to.equal(1);

            expect(
                beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount,
                "Stored amount doesn't match"
            ).to.equal(1);

            expect(
                beerFactory.state.getMaterial('wood').total + beerFactory.state.getMaterial('strongWood').total,
                "Total produced amount doesn't match"
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

            gameEventBus.off(EVENTS.BEER_FACTORY.QUEUE.ADDED, gameEventBusQueueAdd);
        });
    });

    describe('The Build Queue', function () {
        let gameEventBusBuildQueueFinishedSpy         = sinon.spy(),
            gameEventBusBuildQueueMaterialFinishedSpy = sinon.spy();

        it("Should not deliver materials if the required materials aren't available", function () {
            beerFactory.state.getMaterial('wood').amount = 0;
            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getMaterial('wood').amount).to.equal(0);

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].deliveredItems).to.equal(0);
            expect(buildQueue[0].materials[0].delivered).to.equal(0);
        });

        it("Should deliver all materials if the amount is lower than the transport capacity", function () {
            beerFactory.state.getMaterial('wood').amount = 2;
            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getMaterial('wood').amount).to.equal(0);
            expect(parseInt($('#beer-factory__stock__amount-wood').text())).to.equal(0);

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].deliveredItems).to.equal(2);
            expect(buildQueue[0].materials[0].delivered).to.equal(2);
        });

        it("Should deliver as many materials as the transport capacity allows if enough materials are available", function () {
            beerFactory.state.getMaterial('wood').amount = 4;
            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getMaterial('wood').amount).to.equal(1);
            expect(parseInt($('#beer-factory__stock__amount-wood').text())).to.equal(1);

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].deliveredItems).to.equal(5);
            expect(buildQueue[0].materials[0].delivered).to.equal(5);
        });

        it("Should finish a job if all materials are completed", function () {
            gameEventBus.on(EVENTS.BEER_FACTORY.QUEUE.FINISHED, gameEventBusBuildQueueFinishedSpy);
            gameEventBus.on(EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED, gameEventBusBuildQueueMaterialFinishedSpy);

            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 28;
            buildQueue[0].materials[0].delivered = 28;

            beerFactory.state.getMaterial('wood').amount = 7;
            beerFactory.state.getMaterial('wood').total = 0;
            beerFactory.state.getMaterial('strongWood').amount = 0;
            beerFactory.state.getMaterial('strongWood').total = 0;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length, 'Finished job has not been removed from the build queue').to.equal(1);
            expect($('#build-queue__queued-jobs').text()).to.equal('1');
            expect($('#enter-beer-factory__queued-jobs').text()).to.equal('1');

            expect($('#snackbar-container').find('.snackbar').slice(-1)[0].innerText)
                .to.equal("Build Queue job finished: Build a Lumberjack");
        });

        it("Should shift jobs up after a job has been finished", function () {
            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].item).to.equal('wood');
            expect(buildQueue[0].action).to.equal(BUILD_QUEUE__BUILD);
            expect(buildQueue[0].requiredItems).to.equal(54);

            expect(buildQueue[0].materials.length).to.equal(1);
            expect(buildQueue[0].materials[0].key).to.equal('wood');
            expect(buildQueue[0].materials[0].required).to.equal(54);
        });

        it("Should use the remaining transport capacity to deliver materials to other jobs after a job has been finished", function () {
            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].deliveredItems).to.equal(1);
            expect(buildQueue[0].materials[0].delivered).to.equal(1);
        });

        it("Should produce 1 wood", function () {
            expect(beerFactory.state.getMaterial('wood').total + beerFactory.state.getMaterial('strongWood').total).to.equal(1);

            // seven minus three delivered plus one produced
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(5);
            expect(parseInt($('#beer-factory__stock__amount-wood').text()) + parseInt($('#beer-factory__stock__amount-strongWood').text())).to.equal(5);
        });

        it("Should trigger the EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED event after a material is finished", async function () {
            await awaitEventEmitted(gameEventBusBuildQueueMaterialFinishedSpy, 1);

            expect(gameEventBusBuildQueueMaterialFinishedSpy.callCount).to.equal(1);
            expect(gameEventBusBuildQueueMaterialFinishedSpy.getCall(0).args[1]).to.equal(0);
            expect(gameEventBusBuildQueueMaterialFinishedSpy.getCall(0).args[2]).to.equal('wood');

            gameEventBus.off(EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED, gameEventBusBuildQueueMaterialFinishedSpy);
        }).timeout(1000);

        it("Should trigger the EVENTS.BEER_FACTORY.QUEUE.FINISHED event after a job is finished", async function () {
            await awaitEventEmitted(gameEventBusBuildQueueFinishedSpy, 1);

            expect(gameEventBusBuildQueueFinishedSpy.callCount).to.equal(1);
            expect(gameEventBusBuildQueueFinishedSpy.getCall(0).args[1], 'Wrong build queue item finished').to.equal(0);
            expect(gameEventBusBuildQueueFinishedSpy.getCall(0).args[2], 'Wrong action returned').to.equal(BUILD_QUEUE__BUILD);
            expect(gameEventBusBuildQueueFinishedSpy.getCall(0).args[3], 'Wrong item finished').to.equal('wood');

            gameEventBus.off(EVENTS.BEER_FACTORY.QUEUE.FINISHED, gameEventBusBuildQueueFinishedSpy);
        }).timeout(1000);

        it("Should add an additional job to the build queue as the limit is not reached any longer", function () {
            $('#beer-factory__wood').find('.beer-factory__queue-build').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect($('#build-queue__queued-jobs').text()).to.equal('2');
            expect(buildQueue.length).to.equal(2);
            expect($('#enter-beer-factory__queued-jobs').text()).to.equal('2');

            expect(buildQueue[1].item).to.equal('wood');
            expect(buildQueue[1].action).to.equal(BUILD_QUEUE__BUILD);
            expect(buildQueue[1].requiredItems).to.equal(98);

            expect(buildQueue[1].materials.length).to.equal(1);
            expect(buildQueue[1].materials[0].key).to.equal('wood');
            expect(buildQueue[1].materials[0].required).to.equal(98);
        });
    });

    describe("The Build Queue item management", function () {
        it("Should not deliver materials to a paused job", function () {
            // pause the first job. Consequently materials must be delivered to the second job
            $('.build-queue__item-container[data-item-id=0]').find('.build-queue__toggle-pause').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            beerFactory.state.getMaterial('wood').amount = 4;
            beerFactory.state.getMaterial('wood').total = 0;
            beerFactory.state.getMaterial('strongWood').amount = 0;
            beerFactory.state.getMaterial('strongWood').total = 0;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(buildQueue[0].deliveredItems).to.equal(1);
            expect(buildQueue[0].materials[0].delivered).to.equal(1);

            expect(buildQueue[1].deliveredItems).to.equal(3);
            expect(buildQueue[1].materials[0].delivered).to.equal(3);

            expect(beerFactory.state.getMaterial('wood').total + beerFactory.state.getMaterial('strongWood').total).to.equal(1);

            // four minus three delivered plus one produced (either wood or string wood)
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(2);
            expect(parseInt($('#beer-factory__stock__amount-wood').text()) + parseInt($('#beer-factory__stock__amount-strongWood').text())).to.equal(2);
        });

        it("Should not move a job up if it's the first job of the queue", function () {
            $('.build-queue__item-container[data-item-id=0]')
                .find('.build-queue__move-item[data-direction="up"]')
                .trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].requiredItems).to.equal(54);
            expect(buildQueue[1].requiredItems).to.equal(98);
        });

        it("Should not move a job down if it's the last job of the queue", function () {
            $('.build-queue__item-container[data-item-id=1]')
                .find('.build-queue__move-item[data-direction="down"]')
                .trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].requiredItems).to.equal(54);
            expect(buildQueue[1].requiredItems).to.equal(98);
        });

        it("Should move a job up if it's not the first job of the queue", function () {
            $('.build-queue__item-container[data-item-id=1]')
                .find('.build-queue__move-item[data-direction="up"]')
                .trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].requiredItems).to.equal(98);
            expect(buildQueue[1].requiredItems).to.equal(54);
        });

        it("Should move a job down if it's not the last job of the queue", function () {
            $('.build-queue__item-container[data-item-id=0]')
                .find('.build-queue__move-item[data-direction="down"]')
                .trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].requiredItems).to.equal(54);
            expect(buildQueue[1].requiredItems).to.equal(98);
        });
    });
});

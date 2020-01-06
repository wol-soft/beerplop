
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

        it('Should have the base storage capacity', function () {
            ['wood', 'strongWood'].forEach(
                (material) =>
                    expect(
                        $(`.beer-factory__stock__container[data-material="${material}"]`)
                            .find('td:nth-of-type(2)')
                            .text()
                            .match(/\d+ \/ (\d+)/)[1]
                    ).to.equal('100')
            );
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
            expect(container.find('.beer-factory__building__production').text()).to.equal('0');
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

            expect(beerFactory.state.getFactory('wood').amount).to.equal(1);
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

        it("Should update the production of a factory after a factory construction has been finished", function () {
            expect($('#beer-factory__wood').find('.beer-factory__building__production').text()).to.equal('1');
        });

        it("Should produce 1 wood", function () {
            expect(beerFactory.state.getMaterial('wood').total + beerFactory.state.getMaterial('strongWood').total).to.equal(1);

            // seven minus three delivered plus one produced
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(5);
            expect(parseInt($('#beer-factory__stock__amount-wood').text()) + parseInt($('#beer-factory__stock__amount-strongWood').text())).to.equal(5);
        });

        it("Should increase the amount of manually produced items", function () {
            $('#beer-factory__wood').find('.beer-factory__manual-harvest').trigger('click');
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(7);
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

        it("Should deliver materials after a job is activated again", function () {
            // pause the first job. Consequently materials must be delivered to the second job
            $('.build-queue__item-container[data-item-id=0]').find('.build-queue__toggle-pause').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            beerFactory.state.getMaterial('wood').amount = 4;
            beerFactory.state.getMaterial('wood').total = 0;
            beerFactory.state.getMaterial('strongWood').amount = 0;
            beerFactory.state.getMaterial('strongWood').total = 0;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(buildQueue[0].deliveredItems).to.equal(4);
            expect(buildQueue[0].materials[0].delivered).to.equal(4);

            expect(buildQueue[1].deliveredItems).to.equal(3);
            expect(buildQueue[1].materials[0].delivered).to.equal(3);
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

        it("Should open a modal for item management", function (done) {
            const modal = $('#beer-factory__build-queue__manage-item-modal');

            modal.on('shown.bs.modal', () => {
                const tr = $('#beer-factory__build-queue__manage-item__material-table').find('tr');

                expect(tr.length, 'Materials not rendered').to.equal(1);
                expect(tr.data('materialKey'), 'Wrong material rendered').to.equal('wood');

                modal.off('shown.bs.modal');

                done();
            });

            $('.build-queue__item-container[data-item-id=0]').find('.build-queue__manage-item').trigger('click');
        }).timeout(2000);

        it("Should pause a single material", function () {
            const modal = $('#beer-factory__build-queue__manage-item-modal');

            modal.find('.build-queue__manage-item__material__toggle-pause').trigger('click');

            expect($('.build-queue__item-container[data-item-id=0]').find('li').hasClass('item__material-delivery__paused')).to.equal(true);
        });

        it("Should not deliver to paused materials", function () {
            const buildQueue = beerFactory.state.getBuildQueue();

            beerFactory.state.getMaterial('wood').amount = 4;
            beerFactory.state.getMaterial('wood').total = 0;
            beerFactory.state.getMaterial('strongWood').amount = 0;
            beerFactory.state.getMaterial('strongWood').total = 0;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(buildQueue[0].deliveredItems).to.equal(4);
            expect(buildQueue[0].materials[0].delivered).to.equal(4);

            expect(buildQueue[1].deliveredItems).to.equal(6);
            expect(buildQueue[1].materials[0].delivered).to.equal(6);
        });

        it("Should enable a single material", function () {
            const modal = $('#beer-factory__build-queue__manage-item-modal');

            modal.find('.build-queue__manage-item__material__toggle-pause').trigger('click');

            expect($('.build-queue__item-container[data-item-id=0]').find('li').hasClass('item__material-delivery__in-progress')).to.equal(true);
        });

        it("Should deliver to materials after they are enabled again", function () {
            const buildQueue = beerFactory.state.getBuildQueue();

            beerFactory.state.getMaterial('wood').amount = 4;
            beerFactory.state.getMaterial('wood').total = 0;
            beerFactory.state.getMaterial('strongWood').amount = 0;
            beerFactory.state.getMaterial('strongWood').total = 0;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(buildQueue[0].deliveredItems).to.equal(7);
            expect(buildQueue[0].materials[0].delivered).to.equal(7);

            expect(buildQueue[1].deliveredItems).to.equal(6);
            expect(buildQueue[1].materials[0].delivered).to.equal(6);
        });

        it("Should close the modal for item management", function (done) {
            const modal = $('#beer-factory__build-queue__manage-item-modal');

            modal.on('hidden.bs.modal', () => {
                modal.off('hidden.bs.modal');
                done();
            });

            modal.find('.modal-content').find('> button').trigger('click');
        }).timeout(2000);

        it("Should show a warning modal when attempting to delete a job which already has delivered materials", function (done) {
            const modal = $('#beer-factory__build-queue-item__delete-warn-modal');

            modal.on('shown.bs.modal', () => {
                modal.off('shown.bs.modal');
                expect(beerFactory.state.getBuildQueue().length).to.equal(2);
                done();
            });

            $('.build-queue__item-container[data-item-id=0]').find('.build-queue__drop-job').trigger('click');
        }).timeout(2000);

        it("Should close the modal and cancel the delete on cancel click", function (done) {
            const modal = $('#beer-factory__build-queue-item__delete-warn-modal');

            modal.on('hidden.bs.modal', () => {
                modal.off('hidden.bs.modal');
                expect(beerFactory.state.getBuildQueue().length).to.equal(2);
                done();
            });

            $('#beer-factory__build-queue-item__cancel-delete').trigger('click');

            expect(beerFactory.state.getBuildQueue().length).to.equal(2);
        }).timeout(2000);

        it("Should delete on delete click", function (done) {
            const modal = $('#beer-factory__build-queue-item__delete-warn-modal');

            modal.on('shown.bs.modal', () => {
                $('#beer-factory__build-queue-item__delete').trigger('click');
                modal.off('shown.bs.modal');

                modal.on('hidden.bs.modal', () => {
                    modal.off('hidden.bs.modal');

                    expect(beerFactory.state.getBuildQueue().length).to.equal(1);
                    expect($('#build-queue__queued-jobs').text()).to.equal('1');
                    expect($('#enter-beer-factory__queued-jobs').text()).to.equal('1');

                    done();
                });
            });

            $('.build-queue__item-container[data-item-id=0]').find('.build-queue__drop-job').trigger('click');
        }).timeout(2000);

        it("Should shift remaining jobs up if a job is deleted", function () {
            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].deliveredItems).to.equal(6);
            expect(buildQueue[0].materials[0].delivered).to.equal(6);
        });

        it("Should delete a job which has no delivered materials without a warning", function () {
            $('#beer-factory__wood').find('.beer-factory__queue-build').trigger('click');

            const queuedJobsBuildQueue = $('#build-queue__queued-jobs'),
                  queuedJobs           = $('#enter-beer-factory__queued-jobs')

            expect(beerFactory.state.getBuildQueue().length).to.equal(2);
            expect(queuedJobsBuildQueue.text()).to.equal('2');
            expect(queuedJobs.text()).to.equal('2');

            $('.build-queue__item-container[data-item-id=1]').find('.build-queue__drop-job').trigger('click');

            expect(beerFactory.state.getBuildQueue().length).to.equal(1);
            expect(queuedJobsBuildQueue.text()).to.equal('1');
            expect(queuedJobs.text()).to.equal('1');
        });
    });

    describe("The Storage Place", function () {
        it("Should unlock after three Lumberjacks are finished", function () {
            $('#beer-factory__wood').find('.beer-factory__queue-build').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            beerFactory.state.getMaterial('wood').amount = 4;
            beerFactory.state.getMaterial('wood').total = 0;
            beerFactory.state.getMaterial('strongWood').amount = 0;
            beerFactory.state.getMaterial('strongWood').total = 0;

            buildQueue[0].deliveredItems = 97;
            buildQueue[0].materials[0].delivered = 97;
            buildQueue[1].deliveredItems = 97;
            buildQueue[1].materials[0].delivered = 97;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length, 'Build Queue not empty').to.equal(0);
            expect(beerFactory.state.getMaterial('wood').total + beerFactory.state.getMaterial('strongWood').total).to.equal(3);

            // four minus two delivered plus three produced (either wood or string wood)
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(5);
            expect(parseInt($('#beer-factory__stock__amount-wood').text()) + parseInt($('#beer-factory__stock__amount-strongWood').text())).to.equal(5);

            expect($('.beer-factory__building-container').length).to.equal(2);
            expect($('#beer-factory__storage').length).to.equal(1);
        });

        it("Should be added to the Build Queue", function () {
            $('#beer-factory__storage').find('.beer-factory__queue-build').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue.length, 'Build Queue empty').to.equal(1);

            expect(buildQueue[0].item).to.equal('storage');
            expect(buildQueue[0].action).to.equal(BUILD_QUEUE__BUILD);
            expect(buildQueue[0].requiredItems).to.equal(105);

            expect(buildQueue[0].materials.length).to.equal(2);
            expect(buildQueue[0].materials[0].key).to.equal('wood');
            expect(buildQueue[0].materials[0].required).to.equal(75);
            expect(buildQueue[0].materials[1].key).to.equal('strongWood');
            expect(buildQueue[0].materials[1].required).to.equal(30);
        });

        it("should get different materials delivered in a single iteration", function () {
            beerFactory.state.getMaterial('wood').amount = 2;
            beerFactory.state.getMaterial('strongWood').amount = 2;

            const buildQueue = beerFactory.state.getBuildQueue();

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(buildQueue[0].deliveredItems).to.equal(3);
            expect(buildQueue[0].materials[0].delivered).to.equal(2);
            expect(buildQueue[0].materials[1].delivered).to.equal(1);
        });

        it("Should be finished with different materials", function () {
            beerFactory.state.getMaterial('wood').amount = 2;
            beerFactory.state.getMaterial('strongWood').amount = 2;

            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 103;
            buildQueue[0].materials[0].delivered = 74;
            buildQueue[0].materials[1].delivered = 29;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length).to.equal(0);
            expect(beerFactory.state.getFactory('storage').amount).to.equal(1);
        });

        it("Should extend the storage capacity", function () {
            ['wood', 'strongWood'].forEach(
                (material) =>
                    expect(
                        $(`.beer-factory__stock__container[data-material="${material}"]`)
                            .find('td:nth-of-type(2)')
                            .text()
                            .match(/\d+ \/ (\d+)/)[1]
                    ).to.equal('150')
            );
        });
    });

    describe("The transport extension and Quarry", function () {
        let gameEventBusBuildQueueMaterialFinishedSpy = sinon.spy();

        // current state here: 3 Lumberjacks, 1 Storage Place
        it("Should unlock at four Lumberjacks and three Storage Places", function () {
            // button reference must be fetched again as the UI is updated after adding the first job
            $('#beer-factory__wood').find('.beer-factory__queue-build').trigger('click');
            $('#beer-factory__storage').find('.beer-factory__queue-build').trigger('click');
            $('#beer-factory__storage').find('.beer-factory__queue-build').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 174;
            buildQueue[0].materials[0].delivered = 174;

            buildQueue[1].deliveredItems = 188;
            buildQueue[1].materials[0].delivered = 134;
            buildQueue[1].materials[1].delivered = 54;

            buildQueue[2].deliveredItems = 341;
            buildQueue[2].materials[0].delivered = 243;
            buildQueue[2].materials[1].delivered = 98;

            beerFactory.state.getMaterial('wood').amount = 3;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length).to.equal(0);
            expect(beerFactory.state.getFactory('wood').amount).to.equal(4);
            expect(beerFactory.state.getFactory('storage').amount).to.equal(3);

            expect($('.beer-factory__building-container').length, 'Wrong amount of factories unlocked').to.equal(4);
            expect($('#beer-factory__transport').length, 'Transport not unlocked').to.equal(1);
            expect($('#beer-factory__stone').length, 'Quarry not unlocked').to.equal(1);
        });

        it("Should unlock stone as a new material", function () {
            expect($('#beer-factory__stock').find('.beer-factory__stock__container').length).to.equal(3);
            expect($('#beer-factory__stock__amount-stone').text()).to.equal('0');
        });

        it("Should be possible to add a quarry to the Build Queue", function () {
            $('#beer-factory__stone').find('.beer-factory__queue-build').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue.length, 'Build Queue empty').to.equal(1);

            expect(buildQueue[0].item).to.equal('stone');
            expect(buildQueue[0].action).to.equal(BUILD_QUEUE__BUILD);
            expect(buildQueue[0].requiredItems).to.equal(600);

            expect(buildQueue[0].materials.length).to.equal(2);
            expect(buildQueue[0].materials[0].key).to.equal('strongWood');
            expect(buildQueue[0].materials[0].required).to.equal(100);
            expect(buildQueue[0].materials[1].key).to.equal('wood');
            expect(buildQueue[0].materials[1].required).to.equal(500);
        });

        it("Should trigger the EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED event after a material is finished but the job isn't finished", async function () {
            gameEventBus.on(EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED, gameEventBusBuildQueueMaterialFinishedSpy);

            beerFactory.state.getMaterial('wood').amount = 3;
            beerFactory.state.getMaterial('strongWood').amount = 3;

            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 98;
            buildQueue[0].materials[0].delivered = 98;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            await awaitEventEmitted(gameEventBusBuildQueueMaterialFinishedSpy, 1);

            expect(buildQueue[0].deliveredItems).to.equal(101);
            expect(buildQueue[0].materials[0].delivered).to.equal(100);
            expect(buildQueue[0].materials[1].delivered).to.equal(1);

            expect(gameEventBusBuildQueueMaterialFinishedSpy.callCount).to.equal(1);
            expect(gameEventBusBuildQueueMaterialFinishedSpy.getCall(0).args[1]).to.equal(0);
            expect(gameEventBusBuildQueueMaterialFinishedSpy.getCall(0).args[2]).to.equal('strongWood');

            gameEventBus.off(EVENTS.BEER_FACTORY.QUEUE.MATERIAL_FINISHED, gameEventBusBuildQueueMaterialFinishedSpy);
        }).timeout(1000);

        it("Should mark finished materials in the Build Queue", function () {
            const strongWoodContainer = $('#build-queue__item-0__material-strongWood__container'),
                  woodContainer = $('#build-queue__item-0__material-wood__container');

            expect(strongWoodContainer.length, "Strong wood not displayed").to.equal(1);
            expect(woodContainer.length, "Wood not displayed").to.equal(1);

            expect(strongWoodContainer.hasClass('item__material-delivery__complete')).to.equal(true);
            expect(woodContainer.hasClass('item__material-delivery__complete')).to.equal(false);
            expect(strongWoodContainer.hasClass('item__material-delivery__in-progress')).to.equal(false);
            expect(woodContainer.hasClass('item__material-delivery__in-progress')).to.equal(true);
        });

        it("Should not display finished materials if they should be hidden", function () {
            $('#beer-factory__build-queue__hide-completed-materials').trigger('click');

            const strongWoodContainer = $('#build-queue__item-0__material-strongWood__container'),
                  woodContainer = $('#build-queue__item-0__material-wood__container');

            expect(strongWoodContainer.length, "Strong wood displayed").to.equal(0);
            expect(woodContainer.length, "Wood not displayed").to.equal(1);
        });

        it("Should display finished materials again after the hide switch is toggled again", function () {
            $('#beer-factory__build-queue__hide-completed-materials').trigger('click');

            const strongWoodContainer = $('#build-queue__item-0__material-strongWood__container'),
                  woodContainer = $('#build-queue__item-0__material-wood__container');

            expect(strongWoodContainer.length, "Strong wood displayed").to.equal(1);
            expect(woodContainer.length, "Wood not displayed").to.equal(1);
        });

        it("Should produce stone after being finished", function () {
            beerFactory.state.getMaterial('wood').amount = 3;

            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 598;
            buildQueue[0].materials[1].delivered = 498;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length).to.equal(0);
            expect(beerFactory.state.getFactory('stone').amount, 'Factory not constructed').to.equal(1);

            expect(beerFactory.state.getMaterial('stone').amount, 'Stone not produced').to.equal(1);
            expect(beerFactory.state.getMaterial('stone').total, 'Stone not added to total produced amount').to.equal(1);
        });

        it("Should be possible to add a Transport System to the Build Queue", function () {
            $('#beer-factory__transport').find('.beer-factory__queue-build').trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue.length, 'Build Queue empty').to.equal(1);

            expect(buildQueue[0].item).to.equal('transport');
            expect(buildQueue[0].action).to.equal(BUILD_QUEUE__BUILD);
            expect(buildQueue[0].requiredItems).to.equal(330);

            expect(buildQueue[0].materials.length).to.equal(3);
            expect(buildQueue[0].materials[0].key).to.equal('strongWood');
            expect(buildQueue[0].materials[0].required).to.equal(30);
            expect(buildQueue[0].materials[1].key).to.equal('stone');
            expect(buildQueue[0].materials[1].required).to.equal(50);
            expect(buildQueue[0].materials[2].key).to.equal('wood');
            expect(buildQueue[0].materials[2].required).to.equal(250);
        });

        it("Should raise the transport capacity after a Transport System is finished", function () {
            beerFactory.state.getMaterial('wood').amount = 3;

            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 328;
            buildQueue[0].materials[0].delivered = 30;
            buildQueue[0].materials[1].delivered = 50;
            buildQueue[0].materials[2].delivered = 248;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length).to.equal(0);
            expect(beerFactory.state.getFactory('transport').amount, 'Factory not constructed').to.equal(1);

            expect($('#beer-factory__delivery-capacity').text(), 'Displayed transport capacity not updated').to.equal('5');
        });

        it("Should transport with the extended transport capacity", function () {
            beerFactory.state.getMaterial('wood').amount = 10;
            beerFactory.state.getMaterial('strongWood').amount = 0;

            $('#beer-factory__wood').find('.beer-factory__queue-build').trigger('click');

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue[0].deliveredItems).to.equal(5);
            expect(buildQueue[0].materials[0].delivered).to.equal(5);

            // 10 minus 5 plus 4 produced
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(9);
        });
    });

    describe("A Lumberjack upgrade", function () {
        it("Should not be added to the Build Queue when being locked", function () {
            $($('#beer-factory__wood').find('.card')[0]).trigger('click');

            expect(beerFactory.state.getBuildQueue().length).to.equal(1);
        });

        // additional precondition: 1 quarry, already built.
        it("Should unlock after finishing the fifth Lumberjack", function () {
            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 314;
            buildQueue[0].materials[0].delivered = 314;

            beerFactory.state.getMaterial('wood').amount = 3;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length).to.equal(0);
            expect(beerFactory.state.getFactory('wood').amount).to.equal(5);

            // the first upgrade path should be unlocked
            const upgradeCards = $('#beer-factory__wood').find('.beer-factory__upgrade');
            expect($(upgradeCards[0]).find('.beer-factory__upgrade__locked').hasClass('d-none'), 'first upgrade path locked state visible').to.equal(true);
            expect($(upgradeCards[0]).find('.beer-factory__upgrade__locked + div').hasClass('d-none'), 'first upgrade path not visible').to.equal(false);

            expect($(upgradeCards[1]).find('.beer-factory__upgrade__locked').hasClass('d-none'), 'second upgrade path locked state not visible').to.equal(false);
            expect($(upgradeCards[1]).find('.beer-factory__upgrade__locked + div').hasClass('d-none'), 'second upgrade path visible').to.equal(true);
        });

        it("Should be added to the Build Queue if clicked after unlocking", function () {
            $($('#beer-factory__wood').find('.card')[0]).trigger('click');

            const buildQueue = beerFactory.state.getBuildQueue();

            expect(buildQueue.length).to.equal(1);

            expect(buildQueue[0].item).to.deep.equal({
                factory: 'wood',
                upgrade: 'double',
                level: 1,
            });

            expect(buildQueue[0].action).to.equal(BUILD_QUEUE__UPGRADE);
            expect(buildQueue[0].requiredItems).to.equal(4125);

            expect(buildQueue[0].materials.length).to.equal(3);
            expect(buildQueue[0].materials[0].key).to.equal('strongWood');
            expect(buildQueue[0].materials[0].required).to.equal(375);
            expect(buildQueue[0].materials[1].key).to.equal('stone');
            expect(buildQueue[0].materials[1].required).to.equal(1750);
            expect(buildQueue[0].materials[2].key).to.equal('wood');
            expect(buildQueue[0].materials[2].required).to.equal(2000);
        });

        it("Should lock the next stage", function () {
            const upgradeCards = $('#beer-factory__wood').find('.beer-factory__upgrade');

            expect($(upgradeCards[0]).find('.beer-factory__upgrade__locked').hasClass('d-none'), 'first upgrade path locked not state visible').to.equal(false);
            expect($(upgradeCards[0]).find('.beer-factory__upgrade__locked + div').hasClass('d-none'), 'first upgrade path visible').to.equal(true);

            expect($(upgradeCards[1]).find('.beer-factory__upgrade__locked').hasClass('d-none'), 'second upgrade path locked state not visible').to.equal(false);
            expect($(upgradeCards[1]).find('.beer-factory__upgrade__locked + div').hasClass('d-none'), 'second upgrade path visible').to.equal(true);
        });

        it("Should double the wood production after the job has been finished", function () {
            beerFactory.state.getMaterial('stone').amount = 10;
            beerFactory.state.getMaterial('wood').amount = 5;
            beerFactory.state.getMaterial('strongWood').amount = 5;

            const buildQueue = beerFactory.state.getBuildQueue();

            buildQueue[0].deliveredItems = 4120;
            buildQueue[0].materials[0].delivered = 375;
            buildQueue[0].materials[1].delivered = 1745;
            buildQueue[0].materials[2].delivered = 2000;

            gameEventBus.emit(EVENTS.CORE.ITERATION);

            expect(beerFactory.state.getBuildQueue().length).to.equal(0);
            // 10 in stock, 5 consumed, 1 produced
            expect(beerFactory.state.getMaterial('stone').amount).to.equal(6);
            // 10 in stock, 0 consumed, 10 produced
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(20);
        });

        it("Should increase the amount of manually produced items", function () {
            $('#beer-factory__wood').find('.beer-factory__manual-harvest').trigger('click');
            expect(beerFactory.state.getMaterial('wood').amount + beerFactory.state.getMaterial('strongWood').amount).to.equal(23);
        });
    });
});

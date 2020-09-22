(function(beerFactoryGame) {
    'use strict';

    BackRoomModal.prototype.state = null;
    BackRoomModal.prototype.cache = null;

    function BackRoomModal(state, cache) {
        this.state = state;
        this.cache = cache;
    }

    BackRoomModal.prototype.render = function () {
        const modal = $('#beer-factory__back-room-modal');

        let index = 0;

        modal.find('.modal-body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__back-room-modal-template'),
                {
                    lobbyists: this.state.getFactory('backRoom').lobbyists.map(lobbyist => {
                        return {
                            id:   index++,
                            name: lobbyist.name,
                        };
                    }),
                    factories: Object.entries(this.state.getFactories())
                        .filter(factory => {
                            const data = factory[1];
                            return data.production !== false && data.enabled && data.amount > 0;
                        })
                        .map(factory => factory[0]),
                }
            )
        );

        $.each(this.state.getFactory('backRoom').lobbyists, (id, lobbyist) => {
            $('#beer-factory__back-room__lobbyist--' + id).val(lobbyist.factory);
        });

        modal.modal('show');

        this._initEventListener(modal);
    };

    BackRoomModal.prototype._initEventListener = function (modal) {
        modal.find('.beer-factory__back-room__lobbyist__factory').on('change', event => {
            const select  = $(event.target),
                factory = select.val();

            this.state.getFactory('backRoom').lobbyists[select.closest('.form-group').data('lobbyistId')].factory = factory;
            this.cache.resetProductionAmountCache();

            if (factory === 'academy') {
                const achievementController = new Beerplop.AchievementController();
                achievementController.checkAchievement(
                    achievementController.getAchievementStorage().achievements.beerFactory.lobby.education
                );
            }
        });

        new Beerplop.ObjectNaming(
            modal.find('.beer-factory__back-room__lobbyist__name'),
            (id, name) => this.state.getFactory('backRoom').lobbyists[id].name = name,
            'beerFactory.lobby.naming',
        );
    };

    beerFactoryGame.BackRoomModal = BackRoomModal;
})(BeerFactoryGame);

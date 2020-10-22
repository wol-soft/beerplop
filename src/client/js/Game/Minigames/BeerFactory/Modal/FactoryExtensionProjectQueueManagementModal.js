(function(beerFactoryGame) {
    'use strict';

    FactoryExtensionProjectQueueManagementModal.prototype.state = null;

    FactoryExtensionProjectQueueManagementModal.prototype.numberFormatter = null;

    function FactoryExtensionProjectQueueManagementModal(state) {
        this.state           = state;
        this.numberFormatter = new Beerplop.NumberFormatter();
    }

    FactoryExtensionProjectQueueManagementModal.prototype.render = function (extensionKey) {
        const modal = $('#beer-factory__extension-project-queue');

        modal.find('.modal-title').text(
            translator.translate('beerFactory.modal.projectQueue.title', {
                __EXTENSION__: translator.translate(`beerFactory.extension.${extensionKey}`),
            })
        );

        modal.find('.modal-body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__extension-project-queue-template'),
                {
                    extensionKey: extensionKey,
                },
            )
        );

        modal.modal('show');
    };

    beerFactoryGame.FactoryExtensionProjectQueueManagementModal = FactoryExtensionProjectQueueManagementModal;
})(BeerFactoryGame);

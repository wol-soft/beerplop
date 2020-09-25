(function(beerFactoryGame) {
    'use strict';

    ReachedUpgradesModal.prototype.state = null;

    ReachedUpgradesModal.prototype.numberFormatter = null;

    function ReachedUpgradesModal(state) {
        this.state           = state;
        this.numberFormatter = new Beerplop.NumberFormatter();
    }

    ReachedUpgradesModal.prototype.render = function (factoryKey) {
        const modal = $('#beer-factory__upgrades-modal');
        let upgradePaths = [];

        $.each(this.state.getFactory(factoryKey).upgrades, (upgradeKey, level) => {
            let paths = [];

            for (let i = 1; i <= level; i++) {
                const prefix = `beerFactory.upgrade.${factoryKey}.${upgradeKey}.${i}.`;

                paths.push({
                    title:       translator.translate(prefix + 'title'),
                    description: translator.translate(prefix + 'description'),
                    effect:      translator.translate(prefix + 'effect'),
                });
            }

            upgradePaths.push({
                title: translator.translate('beerFactory.upgrade.pathLabel.' + upgradeKey) +
                    ' (' + this.numberFormatter.romanize(level) + ')',
                paths: paths,
            });
        });

        modal.find('.modal-body').html(
            Mustache.render(
                TemplateStorage.get('beer-factory__upgrades-modal-template'),
                {
                    factoryKey:   factoryKey,
                    upgradePaths: upgradePaths,
                },
            )
        );

        modal.modal('show');
    };

    beerFactoryGame.ReachedUpgradesModal = ReachedUpgradesModal;
})(BeerFactoryGame);

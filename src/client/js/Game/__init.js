
(function($, Beerplop){})(jQuery, Beerplop);

$(async function() {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (!window.onGameJsLoaded) {
        await sleep(10);
    }

    window.onGameJsLoaded();

    (new Beerplop.ErrorReporter()).bindErrorListener();

    Beerplop.version = $('#version').data('version');

    // attach the version to enable caching for the language file
    applicationLanguage += '/' + Beerplop.version;

    window.setInterval(
        function () {
            $.get('version').done(function (response) {
                if (response.data.version !== Beerplop.version) {
                    $('.upgrade-available').removeClass('d-none');
                }
            });
        },
        1000 * 60 * 60
    );

    $('.upgrade-available').on('click', function () {
        (new Beerplop.GamePersistor()).setLocalSaveState();
        location.reload();
    });

    $('body').bootstrapMaterialDesign();

    translator = new Translator(
        function (language) {
            Mustache = (function (Mustache) {
                let _render = Mustache.render;

                Mustache.render = function (template, view, partials) {
                    view['t'] = function () {
                        return function (text, render) {
                            try {
                                return translator.translate.apply(translator, JSON.parse(`[${render(text)}]`));
                            } catch (error) {
                                (new Beerplop.ErrorReporter()).reportError(
                                    'DEBUG Transation ' + error.name,
                                    error.message + ' \n' + text + ' \nrendered to: \n' + render(text),
                                    error.stack
                                );

                                return 'undefined';
                            }
                        }
                    };

                    let result;
                    try {
                        result = _render(template, view, partials);
                    }catch (error) {
                        console.log('failed to render template ', template, view, partials, error);

                        return '';
                    }

                    return result;
                };

                return Mustache;
            }(Mustache));

            // start the game
            new Beerplop.PlopController();

            return new Beerplop.LanguageMiddleware(language);
        },
        'beerplop'
    );

    assetPromises['modals'].then(
        () => $('.modal__dynamic-content').on('hidden.bs.modal', event => {
            const element = $(event.target);

            if (element.hasClass('modal__dynamic-content__lock')) {
                return;
            }

            element.find('.modal-body').html('');
        })
    );
});


let assetPromises   = {},
    TemplateStorage = {
        get: (template) => TemplateStorage[template],
    };

$(function() {
    let version = $('#version').data('version');

    assetPromises['client-templates'] = new Promise((resolve) =>
        $.get('/apps/beerplop/deferred/client-templates/' + version).then((response) => {
            $.each(
                $(`<div>${response}</div>`).find('script'),
                (index, element) => TemplateStorage[element.id] = element.innerText
            );

            $('#load-asset__templates').html('&#127866;');
            resolve();
        })
    );

    assetPromises['modals'] = new Promise((resolve) =>
        $.get('/apps/beerplop/deferred/modals/' + version).then((response) => {
            const modalContainer = $('#modal-container');
            modalContainer.html(response);
            modalContainer.bootstrapMaterialDesign();

            $('#load-asset__modals').html('&#127866;');

            if (userApp) {
                userApp.initUserAppEventListener();
            }

            resolve();
        })
    );

    assetPromises['svg'] = new Promise((resolve) =>
        $.get('/apps/beerplop/deferred/images/' + version).then((response) => {
            $('#svg-collection').html(response);
            $('#load-asset__images').html('&#127866;');
            resolve();
        })
    );

    assetPromises['game-js'] = new Promise((resolve) => {
        window.onGameJsLoaded = () => {
            $('#load-asset__scripts').html('&#127866;');

            (new Beerplop.GameEventBus()).on(EVENTS.CORE.INITIALIZED.GAME, () => {
                $('#init-asset__scripts').html('&#127866;');

                if (window.onCoreInitialized) {
                    window.onCoreInitialized();
                }

                resolve();
            })
        };
    });

    $.when(...Object.values(assetPromises)).then(() => {
        if (dragscroll) {
            dragscroll.reset();
        }

        $('#preparation-overlay').fadeOut(400);
    });
});

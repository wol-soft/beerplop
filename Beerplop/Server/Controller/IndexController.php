<?php

namespace Beerplop\Server\Controller;

use Beerplop\Server\Model\SaveStateCollection;
use Server\Controller\Controller;
use Server\Model\Request\Request;
use Server\Model\Response\HTMLResponse;
use Server\Model\Response\JSONResponse;
use Server\Utils\Translator;

/**
 * Class IndexController
 *
 * @package Beerplop\Server\Controller
 */
class IndexController extends Controller
{
    /**
     * @Route GET /apps/beerplop/plop/{?int|$saveStateId}
     *
     * @param Request  $request
     * @param int|null $saveStateId
     *
     * @return HTMLResponse
     */
    public function plopAction(Request $request, ?int $saveStateId = null): HTMLResponse
    {
        return (new HTMLResponse())
            ->setVariables([
                'translator' => Translator::getInstance(null, Translator::LNG_ENGLISH, 'Beerplop'),
                'saveStateId' => $saveStateId,
                'app' => $this->app,
                // TODO: render buildings client side and fetch buildings from GameState to avoid duplicated
                // TODO: definition of existing buildings
                'buildings' => [
                    'opener',
                    'dispenser',
                    'serviceAssistant',
                    'automatedBar',
                    'deliveryTruck',
                    'tankerTruck',
                    'beerPipeline',
                    'cellarBrewery',
                    'automatedBrewery',
                    'pharmaceuticalBeer',
                    'drinkingWaterLine',
                    'beerTeleporter',
                    'beerCloner',
                ]
            ]);
    }

    /**
     * @Route GET /apps/beerplop/test
     *
     * @param Request $request
     *
     * @return HTMLResponse
     */
    public function testAction(Request $request): HTMLResponse
    {
        return $this->plopAction($request, null);
    }

    /**
     * @Route GET /apps/beerplop/beerfactory
     *
     * @param Request $request
     *
     * @return HTMLResponse
     */
    public function beerfactoryAction(Request $request): HTMLResponse
    {
        return $this->plopAction($request, null);
    }

    /**
     * @Route GET /apps/beerplop/bar
     *
     * @param Request $request
     *
     * @return HTMLResponse
     */
    public function barAction(Request $request): HTMLResponse
    {
        return $this->plopAction($request, null);
    }

    /**
     * @Route GET /apps/beerplop/demo
     *
     * @return HTMLResponse
     */
    public function demoAction(): HTMLResponse
    {
        return (new HTMLResponse())
            ->setVariables([
                'translator' => Translator::getInstance(null, Translator::LNG_ENGLISH, 'Beerplop'),
                'demoSaveStates' => (new SaveStateCollection(1))->toArray(),
                'app' => $this->app
            ]);
    }

    /**
     * @Route GET /apps/beerplop/version
     *
     * @return JSONResponse
     */
    public function versionAction(): JSONResponse
    {
        return (new JSONResponse())->addData('version', $this->app->getConf()->beerplopversion);
    }
}

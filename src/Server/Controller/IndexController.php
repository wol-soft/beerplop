<?php

namespace Beerplop\Controller;

use Beerplop\Model\SaveStateCollection;
use WOLSoftCore\Server\Controller\Controller;
use WOLSoftCore\Server\Model\Request\Request;
use WOLSoftCore\Server\Model\Response\HTMLResponse;
use WOLSoftCore\Server\Model\Response\JSONResponse;
use WOLSoftCore\Server\Utils\Translator;

/**
 * Class IndexController
 *
 * @package Beerplop\Server\Controller
 */
class IndexController extends Controller
{
    /**
     * @Route GET /
     *
     * @param Request  $request
     * @param int|null $saveStateId
     *
     * @return HTMLResponse
     */
    public function indexAction(Request $request, ?int $saveStateId = null): HTMLResponse
    {
        return $this->plopAction($request, $saveStateId, 'View/plop.twig');
    }

    /**
     * @Route GET /plop/{?int|$saveStateId}
     *
     * @param Request $request
     * @param int|null $saveStateId
     * @param string|null $template
     *
     * @return HTMLResponse
     */
    public function plopAction(Request $request, ?int $saveStateId = null, ?string $template = null): HTMLResponse
    {
        $response = (new HTMLResponse());

        if ($template) {
            $response->setTemplate($template);
        }

        return $response
            ->setVariables([
                'translator' => Translator::getInstance(null, Translator::LNG_ENGLISH, __DIR__ . '/../../language/'),
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
     * @Route GET /test
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
     * @Route GET /beerfactory
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
     * @Route GET /bar
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
     * @Route GET /demo
     *
     * @return HTMLResponse
     */
    public function demoAction(): HTMLResponse
    {
        return (new HTMLResponse())
            ->setVariables([
                'translator' => Translator::getInstance(null, Translator::LNG_ENGLISH, __DIR__ . '/../../language/'),
                'demoSaveStates' => (new SaveStateCollection(1))->toArray(),
                'app' => $this->app
            ]);
    }

    /**
     * @Route GET /version
     *
     * @return JSONResponse
     */
    public function versionAction(): JSONResponse
    {
        return (new JSONResponse())->addData('version', $this->app->getConf()->beerplopversion);
    }
}

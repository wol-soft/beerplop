<?php

namespace Beerplop\Controller;

use Beerplop\Model\SaveStateCollection;
use WOLSoftCore\Server\Controller\Controller;
use WOLSoftCore\Server\Model\Request\Request;
use WOLSoftCore\Server\Model\Response\HTMLResponse;
use WOLSoftCore\Server\Model\Response\JSONResponse;
use WOLSoftCore\Server\Router\Attribute\Route;
use WOLSoftCore\Server\Router\Attribute\RouteAlias;
use WOLSoftCore\Server\Utils\Translator;

/**
 * Class IndexController
 *
 * @package Beerplop\Server\Controller
 */
class IndexController extends Controller
{
    /**
     * @return HTMLResponse
     */
    #[Route(Request::GET, '/')]
    public function indexAction(): HTMLResponse
    {
        return $this->plopAction(null, 'View/plop.twig');
    }

    /**
     * @param int|null    $saveStateId
     * @param string|null $template
     *
     * @return HTMLResponse
     */
    #[Route(Request::GET, '/plop/{?int|$saveStateId}')]
    public function plopAction(?int $saveStateId = null, ?string $template = null): HTMLResponse
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
     * @return HTMLResponse
     */
    #[Route(Request::GET, '/test')]
    public function testAction(): HTMLResponse
    {
        return $this->plopAction();
    }

    /**
     * @return HTMLResponse
     */
    #[Route(Request::GET, '/beerfactory')]
    public function beerfactoryAction(): HTMLResponse
    {
        return $this->plopAction();
    }

    /**
     * @return HTMLResponse
     */
    #[Route(Request::GET, '/bar')]
    public function barAction(): HTMLResponse
    {
        return $this->plopAction();
    }

    /**
     * @return HTMLResponse
     */
    #[Route(Request::GET, '/demo')]
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
     * @return JSONResponse
     */
    #[Route(Request::GET, '/version')]
    public function versionAction(): JSONResponse
    {
        return (new JSONResponse())->addData('version', $this->app->getConf()->beerplopversion);
    }
}

<?php

namespace Beerplop\Controller;

use Beerplop\Model\SaveState;
use Beerplop\Service\LobbyService;
use WOLSoftCore\Server\Controller\Controller;
use WOLSoftCore\Server\Exception\NoSessionException;
use WOLSoftCore\Server\Model\Request\Request;
use WOLSoftCore\Server\Model\Response\HTMLResponse;
use WOLSoftCore\Server\Model\Response\JSONResponse;
use WOLSoftCore\Server\Router\Attribute\Route;
use WOLSoftCore\Server\Utils\Translator;

/**
 * Class LobbyController
 *
 * @package Beerplop\Server\Controller
 */
class LobbyController extends Controller
{
    /**
     * @return HTMLResponse
     * @throws NoSessionException
     */
    #[Route(Request::GET, '/lobby')]
    public function createLobby(): HTMLResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        return (new HTMLResponse())
            ->addVariable('app', $this->app)
            ->addVariable('isAdmin', true)
            ->setTemplate('View/lobby.twig')
            ->addVariable(
                'translator',
                Translator::getInstance(null, Translator::LNG_ENGLISH, __DIR__ . '/../../language/'),
            );
    }

    /**
     * @param string $lobbyId
     *
     * @return HTMLResponse
     * @throws NoSessionException
     */
    #[Route(Request::GET, '/lobby/{regex("[\w-]+")|$lobbyId}')]
    public function joinLobby(string $lobbyId): HTMLResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        return (new HTMLResponse())
            ->addVariable('app', $this->app)
            ->addVariable('isAdmin', false)
            ->addVariable('lobbyId', $lobbyId)
            ->setTemplate('View/lobby.twig')
            ->addVariable(
                'translator',
                Translator::getInstance(null, Translator::LNG_ENGLISH, __DIR__ . '/../../language/'),
            );
    }

    /**
     * @param Request $request
     * @param string  $lobbyId
     *
     * @return JSONResponse
     */
    #[Route(Request::POST, '/lobby/{regex("[\w-]+")|$lobbyId}/save')]
    public function createSaveStatesForLobby(Request $request, string $lobbyId): JSONResponse
    {
        $saveStateList = [];
        foreach ($request->requiredJson('players') as $userId) {
            $saveState = SaveState::create()
                ->setLobbyId($lobbyId)
                ->setTitle($request->requiredJson('title'))
                ->setUserId($userId);

            if ($saveState->persist() !== true) {
                return (new JSONResponse())->setStatusCode(400);
            }

            $saveStateList[$userId] = $saveState->getId();
        }

        return (new JSONResponse())
            ->setData($saveStateList);
    }

    /**
     * @param string $lobbyId
     *
     * @return JSONResponse
     */
    #[Route(Request::GET, '/lobby/{regex("[\w-]+")|$lobbyId}/ranking')]
    public function getLobbyRanking(string $lobbyId): JSONResponse
    {
        $lobbyService = new LobbyService();

        if ($lobbyService->isUserInLobby($this->app->getUser()->getId(), $lobbyId)) {
            return (new JSONResponse())->addData('ranking', $lobbyService->getRanking($lobbyId));
        }

        return (new JSONResponse())->setStatusCode(403);
    }
}

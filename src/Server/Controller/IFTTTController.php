<?php

namespace Beerplop\Controller;

use Beerplop\Model\IFTTTAuth;
use Beerplop\Model\IFTTTMessage;
use Beerplop\Model\IFTTTMessageCollection;
use Beerplop\Service\IFTTTService;
use DateTime;
use DateTimeZone;
use WOLSoftCore\Server\Constants\Result;
use WOLSoftCore\Server\Controller\Controller;
use WOLSoftCore\Server\Exception\NoSessionException;
use WOLSoftCore\Server\Exception\PermissionDeniedException;
use WOLSoftCore\Server\Model\Request\Request;
use WOLSoftCore\Server\Model\Response\HTTPResponse;
use WOLSoftCore\Server\Model\Response\JSONResponse;
use WOLSoftCore\Server\Model\Response\Response;
use WOLSoftCore\Server\Router\Attribute\Route;
use WOLSoftCore\Server\Router\Attribute\RouteGroup;
use WOLSoftCore\User\Server\Model\User;

/**
 * Class IFTTTController
 *
 * @package Beerplop\Server\Controller
 */
#[RouteGroup('/ifttt/v1')]
class IFTTTController extends Controller
{
    /**
     * @param Request $request
     *
     * @return HTTPResponse
     */
    #[Route(Request::GET, '/status')]
    public function statusAction(Request $request): HTTPResponse
    {
        if ($request->getHeader('Ifttt-Channel-Key') !== $this->app->getConf()->iftttServiceKey) {
            return (new HTTPResponse())->setStatusCode(401);
        }

        return new HTTPResponse();
    }

    /**
     * @param Request $request
     *
     * @return JSONResponse
     */
    #[Route(Request::GET, '/test/setup')]
    public function setupAction(Request $request): JSONResponse
    {
        if ($request->getHeader('Ifttt-Channel-Key') !== $this->app->getConf()->iftttServiceKey) {
            return (new JSONResponse())->setStatusCode(401);
        }

        return (new JSONResponse())->setData([
            'samples' => [],
            'accessToken' => $this->app->getConf()->iftttAccessToken,
        ]);
    }

    /**
     * @param Request $request
     *
     * @return JSONResponse
     *
     * @throws Response
     */
    #[Route(Request::GET, '/user/info')]
    public function userAction(Request $request): JSONResponse
    {
        if (!($user = $this->_getAuthenticatedUser($request))) {
            return $this->_getUnauthorizedResponse();
        }

        return (new JSONResponse())->setData([
            'id' => (string) $user->getId(),
            'name' => $user->getName(),
        ]);
    }

    /**
     * @param Request $request
     *
     * @return JSONResponse
     */
    #[Route(Request::GET, '/triggers/message')]
    public function messageAction(Request $request): JSONResponse
    {
        if (!($user = $this->_getAuthenticatedUser($request))) {
            return $this->_getUnauthorizedResponse();
        }

        $timezone = new DateTimeZone($request->json('user')['timezone']);

        return (new JSONResponse())->setResponse(json_encode([
            'data' => (new IFTTTMessageCollection($user->getId(), $request->json('limit') ?? 50, null, true))->map(
                function (IFTTTMessage $message) use ($timezone) {
                    return [
                        'message' => $message->getMessage(),
                        'channel' => $message->getChannel(),
                        'time' => $message->getCreated()->setTimezone($timezone)->format(DateTime::W3C),
                        'meta' => [
                            'id' => $message->getId(),
                            'timestamp' => $message->getCreated()->getTimestamp(),
                        ],
                    ];
                }
            ),
        ]));
    }

    /**
     * Check the authorization token of the request
     *
     * @param Request $request
     *
     * @return User|null
     */
    private function _getAuthenticatedUser(Request $request): ?User
    {
        $iftttAuth = IFTTTAuth::create()->findBy(
            'token',
            str_replace('Bearer ', '', $request->getHeader('Authorization')),
        );

        if ($iftttAuth === Result::NOT_FOUND) {
            return null;
        }

        return User::create($iftttAuth->getId());
    }

    private function _getUnauthorizedResponse(): JSONResponse
    {
        return (new JSONResponse())
            ->setStatusCode(401)
            ->setResponse(json_encode(['errors' => [['message' => 'Invalid auth token']]]));
    }
}

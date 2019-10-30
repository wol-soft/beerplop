<?php

namespace Beerplop\Server\Controller;

use Beerplop\Server\Model\IFTTTAuth;
use Beerplop\Server\Model\IFTTTMessage;
use Beerplop\Server\Model\IFTTTMessageCollection;
use Beerplop\Server\Service\IFTTTService;
use DateTime;
use DateTimeZone;
use Server\Constants\Result;
use Server\Controller\Controller;
use Server\Exception\NoSessionException;
use Server\Exception\PermissionDeniedException;
use Server\Model\Request\Request;
use Server\Model\Response\HTTPResponse;
use Server\Model\Response\JSONResponse;
use Server\Model\Response\Response;
use User\Server\Model\User;

/**
 * Class IFTTTController
 *
 * @package Beerplop\Server\Controller
 */
class IFTTTController extends Controller
{
    /**
     * @Route GET /apps/beerplop/ifttt/v1/status
     *
     * @param Request $request
     *
     * @return HTTPResponse
     */
    public function statusAction(Request $request): HTTPResponse
    {
        if ($request->getHeader('Ifttt-Channel-Key') !== IFTTTService::SERVICE_KEY) {
            return (new HTTPResponse())->setStatusCode(401);
        }

        return new HTTPResponse();
    }

    /**
     * @Route POST /apps/beerplop/ifttt/v1/test/setup
     *
     * @param Request $request
     *
     * @return JSONResponse
     */
    public function setupAction(Request $request): JSONResponse
    {
        if ($request->getHeader('Ifttt-Channel-Key') !== IFTTTService::SERVICE_KEY) {
            return (new JSONResponse())->setStatusCode(401);
        }

        return (new JSONResponse())->setData([
            'samples' => [],
            'accessToken' => '9b1ff19d7d3cd9ebe2da8822fbf9296bafc54ab9c95f8accffe3b776b1629d99',
        ]);
    }

    /**
     * @Route GET /apps/beerplop/ifttt/v1/user/info
     *
     * @param Request $request
     *
     * @return JSONResponse
     *
     * @throws Response
     */
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
     * @Route POST /apps/beerplop/ifttt/v1/triggers/message
     *
     * @param Request $request
     *
     * @return JSONResponse
     *
     * @throws NoSessionException
     * @throws PermissionDeniedException
     */
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
            str_replace('Bearer ', '', $request->getHeader('Authorization'))
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

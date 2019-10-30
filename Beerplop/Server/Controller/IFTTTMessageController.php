<?php

namespace Beerplop\Server\Controller;

use Beerplop\Server\Model\IFTTTAuth;
use Beerplop\Server\Model\IFTTTMessage;
use Beerplop\Server\Service\IFTTTService;
use DateTime;
use DateTimeZone;
use Exception;
use Server\Controller\Controller;
use Server\Exception\NoSessionException;
use Server\Exception\PermissionDeniedException;
use Server\Exception\RequiredParameterNotSetException;
use Server\Model\Request\Request;
use Server\Model\Response\JSONResponse;

/**
 * Class IFTTTMessageController
 *
 * @package Beerplop\Server\Controller
 */
class IFTTTMessageController extends Controller
{
    /**
     * @Route POST /apps/beerplop/messages
     *
     * @param Request $request
     *
     * @return JSONResponse
     *
     * @throws NoSessionException
     * @throws PermissionDeniedException
     * @throws RequiredParameterNotSetException
     * @throws Exception
     */
    public function addMessagesAction(Request $request): JSONResponse
    {
        if (!$this->app->isUserLoggedIn()) {
            throw new NoSessionException();
        }

        if (!IFTTTAuth::create($this->app->getUser()->getId())->getId()) {
            throw new PermissionDeniedException();
        }

        $timezone = new DateTimeZone($request->requiredJson('timezone'));

        $this->app->getDataFetcher()->startTransaction();
        foreach ($request->requiredJson('messages') as $message) {
            IFTTTMessage::create()
                ->setMessage($message['message'])
                ->setChannel($message['channel'])
                ->setCreated((new DateTime($message['time']))->setTimezone($timezone))
                ->setUser($this->app->getUser())
                ->persist();
        }

        if (!$this->app->getDataFetcher()->commitTransaction()) {
            return (new JSONResponse())->setStatus(false)->setStatusCode(502);
        }

        (new IFTTTService())->notifyNewUserMessage($this->app->getUser()->getId());

        return new JSONResponse();
    }
}

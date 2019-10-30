<?php

namespace Beerplop\Server\Controller;

use Parsedown;
use Server\Controller\Controller;
use Server\Model\Response\HTMLResponse;
use Server\Utils\Translator;

/**
 * Class DeferredLoadingController
 *
 * @package Beerplop\Server\Controller
 */
class DeferredLoadingController extends Controller
{
    /**
     * Requires providing a version for a working cache
     *
     * @Route GET /apps/beerplop/deferred/client-templates/{regex("[\d.]+")|version}
     */
    public function clientTemplatesAction(): HTMLResponse
    {
        return (new HTMLResponse())
            ->setTemplate('Beerplop/View/Deferred/clientTemplates.twig')
            ->cache(60 * 60 * 24 * 30);
    }

    /**
     * Requires providing a version for a working cache
     *
     * @Route GET /apps/beerplop/deferred/images/{regex("[\d.]+")|version}
     */
    public function imagesAction(): HTMLResponse
    {
        return (new HTMLResponse())
            ->setTemplate('Beerplop/View/Deferred/svg.twig')
            ->cache(60 * 60 * 24 * 30);
    }

    /**
     * Requires providing a version for a working cache
     *
     * @Route GET /apps/beerplop/deferred/modals/{regex("[\d.]+")|version}
     */
    public function modalsAction()
    {
        return (new HTMLResponse())
            ->addVariable('translator', Translator::getInstance(null, Translator::LNG_ENGLISH, 'Beerplop'))
            ->addVariable('app', $this->app)
            ->addVariable(
                'changelog',
                (new Parsedown())->text(
                    preg_replace(
                        '/#(\d+)/',
                        '<a href="https://github.com/wol-soft/beerplop-issues/issues/$1" target="_blank">#$1</a>',
                        file_get_contents(__DIR__ . '/../../Changelog.txt')
                    )
                )
            )
            ->setTemplate('Beerplop/View/Deferred/modal.twig')
            ->cache(60 * 60 * 24 * 30);
    }
}

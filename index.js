const config    = require('./config/conf.js'),
      uuid      = require('node-uuid'),
      { JSDOM } = require('jsdom'),
      request   = require('ajax-request'),
      jsdom     = new JSDOM('<html></html>'),
      { window }   = jsdom,
      { document } = window;

// https://swas.io/blog/use-jquery-jsdom-v11/
global.window = window;
global.document = document;

const $ = global.jQuery = require( 'jquery' );

let server = null;

if (config.https) {
    const fs    = require('fs'),
          https = require('https');

    const options = {
        key:  fs.readFileSync(config.key),
        cert: fs.readFileSync(config.cert),
    };

    server = https.createServer(options).listen(config.port);
} else {
    const http = require('http');

    server = http.createServer().listen(config.port);
}

const io = require('socket.io').listen(server);

require('./src/Server/node/lobby.js')(io, $, uuid, request);

(function(beerplop) {
    'use strict';

    const STARS = 150;

    NightSky.prototype.stars  = [];
    NightSky.prototype.canvasContext = null;
    NightSky.prototype.canvas = null;
    NightSky.prototype.background = null;
    NightSky.prototype.animationFrameId = null;

    /**
     * @constructor
     */
    function NightSky(selector) {
        this.canvas = document.querySelector(selector);

        this.canvas.width = innerWidth;
        this.canvas.height = innerHeight;

        this.canvas.style.background = '#000';
        this.canvasContext = this.canvas.getContext('2d');

        this.background = this.canvasContext.createRadialGradient(
            this.canvas.width / 2,
            this.canvas.height * 3,
            this.canvas.height,
            this.canvas.width / 2,
            this.canvas.height,
            this.canvas.height * 4
        );

        this.background.addColorStop(0,"#32465E");
        this.background.addColorStop(.4,"#000814");
        this.background.addColorStop(.8,"#000814");
        this.background.addColorStop(1,"#000");

        addEventListener( 'resize', () => {
            this.canvas.width = innerWidth;
            this.canvas.height = innerHeight;
            this.stars = [];
            this.init();
        });

        this.init();
        this.animate();
    }



    NightSky.prototype.init = function () {
        for( let i = 0; i < STARS; i++ ) {
            this.stars.push(new Star(this.canvas, this.canvasContext));
        }
    };

    NightSky.prototype.animate = function () {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        this.canvasContext.clearRect( 0, 0, this.canvas.width, this.canvas.height);
        this.canvasContext.fillStyle = this.background;
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.stars.forEach(s => s.update(this.stars));
    };

    NightSky.prototype.destroy = function () {
        cancelAnimationFrame(this.animationFrameId);
    };

    beerplop.NightSky = NightSky;
})(Beerplop);

class Star {
    constructor(canvas, canvasContext, x, y, radius, color) {
        let colors = [ '#b62a00', '#fb9b39', '#176ab6', '#6ccacb'];
        for ( let i = 0; i < 98; i++) {
            colors.push( '#fff')
        }

        this.canvas = canvas;
        this.canvasContext = canvasContext;

        this.x = x || Star.randomInt( 0, canvas.width);
        this.y = y || Star.randomInt( 0, canvas.height);
        this.radius = radius || Math.random() * 1.1;
        this.color = color || colors[Star.randomInt(0, colors.length)];
        this.dy = -Math.random() * .3;
    }

    draw () {
        this.canvasContext.beginPath();
        this.canvasContext.arc( this.x, this.y, this.radius, 0, Math.PI *2 );
        this.canvasContext.shadowBlur = Star.randomInt( 3, 15);
        this.canvasContext.shadowColor = this.color;
        this.canvasContext.strokeStyle = this.color;
        this.canvasContext.fillStyle = 'rgba( 255, 255, 255, .5)';
        this.canvasContext.fill();
        this.canvasContext.stroke();
        this.canvasContext.closePath();
    }

    update( arrayStars = [] ) {
        if ( this.y - this.radius < 0 ) this.createNewStar( arrayStars );

        this.y += this.dy;
        this.draw();
    }

    createNewStar( arrayStars = [] ) {
        let i = arrayStars.indexOf( this );
        arrayStars.splice( i, 1);
        arrayStars.push(new Star(this.canvas, this.canvasContext, false, this.canvas.height + 5));
    }

    static randomInt (max, min) {
        return Math.floor(Math.random() * (max - min) + min);
    }
}


var cX1 = 90; // Math.random() * 100;
var cX2 = 240; // Math.random() * 100;
var cX3 = 370; // Math.random() * 100;
var cY1 = 30; //Math.random() * 100;
var cY2 = 240; //Math.random() * 100;
var cY3 = 66; // Math.random() * 100;

function stationData(coordX, coordY, name) {
    this.coordX = coordX;
    this.coordY = coordY;
    this.calcCoordX = 0;
    this.calcCoordY = 0;
    this.name = name;
}

var stationsArray = new Array();

function redraw() {
    document.getElementById("map").innerHTML = '';
    for (var i = 0; i < 3; i++) {
        drawStation(stationsArray[i], stationsArray[i].name, i);
    }
    drawPath(stationsArray[0].calcCoordX, stationsArray[0].calcCoordY, stationsArray[1].calcCoordX, stationsArray[1].calcCoordY, 20, 1, 5, 3, 'vegasirius', new Array("blue", "neutral", "green"));
    drawPath(stationsArray[1].calcCoordX, stationsArray[1].calcCoordY, stationsArray[0].calcCoordX, stationsArray[0].calcCoordY, 60, 0, 7, 2, 'siriusvega', new Array("red", "neutral"));
    drawPath(stationsArray[1].calcCoordX, stationsArray[1].calcCoordY, stationsArray[2].calcCoordX, stationsArray[2].calcCoordY, 40, 0, 4, 2, 'siriuserde', new Array("green", "red"));
    drawPath(stationsArray[2].calcCoordX, stationsArray[2].calcCoordY, stationsArray[0].calcCoordX, stationsArray[0].calcCoordY, 20, 1, 7, 2, 'vegaerde', new Array("neutral", "green"));
}

window.onload = function () {
    stationsArray.push(new stationData(10, 20, "vega"));
    stationsArray.push(new stationData(50, 80, "sirius"));
    stationsArray.push(new stationData(90, 60, "erde"));
    document.onmousemove = function (e) {
        if (dragObj != null) {
            var moveEvent = e || window.event;
            mouseX = moveEvent.clientX;
            mouseY = moveEvent.clientY;
            stationsArray[dragObj].coordX = (mouseX - 15);
            stationsArray[dragObj].coordY = (mouseY - 15);
            redraw();
        }
    }
    document.onkeypress = function (evt) {
        evt = evt || window.event;
        var charCode = evt.keyCode || evt.which;
        //var charStr = String.fromCharCode(charCode);
        switch (parseInt(charCode)) {
            case 43: zoom(parseInt(window.getComputedStyle(document.getElementById("map"), null).getPropertyValue("width"), 10) + 50,
                        parseInt(window.getComputedStyle(document.getElementById("map"), null).getPropertyValue("height"), 10) + 30); break;
            case 45: zoom(parseInt(window.getComputedStyle(document.getElementById("map"), null).getPropertyValue("width"), 10) - 50,
                        parseInt(window.getComputedStyle(document.getElementById("map"), null).getPropertyValue("height"), 10) - 30);
        }
    };
    document.onmouseup = noDrag;
    redraw();
}

function zoom(w, h) {
    //alert(w + " " + h);
    document.getElementById("map").style.width = w + "px";
    document.getElementById("map").style.height = h + "px";
    redraw();
}

function addClass(ele, cls) {
    if (!this.hasClass(ele, cls)) ele.className += " " + cls;
}

function removeClass(ele, cls) {
    if (hasClass(ele, cls)) {
        var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
        ele.className = ele.className.replace(reg, ' ');
    }
}

function hasClass(ele, cls) {
    return ele.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
}

function highlight(elementParent) {
    var elements = document.getElementById(elementParent).childNodes;
    for (var i = 0; i < elements.length; i++) {
        addClass(elements[i], "highlighted");
    }
}

function downlight(elementParent) {
    var elements = document.getElementById(elementParent).childNodes;
    for (var i = 0; i < elements.length; i++) {
        removeClass(elements[i], "highlighted");
    }
}

function quad(input) {
    return input * input;
}

function bezierPosition(start, help, end, t) {
    return (start - 2 * help + end) * quad(t) + (2 * help - 2 * start) * t + start;
}

function bezierLength(startX, startY, helpX, helpY, endX, endY, accurate) {
    var lastX, lastY;
    var curX, curY;
    var result = 0;

    for (t = 0; t <= 1; t += accurate) {
        curX = bezierPosition(startX, helpX, endX, t);
        curY = bezierPosition(startY, helpY, endY, t);
        if (t > 0) {
            result += Math.sqrt(quad(lastX - curX) + quad(curY - lastY));
        }
        lastX = curX;
        lastY = curY;
    }
    return result;
}

function getOrthogonale(startX, startY, endX, endY, angle) {
    return ((Math.sqrt(quad(endX - startX) + quad(endY - startY)) / 2 / Math.sin((90 - angle) * Math.PI / 180)) * Math.sin(angle * Math.PI / 180)) / Math.sqrt(1 + quad(-(endY - startY) / (endX - startX)));
}

function getHelpX(startX, startY, endX, endY, orthogonale, direction) {
    if (direction == 0) {
        return startX + (endX - startX) / 2 + (-(endY - startY) / (endX - startX)) * orthogonale;
    } else if (direction == 1) {
        return startX + (endX - startX) / 2 - (-(endY - startY) / (endX - startX)) * orthogonale;
    }
    return null;
}

function getHelpY(startX, startY, endX, endY, orthogonale, direction) {
    if (direction == 0) {
        return startY + (endY - startY) / 2 + orthogonale;
    } else if (direction == 1) {
        return startY + (endY - startY) / 2 - orthogonale;
    }
    return null;
}

function drawPath(startX, startY, endX, endY, angle, direction, elements, tracks, name, styleClass) {
    // startX,startY,endX,endY geben die Koordinaten der verbundenen Stationen an
    // angle gibt den Winkel zur Konstruktion an (je größer desto stärker gebogen) Wertebereich 0 bis 89
    // direction: 1 = nach oben gebogen;2 = nach unten gebogen
    // elements gibt an aus wie vielen Elementen die Strecke besteht. 0 bedeutet eine automatische Berechnung
    // tracks gibt an, wie viele Strecken parallel gezeichnet werden
    var orth = getOrthogonale(startX, startY, endX, endY, angle);
    var helpX = getHelpX(startX, startY, endX, endY, orth, direction);
    var helpY = getHelpY(startX, startY, endX, endY, orth, direction);
    var lengthPath = bezierLength(startX, startY, helpX, helpY, endX, endY, 0.01);
    if (elements == 0) {
        elements = lengthPath / 50;
    }
    var lengthElement = lengthPath / (elements + 3);
    var parentDiv = document.createElement("DIV");
    parentDiv.setAttribute("id", name);
    document.getElementById("map").appendChild(parentDiv);

    // TrackContainer erstellen um einzelne Strecken voneinander zu unterscheiden
    for (var track = 0; track < tracks; track++) {
        var trackContainer = document.createElement("DIV");
        trackContainer.setAttribute("id", "Track" + name + track);
        document.getElementById(name).appendChild(trackContainer);
    }

    for (var i = 1; i <= elements; i++) {
        // Winkel des Elements berechnen
        var t = (1 / elements) * i;
        var constructStartX = startX + t * (helpX - startX);
        var constructStartY = startY + t * (helpY - startY);
        var constructEndX = helpX + t * (endX - helpX);
        var constructEndY = helpY + t * (endY - helpY);
        var deg = (Math.acos(-(constructEndY - constructStartY) / Math.sqrt(quad(constructEndX - constructStartX) + quad(constructEndY - constructStartY))) * (180 / Math.PI));
        if (constructStartX > constructEndX) deg = 360 - deg; // Gegenwinkel berechen
        //  alert (deg);

        // Position der einzelnen Elemente berechen
        var bezierPosX = bezierPosition(startX, helpX, endX, (1 / (elements + 0.5)) * i);
        var bezierPosY = bezierPosition(startY, helpY, endY, (1 / (elements + 0.5)) * i);
        var positionLeft = new Array();
        var positionTop = new Array();

        switch (tracks) {
            case 1:
                // Eine Strecke
                positionLeft.push(bezierPosition(startX, helpX, endX, (1 / (elements + 0.5)) * i));
                positionTop.push(bezierPosition(startY, helpY, endY, (1 / (elements + 0.5)) * i));
                break;
            case 2:
                // Zwei parallele Strecken
                positionLeft[0] = bezierPosX + 6 * Math.sin((deg - 90) / (180 / Math.PI));
                positionTop[0] = bezierPosY - 6 * Math.cos((deg - 90) / (180 / Math.PI));

                positionLeft[1] = bezierPosX + 6 * Math.sin((deg + 90) / (180 / Math.PI));
                positionTop[1] = bezierPosY - 6 * Math.cos((deg + 90) / (180 / Math.PI));
                break;
            case 3:
                // Drei parallele Strecken
                positionLeft[0] = bezierPosX + 12 * Math.sin((deg - 90) / (180 / Math.PI));
                positionTop[0] = bezierPosY - 12 * Math.cos((deg - 90) / (180 / Math.PI));

                positionLeft[1] = bezierPosX;
                positionTop[1] = bezierPosY;

                positionLeft[2] = bezierPosX + 12 * Math.sin((deg + 90) / (180 / Math.PI));
                positionTop[2] = bezierPosY - 12 * Math.cos((deg + 90) / (180 / Math.PI));
                break;
            default:
                return null;
        }

        for (var track = 0; track < tracks; track++) {
            var element = document.createElement("DIV");
            var trackContainer = "Track" + name + track;
            element.setAttribute("id", name + "Element" + i + "Track" + track);
            element.setAttribute("class", "trackelement " + styleClass[track] + " " + name + "Element track"+i);
            element.setAttribute("onmouseover", "highlight('" + trackContainer + "');");
            element.setAttribute("onmouseout", "downlight('" + trackContainer + "');");
            element.setAttribute("style", "left:" + positionLeft[track] + "px;top:" + positionTop[track] + "px; -webkit-transform: rotate(" + deg + "deg); transform:rotate(" + deg + "deg);");
            document.getElementById(trackContainer).appendChild(element);
        }
    }
}

function findStationByName(stations, name) {
    for (stationCounter = 0; stationCounter < stations.length; stationCounter++) {
        if (stations[stationCounter].name == name) return stations[stationCounter];
    }
    return null;
}

function moveStation() {
    
}

function drawStation(station, name, number) {
    var stationDiv = document.createElement("DIV");
    stationDiv.setAttribute("id", name);
    stationDiv.setAttribute("class", "station");
    stationDiv.setAttribute("onmousedown","startDrag("+number+")");
    stationDiv.setAttribute("style", "left:" + station.coordX + "%;top:" + station.coordY + "%; ");
    document.getElementById("map").appendChild(stationDiv);

    station.calcCoordX = parseInt(window.getComputedStyle(document.getElementById(name), null).getPropertyValue("left"), 10) || 0;
    station.calcCoordY = parseInt(window.getComputedStyle(document.getElementById(name), null).getPropertyValue("top"), 10) || 0;
    /*  var effect = document.createElement("DIV");
    effect.setAttribute("id", name+"Effect");
    effect.setAttribute("class", "stationEffect");
    document.getElementById(name).appendChild(effect);*/
}

function createField() {
    var colors = new Array("red", "blue", "green", "neutral", "neutral");
    var stations = new Array();
    var lastCrossed = false;
    for (var j = 0; j < 4; j++) {
        for (var i = 0; i < 6; i++) {
            if (Math.random() > 0.1) {
                coordX = Math.random() * 11; // je 14
                coordY = Math.random() * 19;
                var station = new stationData(i * 16.6 + coordX + 3, j * 25 + coordY + 3, "station" + i + "" + j);
                stations.push(station);
                drawStation(station.coordX, station.coordY, station.name);
                var connectTo = findStationByName(stations, "station" + (i - 1) + "" + j);
                if (connectTo == null) connectTo = findStationByName(stations, "station" + (i - 2) + "" + j);
                if ((connectTo != null) && (Math.random() > 0)) {
                    var color = colors[Math.round(Math.random() * (colors.length - 1))];
                    drawPath(station.coordX, station.coordY, connectTo.coordX, connectTo.coordY, 30, Math.round(Math.random()), 0, "path" + station.name + connectTo.name, color);
                }
                var connectTo = findStationByName(stations, "station" + i + "" + (j - 1));
                if (connectTo == null) connectTo = findStationByName(stations, "station" + i + "" + (j - 2));
                if ((connectTo != null) && (Math.random() > 0)) {
                    var color = colors[Math.round(Math.random() * (colors.length - 1))];
                    drawPath(station.coordX, station.coordY, connectTo.coordX, connectTo.coordY, 20, Math.round(Math.random()), 0, "path" + station.name + connectTo.name, color);
                }
                var connectTo = findStationByName(stations, "station" + (i - 1) + "" + (j - 1));
                if ((connectTo != null) && (Math.random() > 0.75) && !(lastCrossed)) {
                    var color = colors[Math.round(Math.random() * (colors.length - 1))];
                    drawPath(station.coordX, station.coordY, connectTo.coordX, connectTo.coordY, 20, Math.round(Math.random()), 0, "path" + station.name + connectTo.name, color);
                }
                lastCrossed = false;
                var connectTo = findStationByName(stations, "station" + (i + 1) + "" + (j - 1));
                if ((connectTo != null) && (Math.random() > 0.75)) {
                    var color = colors[Math.round(Math.random() * (colors.length - 1))];
                    drawPath(station.coordX, station.coordY, connectTo.coordX, connectTo.coordY, 20, Math.round(Math.random()), 0, "path" + station.name + connectTo.name, color);
                    lastCrossed = true;
                }
            }

        }
    }
}

/* Verschieben-Funktionen */

var dragObj = null;

function startDrag (obj) {
    dragObj = obj;
}

function noDrag() {
    dragObj = null;
}
<?php

if (isset($_GET['t'])) {
    header('location: /apps/mediacenter/music/remote/' . $_GET['t']);
}
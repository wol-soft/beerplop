<?php

if (isset($_GET['t'])) {
    header('location: /apps/mediacenter/remote/' . $_GET['t']);
}
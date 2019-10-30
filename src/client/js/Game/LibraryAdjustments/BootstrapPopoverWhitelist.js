
let whiteList = $.fn.tooltip.Constructor.Default.whiteList || {};

whiteList.table = [];
whiteList.thead = [];
whiteList.th    = ['colspan'];
whiteList.tbody = [];
whiteList.tr    = [];
whiteList.td    = [];

whiteList.svg = ['viewBox'];
whiteList.use = ['xlink:href'];

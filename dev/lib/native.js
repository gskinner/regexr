'use strict';

window._native = function () {
	var _options = {};
	var _construct = function _construct(e) {
		var defaultOptions = {
			carbonZoneKey: '',
			fallback: '',
			ignore: 'false',
			placement: '',
			prefix: 'native',
			targetClass: 'native-ad'
		};

		if (typeof e === 'undefined') return defaultOptions;
		Object.keys(defaultOptions).forEach(function (key, index) {
			if (typeof e[key] === 'undefined') {
				e[key] = defaultOptions[key];
			}
		});
		return e;
	};

	var init = function init(zone, options) {
		_options = _construct(options);

		var jsonUrl = 'https://srv.buysellads.com/ads/' + zone + '.json?callback=_native_go';
		if (_options['placement'] !== '') {
			jsonUrl += '&segment=placement:' + _options['placement'];
		}
		if (_options['ignore'] === 'true') {
			jsonUrl += '&ignore=yes';
		}

		var srv = document.createElement('script');
		srv.src = jsonUrl;
		document.getElementsByTagName('head')[0].appendChild(srv);
	};

	var carbon = function carbon(e) {
		var srv = document.createElement('script');
		srv.src = '//cdn.carbonads.com/carbon.js?serve=' + e['carbonZoneKey'] + '&placement=' + e['placement'];
		srv.id = '_carbonads_js';

		return srv;
	};

	var sanitize = function sanitize(ads) {
		return ads.filter(function (ad) {
			return Object.keys(ad).length > 0;
		}).filter(function (ad) {
			return ad.hasOwnProperty('statlink');
		});
	};

	var pixel = function pixel(p, timestamp) {
		var c = '';
		if (p) {
			p.split('||').forEach(function (pixel, index) {
				c += '<img src="' + pixel.replace('[timestamp]', timestamp) + '" style="display:none;" height="0" width="0" />';
			});
		}
		return c;
	};

	var options = function options() {
		return _options;
	};

	return {
		carbon: carbon,
		init: init,
		options: options,
		pixel: pixel,
		sanitize: sanitize
	};
}({});

window._native_go = function (json) {
	var options = _native.options();
	var ads = _native.sanitize(json['ads']);
	var selectedClass = document.querySelectorAll('.' + options['targetClass']);

	if (ads.length < 1) {
		selectedClass.forEach(function (className, index) {
			var selectedTarget = document.getElementsByClassName(options['targetClass'])[index];

			if (options['fallback'] !== '' || options['carbonZoneKey'] !== '') selectedTarget.setAttribute('data-state', 'visible');
			selectedTarget.innerHTML = options['fallback'];
			if (options['carbonZoneKey'] !== '') selectedTarget.appendChild(_native.carbon(options));
		});

		// End at this line if no ads are found, avoiding unnecessary steps
		return;
	}

	selectedClass.forEach(function (className, index) {
		var selectedTarget = document.getElementsByClassName(options['targetClass'])[index];
		var adElement = selectedTarget.innerHTML||"";
		var prefix = options['prefix'];
		var ad = ads[index];

		if (ad && className) {
			var adInnerHtml = adElement.replace(new RegExp('#' + prefix + '_bg_color#', 'g'), ad['backgroundColor']).replace(new RegExp('#' + prefix + '_bg_color_hover#', 'g'), ad['backgroundHoverColor']).replace(new RegExp('#' + prefix + '_company#', 'g'), ad['company']).replace(new RegExp('#' + prefix + '_cta#', 'g'), ad['callToAction']).replace(new RegExp('#' + prefix + '_cta_bg_color#', 'g'), ad['ctaBackgroundColor']).replace(new RegExp('#' + prefix + '_cta_bg_color_hover#', 'g'), ad['ctaBackgroundHoverColor']).replace(new RegExp('#' + prefix + '_cta_color#', 'g'), ad['ctaTextColor']).replace(new RegExp('#' + prefix + '_cta_color_hover#', 'g'), ad['ctaTextColorHover']).replace(new RegExp('#' + prefix + '_desc#', 'g'), ad['description']).replace(new RegExp('#' + prefix + '_index#', 'g'), prefix + '-' + ad['i']).replace(new RegExp('#' + prefix + '_img#', 'g'), ad['image']).replace(new RegExp('#' + prefix + '_small_img#', 'g'), ad['smallImage']).replace(new RegExp('#' + prefix + '_link#', 'g'), ad['statlink']).replace(new RegExp('#' + prefix + '_logo#', 'g'), ad['logo']).replace(new RegExp('#' + prefix + '_color#', 'g'), ad['textColor']).replace(new RegExp('#' + prefix + '_color_hover#', 'g'), ad['textColorHover']).replace(new RegExp('#' + prefix + '_title#', 'g'), ad['title']);
			selectedTarget.innerHTML = adInnerHtml + _native.pixel(ad['pixel'], ad['timestamp']);
			selectedTarget.setAttribute('data-state', 'visible');
		} else {
			selectedTarget.innerHTML = "";
		}
	});
};
var el;
if (!$.isSupported()) {
	el = document.querySelector(".not-supported");
	$.removeClass(el, "hidden");
} else if($.partialSupport()) {
	el = document.querySelector(".not-supported-mobile");
	$.removeClass(el, "hidden");
	$.el("#closeOverlay").addEventListener("click", function() {
		$.addClass(el, "hidden");
	});
}

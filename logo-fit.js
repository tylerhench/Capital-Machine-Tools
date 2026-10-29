/* Capital Machine Tools — match the tagline width to the name.
   Measures "Capital Machine Tools" and sets the letter spacing of
   "Buying & Selling Since 1990" so both lines end at the same point.
   Re-runs once fonts load and whenever the window is resized.
   If this file fails to load, the tagline falls back to its CSS spacing. */
(function () {
  function fit(lockup) {
    var name = lockup.querySelector('.logo-name');
    var tag = lockup.querySelector('.logo-tagline');
    if (!name || !tag) return;

    tag.style.letterSpacing = '0px';

    var range = document.createRange();

    range.selectNodeContents(name);
    var nameWidth = range.getBoundingClientRect().width;
    // remove the spacing that trails the last letter of the name
    nameWidth -= parseFloat(getComputedStyle(name).letterSpacing) || 0;

    range.selectNodeContents(tag);
    var tagWidth = range.getBoundingClientRect().width;

    var nudge = parseFloat(getComputedStyle(tag).paddingLeft) || 0;
    var chars = tag.textContent.replace(/\s+/g, ' ').trim().length;
    if (chars < 2 || nameWidth <= 0) return;

    var spacing = (nameWidth - nudge - tagWidth) / (chars - 1);
    tag.style.letterSpacing = spacing + 'px';
  }

  function fitAll() {
    var lockups = document.querySelectorAll('.logo-lockup');
    for (var i = 0; i < lockups.length; i++) fit(lockups[i]);
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      fitAll();
    });
  }

  fitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  window.addEventListener('load', fitAll);
  window.addEventListener('resize', schedule);
})();

export function initFeedback(read, write) {
  const sound = document.getElementById('sound-enabled');
  const haptics = document.getElementById('haptics-enabled');
  sound.checked = read('sound-enabled', true);
  haptics.checked = read('haptics-enabled', true);
  sound.onchange = () => write('sound-enabled', sound.checked);
  haptics.onchange = () => write('haptics-enabled', haptics.checked);
  const tunes = {
    tap:[410], cross:[735], cat:[540,690], miss:[230,155], win:[520,660,780,1040],
    coin:[730,970], speed:[620,820,1100], care:[460,570]
  };
  let audio;
  let lastCross = -Infinity;
  let lastHaptic = -Infinity;
  // WebKit provides a light system tick when a native switch is activated during a gesture.
  const nativeSwitch = document.createElement('input');
  nativeSwitch.type = 'checkbox';
  nativeSwitch.setAttribute('switch', '');
  nativeSwitch.className = 'haptic-switch';
  nativeSwitch.tabIndex = -1;
  nativeSwitch.setAttribute('aria-hidden', 'true');
  if (typeof navigator.vibrate !== 'function') document.body.append(nativeSwitch);
  function haptic(kind) {
    if (!haptics.checked || performance.now() - lastHaptic < 50) return;
    try {
      if (typeof navigator.vibrate === 'function') {
        if (!navigator.vibrate(kind === 'win' ? [14,32,16] : kind === 'miss' ? 20 : 9)) return;
      } else {
        if (!navigator.userActivation?.isActive) return;
        nativeSwitch.click();
      }
      lastHaptic = performance.now();
    } catch {}
  }
  document.getElementById('board').addEventListener('pointerup', event => {
    if (event.pointerType === 'touch' && typeof navigator.vibrate !== 'function') haptic('tap');
  });
  function feedback(kind) {
    if (kind === 'cross') {
      const now = performance.now();
      if (now - lastCross < 55) return;
      lastCross = now;
    }
    haptic(kind);
    const notes = tunes[kind];
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!sound.checked || !Context || !notes) return;
    try {
      audio ||= new Context();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      notes.forEach((note, index) => {
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        const time = audio.currentTime + index * .075;
        const length = kind === 'cross' ? .065 : .15;
        oscillator.frequency.value = note;
        volume.gain.setValueAtTime(.001, time);
        volume.gain.exponentialRampToValueAtTime(.06, time + .012);
        volume.gain.exponentialRampToValueAtTime(.001, time + length);
        oscillator.connect(volume).connect(audio.destination);
        oscillator.start(time);
        oscillator.stop(time + length + .01);
      });
    } catch {}
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && !button.disabled && !button.matches('.cell')) feedback('tap');
  }, true);
  return feedback;
}

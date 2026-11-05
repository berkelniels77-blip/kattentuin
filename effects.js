export function initFeedback(read, write) {
  const sound = document.getElementById('sound-enabled');
  const haptics = document.getElementById('haptics-enabled');
  sound.checked = read('sound-enabled', true);
  haptics.checked = read('haptics-enabled', true);
  sound.onchange = () => write('sound-enabled', sound.checked);
  haptics.onchange = () => write('haptics-enabled', haptics.checked);
  const tunes = {
    tap:[410], cat:[540,690], miss:[230,155], win:[520,660,780,1040],
    coin:[730,970], speed:[620,820,1100], care:[460,570]
  };
  let audio;
  function feedback(kind) {
    const notes = tunes[kind];
    if (haptics.checked) {
      try { navigator.vibrate?.(kind === 'win' ? [14,32,16] : kind === 'miss' ? 20 : 9); }
      catch {}
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!sound.checked || !Context || !notes) return;
    try {
      audio ||= new Context();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      notes.forEach((note, index) => {
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        const time = audio.currentTime + index * .075;
        oscillator.frequency.value = note;
        volume.gain.setValueAtTime(.001, time);
        volume.gain.exponentialRampToValueAtTime(.06, time + .012);
        volume.gain.exponentialRampToValueAtTime(.001, time + .15);
        oscillator.connect(volume).connect(audio.destination);
        oscillator.start(time);
        oscillator.stop(time + .16);
      });
    } catch {}
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && !button.disabled && !button.matches('.cell')) feedback('tap');
  }, true);
  return feedback;
}

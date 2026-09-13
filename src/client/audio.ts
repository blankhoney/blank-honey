import { report } from './log';
type Station = { id: string; name: string; url: string | null };
type State = 'empty' | 'idle' | 'loading' | 'playing' | 'paused' | 'waiting-for-click' | 'error';
export function initAudio() {
  const audio = document.querySelector<HTMLAudioElement>('#audio');
  const data = document.querySelector('#radio-data');
  if (!audio || !data) return;
  const stations: Station[] = JSON.parse(data.textContent!);
  const select = document.querySelector<HTMLSelectElement>('#station')!;
  const button = document.querySelector<HTMLButtonElement>('#audio-toggle')!;
  const status = document.querySelector<HTMLElement>('#audio-status')!;
  let state: State = 'idle',
    userPaused = false,
    attempt = 0;
  const messages: Record<State, string> = {
    empty: '暂无预置电台',
    idle: '准备播放',
    loading: '正在连接',
    playing: '正在播放',
    paused: '已暂停',
    'waiting-for-click': '点击一次，开始播放',
    error: '当前电台暂不可用',
  };
  const set = (next: State) => {
    state = next;
    status.textContent = messages[next];
    button.textContent = next === 'playing' ? '暂停' : next === 'loading' ? '取消' : '播放';
  };
  async function play() {
    const token = ++attempt;
    set('loading');
    try {
      await audio!.play();
      if (token === attempt) set('playing');
    } catch (error) {
      if (token !== attempt) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        set('waiting-for-click');
      else {
        set('error');
        report('audio', error);
      }
    }
  }
  function choose() {
    ++attempt;
    audio!.pause();
    userPaused = false;
    const station = stations.find((s) => s.id === select.value);
    if (!station?.url) {
      set('error');
      return;
    }
    audio!.src = station.url;
    void play();
  }
  select.addEventListener('change', choose);
  button.addEventListener('click', () => {
    if (state === 'playing' || state === 'loading') {
      ++attempt;
      userPaused = true;
      audio.pause();
      set('paused');
    } else {
      userPaused = false;
      void play();
    }
  });
  document.addEventListener('click', (event) => {
    if (
      state === 'waiting-for-click' &&
      !userPaused &&
      !(event.target instanceof Element && event.target.closest('#player'))
    )
      void play();
  });
  audio.addEventListener('ended', () => {
    userPaused = true;
    set('paused');
  });
  audio.addEventListener('error', () => {
    set('error');
    report('audio', new Error('Playback failed'));
  });
  const first = stations.find((s) => s.url);
  if (first) {
    select.value = first.id;
    choose();
  } else {
    set('empty');
    button.disabled = true;
  }
}

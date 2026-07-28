import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createObserver } from '#core/dom/observer';

describe('createObserver', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('初始挂载不立即触发回调', () => {
    const onMutations = vi.fn();
    const observer = createObserver({ target: document.body, onMutations, debounceMs: 50 });
    observer.start();
    expect(onMutations).not.toHaveBeenCalled();
    observer.stop();
  });

  it('添加子节点触发回调（防抖后）', async () => {
    const onMutations = vi.fn();
    const observer = createObserver({ target: document.body, onMutations, debounceMs: 30 });
    observer.start();

    const child = document.createElement('div');
    document.body.appendChild(child);
    expect(onMutations).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 50));
    expect(onMutations).toHaveBeenCalledTimes(1);
    observer.stop();
  });

  it('多次连续变更合并成一次回调', async () => {
    const onMutations = vi.fn();
    const observer = createObserver({ target: document.body, onMutations, debounceMs: 30 });
    observer.start();

    for (let i = 0; i < 5; i += 1) {
      document.body.appendChild(document.createElement('span'));
    }

    await new Promise((r) => setTimeout(r, 50));
    expect(onMutations).toHaveBeenCalledTimes(1);
    observer.stop();
  });

  it('stop 后不再触发回调', async () => {
    const onMutations = vi.fn();
    const observer = createObserver({ target: document.body, onMutations, debounceMs: 30 });
    observer.start();
    observer.stop();

    document.body.appendChild(document.createElement('div'));
    await new Promise((r) => setTimeout(r, 50));
    expect(onMutations).not.toHaveBeenCalled();
  });
});

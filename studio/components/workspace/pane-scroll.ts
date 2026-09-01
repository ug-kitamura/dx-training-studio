/** ペイン内でホイールをスクロール可能な領域へ伝播する */

function isVerticallyScrollable(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

function canScrollFurther(el: HTMLElement, deltaY: number): boolean {
  if (!isVerticallyScrollable(el)) return false;
  if (deltaY < 0) return el.scrollTop > 0;
  if (deltaY > 0) {
    return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }
  return false;
}

function isWheelScrollableElement(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) {
    return isVerticallyScrollable(el);
  }
  const { overflowY } = getComputedStyle(el);
  return (
    (overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay") &&
    isVerticallyScrollable(el)
  );
}

export function handlePaneWheel(
  paneRoot: HTMLElement,
  scrollTarget: HTMLElement,
  event: WheelEvent,
): void {
  let node = event.target as HTMLElement | null;
  while (node && node !== scrollTarget) {
    if (isWheelScrollableElement(node) && canScrollFurther(node, event.deltaY)) {
      return;
    }
    if (node === paneRoot) break;
    node = node.parentElement;
  }

  if (!isVerticallyScrollable(scrollTarget)) return;
  if (!canScrollFurther(scrollTarget, event.deltaY)) return;

  scrollTarget.scrollTop += event.deltaY;
  event.preventDefault();
}

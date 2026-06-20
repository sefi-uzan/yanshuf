let dragGhost: HTMLElement | null = null;

export function setListItemDragImage(event: DragEvent, itemElement: HTMLElement): void {
  removeListItemDragImage();

  const rect = itemElement.getBoundingClientRect();
  const clone = itemElement.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.top = '-10000px';
  clone.style.left = '0';
  clone.style.width = `${rect.width}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.pointerEvents = 'none';
  clone.style.opacity = '1';
  clone.setAttribute('aria-hidden', 'true');
  document.body.appendChild(clone);
  dragGhost = clone;

  const transfer = event.dataTransfer;
  if (!transfer) return;

  transfer.setDragImage(
    clone,
    event.clientX - rect.left,
    event.clientY - rect.top,
  );
}

export function removeListItemDragImage(): void {
  dragGhost?.remove();
  dragGhost = null;
}

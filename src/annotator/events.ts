import type { SidebarLayout } from '../types/annotator';

type LayoutChangeEventDetail = {
  isSideBySideActive: boolean;
  sidebarLayout: SidebarLayout;
};

export class LayoutChangeEvent extends CustomEvent<LayoutChangeEventDetail> {
  constructor(detail: LayoutChangeEventDetail) {
    super('hypothesis:layoutchange', {
      bubbles: true,
      cancelable: false,
      detail,
    });
  }
}

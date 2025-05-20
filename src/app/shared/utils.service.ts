import { afterNextRender, Injectable, Injector } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  constructor() {}
  createRenderPromise(injector: Injector) {
    return new Promise<void>((resolve) => {
      afterNextRender(
        {
          read: () => {
            resolve();
          },
        },
        { injector }
      );
    });
  }
}

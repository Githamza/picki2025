import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// if (!environment.production) {
//   import('@stagewise/toolbar').then(({ initToolbar }) => {
//     initToolbar({ plugins: [] });
//   });
// }
// if prod do not show console log
bootstrapApplication(AppComponent, appConfig).then(() => {
  if (environment.production) {
    window.console.log = function() {};
  } else {
    console.log('Development mode');
  }
}).catch((err) =>
  // if environment.production, log the error to the console
  console.error(err)
);

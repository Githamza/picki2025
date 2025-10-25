import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaygreenConfigService } from '../../services/paygreen-config.service';
import { PaygreenEnvironmentUtil } from '../../shared/utils/paygreen-environment.util';

@Component({
  selector: 'app-paygreen-config-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="paygreen-config-demo">
      <h3>PayGreen Configuration Demo</h3>
      
      <div class="config-info">
        <h4>Current Configuration:</h4>
        <ul>
          <li><strong>Environment:</strong> {{ currentEnvironment }}</li>
          <li><strong>API URL:</strong> {{ currentApiUrl }}</li>
          <li><strong>Is Production:</strong> {{ isProduction ? 'Yes' : 'No' }}</li>
          <li><strong>Is Sandbox:</strong> {{ isSandbox ? 'Yes' : 'No' }}</li>
        </ul>
      </div>

      <div class="environment-switch">
        <h4>Environment URLs:</h4>
        <ul>
          <li><strong>Production:</strong> https://api.paygreen.fr</li>
          <li><strong>Sandbox:</strong> https://sb-api.paygreen.fr</li>
        </ul>
      </div>

      <div class="actions">
        <button (click)="logConfiguration()" class="btn btn-primary">
          Log Configuration to Console
        </button>
      </div>
    </div>
  `,
  styles: [`
    .paygreen-config-demo {
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin: 20px 0;
      background-color: #f9f9f9;
    }

    .config-info, .environment-switch {
      margin: 15px 0;
    }

    .config-info ul, .environment-switch ul {
      list-style-type: none;
      padding-left: 0;
    }

    .config-info li, .environment-switch li {
      padding: 5px 0;
      border-bottom: 1px solid #eee;
    }

    .actions {
      margin-top: 20px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-primary {
      background-color: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background-color: #0056b3;
    }
  `]
})
export class PaygreenConfigDemoComponent implements OnInit {
  currentEnvironment: string = '';
  currentApiUrl: string = '';
  isProduction: boolean = false;
  isSandbox: boolean = false;

  constructor(private paygreenConfig: PaygreenConfigService) {}

  ngOnInit(): void {
    this.updateConfiguration();
  }

  private updateConfiguration(): void {
    this.currentEnvironment = this.paygreenConfig.getEnvironment();
    this.currentApiUrl = this.paygreenConfig.getApiUrl();
    this.isProduction = this.paygreenConfig.isProduction();
    this.isSandbox = this.paygreenConfig.isSandbox();
  }

  logConfiguration(): void {
    PaygreenEnvironmentUtil.logConfiguration();
    console.log('PayGreen Config Service:', this.paygreenConfig.getConfig());
  }
}

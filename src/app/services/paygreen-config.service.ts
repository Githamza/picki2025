import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type PayGreenEnvironment = 'production' | 'sandbox';

export interface PayGreenConfig {
  environment: PayGreenEnvironment;
  apiUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaygreenConfigService {
  private readonly config: PayGreenConfig;

  constructor() {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): PayGreenConfig {
    const env = environment.paygreen.environment as PayGreenEnvironment;
    const apiUrl = this.getApiUrlForEnvironment(env);
    
    return {
      environment: env,
      apiUrl,
    };
  }

  private getApiUrlForEnvironment(environment: PayGreenEnvironment): string {
    switch (environment) {
      case 'production':
        return 'https://api.paygreen.fr';
      case 'sandbox':
        return 'https://sb-api.paygreen.fr';
      default:
        console.warn(`Unknown PayGreen environment: ${environment}. Defaulting to sandbox.`);
        return 'https://sb-api.paygreen.fr';
    }
  }

  /**
   * Get the current PayGreen API URL
   */
  getApiUrl(): string {
    return this.config.apiUrl;
  }

  /**
   * Get the current PayGreen environment
   */
  getEnvironment(): PayGreenEnvironment {
    return this.config.environment;
  }

  /**
   * Check if we're using the production environment
   */
  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Check if we're using the sandbox environment
   */
  isSandbox(): boolean {
    return this.config.environment === 'sandbox';
  }

  /**
   * Get the full configuration
   */
  getConfig(): PayGreenConfig {
    return { ...this.config };
  }
}

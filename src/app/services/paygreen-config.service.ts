import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type PayGreenEnvironment = 'production' | 'sandbox';

export interface PayGreenConfig {
  environment: PayGreenEnvironment;
  apiUrl: string;
  isSandbox: boolean;
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
    const isSandbox = environment.paygreenSandboxEnv ?? false;
    // API URL is now determined by paygreenSandboxEnv flag
    const apiUrl = isSandbox ? 'https://sb-api.paygreen.fr' : 'https://api.paygreen.fr';
    const env: PayGreenEnvironment = isSandbox ? 'sandbox' : 'production';
    
    return {
      environment: env,
      apiUrl,
      isSandbox,
    };
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
   * Check if we're using the sandbox environment (API URL)
   */
  isSandboxEnvironment(): boolean {
    return this.config.environment === 'sandbox';
  }

  /**
   * Check if we should use sandbox credentials from the database
   * This is controlled by the paygreenSandboxEnv environment variable
   */
  useSandboxCredentials(): boolean {
    return this.config.isSandbox;
  }

  /**
   * Get the full configuration
   */
  getConfig(): PayGreenConfig {
    return { ...this.config };
  }
}

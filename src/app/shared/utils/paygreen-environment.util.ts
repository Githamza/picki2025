import { environment } from '../../../environments/environment';

/**
 * Utility functions for PayGreen environment management
 */
export class PaygreenEnvironmentUtil {
  /**
   * Get the PayGreen API URL based on the current environment configuration
   */
  static getApiUrl(): string {
    const config = environment.paygreen;
    if (!config) {
      console.warn('PayGreen configuration not found in environment. Using sandbox as default.');
      return 'https://sb-api.paygreen.fr';
    }

    return config.apiUrl || this.getApiUrlForEnvironment(config.environment);
  }

  /**
   * Get the PayGreen API URL for a specific environment
   */
  static getApiUrlForEnvironment(env: 'production' | 'sandbox'): string {
    switch (env) {
      case 'production':
        return 'https://api.paygreen.fr';
      case 'sandbox':
        return 'https://sb-api.paygreen.fr';
      default:
        console.warn(`Unknown PayGreen environment: ${env}. Using sandbox as default.`);
        return 'https://sb-api.paygreen.fr';
    }
  }

  /**
   * Check if we're using the production environment
   */
  static isProduction(): boolean {
    const config = environment.paygreen;
    return config?.environment === 'production';
  }

  /**
   * Check if we're using the sandbox environment
   */
  static isSandbox(): boolean {
    const config = environment.paygreen;
    return config?.environment === 'sandbox';
  }

  /**
   * Get the current environment name
   */
  static getCurrentEnvironment(): 'production' | 'sandbox' {
    const config = environment.paygreen;
    return config?.environment || 'sandbox';
  }

  /**
   * Log the current PayGreen configuration for debugging
   */
  static logConfiguration(): void {
    const config = environment.paygreen;
    console.log('PayGreen Configuration:', {
      environment: config?.environment || 'sandbox',
      apiUrl: this.getApiUrl(),
      isProduction: this.isProduction(),
      isSandbox: this.isSandbox(),
    });
  }
}

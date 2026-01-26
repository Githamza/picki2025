import { environment } from '../../../environments/environment';

/**
 * Utility functions for PayGreen environment management
 * All settings are now controlled by the paygreenSandboxEnv flag
 */
export class PaygreenEnvironmentUtil {
  /**
   * Get the PayGreen API URL based on the current environment configuration
   */
  static getApiUrl(): string {
    const isSandbox = environment.paygreenSandboxEnv ?? false;
    return isSandbox ? 'https://sb-api.paygreen.fr' : 'https://api.paygreen.fr';
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
    return !(environment.paygreenSandboxEnv ?? false);
  }

  /**
   * Check if we're using the sandbox environment
   */
  static isSandbox(): boolean {
    return environment.paygreenSandboxEnv ?? false;
  }

  /**
   * Get the current environment name
   */
  static getCurrentEnvironment(): 'production' | 'sandbox' {
    return this.isSandbox() ? 'sandbox' : 'production';
  }

  /**
   * Log the current PayGreen configuration for debugging
   */
  static logConfiguration(): void {
    console.log('PayGreen Configuration:', {
      environment: this.getCurrentEnvironment(),
      apiUrl: this.getApiUrl(),
      isProduction: this.isProduction(),
      isSandbox: this.isSandbox(),
    });
  }
}

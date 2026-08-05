import { registerPlugin } from '@capacitor/core';

export interface PairedDevice {
  name: string;
  address: string;
}

export interface ThermalPrinterPlugin {
  /** Whether the device has a Bluetooth adapter at all. */
  isSupported(): Promise<{ supported: boolean }>;
  /** Whether Bluetooth is currently turned on. */
  isEnabled(): Promise<{ enabled: boolean }>;
  checkBluetoothPermission(): Promise<{ granted: boolean }>;
  requestBluetoothPermission(): Promise<{ granted: boolean }>;
  /** Devices already paired in Android Settings. SPP requires a bonded device. */
  listPairedDevices(): Promise<{ devices: PairedDevice[] }>;
  /** `data` is the ESC/POS byte stream, base64 encoded. */
  print(options: { address: string; data: string }): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Error codes rejected by the native side. Kept in sync with
 * android/app/src/main/java/com/pikiapp/tablet/ThermalPrinterPlugin.java
 */
export type PrinterErrorCode =
  | 'NO_ADAPTER'
  | 'BT_DISABLED'
  | 'NO_PERMISSION'
  | 'NOT_PAIRED'
  | 'CONNECT_FAILED'
  | 'WRITE_FAILED'
  | 'INVALID_ARGS'
  | 'UNAVAILABLE';

/**
 * Web fallback so `ng serve` in a browser - and the admin used from a laptop -
 * never throws. Everything reports "unsupported" and printing rejects loudly.
 */
const webFallback: ThermalPrinterPlugin = {
  isSupported: async () => ({ supported: false }),
  isEnabled: async () => ({ enabled: false }),
  checkBluetoothPermission: async () => ({ granted: false }),
  requestBluetoothPermission: async () => ({ granted: false }),
  listPairedDevices: async () => ({ devices: [] }),
  print: async () => {
    const error = new Error('Bluetooth printing is only available in the Android app');
    (error as Error & { code: PrinterErrorCode }).code = 'UNAVAILABLE';
    throw error;
  },
  disconnect: async () => {},
};

export const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter', {
  web: () => webFallback,
});
